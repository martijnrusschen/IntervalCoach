/**
 * IntervalCoach - Workout Selection & Analysis Tests
 *
 * Tests for workout type selection, AI workout decisions, and post-workout analysis.
 * Run these from the Apps Script editor to test workout features.
 */

// =========================================================
// MULTI-WORKOUT OPTIONS TEST
// =========================================================

/**
 * Test Multi-Workout Option Comparison
 * Generates 3 workout options and shows scores for each
 */
function testMultiWorkoutOptions() {
  Logger.log("=== MULTI-WORKOUT OPTIONS TEST ===");
  Logger.log("Testing: Generate 3 workout options with scores\n");
  requireValidConfig();

  // Gather context
  const summary = createAthleteSummary();
  const wellnessRecords = fetchWellnessData(7);
  const wellness = createWellnessSummary(wellnessRecords);
  const powerCurve = fetchPowerCurve();
  const powerProfile = analyzePowerProfile(powerCurve);

  const goals = fetchUpcomingGoals();
  const targetDate = goals?.primaryGoal?.date || USER_SETTINGS.TARGET_DATE;
  const phaseInfo = calculateTrainingPhase(targetDate, { enableAI: false });
  phaseInfo.goalDescription = goals?.available ? buildGoalDescription(goals) : USER_SETTINGS.GOAL_DESCRIPTION;

  const twoWeekHistory = getTwoWeekWorkoutHistory();

  // Get recent workout types
  const recentTypes = getRecentWorkoutTypes(7);

  Logger.log("--- Context ---");
  Logger.log("Phase: " + phaseInfo.phaseName);
  Logger.log("TSB: " + (summary.tsb_current || 0).toFixed(1));
  Logger.log("Recovery: " + (wellness.available ? wellness.recoveryStatus : "N/A"));

  // Call selectWorkoutTypes to get 3 options
  Logger.log("\n--- AI Workout Type Selection (3 options) ---");
  const typeSelection = selectWorkoutTypes({
    wellness: wellness,
    recentWorkouts: { types: recentTypes, lastIntensity: getLastWorkoutIntensity(recentTypes) },
    activityType: "Ride",
    phaseInfo: phaseInfo,
    tsb: summary.tsb_current,
    ctl: summary.ctl_90 || summary.ctl,
    eventTomorrow: { hasEvent: false },
    eventYesterday: { hadEvent: false },
    duration: { min: 60, max: 75 },
    recentStimuli: twoWeekHistory.recentStimuli,
    stimulusCounts: twoWeekHistory.stimulusCounts,
    enableAI: true
  });

  if (!typeSelection.options || typeSelection.options.length === 0) {
    Logger.log("ERROR: No workout options returned");
    Logger.log("Fallback type: " + (typeSelection.types ? typeSelection.types[0] : "none"));
    return;
  }

  Logger.log("\n--- Options Summary ---");
  typeSelection.options.forEach(function(opt, idx) {
    Logger.log((idx + 1) + ". " + opt.workoutType + " - Pre-score: " + opt.score + "/10");
    Logger.log("   " + opt.whyThisWorkout);
  });

  Logger.log("\nOverall reasoning: " + typeSelection.reason);

  // Now generate complete workouts for each option
  Logger.log("\n--- Generating Complete Workouts ---");
  const dateStr = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "MMdd");

  const multiResult = generateMultipleWorkoutOptions({
    options: typeSelection.options,
    createPrompt: createPrompt,
    promptParams: {
      summary: summary,
      phaseInfo: phaseInfo,
      dateStr: dateStr,
      duration: { min: 60, max: 75 },
      wellness: wellness,
      powerProfileOrRunningData: powerProfile,
      adaptiveContext: null,
      crossSportEquivalency: null,
      lastWorkoutAnalysis: null,
      warnings: {}
    },
    minScore: 6
  });

  if (!multiResult.success) {
    Logger.log("ERROR: " + multiResult.error);
    return;
  }

  Logger.log("\n=== FINAL RESULTS ===");
  multiResult.allOptions.forEach(function(opt, idx) {
    const status = opt.success ? (opt.finalScore >= 6 ? "✓" : "⚠") : "✗";
    const selected = opt.workoutType === multiResult.selectedWorkout.workoutType ? " ◀ SELECTED" : "";
    Logger.log(status + " " + opt.workoutType + ": " + opt.finalScore + "/10" + selected);
  });

  Logger.log("\n✓ Auto-selected: " + multiResult.selectedWorkout.workoutType);
  Logger.log("  Score: " + multiResult.selectedWorkout.finalScore + "/10");
  Logger.log("  Reason: " + multiResult.selectedWorkout.recommendationReason);

  Logger.log("\n=== TEST COMPLETE ===");
}

// =========================================================
// ANTI-MONOTONY ENGINE TEST
// =========================================================

/**
 * Test Anti-Monotony Engine by generating an Endurance workout
 * Verifies: varied cadence, max 5min blocks, engaging structure
 */
function testAntiMonotonyWorkout() {
  Logger.log("=== ANTI-MONOTONY ENGINE TEST ===");
  Logger.log("Testing: Endurance workout should have varied structure\n");
  requireValidConfig();

  // Gather context
  const summary = createAthleteSummary();
  const wellnessRecords = fetchWellnessData(7);
  const wellness = createWellnessSummary(wellnessRecords);
  const powerCurve = fetchPowerCurve();
  const powerProfile = analyzePowerProfile(powerCurve);

  const goals = fetchUpcomingGoals();
  const targetDate = goals?.primaryGoal?.date || USER_SETTINGS.TARGET_DATE;
  const phaseInfo = calculateTrainingPhase(targetDate, { enableAI: false });
  phaseInfo.goalDescription = goals?.available ? buildGoalDescription(goals) : USER_SETTINGS.GOAL_DESCRIPTION;

  const dateStr = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "MMdd");

  // Test with Endurance_Z2 - most likely to be boring without anti-monotony
  const workoutType = "Endurance_Z2";
  const duration = { min: 60, max: 75 };

  Logger.log("--- Generating " + workoutType + " workout ---");
  Logger.log("Duration: " + duration.min + "-" + duration.max + " min");
  Logger.log("Phase: " + phaseInfo.phaseName);
  Logger.log("Recovery: " + (wellness.available ? wellness.recoveryStatus : "N/A"));

  // Create prompt with anti-monotony rules
  const prompt = createPrompt(
    workoutType,
    summary,
    phaseInfo,
    dateStr,
    duration,
    wellness,
    powerProfile,
    null,  // adaptiveContext
    null,  // crossSportEquivalency
    null,  // lastWorkoutAnalysis
    {}     // warnings
  );

  // Call Gemini
  Logger.log("\n--- Calling Gemini API ---");
  const response = callGeminiAPI(prompt);

  if (!response.success) {
    Logger.log("ERROR: " + response.error);
    return;
  }

  Logger.log("\n--- AI Response ---");
  Logger.log("Recommendation Score: " + response.recommendationScore + "/10");
  Logger.log("Reason: " + response.recommendationReason);

  // Analyze the generated ZWO for anti-monotony compliance
  Logger.log("\n--- ANTI-MONOTONY ANALYSIS ---");
  const xml = response.xml || "";

  // Check for varied cadence
  const cadenceMatches = xml.match(/Cadence="(\d+)"/g) || [];
  const uniqueCadences = [...new Set(cadenceMatches.map(m => m.match(/\d+/)[0]))];
  Logger.log("Cadence values used: " + (uniqueCadences.length > 0 ? uniqueCadences.join(", ") + " RPM" : "NONE FOUND"));
  Logger.log("Cadence variety: " + (uniqueCadences.length >= 2 ? "✓ PASS (multiple)" : "✗ FAIL (needs variation)"));

  // Check for steady state durations (exclude warmup/cooldown which can be longer)
  const steadyStateDurations = [];
  const steadyStateRegex = /<SteadyState[^>]*Duration="(\d+)"/g;
  let match;
  while ((match = steadyStateRegex.exec(xml)) !== null) {
    steadyStateDurations.push(parseInt(match[1]));
  }
  const maxSteadyDuration = Math.max(...steadyStateDurations, 0);
  Logger.log("Max SteadyState duration: " + maxSteadyDuration + "s (" + (maxSteadyDuration/60).toFixed(1) + " min)");
  Logger.log("Block duration: " + (maxSteadyDuration <= 300 ? "✓ PASS (≤5min)" : "✗ FAIL (>5min SteadyState blocks)"));

  // Also check warmup/cooldown (allowed to be longer)
  const warmupMatch = xml.match(/<Warmup[^>]*Duration="(\d+)"/);
  const cooldownMatch = xml.match(/<Cooldown[^>]*Duration="(\d+)"/);
  if (warmupMatch) Logger.log("Warmup duration: " + (parseInt(warmupMatch[1])/60).toFixed(1) + " min (OK - exempt from 5min rule)");
  if (cooldownMatch) Logger.log("Cooldown duration: " + (parseInt(cooldownMatch[1])/60).toFixed(1) + " min (OK - exempt from 5min rule)");

  // Count segment variety
  const steadyStates = (xml.match(/<SteadyState/g) || []).length;
  const ramps = (xml.match(/<Ramp/g) || []).length;
  const intervals = (xml.match(/<IntervalsT/g) || []).length;
  Logger.log("Segment types: " + steadyStates + " SteadyState, " + ramps + " Ramp, " + intervals + " Intervals");

  // Check for text events (engagement)
  const textEvents = (xml.match(/<TextEvent/g) || []).length;
  Logger.log("Text events (motivation): " + textEvents);

  // Overall assessment
  Logger.log("\n--- OVERALL ASSESSMENT ---");
  const cadencePass = uniqueCadences.length >= 2;
  const durationPass = maxSteadyDuration <= 300;
  const varietyPass = (steadyStates + ramps + intervals) >= 4;

  if (cadencePass && durationPass && varietyPass) {
    Logger.log("✓ ANTI-MONOTONY: PASS - Workout has good variety!");
  } else {
    Logger.log("✗ ANTI-MONOTONY: NEEDS IMPROVEMENT");
    if (!cadencePass) Logger.log("  - Add more cadence variation");
    if (!durationPass) Logger.log("  - Break up long blocks (>5min)");
    if (!varietyPass) Logger.log("  - Add more segment variety");
  }

  // Log full XML for inspection
  Logger.log("\n--- GENERATED ZWO (first 2000 chars) ---");
  Logger.log(xml.substring(0, 2000));

  Logger.log("\n=== TEST COMPLETE ===");
}

// =========================================================
// COACHING & WORKOUT TESTS
// =========================================================

/**
 * Test personalized coaching note generation
 */
function testCoachingNote() {
  logTestHeader("COACHING NOTE");

  const ctx = setupTestContext({ includePowerProfile: true });
  ctx.phaseInfo.goalDescription = ctx.goals?.available ? buildGoalDescription(ctx.goals) : USER_SETTINGS.GOAL_DESCRIPTION;

  const mockWorkout = {
    type: "Tempo_SweetSpot",
    recommendationReason: "Good recovery status and base phase focus on aerobic development"
  };

  Logger.log("--- Input Data ---");
  Logger.log("Phase: " + ctx.phase + " (" + ctx.phaseInfo.weeksOut + " weeks out)");
  Logger.log("Recovery: " + ctx.wellness.recoveryStatus);
  Logger.log("TSB: " + ctx.tsb.toFixed(1));
  Logger.log("Workout: " + mockWorkout.type);

  Logger.log("\n--- Generated Coaching Note ---");
  const note = generatePersonalizedCoachingNote(ctx.fitness, ctx.phaseInfo, mockWorkout, ctx.wellness, ctx.powerAnalysis);

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
  logTestHeader("WORKOUT SELECTION");

  const ctx = setupTestContext();

  Logger.log("--- Current Context ---");
  Logger.log("Phase: " + ctx.phase + " (" + ctx.phaseInfo.weeksOut + " weeks out)");
  Logger.log("TSB: " + ctx.tsb.toFixed(1));
  Logger.log("Recovery: " + ctx.wellness.recoveryStatus + (ctx.wellness.today?.recovery ? " (" + ctx.wellness.today.recovery + "%)" : ""));
  Logger.log("Event Tomorrow: " + (ctx.eventTomorrow.hasEvent ? ctx.eventTomorrow.category + (ctx.eventTomorrow.eventName ? " - " + ctx.eventTomorrow.eventName : "") : "None"));
  Logger.log("Event Yesterday: " + (ctx.eventYesterday.hadEvent ? ctx.eventYesterday.category + (ctx.eventYesterday.eventName ? " - " + ctx.eventYesterday.eventName : "") : "None"));
  Logger.log("Recent rides: " + (ctx.recentTypes.rides.length > 0 ? ctx.recentTypes.rides.join(", ") : "None"));
  Logger.log("Recent runs: " + (ctx.recentTypes.runs.length > 0 ? ctx.recentTypes.runs.join(", ") : "None"));

  // Zone progression from context
  Logger.log("\n--- Zone Progression Context ---");
  if (ctx.zoneProgression?.available) {
    Logger.log("Zone levels:");
    for (const [zone, data] of Object.entries(ctx.zoneProgression.progression)) {
      Logger.log("  " + zone + ": " + data.level.toFixed(1) + " (" + data.trend + ")");
    }
    Logger.log("Focus areas: " + ctx.zoneProgression.focusAreas.join(", "));
  } else {
    Logger.log("Zone progression not available");
  }

  // Test with real data - Ride (no AI)
  Logger.log("\n--- Ride Selection (Fallback) ---");
  const rideSelection = selectWorkoutTypes({
    wellness: ctx.wellness,
    recentWorkouts: ctx.recentWorkouts,
    activityType: "Ride",
    phaseInfo: ctx.phaseInfo,
    tsb: ctx.tsb,
    eventTomorrow: ctx.eventTomorrow,
    eventYesterday: ctx.eventYesterday,
    enableAI: false
  });
  Logger.log("Max intensity: " + rideSelection.maxIntensity);
  Logger.log("Reason: " + rideSelection.reason);
  Logger.log("Recommended types: " + rideSelection.types.slice(0, 3).join(", "));

  // Test with AI enabled + zone progression
  Logger.log("\n--- Ride Selection (AI + Zone Progression) ---");
  const aiRideSelection = selectWorkoutTypes({
    wellness: ctx.wellness,
    recentWorkouts: ctx.recentWorkouts,
    activityType: "Ride",
    phaseInfo: ctx.phaseInfo,
    tsb: ctx.tsb,
    eventTomorrow: ctx.eventTomorrow,
    eventYesterday: ctx.eventYesterday,
    zoneProgression: ctx.zoneProgression,
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

  // Test 5: Email Sending (with full context)
  Logger.log("\n--- Test 5: Email Sending ---");
  Logger.log("Fetching additional context for enhanced email...");

  // Fetch additional context for enhanced email
  const goals = fetchUpcomingGoals();
  const phaseInfo = calculateTrainingPhase(goals?.primaryGoal?.date || USER_SETTINGS.TARGET_DATE);
  const weekProgress = checkWeekProgress();
  const recentHistory = fetchRecentActivitySummary(14);

  // Get next planned workout (skip today, look at next 5 days)
  const upcomingDays = fetchUpcomingPlaceholders(6);
  const nextWorkout = upcomingDays.slice(1).find(d => d.activityType || d.hasEvent);

  Logger.log("  Week Progress: " + weekProgress.summary);
  Logger.log("  Recent History: " + recentHistory.totalActivities + " activities in last 14 days");
  Logger.log("  Phase: " + phaseInfo.phaseName + " (" + phaseInfo.weeksOut + " weeks out)");
  Logger.log("  Next Workout: " + (nextWorkout ? (nextWorkout.placeholderName || nextWorkout.activityType || nextWorkout.eventName) + " on " + nextWorkout.dayName : "None"));

  Logger.log("Sending post-workout analysis email...");

  try {
    sendPostWorkoutAnalysisEmail(realWorkout, analysis, wellness, fitness, powerProfile, runningData, {
      goals: goals,
      phaseInfo: phaseInfo,
      weekProgress: weekProgress,
      recentHistory: recentHistory,
      nextWorkout: nextWorkout
    });
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

// =========================================================
// POST-WORKOUT → NEXT DAY TEST
// =========================================================

/**
 * Test that yesterday's workout analysis is passed to today's workout prompt
 */
function testYesterdaysFeedback() {
  Logger.log("=== YESTERDAY'S FEEDBACK → TODAY'S WORKOUT TEST ===\n");
  requireValidConfig();

  // Get last workout analysis
  Logger.log("--- Last Workout Analysis ---");
  const lastAnalysis = getLastWorkoutAnalysis();

  if (!lastAnalysis) {
    Logger.log("No stored workout analysis found.");
    Logger.log("Run a workout and analyze it first (checkForCompletedWorkouts)");
    Logger.log("Or run testPostWorkoutAnalysis to generate test data.");
    return;
  }

  Logger.log("Activity: " + lastAnalysis.activityName);
  Logger.log("Date: " + lastAnalysis.date);
  Logger.log("Difficulty Match: " + (lastAnalysis.difficultyMatch || 'not set'));
  Logger.log("Effectiveness: " + (lastAnalysis.effectiveness || 'not set') + "/10");
  Logger.log("Stimulus: " + (lastAnalysis.stimulus || 'not set'));
  Logger.log("FTP Calibration: " + (lastAnalysis.ftpCalibration || 'none'));
  if (lastAnalysis.keyInsight) {
    Logger.log("Key Insight: " + lastAnalysis.keyInsight);
  }

  // Calculate days since
  const daysSince = Math.floor((new Date() - new Date(lastAnalysis.date)) / (1000 * 60 * 60 * 24));
  Logger.log("Days since: " + daysSince);

  if (daysSince > 3) {
    Logger.log("\n⚠️ Analysis is older than 3 days - will NOT be included in prompt");
  } else {
    Logger.log("\n✓ Analysis is recent - WILL be included in workout prompt");
  }

  // Show what would be in the prompt
  Logger.log("\n--- Expected Prompt Section ---");

  const difficultyText = lastAnalysis.difficultyMatch === 'harder_than_expected' ? 'HARDER than expected'
    : lastAnalysis.difficultyMatch === 'easier_than_expected' ? 'easier than expected'
    : lastAnalysis.difficultyMatch === 'as_expected' ? 'as expected'
    : lastAnalysis.difficultyMatch || 'unknown';

  Logger.log("**1g. Yesterday's Workout Feedback:**");
  Logger.log("- Last Workout: " + lastAnalysis.activityName + " (" + daysSince + " days ago)");
  Logger.log("- Difficulty Match: " + difficultyText);
  Logger.log("- Effectiveness: " + (lastAnalysis.effectiveness || 'N/A') + "/10");

  if (lastAnalysis.difficultyMatch === 'harder_than_expected') {
    Logger.log("\n📉 INTENSITY ADJUSTMENT: Reduce by 10%");
    Logger.log("   Favor endurance/tempo over threshold/VO2max");
  } else if (lastAnalysis.difficultyMatch === 'easier_than_expected') {
    Logger.log("\n📈 Athlete responding well - can maintain/increase intensity");
  } else {
    Logger.log("\n📊 Training load calibrated well - continue as planned");
  }

  // Get history
  Logger.log("\n--- Analysis History (7 days) ---");
  const history = getWorkoutAnalysisHistory(7);
  if (history.length === 0) {
    Logger.log("No analysis history");
  } else {
    history.forEach((h, i) => {
      Logger.log((i + 1) + ". " + h.activityName + " (" + h.date.substring(0, 10) + ") - " + (h.difficultyMatch || 'unknown'));
    });
  }

  Logger.log("\n=== TEST COMPLETE ===");
}
