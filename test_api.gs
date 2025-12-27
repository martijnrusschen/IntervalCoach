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
