/**
 * IntervalCoach - Fitness Metrics & Projections
 *
 * CTL/ATL/TSB tracking, fitness projections, and workout impact previews.
 */

// =========================================================
// FITNESS METRICS
// =========================================================

/**
 * Fetch fitness metrics (CTL, ATL, TSB) from Intervals.icu for a specific date
 * @param {Date} targetDate - Optional date to fetch metrics for (defaults to today)
 * @returns {object} { ctl, atl, tsb, rampRate, eftp }
 */
function fetchFitnessMetrics(targetDate) {
  const date = targetDate || new Date();
  const dateStr = formatDateISO(date);
  const weekBefore = new Date(date);
  weekBefore.setDate(date.getDate() - 7);
  const weekBeforeStr = formatDateISO(weekBefore);

  // Fetch wellness data for target date
  const dateResult = fetchIcuApi("/athlete/0/wellness/" + dateStr);
  const weekBeforeResult = fetchIcuApi("/athlete/0/wellness/" + weekBeforeStr);

  let ctl = null, atl = null, tsb = null, rampRate = null, eftp = null;

  if (dateResult.success && dateResult.data) {
    ctl = dateResult.data.ctl;
    atl = dateResult.data.atl;
    if (ctl != null && atl != null) {
      tsb = ctl - atl;
    }
  }

  // Calculate ramp rate (CTL change per week)
  if (weekBeforeResult.success && weekBeforeResult.data && ctl != null) {
    const oldCtl = weekBeforeResult.data.ctl;
    if (oldCtl != null) {
      rampRate = ctl - oldCtl;
    }
  }

  // Fetch eFTP for the target date
  eftp = fetchHistoricalEftp(date);

  return {
    ctl: ctl,
    atl: atl,
    tsb: tsb,
    rampRate: rampRate,
    eftp: eftp
  };
}

/**
 * Fetch fitness trend data (CTL, ATL, TSB) for the last N days
 * @param {number} days - Number of days to look back (default 14)
 * @returns {Array} Array of daily fitness metrics sorted by date descending
 */
function fetchFitnessTrend(days) {
  days = days || 14;
  const today = new Date();
  const startDate = new Date(today);
  startDate.setDate(today.getDate() - days);

  const oldestStr = formatDateISO(startDate);
  const newestStr = formatDateISO(today);

  const result = fetchIcuApi("/athlete/0/wellness?oldest=" + oldestStr + "&newest=" + newestStr);

  if (!result.success || !Array.isArray(result.data)) {
    Logger.log("Error fetching fitness trend: " + (result.error || "No data"));
    return [];
  }

  // Map to simplified format and sort by date descending (most recent first)
  const trend = result.data
    .filter(function(d) { return d.ctl != null || d.atl != null; })
    .map(function(d) {
      return {
        date: d.id,  // id is the date string in wellness API
        ctl: d.ctl,
        atl: d.atl,
        tsb: d.ctl != null && d.atl != null ? d.ctl - d.atl : null,
        recoveryScore: d.recovery_score,
        hrv: d.hrv,
        restingHR: d.resting_hr,
        sleep: d.sleep_time
      };
    })
    .sort(function(a, b) { return new Date(b.date) - new Date(a.date); });

  return trend;
}

/**
 * Fetch historical eFTP value for a specific date from fitness-model-events
 * @param {Date} date - The date to get eFTP for (finds most recent SET_EFTP event before this date)
 * @returns {number|null} eFTP value or null if not available
 */
function fetchHistoricalEftp(date) {
  const targetDate = date || new Date();
  const targetDateStr = formatDateISO(targetDate);

  const result = fetchIcuApi("/athlete/0/fitness-model-events");

  if (!result.success) {
    Logger.log("Error fetching historical eFTP: " + result.error);
    return null;
  }

  const events = result.data;

  // Filter SET_EFTP events and find the most recent one on or before the target date
  const eftpEvents = events
    .filter(function(e) { return e.category === "SET_EFTP" && e.start_date <= targetDateStr; })
    .sort(function(a, b) { return b.start_date.localeCompare(a.start_date); });

  if (eftpEvents.length > 0) {
    // The value is stored in the event data
    return eftpEvents[0].value || null;
  }

  return null;
}

// =========================================================
// FITNESS PROJECTION
// =========================================================

/**
 * Project CTL/ATL/TSB over the next N days given planned workouts
 * Uses standard exponential weighted moving average with CTL=42 days, ATL=7 days
 * @param {number} currentCTL - Current CTL value
 * @param {number} currentATL - Current ATL value
 * @param {Array} plannedWorkouts - Array of {date, tss} for upcoming workouts
 * @param {number} days - Number of days to project (default 14)
 * @returns {Array} Array of {date, dayName, ctl, atl, tsb, tss} projections
 */
function projectFitnessMetrics(currentCTL, currentATL, plannedWorkouts, days) {
  days = days || 14;
  const CTL_CONSTANT = 42;
  const ATL_CONSTANT = 7;

  const projections = [];
  let ctl = currentCTL || 0;
  let atl = currentATL || 0;

  // Create a map of date -> TSS for quick lookup
  const tssMap = {};
  if (plannedWorkouts && plannedWorkouts.length > 0) {
    for (var i = 0; i < plannedWorkouts.length; i++) {
      var w = plannedWorkouts[i];
      if (w.date && w.tss) {
        tssMap[w.date] = w.tss;
      }
    }
  }

  for (var d = 0; d < days; d++) {
    var date = new Date();
    date.setDate(date.getDate() + d);
    var dateStr = formatDateISO(date);
    var dayName = Utilities.formatDate(date, SYSTEM_SETTINGS.TIMEZONE, "EEE");

    // Get TSS for this date (0 if no workout planned)
    var tss = tssMap[dateStr] || 0;

    // Update CTL and ATL using exponential weighted moving average
    ctl = ctl + (tss - ctl) / CTL_CONSTANT;
    atl = atl + (tss - atl) / ATL_CONSTANT;
    var tsb = ctl - atl;

    projections.push({
      date: dateStr,
      dayName: dayName,
      ctl: Math.round(ctl * 10) / 10,
      atl: Math.round(atl * 10) / 10,
      tsb: Math.round(tsb * 10) / 10,
      tss: tss
    });
  }

  return projections;
}

/**
 * Fetch upcoming planned workouts with TSS estimates for the next N days
 * Extracts TSS from Weekly Plan events or estimates from workout category
 * @param {number} days - Number of days to look ahead (default 14)
 * @returns {Array} Array of {date, activityType, estimatedTSS, duration, source} for each planned day
 */
function fetchUpcomingPlannedTSS(days) {
  days = days || 14;
  const plannedWorkouts = [];

  const today = new Date();
  const startStr = formatDateISO(today);
  var endDate = new Date(today);
  endDate.setDate(today.getDate() + days - 1);
  const endStr = formatDateISO(endDate);

  // Fetch all events in date range
  const result = fetchIcuApi("/athlete/0/events?oldest=" + startStr + "&newest=" + endStr);

  if (!result.success || !Array.isArray(result.data)) {
    Logger.log("Error fetching upcoming planned TSS: " + (result.error || "No data"));
    return plannedWorkouts;
  }

  // Group events by date
  const eventsByDate = {};
  for (var i = 0; i < result.data.length; i++) {
    var e = result.data[i];
    var eventDate = e.start_date ? e.start_date.substring(0, 10) : null;
    if (eventDate) {
      if (!eventsByDate[eventDate]) {
        eventsByDate[eventDate] = [];
      }
      eventsByDate[eventDate].push(e);
    }
  }

  // Process each day
  for (var d = 0; d < days; d++) {
    var checkDate = new Date(today);
    checkDate.setDate(today.getDate() + d);
    var dateStr = formatDateISO(checkDate);

    var events = eventsByDate[dateStr] || [];
    var dailyTSS = 0;
    var activityType = null;
    var duration = null;
    var source = 'none';

    for (var j = 0; j < events.length; j++) {
      var event = events[j];

      // Check for Weekly Plan placeholder with TSS target
      if (event.description && event.description.indexOf('[Weekly Plan]') !== -1) {
        var tssMatch = event.description.match(/TSS Target: ~(\d+)/);
        if (tssMatch) {
          dailyTSS = parseInt(tssMatch[1], 10);
          source = 'weekly_plan';
        }
        var durationMatch = event.description.match(/Duration: (\d+) min/);
        if (durationMatch) {
          duration = parseInt(durationMatch[1], 10);
        }
        // Detect activity type from name
        if (event.name) {
          var nameLower = event.name.toLowerCase();
          if (nameLower.indexOf('run') !== -1 || nameLower.indexOf('hardlopen') !== -1) {
            activityType = 'Run';
          } else if (nameLower.indexOf('ride') !== -1 || nameLower.indexOf('fietsen') !== -1) {
            activityType = 'Ride';
          }
        }
      }

      // Check for WORKOUT category events (have actual TSS)
      if (event.category === 'WORKOUT' && event.icu_training_load) {
        dailyTSS += event.icu_training_load;
        source = 'workout';
      }

      // Check for race events (estimate high TSS)
      if (event.category && event.category.indexOf('RACE') !== -1) {
        // Races typically have high TSS - estimate based on duration or default
        dailyTSS = Math.max(dailyTSS, event.icu_training_load || 150);
        source = 'race';
        activityType = 'Race';
      }
    }

    plannedWorkouts.push({
      date: dateStr,
      activityType: activityType,
      tss: dailyTSS,
      duration: duration,
      source: source
    });
  }

  return plannedWorkouts;
}

// =========================================================
// WORKOUT IMPACT PREVIEW
// =========================================================

/**
 * Generate workout impact preview showing CTL/ATL/TSB projections
 * Compares with vs without today's workout
 * @param {number} todaysTSS - Estimated TSS for today's workout
 * @param {object} fitnessMetrics - Current fitness metrics {ctl, atl, tsb}
 * @param {number} days - Days to project (default 14)
 * @returns {object} {withWorkout, withoutWorkout, impact} projections and comparison
 */
function generateWorkoutImpactPreview(todaysTSS, fitnessMetrics, days) {
  days = days || 14;
  const currentCTL = fitnessMetrics.ctl || 0;
  const currentATL = fitnessMetrics.atl || 0;

  // Fetch upcoming planned workouts
  const upcomingWorkouts = fetchUpcomingPlannedTSS(days);

  // Scenario 1: WITH today's workout (inject todaysTSS for today)
  const workoutsWithToday = upcomingWorkouts.map(function(w) {
    if (w.date === formatDateISO(new Date())) {
      return { date: w.date, tss: todaysTSS };
    }
    return { date: w.date, tss: w.tss };
  });
  const projectionWithWorkout = projectFitnessMetrics(currentCTL, currentATL, workoutsWithToday, days);

  // Scenario 2: WITHOUT today's workout (rest day)
  const workoutsWithoutToday = upcomingWorkouts.map(function(w) {
    if (w.date === formatDateISO(new Date())) {
      return { date: w.date, tss: 0 };
    }
    return { date: w.date, tss: w.tss };
  });
  const projectionWithoutWorkout = projectFitnessMetrics(currentCTL, currentATL, workoutsWithoutToday, days);

  // Calculate key impact metrics
  var endIdx = projectionWithWorkout.length - 1;
  var tomorrowIdx = 1;

  // Impact analysis
  var impact = {
    // Tomorrow's TSB difference
    tomorrowTSBDelta: projectionWithWorkout[tomorrowIdx].tsb - projectionWithoutWorkout[tomorrowIdx].tsb,
    // End of 2 weeks CTL difference
    twoWeekCTLDelta: projectionWithWorkout[endIdx].ctl - projectionWithoutWorkout[endIdx].ctl,
    // Lowest TSB in next week (fatigue valley)
    lowestTSB: Math.min.apply(null, projectionWithWorkout.slice(0, 7).map(function(p) { return p.tsb; })),
    // Days until TSB returns positive
    daysToPositiveTSB: null,
    // Peak form window (when TSB is optimal 0-20)
    peakFormWindow: []
  };

  // Find days until positive TSB
  for (var i = 0; i < projectionWithWorkout.length; i++) {
    if (projectionWithWorkout[i].tsb >= 0) {
      impact.daysToPositiveTSB = i;
      break;
    }
  }

  // Find peak form windows (TSB between 0 and 20)
  for (var k = 0; k < projectionWithWorkout.length; k++) {
    var proj = projectionWithWorkout[k];
    if (proj.tsb >= 0 && proj.tsb <= 20) {
      impact.peakFormWindow.push(proj.date);
    }
  }

  return {
    withWorkout: projectionWithWorkout,
    withoutWorkout: projectionWithoutWorkout,
    upcomingWorkouts: upcomingWorkouts,
    impact: impact,
    todaysTSS: todaysTSS,
    currentMetrics: {
      ctl: currentCTL,
      atl: currentATL,
      tsb: currentCTL - currentATL
    }
  };
}

// =========================================================
// WEEKLY IMPACT PREVIEW
// =========================================================

/**
 * Generate a weekly impact preview showing how planned workouts affect fitness over the week
 * @param {Array} plannedDays - Array of planned workout days from generateAIWeeklyPlan
 * @param {object} fitnessMetrics - Current CTL/ATL/TSB
 * @param {number} days - Number of days to project (default 7)
 * @returns {object} Weekly projection with day-by-day metrics and summary
 */
function generateWeeklyImpactPreview(plannedDays, fitnessMetrics, days) {
  days = days || 7;

  var currentCTL = fitnessMetrics.ctl || 0;
  var currentATL = fitnessMetrics.atl || 0;
  var currentTSB = currentCTL - currentATL;

  // Build planned workouts array with TSS estimates
  var plannedWorkouts = [];

  if (plannedDays && plannedDays.length > 0) {
    for (var i = 0; i < plannedDays.length; i++) {
      var day = plannedDays[i];
      var tss = day.estimatedTSS || 0;

      // If no TSS but has workout type, estimate it
      if (!tss && day.workoutType && day.activity !== 'Rest') {
        tss = estimateWorkoutTSS({
          type: day.workoutType,
          duration: day.duration || 60
        });
      }

      plannedWorkouts.push({
        date: day.date,
        tss: tss,
        workoutType: day.workoutType || day.activity || 'Rest',
        dayName: day.dayName
      });
    }
  }

  // Project fitness metrics for the week
  var projections = projectFitnessMetrics(currentCTL, currentATL, plannedWorkouts, days);

  // Merge workout info with projections
  var weeklyProjection = [];
  for (var j = 0; j < projections.length; j++) {
    var proj = projections[j];
    var workout = plannedWorkouts.find(function(w) { return w.date === proj.date; });

    weeklyProjection.push({
      date: proj.date,
      dayName: proj.dayName,
      workoutType: workout ? workout.workoutType : 'Rest',
      tss: proj.tss,
      ctl: proj.ctl,
      atl: proj.atl,
      tsb: proj.tsb
    });
  }

  // Calculate weekly summary
  var totalTSS = 0;
  var lowestTSB = currentTSB;
  var highestTSB = currentTSB;
  var peakFormDays = [];
  var fatigueWarningDays = [];

  for (var k = 0; k < weeklyProjection.length; k++) {
    var day = weeklyProjection[k];
    totalTSS += day.tss;

    if (day.tsb < lowestTSB) lowestTSB = day.tsb;
    if (day.tsb > highestTSB) highestTSB = day.tsb;

    // Peak form: TSB between 0 and 20
    if (day.tsb >= 0 && day.tsb <= 20) {
      peakFormDays.push(day.dayName + ' ' + day.date.substring(5));
    }

    // Fatigue warning: TSB below -20
    if (day.tsb < -20) {
      fatigueWarningDays.push(day.dayName + ' ' + day.date.substring(5));
    }
  }

  var endOfWeek = weeklyProjection[weeklyProjection.length - 1];

  return {
    projections: weeklyProjection,
    summary: {
      totalTSS: totalTSS,
      startCTL: currentCTL,
      endCTL: endOfWeek.ctl,
      ctlChange: Math.round((endOfWeek.ctl - currentCTL) * 10) / 10,
      startTSB: currentTSB,
      endTSB: endOfWeek.tsb,
      lowestTSB: Math.round(lowestTSB * 10) / 10,
      highestTSB: Math.round(highestTSB * 10) / 10,
      peakFormDays: peakFormDays,
      fatigueWarningDays: fatigueWarningDays,
      sustainableLoad: lowestTSB >= -30 // TSB staying above -30 is generally sustainable
    }
  };
}

/**
 * Generate AI narrative for weekly impact preview
 * @param {object} weeklyImpact - Output from generateWeeklyImpactPreview
 * @param {object} goals - Upcoming goals
 * @param {object} phaseInfo - Training phase info
 * @returns {object} AI-generated narrative and insights
 */
function generateAIWeeklyImpactNarrative(weeklyImpact, goals, phaseInfo) {
  var t = getTranslations();

  // Build context for AI
  var projectionTable = weeklyImpact.projections.map(function(p) {
    return p.dayName + ' ' + p.date.substring(5) + ': ' + p.workoutType + ' (TSS ' + p.tss + ') -> CTL ' + p.ctl + ', TSB ' + p.tsb;
  }).join('\n');

  var prompt = 'You are a cycling coach analyzing a week of planned training.\n\n' +
    'CURRENT STATE:\n' +
    '- CTL (Fitness): ' + weeklyImpact.summary.startCTL.toFixed(1) + '\n' +
    '- TSB (Form): ' + weeklyImpact.summary.startTSB.toFixed(1) + '\n' +
    '- Training Phase: ' + phaseInfo.phaseName + '\n' +
    '- Weeks to Goal: ' + phaseInfo.weeksOut + '\n' +
    (goals && goals.primaryGoal ? '- Goal: ' + goals.primaryGoal.name + ' (' + goals.primaryGoal.date + ')\n' : '') +
    '\nPLANNED WEEK:\n' + projectionTable + '\n\n' +
    'END OF WEEK:\n' +
    '- CTL Change: ' + (weeklyImpact.summary.ctlChange > 0 ? '+' : '') + weeklyImpact.summary.ctlChange.toFixed(1) + '\n' +
    '- End TSB: ' + weeklyImpact.summary.endTSB.toFixed(1) + '\n' +
    '- Lowest TSB: ' + weeklyImpact.summary.lowestTSB.toFixed(1) + '\n' +
    '- Total TSS: ' + weeklyImpact.summary.totalTSS + '\n' +
    (weeklyImpact.summary.peakFormDays.length > 0 ? '- Peak Form Days: ' + weeklyImpact.summary.peakFormDays.join(', ') + '\n' : '') +
    (weeklyImpact.summary.fatigueWarningDays.length > 0 ? '- HIGH FATIGUE WARNING: ' + weeklyImpact.summary.fatigueWarningDays.join(', ') + '\n' : '') +
    '\nProvide a brief analysis in ' + getPromptLanguage() + '.\n\n' +
    'Return JSON:\n{\n  "weekSummary": "One sentence summarizing the week\'s training impact",\n  "loadAssessment": "appropriate|aggressive|conservative|overreaching",\n  "keyInsights": ["2-3 bullet points about the week"],\n  "recommendation": "Brief advice for executing this week",\n  "riskLevel": "low|medium|high"\n}';

  try {
    var response = callGeminiAPIText(prompt);
    if (!response || typeof response !== 'string') {
      return generateFallbackWeeklyNarrative(weeklyImpact, phaseInfo);
    }

    // Parse JSON response
    var jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return generateFallbackWeeklyNarrative(weeklyImpact, phaseInfo);
    }

    var parsed = JSON.parse(jsonMatch[0]);

    return {
      success: true,
      aiEnhanced: true,
      weekSummary: parsed.weekSummary || '',
      loadAssessment: parsed.loadAssessment || 'appropriate',
      keyInsights: parsed.keyInsights || [],
      recommendation: parsed.recommendation || '',
      riskLevel: parsed.riskLevel || 'low'
    };
  } catch (e) {
    Logger.log('AI weekly narrative failed: ' + e.toString());
    return generateFallbackWeeklyNarrative(weeklyImpact, phaseInfo);
  }
}

/**
 * Fallback narrative when AI is unavailable
 */
function generateFallbackWeeklyNarrative(weeklyImpact, phaseInfo) {
  var summary = weeklyImpact.summary;
  var t = getTranslations();

  var loadAssessment = 'appropriate';
  var riskLevel = 'low';

  if (summary.lowestTSB < -30) {
    loadAssessment = 'overreaching';
    riskLevel = 'high';
  } else if (summary.lowestTSB < -20) {
    loadAssessment = 'aggressive';
    riskLevel = 'medium';
  } else if (summary.ctlChange < 0) {
    loadAssessment = 'conservative';
  }

  var insights = [];

  if (summary.ctlChange > 0) {
    insights.push('Fitness (CTL) will increase by ' + summary.ctlChange.toFixed(1) + ' points');
  } else {
    insights.push('Fitness (CTL) will decrease by ' + Math.abs(summary.ctlChange).toFixed(1) + ' points (recovery week)');
  }

  if (summary.peakFormDays.length > 0) {
    insights.push('Peak form window: ' + summary.peakFormDays.slice(0, 2).join(', '));
  }

  if (summary.fatigueWarningDays.length > 0) {
    insights.push('High fatigue expected: ' + summary.fatigueWarningDays.join(', '));
  }

  return {
    success: true,
    aiEnhanced: false,
    weekSummary: 'Total ' + summary.totalTSS + ' TSS planned, ending with TSB ' + summary.endTSB.toFixed(1),
    loadAssessment: loadAssessment,
    keyInsights: insights,
    recommendation: summary.sustainableLoad ? 'Load is sustainable for this phase.' : 'Consider adding recovery if fatigue accumulates.',
    riskLevel: riskLevel
  };
}

/**
 * Format weekly impact preview for email inclusion
 * @param {object} weeklyImpact - Output from generateWeeklyImpactPreview
 * @param {object} narrative - Output from generateAIWeeklyImpactNarrative
 * @returns {string} Formatted text section for email
 */
function formatWeeklyImpactSection(weeklyImpact, narrative) {
  var t = getTranslations();

  var section = '\n-----------------------------------\n';
  section += (t.weekly_impact_title || 'Weekly Training Impact') + '\n';
  section += '-----------------------------------\n';

  if (narrative && narrative.weekSummary) {
    section += narrative.weekSummary + '\n\n';
  }

  // Projection table
  section += 'Day       | Workout              | TSS | CTL  | TSB\n';
  section += '----------|----------------------|-----|------|-----\n';

  for (var i = 0; i < weeklyImpact.projections.length; i++) {
    var p = weeklyImpact.projections[i];
    var dayLabel = (p.dayName + ' ' + p.date.substring(5)).padEnd(9);
    var workoutLabel = (p.workoutType || 'Rest').substring(0, 20).padEnd(20);
    var tssLabel = String(p.tss).padStart(3);
    var ctlLabel = p.ctl.toFixed(1).padStart(4);
    var tsbLabel = (p.tsb >= 0 ? '+' : '') + p.tsb.toFixed(1);

    section += dayLabel + ' | ' + workoutLabel + ' | ' + tssLabel + ' | ' + ctlLabel + ' | ' + tsbLabel + '\n';
  }

  // Summary
  section += '\n';
  section += (t.weekly_summary || 'Week Summary') + ':\n';
  section += '- Total TSS: ' + weeklyImpact.summary.totalTSS + '\n';
  section += '- CTL: ' + weeklyImpact.summary.startCTL.toFixed(1) + ' -> ' + weeklyImpact.summary.endCTL.toFixed(1);
  section += ' (' + (weeklyImpact.summary.ctlChange >= 0 ? '+' : '') + weeklyImpact.summary.ctlChange.toFixed(1) + ')\n';
  section += '- TSB range: ' + weeklyImpact.summary.lowestTSB.toFixed(1) + ' to ' + weeklyImpact.summary.highestTSB.toFixed(1) + '\n';

  if (weeklyImpact.summary.peakFormDays.length > 0) {
    section += '- ' + (t.peak_form_days || 'Peak form') + ': ' + weeklyImpact.summary.peakFormDays.slice(0, 3).join(', ') + '\n';
  }

  if (narrative && narrative.keyInsights && narrative.keyInsights.length > 0) {
    section += '\n' + (t.key_insights || 'Key Insights') + ':\n';
    for (var j = 0; j < narrative.keyInsights.length; j++) {
      section += '- ' + narrative.keyInsights[j] + '\n';
    }
  }

  if (narrative && narrative.recommendation) {
    section += '\n' + narrative.recommendation + '\n';
  }

  return section;
}
