/**
 * IntervalCoach - Miscellaneous & Discovery Tests
 *
 * Debug functions and discovery tests for exploring API data.
 * Run these from the Apps Script editor to discover available data.
 */

// =========================================================
// HELPER FUNCTIONS
// =========================================================

/**
 * Verify that config is properly set up before running tests
 * @throws {Error} if config is missing required values
 */
function requireValidConfig() {
  if (!USER_SETTINGS || !USER_SETTINGS.ATHLETE_ID) {
    throw new Error("config.gs is not properly configured. Copy config.sample.gs to config.gs and fill in values.");
  }
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
