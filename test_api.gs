/**
 * IntervalCoach - API & Core Tests
 *
 * Tests for API connectivity and basic utility functions.
 * Run these from the Apps Script editor to verify API connections.
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
          paceStr = formatTestPace(a.average_speed);
        } else if (a.icu_average_speed) {
          paceStr = formatTestPace(a.icu_average_speed);
        } else if (a.distance > 0 && a.moving_time > 0) {
          // Calculate pace from distance (m) and time (s)
          const speedMs = a.distance / a.moving_time;
          paceStr = formatTestPace(speedMs) + " (calculated)";
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
function formatTestPace(metersPerSecond) {
  if (!metersPerSecond || metersPerSecond <= 0) return 'N/A';
  const secsPerKm = 1000 / metersPerSecond;
  const mins = Math.floor(secsPerKm / 60);
  const secs = Math.round(secsPerKm % 60);
  return mins + ":" + (secs < 10 ? "0" : "") + secs + "/km";
}

/**
 * Debug raw fitness data from Intervals.icu
 * Compare with what you see in the Intervals.icu UI
 */
function testRawFitnessData() {
  Logger.log("=== RAW FITNESS DATA FROM INTERVALS.ICU ===\n");
  requireValidConfig();

  const today = formatDateISO(new Date());

  // Fetch raw wellness data (contains CTL/ATL)
  const wellnessResult = fetchIcuApi("/athlete/0/wellness/" + today);

  if (wellnessResult.success && wellnessResult.data) {
    const w = wellnessResult.data;
    Logger.log("Date: " + today);
    Logger.log("CTL (Fitness): " + (w.ctl ?? 'N/A'));
    Logger.log("ATL (Fatigue): " + (w.atl ?? 'N/A'));

    if (w.ctl != null && w.atl != null) {
      const tsb = w.ctl - w.atl;
      Logger.log("TSB (Form): " + tsb.toFixed(1));

      // Form zone interpretation
      let zone;
      if (tsb >= 25) zone = "Transition (detraining)";
      else if (tsb >= 5) zone = "Fresh (blue)";
      else if (tsb >= -10) zone = "Grey Zone";
      else if (tsb >= -30) zone = "Optimal (green)";
      else zone = "HIGH RISK (red)";

      Logger.log("Zone: " + zone);
    }

    Logger.log("\nRaw wellness object keys: " + Object.keys(w).join(', '));
  } else {
    Logger.log("Failed to fetch wellness: " + (wellnessResult.error || 'unknown'));
  }

  // Also check what fetchFitnessMetrics returns
  Logger.log("\n=== VIA fetchFitnessMetrics() ===");
  const fitness = fetchFitnessMetrics();
  Logger.log("CTL: " + (fitness.ctl ?? 'N/A'));
  Logger.log("ATL: " + (fitness.atl ?? 'N/A'));
  Logger.log("TSB: " + (fitness.tsb ?? 'N/A'));
  Logger.log("Ramp Rate: " + (fitness.rampRate ?? 'N/A'));

  Logger.log("\n=== TEST COMPLETE ===");
}

/**
 * Test fetching recent rides for an athlete
 */
function testFetchRecentRides() {
  Logger.log("=== RECENT RIDES TEST ===");

  // Fetch last 7 days of activities
  const result = fetchRecentActivityFeedback(7);
  const activities = result.activities || [];

  if (activities.length === 0) {
    Logger.log("No activities found in the last 7 days");
    return;
  }

  Logger.log("Found " + activities.length + " activities:\n");

  activities.forEach(function(a, i) {
    Logger.log((i + 1) + ". " + a.name);
    Logger.log("   Type: " + a.type);
    Logger.log("   Date: " + a.date);
    Logger.log("   Duration: " + (a.duration ? Math.round(a.duration / 60) + " min" : "N/A"));
    Logger.log("   TSS: " + (a.tss || "N/A"));
    if (a.avgPower) Logger.log("   Avg Power: " + a.avgPower + "W");
    if (a.avgHr) Logger.log("   Avg HR: " + a.avgHr + " bpm");
    if (a.rpe) Logger.log("   RPE: " + a.rpe + "/10");
    if (a.feel) Logger.log("   Feel: " + a.feel + "/5");
    Logger.log("");
  });
}

/**
 * Debug Whoop recovery data vs IntervalCoach interpretation
 * Compare what Whoop shows vs what IntervalCoach uses
 */
function debugWhoopRecovery() {
  Logger.log("=== WHOOP RECOVERY DEBUG ===\n");

  // Check if Whoop is configured
  if (typeof isWhoopConfigured !== 'function' || !isWhoopConfigured()) {
    Logger.log("Whoop is not configured");
    return;
  }

  // Raw Whoop API data
  Logger.log("--- Raw Whoop API Data ---");
  const whoopRecovery = getWhoopCurrentRecovery();
  Logger.log("Recovery Score: " + (whoopRecovery.recovery != null ? whoopRecovery.recovery + "%" : "N/A"));
  Logger.log("HRV: " + (whoopRecovery.hrv || "N/A") + " ms");
  Logger.log("Resting HR: " + (whoopRecovery.restingHR || "N/A") + " bpm");
  Logger.log("Created At: " + (whoopRecovery.createdAt || "N/A"));
  Logger.log("Available: " + whoopRecovery.available);
  if (whoopRecovery.reason) Logger.log("Reason: " + whoopRecovery.reason);

  // What IntervalCoach does with it
  Logger.log("\n--- IntervalCoach Interpretation ---");
  const wellness = createWellnessSummary(fetchWellnessDataEnhanced(7));
  Logger.log("Recovery Status: " + wellness.recoveryStatus);
  Logger.log("Intensity Modifier: " + (wellness.intensityModifier * 100).toFixed(0) + "%");
  Logger.log("Sleep Status: " + wellness.sleepStatus);
  Logger.log("AI Enhanced: " + wellness.aiEnhanced);
  if (wellness.personalizedReason) {
    Logger.log("AI Reason: " + wellness.personalizedReason);
  }

  // Z-Score analysis if available
  if (wellness.zScoreIntensity) {
    Logger.log("\n--- Z-Score Analysis ---");
    Logger.log("Z-Score Modifier: " + (wellness.zScoreIntensity.modifier * 100).toFixed(0) + "%");
    Logger.log("Confidence: " + wellness.zScoreIntensity.confidence);
    Logger.log("Description: " + wellness.zScoreIntensity.description);
  }

  // Show thresholds for reference
  Logger.log("\n--- Recovery Thresholds ---");
  Logger.log("RED (rest): < " + TRAINING_CONSTANTS.RECOVERY.RED_THRESHOLD + "%");
  Logger.log("YELLOW (reduced): " + TRAINING_CONSTANTS.RECOVERY.RED_THRESHOLD + "-" + TRAINING_CONSTANTS.RECOVERY.GREEN_THRESHOLD + "%");
  Logger.log("GREEN (full): >= " + TRAINING_CONSTANTS.RECOVERY.GREEN_THRESHOLD + "%");

  Logger.log("\n=== DEBUG COMPLETE ===");
}

/**
 * List recent workouts from Intervals.icu
 */
function listRecentWorkouts() {
  const today = formatDateISO(new Date());
  const weekAgo = formatDateISO(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000));

  const result = fetchIcuApi(`/athlete/0/events?oldest=${weekAgo}&newest=${today}`);
  if (!result.success) {
    Logger.log("Failed: " + result.error);
    return;
  }

  const workouts = result.data.filter(e => e.category === 'WORKOUT');
  Logger.log("=== RECENT WORKOUTS ===\n");
  workouts.forEach(w => {
    Logger.log(`${w.start_date_local || w.date}: ${w.name}`);
    Logger.log(`  ID: ${w.id}`);
    Logger.log(`  Type: ${w.type || 'N/A'}`);
    Logger.log("");
  });

  if (workouts.length === 0) {
    Logger.log("No workouts found in the last 7 days");
  }
}

/**
 * Test workout generation with TextEvent check
 * Generates a simple workout and checks if TextEvents are included
 */
function testWorkoutTextEvents() {
  Logger.log("=== TEST WORKOUT TEXT EVENTS ===\n");

  // Simple test prompt for a short endurance workout
  const testPrompt = `Generate a simple 30-minute Zwift endurance workout in valid ZWO XML format.

REQUIREMENTS:
1. Include at least 5 TextEvent messages with motivational text in Dutch
2. Nest TextEvents inside workout segments like: <SteadyState Duration="300" Power="0.65"><textevent timeoffset="10" message="Lekker bezig!"/></SteadyState>
3. Include warmup, main set, and cooldown
4. Use Power values as FTP percentage (0.65 = 65% FTP)

Return ONLY valid JSON with this structure:
{
  "xml": "<workout_file>...</workout_file>",
  "explanation": "Brief description"
}`;

  Logger.log("Calling Gemini API...");
  const result = callGeminiAPI(testPrompt);

  if (!result.success) {
    Logger.log("ERROR: " + result.error);
    return;
  }

  Logger.log("API call successful\n");

  // Check for TextEvents
  const xml = result.xml || '';
  const textEventMatches = xml.match(/<textevent[^>]*>/gi) || [];
  Logger.log("TextEvents found: " + textEventMatches.length);

  if (textEventMatches.length > 0) {
    Logger.log("\nSample TextEvents:");
    textEventMatches.slice(0, 5).forEach((te, i) => {
      Logger.log("  " + (i + 1) + ". " + te);
    });
  } else {
    Logger.log("\n⚠️ NO TextEvents in generated XML!");
  }

  Logger.log("\n--- First 1500 chars of ZWO ---");
  Logger.log(xml.substring(0, 1500));

  // Validate structure
  const hasSteadyState = xml.includes('<SteadyState') || xml.includes('<Steadystate');
  const hasWarmup = xml.includes('<Warmup') || xml.includes('<warmup');
  const hasCooldown = xml.includes('<Cooldown') || xml.includes('<cooldown');

  Logger.log("\n--- Structure Check ---");
  Logger.log("Has SteadyState: " + hasSteadyState);
  Logger.log("Has Warmup: " + hasWarmup);
  Logger.log("Has Cooldown: " + hasCooldown);

  Logger.log("\n=== TEST COMPLETE ===");
}

/**
 * Check ZWO content for a specific workout
 * Run listRecentWorkouts() first to get the ID
 */
function checkWorkoutZwo(workoutId) {
  // Default to most recent if not specified
  if (!workoutId) {
    workoutId = 86368140; // Today's workout
  }

  Logger.log("=== CHECKING WORKOUT ZWO ===");
  Logger.log("Workout ID: " + workoutId);

  const result = fetchIcuApi(`/athlete/0/events/${workoutId}`);
  if (!result.success) {
    Logger.log("Failed to fetch workout: " + result.error);
    return;
  }

  const workout = result.data;
  Logger.log("Name: " + workout.name);
  Logger.log("Type: " + workout.type);

  // Check if there's a zwo_file or workout_doc
  if (workout.workout_doc) {
    const doc = workout.workout_doc;
    Logger.log("\n--- Workout Structure ---");
    Logger.log("Steps: " + (doc.steps ? doc.steps.length : 0));

    // Check for text/messages in steps
    let messageCount = 0;
    if (doc.steps) {
      doc.steps.forEach((step, i) => {
        if (step.text) {
          messageCount++;
          Logger.log(`Step ${i}: "${step.text}"`);
        }
      });
    }
    Logger.log("Total messages in workout_doc: " + messageCount);
  }

  // Check raw file content if available
  if (workout.file_contents) {
    Logger.log("\n--- ZWO File Content ---");
    const textEvents = (workout.file_contents.match(/<textevent/gi) || []).length;
    Logger.log("TextEvent count: " + textEvents);

    if (textEvents > 0) {
      // Show first few text events
      const matches = workout.file_contents.match(/<textevent[^>]*>/gi) || [];
      Logger.log("Sample TextEvents:");
      matches.slice(0, 5).forEach(m => Logger.log("  " + m));
    } else {
      Logger.log("NO TextEvents found in ZWO!");
      Logger.log("\nFirst 1000 chars of ZWO:");
      Logger.log(workout.file_contents.substring(0, 1000));
    }
  } else {
    Logger.log("\nNo file_contents in API response");
    Logger.log("Available fields: " + Object.keys(workout).join(", "));
  }
}
