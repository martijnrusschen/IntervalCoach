/**
 * IntervalCoach - Test Functions
 *
 * All test and debug functions for verifying functionality.
 * Run these from the Apps Script editor to test specific features.
 */

// =========================================================
// API & CORE TESTS
// =========================================================

/**
 * Test fetchIcuApi and core API utilities
 * Verifies that the API wrapper is working correctly
 */
function testApiUtilities() {
  Logger.log("=== API UTILITIES TEST ===");

  // Test 1: Auth header generation
  Logger.log("--- Auth Header ---");
  try {
    const authHeader = getIcuAuthHeader();
    Logger.log("Auth header generated: " + (authHeader.startsWith("Basic ") ? "OK (Basic auth)" : "UNEXPECTED FORMAT"));
  } catch (e) {
    Logger.log("Auth header FAILED: " + e.toString());
  }

  // Test 2: Basic API call to athlete endpoint
  Logger.log("--- fetchIcuApi (athlete endpoint) ---");
  const athleteResult = fetchIcuApi("/athlete/0");
  if (athleteResult.success) {
    Logger.log("API call succeeded");
    Logger.log("Athlete ID: " + (athleteResult.data.id || "N/A"));
    Logger.log("Athlete name: " + (athleteResult.data.name || "N/A"));
  } else {
    Logger.log("API call FAILED: " + athleteResult.error);
  }

  // Test 3: Wellness endpoint
  Logger.log("--- fetchIcuApi (wellness endpoint) ---");
  const today = formatDateISO(new Date());
  const wellnessResult = fetchIcuApi("/athlete/0/wellness/" + today);
  if (wellnessResult.success) {
    Logger.log("Wellness data retrieved for " + today);
    Logger.log("CTL: " + (wellnessResult.data.ctl || "N/A"));
    Logger.log("ATL: " + (wellnessResult.data.atl || "N/A"));
  } else {
    Logger.log("Wellness call FAILED: " + wellnessResult.error);
  }

  // Test 4: Historical eFTP
  Logger.log("--- fetchHistoricalEftp ---");
  const historicalEftp = fetchHistoricalEftp(new Date());
  if (historicalEftp) {
    Logger.log("Current eFTP from history: " + historicalEftp + "W");
  } else {
    Logger.log("No historical eFTP data found");
  }

  // Test 5: Check an older eFTP (30 days ago)
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const olderEftp = fetchHistoricalEftp(thirtyDaysAgo);
  if (olderEftp) {
    Logger.log("eFTP 30 days ago: " + olderEftp + "W");
  } else {
    Logger.log("No eFTP data found for 30 days ago");
  }

  Logger.log("=== API UTILITIES TEST COMPLETE ===");
}

// =========================================================
// ADAPTIVE TRAINING TESTS
// =========================================================

/**
 * Test function for adaptive training
 */
function testAdaptiveTraining() {
  Logger.log("=== ADAPTIVE TRAINING TEST ===");

  const feedback = fetchRecentActivityFeedback(14);

  Logger.log("\n--- Recent Activities with Feedback ---");
  Logger.log("Total activities: " + feedback.activities.length);
  Logger.log("Activities with feedback: " + feedback.summary.totalWithFeedback);

  if (feedback.summary.avgRpe != null) {
    Logger.log("Average RPE: " + feedback.summary.avgRpe.toFixed(1) + "/10");
  }
  if (feedback.summary.avgFeel != null) {
    const feelMap = { 1: 'Bad', 2: 'Poor', 3: 'Okay', 4: 'Good', 5: 'Great' };
    Logger.log("Average Feel: " + feedback.summary.avgFeel.toFixed(1) + "/5 (" + (feelMap[Math.round(feedback.summary.avgFeel)] || 'N/A') + ")");
  }

  Logger.log("\n--- Feel Distribution ---");
  const fd = feedback.summary.feelDistribution;
  Logger.log("Great (5): " + fd.great);
  Logger.log("Good (4): " + fd.good);
  Logger.log("Okay (3): " + fd.okay);
  Logger.log("Poor (2): " + fd.poor);
  Logger.log("Bad (1): " + fd.bad);

  Logger.log("\n--- RPE Distribution ---");
  const rd = feedback.summary.rpeDistribution;
  Logger.log("Easy (1-4): " + rd.easy);
  Logger.log("Moderate (5-6): " + rd.moderate);
  Logger.log("Hard (7-8): " + rd.hard);
  Logger.log("Very Hard (9-10): " + rd.veryHard);

  Logger.log("\n--- Recent Activities Detail ---");
  feedback.activities.slice(0, 5).forEach((a, i) => {
    Logger.log((i + 1) + ". " + a.date.substring(0, 10) + " - " + a.name);
    Logger.log("   Type: " + a.type + ", TSS: " + (a.tss || 'N/A'));
    Logger.log("   RPE: " + (a.rpe || 'N/A') + ", Feel: " + (a.feel || 'N/A'));
  });

  const adaptation = analyzeTrainingAdaptation(feedback);

  Logger.log("\n--- Adaptation Analysis ---");
  Logger.log("Recommendation: " + adaptation.recommendation.toUpperCase());
  Logger.log("Confidence: " + adaptation.confidenceLevel);
  Logger.log("Intensity adjustment: " + (adaptation.intensityAdjustment > 0 ? '+' : '') + adaptation.intensityAdjustment + "%");
  Logger.log("Feedback quality: " + adaptation.feedbackQuality);

  Logger.log("\nReasoning:");
  adaptation.reasoning.forEach(r => {
    Logger.log("  - " + r);
  });

  // Get wellness for full context
  Logger.log("\n--- Training Gap Analysis ---");
  const wellnessRecords = fetchWellnessData(7);
  const wellness = createWellnessSummary(wellnessRecords);
  const context = getAdaptiveTrainingContext(wellness);

  Logger.log("Days since last workout: " + (context.gap.daysSinceLastWorkout || 0));
  if (context.gap.lastActivity) {
    Logger.log("Last activity: " + context.gap.lastActivity.type + " on " + context.gap.lastActivity.date.substring(0, 10));
  }
  Logger.log("Has significant gap (4+ days): " + context.gap.hasSignificantGap);
  if (context.gap.hasSignificantGap) {
    Logger.log("Gap interpretation: " + context.gap.interpretation.toUpperCase());
    if (wellness.available) {
      Logger.log("Recovery status: " + wellness.recoveryStatus);
    }
  }

  Logger.log("\n--- Combined Intensity Adjustment ---");
  Logger.log("Final adjustment: " + (context.adaptation.intensityAdjustment > 0 ? '+' : '') + context.adaptation.intensityAdjustment + "%");

  Logger.log("\n--- Prompt Context for AI ---");
  Logger.log(context.promptContext);
}

// =========================================================
// TRAINING LOAD TESTS
// =========================================================

/**
 * Test function for training load advisor
 */
function testTrainingLoadAdvisor() {
  Logger.log("=== TRAINING LOAD ADVISOR TEST ===");

  const fitnessMetrics = fetchFitnessMetrics();
  Logger.log("Current Fitness:");
  Logger.log("  CTL: " + fitnessMetrics.ctl.toFixed(1));
  Logger.log("  ATL: " + fitnessMetrics.atl.toFixed(1));
  Logger.log("  TSB: " + fitnessMetrics.tsb.toFixed(1));
  Logger.log("  Ramp Rate: " + (fitnessMetrics.rampRate ? fitnessMetrics.rampRate.toFixed(2) : 'N/A'));

  const goals = fetchUpcomingGoals();
  const phaseInfo = goals?.available && goals?.primaryGoal
    ? calculateTrainingPhase(goals.primaryGoal.date)
    : calculateTrainingPhase(USER_SETTINGS.TARGET_DATE);

  Logger.log("\nTraining Phase: " + phaseInfo.phaseName);
  Logger.log("Weeks to Goal: " + phaseInfo.weeksOut);

  const advice = calculateTrainingLoadAdvice(fitnessMetrics, phaseInfo, goals);

  Logger.log("\n=== RECOMMENDATIONS ===");
  Logger.log("Target CTL: " + advice.targetCTL);
  Logger.log("Weekly TSS Target: " + advice.recommendedWeeklyTSS + " (" + advice.tssRange.min + "-" + advice.tssRange.max + ")");
  Logger.log("Daily TSS Range: " + advice.dailyTSSRange.min + "-" + advice.dailyTSSRange.max);
  Logger.log("Ramp Rate Advice: " + advice.rampRateAdvice);
  Logger.log("Advice: " + advice.loadAdvice);
  if (advice.warning) {
    Logger.log("Warning: " + advice.warning);
  }
}

/**
 * Test AI-enhanced training load advisor with wellness context
 */
function testAITrainingLoadAdvisor() {
  Logger.log("=== AI TRAINING LOAD ADVISOR TEST ===");

  // Fetch fitness metrics
  const fitnessMetrics = fetchFitnessMetrics();
  Logger.log("\n--- Current Fitness ---");
  Logger.log("CTL: " + fitnessMetrics.ctl.toFixed(1));
  Logger.log("ATL: " + fitnessMetrics.atl.toFixed(1));
  Logger.log("TSB: " + fitnessMetrics.tsb.toFixed(1));
  Logger.log("Ramp Rate: " + (fitnessMetrics.rampRate ? fitnessMetrics.rampRate.toFixed(2) : 'N/A') + " CTL/week");

  // Fetch goals and phase
  const goals = fetchUpcomingGoals();
  const phaseInfo = goals?.available && goals?.primaryGoal
    ? calculateTrainingPhase(goals.primaryGoal.date)
    : calculateTrainingPhase(USER_SETTINGS.TARGET_DATE);

  Logger.log("\n--- Training Context ---");
  Logger.log("Phase: " + phaseInfo.phaseName);
  Logger.log("Weeks to Goal: " + phaseInfo.weeksOut);
  if (goals?.primaryGoal) {
    Logger.log("Goal: " + goals.primaryGoal.name + " (" + goals.primaryGoal.date + ")");
  }

  // Fetch wellness data
  const wellness = fetchWellnessData();
  const wellnessSummary = createWellnessSummary(wellness);

  Logger.log("\n--- Wellness Data ---");
  if (wellnessSummary.available) {
    const avg = wellnessSummary.averages;
    Logger.log("7-day Avg Sleep: " + (avg.sleep ? avg.sleep.toFixed(1) + "h" : "N/A"));
    Logger.log("7-day Avg HRV: " + (avg.hrv ? avg.hrv.toFixed(0) + " ms" : "N/A"));
    Logger.log("7-day Avg Recovery: " + (avg.recovery ? avg.recovery.toFixed(0) + "%" : "N/A"));
  } else {
    Logger.log("No wellness data available");
  }

  // Test AI-enhanced advice
  Logger.log("\n--- AI Training Load Advice ---");
  const advice = calculateTrainingLoadAdvice(fitnessMetrics, phaseInfo, goals, wellnessSummary);

  Logger.log("AI Enhanced: " + (advice.aiEnhanced ? "YES" : "NO (fallback)"));
  if (advice.aiConfidence) {
    Logger.log("AI Confidence: " + advice.aiConfidence);
  }
  Logger.log("Ramp Rate Advice: " + advice.rampRateAdvice);
  Logger.log("Recommended Ramp: " + advice.requiredWeeklyIncrease + " CTL/week");
  Logger.log("Weekly TSS Target: " + advice.recommendedWeeklyTSS + " (" + advice.tssRange.min + "-" + advice.tssRange.max + ")");
  Logger.log("Advice: " + advice.loadAdvice);
  if (advice.warning) {
    Logger.log("Warning: " + advice.warning);
  }

  // Compare with fallback
  Logger.log("\n--- Comparison: Fallback Advice ---");
  const fallbackAdvice = calculateTrainingLoadAdvice(fitnessMetrics, phaseInfo, goals, null);
  if (!fallbackAdvice.aiEnhanced) {
    Logger.log("Fallback Ramp Advice: " + fallbackAdvice.rampRateAdvice);
    Logger.log("Fallback Weekly TSS: " + fallbackAdvice.recommendedWeeklyTSS);
  }

  Logger.log("\n=== TEST COMPLETE ===");
}

// =========================================================
// EMAIL TESTS
// =========================================================

/**
 * Test rest day email functionality
 */
function testRestDayEmail() {
  Logger.log("=== REST DAY EMAIL TEST ===");

  const wellnessRecords = fetchWellnessData(7);
  const wellness = createWellnessSummary(wellnessRecords);

  Logger.log("--- Current Wellness Data ---");
  Logger.log("Recovery Status: " + wellness.recoveryStatus);
  Logger.log("Recovery Score: " + (wellness.today?.recovery != null ? wellness.today.recovery + "%" : "N/A"));
  Logger.log("Is Rest Day Recommended: " + isRestDayRecommended(wellness));

  const goals = fetchUpcomingGoals();
  const targetDate = goals?.available && goals?.primaryGoal ? goals.primaryGoal.date : USER_SETTINGS.TARGET_DATE;
  const phaseInfo = calculateTrainingPhase(targetDate);

  Logger.log("\n--- Phase Info ---");
  Logger.log("Phase: " + phaseInfo.phaseName);
  Logger.log("Weeks to Goal: " + phaseInfo.weeksOut);

  Logger.log("\n--- AI Rest Day Advice ---");
  const aiAdvice = generateRestDayAdvice(wellness);
  if (aiAdvice) {
    Logger.log(aiAdvice);
  } else {
    Logger.log("(AI advice generation failed, would use fallback translations)");
  }

  Logger.log("\n--- Test Complete ---");
  Logger.log("To send an actual test email, uncomment the line below:");
  Logger.log("// sendRestDayEmail(wellness, phaseInfo);");
}

/**
 * Test AI-enhanced recovery assessment with personal baselines
 */
function testAIRecoveryAssessment() {
  Logger.log("=== AI RECOVERY ASSESSMENT TEST ===");

  // Fetch wellness data
  const wellnessRecords = fetchWellnessData(7);

  if (!wellnessRecords || wellnessRecords.length === 0) {
    Logger.log("ERROR: No wellness data available");
    return;
  }

  // Get raw data before AI processing
  const latestWithData = wellnessRecords.find(r => r.sleep > 0 || r.hrv || r.recovery) || wellnessRecords[0];
  const last7Days = wellnessRecords.slice(0, 7);

  Logger.log("\n--- Today's Raw Data ---");
  Logger.log("Recovery Score: " + (latestWithData.recovery != null ? latestWithData.recovery + "%" : "N/A"));
  Logger.log("HRV: " + (latestWithData.hrv || "N/A") + " ms");
  Logger.log("Sleep: " + (latestWithData.sleep ? latestWithData.sleep.toFixed(1) + "h" : "N/A"));
  Logger.log("Resting HR: " + (latestWithData.restingHR || "N/A") + " bpm");

  // Calculate averages for comparison
  const avgRecovery = average(last7Days.map(w => w.recovery).filter(v => v != null));
  const avgHRV = average(last7Days.map(w => w.hrv).filter(v => v != null));
  const avgSleep = average(last7Days.map(w => w.sleep).filter(v => v > 0));

  Logger.log("\n--- Personal Baselines (7-day avg) ---");
  Logger.log("Avg Recovery: " + (avgRecovery ? avgRecovery.toFixed(0) + "%" : "N/A"));
  Logger.log("Avg HRV: " + (avgHRV ? avgHRV.toFixed(0) + " ms" : "N/A"));
  Logger.log("Avg Sleep: " + (avgSleep ? avgSleep.toFixed(1) + "h" : "N/A"));

  // Get AI-enhanced wellness summary
  Logger.log("\n--- AI Recovery Assessment ---");
  const wellness = createWellnessSummary(wellnessRecords);

  Logger.log("AI Enhanced: " + (wellness.aiEnhanced ? "YES" : "NO (fallback)"));
  Logger.log("Recovery Status: " + wellness.recoveryStatus);
  Logger.log("Intensity Modifier: " + (wellness.intensityModifier * 100).toFixed(0) + "%");
  if (wellness.personalizedReason) {
    Logger.log("Reason: " + wellness.personalizedReason);
  }

  // Show what fixed thresholds would have said
  Logger.log("\n--- Fixed Threshold Comparison ---");
  if (latestWithData.recovery != null) {
    let fixedStatus;
    if (latestWithData.recovery >= 66) {
      fixedStatus = "Green (Primed)";
    } else if (latestWithData.recovery >= 34) {
      fixedStatus = "Yellow (Recovering)";
    } else {
      fixedStatus = "Red (Strained)";
    }
    Logger.log("Fixed threshold would say: " + fixedStatus);
    Logger.log("AI says: " + wellness.recoveryStatus);
  }

  Logger.log("\n=== TEST COMPLETE ===");
}

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
  Logger.log("Event Tomorrow: " + (eventTomorrow.hasEvent ? eventTomorrow.category : "None"));
  Logger.log("Event Yesterday: " + (eventYesterday.hadEvent ? eventYesterday.category : "None"));
  Logger.log("Recent rides: " + (recentTypes.rides.length > 0 ? recentTypes.rides.join(", ") : "None"));
  Logger.log("Recent runs: " + (recentTypes.runs.length > 0 ? recentTypes.runs.join(", ") : "None"));

  // Test with real data - Ride
  Logger.log("\n--- Ride Selection (Real Data) ---");
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
  Logger.log("Recommended types: " + rideSelection.types.slice(0, 5).join(", "));

  Logger.log("\n=== TEST COMPLETE ===");
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
      info += day.eventCategory + " Event";
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

// =========================================================
// GOALS & DATA TESTS
// =========================================================

/**
 * Test dynamic goals from Intervals.icu calendar
 */
function testGoals() {
  Logger.log("=== DYNAMIC GOALS TEST ===");
  const goals = fetchUpcomingGoals();

  if (goals.available) {
    Logger.log("Primary Goal (A-race):");
    Logger.log("  Name: " + goals.primaryGoal.name);
    Logger.log("  Date: " + goals.primaryGoal.date);
    Logger.log("  Type: " + goals.primaryGoal.type);

    Logger.log("Secondary Goals (B-races): " + goals.secondaryGoals.length);
    goals.secondaryGoals.forEach(function(g) {
      Logger.log("  - " + g.name + " (" + g.date + ")");
    });

    Logger.log("Subgoals (C-races): " + goals.subGoals.length);
    goals.subGoals.forEach(function(g) {
      Logger.log("  - " + g.name + " (" + g.date + ")");
    });

    Logger.log("Generated Description:");
    Logger.log(buildGoalDescription(goals));

    const phaseInfo = calculateTrainingPhase(goals.primaryGoal.date);
    Logger.log("Phase: " + phaseInfo.phaseName + " (" + phaseInfo.weeksOut + " weeks out)");
  } else {
    Logger.log("No A/B/C race goals found in calendar");
    Logger.log("Falling back to manual TARGET_DATE: " + USER_SETTINGS.TARGET_DATE);
  }
}

/**
 * Test running data (Critical Speed, pace curve)
 */
function testRunningData() {
  Logger.log("=== RUNNING DATA TEST ===");
  const runningData = fetchRunningData();

  if (runningData.available) {
    Logger.log("Threshold Pace: " + (runningData.thresholdPace || 'N/A'));
    Logger.log("LTHR: " + (runningData.lthr || 'N/A') + " bpm");
    Logger.log("Max HR: " + (runningData.maxHr || 'N/A') + " bpm");

    Logger.log("--- Pace Curve Data ---");
    Logger.log("Critical Speed (42d): " + (runningData.criticalSpeed || 'N/A') + "/km");
    Logger.log("D' (anaerobic): " + (runningData.dPrime ? runningData.dPrime.toFixed(1) + "m" : 'N/A'));

    Logger.log("--- Best Efforts (42d) ---");
    if (runningData.bestEfforts) {
      Object.keys(runningData.bestEfforts).forEach(function(dist) {
        const effort = runningData.bestEfforts[dist];
        Logger.log(dist + "m: " + effort.time + " (" + effort.pace + "/km)");
      });
    }
  } else {
    Logger.log("No running data available");
  }
}

/**
 * Test power profile (eFTP, W', peak powers)
 */
function testEftp() {
  const powerCurve = fetchPowerCurve();
  Logger.log("=== POWER PROFILE TEST ===");
  Logger.log("--- FTP Metrics ---");
  Logger.log("Current eFTP (mmp_model): " + powerCurve.currentEftp + "W");
  Logger.log("All-time eFTP (powerModels): " + powerCurve.allTimeEftp + "W");
  Logger.log("Manual FTP (set): " + powerCurve.manualFTP + "W");
  Logger.log("--- W' (Anaerobic Capacity) ---");
  Logger.log("Current W': " + (powerCurve.wPrime ? (powerCurve.wPrime/1000).toFixed(1) + "kJ" : 'N/A'));
  Logger.log("--- Peak Powers ---");
  Logger.log("5s: " + powerCurve.peak5s + "W | 1min: " + powerCurve.peak1min + "W | 5min: " + powerCurve.peak5min + "W");
  Logger.log("20min: " + powerCurve.peak20min + "W | 60min: " + powerCurve.peak60min + "W");

  const profile = analyzePowerProfile(powerCurve);
  if (profile.available) {
    Logger.log("--- Analyzed Profile ---");
    Logger.log("Strengths: " + (profile.strengths.join(", ") || 'None'));
    Logger.log("Weaknesses: " + (profile.weaknesses.join(", ") || 'None'));
  }

  Logger.log("\n=== FITNESS METRICS ===");
  const fitness = fetchFitnessMetrics();
  Logger.log("CTL: " + fitness.ctl + " | ATL: " + fitness.atl + " | TSB: " + fitness.tsb);
}

/**
 * Test AI-enhanced power profile analysis
 * Tests the new goal-aware AI analysis vs fallback benchmarks
 */
function testAIPowerProfileAnalysis() {
  Logger.log("=== AI POWER PROFILE ANALYSIS TEST ===");

  // Fetch power curve
  const powerCurve = fetchPowerCurve();
  if (!powerCurve.available) {
    Logger.log("ERROR: Power curve not available");
    return;
  }

  Logger.log("\n--- Raw Power Data ---");
  Logger.log("eFTP: " + (powerCurve.currentEftp || powerCurve.eFTP) + "W");
  Logger.log("Peak 5s: " + powerCurve.peak5s + "W | 1min: " + powerCurve.peak1min + "W");
  Logger.log("Peak 5min: " + powerCurve.peak5min + "W | 20min: " + powerCurve.peak20min + "W");

  // Fetch goals to provide context
  const goals = fetchUpcomingGoals();
  Logger.log("\n--- Goal Context ---");
  if (goals.available && goals.primaryGoal) {
    Logger.log("Primary Goal: " + goals.primaryGoal.name + " (" + goals.primaryGoal.date + ")");
    Logger.log("Event Type: " + (goals.primaryGoal.type || 'Unknown'));
  } else {
    Logger.log("No goals set - will use general fitness context");
  }

  // Test AI-enhanced analysis
  Logger.log("\n--- AI Power Profile Analysis ---");
  const profile = analyzePowerProfile(powerCurve, goals);

  if (profile.available) {
    Logger.log("AI Enhanced: " + (profile.aiEnhanced ? "YES" : "NO (fallback)"));
    if (profile.aiConfidence) {
      Logger.log("AI Confidence: " + profile.aiConfidence);
    }
    Logger.log("Strengths: " + (profile.strengths.length > 0 ? profile.strengths.join(", ") : 'None identified'));
    Logger.log("Weaknesses: " + (profile.weaknesses.length > 0 ? profile.weaknesses.join(", ") : 'None identified'));
    Logger.log("Recommendations: " + (profile.recommendations.length > 0 ? profile.recommendations.join("; ") : 'None'));
    if (profile.eventRelevance) {
      Logger.log("Event Relevance: " + profile.eventRelevance);
    }
    Logger.log("Summary: " + profile.summary);
  } else {
    Logger.log("ERROR: Profile analysis failed");
  }

  // Compare with fallback (force fallback by passing null goals)
  Logger.log("\n--- Comparison: Fallback Analysis ---");
  const fallbackProfile = analyzePowerProfile(powerCurve, null);
  if (fallbackProfile.available && !fallbackProfile.aiEnhanced) {
    Logger.log("Fallback Strengths: " + (fallbackProfile.strengths.length > 0 ? fallbackProfile.strengths.join(", ") : 'None'));
    Logger.log("Fallback Weaknesses: " + (fallbackProfile.weaknesses.length > 0 ? fallbackProfile.weaknesses.join(", ") : 'None'));
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

  const sheet = SpreadsheetApp.openById(USER_SETTINGS.SPREADSHEET_ID).getSheetByName(USER_SETTINGS.SHEET_NAME);
  const data = sheet.getDataRange().getValues();
  data.shift();
  const summary = createAthleteSummary(data);

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
  Logger.log("=== AI PERIODIZATION TEST ===\n");
  requireValidConfig();

  const wellnessRecords = fetchWellnessData(7);
  const wellness = createWellnessSummary(wellnessRecords);

  const goals = fetchUpcomingGoals();
  const targetDate = goals?.available && goals?.primaryGoal ? goals.primaryGoal.date : USER_SETTINGS.TARGET_DATE;
  const goalDescription = goals?.available ? buildGoalDescription(goals) : USER_SETTINGS.GOAL_DESCRIPTION;

  const sheet = SpreadsheetApp.openById(USER_SETTINGS.SPREADSHEET_ID).getSheetByName(USER_SETTINGS.SHEET_NAME);
  const data = sheet.getDataRange().getValues();
  data.shift();
  const summary = createAthleteSummary(data);

  const powerProfile = analyzePowerProfile(fetchPowerCurve());
  const recentTypes = getRecentWorkoutTypes(7);

  Logger.log("--- Current Context ---");
  Logger.log("Target: " + targetDate);
  Logger.log("CTL: " + summary.ctl_90.toFixed(1) + " | TSB: " + summary.tsb_current.toFixed(1));
  Logger.log("Recovery: " + wellness.recoveryStatus);

  // Date-based phase
  Logger.log("\n--- Date-Based Phase ---");
  const dateBasedPhase = calculateTrainingPhase(targetDate);
  Logger.log("Phase: " + dateBasedPhase.phaseName + " (" + dateBasedPhase.weeksOut + " weeks out)");

  // AI-enhanced phase
  Logger.log("\n--- AI-Enhanced Phase ---");
  const phaseContext = {
    goalDescription: goalDescription,
    goals: goals,
    ctl: summary.ctl_90,
    rampRate: summary.rampRate,
    currentEftp: powerProfile.available ? powerProfile.currentEftp : null,
    targetFtp: powerProfile.available ? powerProfile.manualFTP : null,
    tsb: summary.tsb_current,
    z5Recent: summary.z5_recent_total,
    wellnessAverages: wellness.available ? wellness.averages : null,
    recoveryStatus: wellness.available ? wellness.recoveryStatus : 'Unknown',
    recentWorkouts: {
      rides: recentTypes.rides,
      runs: recentTypes.runs,
      lastIntensity: getLastWorkoutIntensity(recentTypes)
    },
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
 * Test AI-driven rest day assessment
 */
function testAIRestDayAssessment() {
  Logger.log("=== AI REST DAY ASSESSMENT TEST ===");
  requireValidConfig();

  const summary = fetchFitnessMetrics();
  const wellnessRecords = fetchWellnessData();
  const wellness = createWellnessSummary(wellnessRecords);
  const recentTypes = getRecentWorkoutTypes(7);
  const eventTomorrow = hasEventTomorrow();
  const eventIn2Days = hasEventInDays(2);

  const ctl = summary.ctl_90 || summary.ctl || 0;
  const tsb = summary.tsb_current || summary.tsb || 0;
  const atl = summary.atl_7 || summary.atl || 0;

  Logger.log("\n--- Current State ---");
  Logger.log("CTL: " + ctl.toFixed(1) + " | ATL: " + atl.toFixed(1) + " | TSB: " + tsb.toFixed(1));
  Logger.log("Recovery: " + (wellness.available ? wellness.recoveryStatus : "Unknown"));
  if (wellness.available && wellness.today) {
    Logger.log("Recovery Score: " + (wellness.today.recovery || 'N/A') + "%");
    Logger.log("Sleep: " + (wellness.today.sleep ? wellness.today.sleep.toFixed(1) + 'h' : 'N/A'));
  }

  const restDayContext = {
    wellness: wellness,
    tsb: tsb,
    ctl: ctl,
    atl: atl,
    phase: "Build",
    eventTomorrow: eventTomorrow,
    eventIn2Days: eventIn2Days,
    recentWorkouts: { rides: recentTypes.rides, runs: recentTypes.runs },
    lastIntensity: getLastWorkoutIntensity(recentTypes),
    consecutiveDays: "Unknown"
  };

  Logger.log("\n--- AI Assessment ---");
  const assessment = generateAIRestDayAssessment(restDayContext);

  if (assessment) {
    Logger.log("Decision: " + (assessment.isRestDay ? "REST DAY" : "TRAIN"));
    Logger.log("Confidence: " + assessment.confidence);
    Logger.log("Reasoning: " + assessment.reasoning);
    Logger.log("Alternatives: " + assessment.alternatives);
  } else {
    Logger.log("AI assessment failed");
  }

  Logger.log("\n--- Rule-Based (comparison) ---");
  const ruleBasedRest = isRestDayRecommended(wellness);
  Logger.log("Decision: " + (ruleBasedRest ? "REST DAY" : "TRAIN"));

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
        eventCategory: eventCheck.category
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
    plan.keyWorkouts.forEach(kw => Logger.log("• " + kw));
  }

  Logger.log("\n=== TEST COMPLETE ===");
  Logger.log("To send as email, run: sendWeeklyPlanningEmail()");
}

// =========================================================
// DEBUG FUNCTIONS
// =========================================================

/**
 * Debug fitness-model-events endpoint
 */
function debugFitnessModelEvents() {
  Logger.log("=== FITNESS MODEL EVENTS DEBUG ===");

  const result = fetchIcuApi("/athlete/0/fitness-model-events");

  if (!result.success) {
    Logger.log("API call failed: " + result.error);
    return;
  }

  const events = result.data;
  Logger.log("Total events: " + (Array.isArray(events) ? events.length : "NOT AN ARRAY"));

  if (Array.isArray(events)) {
    const categories = [...new Set(events.map(e => e.category))];
    Logger.log("Categories found: " + categories.join(", "));

    Logger.log("--- Sample events ---");
    events.slice(0, 5).forEach(function(e, i) {
      Logger.log((i+1) + ". " + JSON.stringify(e));
    });
  }
}

// =========================================================
// AI TRAINING GAP ANALYSIS TEST
// =========================================================

/**
 * Test AI-driven training gap analysis
 * Tests context-aware gap interpretation
 */
function testAITrainingGapAnalysis() {
  Logger.log("=== AI TRAINING GAP ANALYSIS TEST ===\n");
  requireValidConfig();

  // Fetch real data
  const gapData = getDaysSinceLastWorkout();
  const wellnessRecords = fetchWellnessData(7);
  const wellness = createWellnessSummary(wellnessRecords);
  const fitnessMetrics = fetchFitnessMetrics();

  const goalsResult = fetchIcuApi("/athlete/" + USER_SETTINGS.ATHLETE_ID + "/goals");
  const goals = goalsResult.success && goalsResult.data ? {
    available: true,
    primaryGoal: goalsResult.data.find(g => g.priority === 'A')
  } : { available: false };

  const phaseInfo = calculateTrainingPhase(
    goals.primaryGoal?.date || USER_SETTINGS.TARGET_DATE
  );

  Logger.log("--- Gap Data ---");
  Logger.log("Days since last workout: " + gapData.daysSinceLastWorkout);
  Logger.log("Last workout type: " + (gapData.lastWorkoutType || 'Unknown'));
  Logger.log("Last intensity: " + (gapData.lastIntensity || 'Unknown'));

  Logger.log("\n--- Wellness Context ---");
  Logger.log("Recovery Status: " + (wellness.available ? wellness.recoveryStatus : 'N/A'));
  Logger.log("Today's Recovery: " + (wellness.today?.recovery || 'N/A') + "%");

  Logger.log("\n--- Fitness Context ---");
  Logger.log("CTL: " + (fitnessMetrics.ctl?.toFixed(1) || 'N/A'));
  Logger.log("TSB: " + (fitnessMetrics.tsb?.toFixed(1) || 'N/A'));
  Logger.log("Phase: " + phaseInfo.phaseName);

  // Run analysis
  Logger.log("\n--- AI Training Gap Analysis ---");
  const analysis = analyzeTrainingGap(gapData, wellness, phaseInfo, fitnessMetrics);

  Logger.log("AI Enhanced: " + analysis.aiEnhanced);
  Logger.log("Interpretation: " + analysis.interpretation);
  Logger.log("Intensity Modifier: " + analysis.intensityModifier);
  Logger.log("Fitness Impact: " + (analysis.fitnessImpact || 'N/A'));
  Logger.log("Recommendation: " + analysis.recommendation);
  Logger.log("Reasoning: " + JSON.stringify(analysis.reasoning));

  Logger.log("\n=== TEST COMPLETE ===");
}

// =========================================================
// CLOSED-LOOP WEEKLY ADAPTATION TEST
// =========================================================

/**
 * Test closed-loop weekly plan adaptation
 * Analyzes planned vs actual execution and generates insights
 */
function testClosedLoopAdaptation() {
  Logger.log("=== CLOSED-LOOP WEEKLY ADAPTATION TEST ===\n");
  requireValidConfig();

  // Analyze last week's plan execution
  Logger.log("--- Analyzing Last Week's Plan Execution ---");
  const executionAnalysis = analyzeWeeklyPlanExecution(1);

  Logger.log("Period: " + executionAnalysis.period.start + " to " + executionAnalysis.period.end);
  Logger.log("\n--- Planned Sessions ---");
  executionAnalysis.planned.forEach(p => {
    Logger.log(`  ${p.date}: ${p.workoutType} (TSS: ${p.plannedTSS}, ${p.plannedDuration}min)`);
  });

  Logger.log("\n--- Actual Sessions ---");
  executionAnalysis.actual.forEach(a => {
    Logger.log(`  ${a.date}: ${a.workoutType} (TSS: ${a.actualTSS}, ${a.actualDuration}min)`);
  });

  Logger.log("\n--- Comparison ---");
  executionAnalysis.comparison.forEach(c => {
    const status = c.status === 'completed' ? '✓' : '✗';
    Logger.log(`  ${status} ${c.date}: ${c.planned.workoutType} → ${c.actual?.workoutType || 'SKIPPED'}`);
    if (c.status === 'completed') {
      Logger.log(`     TSS variance: ${c.tssVariance >= 0 ? '+' : ''}${c.tssVariance}`);
    }
  });

  Logger.log("\n--- Summary ---");
  const s = executionAnalysis.summary;
  Logger.log(`Planned: ${s.plannedSessions} | Completed: ${s.completedSessions} | Skipped: ${s.skippedSessions}`);
  Logger.log(`Planned TSS: ${s.plannedTSS} | Actual TSS: ${s.actualTSS} | Variance: ${s.tssVariance >= 0 ? '+' : ''}${s.tssVariance}`);
  Logger.log(`Adherence Score: ${s.adherenceScore}%`);

  // Get AI adaptation insights
  Logger.log("\n--- AI Adaptation Insights ---");
  const insights = generateAIPlanAdaptationInsights(executionAnalysis);

  if (insights) {
    Logger.log("Patterns: " + JSON.stringify(insights.patterns));
    Logger.log("Adaptations: " + JSON.stringify(insights.adaptations));
    Logger.log("Assessment: " + insights.adherenceAssessment);
    Logger.log("Recommendation: " + insights.planningRecommendation);
    Logger.log("Confidence: " + insights.confidence);
  } else {
    Logger.log("No insights generated (may need more plan data)");
  }

  Logger.log("\n=== TEST COMPLETE ===");
}

// =========================================================
// AI EFTP TRAJECTORY ANALYSIS TEST
// =========================================================

/**
 * Test AI-driven eFTP trajectory analysis
 * Tests FTP progress prediction toward goal
 */
function testAIEftpTrajectoryAnalysis() {
  Logger.log("=== AI EFTP TRAJECTORY ANALYSIS TEST ===\n");
  requireValidConfig();

  // Fetch real data
  const powerProfile = fetchPowerCurve();
  const fitnessMetrics = fetchFitnessMetrics();

  const goalsResult = fetchIcuApi("/athlete/" + USER_SETTINGS.ATHLETE_ID + "/goals");
  const goals = goalsResult.success && goalsResult.data ? {
    available: true,
    primaryGoal: goalsResult.data.find(g => g.priority === 'A')
  } : { available: false };

  const phaseInfo = calculateTrainingPhase(
    goals.primaryGoal?.date || USER_SETTINGS.TARGET_DATE
  );

  Logger.log("--- Power Profile ---");
  Logger.log("Current eFTP: " + (powerProfile.currentEftp || powerProfile.ftp || 'N/A') + "W");
  Logger.log("Target FTP: " + (powerProfile.manualFTP || 'N/A') + "W");
  if (powerProfile.currentEftp && powerProfile.manualFTP) {
    Logger.log("Gap: " + (powerProfile.manualFTP - powerProfile.currentEftp) + "W");
  }

  Logger.log("\n--- Timeline ---");
  Logger.log("Phase: " + phaseInfo.phaseName);
  Logger.log("Weeks to Goal: " + phaseInfo.weeksOut);
  Logger.log("Goal: " + (goals.primaryGoal?.name || 'General fitness'));

  Logger.log("\n--- Fitness Trend ---");
  Logger.log("CTL: " + (fitnessMetrics.ctl?.toFixed(1) || 'N/A'));
  Logger.log("Ramp Rate: " + (fitnessMetrics.rampRate?.toFixed(2) || 'N/A') + " CTL/week");

  // Run analysis
  Logger.log("\n--- AI eFTP Trajectory Analysis ---");
  const analysis = generateAIEftpTrajectoryAnalysis(powerProfile, fitnessMetrics, phaseInfo, goals);

  if (analysis) {
    Logger.log("On Track: " + analysis.onTrack);
    Logger.log("Status: " + analysis.trajectoryStatus);
    Logger.log("Projected eFTP: " + analysis.projectedEftp + "W");
    Logger.log("Projected Gap: " + analysis.projectedGap + "W");
    Logger.log("Assessment: " + analysis.assessment);
    Logger.log("Recommendation: " + analysis.recommendation);
    Logger.log("Adjustments: " + JSON.stringify(analysis.adjustments));
    Logger.log("Confidence: " + analysis.confidence);
  } else {
    Logger.log("Analysis returned null - check if power profile and target FTP are available");
  }

  Logger.log("\n=== TEST COMPLETE ===");
}

// =========================================================
// AI EVENT-SPECIFIC TRAINING TEST
// =========================================================

/**
 * Test AI-driven event-specific training analysis
 * Tests event profile analysis and tailored training recommendations
 */
function testAIEventSpecificTraining() {
  Logger.log("=== AI EVENT-SPECIFIC TRAINING TEST ===\n");
  requireValidConfig();

  // Fetch real data
  const goals = fetchUpcomingGoals();
  const powerProfile = analyzePowerProfile(fetchPowerCurve(), goals);
  const fitnessMetrics = fetchFitnessMetrics();
  const phaseInfo = calculateTrainingPhase(goals);

  Logger.log("--- Goal Event ---");
  if (goals.available && goals.primaryGoal) {
    Logger.log("Name: " + goals.primaryGoal.name);
    Logger.log("Date: " + goals.primaryGoal.date);
    Logger.log("Type: " + (goals.primaryGoal.type || 'Unknown'));
    Logger.log("Description: " + (goals.primaryGoal.description || 'None'));
  } else {
    Logger.log("No primary goal found - test may not produce meaningful results");
  }

  Logger.log("\n--- Athlete Profile ---");
  Logger.log("eFTP: " + (powerProfile.eFTP || 'Unknown') + "W");
  Logger.log("Strengths: " + (powerProfile.strengths?.join(', ') || 'Unknown'));
  Logger.log("Focus Areas: " + (powerProfile.focusAreas?.join(', ') || 'Unknown'));
  Logger.log("CTL: " + (fitnessMetrics.ctl?.toFixed(0) || 'Unknown'));

  // Calculate weeks to goal (fallback if phaseInfo.weeksOut is NaN)
  let weeksOut = phaseInfo.weeksOut;
  if (isNaN(weeksOut) && goals.primaryGoal?.date) {
    const goalDate = new Date(goals.primaryGoal.date);
    const today = new Date();
    weeksOut = Math.round((goalDate - today) / (7 * 24 * 60 * 60 * 1000));
  }

  Logger.log("\n--- Timeline ---");
  Logger.log("Weeks to Goal: " + weeksOut);
  Logger.log("Current Phase: " + phaseInfo.phaseName);

  // Run analysis
  Logger.log("\n--- AI Event Analysis ---");
  const analysis = generateAIEventAnalysis(
    goals.primaryGoal || { name: 'General Fitness', date: '2025-06-01', priority: 'A' },
    powerProfile,
    fitnessMetrics,
    weeksOut || 12
  );

  if (analysis) {
    Logger.log("\n[Event Profile]");
    Logger.log("  Category: " + analysis.eventProfile?.category);
    Logger.log("  Primary Demands: " + (analysis.eventProfile?.primaryDemands?.join(', ') || 'N/A'));
    Logger.log("  Key Challenge: " + analysis.eventProfile?.keyChallenge);
    Logger.log("  Est. Duration: " + analysis.eventProfile?.estimatedDuration);

    Logger.log("\n[Training Emphasis]");
    Logger.log("  Priority Workouts: " + (analysis.trainingEmphasis?.priorityWorkouts?.join(', ') || 'N/A'));
    Logger.log("  Secondary Workouts: " + (analysis.trainingEmphasis?.secondaryWorkouts?.join(', ') || 'N/A'));
    Logger.log("  Avoid: " + (analysis.trainingEmphasis?.avoidWorkouts?.join(', ') || 'N/A'));
    Logger.log("  Intensity Focus: " + analysis.trainingEmphasis?.intensityFocus);
    Logger.log("  Weekly Structure: " + analysis.trainingEmphasis?.weeklyStructure);

    Logger.log("\n[Peaking Strategy]");
    Logger.log("  Taper Length: " + analysis.peakingStrategy?.taperLength);
    Logger.log("  Taper Style: " + analysis.peakingStrategy?.taperStyle);
    Logger.log("  Last Hard Workout: " + analysis.peakingStrategy?.lastHardWorkout);
    Logger.log("  Volume Reduction: " + analysis.peakingStrategy?.volumeReduction);
    Logger.log("  Opener: " + analysis.peakingStrategy?.openerWorkout);

    Logger.log("\n[Current Phase Advice]");
    Logger.log("  Phase: " + analysis.currentPhaseAdvice?.phase);
    Logger.log("  Build vs Taper: " + analysis.currentPhaseAdvice?.buildVsTaper);
    Logger.log("  Weekly Focus: " + analysis.currentPhaseAdvice?.weeklyFocus);
    Logger.log("  Key Workout: " + analysis.currentPhaseAdvice?.keyWorkout);

    Logger.log("\n[Athlete Notes]");
    Logger.log("  " + analysis.athleteSpecificNotes);

    Logger.log("\nConfidence: " + analysis.confidence);
    Logger.log("AI Enhanced: " + analysis.aiEnhanced);
  } else {
    Logger.log("Analysis returned null - check goals and power profile data");
  }

  Logger.log("\n=== TEST COMPLETE ===");
}
