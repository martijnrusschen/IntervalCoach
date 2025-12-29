/**
 * IntervalCoach - Email & Impact Tests
 *
 * Tests for email structure, workout impact preview, and daily email sending.
 * Run these from the Apps Script editor to test email features.
 */

// =========================================================
// EMAIL TESTS
// =========================================================

/**
 * Test unified daily email - tests all three types
 * @param {string} emailType - 'workout', 'rest', or 'status' (default: 'status')
 */
function testUnifiedDailyEmail(emailType) {
  const type = emailType || 'status';
  Logger.log("=== UNIFIED DAILY EMAIL TEST (" + type.toUpperCase() + ") ===");
  requireValidConfig();

  // Fetch all required data
  const wellnessRecords = fetchWellnessData(7);
  const wellness = createWellnessSummary(wellnessRecords);
  const fitnessMetrics = fetchFitnessMetrics();
  const goals = fetchUpcomingGoals();
  const targetDate = goals?.available && goals?.primaryGoal ? goals.primaryGoal.date : USER_SETTINGS.TARGET_DATE;
  const phaseInfo = calculateTrainingPhase(targetDate);
  const upcomingDays = fetchUpcomingPlaceholders(7);
  const weekProgress = checkWeekProgress();

  // Check for mid-week adaptation (unified approach)
  let midWeekAdaptation = null;
  const adaptationCheck = checkMidWeekAdaptationNeeded(weekProgress, upcomingDays, wellness, fitnessMetrics);
  if (adaptationCheck.needed) {
    Logger.log("Adaptation needed: " + adaptationCheck.reason);
    // Note: In test mode, we don't apply changes, just show what would happen
  }

  Logger.log("Recovery: " + (wellness.available ? wellness.recoveryStatus : "Unknown"));
  Logger.log("Phase: " + phaseInfo.phaseName + " (" + phaseInfo.weeksOut + " weeks out)");
  Logger.log("Week Progress: " + weekProgress.summary);

  // Build email params based on type
  const emailParams = {
    type: type,
    summary: fitnessMetrics,
    phaseInfo: phaseInfo,
    wellness: wellness,
    weekProgress: weekProgress,
    upcomingDays: upcomingDays,
    midWeekAdaptation: midWeekAdaptation
  };

  // Add type-specific params
  if (type === 'workout') {
    emailParams.workout = {
      type: 'Test_Workout',
      explanation: 'This is a test workout explanation.',
      recommendationReason: 'Testing the unified email with a fake workout.',
      recommendationScore: 8
    };
    emailParams.powerProfile = { available: false };
  } else if (type === 'rest') {
    emailParams.restAssessment = {
      reasoning: 'Test rest day reasoning - your body needs recovery.',
      alternatives: '- Light walk\n- Stretching\n- Foam rolling',
      confidence: 'high'
    };
  } else if (type === 'group_ride') {
    emailParams.cEventName = 'Zwift Crit City Race';

    // Fetch real context for AI advice
    const recentTypes = getRecentWorkoutTypes(7);
    const adaptiveContext = getAdaptiveTrainingContext();

    // Get AI advice on how hard to push
    const groupRideAdvice = generateGroupRideAdvice({
      wellness: wellness,
      tsb: fitnessMetrics.tsb_current || fitnessMetrics.tsb,
      ctl: fitnessMetrics.ctl_90 || fitnessMetrics.ctl,
      atl: fitnessMetrics.atl_7 || fitnessMetrics.atl,
      eventName: emailParams.cEventName,
      eventTomorrow: hasEventTomorrow(),
      eventIn2Days: hasEventInDays(2),
      recentWorkouts: { rides: recentTypes.rides, runs: recentTypes.runs },
      daysSinceLastWorkout: adaptiveContext.gap?.daysSinceLastWorkout || 0,
      phase: phaseInfo?.phaseName
    });

    Logger.log("Group ride intensity: " + (groupRideAdvice?.intensity || 'unknown'));
    Logger.log("AI advice: " + (groupRideAdvice?.advice || 'none'));

    emailParams.groupRideAdvice = groupRideAdvice;
  }

  Logger.log("\n--- Sending Unified Daily Email (" + type + ") ---");
  sendDailyEmail(emailParams);

  Logger.log("\n=== TEST COMPLETE ===");
  Logger.log("Check your inbox for the email.");
}

/**
 * Quick test wrappers for each email type
 */
function testUnifiedEmail_Status() { testUnifiedDailyEmail('status'); }
function testUnifiedEmail_Rest() { testUnifiedDailyEmail('rest'); }
function testUnifiedEmail_Workout() { testUnifiedDailyEmail('workout'); }
function testUnifiedEmail_GroupRide() { testUnifiedDailyEmail('group_ride'); }

/**
 * Test daily workout email structure (does not send email)
 * Verifies the simplified email format with helper functions
 */
function testDailyEmailStructure() {
  Logger.log("=== DAILY EMAIL STRUCTURE TEST ===\n");

  // Fetch all required data
  const wellnessRecords = fetchWellnessData(7);
  const wellness = createWellnessSummary(wellnessRecords);

  const goals = fetchUpcomingGoals();
  const targetDate = goals?.available && goals?.primaryGoal ? goals.primaryGoal.date : USER_SETTINGS.TARGET_DATE;
  const phaseInfo = calculateTrainingPhase(targetDate);
  phaseInfo.goalDescription = goals?.available ? buildGoalDescription(goals) : USER_SETTINGS.GOAL_DESCRIPTION;

  const summary = createAthleteSummary();

  const powerCurve = fetchPowerCurve();
  const powerProfile = analyzePowerProfile(powerCurve);

  const t = getTranslations();

  // Mock workout
  const mockWorkout = {
    type: "Tempo_SweetSpot",
    duration: { min: 60, max: 75 },
    estimatedTSS: 65,
    explanation: "Today focuses on sweet spot training to build sustained power at 88-94% FTP.",
    workoutDescription: "Warmup 10min, 3x12min @ 90% FTP with 4min recovery, cooldown 10min",
    recommendationReason: "Good recovery status and base phase focus on aerobic development"
  };

  Logger.log("--- Input Data ---");
  Logger.log("Phase: " + phaseInfo.phaseName + " (" + phaseInfo.weeksOut + " weeks out)");
  Logger.log("Recovery: " + (wellness.available ? wellness.recoveryStatus : "N/A"));
  Logger.log("TSB: " + (summary.tsb_current?.toFixed(1) || "N/A"));
  Logger.log("Workout: " + mockWorkout.type);

  // Test buildTodaySection
  Logger.log("\n--- buildTodaySection Output ---");
  const todaySection = buildTodaySection(t, mockWorkout, wellness, summary, phaseInfo);
  Logger.log(todaySection);

  // Test buildWorkoutStrategySection
  Logger.log("\n--- buildWorkoutStrategySection Output ---");
  const strategySection = buildWorkoutStrategySection(t, mockWorkout);
  Logger.log(strategySection);

  // Test calculateWorkoutImpact
  Logger.log("\n--- calculateWorkoutImpact ---");
  const impact = calculateWorkoutImpact(summary, mockWorkout);
  if (impact) {
    Logger.log("CTL Change: " + impact.ctlChange.toFixed(2));
    Logger.log("Estimated TSS: " + impact.estimatedTSS);
  } else {
    Logger.log("Impact calculation failed");
  }

  // Show full email preview (without Coach's Note for speed)
  Logger.log("\n--- Full Email Preview ---");
  let preview = t.greeting + "\n\n";
  preview += "[Coach's Note would appear here]\n\n";
  preview += todaySection;
  preview += strategySection;
  preview += "\n" + t.footer;
  Logger.log(preview);

  Logger.log("\n=== DAILY EMAIL TEST COMPLETE ===");
  Logger.log("To send actual email, run generateOptimalZwiftWorkoutsAutoByGemini()");
}

// =========================================================
// WORKOUT IMPACT PREVIEW TESTS
// =========================================================

/**
 * Test the Workout Impact Preview feature
 * Tests projection calculations, TSS estimation, and AI narrative generation
 */
function testWorkoutImpactPreview() {
  Logger.log("=== WORKOUT IMPACT PREVIEW TEST ===\n");

  // 1. Test fitness metrics fetching
  Logger.log("--- Current Fitness Metrics ---");
  const fitnessMetrics = fetchFitnessMetrics();
  Logger.log("CTL: " + fitnessMetrics.ctl);
  Logger.log("ATL: " + fitnessMetrics.atl);
  Logger.log("TSB: " + fitnessMetrics.tsb);
  Logger.log("Ramp Rate: " + fitnessMetrics.rampRate);

  // 2. Test upcoming planned TSS fetching
  Logger.log("\n--- Upcoming Planned Workouts (14 days) ---");
  const upcomingWorkouts = fetchUpcomingPlannedTSS(14);
  upcomingWorkouts.forEach(function(w) {
    if (w.tss > 0 || w.activityType) {
      Logger.log(w.date + ": " + (w.activityType || "Rest") + " TSS=" + w.tss + " (" + w.source + ")");
    }
  });

  // 3. Test projection calculation
  Logger.log("\n--- Fitness Projection (60 TSS workout) ---");
  const testTSS = 60;
  const projections = projectFitnessMetrics(fitnessMetrics.ctl, fitnessMetrics.atl, upcomingWorkouts, 14);
  projections.slice(0, 7).forEach(function(p) {
    Logger.log(p.dayName + " " + p.date + ": TSS=" + p.tss + " -> CTL=" + p.ctl + " ATL=" + p.atl + " TSB=" + p.tsb);
  });

  // 4. Test impact preview generation
  Logger.log("\n--- Impact Preview (comparing with/without workout) ---");
  const impactData = generateWorkoutImpactPreview(testTSS, fitnessMetrics, 14);

  Logger.log("Current state: CTL=" + impactData.currentMetrics.ctl + " TSB=" + impactData.currentMetrics.tsb);
  Logger.log("Today's TSS: " + impactData.todaysTSS);
  Logger.log("Tomorrow TSB delta: " + impactData.impact.tomorrowTSBDelta.toFixed(1));
  Logger.log("2-week CTL gain: +" + impactData.impact.twoWeekCTLDelta.toFixed(1));
  Logger.log("Lowest TSB this week: " + impactData.impact.lowestTSB.toFixed(1));
  Logger.log("Days to positive TSB: " + (impactData.impact.daysToPositiveTSB !== null ? impactData.impact.daysToPositiveTSB : "14+"));

  if (impactData.impact.peakFormWindow.length > 0) {
    Logger.log("Peak form window: " + impactData.impact.peakFormWindow.slice(0, 3).join(", "));
  }

  // 5. Test TSS estimation
  Logger.log("\n--- TSS Estimation by Workout Type ---");
  const testWorkouts = [
    { type: "Recovery_Z1", duration: 45 },
    { type: "Endurance_Z2", duration: 90 },
    { type: "SweetSpot_SST", duration: 60 },
    { type: "Threshold_FTP", duration: 60 },
    { type: "VO2max_Intervals", duration: 60 }
  ];
  testWorkouts.forEach(function(w) {
    const tss = estimateWorkoutTSS(w);
    Logger.log(w.type + " (" + w.duration + "min): ~" + tss + " TSS");
  });

  // 6. Test AI narrative generation
  Logger.log("\n--- AI Impact Preview Narrative ---");
  const goals = fetchUpcomingGoals();
  const phaseInfo = calculateTrainingPhase(goals);

  const aiPreview = generateAIWorkoutImpactPreview(impactData, goals, phaseInfo);

  if (aiPreview.success) {
    Logger.log("AI Enhanced: " + aiPreview.aiEnhanced);
    Logger.log("Summary: " + aiPreview.summary);
    Logger.log("Form Status: " + aiPreview.formStatus);
    Logger.log("Recommendation: " + aiPreview.recommendation);
    Logger.log("\nNarrative:\n" + aiPreview.narrative);
    if (aiPreview.keyInsights && aiPreview.keyInsights.length > 0) {
      Logger.log("\nKey Insights:");
      aiPreview.keyInsights.forEach(function(insight, i) {
        Logger.log("  " + (i + 1) + ". " + insight);
      });
    }
  } else {
    Logger.log("AI preview failed: " + (aiPreview.error || "Unknown error"));
  }

  // 7. Test full email section generation
  Logger.log("\n--- Full Email Section ---");
  const testSummary = {
    ctl_90: fitnessMetrics.ctl,
    atl: fitnessMetrics.atl,
    tsb_current: fitnessMetrics.tsb
  };
  const testWorkout = { type: "SweetSpot_SST", duration: 75 };

  const emailSection = generateWorkoutImpactSection(testSummary, phaseInfo, testWorkout);
  if (emailSection) {
    Logger.log("Email section generated (" + emailSection.length + " chars):");
    Logger.log(emailSection);
  } else {
    Logger.log("Email section was empty (skipped)");
  }

  // 8. Test Weekly Impact Preview
  Logger.log("\n--- Weekly Impact Preview ---");
  const mockWeeklyPlan = [
    { date: formatDateISO(new Date()), dayName: "Today", workoutType: "SweetSpot_SST", estimatedTSS: 55, duration: 60 },
    { date: formatDateISO(new Date(Date.now() + 86400000)), dayName: "Tomorrow", activity: "Rest", estimatedTSS: 0 },
    { date: formatDateISO(new Date(Date.now() + 2*86400000)), dayName: "Day 3", workoutType: "Endurance_Z2", estimatedTSS: 45, duration: 75 },
    { date: formatDateISO(new Date(Date.now() + 3*86400000)), dayName: "Day 4", workoutType: "VO2max_Intervals", estimatedTSS: 65, duration: 60 },
    { date: formatDateISO(new Date(Date.now() + 4*86400000)), dayName: "Day 5", activity: "Rest", estimatedTSS: 0 },
    { date: formatDateISO(new Date(Date.now() + 5*86400000)), dayName: "Day 6", workoutType: "Threshold_FTP", estimatedTSS: 60, duration: 60 },
    { date: formatDateISO(new Date(Date.now() + 6*86400000)), dayName: "Day 7", workoutType: "Recovery_Z1", estimatedTSS: 20, duration: 45 }
  ];

  const weeklyImpact = generateWeeklyImpactPreview(mockWeeklyPlan, fitnessMetrics, 7);

  Logger.log("Weekly projections:");
  weeklyImpact.projections.forEach(function(p) {
    Logger.log("  " + p.dayName + " " + p.date.substring(5) + ": " + p.workoutType + " (TSS " + p.tss + ") -> CTL " + p.ctl + ", TSB " + p.tsb);
  });

  Logger.log("\nWeekly Summary:");
  Logger.log("  Total TSS: " + weeklyImpact.summary.totalTSS);
  Logger.log("  CTL change: " + weeklyImpact.summary.startCTL.toFixed(1) + " -> " + weeklyImpact.summary.endCTL.toFixed(1) + " (" + (weeklyImpact.summary.ctlChange >= 0 ? "+" : "") + weeklyImpact.summary.ctlChange.toFixed(1) + ")");
  Logger.log("  TSB range: " + weeklyImpact.summary.lowestTSB + " to " + weeklyImpact.summary.highestTSB);
  Logger.log("  Sustainable: " + weeklyImpact.summary.sustainableLoad);
  if (weeklyImpact.summary.peakFormDays.length > 0) {
    Logger.log("  Peak form days: " + weeklyImpact.summary.peakFormDays.join(", "));
  }
  if (weeklyImpact.summary.fatigueWarningDays.length > 0) {
    Logger.log("  Fatigue warning days: " + weeklyImpact.summary.fatigueWarningDays.join(", "));
  }

  // 9. Test AI Weekly Narrative
  Logger.log("\n--- AI Weekly Impact Narrative ---");
  const weeklyNarrative = generateAIWeeklyImpactNarrative(weeklyImpact, goals, phaseInfo);

  if (weeklyNarrative.success) {
    Logger.log("AI Enhanced: " + weeklyNarrative.aiEnhanced);
    Logger.log("Week Summary: " + weeklyNarrative.weekSummary);
    Logger.log("Load Assessment: " + weeklyNarrative.loadAssessment);
    Logger.log("Risk Level: " + weeklyNarrative.riskLevel);
    Logger.log("Recommendation: " + weeklyNarrative.recommendation);
    if (weeklyNarrative.keyInsights && weeklyNarrative.keyInsights.length > 0) {
      Logger.log("Key Insights:");
      weeklyNarrative.keyInsights.forEach(function(insight, i) {
        Logger.log("  " + (i + 1) + ". " + insight);
      });
    }
  } else {
    Logger.log("Weekly narrative failed");
  }

  // 10. Test formatted section for email
  Logger.log("\n--- Formatted Weekly Impact Section ---");
  const weeklySection = formatWeeklyImpactSection(weeklyImpact, weeklyNarrative);
  Logger.log(weeklySection);

  Logger.log("\n=== END WORKOUT IMPACT PREVIEW TEST ===");
}
