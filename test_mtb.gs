/**
 * Test specifically for MTB / No Power analysis logic
 */
function testMTBAnalysis() {
  Logger.log("=== TESTING MTB / NO POWER ANALYSIS ===\n");
  
  // 1. Try to find a real activity without power first
  const today = new Date();
  const weeksAgo = new Date();
  weeksAgo.setDate(today.getDate() - 14);
  
  const endpoint = `/athlete/0/activities?oldest=${formatDateISO(weeksAgo)}&newest=${formatDateISO(today)}`;
  const result = fetchIcuApi(endpoint);
  
  let targetActivity = null;
  let isMock = false;

  if (result.success && result.data) {
    // Look for a ride with no power
    targetActivity = result.data.find(a => 
      (a.type === 'Ride' || a.type === 'VirtualRide') && 
      (!a.icu_average_watts || a.icu_average_watts === 0)
    );
  }

  // 2. If no real activity found, create a mock one
  if (!targetActivity) {
    Logger.log("ℹ️ No recent real 'No Power' rides found. Using a MOCK activity for testing.\n");
    isMock = true;
    targetActivity = {
      id: "mock_mtb_123",
      name: "Mock MTB Ride (No Power)",
      type: "Ride",
      start_date_local: formatDateISO(today) + "T10:00:00",
      moving_time: 3600, // 60 min
      icu_training_load: 65, // hrTSS
      icu_intensity: 0.85, // estimated from HR
      average_heartrate: 155,
      max_heartrate: 175,
      icu_average_watts: 0, // NO POWER
      icu_rpe: 7,
      feel: 2, // Good
      source: "STRAVA"
    };
  } else {
    Logger.log("✓ Found real activity: " + targetActivity.name + " (" + targetActivity.start_date_local + ")");
  }

  Logger.log("Analyzing activity: " + targetActivity.name);
  Logger.log("Avg Power: " + (targetActivity.icu_average_watts || 0) + " W");
  Logger.log("Avg HR: " + (targetActivity.average_heartrate || "N/A") + " bpm");

  // Fetch context
  const wellnessRecords = fetchWellnessData(7);
  const wellness = createWellnessSummary(wellnessRecords);
  const fitness = fetchFitnessMetrics();
  const powerCurve = fetchPowerCurve();
  const goals = fetchUpcomingGoals();
  const powerProfile = analyzePowerProfile(powerCurve, goals);

  // Run analysis
  const analysis = generatePostWorkoutAnalysis(targetActivity, wellness, fitness, powerProfile, null, 'cycling');

  Logger.log("\n--- Analysis Results ---");
  if (analysis.success) {
    Logger.log("✅ Analysis Successful");
    Logger.log("Category Identified: " + analysis.activityCategory);
    // Check if our specific logic triggered
    // We can't see internal variables, but we can check the output text context
    // The prompt would have generated insights based on HR
    Logger.log("Key Insight: " + analysis.keyInsight);
    Logger.log("Effectiveness: " + analysis.effectiveness + "/10");
  } else {
    Logger.log("❌ Analysis Failed: " + analysis.error);
  }
  
  Logger.log("\n=== TEST COMPLETE ===");
}
