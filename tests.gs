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
    Logger.log("Average Feel: " + feedback.summary.avgFeel.toFixed(1) + " (" + getFeelLabel(feedback.summary.avgFeel) + ")");
  }

  Logger.log("\n--- Feel Distribution ---");
  const fd = feedback.summary.feelDistribution;
  Logger.log("Strong (1): " + fd.great);
  Logger.log("Good (2): " + fd.good);
  Logger.log("Normal (3): " + fd.okay);
  Logger.log("Poor (4): " + fd.poor);
  Logger.log("Weak (5): " + fd.bad);

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

// =========================================================
// AI CUMULATIVE FATIGUE PREDICTION TEST
// =========================================================

/**
 * Test AI-driven cumulative fatigue prediction
 * Tests fatigue classification, warning signs, and recovery prediction
 */
function testAICumulativeFatiguePrediction() {
  Logger.log("=== AI CUMULATIVE FATIGUE PREDICTION TEST ===\n");
  requireValidConfig();

  // Fetch all required data
  Logger.log("--- Fetching Data ---");

  const fitnessMetrics = fetchFitnessMetrics();
  Logger.log("Current Fitness: CTL=" + (fitnessMetrics.ctl?.toFixed(1) || 'N/A') +
    ", ATL=" + (fitnessMetrics.atl?.toFixed(1) || 'N/A') +
    ", TSB=" + (fitnessMetrics.tsb?.toFixed(1) || 'N/A'));

  const fitnessTrend = fetchFitnessTrend(14);
  Logger.log("Fitness trend: " + fitnessTrend.length + " days of data");

  const wellnessRecords = fetchWellnessData();
  const wellness = createWellnessSummary(wellnessRecords);
  Logger.log("Wellness: Recovery=" + (wellness.today?.recovery || 'N/A') + "%, HRV=" + (wellness.today?.hrv || 'N/A') +
    " | Status: " + (wellness.recoveryStatus || 'Unknown'));

  const workoutFeedback = fetchRecentActivityFeedback(14);
  Logger.log("Workout feedback: " + (workoutFeedback.summary?.totalWithFeedback || 0) + " activities with RPE/Feel");

  const goals = fetchUpcomingGoals();
  const targetDate = goals?.available && goals?.primaryGoal ? goals.primaryGoal.date : USER_SETTINGS.TARGET_DATE;
  const phaseInfo = calculateTrainingPhase(targetDate);
  Logger.log("Phase: " + phaseInfo.phaseName + " (" + phaseInfo.weeksOut + " weeks out)");

  // Run AI analysis
  Logger.log("\n--- AI Fatigue Analysis ---");
  const analysis = generateAICumulativeFatigueAnalysis(
    fitnessMetrics,
    fitnessTrend,
    wellness,
    workoutFeedback,
    phaseInfo
  );

  if (analysis) {
    Logger.log("\n[Fatigue Classification]");
    Logger.log("  Type: " + analysis.fatigueType);
    Logger.log("  Severity: " + analysis.fatigueSeverity + "/10");
    Logger.log("  Quality: " + analysis.fatigueQuality);
    Logger.log("  TSB Trend: " + analysis.tsbTrend);
    Logger.log("  Risk Level: " + analysis.riskLevel);

    Logger.log("\n[Warning Signs]");
    Logger.log("  Present: " + analysis.warningSignsPresent);
    if (analysis.warningSigns && analysis.warningSigns.length > 0) {
      analysis.warningSigns.forEach(w => Logger.log("  ⚠ " + w));
    } else {
      Logger.log("  None detected");
    }

    Logger.log("\n[Recovery Prediction]");
    Logger.log("  Days to neutral TSB: " + analysis.recoveryPrediction?.daysToNeutralTSB);
    Logger.log("  Days to positive TSB: " + analysis.recoveryPrediction?.daysToPositiveTSB);
    Logger.log("  Confidence: " + analysis.recoveryPrediction?.recoveryConfidence);

    Logger.log("\n[Recommendation]");
    Logger.log("  Advice: " + analysis.recommendation?.trainingAdvice);
    Logger.log("  Duration: " + analysis.recommendation?.durationDays + " days");
    if (analysis.recommendation?.specificActions) {
      Logger.log("  Actions:");
      analysis.recommendation.specificActions.forEach(a => Logger.log("    → " + a));
    }

    Logger.log("\n[Physiological Insight]");
    Logger.log("  " + analysis.physiologicalInsight);

    Logger.log("\nConfidence: " + analysis.confidence);
    Logger.log("AI Enhanced: " + analysis.aiEnhanced);
  } else {
    Logger.log("Analysis returned null - check data availability");
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
    Logger.log("✓ checkForCompletedWorkouts() executed successfully");
  } catch (e) {
    Logger.log("✗ Error in checkForCompletedWorkouts(): " + e.toString());
  }

  // Test 2: Fetch a recent activity and analyze it manually
  Logger.log("\n--- Test 2: Manual Analysis of Recent Activity ---");

  const today = new Date();
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(today.getDate() - 7);

  const endpoint = `/athlete/0/activities?oldest=${formatDateISO(sevenDaysAgo)}&newest=${formatDateISO(today)}`;
  const result = fetchIcuApi(endpoint);

  if (!result.success) {
    Logger.log("✗ Error fetching activities: " + result.error);
    return;
  }

  const activities = result.data;
  if (!activities || activities.length === 0) {
    Logger.log("⚠ No activities found in last 7 days - cannot test analysis");
    Logger.log("Tip: Complete a workout and try again in an hour");
    return;
  }

  // Find first real workout (with TSS > 0)
  const realWorkout = activities.find(a => a.icu_training_load && a.icu_training_load > 0 && a.moving_time > 300);

  if (!realWorkout) {
    Logger.log("⚠ No real workouts found (only placeholders) - cannot test analysis");
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
    Logger.log("✗ AI analysis failed: " + (analysis?.error || "Unknown error"));
    return;
  }

  Logger.log("✓ AI analysis successful");
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
    analysis.performanceHighlights.forEach(h => Logger.log("  • " + h));
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
    Logger.log("✓ Analysis stored successfully");

    // Retrieve and verify
    const lastAnalysis = getLastWorkoutAnalysis();
    if (lastAnalysis && lastAnalysis.activityName === realWorkout.name) {
      Logger.log("✓ Retrieved stored analysis: " + lastAnalysis.activityName);
    } else {
      Logger.log("✗ Failed to retrieve stored analysis");
    }

    const history = getWorkoutAnalysisHistory(7);
    Logger.log("✓ Analysis history: " + history.length + " records");
  } catch (e) {
    Logger.log("✗ Error storing analysis: " + e.toString());
  }

  // Test 5: Email Sending
  Logger.log("\n--- Test 5: Email Sending ---");
  Logger.log("Sending post-workout analysis email...");

  try {
    sendPostWorkoutAnalysisEmail(realWorkout, analysis, wellness, fitness, powerProfile, runningData);
    Logger.log("✓ Email sent successfully to " + USER_SETTINGS.EMAIL_TO);
  } catch (e) {
    Logger.log("✗ Error sending email: " + e.toString());
  }

  Logger.log("\n=== TEST COMPLETE ===");
  Logger.log("\nNext steps:");
  Logger.log("1. Check your email for the post-workout analysis");
  Logger.log("2. Set up hourly trigger: ScriptApp.newTrigger('checkForCompletedWorkouts').timeBased().everyHours(1).create()");
  Logger.log("3. Complete a workout and wait 1 hour to test automatic analysis");
}

// =========================================================
// TODAY'S ACTIVITIES TEST
// =========================================================

/**
 * Test function to check today's activities from Intervals.icu
 * Useful for verifying workouts were recorded
 */
function testTodaysActivities() {
  Logger.log("=== TODAY'S ACTIVITIES ===\n");
  requireValidConfig();

  const today = new Date();
  const todayStr = formatDateISO(today);

  // Fetch activities for today only
  const endpoint = `/athlete/0/activities?oldest=${todayStr}&newest=${todayStr}`;
  const result = fetchIcuApi(endpoint);

  if (!result.success) {
    Logger.log("ERROR: Failed to fetch activities - " + result.error);
    return;
  }

  const activities = result.data;

  if (!activities || activities.length === 0) {
    Logger.log("No activities found for today (" + todayStr + ")");
    Logger.log("\nTip: Activities may take a few minutes to sync from your device.");
    return;
  }

  Logger.log("Found " + activities.length + " activity(ies) for " + todayStr + ":\n");

  activities.forEach(function(a, i) {
    Logger.log("--- Activity " + (i + 1) + " ---");

    // Check for Strava API restriction
    if (a._note && a._note.includes("not available via the API")) {
      Logger.log("Source: " + a.source);
      Logger.log("Start: " + a.start_date_local);
      Logger.log("Note: " + a._note);
      Logger.log("\nThis activity's details are restricted by " + a.source + "'s API policy.");
      Logger.log("View full details at: https://intervals.icu/activities/" + a.id);
    } else {
      Logger.log("Name: " + a.name);
      Logger.log("Type: " + a.type);
      Logger.log("Start: " + a.start_date_local);
      Logger.log("Duration: " + Math.round((a.moving_time || 0) / 60) + " min");
      Logger.log("Distance: " + ((a.distance || 0) / 1000).toFixed(2) + " km");
      Logger.log("TSS: " + (a.icu_training_load || 'N/A'));

      if (a.type === 'Run') {
        // Try multiple pace sources: direct field, or calculate from distance/time
        let paceStr = 'N/A';
        if (a.average_speed) {
          paceStr = formatPace(a.average_speed);
        } else if (a.icu_average_speed) {
          paceStr = formatPace(a.icu_average_speed);
        } else if (a.distance > 0 && a.moving_time > 0) {
          // Calculate pace from distance (m) and time (s)
          const speedMs = a.distance / a.moving_time;
          paceStr = formatPace(speedMs) + " (calculated)";
        }
        Logger.log("Avg Pace: " + paceStr);
        Logger.log("Avg HR: " + (a.average_heartrate || a.icu_average_hr || 'N/A') + " bpm");
      } else if (a.type === 'Ride' || a.type === 'VirtualRide') {
        Logger.log("Avg Power: " + (a.icu_average_watts || 'N/A') + "W");
        Logger.log("NP: " + (a.icu_weighted_avg_watts || 'N/A') + "W");
      }
    }
    Logger.log("");
  });

  Logger.log("=== END ===");
}

/**
 * Helper to format pace from m/s to min:sec/km
 */
function formatPace(metersPerSecond) {
  if (!metersPerSecond || metersPerSecond <= 0) return 'N/A';
  const secsPerKm = 1000 / metersPerSecond;
  const mins = Math.floor(secsPerKm / 60);
  const secs = Math.round(secsPerKm % 60);
  return mins + ":" + (secs < 10 ? "0" : "") + secs + "/km";
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

  const sheet = SpreadsheetApp.openById(USER_SETTINGS.SPREADSHEET_ID).getSheetByName(USER_SETTINGS.SHEET_NAME);
  const data = sheet.getDataRange().getValues();
  data.shift();
  const summary = createAthleteSummary(data);

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
// ZONE PROGRESSION TESTS
// =========================================================

/**
 * Test zone progression calculation and recommendations
 * Verifies zone-specific fitness tracking and AI recommendations
 */
function testZoneProgression() {
  Logger.log("=== ZONE PROGRESSION TEST ===\n");

  // 1. Test zone exposure analysis for a single activity
  Logger.log("--- Zone Exposure Analysis ---");
  const today = new Date();
  const weekAgo = new Date(today);
  weekAgo.setDate(today.getDate() - 7);

  const activitiesResult = fetchIcuApi("/athlete/0/activities?oldest=" + formatDateISO(weekAgo) + "&newest=" + formatDateISO(today));

  if (activitiesResult.success && activitiesResult.data.length > 0) {
    const sampleActivity = activitiesResult.data.find(a => a.type === "Ride" || a.type === "Run");

    if (sampleActivity) {
      Logger.log("Sample activity: " + sampleActivity.name + " (" + sampleActivity.type + ")");
      Logger.log("Date: " + sampleActivity.start_date_local);

      const exposure = analyzeZoneExposure(sampleActivity);
      if (exposure) {
        Logger.log("Dominant zone: " + exposure.dominantZone);
        Logger.log("Training stimulus: " + exposure.stimulus);
        Logger.log("TSS: " + exposure.tss);
        Logger.log("Zone distribution (%):");
        for (const [zone, pct] of Object.entries(exposure.zonePercentages)) {
          if (pct > 0) {
            Logger.log("  " + zone.toUpperCase() + ": " + pct + "%");
          }
        }
      } else {
        Logger.log("Activity too short for zone analysis");
      }
    } else {
      Logger.log("No Ride/Run activities found in last 7 days");
    }
  } else {
    Logger.log("Failed to fetch activities: " + (activitiesResult.error || "No data"));
  }

  // 2. Test full zone progression calculation
  Logger.log("\n--- Zone Progression Calculation (42 days) ---");
  const progression = calculateZoneProgression(42);

  if (progression.available) {
    Logger.log("Activities analyzed: " + progression.activitiesAnalyzed);
    Logger.log("Period: " + progression.periodDays + " days");
    Logger.log("\nZone Levels (1.0-10.0 scale):");

    for (const [zone, data] of Object.entries(progression.progression)) {
      const zoneName = zone.charAt(0).toUpperCase() + zone.slice(1);
      const bar = "█".repeat(Math.round(data.level)) + "░".repeat(10 - Math.round(data.level));
      Logger.log("  " + zoneName.padEnd(12) + " " + data.level.toFixed(1) + " " + bar + " (" + data.trend + ")");
      Logger.log("    Sessions: " + data.sessions + " | Total: " + data.totalMinutes + " min | Last: " + (data.lastTrained || "never"));
    }

    Logger.log("\nIdentified patterns:");
    Logger.log("  Strengths: " + progression.strengths.join(", "));
    Logger.log("  Focus Areas: " + progression.focusAreas.join(", "));
  } else {
    Logger.log("Zone progression calculation failed");
  }

  // 3. Test storage and retrieval
  Logger.log("\n--- Zone Progression Storage ---");
  if (progression.available) {
    const stored = storeZoneProgression(progression);
    Logger.log("Stored: " + (stored ? "OK" : "FAILED"));

    const retrieved = getZoneProgression(false);
    Logger.log("Retrieved from cache: " + (retrieved.available ? "OK" : "FAILED"));
    Logger.log("Calculated at: " + retrieved.calculatedAt);
  }

  // 4. Test AI recommendations
  Logger.log("\n--- AI Zone Recommendations ---");
  if (progression.available) {
    const goals = fetchUpcomingGoals();
    const targetDate = goals?.available && goals?.primaryGoal ? goals.primaryGoal.date : USER_SETTINGS.TARGET_DATE;
    const phaseInfo = calculateTrainingPhase(targetDate);

    const recommendations = getZoneRecommendations(progression, phaseInfo, goals);

    if (recommendations) {
      Logger.log("AI Enhanced: " + (recommendations.aiEnhanced || false));
      Logger.log("Summary: " + recommendations.summary);
      Logger.log("Priority zone: " + recommendations.priorityZone);
      Logger.log("Reason: " + recommendations.priorityReason);

      if (recommendations.weeklyRecommendations) {
        Logger.log("\nWeekly recommendations:");
        recommendations.weeklyRecommendations.forEach(function(rec, i) {
          Logger.log("  " + (i + 1) + ". " + rec);
        });
      }

      if (recommendations.avoidanceNote) {
        Logger.log("\nAvoidance note: " + recommendations.avoidanceNote);
      }

      Logger.log("Long-term trend: " + recommendations.longTermTrend);
    } else {
      Logger.log("AI recommendations failed");
    }
  }

  // 5. Test formatted output
  Logger.log("\n--- Formatted Zone Progression (for email) ---");
  if (progression.available) {
    const formatted = formatZoneProgressionText(progression);
    Logger.log(formatted);
  }

  // 6. Test zone progression history
  Logger.log("\n--- Zone Progression History ---");
  if (progression.available) {
    addZoneProgressionToHistory(progression);
    const history = getZoneProgressionHistory(4);
    Logger.log("History records: " + history.length);
    history.forEach(function(snapshot, i) {
      Logger.log("  " + (i + 1) + ". " + snapshot.date);
    });
  }

  Logger.log("\n=== ZONE PROGRESSION TEST COMPLETE ===");
}
