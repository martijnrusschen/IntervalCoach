/**
 * IntervalCoach - Recovery & Wellness Tests
 *
 * Tests for recovery assessment, rest day recommendations, and wellness integration.
 * Run these from the Apps Script editor to test recovery features.
 */

// =========================================================
// REST DAY & RECOVERY TESTS
// =========================================================

/**
 * Test rest day email functionality
 */
function testRestDayEmail() {
  logTestHeader("REST DAY EMAIL");

  // Get all context in one call
  const ctx = setupTestContext();

  Logger.log("--- Current Wellness Data ---");
  Logger.log("Recovery Status: " + ctx.wellness.recoveryStatus);
  Logger.log("Recovery Score: " + (ctx.wellness.today?.recovery != null ? ctx.wellness.today.recovery + "%" : "N/A"));
  Logger.log("Is Rest Day Recommended: " + isRestDayRecommended(ctx.wellness));

  Logger.log("\n--- Phase Info ---");
  Logger.log("Phase: " + ctx.phase);
  Logger.log("Weeks to Goal: " + ctx.phaseInfo.weeksOut);

  // Fetch additional context for coaching note
  const upcomingDays = fetchUpcomingPlaceholders(7);

  Logger.log("\n--- Upcoming Workouts ---");
  const nextWorkouts = upcomingDays.filter(d => d.activityType || d.hasEvent).slice(0, 3);
  if (nextWorkouts.length > 0) {
    nextWorkouts.forEach(d => {
      if (d.hasEvent) {
        Logger.log("  " + d.dayName + ": [" + d.eventCategory + "] " + (d.eventName || 'Event'));
      } else {
        Logger.log("  " + d.dayName + ": " + (d.placeholderName || d.activityType));
      }
    });
  } else {
    Logger.log("  No workouts planned");
  }

  Logger.log("\n--- AI Rest Day Coaching Note ---");
  const coachingNote = generateRestDayCoachingNote({
    wellness: ctx.wellness,
    phaseInfo: ctx.phaseInfo,
    weekProgress: ctx.weekProgress,
    upcomingDays: upcomingDays,
    fitness: ctx.fitness
  });
  if (coachingNote) {
    Logger.log(coachingNote);
  } else {
    Logger.log("(Coaching note generation failed)");
  }

  Logger.log("\n--- Test Complete ---");
  Logger.log("To send an actual rest day email, run: testSendRestDayEmail()");
}

/**
 * Actually send a test rest day email (for testing the full flow)
 */
function testSendRestDayEmail() {
  logTestHeader("SENDING REST DAY EMAIL");

  const ctx = setupTestContext();
  const upcomingDays = fetchUpcomingPlaceholders(7);
  ctx.phaseInfo.goalDescription = ctx.goals?.available ? buildGoalDescription(ctx.goals) : USER_SETTINGS.GOAL_DESCRIPTION;

  sendDailyEmail({
    type: 'rest',
    summary: {
      ctl_90: ctx.fitness.ctl || 0,
      tsb_current: ctx.fitness.tsb || 0
    },
    phaseInfo: ctx.phaseInfo,
    wellness: ctx.wellness,
    weekProgress: ctx.weekProgress,
    upcomingDays: upcomingDays,
    fitness: ctx.fitness
  });

  Logger.log("Rest day email sent!");
}

/**
 * Test AI-enhanced recovery assessment with personal baselines
 */
function testAIRecoveryAssessment() {
  logTestHeader("AI RECOVERY ASSESSMENT");
  requireValidConfig();

  // This test needs raw wellness records for analysis
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
 * Test AI-driven rest day assessment
 */
function testAIRestDayAssessment() {
  logTestHeader("AI REST DAY ASSESSMENT");

  const ctx = setupTestContext();

  Logger.log("\n--- Current State ---");
  Logger.log("CTL: " + ctx.ctl.toFixed(1) + " | ATL: " + ctx.atl.toFixed(1) + " | TSB: " + ctx.tsb.toFixed(1));
  Logger.log("Recovery: " + (ctx.wellness.recoveryStatus || "Unknown"));
  if (ctx.wellness.today) {
    Logger.log("Recovery Score: " + (ctx.wellness.today.recovery || 'N/A') + "%");
    Logger.log("Sleep: " + (ctx.wellness.today.sleep ? ctx.wellness.today.sleep.toFixed(1) + 'h' : 'N/A'));
  }

  const restDayContext = {
    wellness: ctx.wellness,
    tsb: ctx.tsb,
    ctl: ctx.ctl,
    atl: ctx.atl,
    phase: ctx.phase,
    eventTomorrow: ctx.eventTomorrow,
    eventIn2Days: ctx.eventIn2Days,
    recentWorkouts: ctx.recentWorkouts,
    lastIntensity: ctx.recentWorkouts.lastIntensity,
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
  const ruleBasedRest = isRestDayRecommended(ctx.wellness);
  Logger.log("Decision: " + (ruleBasedRest ? "REST DAY" : "TRAIN"));

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
  logTestHeader("AI CUMULATIVE FATIGUE PREDICTION");

  const ctx = setupTestContext();

  Logger.log("--- Fetching Data ---");
  Logger.log("Current Fitness: CTL=" + (ctx.ctl?.toFixed(1) || 'N/A') +
    ", ATL=" + (ctx.atl?.toFixed(1) || 'N/A') +
    ", TSB=" + (ctx.tsb?.toFixed(1) || 'N/A'));

  const fitnessTrend = fetchFitnessTrend(14);
  Logger.log("Fitness trend: " + fitnessTrend.length + " days of data");

  Logger.log("Wellness: Recovery=" + (ctx.wellness.today?.recovery || 'N/A') + "%, HRV=" + (ctx.wellness.today?.hrv || 'N/A') +
    " | Status: " + (ctx.wellness.recoveryStatus || 'Unknown'));

  const workoutFeedback = fetchRecentActivityFeedback(14);
  Logger.log("Workout feedback: " + (workoutFeedback.summary?.totalWithFeedback || 0) + " activities with RPE/Feel");

  Logger.log("Phase: " + ctx.phase + " (" + ctx.phaseInfo.weeksOut + " weeks out)");

  // Run AI analysis
  Logger.log("\n--- AI Fatigue Analysis ---");
  const analysis = generateAICumulativeFatigueAnalysis(
    ctx.fitness,
    fitnessTrend,
    ctx.wellness,
    workoutFeedback,
    ctx.phaseInfo
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
      analysis.warningSigns.forEach(w => Logger.log("  ! " + w));
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
      analysis.recommendation.specificActions.forEach(a => Logger.log("    -> " + a));
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

// =========================================================
// WHOOP WELLNESS INTEGRATION TEST
// =========================================================

/**
 * Test Whoop API wellness integration
 * Tests both direct Whoop API and enhanced wellness fetching
 */
function testWhoopWellness() {
  logTestHeader("WHOOP WELLNESS INTEGRATION");

  // Check if Whoop is configured
  Logger.log("--- Configuration ---");
  const isConfigured = typeof isWhoopConfigured === 'function' && isWhoopConfigured();
  Logger.log("Whoop configured: " + isConfigured);

  if (!isConfigured) {
    Logger.log("\nWhoop not configured. To set up:");
    Logger.log("1. Add WHOOP_CONFIG to config.gs");
    Logger.log("2. Run authorizeWhoop() to complete OAuth");
    Logger.log("\nFalling back to Intervals.icu only...\n");
  }

  // Test enhanced wellness fetching
  Logger.log("\n--- Enhanced Wellness Fetch ---");
  const wellnessRecords = fetchWellnessDataEnhanced(7);

  if (wellnessRecords.length > 0) {
    const today = wellnessRecords[0];
    Logger.log("Today's data:");
    Logger.log("  Source: " + (today.source || 'intervals_icu'));
    Logger.log("  Date: " + today.date);
    Logger.log("  Recovery: " + (today.recovery != null ? today.recovery + "%" : "N/A"));
    Logger.log("  HRV: " + (today.hrv != null ? today.hrv + " ms" : "N/A"));
    Logger.log("  RHR: " + (today.restingHR != null ? today.restingHR + " bpm" : "N/A"));
    Logger.log("  Sleep: " + (today.sleep != null ? today.sleep.toFixed(1) + "h" : "N/A"));
    Logger.log("  SpO2: " + (today.spO2 != null ? today.spO2 + "%" : "N/A"));

    // Show if we got fresher data from Whoop
    if (today.source === 'whoop_api') {
      Logger.log("\nOK Using real-time Whoop API data (bypassing 8-hour sync delay)");
    } else {
      Logger.log("\n  Using Intervals.icu data (may be up to 8 hours old)");
    }
  } else {
    Logger.log("No wellness records found");
  }

  // Test wellness summary creation
  Logger.log("\n--- Wellness Summary ---");
  const summary = createWellnessSummary(wellnessRecords);
  if (summary.available) {
    Logger.log("Recovery Status: " + summary.recoveryStatus);
    Logger.log("Sleep Status: " + summary.sleepStatus);
    Logger.log("Intensity Modifier: " + (summary.intensityModifier * 100).toFixed(0) + "%");
    if (summary.aiEnhanced) {
      Logger.log("AI Reason: " + summary.personalizedReason);
    }
  } else {
    Logger.log("Wellness summary not available");
  }

  // If Whoop is configured, run full Whoop API test
  if (isConfigured) {
    Logger.log("\n--- Direct Whoop API Test ---");
    testWhoopApi();
  }

  Logger.log("\n=== TEST COMPLETE ===");
}

// =========================================================
// BASELINE TRACKING TESTS
// =========================================================

/**
 * Test HRV/RHR baseline tracking and deviation analysis
 */
function testBaselineTracking() {
  logTestHeader("BASELINE TRACKING");

  // Fetch 30 days of wellness data for baseline calculation
  Logger.log("\n--- Fetching 30 Days of Wellness Data ---");
  const wellnessRecords = fetchWellnessDataEnhanced(30);
  Logger.log("Records fetched: " + wellnessRecords.length);

  if (wellnessRecords.length < 7) {
    Logger.log("ERROR: Not enough data for baseline calculation (need at least 7 days)");
    return;
  }

  // Store/calculate baseline
  Logger.log("\n--- Calculating Baseline ---");
  const baseline = storeWellnessBaseline(wellnessRecords);

  if (!baseline) {
    Logger.log("ERROR: Failed to calculate baseline");
    return;
  }

  Logger.log("HRV Baseline (30d): " + (baseline.hrv.baseline30d ? baseline.hrv.baseline30d.toFixed(0) + " ms" : "N/A"));
  Logger.log("HRV StdDev: " + (baseline.hrv.stdDev30d ? baseline.hrv.stdDev30d.toFixed(1) + " ms" : "N/A"));
  Logger.log("HRV Range: " + (baseline.hrv.min30d || "N/A") + " - " + (baseline.hrv.max30d || "N/A") + " ms");
  Logger.log("HRV Data Points: " + baseline.hrv.dataPoints);

  Logger.log("\nRHR Baseline (30d): " + (baseline.rhr.baseline30d ? baseline.rhr.baseline30d.toFixed(0) + " bpm" : "N/A"));
  Logger.log("RHR StdDev: " + (baseline.rhr.stdDev30d ? baseline.rhr.stdDev30d.toFixed(1) + " bpm" : "N/A"));
  Logger.log("RHR Range: " + (baseline.rhr.min30d || "N/A") + " - " + (baseline.rhr.max30d || "N/A") + " bpm");
  Logger.log("RHR Data Points: " + baseline.rhr.dataPoints);

  // Analyze today vs baseline
  Logger.log("\n--- Today vs Baseline Analysis ---");
  const today = wellnessRecords[0];
  Logger.log("Today's HRV: " + (today.hrv || "N/A") + " ms");
  Logger.log("Today's RHR: " + (today.restingHR || "N/A") + " bpm");

  const analysis = analyzeWellnessVsBaseline(today);

  if (!analysis.available) {
    Logger.log("No deviation analysis available");
    return;
  }

  if (analysis.hrvDeviation?.available) {
    const hrv = analysis.hrvDeviation;
    Logger.log("\nHRV Deviation:");
    Logger.log("  Current: " + hrv.current + " ms");
    Logger.log("  Baseline: " + hrv.baseline.toFixed(0) + " ms");
    Logger.log("  Deviation: " + (hrv.deviationPercent >= 0 ? "+" : "") + hrv.deviationPercent.toFixed(1) + "%");
    Logger.log("  Z-Score: " + hrv.zScore.toFixed(2));
    Logger.log("  Status: " + hrv.status);
    Logger.log("  Interpretation: " + hrv.interpretation);
  }

  if (analysis.rhrDeviation?.available) {
    const rhr = analysis.rhrDeviation;
    Logger.log("\nRHR Deviation:");
    Logger.log("  Current: " + rhr.current + " bpm");
    Logger.log("  Baseline: " + rhr.baseline.toFixed(0) + " bpm");
    Logger.log("  Deviation: " + (rhr.deviationPercent >= 0 ? "+" : "") + rhr.deviationPercent.toFixed(1) + "%");
    Logger.log("  Z-Score: " + rhr.zScore.toFixed(2));
    Logger.log("  Status: " + rhr.status);
    Logger.log("  Interpretation: " + rhr.interpretation);
  }

  Logger.log("\nOverall Status: " + analysis.overallStatus);
  if (analysis.concerns?.length > 0) {
    Logger.log("Concerns: " + analysis.concerns.join(", "));
  }

  // Test full wellness summary with baseline analysis
  Logger.log("\n--- Full Wellness Summary ---");
  const summary = createWellnessSummary(wellnessRecords);

  if (summary.baselineAnalysis?.available) {
    Logger.log("Baseline Analysis included in summary: YES");
    Logger.log("Overall baseline status: " + summary.baselineAnalysis.overallStatus);
  } else {
    Logger.log("Baseline Analysis included in summary: NO");
  }

  Logger.log("Recovery Status: " + summary.recoveryStatus);
  Logger.log("AI Enhanced: " + summary.aiEnhanced);
  if (summary.personalizedReason) {
    Logger.log("Personalized Reason: " + summary.personalizedReason);
  }

  Logger.log("\n=== TEST COMPLETE ===");
}

/**
 * Test Z-Score Intensity Modifier
 * Tests continuous intensity scaling based on HRV/RHR z-scores
 */
function testZScoreIntensityModifier() {
  logTestHeader("Z-SCORE INTENSITY MODIFIER");

  const ctx = setupTestContext({ wellnessDays: 30 });
  const summary = ctx.wellness;

  if (!summary?.available) {
    Logger.log("ERROR: No wellness data available");
    return;
  }

  Logger.log("=== CURRENT VALUES ===");
  Logger.log("HRV: " + (summary.today?.hrv?.toFixed(0) || "N/A") + " ms");
  Logger.log("RHR: " + (summary.today?.restingHR || "N/A") + " bpm");
  Logger.log("Recovery Score: " + (summary.today?.recovery || "N/A") + "%");

  // Check baseline analysis
  const ba = summary.baselineAnalysis;
  if (!ba?.available) {
    Logger.log("\nNo baseline analysis available (need 30 days of data)");
    Logger.log("\n=== TEST COMPLETE ===");
    return;
  }

  Logger.log("\n=== BASELINE ANALYSIS ===");
  if (ba.hrvDeviation?.available) {
    const hrv = ba.hrvDeviation;
    Logger.log("\nHRV Deviation:");
    Logger.log("  Current: " + hrv.current + " ms");
    Logger.log("  30d Baseline: " + hrv.baseline.toFixed(0) + " ms");
    Logger.log("  Deviation: " + (hrv.deviationPercent >= 0 ? "+" : "") + hrv.deviationPercent.toFixed(1) + "%");
    Logger.log("  Z-Score: " + hrv.zScore.toFixed(2) + "σ");
    Logger.log("  Status: " + hrv.status);
  }

  if (ba.rhrDeviation?.available) {
    const rhr = ba.rhrDeviation;
    Logger.log("\nRHR Deviation:");
    Logger.log("  Current: " + rhr.current + " bpm");
    Logger.log("  30d Baseline: " + rhr.baseline.toFixed(0) + " bpm");
    Logger.log("  Deviation: " + (rhr.deviationPercent >= 0 ? "+" : "") + rhr.deviationPercent.toFixed(1) + "%");
    Logger.log("  Z-Score: " + rhr.zScore.toFixed(2) + "σ");
    Logger.log("  Status: " + rhr.status);
  }

  // Z-Score Intensity Modifier
  const zsi = ba.zScoreIntensity;
  if (zsi) {
    Logger.log("\n=== Z-SCORE INTENSITY MODIFIER ===");
    Logger.log("Modifier: " + (zsi.modifier * 100).toFixed(0) + "%");
    Logger.log("Confidence: " + zsi.confidence);
    Logger.log("Description: " + zsi.description);

    if (zsi.breakdown?.hrv) {
      Logger.log("\nHRV Contribution:");
      Logger.log("  Z-Score: " + zsi.breakdown.hrv.zScore.toFixed(2) + "σ");
      Logger.log("  Modifier: " + (zsi.breakdown.hrv.modifier * 100).toFixed(0) + "%");
      Logger.log("  " + zsi.breakdown.hrv.contribution);
    }

    if (zsi.breakdown?.rhr) {
      Logger.log("\nRHR Contribution:");
      Logger.log("  Z-Score: " + zsi.breakdown.rhr.zScore.toFixed(2) + "σ");
      Logger.log("  Inverted Z: " + zsi.breakdown.rhr.invertedZ.toFixed(2) + "σ");
      Logger.log("  Modifier: " + (zsi.breakdown.rhr.modifier * 100).toFixed(0) + "%");
      Logger.log("  " + zsi.breakdown.rhr.contribution);
    }
  }

  // Compare with discrete categories
  Logger.log("\n=== COMPARISON: Z-Score vs Discrete ===");
  Logger.log("Z-Score Intensity: " + (summary.intensityModifier * 100).toFixed(0) + "%");
  Logger.log("Recovery Status: " + summary.recoveryStatus);

  // Show what discrete would have been
  const discreteModifiers = {
    'Green': 100,
    'Yellow': 85,
    'Red': 75
  };
  let discreteWouldBe = 100;
  if (summary.recoveryStatus.includes('Red')) discreteWouldBe = 75;
  else if (summary.recoveryStatus.includes('Yellow')) discreteWouldBe = 85;
  Logger.log("Discrete would be: " + discreteWouldBe + "%");

  const diff = Math.round(summary.intensityModifier * 100) - discreteWouldBe;
  if (diff !== 0) {
    Logger.log("Difference: " + (diff > 0 ? "+" : "") + diff + "% (more precise with z-score)");
  } else {
    Logger.log("No difference in this case");
  }

  // Test the z-score to modifier mapping with sample values
  Logger.log("\n=== Z-SCORE TO MODIFIER MAPPING ===");
  const testZScores = [-2, -1.5, -1, -0.5, 0, 0.5, 1, 1.5, 2];
  testZScores.forEach(z => {
    const mod = zScoreToModifier(z);
    Logger.log("  z=" + (z >= 0 ? "+" : "") + z.toFixed(1) + " → " + (mod * 100).toFixed(0) + "%");
  });

  Logger.log("\n=== TEST COMPLETE ===");
}

/**
 * Test Illness Pattern Detection
 * Tests detection of illness markers from wellness data
 */
function testIllnessPatternDetection() {
  logTestHeader("ILLNESS PATTERN DETECTION");

  // This test needs raw wellness records for analysis
  const wellnessRecords = fetchWellnessDataEnhanced(7);

  if (!wellnessRecords || wellnessRecords.length < 2) {
    Logger.log("ERROR: Not enough wellness data (need at least 2 days)");
    return;
  }

  Logger.log("=== RECENT WELLNESS DATA ===");
  for (let i = 0; i < Math.min(3, wellnessRecords.length); i++) {
    const day = wellnessRecords[i];
    Logger.log("\nDay " + (i + 1) + " (" + day.date + "):");
    Logger.log("  HRV: " + (day.hrv || "N/A") + " ms");
    Logger.log("  RHR: " + (day.restingHR || "N/A") + " bpm");
    Logger.log("  Sleep: " + (day.sleep ? day.sleep.toFixed(1) + "h" : "N/A"));
    Logger.log("  Skin Temp: " + (day.skinTemp ? day.skinTemp.toFixed(1) + "°C" : "N/A"));
    Logger.log("  Recovery: " + (day.recovery || "N/A") + "%");
  }

  // Get baseline for context
  const baseline = getWellnessBaseline();
  if (baseline) {
    Logger.log("\n=== BASELINE VALUES ===");
    Logger.log("HRV Baseline: " + (baseline.hrv?.baseline30d?.toFixed(0) || "N/A") + " ms (±" + (baseline.hrv?.stdDev30d?.toFixed(1) || "?") + ")");
    Logger.log("RHR Baseline: " + (baseline.rhr?.baseline30d?.toFixed(0) || "N/A") + " bpm (±" + (baseline.rhr?.stdDev30d?.toFixed(1) || "?") + ")");
  } else {
    Logger.log("\n(No baseline available - need 30 days of data)");
  }

  // Run illness pattern check
  Logger.log("\n=== ILLNESS PATTERN ANALYSIS ===");
  const result = checkIllnessPattern();

  Logger.log("Detected: " + (result.detected ? "YES" : "NO"));
  Logger.log("Probability: " + result.probability);
  Logger.log("Consecutive Days: " + result.consecutiveDays);

  if (result.symptoms.length > 0) {
    Logger.log("\nSymptoms Identified:");
    result.symptoms.forEach(s => Logger.log("  • " + s));
  }

  if (result.dailyAnalysis.length > 0) {
    Logger.log("\n=== DAILY ANALYSIS ===");
    result.dailyAnalysis.forEach((day, i) => {
      Logger.log("\nDay " + (i + 1) + " (" + day.date + "):");
      Logger.log("  Score: " + day.score + " (>= 3 is concerning)");
      if (day.markers.length > 0) {
        Logger.log("  Markers: " + day.markers.join(", "));
      }
      if (day.details.rhr) {
        Logger.log("  RHR: " + day.details.rhr.value + " bpm (z=" + day.details.rhr.zScore.toFixed(2) + ")");
      }
      if (day.details.hrv) {
        Logger.log("  HRV: " + day.details.hrv.value + " ms (z=" + day.details.hrv.zScore.toFixed(2) + ")");
      }
      if (day.details.sleep) {
        Logger.log("  Sleep: " + day.details.sleep.value.toFixed(1) + "h");
      }
      if (day.details.skinTemp) {
        Logger.log("  Skin Temp: " + day.details.skinTemp.value.toFixed(1) + "°C (z=" + day.details.skinTemp.zScore.toFixed(2) + ")");
      }
    });
  }

  if (result.detected) {
    Logger.log("\n=== RECOMMENDATION ===");
    Logger.log(result.recommendation);
    Logger.log("\n=== TRAINING GUIDANCE ===");
    Logger.log(result.trainingGuidance);
  } else {
    Logger.log("\nNo illness pattern detected - training can proceed normally");
  }

  Logger.log("\n=== TEST COMPLETE ===");
}
