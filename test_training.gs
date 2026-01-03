/**
 * IntervalCoach - Training Load & Adaptation Tests
 *
 * Tests for training load advisor, adaptive training, and gap analysis.
 * Run these from the Apps Script editor to test training features.
 */

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
    const status = c.status === 'completed' ? 'OK' : 'X';
    Logger.log(`  ${status} ${c.date}: ${c.planned.workoutType} -> ${c.actual?.workoutType || 'SKIPPED'}`);
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

/**
 * Debug function to show exactly how week progress TSS is calculated
 * Run this to see which planned workouts are being detected
 */
function testWeekProgressDebug() {
  Logger.log("=== WEEK PROGRESS DEBUG ===\n");
  requireValidConfig();

  const today = new Date();
  const dayOfWeek = today.getDay(); // 0 = Sunday

  // Calculate week boundaries (Monday to Sunday)
  const monday = new Date(today);
  monday.setDate(today.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);

  const startStr = formatDateISO(monday);
  const weekEndStr = formatDateISO(sunday);
  const todayStr = formatDateISO(today);

  Logger.log("Week: " + startStr + " to " + weekEndStr);
  Logger.log("Today: " + todayStr + " (day " + dayOfWeek + ")\n");

  // Fetch ALL events for the entire week
  const eventsResult = fetchIcuApi("/athlete/0/events?oldest=" + startStr + "&newest=" + weekEndStr);

  Logger.log("--- All Week Events ---");
  if (eventsResult.success && eventsResult.data) {
    eventsResult.data.forEach((e, i) => {
      Logger.log((i+1) + ". " + e.name);
      Logger.log("   Category: " + e.category);
      Logger.log("   Date: " + e.start_date_local);
      Logger.log("   icu_training_load: " + (e.icu_training_load || 'N/A'));
      Logger.log("   Description: " + (e.description || '').substring(0, 100));
      const tssMatch = e.description?.match(/TSS.*?(\d+)/);
      Logger.log("   TSS from description: " + (tssMatch ? tssMatch[1] : 'N/A'));
    });
  }

  // Filter for planned workouts (same logic as checkWeekProgress)
  Logger.log("\n--- Filtered Planned Workouts ---");
  if (eventsResult.success && eventsResult.data) {
    const plannedWorkouts = eventsResult.data.filter(e => {
      // Our generated workouts or placeholders
      const isOurWorkout = e.category === 'WORKOUT' &&
        (e.description?.includes('[Weekly Plan]') || e.name?.match(/^(Ride|Run|IntervalCoach)/i));
      // Any race/event (A, B, C) - these all have planned TSS
      const isRaceEvent = e.category === 'RACE_A' || e.category === 'RACE_B' || e.category === 'RACE_C';
      return isOurWorkout || isRaceEvent;
    });

    Logger.log("Found " + plannedWorkouts.length + " planned workouts:");
    let totalTSS = 0;
    plannedWorkouts.forEach((e, i) => {
      const tssMatch = e.description?.match(/TSS.*?(\d+)/);
      const tss = tssMatch ? parseInt(tssMatch[1]) : (e.icu_training_load || 60);
      totalTSS += tss;
      Logger.log((i+1) + ". " + e.name + " -> TSS: " + tss);
      Logger.log("   Source: " + (tssMatch ? "description" : (e.icu_training_load ? "icu_training_load" : "default 60")));
    });
    Logger.log("\nTotal Planned TSS: " + totalTSS);
  }

  // Also show actual completed
  Logger.log("\n--- Completed Activities ---");
  const activitiesResult = fetchIcuApi("/athlete/0/activities?oldest=" + startStr + "&newest=" + todayStr);
  if (activitiesResult.success && activitiesResult.data) {
    const sportActivities = activitiesResult.data.filter(a =>
      (a.type === 'Ride' || a.type === 'VirtualRide' || a.type === 'Run' || a.type === 'VirtualRun') &&
      a.icu_training_load && a.icu_training_load > 0
    );
    let completedTSS = 0;
    sportActivities.forEach((a, i) => {
      completedTSS += a.icu_training_load || 0;
      Logger.log((i+1) + ". " + a.name + " -> TSS: " + (a.icu_training_load || 0));
    });
    Logger.log("\nTotal Completed TSS: " + completedTSS);
    Logger.log("Completed Sessions: " + sportActivities.length);
  }

  Logger.log("\n=== DEBUG COMPLETE ===");
}

// =========================================================
// FTP TEST SUGGESTION TEST
// =========================================================

/**
 * Test FTP test suggestion logic
 */
function testFtpTestSuggestion() {
  Logger.log("=== FTP TEST SUGGESTION TEST ===");

  // Get current fitness metrics
  const fitnessMetrics = fetchFitnessMetrics();
  Logger.log("\n--- Current Fitness ---");
  Logger.log("CTL: " + (fitnessMetrics.ctl?.toFixed(1) || 'N/A'));
  Logger.log("TSB: " + (fitnessMetrics.tsb?.toFixed(1) || 'N/A'));
  Logger.log("eFTP from metrics: " + (fitnessMetrics.eftp || 'N/A') + "W");

  // Get wellness data
  const wellness = fetchWellnessDataEnhanced();
  Logger.log("\n--- Wellness ---");
  Logger.log("Recovery Score: " + (wellness.today?.recovery || wellness.recovery || 'N/A'));
  Logger.log("Recovery Status: " + (wellness.recoveryStatus || 'Unknown'));

  // Get phase info
  const goals = fetchUpcomingGoals();
  Logger.log("\n--- Goals ---");
  Logger.log("Primary Goal: " + (goals.primaryGoal?.name || 'None'));
  Logger.log("All Goals: " + (goals.allGoals?.map(g => g.priority + ': ' + g.name).join(', ') || 'None'));

  const phaseInfo = calculateTrainingPhase(fitnessMetrics, goals);
  Logger.log("\n--- Phase ---");
  Logger.log("Phase: " + phaseInfo.phaseName);
  Logger.log("Weeks Out: " + (phaseInfo.weeksOut || 'N/A'));

  // Check FTP test suggestion
  Logger.log("\n--- FTP Test Check ---");
  const suggestion = checkFtpTestSuggestion(fitnessMetrics, wellness, phaseInfo);

  Logger.log("Suggest Test: " + suggestion.suggest);
  Logger.log("Days Since Update: " + (suggestion.daysSinceUpdate || 'N/A'));
  Logger.log("Current eFTP: " + (suggestion.currentEftp || 'N/A') + "W");

  if (suggestion.suggest) {
    Logger.log("✅ Reason: " + suggestion.reason);
  } else {
    Logger.log("❌ Blockers:");
    suggestion.blockers.forEach(b => Logger.log("  - " + b));
  }

  Logger.log("\n=== TEST COMPLETE ===");
}
