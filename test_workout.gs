/**
 * IntervalCoach - Workout Selection & Analysis Tests
 *
 * Tests for workout type selection, AI workout decisions, and post-workout analysis.
 * Run these from the Apps Script editor to test workout features.
 */

// =========================================================
// COACHING & WORKOUT TESTS
// =========================================================

/**
 * Test personalized coaching note generation
 */
function testCoachingNote() {
  Logger.log("=== COACHING NOTE TEST ===");

  const wellnessRecords = fetchWellnessData(7);
  const wellness = createWellnessSummary(wellnessRecords);

  const goals = fetchUpcomingGoals();
  const targetDate = goals?.available && goals?.primaryGoal ? goals.primaryGoal.date : USER_SETTINGS.TARGET_DATE;
  const phaseInfo = calculateTrainingPhase(targetDate);
  phaseInfo.goalDescription = goals?.available ? buildGoalDescription(goals) : USER_SETTINGS.GOAL_DESCRIPTION;

  const sheet = SpreadsheetApp.openById(USER_SETTINGS.SPREADSHEET_ID).getSheetByName(USER_SETTINGS.SHEET_NAME);
  const data = sheet.getDataRange().getValues();
  data.shift();
  const summary = createAthleteSummary(data);

  const powerCurve = fetchPowerCurve();
  const powerProfile = analyzePowerProfile(powerCurve);

  const mockWorkout = {
    type: "Tempo_SweetSpot",
    recommendationReason: "Good recovery status and base phase focus on aerobic development"
  };

  Logger.log("--- Input Data ---");
  Logger.log("Phase: " + phaseInfo.phaseName + " (" + phaseInfo.weeksOut + " weeks out)");
  Logger.log("Recovery: " + wellness.recoveryStatus);
  Logger.log("TSB: " + summary.tsb_current.toFixed(1));
  Logger.log("Workout: " + mockWorkout.type);

  Logger.log("\n--- Generated Coaching Note ---");
  const note = generatePersonalizedCoachingNote(summary, phaseInfo, mockWorkout, wellness, powerProfile);

  if (note) {
    Logger.log(note);
  } else {
    Logger.log("(Failed to generate coaching note)");
  }

  Logger.log("\n=== TEST COMPLETE ===");
}

/**
 * Test workout type selection logic
 */
function testWorkoutSelection() {
  Logger.log("=== WORKOUT SELECTION TEST ===\n");

  const wellnessRecords = fetchWellnessData(7);
  const wellness = createWellnessSummary(wellnessRecords);

  const goals = fetchUpcomingGoals();
  const targetDate = goals?.available && goals?.primaryGoal ? goals.primaryGoal.date : USER_SETTINGS.TARGET_DATE;
  const phaseInfo = calculateTrainingPhase(targetDate);

  const sheet = SpreadsheetApp.openById(USER_SETTINGS.SPREADSHEET_ID).getSheetByName(USER_SETTINGS.SHEET_NAME);
  const data = sheet.getDataRange().getValues();
  data.shift();
  const summary = createAthleteSummary(data);

  const recentTypes = getRecentWorkoutTypes(7);
  const eventTomorrow = hasEventTomorrow();
  const eventYesterday = hasEventYesterday();

  Logger.log("--- Current Context ---");
  Logger.log("Phase: " + phaseInfo.phaseName + " (" + phaseInfo.weeksOut + " weeks out)");
  Logger.log("TSB: " + summary.tsb_current.toFixed(1));
  Logger.log("Recovery: " + wellness.recoveryStatus + (wellness.today?.recovery ? " (" + wellness.today.recovery + "%)" : ""));
  Logger.log("Event Tomorrow: " + (eventTomorrow.hasEvent ? eventTomorrow.category + (eventTomorrow.eventName ? " - " + eventTomorrow.eventName : "") : "None"));
  Logger.log("Event Yesterday: " + (eventYesterday.hadEvent ? eventYesterday.category + (eventYesterday.eventName ? " - " + eventYesterday.eventName : "") : "None"));
  Logger.log("Recent rides: " + (recentTypes.rides.length > 0 ? recentTypes.rides.join(", ") : "None"));
  Logger.log("Recent runs: " + (recentTypes.runs.length > 0 ? recentTypes.runs.join(", ") : "None"));

  // Fetch zone progression
  Logger.log("\n--- Zone Progression Context ---");
  const zoneProgression = getZoneProgression();
  if (zoneProgression && zoneProgression.available) {
    Logger.log("Zone levels:");
    for (const [zone, data] of Object.entries(zoneProgression.progression)) {
      Logger.log("  " + zone + ": " + data.level.toFixed(1) + " (" + data.trend + ")");
    }
    Logger.log("Focus areas: " + zoneProgression.focusAreas.join(", "));
  } else {
    Logger.log("Zone progression not available");
  }

  // Test with real data - Ride (no AI)
  Logger.log("\n--- Ride Selection (Fallback) ---");
  const rideSelection = selectWorkoutTypes({
    wellness: wellness,
    recentWorkouts: { types: recentTypes, lastIntensity: getLastWorkoutIntensity(recentTypes) },
    activityType: "Ride",
    phaseInfo: phaseInfo,
    tsb: summary.tsb_current,
    eventTomorrow: eventTomorrow,
    eventYesterday: eventYesterday,
    enableAI: false
  });
  Logger.log("Max intensity: " + rideSelection.maxIntensity);
  Logger.log("Reason: " + rideSelection.reason);
  Logger.log("Recommended types: " + rideSelection.types.slice(0, 3).join(", "));

  // Test with AI enabled + zone progression
  Logger.log("\n--- Ride Selection (AI + Zone Progression) ---");
  const aiRideSelection = selectWorkoutTypes({
    wellness: wellness,
    recentWorkouts: { types: recentTypes, lastIntensity: getLastWorkoutIntensity(recentTypes) },
    activityType: "Ride",
    phaseInfo: phaseInfo,
    tsb: summary.tsb_current,
    eventTomorrow: eventTomorrow,
    eventYesterday: eventYesterday,
    zoneProgression: zoneProgression,
    enableAI: true
  });
  Logger.log("Selected type: " + aiRideSelection.types[0]);
  Logger.log("Max intensity: " + aiRideSelection.maxIntensity);
  Logger.log("Reason: " + aiRideSelection.reason);
  if (aiRideSelection.zoneNote) {
    Logger.log("Zone note: " + aiRideSelection.zoneNote);
  }

  Logger.log("\n=== TEST COMPLETE ===");
}

/**
 * Test AI-driven workout type selection
 */
function testAIWorkoutDecision() {
  Logger.log("=== AI WORKOUT DECISION TEST ===");
  requireValidConfig();

  const summary = fetchFitnessMetrics();
  const wellnessRecords = fetchWellnessData();
  const wellness = createWellnessSummary(wellnessRecords);
  const powerProfile = analyzePowerProfile(fetchPowerCurve());
  const recentTypes = getRecentWorkoutTypes(7);

  // Get 2-week stimulus history for variety check
  const twoWeekHistory = getTwoWeekWorkoutHistory();

  const goalsResult = fetchIcuApi("/athlete/" + USER_SETTINGS.ATHLETE_ID + "/goals");
  const goals = goalsResult.success && goalsResult.data ? {
    available: true,
    allGoals: goalsResult.data,
    primaryGoal: goalsResult.data.find(g => g.priority === 'A'),
    secondaryGoals: goalsResult.data.filter(g => g.priority === 'B')
  } : { available: false };

  const ctl = summary.ctl_90 || summary.ctl || 0;
  const tsb = summary.tsb_current || summary.tsb || 0;

  const targetDate = goals.primaryGoal ? goals.primaryGoal.date :
    (USER_SETTINGS.TARGET_DATE || formatDateISO(new Date(Date.now() + 90 * 24 * 60 * 60 * 1000)));
  const phaseInfo = calculateTrainingPhase(targetDate, {
    goalDescription: goals.primaryGoal ? goals.primaryGoal.name : "General fitness",
    goals: goals,
    ctl: ctl,
    tsb: tsb,
    enableAI: true
  });

  Logger.log("\n--- Current State ---");
  Logger.log("CTL: " + ctl.toFixed(1) + " | TSB: " + tsb.toFixed(1));
  Logger.log("Phase: " + phaseInfo.phaseName);
  Logger.log("Recovery: " + (wellness.available ? wellness.recoveryStatus : "Unknown"));

  // Log stimulus variety info
  Logger.log("\n--- Stimulus Variety (2 weeks) ---");
  Logger.log("Recent ride types: " + (twoWeekHistory.rideTypes.length > 0 ? twoWeekHistory.rideTypes.join(", ") : "None"));
  const rideStimuli = twoWeekHistory.recentStimuli.ride || [];
  const rideStimulusCounts = twoWeekHistory.stimulusCounts.ride || {};
  if (rideStimuli.length > 0) {
    const stimulusDisplay = rideStimuli.map(s => s + " (" + (rideStimulusCounts[s] || 0) + "x)").join(", ");
    Logger.log("Ride stimulus exposure: " + stimulusDisplay);
  } else {
    Logger.log("Ride stimulus exposure: None tracked");
  }

  // AI selection with stimulus data
  Logger.log("\n--- AI Workout Decision ---");
  const aiSelection = selectWorkoutTypes({
    wellness: wellness,
    recentWorkouts: { types: recentTypes, lastIntensity: getLastWorkoutIntensity(recentTypes) },
    activityType: "Ride",
    phaseInfo: phaseInfo,
    tsb: tsb,
    eventTomorrow: false,
    eventYesterday: false,
    ctl: ctl,
    duration: 60,
    goals: goals,
    powerProfile: powerProfile,
    recentStimuli: twoWeekHistory.recentStimuli,
    stimulusCounts: twoWeekHistory.stimulusCounts,
    enableAI: true
  });

  Logger.log("Selected: " + aiSelection.types[0]);
  Logger.log("Reason: " + aiSelection.reason);

  // Rule-based comparison
  Logger.log("\n--- Rule-Based (comparison) ---");
  const ruleSelection = selectWorkoutTypes({
    wellness: wellness,
    recentWorkouts: { types: recentTypes, lastIntensity: getLastWorkoutIntensity(recentTypes) },
    activityType: "Ride",
    phaseInfo: phaseInfo,
    tsb: tsb,
    eventTomorrow: false,
    eventYesterday: false,
    enableAI: false
  });

  Logger.log("Selected: " + ruleSelection.types[0]);

  if (aiSelection.types[0] !== ruleSelection.types[0]) {
    Logger.log("*** DIFFERENT DECISIONS ***");
  }

  Logger.log("\n=== TEST COMPLETE ===");
}

/**
 * Test post-workout analysis feature
 * Tests the hourly check, AI analysis, and email sending
 */
function testPostWorkoutAnalysis() {
  Logger.log("=== TESTING POST-WORKOUT ANALYSIS ===\n");

  requireValidConfig();

  // Test 1: Check for completed workouts (should find recent activities)
  Logger.log("--- Test 1: Check for Completed Workouts ---");
  try {
    checkForCompletedWorkouts();
    Logger.log("OK checkForCompletedWorkouts() executed successfully");
  } catch (e) {
    Logger.log("X Error in checkForCompletedWorkouts(): " + e.toString());
  }

  // Test 2: Fetch a recent activity and analyze it manually
  Logger.log("\n--- Test 2: Manual Analysis of Recent Activity ---");

  const today = new Date();
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(today.getDate() - 7);

  const endpoint = `/athlete/0/activities?oldest=${formatDateISO(sevenDaysAgo)}&newest=${formatDateISO(today)}`;
  const result = fetchIcuApi(endpoint);

  if (!result.success) {
    Logger.log("X Error fetching activities: " + result.error);
    return;
  }

  const activities = result.data;
  if (!activities || activities.length === 0) {
    Logger.log("! No activities found in last 7 days - cannot test analysis");
    Logger.log("Tip: Complete a workout and try again in an hour");
    return;
  }

  // Find first real workout (with TSS > 0)
  const realWorkout = activities.find(a => a.icu_training_load && a.icu_training_load > 0 && a.moving_time > 300);

  if (!realWorkout) {
    Logger.log("! No real workouts found (only placeholders) - cannot test analysis");
    return;
  }

  Logger.log("Testing with activity: " + realWorkout.name);
  Logger.log("  Type: " + realWorkout.type);
  Logger.log("  Date: " + realWorkout.start_date_local);
  Logger.log("  TSS: " + realWorkout.icu_training_load);
  Logger.log("  Duration: " + Math.round(realWorkout.moving_time / 60) + " min");

  // Fetch context data
  const wellnessRecords = fetchWellnessData(7);
  const wellness = createWellnessSummary(wellnessRecords);
  const fitness = fetchFitnessMetrics();

  const isRun = realWorkout.type === "Run";
  let powerProfile = { available: false };
  let runningData = { available: false };

  if (isRun) {
    runningData = fetchRunningData();
  } else {
    const powerCurve = fetchPowerCurve();
    const goals = fetchUpcomingGoals();
    powerProfile = analyzePowerProfile(powerCurve, goals);
  }

  // Test 3: AI Analysis
  Logger.log("\n--- Test 3: AI Analysis ---");
  const analysis = generatePostWorkoutAnalysis(realWorkout, wellness, fitness, powerProfile, runningData);

  if (!analysis || !analysis.success) {
    Logger.log("X AI analysis failed: " + (analysis?.error || "Unknown error"));
    return;
  }

  Logger.log("OK AI analysis successful");
  Logger.log("\n[Analysis Results]");
  Logger.log("  Effectiveness: " + analysis.effectiveness + "/10");
  Logger.log("  Effectiveness Reason: " + analysis.effectivenessReason);
  Logger.log("  Difficulty Match: " + analysis.difficultyMatch);
  Logger.log("  Difficulty Reason: " + analysis.difficultyReason);
  Logger.log("  Workout Stimulus: " + analysis.workoutStimulus + " (" + analysis.stimulusQuality + ")");

  if (analysis.recoveryImpact) {
    Logger.log("\n[Recovery Impact]");
    Logger.log("  Severity: " + analysis.recoveryImpact.severity);
    Logger.log("  Estimated Recovery: " + analysis.recoveryImpact.estimatedRecoveryHours + " hours");
    Logger.log("  Next Workout: " + analysis.recoveryImpact.nextWorkoutAdjustment);
  }

  Logger.log("\n[Key Insight]");
  Logger.log("  " + analysis.keyInsight);

  if (analysis.performanceHighlights && analysis.performanceHighlights.length > 0) {
    Logger.log("\n[Performance Highlights]");
    analysis.performanceHighlights.forEach(h => Logger.log("  - " + h));
  }

  if (analysis.trainingAdjustments) {
    Logger.log("\n[Training Adjustments]");
    Logger.log("  Needed: " + analysis.trainingAdjustments.needed);
    if (analysis.trainingAdjustments.needed) {
      Logger.log("  FTP Calibration: " + analysis.trainingAdjustments.ftpCalibration);
      Logger.log("  Future Intensity: " + analysis.trainingAdjustments.futureIntensity);
      Logger.log("  Reasoning: " + analysis.trainingAdjustments.reasoning);
    }
  }

  if (analysis.congratsMessage) {
    Logger.log("\n[Congrats Message]");
    Logger.log("  " + analysis.congratsMessage);
  }

  Logger.log("\nConfidence: " + analysis.confidence);

  // Test 4: Storage
  Logger.log("\n--- Test 4: Storage ---");
  try {
    storeWorkoutAnalysis(realWorkout, analysis);
    Logger.log("OK Analysis stored successfully");

    // Retrieve and verify
    const lastAnalysis = getLastWorkoutAnalysis();
    if (lastAnalysis && lastAnalysis.activityName === realWorkout.name) {
      Logger.log("OK Retrieved stored analysis: " + lastAnalysis.activityName);
    } else {
      Logger.log("X Failed to retrieve stored analysis");
    }

    const history = getWorkoutAnalysisHistory(7);
    Logger.log("OK Analysis history: " + history.length + " records");
  } catch (e) {
    Logger.log("X Error storing analysis: " + e.toString());
  }

  // Test 5: Email Sending
  Logger.log("\n--- Test 5: Email Sending ---");
  Logger.log("Sending post-workout analysis email...");

  try {
    sendPostWorkoutAnalysisEmail(realWorkout, analysis, wellness, fitness, powerProfile, runningData);
    Logger.log("OK Email sent successfully to " + USER_SETTINGS.EMAIL_TO);
  } catch (e) {
    Logger.log("X Error sending email: " + e.toString());
  }

  Logger.log("\n=== TEST COMPLETE ===");
  Logger.log("\nNext steps:");
  Logger.log("1. Check your email for the post-workout analysis");
  Logger.log("2. Set up hourly trigger: ScriptApp.newTrigger('checkForCompletedWorkouts').timeBased().everyHours(1).create()");
  Logger.log("3. Complete a workout and wait 1 hour to test automatic analysis");
}
