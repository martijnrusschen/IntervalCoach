/**
 * IntervalCoach - Periodization & AI Decision Tests
 *
 * Tests for AI-driven periodization, phase assessment, and feedback loops.
 * Run these from the Apps Script editor to test periodization features.
 */

// =========================================================
// AI FEATURE TESTS
// =========================================================

/**
 * Test recommendation feedback loop
 */
function testRecommendationFeedback() {
  Logger.log("=== RECOMMENDATION FEEDBACK TEST ===\n");
  requireValidConfig();

  const wellnessRecords = fetchWellnessData(7);
  const wellness = createWellnessSummary(wellnessRecords);

  const goals = fetchUpcomingGoals();
  const targetDate = goals?.available && goals?.primaryGoal ? goals.primaryGoal.date : USER_SETTINGS.TARGET_DATE;
  const phaseInfo = calculateTrainingPhase(targetDate);

  const summary = createAthleteSummary();

  const powerProfile = analyzePowerProfile(fetchPowerCurve());

  Logger.log("--- Current Context ---");
  Logger.log("Phase: " + phaseInfo.phaseName);
  Logger.log("TSB: " + summary.tsb_current.toFixed(1));
  Logger.log("Recovery: " + wellness.recoveryStatus);

  const testType = "VO2max_Short";
  Logger.log("\n--- Testing workout type: " + testType + " ---");

  const dateStr = Utilities.formatDate(new Date(), SYSTEM_SETTINGS.TIMEZONE, "MMdd");
  const duration = { min: 45, max: 60 };

  const prompt = createPrompt(testType, summary, phaseInfo, dateStr, duration, wellness, powerProfile, null);

  const regenerationContext = {
    workoutType: testType,
    recoveryStatus: wellness.available ? wellness.recoveryStatus : 'Unknown',
    tsb: summary.tsb_current,
    phase: phaseInfo.phaseName,
    duration: duration
  };

  Logger.log("Calling generateWorkoutWithFeedback...\n");
  const result = generateWorkoutWithFeedback(prompt, regenerationContext, 2, 6);

  if (result.success) {
    Logger.log("\n--- Result ---");
    Logger.log("Success: true");
    Logger.log("Final Score: " + result.recommendationScore + "/10");
    Logger.log("Reason: " + result.recommendationReason);
  } else {
    Logger.log("Error: " + result.error);
  }

  Logger.log("\n=== TEST COMPLETE ===");
}

/**
 * Test AI-driven periodization
 */
function testAIPeriodization() {
  logTestHeader("AI PERIODIZATION");

  const ctx = setupTestContext();
  const goalDescription = ctx.goals?.available ? buildGoalDescription(ctx.goals) : USER_SETTINGS.GOAL_DESCRIPTION;
  const targetDate = ctx.goals?.primaryGoal?.date || USER_SETTINGS.TARGET_DATE;

  const powerProfile = analyzePowerProfile(fetchPowerCurve());

  Logger.log("--- Current Context ---");
  Logger.log("Target: " + targetDate);
  Logger.log("CTL: " + ctx.ctl.toFixed(1) + " | TSB: " + ctx.tsb.toFixed(1));
  Logger.log("Recovery: " + ctx.wellness.recoveryStatus);

  // Date-based phase (already calculated in ctx, but show separately for comparison)
  Logger.log("\n--- Date-Based Phase ---");
  Logger.log("Phase: " + ctx.phase + " (" + ctx.phaseInfo.weeksOut + " weeks out)");

  // AI-enhanced phase
  Logger.log("\n--- AI-Enhanced Phase ---");
  const phaseContext = {
    goalDescription: goalDescription,
    goals: ctx.goals,
    ctl: ctx.ctl,
    rampRate: ctx.fitness.rampRate,
    currentEftp: powerProfile.available ? powerProfile.currentEftp : null,
    targetFtp: powerProfile.available ? powerProfile.manualFTP : null,
    tsb: ctx.tsb,
    z5Recent: ctx.fitness.z5_recent_total,
    wellnessAverages: ctx.wellness.averages,
    recoveryStatus: ctx.wellness.recoveryStatus || 'Unknown',
    recentWorkouts: ctx.recentWorkouts,
    enableAI: true
  };

  const aiPhase = calculateTrainingPhase(targetDate, phaseContext);

  Logger.log("Phase: " + aiPhase.phaseName);
  Logger.log("AI Enhanced: " + aiPhase.aiEnhanced);
  if (aiPhase.aiEnhanced) {
    Logger.log("Reasoning: " + aiPhase.reasoning);
    if (aiPhase.phaseOverride) {
      Logger.log("*** PHASE OVERRIDE ***");
    }
  }

  Logger.log("\n=== TEST COMPLETE ===");
}
