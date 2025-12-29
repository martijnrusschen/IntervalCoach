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

/**
 * Test mid-week adaptation functionality
 * Checks if adaptation is needed based on current week progress and wellness
 */
function testMidWeekAdaptation() {
  Logger.log("=== MID-WEEK ADAPTATION TEST ===\n");

  // Fetch current data
  const weekProgress = checkWeekProgress();
  const upcomingDays = fetchUpcomingPlaceholders(7);
  const wellness = createWellnessSummary(fetchWellnessDataEnhanced(7));
  const fitness = fetchFitnessMetrics();
  const goals = fetchUpcomingGoals();
  const targetDate = goals?.available && goals?.primaryGoal ? goals.primaryGoal.date : USER_SETTINGS.TARGET_DATE;
  const phaseInfo = calculateTrainingPhase(targetDate);

  // Log current state
  Logger.log("=== CURRENT STATE ===");
  Logger.log("Day of week: " + new Date().toLocaleDateString('en-US', { weekday: 'long' }));
  Logger.log("Days analyzed: " + weekProgress.daysAnalyzed);

  Logger.log("\n--- Week Progress ---");
  Logger.log("Planned: " + weekProgress.plannedSessions + " sessions (" + weekProgress.tssPlanned + " TSS)");
  Logger.log("Completed: " + weekProgress.completedSessions + " sessions (" + weekProgress.tssCompleted + " TSS)");
  Logger.log("Missed: " + weekProgress.missedSessions + " sessions");
  Logger.log("Adherence: " + (weekProgress.adherenceRate || 100).toFixed(0) + "%");

  if (weekProgress.missedTypes && weekProgress.missedTypes.length > 0) {
    Logger.log("Missed types: " + weekProgress.missedTypes.join(", "));
  }

  Logger.log("\n--- Wellness ---");
  Logger.log("Recovery: " + (wellness?.recoveryStatus || "Unknown"));
  Logger.log("TSB: " + (fitness?.tsb?.toFixed(1) || "N/A"));

  Logger.log("\n--- Remaining Week ---");
  const today = formatDateISO(new Date());
  const remaining = upcomingDays.filter(d => d.date > today && d.activityType);
  remaining.forEach(d => {
    const type = d.placeholderName ? extractWorkoutType(d.placeholderName) : "Unspecified";
    Logger.log("  " + d.dayName + " (" + d.date + "): " + type);
  });

  // Check if adaptation is needed
  Logger.log("\n=== ADAPTATION CHECK ===");
  const adaptationCheck = checkMidWeekAdaptationNeeded(weekProgress, upcomingDays, wellness, fitness);

  Logger.log("Adaptation needed: " + adaptationCheck.needed);
  Logger.log("Priority: " + adaptationCheck.priority);
  if (adaptationCheck.reason) {
    Logger.log("Reason: " + adaptationCheck.reason);
  }

  // Log triggers
  if (adaptationCheck.triggers) {
    const triggers = adaptationCheck.triggers;
    Logger.log("\nTriggers:");
    if (triggers.missedIntensity?.length > 0) {
      Logger.log("  - Missed intensity: " + triggers.missedIntensity.join(", "));
    }
    if (triggers.tssDeficit > 0) {
      Logger.log("  - TSS deficit: " + triggers.tssDeficit.toFixed(0));
    }
    if (triggers.lowRecovery) Logger.log("  - Low recovery");
    if (triggers.highFatigue) Logger.log("  - High fatigue");
    if (triggers.recoveryMismatch) Logger.log("  - Recovery/intensity mismatch");
  }

  // Generate adaptation if needed (dry run - don't apply)
  if (adaptationCheck.needed && remaining.length > 0) {
    Logger.log("\n=== GENERATING ADAPTATION (dry run) ===");

    try {
      // Build the prompt to show what would be sent to AI
      const prompt = buildMidWeekAdaptationPrompt(
        weekProgress, remaining, wellness, fitness, phaseInfo, goals, adaptationCheck.triggers
      );
      Logger.log("\nPrompt length: " + prompt.length + " chars");

      // Actually call the AI to see what it would recommend
      const response = callGeminiAPIText(prompt);
      const adaptation = parseGeminiJsonResponse(response);

      if (adaptation) {
        Logger.log("\n--- AI Recommendation ---");
        Logger.log("Needs changes: " + adaptation.needsChanges);
        Logger.log("Summary: " + adaptation.summary);

        if (adaptation.changes && adaptation.changes.length > 0) {
          Logger.log("\nProposed changes:");
          adaptation.changes.forEach(c => Logger.log("  • " + c));
        }

        if (adaptation.adaptedPlan && adaptation.adaptedPlan.length > 0) {
          Logger.log("\nAdapted plan:");
          adaptation.adaptedPlan.forEach(d => {
            Logger.log("  " + d.dayName + " (" + d.date + "): " + d.workoutType +
                      (d.typeChanged ? " [TYPE CHANGED]" : "") +
                      (d.durationChanged ? " [DURATION CHANGED]" : ""));
          });
        }

        Logger.log("\nReasoning: " + (adaptation.reasoning || "N/A"));
      } else {
        Logger.log("Failed to parse AI response");
      }
    } catch (e) {
      Logger.log("Error generating adaptation: " + e.toString());
    }
  } else if (!adaptationCheck.needed) {
    Logger.log("\nNo adaptation needed - current plan is appropriate.");
  } else {
    Logger.log("\nNo remaining placeholders to adapt.");
  }

  Logger.log("\n=== TEST COMPLETE ===");
}

/**
 * Test planned deload detection
 * Analyzes last 4 weeks of training to determine if a recovery week is needed
 */
function testDeloadDetection() {
  Logger.log("=== DELOAD DETECTION TEST ===\n");
  requireValidConfig();

  // Fetch current fitness metrics
  const fitness = fetchFitnessMetrics();

  Logger.log("=== CURRENT FITNESS ===");
  Logger.log("CTL: " + (fitness.ctl?.toFixed(1) || "N/A"));
  Logger.log("ATL: " + (fitness.atl?.toFixed(1) || "N/A"));
  Logger.log("TSB: " + (fitness.tsb?.toFixed(1) || "N/A"));
  Logger.log("Ramp Rate: " + (fitness.rampRate?.toFixed(1) || "N/A") + " CTL/week");

  // Fetch wellness data (includes sleep debt from Whoop)
  const wellnessRecords = fetchWellnessDataEnhanced(7, 0);
  const wellness = createWellnessSummary(wellnessRecords);

  Logger.log("\n=== SLEEP DEBT (from Whoop) ===");
  const sleepDebt = wellness?.today?.sleepDebtHours;
  if (sleepDebt != null) {
    const debtLevel = sleepDebt >= 5 ? 'SEVERE' : sleepDebt >= 3 ? 'SIGNIFICANT' : sleepDebt >= 1.5 ? 'MODERATE' : 'LOW';
    Logger.log("Sleep Debt: " + sleepDebt.toFixed(1) + "h (" + debtLevel + ")");
    if (sleepDebt >= 1.5) {
      const points = sleepDebt >= 5 ? 3 : sleepDebt >= 3 ? 2 : 1;
      Logger.log("  → Adds +" + points + " urgency to deload score");
    }
  } else {
    Logger.log("Sleep Debt: N/A (Whoop data not available)");
  }

  // Run deload check (now includes wellness/sleep debt)
  const deloadCheck = checkDeloadNeeded(fitness, wellness);

  Logger.log("\n=== DELOAD ANALYSIS ===");
  Logger.log(formatDeloadCheckLog(deloadCheck));

  // Additional analysis
  Logger.log("\n=== ANALYSIS DETAILS ===");
  Logger.log("Urgency Score Factors:");

  if (deloadCheck.weeksWithoutDeload >= 4) {
    Logger.log("  [+3] 4+ consecutive weeks without recovery");
  } else if (deloadCheck.weeksWithoutDeload >= 3) {
    Logger.log("  [+2] 3 consecutive weeks of sustained load");
  }

  if (fitness.rampRate > 5) {
    Logger.log("  [+2] High ramp rate (>" + 5 + " CTL/week)");
  } else if (fitness.rampRate > 3) {
    Logger.log("  [+1] Elevated ramp rate (>" + 3 + " CTL/week)");
  }

  if (fitness.tsb < -30) {
    Logger.log("  [+3] High fatigue (TSB < -30)");
  } else if (fitness.tsb < -20) {
    Logger.log("  [+1] Moderate fatigue (TSB < -20)");
  }

  if (sleepDebt >= 5) {
    Logger.log("  [+3] Severe sleep debt (>= 5h)");
  } else if (sleepDebt >= 3) {
    Logger.log("  [+2] Significant sleep debt (>= 3h)");
  } else if (sleepDebt >= 1.5) {
    Logger.log("  [+1] Moderate sleep debt (>= 1.5h)");
  }

  Logger.log("\n=== RESULT ===");
  if (deloadCheck.needed) {
    Logger.log("DELOAD RECOMMENDED (" + deloadCheck.urgency.toUpperCase() + ")");
    Logger.log("Suggested deload TSS: ~" + deloadCheck.suggestedDeloadTSS);
    Logger.log("\n" + deloadCheck.recommendation);
  } else {
    Logger.log("No deload needed at this time");
    if (deloadCheck.recommendation) {
      Logger.log(deloadCheck.recommendation);
    }
  }

  Logger.log("\n=== TEST COMPLETE ===");
}

/**
 * Test sleep debt impact on deload urgency
 * Simulates different sleep debt levels to show how it affects deload recommendations
 */
function testSleepDebtImpact() {
  Logger.log("=== SLEEP DEBT IMPACT TEST ===\n");
  requireValidConfig();

  const fitness = fetchFitnessMetrics();

  Logger.log("Current fitness: CTL=" + (fitness.ctl?.toFixed(0) || "N/A") +
             ", TSB=" + (fitness.tsb?.toFixed(0) || "N/A") +
             ", Ramp=" + (fitness.rampRate?.toFixed(1) || "N/A"));

  // Test different sleep debt scenarios
  const scenarios = [
    { debt: 0.3, label: "Low (your current)" },
    { debt: 1.5, label: "Moderate" },
    { debt: 3.0, label: "Significant" },
    { debt: 5.0, label: "Severe" }
  ];

  Logger.log("\n=== SIMULATED SCENARIOS ===");

  for (const scenario of scenarios) {
    // Create mock wellness with simulated sleep debt
    const mockWellness = {
      today: { sleepDebtHours: scenario.debt }
    };

    const result = checkDeloadNeeded(fitness, mockWellness);

    const urgencyEmoji = result.needed ?
      (result.urgency === 'high' ? '🔴' : result.urgency === 'medium' ? '🟠' : '🟡') : '✅';

    Logger.log(`\n${urgencyEmoji} Sleep Debt: ${scenario.debt}h (${scenario.label})`);
    Logger.log(`   Deload needed: ${result.needed ? 'YES (' + result.urgency + ')' : 'No'}`);
    if (result.reason) {
      Logger.log(`   Reasons: ${result.reason}`);
    }
  }

  Logger.log("\n=== TEST COMPLETE ===");
}

/**
 * Test volume jump detection
 * Analyzes week-over-week TSS changes to identify injury risk
 */
function testVolumeJump() {
  Logger.log("=== VOLUME JUMP DETECTION TEST ===\n");
  requireValidConfig();

  // Run volume jump check
  const volumeJump = checkVolumeJump();

  Logger.log("=== TSS COMPARISON ===");
  Logger.log("This Week TSS: " + volumeJump.thisWeekTSS);
  Logger.log("Last Week TSS: " + volumeJump.lastWeekTSS);
  Logger.log("Change: " + (volumeJump.percentChange >= 0 ? "+" : "") + volumeJump.percentChange + "%");

  Logger.log("\n=== DETECTION RESULT ===");
  Logger.log("Volume Jump Detected: " + volumeJump.detected);
  Logger.log("Risk Level: " + volumeJump.risk);

  if (volumeJump.detected) {
    const riskEmoji = {
      'high': '🚨',
      'medium': '⚠️',
      'low': '📈',
      'check': '📉'
    }[volumeJump.risk] || '📊';

    Logger.log("\n=== WARNING ===");
    Logger.log(riskEmoji + " " + volumeJump.recommendation);
  } else {
    Logger.log("\nNo volume jump concerns - week-over-week change is within safe range.");
  }

  // Show thresholds for reference
  Logger.log("\n=== THRESHOLDS ===");
  Logger.log(">30% increase → HIGH risk (injury warning)");
  Logger.log(">20% increase → MEDIUM risk (caution)");
  Logger.log(">15% increase → LOW risk (monitor)");
  Logger.log("<-30% decrease → Volume drop check");

  Logger.log("\n=== TEST COMPLETE ===");
}

/**
 * Test ramp rate warning
 * Checks for sustained high CTL ramp rate over multiple weeks
 */
function testRampRateWarning() {
  Logger.log("=== RAMP RATE WARNING TEST ===\n");
  requireValidConfig();

  // Fetch current fitness
  const fitness = fetchFitnessMetrics();

  Logger.log("=== CURRENT FITNESS ===");
  Logger.log("CTL: " + (fitness.ctl?.toFixed(1) || "N/A"));
  Logger.log("Current Ramp Rate: " + (fitness.rampRate?.toFixed(1) || "N/A") + " CTL/week");

  // Run ramp rate warning check
  const warning = checkRampRateWarning(fitness);

  Logger.log("\n=== WEEKLY RAMP RATES ===");
  if (warning.weeklyRates.length > 0) {
    warning.weeklyRates.forEach(w => {
      const rateStr = w.rate > 0 ? '+' + w.rate : w.rate.toString();
      const indicator = w.rate > 7 ? '🚨' : w.rate > 5 ? '⚠️' : '✅';
      Logger.log(`  ${w.label}: ${w.startCTL} → ${w.endCTL} CTL (${rateStr}/week) ${indicator}`);
    });
    Logger.log(`\n  Average: ${warning.avgRate > 0 ? '+' : ''}${warning.avgRate} CTL/week`);
  } else {
    Logger.log("  Could not fetch weekly ramp rate data");
  }

  Logger.log("\n=== WARNING RESULT ===");
  Logger.log("Warning: " + (warning.warning ? 'YES' : 'No'));
  Logger.log("Level: " + warning.level);
  Logger.log("Consecutive elevated weeks: " + warning.consecutiveWeeks);

  if (warning.warning) {
    const levelEmoji = {
      'critical': '🚨',
      'warning': '⚠️',
      'caution': '📈'
    }[warning.level] || '📊';

    Logger.log("\n=== RECOMMENDATION ===");
    Logger.log(levelEmoji + " " + warning.recommendation);
  } else {
    Logger.log("\nNo ramp rate warning - training load is sustainable.");
  }

  // Show thresholds for reference
  Logger.log("\n=== THRESHOLDS ===");
  Logger.log("0-5 CTL/week → Normal (sustainable long-term)");
  Logger.log("5-7 CTL/week → Elevated (OK for 1-2 weeks)");
  Logger.log(">7 CTL/week → High (injury risk)");
  Logger.log("\nWarning triggers:");
  Logger.log("  - 2+ weeks at >7 → CRITICAL");
  Logger.log("  - 1 week high + 2 weeks elevated → WARNING");
  Logger.log("  - 3+ weeks at >5 → WARNING");
  Logger.log("  - 2 weeks at >5 → CAUTION");

  Logger.log("\n=== TEST COMPLETE ===");
}

/**
 * Test taper timing calculation
 * Analyzes optimal taper start date for upcoming A race
 */
function testTaperTiming() {
  Logger.log("=== TAPER TIMING TEST ===\n");
  requireValidConfig();

  // Fetch goals and fitness
  const goals = fetchUpcomingGoals();
  const fitness = fetchFitnessMetrics();
  const targetDate = goals?.available && goals?.primaryGoal ? goals.primaryGoal.date : USER_SETTINGS.TARGET_DATE;
  const phaseInfo = calculateTrainingPhase(targetDate);

  Logger.log("=== CURRENT FITNESS ===");
  Logger.log("CTL: " + (fitness.ctl?.toFixed(1) || "N/A"));
  Logger.log("ATL: " + (fitness.atl?.toFixed(1) || "N/A"));
  Logger.log("TSB: " + (fitness.tsb?.toFixed(1) || "N/A"));

  Logger.log("\n=== GOALS ===");
  if (goals?.available && goals?.primaryGoal) {
    Logger.log("Primary: " + goals.primaryGoal.name + " (" + goals.primaryGoal.date + ")");
  } else {
    Logger.log("No primary goal found (using TARGET_DATE: " + USER_SETTINGS.TARGET_DATE + ")");
  }

  // Generate taper recommendation
  const primaryGoal = goals?.primaryGoal || { date: USER_SETTINGS.TARGET_DATE, name: "Target Event" };
  const taperRec = generateTaperRecommendation(fitness, primaryGoal, phaseInfo);

  Logger.log("\n=== TAPER ANALYSIS ===");

  if (!taperRec.available) {
    Logger.log("Taper recommendation not available: " + taperRec.reason);
    if (taperRec.daysToRace) {
      Logger.log("Days to race: " + taperRec.daysToRace);
    }
    Logger.log("\n=== TEST COMPLETE ===");
    return;
  }

  const analysis = taperRec.analysis;
  const rec = analysis.recommended;

  Logger.log("Race Date: " + analysis.raceDate);
  Logger.log("Days to Race: " + analysis.daysToRace);
  Logger.log("Current TSB: " + analysis.currentTSB);
  Logger.log("Target Race Day TSB: " + analysis.targetTSB);

  Logger.log("\n=== RECOMMENDED TAPER ===");
  Logger.log("Type: " + rec.taperType + " (" + rec.taperDescription + ")");
  Logger.log("Length: " + rec.taperLengthDays + " days");
  Logger.log("Start Date: " + rec.taperStartDate);
  Logger.log("Days Until Taper: " + rec.daysUntilTaperStart);

  Logger.log("\n=== RACE DAY PROJECTION ===");
  Logger.log("CTL: " + analysis.currentCTL + " → " + rec.raceDayCTL + " (loss: " + rec.ctlLoss + ")");
  Logger.log("TSB: " + analysis.currentTSB + " → " + rec.raceDayTSB);

  // Show AI recommendation if available
  const ai = taperRec.aiRecommendation;
  if (ai?.success) {
    Logger.log("\n=== AI RECOMMENDATION ===");
    Logger.log("Summary: " + ai.summary);

    if (ai.weekByWeekPlan && ai.weekByWeekPlan.length > 0) {
      Logger.log("\nWeek-by-Week Plan:");
      ai.weekByWeekPlan.forEach(w => Logger.log("  • " + w));
    }

    if (ai.keyWorkouts && ai.keyWorkouts.length > 0) {
      Logger.log("\nKey Workouts:");
      ai.keyWorkouts.forEach(w => Logger.log("  • " + w));
    }

    if (ai.warnings && ai.warnings.length > 0) {
      Logger.log("\nWarnings:");
      ai.warnings.forEach(w => Logger.log("  ⚠️ " + w));
    }

    Logger.log("\nExpected Performance: " + ai.expectedPerformance);
    Logger.log("Confidence: " + ai.confidenceLevel);
  }

  // Show alternatives
  if (analysis.alternatives && analysis.alternatives.length > 0) {
    Logger.log("\n=== ALTERNATIVE SCENARIOS ===");
    analysis.alternatives.forEach(alt => {
      Logger.log(alt.taperType + ": Start " + alt.taperStartDate +
                " (" + alt.taperLengthDays + " days) → TSB " + alt.raceDayTSB);
    });
  }

  Logger.log("\n=== TEST COMPLETE ===");
}

// =========================================================
// ADAPTIVE PHASE TRANSITION TEST
// =========================================================

/**
 * Test adaptive phase transitions based on fitness trajectory
 */
function testAdaptivePhaseTransitions() {
  Logger.log("=== ADAPTIVE PHASE TRANSITIONS TEST ===\n");
  requireValidConfig();

  // Fetch current data
  const goals = fetchUpcomingGoals();
  const targetDate = goals?.available && goals?.primaryGoal ? goals.primaryGoal.date : USER_SETTINGS.TARGET_DATE;

  Logger.log("=== GOALS ===");
  if (goals?.available && goals?.primaryGoal) {
    Logger.log("Primary: " + goals.primaryGoal.name + " (" + goals.primaryGoal.date + ")");
  } else {
    Logger.log("Using TARGET_DATE: " + targetDate);
  }

  // Test trajectory analysis
  Logger.log("\n=== FITNESS TRAJECTORY ANALYSIS ===");
  const trajectory = analyzeFitnessTrajectory(4);

  if (!trajectory.available) {
    Logger.log("Trajectory analysis not available (insufficient data)");
  } else {
    // CTL trajectory
    Logger.log("\nCTL Trajectory:");
    Logger.log("  Current: " + trajectory.ctlTrajectory.current);
    Logger.log("  Weekly Values: " + trajectory.ctlTrajectory.weeklyValues.join(" → "));
    Logger.log("  Weekly Changes: " + trajectory.ctlTrajectory.weeklyChanges.join(", "));
    Logger.log("  Avg Change: " + trajectory.ctlTrajectory.avgChange + "/week");
    Logger.log("  Trend: " + trajectory.ctlTrajectory.trend);
    Logger.log("  Consistency: " + trajectory.ctlTrajectory.consistency + "% positive weeks");

    // eFTP trajectory
    Logger.log("\neFTP Trajectory:");
    Logger.log("  Current: " + (trajectory.eftpTrajectory.current || "N/A") + "W");
    Logger.log("  Target: " + (trajectory.eftpTrajectory.target || "N/A") + "W");
    Logger.log("  Progress: " + (trajectory.eftpTrajectory.progressToTarget || "N/A") + "%");
    Logger.log("  Trend: " + trajectory.eftpTrajectory.trend);
    Logger.log("  On Track: " + trajectory.eftpTrajectory.onTrack);

    // Recovery trend
    Logger.log("\nRecovery Trend:");
    Logger.log("  Avg Recovery: " + (trajectory.recoveryTrend.avgRecovery || "N/A") + "%");
    Logger.log("  Avg Sleep: " + (trajectory.recoveryTrend.avgSleep || "N/A") + "h");
    Logger.log("  Avg HRV: " + (trajectory.recoveryTrend.avgHRV || "N/A") + "ms");
    Logger.log("  Trend: " + trajectory.recoveryTrend.trend);
    Logger.log("  Sustainable Load: " + trajectory.recoveryTrend.sustainableLoad);

    // Phase readiness
    Logger.log("\nPhase Readiness:");
    Logger.log("  Base Complete: " + trajectory.phaseReadiness.baseComplete);
    Logger.log("  Build Complete: " + trajectory.phaseReadiness.buildComplete);
    Logger.log("  Ready for Specialty: " + trajectory.phaseReadiness.readyForSpecialty);
    Logger.log("  Ready for Taper: " + trajectory.phaseReadiness.readyForTaper);
    if (trajectory.phaseReadiness.indicators.length > 0) {
      Logger.log("  Indicators: " + trajectory.phaseReadiness.indicators.join("; "));
    }
  }

  // Calculate phase with trajectory (no AI for faster testing)
  Logger.log("\n=== PHASE CALCULATION (Date-based) ===");
  const phaseNoAI = calculateTrainingPhase(targetDate, { enableAI: false });
  Logger.log("Phase: " + phaseNoAI.phaseName);
  Logger.log("Weeks Out: " + phaseNoAI.weeksOut);
  Logger.log("Focus: " + phaseNoAI.focus);

  if (phaseNoAI.transitionRecommendation) {
    const tr = phaseNoAI.transitionRecommendation;
    Logger.log("\nTransition Recommendation:");
    Logger.log("  Should Transition: " + tr.shouldTransition);
    if (tr.shouldTransition) {
      Logger.log("  Recommended: " + phaseNoAI.phaseName + " → " + tr.recommendedPhase);
      Logger.log("  Urgency: " + tr.urgency);
    }
    Logger.log("  Reason: " + tr.reason);
    Logger.log("  Adaptation Type: " + (tr.adaptationType || "maintain"));
  }

  // Calculate phase with AI enhancement
  Logger.log("\n=== PHASE CALCULATION (AI-enhanced) ===");
  const fitness = fetchFitnessMetrics();
  const wellness = createWellnessSummary(fetchWellnessData(7));

  const context = {
    enableAI: true,
    goals: goals,
    goalDescription: goals?.available ? buildGoalDescription(goals) : USER_SETTINGS.GOAL_DESCRIPTION,
    ctl: fitness.ctl,
    rampRate: fitness.rampRate,
    currentEftp: fitness.eftp,
    targetFtp: USER_SETTINGS.MANUAL_FTP,
    wellnessAverages: wellness.averages,
    recoveryStatus: wellness.recoveryStatus,
    tsb: fitness.tsb
  };

  const phaseAI = calculateTrainingPhase(targetDate, context);
  Logger.log("Phase: " + phaseAI.phaseName);
  Logger.log("AI Enhanced: " + phaseAI.aiEnhanced);
  Logger.log("Focus: " + phaseAI.focus);
  Logger.log("Reasoning: " + phaseAI.reasoning);

  if (phaseAI.phaseOverride) {
    Logger.log("\n⚠️ AI OVERRODE date-based phase!");
  }

  if (phaseAI.adjustments) {
    Logger.log("Adjustments: " + phaseAI.adjustments);
  }

  Logger.log("\n=== TEST COMPLETE ===");
}

/**
 * DIAGNOSTIC: Compare raw API events vs fetchUpcomingPlaceholders output
 * Run this to see exactly what events exist in your calendar vs what's being detected
 */
function testDiagnoseUpcomingSchedule() {
  Logger.log("=== DIAGNOSE UPCOMING SCHEDULE ===\n");
  requireValidConfig();

  const today = new Date();

  for (let i = 0; i < 7; i++) {
    const date = new Date(today);
    date.setDate(today.getDate() + i);
    const dateStr = formatDateISO(date);
    const dayName = Utilities.formatDate(date, SYSTEM_SETTINGS.TIMEZONE, "EEEE");

    Logger.log("\n--- " + dayName + " (" + dateStr + ") ---");

    // Fetch raw events from API
    const rawResult = fetchIcuApi("/athlete/0/events?oldest=" + dateStr + "&newest=" + dateStr);

    if (!rawResult.success || !rawResult.data || rawResult.data.length === 0) {
      Logger.log("  [RAW API] No events");
    } else {
      Logger.log("  [RAW API] " + rawResult.data.length + " event(s):");
      for (const e of rawResult.data) {
        Logger.log("    - Category: " + (e.category || "N/A") +
                   " | Name: " + (e.name || "N/A") +
                   " | Type: " + (e.type || "N/A"));
        if (e.description) {
          Logger.log("      Description: " + e.description.substring(0, 50) + "...");
        }
      }
    }

    // Use fetchEventsForDate to see how it categorizes
    const eventData = fetchEventsForDate(dateStr);
    Logger.log("  [fetchEventsForDate] Categorized as:");
    Logger.log("    - raceEvent: " + (eventData.raceEvent ? eventData.raceEvent.category + " - " + eventData.raceEvent.name : "null"));
    Logger.log("    - workoutEvents: " + eventData.workoutEvents.length + " found");
    for (const we of eventData.workoutEvents) {
      Logger.log("        * " + we.name + " (type: " + we.type + ")");
    }
    Logger.log("    - placeholders: " + eventData.placeholders.length + " found");
    for (const ph of eventData.placeholders) {
      Logger.log("        * " + ph.name + " (type: " + ph.type + ")");
    }
  }

  // Now show what fetchUpcomingPlaceholders returns
  Logger.log("\n\n=== fetchUpcomingPlaceholders OUTPUT ===");
  const upcoming = fetchUpcomingPlaceholders(7);
  for (const day of upcoming) {
    let info = day.dayName + " (" + day.date + "): ";
    if (day.hasEvent) {
      info += "[" + day.eventCategory + "] " + (day.eventName || "");
    } else if (day.activityType) {
      info += day.placeholderName || day.activityType;
      if (day.duration) info += " (" + day.duration.min + "-" + day.duration.max + " min)";
    } else {
      info += "-";
    }
    Logger.log("  " + info);
  }

  Logger.log("\n=== DIAGNOSIS COMPLETE ===");
  Logger.log("\nIf workoutEvents exist but don't appear in the final output,");
  Logger.log("the issue is that fetchUpcomingPlaceholders only uses 'placeholders' array,");
  Logger.log("not 'workoutEvents' array. Weekly plan events are WORKOUT category events.");
}
