/**
 * IntervalCoach - Planning & Progress Tests
 *
 * Tests for weekly/monthly planning, progress tracking, and proposals.
 * Run these from the Apps Script editor to test planning features.
 */

// =========================================================
// WEEKLY SUMMARY & PLANNING TESTS
// =========================================================

/**
 * Test weekly summary
 */
function testWeeklySummary() {
  Logger.log("=== WEEKLY SUMMARY TEST ===");

  const weekData = fetchWeeklyActivities(7);
  Logger.log("This Week:");
  Logger.log("  Activities: " + weekData.totalActivities);
  Logger.log("  Rides: " + weekData.rides);
  Logger.log("  Runs: " + weekData.runs);
  Logger.log("  Total Time: " + formatDuration(weekData.totalTime));
  Logger.log("  Total TSS: " + weekData.totalTss.toFixed(0));
  Logger.log("  Total Distance: " + (weekData.totalDistance / 1000).toFixed(1) + " km");

  const prevWeekData = fetchWeeklyActivities(7, 7);
  Logger.log("\nPrevious Week:");
  Logger.log("  Activities: " + prevWeekData.totalActivities);
  Logger.log("  Total TSS: " + prevWeekData.totalTss.toFixed(0));

  Logger.log("\nTo send the actual email, run sendWeeklySummaryEmail()");
}

/**
 * Test training proposal generation
 */
function testTrainingProposal() {
  Logger.log("=== TRAINING PROPOSAL TEST ===\n");

  const wellnessRecords = fetchWellnessData(7);
  const wellness = createWellnessSummary(wellnessRecords);

  const goals = fetchUpcomingGoals();
  const targetDate = goals?.available && goals?.primaryGoal ? goals.primaryGoal.date : USER_SETTINGS.TARGET_DATE;
  const phaseInfo = calculateTrainingPhase(targetDate);
  phaseInfo.goalDescription = goals?.available ? buildGoalDescription(goals) : USER_SETTINGS.GOAL_DESCRIPTION;

  const fitnessMetrics = fetchFitnessMetrics();
  const loadAdvice = calculateTrainingLoadAdvice(fitnessMetrics, phaseInfo, goals);

  Logger.log("--- Current Context ---");
  Logger.log("Phase: " + phaseInfo.phaseName + " (" + phaseInfo.weeksOut + " weeks out)");
  Logger.log("Goal: " + (phaseInfo.goalDescription || "General fitness"));
  Logger.log("CTL: " + fitnessMetrics.ctl.toFixed(0));
  Logger.log("TSB: " + fitnessMetrics.tsb.toFixed(0));
  Logger.log("Recovery: " + wellness.recoveryStatus);
  Logger.log("Weekly TSS Target: " + loadAdvice.tssRange.min + "-" + loadAdvice.tssRange.max);

  Logger.log("\n--- Upcoming Placeholders (7 days) ---");
  const upcoming = fetchUpcomingPlaceholders(7);

  if (upcoming.length === 0) {
    Logger.log("No placeholders found for the next 7 days.");
    Logger.log("\n=== TEST COMPLETE ===");
    return;
  }

  upcoming.forEach(function(day) {
    let info = day.dayName + " (" + day.date + "): ";
    if (day.hasEvent) {
      info += day.eventCategory + " Event" + (day.eventName ? " - " + day.eventName : "");
      if (day.eventDescription) {
        info += " (" + day.eventDescription + ")";
      }
    } else if (day.activityType) {
      info += day.activityType + " (" + day.duration.min + "-" + day.duration.max + " min)";
    }
    Logger.log("  " + info);
  });

  Logger.log("\n--- Generated Training Proposal ---");
  const proposal = generateWeeklyTrainingProposal({
    upcoming: upcoming,
    phaseInfo: phaseInfo,
    fitnessMetrics: fitnessMetrics,
    goals: goals,
    wellness: wellness,
    loadAdvice: loadAdvice
  });

  if (proposal) {
    Logger.log(proposal);
  } else {
    Logger.log("(Failed to generate training proposal)");
  }

  Logger.log("\n=== TEST COMPLETE ===");
}

/**
 * Test AI weekly planning
 */
function testAIWeeklyPlan() {
  Logger.log("=== AI WEEKLY PLAN TEST ===");
  requireValidConfig();

  const fitnessMetrics = fetchFitnessMetrics();
  const wellnessRecords = fetchWellnessData();
  const wellness = createWellnessSummary(wellnessRecords);
  const powerProfile = analyzePowerProfile(fetchPowerCurve());
  const lastWeekActivities = fetchWeeklyActivities(7);
  const recentTypes = getRecentWorkoutTypes(7);
  const upcoming = fetchUpcomingPlaceholders(7);

  const goalsResult = fetchIcuApi("/athlete/" + USER_SETTINGS.ATHLETE_ID + "/goals");
  const goals = goalsResult.success && goalsResult.data ? {
    available: true,
    allGoals: goalsResult.data,
    primaryGoal: goalsResult.data.find(g => g.priority === 'A'),
    secondaryGoals: goalsResult.data.filter(g => g.priority === 'B')
  } : { available: false };

  const targetDate = goals.primaryGoal ? goals.primaryGoal.date :
    (USER_SETTINGS.TARGET_DATE || formatDateISO(new Date(Date.now() + 90 * 24 * 60 * 60 * 1000)));
  const phaseInfo = calculateTrainingPhase(targetDate, {
    goalDescription: goals.primaryGoal ? goals.primaryGoal.name : "General fitness",
    goals: goals,
    ctl: fitnessMetrics.ctl_90 || fitnessMetrics.ctl,
    tsb: fitnessMetrics.tsb_current || fitnessMetrics.tsb,
    enableAI: true
  });

  const ctl = fitnessMetrics.ctl_90 || fitnessMetrics.ctl || 0;
  const tsb = fitnessMetrics.tsb_current || fitnessMetrics.tsb || 0;
  const atl = fitnessMetrics.atl_7 || fitnessMetrics.atl || 0;

  // Calculate load advice after phaseInfo is available
  const loadAdvice = calculateTrainingLoadAdvice(fitnessMetrics, phaseInfo, goals);

  Logger.log("\n--- Current Status ---");
  Logger.log("Phase: " + phaseInfo.phaseName + " (" + phaseInfo.weeksOut + " weeks to goal)");
  Logger.log("CTL: " + ctl.toFixed(0) + " | TSB: " + tsb.toFixed(1));
  Logger.log("Recovery: " + (wellness.available ? wellness.recoveryStatus : "Unknown"));
  Logger.log("TSS target: " + loadAdvice.tssRange.min + "-" + loadAdvice.tssRange.max);

  // Check upcoming events
  let upcomingEvents = [];
  for (let i = 0; i < 7; i++) {
    const eventCheck = hasEventInDays(i);
    if (eventCheck.hasEvent) {
      const eventDate = new Date();
      eventDate.setDate(eventDate.getDate() + i);
      upcomingEvents.push({
        date: formatDateISO(eventDate),
        dayName: Utilities.formatDate(eventDate, SYSTEM_SETTINGS.TIMEZONE, "EEEE"),
        eventCategory: eventCheck.category,
        name: eventCheck.eventName,
        description: eventCheck.eventDescription
      });
    }
  }

  const planContext = {
    startDate: formatDateISO(new Date()),
    phase: phaseInfo.phaseName,
    weeksOut: phaseInfo.weeksOut,
    phaseFocus: phaseInfo.focus,
    phaseReasoning: phaseInfo.reasoning,
    ctl: ctl,
    atl: atl,
    tsb: tsb,
    eftp: powerProfile.available ? powerProfile.currentEftp : null,
    ctlTrend: fitnessMetrics.rampRate > 0.5 ? 'increasing' : fitnessMetrics.rampRate < -0.5 ? 'decreasing' : 'stable',
    recoveryStatus: wellness.available ? wellness.recoveryStatus : 'Unknown',
    avgRecovery: wellness.available ? wellness.averages?.recovery : null,
    avgSleep: wellness.available ? wellness.averages?.sleep : null,
    goals: goals,
    lastWeek: {
      totalTss: lastWeekActivities.totalTss || 0,
      activities: lastWeekActivities.totalActivities || 0,
      rideTypes: recentTypes.rides,
      runTypes: recentTypes.runs
    },
    upcomingEvents: upcomingEvents,
    scheduledDays: upcoming.filter(d => d.activityType),
    tssTarget: loadAdvice.tssRange,
    dailyTss: { min: loadAdvice.dailyTSSMin, max: loadAdvice.dailyTSSMax }
  };

  Logger.log("\n--- Generating Weekly Plan ---");
  const plan = generateAIWeeklyPlan(planContext);

  if (!plan) {
    Logger.log("ERROR: Failed to generate weekly plan");
    return;
  }

  Logger.log("\n--- Weekly Strategy ---");
  Logger.log(plan.weeklyStrategy);
  Logger.log("Total Planned TSS: " + plan.totalPlannedTSS);

  Logger.log("\n--- Day-by-Day Plan ---");
  for (const day of plan.days) {
    Logger.log(day.dayName + ": " + day.activity + (day.workoutType ? " - " + day.workoutType : "") +
               (day.estimatedTSS ? " [TSS: " + day.estimatedTSS + "]" : ""));
    Logger.log("  " + day.focus);
  }

  if (plan.keyWorkouts && plan.keyWorkouts.length > 0) {
    Logger.log("\n--- Key Workouts ---");
    plan.keyWorkouts.forEach(kw => Logger.log("- " + kw));
  }

  Logger.log("\n=== TEST COMPLETE ===");
  Logger.log("To send as email, run: sendWeeklyPlanningEmail()");
}

/**
 * Test weekly plan adaptation check
 */
function testWeeklyPlanAdaptation() {
  Logger.log("=== WEEKLY PLAN ADAPTATION TEST ===");
  requireValidConfig();

  const wellnessRecords = fetchWellnessData(7);
  const wellness = createWellnessSummary(wellnessRecords);
  const fitnessMetrics = fetchFitnessMetrics();
  const upcomingDays = fetchUpcomingPlaceholders(7);

  Logger.log("Current Status:");
  Logger.log("  Recovery: " + (wellness.available ? wellness.recoveryStatus : "Unknown"));
  Logger.log("  TSB: " + (fitnessMetrics.tsb?.toFixed(1) || "N/A"));

  Logger.log("\nUpcoming workouts:");
  upcomingDays.filter(d => d.activityType || d.hasEvent).forEach(d => {
    Logger.log("  " + d.dayName + ": " + (d.placeholderName || d.activityType || "Event"));
  });

  const result = checkWeeklyPlanAdaptation(wellness, fitnessMetrics, upcomingDays);

  Logger.log("\nAdaptation Check Result:");
  Logger.log("  Needs Adaptation: " + result.needsAdaptation);
  if (result.needsAdaptation) {
    Logger.log("  Reason: " + result.adaptationReason);
    Logger.log("  Suggestion: " + result.suggestion);
  }

  Logger.log("\n=== TEST COMPLETE ===");
}

/**
 * Test week progress check (planned vs completed)
 */
function testWeekProgress() {
  Logger.log("=== WEEK PROGRESS TEST ===");
  requireValidConfig();

  const progress = checkWeekProgress();

  Logger.log("Week Progress Summary:");
  Logger.log("  " + progress.summary);
  Logger.log("");
  Logger.log("Details:");
  Logger.log("  Days Analyzed: " + progress.daysAnalyzed);
  Logger.log("  Planned Sessions: " + progress.plannedSessions);
  Logger.log("  Completed Sessions: " + progress.completedSessions);
  Logger.log("  Missed Sessions: " + progress.missedSessions);
  Logger.log("  Extra Sessions: " + progress.extraSessions);
  Logger.log("  Adherence Rate: " + progress.adherenceRate + "%");
  Logger.log("  TSS Planned: " + progress.tssPlanned);
  Logger.log("  TSS Completed: " + progress.tssCompleted);

  if (progress.completedTypes.length > 0) {
    Logger.log("  Completed Types: " + progress.completedTypes.join(", "));
  }

  if (progress.missedTypes.length > 0) {
    Logger.log("  Missed Types: " + progress.missedTypes.join(", "));
  }

  // Show day-by-day breakdown
  if (progress.dayByDay?.length > 0) {
    Logger.log("\nDay-by-Day Breakdown:");
    for (const day of progress.dayByDay) {
      const planned = day.planned ? `${day.planned.type} (${day.planned.intensity})` : 'Rest';
      const completed = day.completed ? `${day.completed.type} (${day.completed.tss} TSS)` : 'None';
      Logger.log(`  ${day.dayName}: Planned=${planned}, Completed=${completed}, Status=${day.status}`);
    }
  }

  // Show missed workouts with event IDs
  if (progress.missedWorkouts?.length > 0) {
    Logger.log("\nMissed Workouts (would be cleaned up):");
    for (const missed of progress.missedWorkouts) {
      Logger.log(`  ${missed.day} (${missed.date}): ${missed.workoutType} - ${missed.intensity} (TSS ~${missed.tss})`);
      Logger.log(`    Event ID: ${missed.eventId || 'Not found'}`);
    }
  }

  // Show adaptation advice
  if (progress.adaptationAdvice) {
    Logger.log("\nAdaptation Advice:");
    Logger.log("  " + progress.adaptationAdvice);
  }

  Logger.log("\n=== TEST COMPLETE ===");
}

/**
 * Test monthly progress report
 */
function testMonthlyProgress() {
  Logger.log("=== MONTHLY PROGRESS TEST ===");

  const currentMonth = fetchMonthlyProgressData(0);
  const previousMonth = fetchMonthlyProgressData(1);

  Logger.log("\n=== " + currentMonth.monthName + " " + currentMonth.monthYear + " ===");

  Logger.log("\n--- Month-over-Month Comparison ---");
  const activityChange = currentMonth.totals.activities - previousMonth.totals.activities;
  const ctlChange = currentMonth.fitness.ctlEnd - previousMonth.fitness.ctlEnd;
  Logger.log("Activities: " + currentMonth.totals.activities + " (" + (activityChange >= 0 ? '+' : '') + activityChange + ")");
  Logger.log("CTL: " + currentMonth.fitness.ctlEnd.toFixed(1) + " (" + (ctlChange >= 0 ? '+' : '') + ctlChange.toFixed(1) + ")");

  Logger.log("\n--- Weekly Breakdown ---");
  currentMonth.weeklyData.forEach((w, i) => {
    Logger.log("Week " + (i + 1) + ": " + w.activities + " activities, " + w.totalTss.toFixed(0) + " TSS");
  });

  Logger.log("\n--- Totals ---");
  Logger.log("Total TSS: " + currentMonth.totals.tss.toFixed(0));
  Logger.log("Avg Weekly TSS: " + currentMonth.totals.avgWeeklyTss.toFixed(0));
}
