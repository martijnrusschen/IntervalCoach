/**
 * IntervalCoach - Email Functions
 *
 * All email sending functions: daily workout, rest day, weekly summary, monthly report.
 */

// =========================================================
// DAILY WORKOUT EMAIL
// =========================================================

/**
 * Send smart summary email with workout details
 * @param {object} summary - Athlete summary
 * @param {object} phaseInfo - Training phase info
 * @param {object} workout - Generated workout
 * @param {object} wellness - Wellness data
 * @param {object} powerProfile - Power profile (null for runs)
 */
function sendSmartSummaryEmail(summary, phaseInfo, workout, wellness, powerProfile) {
  const t = getTranslations();

  // Generate AI-powered subject line
  const aiSubject = generateAIEmailSubject(phaseInfo, workout, wellness);
  const dateStr = Utilities.formatDate(new Date(), SYSTEM_SETTINGS.TIMEZONE, "MM/dd");
  const subject = `[IntervalCoach] ${aiSubject} (${dateStr})`;

  let body = `${t.greeting}\n\n`;

  // Generate personalized coaching note
  const coachNote = generatePersonalizedCoachingNote(summary, phaseInfo, workout, wellness, powerProfile);
  if (coachNote) {
    body += `===================================
${t.coach_note_title || "Coach's Note"}
===================================
${coachNote}

`;
  }

  // Phase & Goal Info
  body += `
===================================
${t.phase_title}: ${phaseInfo.phaseName}
(${t.weeks_to_goal}: ${phaseInfo.weeksOut} ${t.weeks_unit})
${t.focus}: ${phaseInfo.focus}
===================================
${t.goal_section}
${phaseInfo.goalDescription || USER_SETTINGS.GOAL_DESCRIPTION}

${t.status}:
CTL: ${summary.ctl_90.toFixed(1)} / ATL: ${summary.atl ? summary.atl.toFixed(1) : 'N/A'} / TSB: ${summary.tsb_current.toFixed(1)}
`;

  // Power Profile Section
  if (powerProfile && powerProfile.available) {
    const currentEftp = powerProfile.currentEftp || powerProfile.eFTP;
    const wpkg = powerProfile.weight ? (powerProfile.ftp / powerProfile.weight).toFixed(2) : 'N/A';

    body += `
-----------------------------------
${t.power_profile_title || 'Power Profile'}
-----------------------------------
${t.current_eftp || 'Current eFTP'}: ${currentEftp || 'N/A'}W`;

    if (powerProfile.allTimeEftp && currentEftp && powerProfile.allTimeEftp > currentEftp) {
      body += ` (${t.all_time || 'All-time'}: ${powerProfile.allTimeEftp}W)`;
    }

    body += `
W/kg: ${wpkg}
${t.peak_powers || 'Peak Powers'}: 5s=${powerProfile.peak5s}W | 1min=${powerProfile.peak1min}W | 5min=${powerProfile.peak5min}W | 20min=${powerProfile.peak20min}W
${powerProfile.strengths && powerProfile.strengths.length > 0 ? `${t.strengths || 'Strengths'}: ${powerProfile.strengths.join(', ')}` : ''}
${powerProfile.weaknesses && powerProfile.weaknesses.length > 0 ? `${t.focus_areas || 'Focus Areas'}: ${powerProfile.weaknesses.join(', ')}` : ''}
`;
  }

  // Wellness/Recovery Section
  if (wellness && wellness.available) {
    const w = wellness.today;
    body += `
-----------------------------------
${t.recovery_title}
-----------------------------------
${t.recovery_status}: ${wellness.recoveryStatus}
${t.sleep}: ${w.sleep ? w.sleep.toFixed(1) + 'h' : 'N/A'} (${wellness.sleepStatus})
${t.hrv}: ${w.hrv || 'N/A'} ms (avg: ${wellness.averages.hrv ? wellness.averages.hrv.toFixed(0) : 'N/A'} ms)
${t.resting_hr}: ${w.restingHR || 'N/A'} bpm
${w.recovery != null ? `Whoop Recovery: ${w.recovery}%` : ''}
`;
  }

  // Workout Impact Preview Section
  const impactPreview = generateWorkoutImpactSection(summary, phaseInfo, workout);
  if (impactPreview) {
    body += impactPreview;
  }

  body += `
-----------------------------------
${t.recommendation_title}
-----------------------------------
Workout: ${workout.type}

${t.why_title}
${workout.recommendationReason}

${t.strategy_title}
${workout.explanation}
`;

  // Workout description for runs
  if (workout.workoutDescription) {
    body += `
-----------------------------------
${t.workout_details || 'Workout Details'}
-----------------------------------
${workout.workoutDescription}
`;
  }

  body += `\n${t.footer}`;

  GmailApp.sendEmail(USER_SETTINGS.EMAIL_TO, subject, body, { name: "IntervalCoach", attachments: [workout.blob] });
  Logger.log("Email sent successfully.");
}

// =========================================================
// REST DAY EMAIL
// =========================================================

/**
 * Send rest day email when recovery is red or AI recommends rest
 * @param {object} wellness - Wellness summary
 * @param {object} phaseInfo - Training phase info
 * @param {object} aiAssessment - Optional AI rest day assessment with reasoning
 */
function sendRestDayEmail(wellness, phaseInfo, aiAssessment) {
  const t = getTranslations();

  // Indicate if this is an AI-recommended rest day
  const isAIRecommended = aiAssessment && aiAssessment.isRestDay;
  const subjectSuffix = isAIRecommended ? " (AI Recommended)" : "";
  const subject = t.rest_day_subject + subjectSuffix + " (" + Utilities.formatDate(new Date(), SYSTEM_SETTINGS.TIMEZONE, "MM/dd") + ")";

  // Generate AI advice (fallback if no assessment provided)
  const aiAdvice = isAIRecommended ? null : generateRestDayAdvice(wellness);

  let body = `${t.rest_day_greeting}\n\n`;

  // Phase info
  body += `===================================
${t.phase_title}: ${phaseInfo.phaseName}
(${t.weeks_to_goal}: ${phaseInfo.weeksOut} ${t.weeks_unit})
===================================\n`;

  // Recovery section
  const w = wellness.today || {};
  body += `
-----------------------------------
${t.recovery_title}
-----------------------------------
${t.recovery_status}: ${wellness.recoveryStatus}
${t.sleep}: ${w.sleep ? w.sleep.toFixed(1) + 'h' : 'N/A'} (${wellness.sleepStatus})
${t.hrv}: ${w.hrv || 'N/A'} ms (avg: ${wellness.averages?.hrv ? wellness.averages.hrv.toFixed(0) : 'N/A'} ms)
${t.resting_hr}: ${w.restingHR || 'N/A'} bpm
${w.recovery != null ? `Whoop Recovery: ${w.recovery}%` : ''}
`;

  // Rest day recommendation
  body += `
===================================
${t.rest_day_title}
===================================
`;

  if (isAIRecommended) {
    // Use AI assessment reasoning
    body += `**Why rest today?**
${aiAssessment.reasoning}

**Confidence:** ${aiAssessment.confidence}

**Recommended alternatives:**
${aiAssessment.alternatives}`;
  } else if (aiAdvice) {
    body += aiAdvice;
  } else {
    body += `${t.rest_day_reason}

${t.rest_day_alternatives}:
• ${t.rest_day_walk}
• ${t.rest_day_strength}

${t.rest_day_note}`;
  }

  body += `\n\n${t.rest_day_footer}`;

  GmailApp.sendEmail(USER_SETTINGS.EMAIL_TO, subject, body, { name: "IntervalCoach" });
  Logger.log("Rest day email sent successfully" + (isAIRecommended ? " (AI recommended)" : "") + ".");
}

// =========================================================
// WEEKLY SUMMARY EMAIL
// =========================================================

/**
 * Send weekly training summary email - simplified structure
 * Set up a weekly trigger (e.g., Sunday evening) to call this function
 */
function sendWeeklySummaryEmail() {
  requireValidConfig();

  const t = getTranslations();
  const today = new Date();

  // ===== FETCH ALL DATA =====
  const weekData = fetchWeeklyActivities(7);
  const prevWeekData = fetchWeeklyActivities(14, 7);

  const fitnessMetrics = fetchFitnessMetrics();
  const prevWeekDate = new Date();
  prevWeekDate.setDate(prevWeekDate.getDate() - 7);
  const prevFitnessMetrics = fetchFitnessMetrics(prevWeekDate);

  const wellnessRecords = fetchWellnessData(7);
  const wellnessSummary = createWellnessSummary(wellnessRecords);
  const prevWellnessRecords = fetchWellnessData(14, 7);
  const prevWellnessSummary = createWellnessSummary(prevWellnessRecords);

  const powerProfile = fetchPowerCurve();

  const goals = fetchUpcomingGoals();
  const phaseInfo = goals?.available && goals?.primaryGoal
    ? calculateTrainingPhase(goals.primaryGoal.date)
    : calculateTrainingPhase(USER_SETTINGS.TARGET_DATE);

  const loadAdvice = calculateTrainingLoadAdvice(fitnessMetrics, phaseInfo, goals, wellnessSummary);
  const upcoming = fetchUpcomingPlaceholders(7);

  // ===== GENERATE WEEKLY PLAN =====
  const recentTypes = getRecentWorkoutTypes(7);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const planContext = buildWeeklyPlanContext(
    tomorrow, phaseInfo, fitnessMetrics, powerProfile, wellnessSummary,
    goals, weekData, recentTypes, upcoming, loadAdvice, today
  );

  Logger.log("Generating weekly training plan...");
  const weeklyPlan = generateAIWeeklyPlan(planContext);

  // ===== GENERATE AI COACH'S BRIEF =====
  const aiInsight = generateWeeklyInsight(
    weekData, prevWeekData, fitnessMetrics, prevFitnessMetrics,
    wellnessSummary, prevWellnessSummary, fitnessMetrics.eftp,
    prevFitnessMetrics.eftp, phaseInfo, goals, loadAdvice, upcoming
  );

  // ===== BUILD EMAIL =====
  const subject = t.weekly_subject + " (" + Utilities.formatDate(today, SYSTEM_SETTINGS.TIMEZONE, "MM/dd") + ")";

  let body = `${t.weekly_greeting}\n\n`;

  // --- Section 1: Coach's Brief ---
  if (aiInsight) {
    body += `===================================
${t.coach_note_title || "Coach's Brief"}
===================================
${aiInsight}

`;
  }

  // --- Section 2: Week in Cijfers (compact with diffs) ---
  body += buildWeekInCijfersSection(
    t, weekData, prevWeekData, fitnessMetrics, prevFitnessMetrics,
    wellnessSummary, prevWellnessSummary
  );

  // --- Section 3: Komende Week (compact day-by-day) ---
  if (weeklyPlan) {
    const calendarResults = createWeeklyPlanEvents(weeklyPlan);
    body += buildKomendeWeekSection(t, weeklyPlan, calendarResults);
  }

  // --- Footer ---
  body += `\n${t.weekly_footer}`;

  GmailApp.sendEmail(USER_SETTINGS.EMAIL_TO, subject, body, { name: "IntervalCoach" });
  Logger.log("Weekly summary email sent successfully.");
}

/**
 * Build context object for AI weekly plan generation
 */
function buildWeeklyPlanContext(tomorrow, phaseInfo, fitnessMetrics, powerProfile, wellnessSummary, goals, weekData, recentTypes, upcoming, loadAdvice, today) {
  const planContext = {
    startDate: formatDateISO(tomorrow),
    phase: phaseInfo.phaseName,
    weeksOut: phaseInfo.weeksOut,
    phaseFocus: phaseInfo.focus,
    phaseReasoning: phaseInfo.reasoning,
    ctl: fitnessMetrics.ctl,
    atl: fitnessMetrics.atl,
    tsb: fitnessMetrics.tsb,
    eftp: powerProfile && powerProfile.available ? powerProfile.currentEftp : null,
    ctlTrend: fitnessMetrics.rampRate > 0.5 ? 'increasing' : fitnessMetrics.rampRate < -0.5 ? 'decreasing' : 'stable',
    recoveryStatus: wellnessSummary.available ? wellnessSummary.recoveryStatus : 'Unknown',
    avgRecovery: wellnessSummary.available ? wellnessSummary.averages?.recovery : null,
    avgSleep: wellnessSummary.available ? wellnessSummary.averages?.sleep : null,
    goals: goals,
    lastWeek: {
      totalTss: weekData.totalTss,
      activities: weekData.totalActivities,
      rideTypes: recentTypes.rides,
      runTypes: recentTypes.runs,
      highIntensityDays: recentTypes.all.filter(function(t) {
        const catalog = Object.assign({}, WORKOUT_TYPES.ride, WORKOUT_TYPES.run);
        return catalog[t]?.intensity >= 4;
      }).length
    },
    scheduledDays: upcoming.filter(function(d) { return d.activityType; }),
    tssTarget: loadAdvice.tssRange,
    dailyTss: { min: loadAdvice.dailyTSSMin, max: loadAdvice.dailyTSSMax },
    twoWeekHistory: getTwoWeekWorkoutHistory()
  };

  // Get upcoming events (races)
  const upcomingEvents = [];
  for (let i = 0; i < 7; i++) {
    const eventCheck = hasEventInDays(i);
    if (eventCheck.hasEvent) {
      const eventDate = new Date();
      eventDate.setDate(eventDate.getDate() + i);
      upcomingEvents.push({
        date: formatDateISO(eventDate),
        dayName: Utilities.formatDate(eventDate, SYSTEM_SETTINGS.TIMEZONE, "EEEE"),
        eventCategory: eventCheck.category
      });
    }
  }
  planContext.upcomingEvents = upcomingEvents;

  // Get existing scheduled workouts for next 7 days
  const existingWorkouts = [];
  for (let i = 1; i <= 7; i++) {
    const checkDate = new Date(today);
    checkDate.setDate(today.getDate() + i);
    const dateStr = formatDateISO(checkDate);
    const dayName = Utilities.formatDate(checkDate, SYSTEM_SETTINGS.TIMEZONE, "EEEE");

    const eventsResult = fetchIcuApi("/athlete/0/events?oldest=" + dateStr + "&newest=" + dateStr);
    if (eventsResult.success && eventsResult.data?.length > 0) {
      const workout = eventsResult.data.find(function(e) { return e.category === 'WORKOUT'; });
      if (workout) {
        const isSimplePlaceholder = /^(Ride|Run)( - \d+min)?$/.test(workout.name || '');
        const isWeeklyPlan = workout.description?.includes('[Weekly Plan]');
        if (!isSimplePlaceholder && !isWeeklyPlan) {
          existingWorkouts.push({
            date: dateStr,
            dayName: dayName,
            name: workout.name,
            duration: workout.moving_time ? Math.round(workout.moving_time / 60) : null,
            type: workout.type || (workout.name?.toLowerCase().includes('run') ? 'Run' : 'Ride')
          });
        }
      }
    }
  }
  planContext.existingWorkouts = existingWorkouts;

  return planContext;
}

/**
 * Build compact "Week in Cijfers" section with diffs vs previous week
 */
function buildWeekInCijfersSection(t, weekData, prevWeekData, fitnessMetrics, prevFitnessMetrics, wellnessSummary, prevWellnessSummary) {
  // Calculate diffs
  const sessionsDiff = weekData.totalActivities - prevWeekData.totalActivities;
  const timeDiff = weekData.totalTime - prevWeekData.totalTime;
  const tssDiff = weekData.totalTss - prevWeekData.totalTss;

  const ctlDiff = fitnessMetrics.ctl - (prevFitnessMetrics.ctl || 0);
  const atlDiff = fitnessMetrics.atl - (prevFitnessMetrics.atl || 0);
  const tsbDiff = fitnessMetrics.tsb - (prevFitnessMetrics.tsb || 0);
  const eftpDiff = (fitnessMetrics.eftp && prevFitnessMetrics.eftp)
    ? fitnessMetrics.eftp - prevFitnessMetrics.eftp : null;

  const prevAvg = prevWellnessSummary?.available ? prevWellnessSummary.averages : {};
  const currAvg = wellnessSummary?.available ? wellnessSummary.averages : {};
  const sleepDiff = (currAvg.sleep && prevAvg.sleep) ? currAvg.sleep - prevAvg.sleep : null;
  const hrvDiff = (currAvg.hrv && prevAvg.hrv) ? currAvg.hrv - prevAvg.hrv : null;
  const recoveryDiff = (currAvg.recovery && prevAvg.recovery) ? currAvg.recovery - prevAvg.recovery : null;

  // Format helpers
  const formatDiff = function(val, decimals) {
    if (val == null) return '';
    const sign = val >= 0 ? '+' : '';
    return ' (' + sign + val.toFixed(decimals || 0) + ')';
  };

  const formatTimeDiff = function(secs) {
    if (secs == null) return '';
    const sign = secs >= 0 ? '+' : '-';
    const absSecs = Math.abs(secs);
    const h = Math.floor(absSecs / 3600);
    const m = Math.floor((absSecs % 3600) / 60);
    if (h > 0) return ' (' + sign + h + 'h ' + m + 'm)';
    return ' (' + sign + m + 'm)';
  };

  let section = `-----------------------------------
${t.weekly_overview || 'Week in Cijfers'} (vs ${t.previous_week || 'vorige week'})
-----------------------------------
`;

  // Line 1: Training volume
  section += `${t.sessions || 'Sessies'}: ${weekData.totalActivities}${formatDiff(sessionsDiff)}  |  `;
  section += `${t.time || 'Tijd'}: ${formatDuration(weekData.totalTime)}${formatTimeDiff(timeDiff)}  |  `;
  section += `TSS: ${weekData.totalTss.toFixed(0)}${formatDiff(tssDiff)}\n`;

  // Line 2: Fitness metrics
  section += `${t.fitness || 'Fitness'}: CTL ${fitnessMetrics.ctl.toFixed(1)}${formatDiff(ctlDiff, 1)}  |  `;
  section += `ATL ${fitnessMetrics.atl.toFixed(1)}${formatDiff(atlDiff, 1)}  |  `;
  section += `TSB ${fitnessMetrics.tsb.toFixed(1)}${formatDiff(tsbDiff, 1)}`;

  // eFTP if available
  if (fitnessMetrics.eftp) {
    section += `\neFTP: ${fitnessMetrics.eftp}W${eftpDiff != null ? formatDiff(eftpDiff) + 'W' : ''}\n`;
  } else {
    section += '\n';
  }

  // Line 3: Recovery/wellness
  if (wellnessSummary?.available) {
    section += `\n${t.recovery || 'Herstel'}: `;
    section += `${t.sleep || 'Slaap'} ${currAvg.sleep ? currAvg.sleep.toFixed(1) + 'h' : 'N/A'}${sleepDiff != null ? formatDiff(sleepDiff, 1) : ''}  |  `;
    section += `HRV ${currAvg.hrv ? currAvg.hrv.toFixed(0) + 'ms' : 'N/A'}${hrvDiff != null ? formatDiff(hrvDiff) : ''}  |  `;
    section += `${t.recovery_score || 'Recovery'} ${currAvg.recovery ? currAvg.recovery.toFixed(0) + '%' : 'N/A'}${recoveryDiff != null ? formatDiff(recoveryDiff) : ''}\n`;
  }

  section += '\n';
  return section;
}

/**
 * Build compact "Komende Week" section with day-by-day plan
 */
function buildKomendeWeekSection(t, weeklyPlan, calendarResults) {
  let section = `-----------------------------------
${t.weekly_plan_title || 'Komende Week'}
-----------------------------------
`;

  // Day by day - compact format: "Ma  Endurance · 60min · TSS ~45"
  for (const day of weeklyPlan.days) {
    const dayAbbrev = day.dayName.substring(0, 2);

    // Treat as rest if activity is Rest/Rust OR if duration/TSS are 0 or missing
    const isRest = day.activity === 'Rest' || day.activity === 'Rust' ||
                   (!day.duration && !day.estimatedTSS) ||
                   (day.duration === 0 && day.estimatedTSS === 0);

    if (isRest) {
      section += `${dayAbbrev}  ${t.rest || 'Rest'}\n`;
    } else {
      const workoutName = day.workoutType || day.activity;
      const isKeyWorkout = weeklyPlan.keyWorkouts?.some(function(kw) {
        return kw.toLowerCase().includes(day.dayName.toLowerCase());
      });
      const marker = isKeyWorkout ? ' ⭐' : '';
      section += `${dayAbbrev}  ${workoutName} · ${day.duration}min · TSS ~${day.estimatedTSS}${marker}\n`;
    }
  }

  // Week summary line
  const dist = weeklyPlan.intensityDistribution || {};
  section += `\n${t.week_target || 'Weekdoel'}: ${weeklyPlan.totalPlannedTSS} TSS | `;
  section += `Mix: ${dist.high || 0} hard, ${dist.medium || 0} medium, ${dist.low || 0} easy, ${dist.rest || 0} ${t.rest || 'rust'}\n`;

  // Key workout highlight
  if (weeklyPlan.keyWorkouts && weeklyPlan.keyWorkouts.length > 0) {
    section += `\n${t.key_workout || 'Key workout'}: ${weeklyPlan.keyWorkouts[0]}\n`;
  }

  // Calendar sync info
  if (calendarResults && calendarResults.created > 0) {
    section += `\n${calendarResults.created} workout${calendarResults.created > 1 ? 's' : ''} ${t.added_to_calendar || 'added to Intervals.icu calendar'}.\n`;
  }

  return section;
}

// =========================================================
// MONTHLY PROGRESS EMAIL
// =========================================================

/**
 * Fetch monthly progress data for a specific calendar month
 * @param {number} monthOffset - 0 = previous month, 1 = month before that
 * @returns {object} Monthly progress data
 */
function fetchMonthlyProgressData(monthOffset = 0) {
  const today = new Date();
  const targetMonth = new Date(today.getFullYear(), today.getMonth() - 1 - monthOffset, 1);
  const monthStart = new Date(targetMonth.getFullYear(), targetMonth.getMonth(), 1);
  const monthEnd = new Date(targetMonth.getFullYear(), targetMonth.getMonth() + 1, 0);

  const weeklyData = [];
  const numWeeks = Math.ceil((monthEnd.getDate() - monthStart.getDate() + 1) / 7);

  for (let w = 0; w < numWeeks; w++) {
    const weekStart = new Date(monthStart);
    weekStart.setDate(monthStart.getDate() + (w * 7));
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);

    if (weekEnd > monthEnd) {
      weekEnd.setTime(monthEnd.getTime());
    }

    const daysInPeriod = Math.ceil((weekEnd - weekStart) / (1000 * 60 * 60 * 24)) + 1;
    const daysOffset = Math.ceil((today - weekEnd) / (1000 * 60 * 60 * 24));
    const activities = fetchWeeklyActivities(daysInPeriod, daysOffset);
    const fitnessMetrics = fetchFitnessMetrics(weekEnd);

    weeklyData.push({
      weekNumber: w + 1,
      weekEnd: formatDateISO(weekEnd),
      weekStart: formatDateISO(weekStart),
      activities: activities.totalActivities,
      rides: activities.rides,
      runs: activities.runs,
      totalTime: activities.totalTime,
      totalTss: activities.totalTss,
      totalDistance: activities.totalDistance,
      ctl: fitnessMetrics.ctl,
      atl: fitnessMetrics.atl,
      tsb: fitnessMetrics.tsb,
      eftp: fitnessMetrics.eftp
    });
  }

  // Aggregates
  const totalActivities = weeklyData.reduce((sum, w) => sum + w.activities, 0);
  const totalTss = weeklyData.reduce((sum, w) => sum + w.totalTss, 0);
  const totalTime = weeklyData.reduce((sum, w) => sum + w.totalTime, 0);
  const weeksWithTraining = weeklyData.filter(w => w.activities > 0).length;

  const ctlStart = weeklyData[0].ctl;
  const ctlEnd = weeklyData[weeklyData.length - 1].ctl;
  const ctlChange = ctlEnd - ctlStart;

  const eftpValues = weeklyData.map(w => w.eftp).filter(e => e != null);
  const eftpStart = eftpValues.length > 0 ? eftpValues[0] : null;
  const eftpEnd = eftpValues.length > 0 ? eftpValues[eftpValues.length - 1] : null;
  const eftpChange = (eftpStart && eftpEnd) ? eftpEnd - eftpStart : null;

  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
                      'July', 'August', 'September', 'October', 'November', 'December'];

  return {
    weeks: numWeeks,
    monthName: monthNames[monthStart.getMonth()],
    monthYear: monthStart.getFullYear(),
    periodStart: formatDateISO(monthStart),
    periodEnd: formatDateISO(monthEnd),
    weeklyData: weeklyData,
    totals: {
      activities: totalActivities,
      tss: totalTss,
      time: totalTime,
      avgWeeklyTss: totalTss / numWeeks,
      avgWeeklyTime: totalTime / numWeeks
    },
    fitness: {
      ctlStart: ctlStart,
      ctlEnd: ctlEnd,
      ctlChange: ctlChange,
      eftpStart: eftpStart,
      eftpEnd: eftpEnd,
      eftpChange: eftpChange
    },
    consistency: {
      weeksWithTraining: weeksWithTraining,
      consistencyPercent: Math.round((weeksWithTraining / numWeeks) * 100)
    }
  };
}

/**
 * Send monthly progress report email
 * Set up a monthly trigger (e.g., 1st of each month) to call this function
 */
function sendMonthlyProgressEmail() {
  requireValidConfig();

  const t = getTranslations();

  const currentMonth = fetchMonthlyProgressData(0);
  const previousMonth = fetchMonthlyProgressData(1);

  const goals = fetchUpcomingGoals();
  const phaseInfo = goals?.available && goals?.primaryGoal
    ? calculateTrainingPhase(goals.primaryGoal.date)
    : calculateTrainingPhase(USER_SETTINGS.TARGET_DATE);

  const aiInsight = generateMonthlyInsight(currentMonth, previousMonth, phaseInfo, goals);

  const subject = t.monthly_subject + " (" + currentMonth.monthName + " " + currentMonth.monthYear + ")";

  let body = `${t.monthly_greeting}\n\n`;

  if (aiInsight) {
    body += `${aiInsight}\n\n`;
  }

  body += `===================================
${currentMonth.monthName} ${currentMonth.monthYear}: ${currentMonth.periodStart} - ${currentMonth.periodEnd}
===================================\n`;

  // Month-over-Month Comparison
  const activityChange = currentMonth.totals.activities - previousMonth.totals.activities;
  const tssChange = currentMonth.totals.tss - previousMonth.totals.tss;
  const timeChange = currentMonth.totals.time - previousMonth.totals.time;
  const ctlChange = currentMonth.fitness.ctlEnd - previousMonth.fitness.ctlEnd;

  body += `
-----------------------------------
${t.monthly_comparison || 'Month-over-Month'}
-----------------------------------
${t.monthly_total_activities}: ${currentMonth.totals.activities} ${formatChange(activityChange, false)}
${t.monthly_total_tss || 'Total TSS'}: ${currentMonth.totals.tss.toFixed(0)} ${formatChange(tssChange, false)}
${t.monthly_total_hours || 'Total Time'}: ${formatDuration(currentMonth.totals.time)} ${formatChange(Math.round(timeChange / 60), false, 'min')}
CTL: ${currentMonth.fitness.ctlEnd.toFixed(1)} ${formatChange(ctlChange, true)}
`;

  if (currentMonth.fitness.eftpEnd && previousMonth.fitness.eftpEnd) {
    const eftpChange = currentMonth.fitness.eftpEnd - previousMonth.fitness.eftpEnd;
    body += `eFTP: ${currentMonth.fitness.eftpEnd}W ${formatChange(eftpChange, false, 'W')}
`;
  }

  // Fitness Trend
  body += `
-----------------------------------
${t.monthly_fitness_trend}
-----------------------------------
CTL: ${currentMonth.fitness.ctlStart.toFixed(1)} → ${currentMonth.fitness.ctlEnd.toFixed(1)}
`;

  // Weekly CTL breakdown
  body += `\n  Week:  `;
  currentMonth.weeklyData.forEach((w, i) => {
    body += `${i + 1}`.padStart(5);
  });
  body += `\n  CTL:   `;
  currentMonth.weeklyData.forEach(w => {
    body += `${w.ctl.toFixed(0)}`.padStart(5);
  });
  body += `\n`;

  // eFTP Trend
  if (currentMonth.fitness.eftpStart && currentMonth.fitness.eftpEnd) {
    body += `
-----------------------------------
${t.monthly_eftp_trend}
-----------------------------------
eFTP: ${currentMonth.fitness.eftpStart}W → ${currentMonth.fitness.eftpEnd}W
`;

    body += `\n  Week:  `;
    currentMonth.weeklyData.forEach((w, i) => {
      body += `${i + 1}`.padStart(5);
    });
    body += `\n  eFTP:  `;
    currentMonth.weeklyData.forEach(w => {
      body += `${w.eftp || '-'}`.toString().padStart(5);
    });
    body += `\n`;
  }

  // Volume
  body += `
-----------------------------------
${t.monthly_volume}
-----------------------------------
${t.monthly_avg_weekly_tss}: ${currentMonth.totals.avgWeeklyTss.toFixed(0)}
${t.monthly_avg_weekly_hours}: ${formatDuration(currentMonth.totals.avgWeeklyTime)}
`;

  body += `\n  Week:  `;
  currentMonth.weeklyData.forEach((w, i) => {
    body += `${i + 1}`.padStart(5);
  });
  body += `\n  TSS:   `;
  currentMonth.weeklyData.forEach(w => {
    body += `${w.totalTss.toFixed(0)}`.padStart(5);
  });
  body += `\n`;

  // Consistency
  body += `
-----------------------------------
${t.monthly_consistency}
-----------------------------------
${t.monthly_weeks_trained}: ${currentMonth.consistency.weeksWithTraining}/${currentMonth.weeks} (${currentMonth.consistency.consistencyPercent}%)
`;

  // Goal
  if (goals?.available && goals?.primaryGoal) {
    body += `
-----------------------------------
${t.phase_title}: ${phaseInfo.phaseName}
-----------------------------------
${t.goal_section}: ${goals.primaryGoal.name} (${goals.primaryGoal.date})
${t.weeks_to_goal}: ${phaseInfo.weeksOut} ${t.weeks_unit}
`;
  }

  body += `\n${t.monthly_footer}`;

  GmailApp.sendEmail(USER_SETTINGS.EMAIL_TO, subject, body, { name: "IntervalCoach" });
  Logger.log("Monthly progress report sent successfully.");
}

// =========================================================
// POST-WORKOUT ANALYSIS EMAIL
// =========================================================

/**
 * Send post-workout AI analysis email
 * @param {object} activity - Completed activity
 * @param {object} analysis - AI analysis results
 * @param {object} wellness - Current wellness data
 * @param {object} fitness - Current fitness metrics
 * @param {object} powerProfile - Power profile (null for runs)
 * @param {object} runningData - Running data (null for cycling)
 */
function sendPostWorkoutAnalysisEmail(activity, analysis, wellness, fitness, powerProfile, runningData) {
  const t = getTranslations();
  const isRun = activity.type === "Run";

  // Generate subject line
  const dateStr = Utilities.formatDate(new Date(activity.start_date_local), SYSTEM_SETTINGS.TIMEZONE, "MM/dd HH:mm");
  const effectivenessEmoji = analysis.effectiveness >= 8 ? "🎯" : analysis.effectiveness >= 6 ? "✓" : "⚠";
  const subject = `[IntervalCoach] ${effectivenessEmoji} Workout Analysis: ${activity.name} (${dateStr})`;

  let body = `${t.greeting}\n\n`;

  // Congratulatory message
  if (analysis.congratsMessage) {
    body += `===================================
${t.workout_complete || "Workout Complete"}
===================================
${analysis.congratsMessage}

`;
  }

  // Workout Summary
  body += `===================================
${t.workout_summary || "Workout Summary"}
===================================
${t.workout_type || "Type"}: ${activity.type}
${t.duration || "Duration"}: ${Math.round(activity.moving_time / 60)} minutes
TSS/Load: ${activity.icu_training_load}
${t.intensity || "Intensity Factor"}: ${activity.icu_intensity ? activity.icu_intensity.toFixed(2) : 'N/A'}
`;

  // RPE/Feel if available
  if (activity.icu_rpe || activity.feel) {
    body += `\n${t.subjective_feedback || "Your Feedback"}:
`;
    if (activity.icu_rpe) {
      body += `  RPE: ${activity.icu_rpe}/10`;
    }
    if (activity.feel) {
      body += `${activity.icu_rpe ? ' | ' : '  '}Feel: ${getFeelLabel(activity.feel)}`;
    }
    body += `\n`;
  }

  // AI Analysis
  body += `
===================================
${t.ai_analysis || "AI Analysis"}
===================================
${t.effectiveness || "Effectiveness"}: ${analysis.effectiveness}/10
${analysis.effectivenessReason}

${t.difficulty || "Difficulty"}: ${analysis.difficultyMatch.replace(/_/g, ' ')}
${analysis.difficultyReason}

${t.workout_stimulus || "Workout Stimulus"}: ${analysis.workoutStimulus.toUpperCase()} (${analysis.stimulusQuality})
`;

  // Key Insight
  body += `
-----------------------------------
${t.key_insight || "Key Insight"}
-----------------------------------
${analysis.keyInsight}
`;

  // Performance Highlights
  if (analysis.performanceHighlights && analysis.performanceHighlights.length > 0) {
    body += `
-----------------------------------
${t.highlights || "Highlights"}
-----------------------------------
`;
    analysis.performanceHighlights.forEach(highlight => {
      body += `• ${highlight}\n`;
    });
  }

  // Recovery Impact
  if (analysis.recoveryImpact) {
    body += `
-----------------------------------
${t.recovery_impact || "Recovery Impact"}
-----------------------------------
${t.severity || "Severity"}: ${analysis.recoveryImpact.severity}
${t.estimated_recovery || "Est. Recovery"}: ${analysis.recoveryImpact.estimatedRecoveryHours} hours
${t.next_workout || "Next Workout"}: ${analysis.recoveryImpact.nextWorkoutAdjustment.replace(/_/g, ' ')}
`;
  }

  // Training Adjustments
  if (analysis.trainingAdjustments && analysis.trainingAdjustments.needed) {
    body += `
-----------------------------------
${t.training_adjustments || "Training Adjustments"}
-----------------------------------
`;
    if (analysis.trainingAdjustments.ftpCalibration && analysis.trainingAdjustments.ftpCalibration !== 'none') {
      body += `FTP Calibration: ${analysis.trainingAdjustments.ftpCalibration.replace(/_/g, ' ')}\n`;
    }
    if (analysis.trainingAdjustments.futureIntensity) {
      body += `Future Intensity: ${analysis.trainingAdjustments.futureIntensity.replace(/_/g, ' ')}\n`;
    }
    body += `\n${analysis.trainingAdjustments.reasoning}\n`;
  }

  // Current Fitness State
  body += `
-----------------------------------
${t.current_fitness || "Current Fitness"}
-----------------------------------
CTL: ${fitness.ctl ? fitness.ctl.toFixed(1) : 'N/A'}
ATL: ${fitness.atl ? fitness.atl.toFixed(1) : 'N/A'}
TSB: ${fitness.tsb ? fitness.tsb.toFixed(1) : 'N/A'}
${t.ramp_rate || "Ramp Rate"}: ${fitness.rampRate || 'N/A'} TSS/week
`;

  // Power/Running Profile
  if (!isRun && powerProfile && powerProfile.available) {
    const currentEftp = powerProfile.currentEftp || powerProfile.eFTP;
    body += `
-----------------------------------
${t.power_profile_title || "Power Profile"}
-----------------------------------
eFTP: ${currentEftp}W
Peak Powers: 5s=${powerProfile.peak5s}W | 1min=${powerProfile.peak1min}W | 5min=${powerProfile.peak5min}W
`;
  } else if (isRun && runningData && runningData.available) {
    body += `
-----------------------------------
${t.running_profile || "Running Profile"}
-----------------------------------
Critical Speed: ${runningData.criticalSpeed || 'N/A'}/km
D': ${runningData.dPrime ? runningData.dPrime.toFixed(0) + 'm' : 'N/A'}
Threshold Pace: ${runningData.thresholdPace || 'N/A'}/km
`;
  }

  // Wellness
  if (wellness && wellness.available) {
    body += `
-----------------------------------
${t.recovery_title}
-----------------------------------
${t.recovery_status}: ${wellness.recoveryStatus}
${t.sleep}: ${wellness.today.sleep ? wellness.today.sleep.toFixed(1) + 'h' : 'N/A'}
${t.hrv}: ${wellness.today.hrv || 'N/A'} ms
${t.resting_hr}: ${wellness.today.restingHR || 'N/A'} bpm
`;
  }

  body += `
-----------------------------------
${t.keep_training || "Keep up the great work!"}
- IntervalCoach
`;

  GmailApp.sendEmail(USER_SETTINGS.EMAIL_TO, subject, body, { name: "IntervalCoach" });
  Logger.log("Post-workout analysis email sent successfully.");
}

// =========================================================
// WORKOUT IMPACT PREVIEW SECTION
// =========================================================

/**
 * Generate the workout impact preview section for the daily email
 * Shows how today's workout affects CTL/ATL/TSB over the next 2 weeks
 * @param {object} summary - Athlete summary with CTL/ATL/TSB
 * @param {object} phaseInfo - Training phase info
 * @param {object} workout - Generated workout with type and duration
 * @returns {string} Formatted email section or empty string if unavailable
 */
function generateWorkoutImpactSection(summary, phaseInfo, workout) {
  const t = getTranslations();

  try {
    // Estimate TSS for today's workout based on type and duration
    const estimatedTSS = estimateWorkoutTSS(workout);

    if (!estimatedTSS || estimatedTSS <= 0) {
      Logger.log("Impact preview skipped: Could not estimate TSS");
      return "";
    }

    // Get current fitness metrics
    const fitnessMetrics = {
      ctl: summary.ctl_90 || 0,
      atl: summary.atl || 0,
      tsb: summary.tsb_current || 0
    };

    // Generate impact preview data
    const impactData = generateWorkoutImpactPreview(estimatedTSS, fitnessMetrics, 14);

    if (!impactData || !impactData.withWorkout || impactData.withWorkout.length === 0) {
      Logger.log("Impact preview skipped: No projection data");
      return "";
    }

    // Fetch goals for context
    const goals = fetchUpcomingGoals();

    // Generate AI narrative
    const aiPreview = generateAIWorkoutImpactPreview(impactData, goals, phaseInfo);

    // Format the section
    let section = `
-----------------------------------
${t.impact_preview_title || "Workout Impact Preview"}
-----------------------------------
`;

    // AI Summary
    if (aiPreview && aiPreview.summary) {
      section += `${aiPreview.summary}\n\n`;
    }

    // Key metrics
    section += `Today's TSS: ~${estimatedTSS}
`;

    // Tomorrow's impact
    const tomorrow = impactData.withWorkout[1];
    section += `Tomorrow: CTL ${tomorrow.ctl} | TSB ${tomorrow.tsb}\n`;

    // 2-week outlook
    const endOfWeek2 = impactData.withWorkout[13];
    section += `In 2 weeks: CTL ${endOfWeek2.ctl} (+${impactData.impact.twoWeekCTLDelta.toFixed(1)})\n`;

    // Key insights
    if (aiPreview && aiPreview.keyInsights && aiPreview.keyInsights.length > 0) {
      section += "\n";
      for (var i = 0; i < aiPreview.keyInsights.length && i < 2; i++) {
        section += "• " + aiPreview.keyInsights[i] + "\n";
      }
    }

    // AI narrative
    if (aiPreview && aiPreview.narrative) {
      section += "\n" + aiPreview.narrative + "\n";
    }

    // Mini projection table (next 7 days)
    section += "\n7-Day Projection:\n";
    for (var d = 0; d < 7 && d < impactData.withWorkout.length; d++) {
      var day = impactData.withWorkout[d];
      var tssIndicator = day.tss > 0 ? ("TSS:" + day.tss) : "Rest";
      section += day.dayName + " " + day.date.substring(5) + ": " + tssIndicator + " -> TSB " + day.tsb + "\n";
    }

    Logger.log("Impact preview generated" + (aiPreview.aiEnhanced ? " (AI-enhanced)" : " (fallback)"));
    return section;

  } catch (e) {
    Logger.log("Error generating impact preview: " + e.toString());
    return "";
  }
}

/**
 * Estimate TSS for a workout based on type and duration
 * Uses typical intensity factors for different workout types
 * @param {object} workout - Workout object with type and duration info
 * @returns {number} Estimated TSS
 */
function estimateWorkoutTSS(workout) {
  if (!workout) return 0;

  // Try to extract duration from workout
  let durationMinutes = 60; // default

  // Check for explicit duration
  if (workout.duration) {
    durationMinutes = typeof workout.duration === 'object' ? workout.duration.max : workout.duration;
  } else if (workout.durationMinutes) {
    durationMinutes = workout.durationMinutes;
  }

  // Determine intensity factor based on workout type
  const workoutType = (workout.type || "").toLowerCase();

  // TSS per minute based on workout type
  // Zone 2/Endurance: ~0.5-0.6 TSS/min (IF ~0.65-0.75)
  // Tempo/SweetSpot: ~0.7-0.8 TSS/min (IF ~0.84-0.90)
  // Threshold/VO2max: ~0.9-1.1 TSS/min (IF ~0.95-1.05)
  let tssPerMinute = 0.65; // default moderate

  if (workoutType.indexOf("recovery") !== -1 || workoutType.indexOf("z1") !== -1) {
    tssPerMinute = 0.4;
  } else if (workoutType.indexOf("endurance") !== -1 || workoutType.indexOf("z2") !== -1 || workoutType.indexOf("base") !== -1) {
    tssPerMinute = 0.55;
  } else if (workoutType.indexOf("tempo") !== -1 || workoutType.indexOf("z3") !== -1) {
    tssPerMinute = 0.72;
  } else if (workoutType.indexOf("sweetspot") !== -1 || workoutType.indexOf("sweet_spot") !== -1 || workoutType.indexOf("ss") !== -1) {
    tssPerMinute = 0.80;
  } else if (workoutType.indexOf("threshold") !== -1 || workoutType.indexOf("z4") !== -1 || workoutType.indexOf("ftp") !== -1) {
    tssPerMinute = 0.92;
  } else if (workoutType.indexOf("vo2") !== -1 || workoutType.indexOf("z5") !== -1) {
    tssPerMinute = 1.0;
  } else if (workoutType.indexOf("anaerobic") !== -1 || workoutType.indexOf("z6") !== -1 || workoutType.indexOf("sprint") !== -1) {
    tssPerMinute = 1.1;
  }

  const estimatedTSS = Math.round(durationMinutes * tssPerMinute);

  Logger.log("Estimated TSS for " + workoutType + " (" + durationMinutes + "min): " + estimatedTSS);
  return estimatedTSS;
}
