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
    // Debug: Log raw API values to diagnose TSB fluctuation
    Logger.log(`Fitness API (${dateStr}): CTL=${ctl?.toFixed(2)}, ATL=${atl?.toFixed(2)}, TSB=${tsb?.toFixed(2)}`);
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

  // Fallback: if no SET_EFTP events, get current eFTP from athlete data
  if (eftp == null) {
    try {
      const athleteData = fetchAthleteData();
      eftp = athleteData.eFtp || null;
    } catch (e) {
      // Ignore - eFTP will remain null
    }
  }

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

// =========================================================
// TAPER TIMING CALCULATION
// =========================================================

/**
 * Simulate taper to project CTL/ATL/TSB during reduced training
 * Models exponential decay of ATL faster than CTL, causing TSB to rise
 *
 * @param {number} startCTL - CTL at taper start
 * @param {number} startATL - ATL at taper start
 * @param {number} taperDays - Number of days to simulate
 * @param {number} taperIntensity - TSS as fraction of normal (e.g., 0.5 = 50% volume)
 * @param {number} normalDailyTSS - Normal daily TSS before taper
 * @returns {Array} Day-by-day projections of CTL/ATL/TSB
 */
function simulateTaper(startCTL, startATL, taperDays, taperIntensity, normalDailyTSS) {
  const CTL_CONSTANT = 42;
  const ATL_CONSTANT = 7;

  taperIntensity = taperIntensity || 0.5;  // Default 50% volume reduction
  normalDailyTSS = normalDailyTSS || (startCTL * 1.0);  // Estimate from CTL if not provided

  const taperDailyTSS = normalDailyTSS * taperIntensity;
  const projections = [];

  let ctl = startCTL;
  let atl = startATL;

  for (let day = 0; day <= taperDays; day++) {
    const tsb = ctl - atl;

    projections.push({
      day: day,
      ctl: Math.round(ctl * 10) / 10,
      atl: Math.round(atl * 10) / 10,
      tsb: Math.round(tsb * 10) / 10,
      tss: day === 0 ? 0 : Math.round(taperDailyTSS)
    });

    // Update for next day
    ctl = ctl + (taperDailyTSS - ctl) / CTL_CONSTANT;
    atl = atl + (taperDailyTSS - atl) / ATL_CONSTANT;
  }

  return projections;
}

/**
 * Calculate optimal taper start date to reach target TSB on race day
 * Works backwards from race to find when taper should begin
 *
 * @param {object} currentFitness - {ctl, atl, tsb} current metrics
 * @param {string} raceDate - Race date in YYYY-MM-DD format
 * @param {number} targetTSB - Target TSB on race day (default 10)
 * @param {object} options - Optional settings
 * @returns {object} Taper timing recommendation
 */
function calculateOptimalTaperStart(currentFitness, raceDate, targetTSB, options) {
  options = options || {};
  targetTSB = targetTSB || 10;  // Optimal freshness for most athletes

  const currentCTL = currentFitness.ctl || 0;
  const currentATL = currentFitness.atl || 0;
  const currentTSB = currentCTL - currentATL;

  // Calculate days until race
  const today = new Date();
  const race = new Date(raceDate);
  const daysToRace = Math.ceil((race - today) / (1000 * 60 * 60 * 24));

  if (daysToRace <= 0) {
    return {
      needed: false,
      reason: 'Race date has passed',
      daysToRace: daysToRace
    };
  }

  // Estimate normal daily TSS from current CTL
  const normalDailyTSS = options.normalDailyTSS || (currentCTL * 1.0);

  // Taper intensity options to test
  const taperIntensities = [
    { label: 'Light taper', intensity: 0.7, description: '70% volume' },
    { label: 'Moderate taper', intensity: 0.5, description: '50% volume' },
    { label: 'Aggressive taper', intensity: 0.3, description: '30% volume' }
  ];

  // Test different taper lengths (7-21 days) and intensities
  const scenarios = [];

  for (const taperOption of taperIntensities) {
    for (let taperLength = 7; taperLength <= 21; taperLength++) {
      // Days of normal training before taper starts
      const normalTrainingDays = daysToRace - taperLength;

      if (normalTrainingDays < 0) continue;  // Can't start taper before today

      // Simulate normal training until taper
      let ctl = currentCTL;
      let atl = currentATL;

      for (let d = 0; d < normalTrainingDays; d++) {
        ctl = ctl + (normalDailyTSS - ctl) / 42;
        atl = atl + (normalDailyTSS - atl) / 7;
      }

      // Simulate taper
      const taperProjection = simulateTaper(ctl, atl, taperLength, taperOption.intensity, normalDailyTSS);
      const raceDayMetrics = taperProjection[taperProjection.length - 1];

      // Calculate taper start date
      const taperStartDate = new Date(today);
      taperStartDate.setDate(today.getDate() + normalTrainingDays);

      scenarios.push({
        taperType: taperOption.label,
        taperIntensity: taperOption.intensity,
        taperDescription: taperOption.description,
        taperLengthDays: taperLength,
        taperStartDate: formatDateISO(taperStartDate),
        daysUntilTaperStart: normalTrainingDays,
        raceDayCTL: raceDayMetrics.ctl,
        raceDayATL: raceDayMetrics.atl,
        raceDayTSB: raceDayMetrics.tsb,
        targetTSBDelta: Math.abs(raceDayMetrics.tsb - targetTSB),
        ctlLoss: Math.round((currentCTL - raceDayMetrics.ctl) * 10) / 10
      });
    }
  }

  // Sort by how close to target TSB
  scenarios.sort((a, b) => a.targetTSBDelta - b.targetTSBDelta);

  // Get best scenario
  const best = scenarios[0];

  // Find alternatives (best from each taper type)
  const alternatives = [];
  for (const taperOption of taperIntensities) {
    const bestForType = scenarios.find(s => s.taperType === taperOption.label);
    if (bestForType && bestForType !== best) {
      alternatives.push(bestForType);
    }
  }

  // Determine if already in taper window
  const alreadyInTaperWindow = best.daysUntilTaperStart <= 0;
  const taperStartingSoon = best.daysUntilTaperStart <= 7;

  return {
    needed: true,
    daysToRace: daysToRace,
    raceDate: raceDate,
    targetTSB: targetTSB,
    currentTSB: Math.round(currentTSB * 10) / 10,
    currentCTL: Math.round(currentCTL * 10) / 10,

    // Recommended taper
    recommended: {
      taperType: best.taperType,
      taperIntensity: best.taperIntensity,
      taperDescription: best.taperDescription,
      taperLengthDays: best.taperLengthDays,
      taperStartDate: best.taperStartDate,
      daysUntilTaperStart: best.daysUntilTaperStart,
      raceDayCTL: best.raceDayCTL,
      raceDayTSB: best.raceDayTSB,
      ctlLoss: best.ctlLoss
    },

    alternatives: alternatives.slice(0, 2),

    // Status flags
    alreadyInTaperWindow: alreadyInTaperWindow,
    taperStartingSoon: taperStartingSoon,

    // All scenarios for analysis
    allScenarios: scenarios.slice(0, 10)
  };
}

/**
 * Generate comprehensive taper recommendation with AI insights
 * @param {object} currentFitness - Current CTL/ATL/TSB
 * @param {object} goal - Goal object with date and name
 * @param {object} phaseInfo - Training phase info
 * @returns {object} Complete taper recommendation
 */
function generateTaperRecommendation(currentFitness, goal, phaseInfo) {
  if (!goal || !goal.date) {
    return { available: false, reason: 'No goal date specified' };
  }

  // Calculate optimal taper timing
  const taperAnalysis = calculateOptimalTaperStart(currentFitness, goal.date, 10);

  if (!taperAnalysis.needed) {
    return { available: false, reason: taperAnalysis.reason };
  }

  // Only show taper recommendations within 6 weeks of race
  if (taperAnalysis.daysToRace > 42) {
    return {
      available: false,
      reason: 'Race is more than 6 weeks away',
      daysToRace: taperAnalysis.daysToRace
    };
  }

  // Generate AI-enhanced recommendation
  const aiRecommendation = generateAITaperRecommendation(taperAnalysis, goal, currentFitness, phaseInfo);

  return {
    available: true,
    analysis: taperAnalysis,
    aiRecommendation: aiRecommendation,
    summary: formatTaperSummary(taperAnalysis, goal)
  };
}

/**
 * Generate AI-enhanced taper recommendation
 */
function generateAITaperRecommendation(taperAnalysis, goal, currentFitness, phaseInfo) {
  const prompt = `You are a cycling coach planning a taper for an upcoming race.

RACE:
- Event: ${goal.name || 'A Race'}
- Date: ${goal.date}
- Days away: ${taperAnalysis.daysToRace}
${goal.description ? '- Description: ' + goal.description : ''}

CURRENT FITNESS:
- CTL (Fitness): ${currentFitness.ctl?.toFixed(1) || 'Unknown'}
- ATL (Fatigue): ${currentFitness.atl?.toFixed(1) || 'Unknown'}
- TSB (Form): ${taperAnalysis.currentTSB}
- Training Phase: ${phaseInfo?.phaseName || 'Unknown'}

TAPER ANALYSIS:
- Target Race Day TSB: ${taperAnalysis.targetTSB}
- Recommended: ${taperAnalysis.recommended.taperType} (${taperAnalysis.recommended.taperDescription})
- Taper Length: ${taperAnalysis.recommended.taperLengthDays} days
- Start Date: ${taperAnalysis.recommended.taperStartDate}
- Days Until Taper: ${taperAnalysis.recommended.daysUntilTaperStart}
- Projected Race Day CTL: ${taperAnalysis.recommended.raceDayCTL}
- Projected Race Day TSB: ${taperAnalysis.recommended.raceDayTSB}
- Expected CTL Loss: ${taperAnalysis.recommended.ctlLoss}

Provide a personalized taper recommendation in ${getPromptLanguage()}.

Return JSON:
{
  "summary": "One sentence summary of taper plan",
  "weekByWeekPlan": ["Week 1: ...", "Week 2: ...", "Final days: ..."],
  "keyWorkouts": ["Last hard workout description", "Opener workout description"],
  "warnings": ["Any concerns or adjustments needed"],
  "confidenceLevel": "high|medium|low",
  "expectedPerformance": "Brief note on expected race day form"
}`;

  try {
    const response = callGeminiAPIText(prompt);
    if (!response) {
      return generateFallbackTaperRecommendation(taperAnalysis, goal);
    }

    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return generateFallbackTaperRecommendation(taperAnalysis, goal);
    }

    const parsed = JSON.parse(jsonMatch[0]);
    return {
      success: true,
      aiEnhanced: true,
      ...parsed
    };
  } catch (e) {
    Logger.log('AI taper recommendation failed: ' + e.toString());
    return generateFallbackTaperRecommendation(taperAnalysis, goal);
  }
}

/**
 * Fallback taper recommendation when AI unavailable
 */
function generateFallbackTaperRecommendation(taperAnalysis, goal) {
  const rec = taperAnalysis.recommended;

  const weekByWeekPlan = [];

  if (rec.taperLengthDays >= 14) {
    weekByWeekPlan.push('Week 1: Reduce volume to 70%, maintain some intensity');
    weekByWeekPlan.push('Week 2: Reduce to 50%, short sharp efforts only');
    weekByWeekPlan.push('Final days: Easy spinning, rest day before race');
  } else if (rec.taperLengthDays >= 7) {
    weekByWeekPlan.push('Days 1-4: Reduce volume to 60%, keep one intensity session');
    weekByWeekPlan.push('Days 5-7: Easy spinning, opener workout 2 days before');
  } else {
    weekByWeekPlan.push('Short taper: Reduce to 50% immediately');
    weekByWeekPlan.push('Final 2 days: Rest or very easy spinning');
  }

  return {
    success: true,
    aiEnhanced: false,
    summary: `Start ${rec.taperType.toLowerCase()} on ${rec.taperStartDate} to peak at TSB ${rec.raceDayTSB} on race day`,
    weekByWeekPlan: weekByWeekPlan,
    keyWorkouts: [
      'Last hard workout: 3-4 days before race (short threshold or VO2max)',
      'Opener: 1-2 days before (easy with 3-4 short hard efforts)'
    ],
    warnings: rec.ctlLoss > 5 ? ['CTL will drop ' + rec.ctlLoss + ' points - this is normal and expected'] : [],
    confidenceLevel: 'medium',
    expectedPerformance: `Race day TSB of ${rec.raceDayTSB} indicates good freshness while maintaining ${rec.raceDayCTL} CTL fitness`
  };
}

/**
 * Format taper summary for display
 */
function formatTaperSummary(taperAnalysis, goal) {
  const rec = taperAnalysis.recommended;

  let summary = '';

  if (taperAnalysis.alreadyInTaperWindow) {
    summary = `TAPER IN PROGRESS for ${goal.name || 'your race'}\n`;
  } else if (taperAnalysis.taperStartingSoon) {
    summary = `TAPER STARTS SOON for ${goal.name || 'your race'}\n`;
  } else {
    summary = `TAPER PLAN for ${goal.name || 'your race'}\n`;
  }

  summary += `Race: ${taperAnalysis.raceDate} (${taperAnalysis.daysToRace} days)\n`;
  summary += `Recommended: ${rec.taperType} - ${rec.taperLengthDays} days\n`;
  summary += `Start taper: ${rec.taperStartDate}`;

  if (rec.daysUntilTaperStart > 0) {
    summary += ` (in ${rec.daysUntilTaperStart} days)`;
  } else if (rec.daysUntilTaperStart === 0) {
    summary += ' (TODAY)';
  } else {
    summary += ' (started)';
  }

  summary += `\n\nProjected Race Day:\n`;
  summary += `- CTL: ${rec.raceDayCTL} (losing ${rec.ctlLoss})\n`;
  summary += `- TSB: ${rec.raceDayTSB} (target: ${taperAnalysis.targetTSB})\n`;

  return summary;
}

/**
 * Format taper recommendation for email
 */
function formatTaperEmailSection(taperRec) {
  if (!taperRec || !taperRec.available) return '';

  const t = getTranslations();
  const lang = USER_SETTINGS.LANGUAGE || 'en';
  const isNL = lang === 'nl';
  const analysis = taperRec.analysis;
  const ai = taperRec.aiRecommendation;
  const rec = analysis.recommended;

  let section = '\n';

  // Summary as conversational opening
  if (ai && ai.summary) {
    section += ai.summary + '\n\n';
  } else {
    section += isNL
      ? `Taper planning voor ${analysis.raceDate} (nog ${analysis.daysToRace} dagen).\n\n`
      : `Taper planning for ${analysis.raceDate} (${analysis.daysToRace} days out).\n\n`;
  }

  // Key info as inline text
  section += isNL ? `Start: ${rec.taperStartDate}` : `Start: ${rec.taperStartDate}`;
  if (rec.daysUntilTaperStart > 0) {
    section += isNL ? ` (over ${rec.daysUntilTaperStart} dagen)` : ` (in ${rec.daysUntilTaperStart} days)`;
  } else if (rec.daysUntilTaperStart === 0) {
    section += isNL ? ' (vandaag)' : ' (today)';
  }
  section += `. ${rec.taperType} (${rec.taperDescription}), ${rec.taperLengthDays} ${isNL ? 'dagen' : 'days'}.\n`;

  // Projected race day
  section += isNL
    ? `Projectie wedstrijddag: CTL ${analysis.currentCTL} naar ${rec.raceDayCTL}, TSB ${analysis.currentTSB} naar ${rec.raceDayTSB}.\n`
    : `Race day projection: CTL ${analysis.currentCTL} to ${rec.raceDayCTL}, TSB ${analysis.currentTSB} to ${rec.raceDayTSB}.\n`;

  // Week by week plan as compact list
  if (ai && ai.weekByWeekPlan && ai.weekByWeekPlan.length > 0) {
    section += '\n' + (isNL ? 'Plan: ' : 'Plan: ');
    section += ai.weekByWeekPlan.slice(0, 3).join(' | ') + '\n';
  }

  // Key workouts inline
  if (ai && ai.keyWorkouts && ai.keyWorkouts.length > 0) {
    section += isNL ? 'Key workouts: ' : 'Key workouts: ';
    section += ai.keyWorkouts.slice(0, 2).join(', ') + '\n';
  }

  // Warnings inline
  if (ai && ai.warnings && ai.warnings.length > 0) {
    section += '\n' + (isNL ? 'Let op: ' : 'Note: ');
    section += ai.warnings.slice(0, 2).join('. ') + '\n';
  }

  return section;
}
