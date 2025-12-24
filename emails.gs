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

  // Add recovery indicator to subject
  let recoveryTag = "";
  if (wellness && wellness.available) {
    if (wellness.recoveryStatus.includes("Green") || wellness.recoveryStatus.includes("Primed") || wellness.recoveryStatus.includes("Well Recovered")) {
      recoveryTag = "[GREEN] ";
    } else if (wellness.recoveryStatus.includes("Yellow") || wellness.recoveryStatus.includes("Normal")) {
      recoveryTag = "[YELLOW] ";
    } else if (wellness.recoveryStatus.includes("Red") || wellness.recoveryStatus.includes("Fatigued")) {
      recoveryTag = "[RED] ";
    }
  }

  const subject = t.subject_prefix + recoveryTag + workout.type + " (" + Utilities.formatDate(new Date(), SYSTEM_SETTINGS.TIMEZONE, "MM/dd") + ")";

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
(${t.weeks_to_goal}: ${phaseInfo.weeksOut}${t.weeks_unit})
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
(${t.weeks_to_goal}: ${phaseInfo.weeksOut}${t.weeks_unit})
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
    const timeSign = timeDiff >= 0 ? "+" : "";

    body += `
-----------------------------------
${t.weekly_comparison}
-----------------------------------
TSS: ${tssSign}${tssDiff.toFixed(0)} (${prevWeekData.totalTss.toFixed(0)} → ${weekData.totalTss.toFixed(0)})
${t.total_time}: ${timeSign}${formatDuration(timeDiff)}
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

  // Training Load Advice
  const loadAdvice = calculateTrainingLoadAdvice(fitnessMetrics, phaseInfo, goals);
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
⚠️ ${loadAdvice.warning}`;
  }

  // Phase & Goal
  if (goals?.available && goals?.primaryGoal) {
    body += `
-----------------------------------
${t.phase_title}: ${phaseInfo.phaseName}
-----------------------------------
${t.goal_section}: ${goals.primaryGoal.name} (${goals.primaryGoal.date})
${t.weeks_to_goal}: ${phaseInfo.weeksOut}${t.weeks_unit}
${t.focus}: ${phaseInfo.focus}
`;
  }

  // Training Proposal
  const upcoming = fetchUpcomingPlaceholders(7);
  if (upcoming.length > 0) {
    const trainingProposal = generateWeeklyTrainingProposal({
      upcoming: upcoming,
      phaseInfo: phaseInfo,
      fitnessMetrics: fitnessMetrics,
      goals: goals,
      wellness: wellnessSummary,
      loadAdvice: loadAdvice
    });

    if (trainingProposal) {
      body += `
-----------------------------------
${t.training_proposal_title}
-----------------------------------
${trainingProposal}
`;
    }
  } else {
    body += `
-----------------------------------
${t.training_proposal_title}
-----------------------------------
${t.training_proposal_no_placeholders}
`;
  }

  body += `\n${t.weekly_footer}`;

  GmailApp.sendEmail(USER_SETTINGS.EMAIL_TO, subject, body, { name: "IntervalCoach" });
  Logger.log("Weekly summary email sent successfully.");
}

// =========================================================
// WEEKLY PLANNING EMAIL
// =========================================================

/**
 * Send weekly training plan email
 * Call this at the start of the week (e.g., Sunday evening or Monday morning)
 */
function sendWeeklyPlanningEmail() {
  requireValidConfig();

  const t = TRANSLATIONS[USER_SETTINGS.LANGUAGE] || TRANSLATIONS.en;
  const today = new Date();

  // Gather all context
  const fitnessMetrics = fetchFitnessMetrics();
  const wellnessRecords = fetchWellnessData();
  const wellness = createWellnessSummary(wellnessRecords);
  const powerProfile = analyzePowerProfile(fetchPowerCurve());
  const lastWeekActivities = fetchWeeklyActivities(7);
  const recentTypes = getRecentWorkoutTypes(7);
  const upcoming = fetchUpcomingPlaceholders(7);
  const loadAdvice = calculateTrainingLoadAdvice(fitnessMetrics);

  // Get goals
  const goalsResult = fetchIcuApi("/athlete/" + USER_SETTINGS.ATHLETE_ID + "/goals");
  const goals = goalsResult.success && goalsResult.data ? {
    available: true,
    allGoals: goalsResult.data,
    primaryGoal: goalsResult.data.find(g => g.priority === 'A'),
    secondaryGoals: goalsResult.data.filter(g => g.priority === 'B')
  } : { available: false };

  // Calculate phase
  const targetDate = goals.primaryGoal ? goals.primaryGoal.date :
    (USER_SETTINGS.TARGET_DATE || formatDateISO(new Date(Date.now() + 90 * 24 * 60 * 60 * 1000)));
  const phaseInfo = calculateTrainingPhase(targetDate, {
    goalDescription: goals.primaryGoal ? goals.primaryGoal.name : "General fitness",
    goals: goals,
    ctl: fitnessMetrics.ctl_90 || fitnessMetrics.ctl,
    tsb: fitnessMetrics.tsb_current || fitnessMetrics.tsb,
    enableAI: true
  });

  // Get upcoming events
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

  // Build context for AI planning
  const planContext = {
    startDate: formatDateISO(today),
    phase: phaseInfo.phaseName,
    weeksOut: phaseInfo.weeksOut,
    phaseFocus: phaseInfo.focus,
    phaseReasoning: phaseInfo.reasoning,
    ctl: fitnessMetrics.ctl_90 || fitnessMetrics.ctl || 0,
    atl: fitnessMetrics.atl_7 || fitnessMetrics.atl || 0,
    tsb: fitnessMetrics.tsb_current || fitnessMetrics.tsb || 0,
    eftp: powerProfile.available ? powerProfile.currentEftp : null,
    ctlTrend: fitnessMetrics.rampRate > 0.5 ? 'increasing' : fitnessMetrics.rampRate < -0.5 ? 'decreasing' : 'stable',
    recoveryStatus: wellness.available ? wellness.recoveryStatus : 'Unknown',
    avgRecovery: wellness.available ? wellness.averages?.recovery : null,
    avgSleep: wellness.available ? wellness.averages?.sleep : null,
    goals: goals,
    lastWeek: {
      totalTss: lastWeekActivities.reduce((sum, a) => sum + (a.icu_training_load || 0), 0),
      activities: lastWeekActivities.length,
      rideTypes: recentTypes.rides,
      runTypes: recentTypes.runs,
      highIntensityDays: recentTypes.all.filter(t => {
        const catalog = { ...WORKOUT_TYPES.ride, ...WORKOUT_TYPES.run };
        return catalog[t]?.intensity >= 4;
      }).length
    },
    upcomingEvents: upcomingEvents,
    scheduledDays: upcoming.filter(d => d.activityType),
    tssTarget: loadAdvice.tssRange,
    dailyTss: { min: loadAdvice.dailyTSSMin, max: loadAdvice.dailyTSSMax },
    twoWeekHistory: getTwoWeekWorkoutHistory()
  };

  // Generate AI weekly plan
  Logger.log("Generating weekly training plan...");
  const weeklyPlan = generateAIWeeklyPlan(planContext);

  if (!weeklyPlan) {
    Logger.log("Failed to generate weekly plan");
    return;
  }

  // Create calendar events from the weekly plan
  const calendarResults = createWeeklyPlanEvents(weeklyPlan);

  // Build email
  const weekStart = Utilities.formatDate(today, SYSTEM_SETTINGS.TIMEZONE, "MMM d");
  const weekEnd = new Date(today);
  weekEnd.setDate(weekEnd.getDate() + 6);
  const weekEndStr = Utilities.formatDate(weekEnd, SYSTEM_SETTINGS.TIMEZONE, "MMM d");

  const subject = `[IntervalCoach] Week Plan: ${weekStart} - ${weekEndStr}`;

  let body = `Your training plan for the week ahead.\n\n`;

  // Strategy overview
  body += `===================================
WEEKLY STRATEGY
===================================
${weeklyPlan.weeklyStrategy}

Target TSS: ${weeklyPlan.totalPlannedTSS}
Intensity Mix: ${weeklyPlan.intensityDistribution.high} hard | ${weeklyPlan.intensityDistribution.medium} medium | ${weeklyPlan.intensityDistribution.low} easy | ${weeklyPlan.intensityDistribution.rest} rest

`;

  // Day by day plan
  body += `===================================
DAY-BY-DAY PLAN
===================================\n`;

  for (const day of weeklyPlan.days) {
    const activityIcon = day.activity === 'Rest' ? '🛋️' : day.activity === 'Ride' ? '🚴' : '🏃';
    body += `
${day.dayName} (${day.date})
${activityIcon} ${day.activity}${day.workoutType ? ': ' + day.workoutType : ''}
${day.activity !== 'Rest' ? 'TSS: ~' + day.estimatedTSS + ' | ' + day.duration + ' min' : ''}
${day.focus}
`;
  }

  // Key workouts
  if (weeklyPlan.keyWorkouts && weeklyPlan.keyWorkouts.length > 0) {
    body += `
===================================
KEY WORKOUTS THIS WEEK
===================================
`;
    weeklyPlan.keyWorkouts.forEach(kw => {
      body += `• ${kw}\n`;
    });
  }

  // Recovery notes
  if (weeklyPlan.recoveryNotes) {
    body += `
-----------------------------------
Recovery Notes
-----------------------------------
${weeklyPlan.recoveryNotes}
`;
  }

  // Calendar sync info
  if (calendarResults.created > 0) {
    body += `
-----------------------------------
Calendar Sync
-----------------------------------
${calendarResults.created} workout${calendarResults.created > 1 ? 's' : ''} added to your Intervals.icu calendar.
These placeholders will be replaced with detailed workouts each day.
`;
  }

  // Current status
  body += `
===================================
CURRENT STATUS
===================================
Phase: ${phaseInfo.phaseName} (${phaseInfo.weeksOut} weeks to goal)
CTL: ${planContext.ctl.toFixed(0)} | TSB: ${planContext.tsb.toFixed(1)}
Recovery: ${planContext.recoveryStatus}
`;

  body += `\n\nHave a great week of training!`;

  GmailApp.sendEmail(USER_SETTINGS.EMAIL_TO, subject, body, { name: "IntervalCoach" });
  Logger.log("Weekly planning email sent successfully.");

  return weeklyPlan;
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
${t.weeks_to_goal}: ${phaseInfo.weeksOut}${t.weeks_unit}
`;
  }

  body += `\n${t.monthly_footer}`;

  GmailApp.sendEmail(USER_SETTINGS.EMAIL_TO, subject, body, { name: "IntervalCoach" });
  Logger.log("Monthly progress report sent successfully.");
}

