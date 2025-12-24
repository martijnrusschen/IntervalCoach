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
  const t = TRANSLATIONS[USER_SETTINGS.LANGUAGE] || TRANSLATIONS.en;

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
  const t = TRANSLATIONS[USER_SETTINGS.LANGUAGE] || TRANSLATIONS.en;

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
 * Send weekly training summary email
 * Set up a weekly trigger (e.g., Sunday evening) to call this function
 */
function sendWeeklySummaryEmail() {
  requireValidConfig();

  const t = TRANSLATIONS[USER_SETTINGS.LANGUAGE] || TRANSLATIONS.en;

  // Fetch activities
  const weekData = fetchWeeklyActivities(7);
  const prevWeekData = fetchWeeklyActivities(14, 7);

  // Fetch fitness metrics
  const fitnessMetrics = fetchFitnessMetrics();
  const prevWeekDate = new Date();
  prevWeekDate.setDate(prevWeekDate.getDate() - 7);
  const prevFitnessMetrics = fetchFitnessMetrics(prevWeekDate);

  // Fetch wellness data
  const wellnessRecords = fetchWellnessData(7);
  const wellnessSummary = createWellnessSummary(wellnessRecords);
  const prevWellnessRecords = fetchWellnessData(14, 7);
  const prevWellnessSummary = createWellnessSummary(prevWellnessRecords);

  // Fetch power profile
  const powerProfile = fetchPowerCurve();

  // Fetch goals
  const goals = fetchUpcomingGoals();
  const phaseInfo = goals?.available && goals?.primaryGoal
    ? calculateTrainingPhase(goals.primaryGoal.date)
    : calculateTrainingPhase(USER_SETTINGS.TARGET_DATE);

  // Build email
  const today = new Date();
  const weekStart = new Date(today);
  weekStart.setDate(today.getDate() - 6);
  const dateRange = formatDateISO(weekStart) + " to " + formatDateISO(today);

  const subject = t.weekly_subject + " (" + Utilities.formatDate(today, SYSTEM_SETTINGS.TIMEZONE, "MM/dd") + ")";

  // Generate AI insight
  const aiInsight = generateWeeklyInsight(weekData, prevWeekData, fitnessMetrics, prevFitnessMetrics, wellnessSummary, prevWellnessSummary, fitnessMetrics.eftp, prevFitnessMetrics.eftp, phaseInfo, goals);

  let body = `${t.weekly_greeting}\n\n`;

  if (aiInsight) {
    body += `${aiInsight}\n\n`;
  }

  // Week Overview
  body += `===================================
${t.weekly_overview} (${dateRange})
===================================
${t.total_activities}: ${weekData.totalActivities}
  - ${t.rides}: ${weekData.rides}
  - ${t.runs}: ${weekData.runs}
${t.total_time}: ${formatDuration(weekData.totalTime)}
${t.total_tss}: ${weekData.totalTss.toFixed(0)}
${t.total_distance}: ${(weekData.totalDistance / 1000).toFixed(1)} km
`;

  // Comparison with previous week
  if (prevWeekData.totalActivities > 0) {
    const tssDiff = weekData.totalTss - prevWeekData.totalTss;
    const timeDiff = weekData.totalTime - prevWeekData.totalTime;
    const tssSign = tssDiff >= 0 ? "+" : "";

    body += `
-----------------------------------
${t.weekly_comparison}
-----------------------------------
TSS: ${tssSign}${tssDiff.toFixed(0)} (${prevWeekData.totalTss.toFixed(0)} → ${weekData.totalTss.toFixed(0)})
${t.total_time}: ${formatDuration(timeDiff, true)} (${formatDuration(prevWeekData.totalTime)} → ${formatDuration(weekData.totalTime)})
`;
  }

  // Fitness Progress
  const ctlChange = formatChange(fitnessMetrics.ctl, prevFitnessMetrics.ctl, 1);
  const atlChange = formatChange(fitnessMetrics.atl, prevFitnessMetrics.atl, 1);
  const tsbChange = formatChange(fitnessMetrics.tsb, prevFitnessMetrics.tsb, 1);

  body += `
-----------------------------------
${t.weekly_fitness}
-----------------------------------
CTL (Fitness): ${fitnessMetrics.ctl.toFixed(1)}${ctlChange}
ATL (Fatigue): ${fitnessMetrics.atl.toFixed(1)}${atlChange}
TSB (Form): ${fitnessMetrics.tsb.toFixed(1)}${tsbChange}
${t.ramp_rate}: ${fitnessMetrics.rampRate ? fitnessMetrics.rampRate.toFixed(2) : 'N/A'}`;

  // eFTP
  if (fitnessMetrics.eftp) {
    const eftpChange = formatChange(fitnessMetrics.eftp, prevFitnessMetrics.eftp, 0, 'W');
    body += `
eFTP: ${fitnessMetrics.eftp}W${eftpChange}`;
  } else if (powerProfile && powerProfile.available) {
    body += `
eFTP: ${powerProfile.currentEftp || powerProfile.ftp || 'N/A'}W`;
  }

  // Health & Recovery
  if (wellnessSummary.available) {
    const prevAvg = prevWellnessSummary.available ? prevWellnessSummary.averages : {};
    const sleepChange = formatChange(wellnessSummary.averages.sleep, prevAvg.sleep, 1, 'h');
    const hrvChange = formatChange(wellnessSummary.averages.hrv, prevAvg.hrv, 0);
    const rhrChange = formatChange(wellnessSummary.averages.restingHR, prevAvg.restingHR, 0);
    const recoveryChange = formatChange(wellnessSummary.averages.recovery, prevAvg.recovery, 0, '%');

    body += `

-----------------------------------
${t.weekly_health}
-----------------------------------
${t.avg_sleep}: ${wellnessSummary.averages.sleep ? wellnessSummary.averages.sleep.toFixed(1) + 'h' : 'N/A'}${sleepChange}
${t.avg_hrv}: ${wellnessSummary.averages.hrv ? wellnessSummary.averages.hrv.toFixed(0) + ' ms' : 'N/A'}${hrvChange}
${t.avg_rhr}: ${wellnessSummary.averages.restingHR ? wellnessSummary.averages.restingHR.toFixed(0) + ' bpm' : 'N/A'}${rhrChange}
${t.avg_recovery}: ${wellnessSummary.averages.recovery ? wellnessSummary.averages.recovery.toFixed(0) + '%' : 'N/A'}${recoveryChange}`;
  }

  // Training Load Advice (AI-enhanced with wellness data)
  const loadAdvice = calculateTrainingLoadAdvice(fitnessMetrics, phaseInfo, goals, wellnessSummary);
  body += `

-----------------------------------
${t.training_load_title}
-----------------------------------
${t.target_ctl}: ${loadAdvice.currentCTL.toFixed(0)} → ${loadAdvice.targetCTL} (${loadAdvice.weeksToGoal} ${t.weeks_unit})
${t.weekly_tss_target}: ${loadAdvice.tssRange.min}-${loadAdvice.tssRange.max}
${t.daily_tss_range}: ${loadAdvice.dailyTSSRange.min}-${loadAdvice.dailyTSSRange.max}
${t.load_advice}: ${loadAdvice.loadAdvice}`;

  if (loadAdvice.warning) {
    body += `
WARNING: ${loadAdvice.warning}`;
  }

  // Phase & Goal
  if (goals?.available && goals?.primaryGoal) {
    body += `
-----------------------------------
${t.phase_title}: ${phaseInfo.phaseName}
-----------------------------------
${t.goal_section}: ${goals.primaryGoal.name} (${goals.primaryGoal.date})
${t.weeks_to_goal}: ${phaseInfo.weeksOut} ${t.weeks_unit}
${t.focus}: ${phaseInfo.focus}
`;
  }

  // ===================================
  // WEEKLY PLAN SECTION (Forward-looking)
  // ===================================

  const upcoming = fetchUpcomingPlaceholders(7);

  // Get recent workout types for variety
  const recentTypes = getRecentWorkoutTypes(7);

  // Build context for AI planning - start from tomorrow, not today
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

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
      highIntensityDays: recentTypes.all.filter(t => {
        const catalog = { ...WORKOUT_TYPES.ride, ...WORKOUT_TYPES.run };
        return catalog[t]?.intensity >= 4;
      }).length
    },
    scheduledDays: upcoming.filter(d => d.activityType),
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
  for (let i = 1; i <= 7; i++) {  // Start from tomorrow (i=1)
    const checkDate = new Date(today);
    checkDate.setDate(today.getDate() + i);
    const dateStr = formatDateISO(checkDate);
    const dayName = Utilities.formatDate(checkDate, SYSTEM_SETTINGS.TIMEZONE, "EEEE");

    const eventsResult = fetchIcuApi("/athlete/0/events?oldest=" + dateStr + "&newest=" + dateStr);
    if (eventsResult.success && eventsResult.data?.length > 0) {
      const workout = eventsResult.data.find(e => e.category === 'WORKOUT');
      if (workout) {
        const isSimplePlaceholder = /^(Ride|Run)( - \d+min)?$/.test(workout.name || '');
        const isWeeklyPlan = workout.description?.includes('[Weekly Plan]');
        if (!isSimplePlaceholder && !isWeeklyPlan) {
          // User has a specific workout scheduled
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

  // Generate AI weekly plan
  Logger.log("Generating weekly training plan...");
  const weeklyPlan = generateAIWeeklyPlan(planContext);

  if (weeklyPlan) {
    // Create calendar events from the weekly plan
    const calendarResults = createWeeklyPlanEvents(weeklyPlan);

    // Add plan section to email
    body += `
===================================
${t.weekly_plan_title || 'WEEK AHEAD PLAN'}
===================================
${weeklyPlan.weeklyStrategy}

Target TSS: ${weeklyPlan.totalPlannedTSS}
Intensity Mix: ${weeklyPlan.intensityDistribution.high} hard | ${weeklyPlan.intensityDistribution.medium} medium | ${weeklyPlan.intensityDistribution.low} easy | ${weeklyPlan.intensityDistribution.rest} rest

`;

    // Day by day plan
    for (const day of weeklyPlan.days) {
      body += `${day.dayName} (${day.date})
${day.activity}${day.workoutType ? ': ' + day.workoutType : ''}
${day.activity !== 'Rest' ? 'TSS: ~' + day.estimatedTSS + ' | ' + day.duration + ' min' : ''}
${day.focus}

`;
    }

    // Key workouts
    if (weeklyPlan.keyWorkouts && weeklyPlan.keyWorkouts.length > 0) {
      body += `Key Workouts This Week:
`;
      weeklyPlan.keyWorkouts.forEach(kw => {
        body += `• ${kw}\n`;
      });
    }

    // Recovery notes
    if (weeklyPlan.recoveryNotes) {
      body += `
Recovery Notes: ${weeklyPlan.recoveryNotes}
`;
    }

    // Calendar sync info
    if (calendarResults.created > 0) {
      body += `
${calendarResults.created} workout${calendarResults.created > 1 ? 's' : ''} added to your Intervals.icu calendar.
`;
    }
  } else {
    Logger.log("Failed to generate weekly plan");
  }

  body += `\n${t.weekly_footer}`;

  GmailApp.sendEmail(USER_SETTINGS.EMAIL_TO, subject, body, { name: "IntervalCoach" });
  Logger.log("Weekly summary email sent successfully.");
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

  const t = TRANSLATIONS[USER_SETTINGS.LANGUAGE] || TRANSLATIONS.en;

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

