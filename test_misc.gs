/**
 * IntervalCoach - Miscellaneous & Discovery Tests
 *
 * Debug functions and discovery tests for exploring API data.
 * Run these from the Apps Script editor to discover available data.
 */

// =========================================================
// RECENT WORKOUTS DEBUG
// =========================================================

/**
 * Debug function to diagnose recent workout types detection
 * Shows raw API data vs what getRecentWorkoutTypes returns
 */
function testRecentWorkoutsDebug() {
  logTestHeader("RECENT WORKOUTS DEBUG");

  const today = new Date();
  const twoWeeksAgo = new Date(today);
  twoWeeksAgo.setDate(today.getDate() - 14);

  const todayStr = formatDateISO(today);
  const oldestStr = formatDateISO(twoWeeksAgo);

  Logger.log("Date range: " + oldestStr + " to " + todayStr + " (14 days)\n");

  // 1. Raw API activities
  Logger.log("=== RAW API ACTIVITIES ===");
  const activitiesResult = fetchIcuApi("/athlete/0/activities?oldest=" + oldestStr + "&newest=" + todayStr);

  if (!activitiesResult.success) {
    Logger.log("ERROR: " + activitiesResult.error);
    return;
  }

  const activities = activitiesResult.data || [];
  Logger.log("Total activities from API: " + activities.length + "\n");

  activities.forEach((a, i) => {
    const isSport = isSportActivity(a);
    const classified = isSport ? classifyActivityType(a) : null;

    Logger.log((i + 1) + ". " + a.name);
    Logger.log("   Date: " + (a.start_date_local || "?"));
    Logger.log("   Type: " + a.type);
    Logger.log("   Moving time: " + Math.round((a.moving_time || 0) / 60) + " min");
    Logger.log("   TSS: " + (a.icu_training_load || 0));
    Logger.log("   isSportActivity: " + isSport);
    if (classified) {
      Logger.log("   Classified as: " + classified.type + " (" + classified.sport + ")");
    } else if (isSport) {
      Logger.log("   Classified as: NULL (too short or no zone data)");
    }
    Logger.log("");
  });

  // 2. getRecentWorkoutTypes result
  Logger.log("=== getRecentWorkoutTypes() RESULT (14 days) ===");
  const recentTypes = getRecentWorkoutTypes();
  Logger.log("Rides: " + (recentTypes.rides.length > 0 ? recentTypes.rides.join(", ") : "None"));
  Logger.log("Runs: " + (recentTypes.runs.length > 0 ? recentTypes.runs.join(", ") : "None"));
  Logger.log("All: " + (recentTypes.all.length > 0 ? recentTypes.all.join(", ") : "None"));

  // 3. Check for discrepancies
  Logger.log("\n=== ANALYSIS ===");
  const apiRides = activities.filter(a => a.type === 'Ride' || a.type === 'VirtualRide');
  const apiRuns = activities.filter(a => a.type === 'Run' || a.type === 'VirtualRun');

  Logger.log("API Rides: " + apiRides.length + " | Detected: " + recentTypes.rides.length);
  Logger.log("API Runs: " + apiRuns.length + " | Detected: " + recentTypes.runs.length);

  if (apiRides.length !== recentTypes.rides.length) {
    Logger.log("\n⚠️ RIDE MISMATCH - some rides not classified");
    apiRides.forEach(a => {
      const classified = classifyActivityType(a);
      if (!classified) {
        Logger.log("  Missing: " + a.name + " (" + Math.round(a.moving_time / 60) + " min)");
      }
    });
  }

  if (apiRuns.length !== recentTypes.runs.length) {
    Logger.log("\n⚠️ RUN MISMATCH - some runs not classified");
    apiRuns.forEach(a => {
      const classified = classifyActivityType(a);
      if (!classified) {
        Logger.log("  Missing: " + a.name + " (" + Math.round(a.moving_time / 60) + " min)");
      }
    });
  }

  Logger.log("\n=== TEST COMPLETE ===");
}

// =========================================================
// ACTIVITY DISCOVERY TESTS
// =========================================================

/**
 * Test function to dump all available fields from a recent activity
 * Useful for discovering what fields are available in the API (e.g., notes)
 */
function testActivityFields() {
  Logger.log("=== ACTIVITY FIELDS DISCOVERY ===");
  Logger.log("Fetching recent activity to discover available fields...\n");

  const today = new Date();
  const weekAgo = new Date(today);
  weekAgo.setDate(today.getDate() - 7);

  const result = fetchIcuApi("/athlete/0/activities?oldest=" + formatDateISO(weekAgo) + "&newest=" + formatDateISO(today));

  if (!result.success) {
    Logger.log("ERROR: Failed to fetch activities - " + result.error);
    return;
  }

  if (!result.data || result.data.length === 0) {
    Logger.log("No activities found in last 7 days");
    return;
  }

  // Find first real activity with TSS
  const activity = result.data.find(a => a.icu_training_load && a.icu_training_load > 0) || result.data[0];

  Logger.log("Activity: " + activity.name);
  Logger.log("Date: " + activity.start_date_local);
  Logger.log("ID: " + activity.id);
  Logger.log("\n--- ALL FIELDS ---");

  // Sort keys alphabetically for easier reading
  const keys = Object.keys(activity).sort();

  // Group by type
  const noteFields = [];
  const feedbackFields = [];
  const otherFields = [];

  keys.forEach(key => {
    const value = activity[key];
    const keyLower = key.toLowerCase();

    // Check for potential note/feedback fields
    if (keyLower.includes('note') || keyLower.includes('comment') || keyLower.includes('description')) {
      noteFields.push({ key, value });
    } else if (keyLower.includes('rpe') || keyLower.includes('feel') || keyLower.includes('feedback') || keyLower.includes('rating')) {
      feedbackFields.push({ key, value });
    } else {
      otherFields.push({ key, value });
    }
  });

  // Log note-related fields first
  if (noteFields.length > 0) {
    Logger.log("\n=== NOTE/COMMENT FIELDS ===");
    noteFields.forEach(({ key, value }) => {
      const displayValue = typeof value === 'object' ? JSON.stringify(value) : value;
      Logger.log("  " + key + ": " + (displayValue || "(empty)"));
    });
  }

  // Log feedback fields
  if (feedbackFields.length > 0) {
    Logger.log("\n=== FEEDBACK FIELDS (RPE/Feel) ===");
    feedbackFields.forEach(({ key, value }) => {
      Logger.log("  " + key + ": " + (value != null ? value : "(null)"));
    });
  }

  // Log all other fields
  Logger.log("\n=== OTHER FIELDS ===");
  otherFields.forEach(({ key, value }) => {
    // Skip large arrays/objects for readability
    if (Array.isArray(value) && value.length > 3) {
      Logger.log("  " + key + ": [Array with " + value.length + " items]");
    } else if (typeof value === 'object' && value !== null) {
      Logger.log("  " + key + ": " + JSON.stringify(value).substring(0, 100));
    } else {
      Logger.log("  " + key + ": " + (value != null ? value : "(null)"));
    }
  });

  Logger.log("\n=== ACTIVITY FIELDS DISCOVERY COMPLETE ===");
  Logger.log("Total fields: " + keys.length);
}

/**
 * Test function to discover NOTE events on the calendar
 * These are athlete feedback notes that can be used for training adjustments
 */
function testCalendarNotes() {
  Logger.log("=== CALENDAR NOTES DISCOVERY ===");
  Logger.log("Searching for NOTE events in the last 14 days...\n");

  const today = new Date();
  const twoWeeksAgo = new Date(today);
  twoWeeksAgo.setDate(today.getDate() - 14);

  // Fetch events with category filter for NOTES
  const endpoint = "/athlete/0/events?oldest=" + formatDateISO(twoWeeksAgo) +
                   "&newest=" + formatDateISO(today) +
                   "&category=NOTE";
  const result = fetchIcuApi(endpoint);

  if (!result.success) {
    Logger.log("ERROR: Failed to fetch notes - " + result.error);
    return;
  }

  const notes = result.data || [];
  Logger.log("Found " + notes.length + " NOTE event(s)\n");

  if (notes.length === 0) {
    Logger.log("No notes found. Try adding a note in Intervals.icu calendar.");
    Logger.log("Notes can be used for athlete feedback like:");
    Logger.log("  - 'Legs felt heavy today'");
    Logger.log("  - 'Great session, felt strong'");
    Logger.log("  - 'Skipping workout - coming down with cold'");

    // Also check what categories exist
    Logger.log("\n--- Checking all event categories in period ---");
    const allEventsEndpoint = "/athlete/0/events?oldest=" + formatDateISO(twoWeeksAgo) +
                              "&newest=" + formatDateISO(today);
    const allResult = fetchIcuApi(allEventsEndpoint);

    if (allResult.success && allResult.data) {
      const categories = {};
      allResult.data.forEach(e => {
        categories[e.category] = (categories[e.category] || 0) + 1;
      });
      Logger.log("Event categories found:");
      Object.keys(categories).sort().forEach(cat => {
        Logger.log("  " + cat + ": " + categories[cat] + " event(s)");
      });
    }
    return;
  }

  // Display each note
  notes.forEach((note, i) => {
    Logger.log("--- Note " + (i + 1) + " ---");
    Logger.log("Date: " + (note.start_date_local || note.start_date || "Unknown"));
    Logger.log("Name: " + (note.name || "(no name)"));
    Logger.log("Description: " + (note.description || "(no description)"));
    Logger.log("Category: " + note.category);
    Logger.log("ID: " + note.id);

    // Log all fields for discovery
    Logger.log("All fields: " + Object.keys(note).join(", "));
    Logger.log("");
  });

  Logger.log("=== CALENDAR NOTES DISCOVERY COMPLETE ===");
}

/**
 * Test function to explore sport settings and zones from Intervals.icu
 * Used for personalized zone boundaries feature
 */
function testSportSettings() {
  Logger.log("=== SPORT SETTINGS & ZONES DISCOVERY ===\n");

  // 1. Fetch athlete info (includes sportSettings)
  Logger.log("--- Fetching Athlete Info ---");
  const athleteResult = fetchIcuApi("/athlete/0");

  if (!athleteResult.success) {
    Logger.log("ERROR: Failed to fetch athlete info - " + athleteResult.error);
    return;
  }

  const athlete = athleteResult.data;
  Logger.log("Athlete ID: " + athlete.id);
  Logger.log("Name: " + athlete.name);

  // 2. Check sportSettings
  if (athlete.sportSettings && athlete.sportSettings.length > 0) {
    Logger.log("\n--- Sport Settings ---");
    athlete.sportSettings.forEach((sport, i) => {
      Logger.log("\n[" + (sport.type || sport.types?.join(",") || "Sport " + i) + "]");
      Logger.log("  FTP: " + (sport.ftp || "N/A") + "W");
      Logger.log("  Indoor FTP: " + (sport.indoor_ftp || "N/A") + "W");
      Logger.log("  LTHR: " + (sport.lthr || "N/A") + " bpm");
      Logger.log("  Max HR: " + (sport.max_hr || "N/A") + " bpm");
      Logger.log("  Resting HR: " + (sport.resting_hr || "N/A") + " bpm");
      Logger.log("  Threshold Pace: " + (sport.threshold_pace || "N/A"));

      // Log power zones if available
      if (sport.power_zones) {
        Logger.log("  Power Zones: " + JSON.stringify(sport.power_zones));
      }
      if (sport.hr_zones) {
        Logger.log("  HR Zones: " + JSON.stringify(sport.hr_zones));
      }
      if (sport.pace_zones) {
        Logger.log("  Pace Zones: " + JSON.stringify(sport.pace_zones));
      }

      // Log all fields for discovery
      Logger.log("  All fields: " + Object.keys(sport).join(", "));
    });
  } else {
    Logger.log("No sportSettings found on athlete object");
  }

  // 3. Try fetching sport-settings endpoint directly
  Logger.log("\n--- Direct Sport Settings Endpoint ---");
  const settingsResult = fetchIcuApi("/athlete/0/sport-settings");

  if (settingsResult.success && settingsResult.data) {
    const settings = Array.isArray(settingsResult.data) ? settingsResult.data : [settingsResult.data];
    settings.forEach((s, i) => {
      Logger.log("\nSport " + i + ":");
      Logger.log("  " + JSON.stringify(s).substring(0, 500));
    });
  } else {
    Logger.log("Could not fetch sport-settings: " + (settingsResult.error || "No data"));
  }

  // 4. Check for zone-related data in recent activities
  Logger.log("\n--- Zone Data from Recent Activities ---");
  const today = new Date();
  const weekAgo = new Date(today);
  weekAgo.setDate(today.getDate() - 7);

  const activitiesResult = fetchIcuApi("/athlete/0/activities?oldest=" + formatDateISO(weekAgo) +
                                       "&newest=" + formatDateISO(today));

  if (activitiesResult.success && activitiesResult.data?.length > 0) {
    const activity = activitiesResult.data.find(a => a.icu_training_load > 0) || activitiesResult.data[0];
    Logger.log("Sample activity: " + activity.name);
    Logger.log("  Decoupling: " + (activity.decoupling != null ? activity.decoupling + "%" : "N/A"));
    Logger.log("  Efficiency Factor: " + (activity.icu_efficiency_factor || "N/A"));
    Logger.log("  HR Zone Times: " + (activity.icu_hr_zone_times ? activity.icu_hr_zone_times.join(", ") : "N/A"));
    Logger.log("  Power Zones: " + (activity.icu_power_zones ? activity.icu_power_zones.join(", ") : "N/A"));
    Logger.log("  HR Zones: " + (activity.icu_hr_zones ? activity.icu_hr_zones.join(", ") : "N/A"));
    Logger.log("  Pace Zones: " + (activity.pace_zones ? activity.pace_zones.join(", ") : "N/A"));
  }

  Logger.log("\n=== SPORT SETTINGS & ZONES DISCOVERY COMPLETE ===");
}

/**
 * Test function to find notes on activities (not calendar events)
 * Looks at the description and other text fields on completed activities
 */
function testActivityNotes() {
  Logger.log("=== ACTIVITY NOTES DISCOVERY ===");
  Logger.log("Checking description/notes on recent activities...\n");

  const today = new Date();
  const twoWeeksAgo = new Date(today);
  twoWeeksAgo.setDate(today.getDate() - 14);

  const result = fetchIcuApi("/athlete/0/activities?oldest=" + formatDateISO(twoWeeksAgo) +
                             "&newest=" + formatDateISO(today));

  if (!result.success) {
    Logger.log("ERROR: Failed to fetch activities - " + result.error);
    return;
  }

  const activities = result.data || [];
  Logger.log("Found " + activities.length + " activities\n");

  // Check each activity for notes/description
  let notesFound = 0;
  activities.forEach((a, i) => {
    const hasDescription = a.description && a.description.trim().length > 0;
    const hasName = a.name && a.name.trim().length > 0;

    if (hasDescription) {
      notesFound++;
      Logger.log("--- Activity: " + a.name + " ---");
      Logger.log("Date: " + a.start_date_local);
      Logger.log("Type: " + a.type);
      Logger.log("Description: " + a.description);
      if (a.feel) Logger.log("Feel: " + a.feel);
      if (a.icu_rpe) Logger.log("RPE: " + a.icu_rpe);
      Logger.log("");
    }
  });

  if (notesFound === 0) {
    Logger.log("No activities with description/notes found.");
    Logger.log("\nSample activity fields that might contain notes:");
    if (activities.length > 0) {
      const sample = activities[0];
      Logger.log("  name: " + (sample.name || "(empty)"));
      Logger.log("  description: " + (sample.description || "(empty)"));
      Logger.log("  type: " + sample.type);
    }
  } else {
    Logger.log("Found " + notesFound + " activities with notes/description");
  }

  Logger.log("\n=== ACTIVITY NOTES DISCOVERY COMPLETE ===");
}

// =========================================================
// HOLIDAY/REST WEEK DISCOVERY
// =========================================================

/**
 * Test function to discover holiday events in calendar
 * Fetches upcoming events and shows all categories
 */
function testHolidayEvents() {
  Logger.log("=== HOLIDAY EVENTS DISCOVERY ===\n");

  // Fetch events for next 6 months
  const today = new Date();
  const future = new Date(today);
  future.setMonth(future.getMonth() + 6);

  const oldest = formatDateISO(today);
  const newest = formatDateISO(future);

  Logger.log(`Fetching events from ${oldest} to ${newest}...\n`);

  const result = fetchIcuApi(`/athlete/0/events?oldest=${oldest}&newest=${newest}`);

  if (!result.success) {
    Logger.log("ERROR: Failed to fetch events - " + result.error);
    return;
  }

  if (!result.data || result.data.length === 0) {
    Logger.log("No events found in next 6 months");
    return;
  }

  Logger.log(`Found ${result.data.length} events\n`);

  // Group events by category
  const byCategory = {};
  for (const e of result.data) {
    const cat = e.category || 'UNKNOWN';
    if (!byCategory[cat]) byCategory[cat] = [];
    byCategory[cat].push(e);
  }

  // Show all categories found
  Logger.log("--- CATEGORIES FOUND ---");
  for (const cat of Object.keys(byCategory).sort()) {
    Logger.log(`${cat}: ${byCategory[cat].length} event(s)`);
  }

  // Show details of holiday/note/vacation events
  const interestingCategories = ['HOLIDAY', 'NOTE', 'VACATION', 'REST', 'SICK'];
  Logger.log("\n--- HOLIDAY/REST EVENTS ---");

  let foundAny = false;
  for (const e of result.data) {
    const cat = (e.category || '').toUpperCase();
    const name = (e.name || '').toLowerCase();

    if (interestingCategories.includes(cat) ||
        name.includes('holiday') || name.includes('vacation') ||
        name.includes('vakantie') || name.includes('rust') || name.includes('rest')) {
      foundAny = true;
      Logger.log(`\nEvent: ${e.name || '(no name)'}`);
      Logger.log(`  Category: ${e.category}`);
      Logger.log(`  Start: ${e.start_date_local}`);
      Logger.log(`  End: ${e.end_date_local || 'same day'}`);
      Logger.log(`  Description: ${e.description || '(none)'}`);
      Logger.log(`  ID: ${e.id}`);

      // Show all fields for discovery
      Logger.log(`  All fields: ${JSON.stringify(e)}`);
    }
  }

  if (!foundAny) {
    Logger.log("No holiday/vacation events found.");
    Logger.log("\nTip: Add a 'Holiday' category event in Intervals.icu");
  }

  Logger.log("\n=== HOLIDAY DISCOVERY COMPLETE ===");
}

// =========================================================
// SICK/INJURED DETECTION TESTS
// =========================================================

/**
 * Test function to check sick/injured detection
 * Tests current status and recent history
 */
function testSickInjuredDetection() {
  Logger.log("=== SICK/INJURED DETECTION TEST ===\n");

  // 1. Check current status
  Logger.log("--- Current Status ---");
  const currentStatus = checkSickOrInjured();
  Logger.log("Status: " + currentStatus.status);
  Logger.log("Is Sick: " + currentStatus.isSick);
  Logger.log("Is Injured: " + currentStatus.isInjured);

  if (currentStatus.event) {
    Logger.log("\nActive Event:");
    Logger.log("  Name: " + currentStatus.event.name);
    Logger.log("  Start: " + currentStatus.event.startDate);
    Logger.log("  End: " + currentStatus.event.endDate);
    Logger.log("  Days since start: " + currentStatus.event.daysSinceStart);
    Logger.log("  Days remaining: " + currentStatus.event.daysRemaining);
  }

  // 2. Check recent history
  Logger.log("\n--- Recent History (14 days) ---");
  const recentStatus = checkRecentSickOrInjured(14);
  Logger.log("Was recently sick/injured: " + recentStatus.wasRecent);
  Logger.log("Events found: " + recentStatus.events.length);

  if (recentStatus.events.length > 0) {
    recentStatus.events.forEach((e, i) => {
      Logger.log(`\nRecent Event ${i + 1}:`);
      Logger.log("  Type: " + e.type);
      Logger.log("  Name: " + e.name);
      Logger.log("  Duration: " + e.durationDays + " days");
      Logger.log("  Days since end: " + e.daysSinceEnd);
      Logger.log("  Recovery multiplier: " + e.recoveryMultiplier);
    });
  }

  // 3. Get training advice
  Logger.log("\n--- Training Advice ---");
  const advice = getReturnToTrainingAdvice(
    currentStatus.isSick || currentStatus.isInjured ? currentStatus : recentStatus
  );
  Logger.log("Should train: " + advice.shouldTrain);
  Logger.log("TSS multiplier: " + advice.tssMultiplier);
  Logger.log("Max intensity: " + advice.maxIntensity);
  if (advice.recommendation) {
    Logger.log("Recommendation: " + advice.recommendation);
  }
  if (advice.phase) {
    Logger.log("Phase: " + advice.phase);
  }

  // 4. Search for SICK/INJURED events in calendar
  Logger.log("\n--- Calendar Search ---");
  const today = new Date();
  const monthAgo = new Date(today);
  monthAgo.setDate(monthAgo.getDate() - 30);
  const monthAhead = new Date(today);
  monthAhead.setDate(monthAhead.getDate() + 30);

  const result = fetchIcuApi(`/athlete/0/events?oldest=${formatDateISO(monthAgo)}&newest=${formatDateISO(monthAhead)}`);

  if (result.success && result.data) {
    const sickEvents = result.data.filter(e => e.category === 'SICK' || e.category === 'INJURED');
    Logger.log(`Found ${sickEvents.length} SICK/INJURED events in ±30 days`);

    sickEvents.forEach(e => {
      Logger.log(`\n  ${e.category}: ${e.name || '(no name)'}`);
      Logger.log(`    Period: ${e.start_date_local?.substring(0, 10)} to ${e.end_date_local?.substring(0, 10) || 'same day'}`);
      if (e.description) Logger.log(`    Description: ${e.description}`);
    });
  }

  Logger.log("\n=== SICK/INJURED DETECTION TEST COMPLETE ===");
}
