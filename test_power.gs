/**
 * IntervalCoach - Power, Fitness & Goals Tests
 *
 * Tests for power profile, eFTP, running data, goals, and fitness analysis.
 * Run these from the Apps Script editor to test power/fitness features.
 */

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
