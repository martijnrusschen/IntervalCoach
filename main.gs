/**
 * IntervalCoach - Main Entry Points & Test Functions
 *
 * Primary functions for daily workout generation, data sync, and testing
 */

// =========================================================
// MAIN ENTRY POINT: Generate Daily Workout
// =========================================================

/**
 * Main entry point: Generate personalized workout based on current fitness data
 * - Checks for placeholder workouts in Intervals.icu calendar
 * - Analyzes wellness, fitness, and training context
 * - Generates Zwift (.zwo) or running workouts using AI
 * - Uploads to Intervals.icu and sends email summary
 */
function generateOptimalZwiftWorkoutsAutoByGemini() {
  requireValidConfig();

  const today = new Date();

  // Fetch Wellness Data first (needed for availability check)
  const wellnessRecords = fetchWellnessData(7);
  const wellness = createWellnessSummary(wellnessRecords);

  // Check for IntervalCoach placeholder in Intervals.icu calendar
  const availability = checkAvailability(wellness);

  if (!availability.shouldGenerate) {
    Logger.log("Skipping workout generation: " + availability.reason);
    return;
  }

  Logger.log("Availability check passed: " + availability.reason);

  const activityType = availability.activityType; // "Ride" or "Run"
  const isRun = activityType === "Run";

  const folder = getOrCreateFolder(USER_SETTINGS.WORKOUT_FOLDER);
  const sheet = SpreadsheetApp.openById(USER_SETTINGS.SPREADSHEET_ID).getSheetByName(USER_SETTINGS.SHEET_NAME);
  const data = sheet.getDataRange().getValues();
  data.shift(); // Remove header

  // Create Athlete Summary
  const summary = createAthleteSummary(data);

  // Fetch dynamic goals from calendar (A/B/C races)
  const goals = fetchUpcomingGoals();
  let targetDate = USER_SETTINGS.TARGET_DATE; // Fallback
  let goalDescription = USER_SETTINGS.GOAL_DESCRIPTION; // Fallback

  if (goals?.available && goals?.primaryGoal) {
    targetDate = goals.primaryGoal.date;
    goalDescription = buildGoalDescription(goals);
    Logger.log("Dynamic Goal: " + goals.primaryGoal.name + " (" + targetDate + ")");
  } else {
    Logger.log("No A/B/C races found, using manual TARGET_DATE: " + targetDate);
  }

  // Calculate Periodization Phase based on goal
  const phaseInfo = calculateTrainingPhase(targetDate);
  phaseInfo.goalDescription = goalDescription; // Attach for use in prompts

  // Check for red recovery - skip workout and send rest day email instead
  if (isRestDayRecommended(wellness)) {
    Logger.log("*** RED RECOVERY DETECTED - Rest day recommended ***");
    Logger.log("Recovery Status: " + wellness.recoveryStatus);
    if (wellness.today?.recovery != null) {
      Logger.log("Recovery Score: " + wellness.today.recovery + "%");
    }

    // Delete the placeholder from Intervals.icu calendar
    if (availability.placeholder) {
      deleteIntervalEvent(availability.placeholder);
    }

    // Send rest day email with AI-generated advice
    sendRestDayEmail(wellness, phaseInfo);

    Logger.log("Workout generation skipped - rest day email sent");
    return;
  }

  // Fetch sport-specific data
  let powerProfile = { available: false };
  let runningData = { available: false };

  if (isRun) {
    runningData = fetchRunningData();
    if (runningData.available) {
      let runLog = "Running Data: CS=" + (runningData.criticalSpeed || 'N/A') + "/km";
      if (runningData.seasonBestCS && runningData.criticalSpeed !== runningData.seasonBestCS) {
        runLog += " (season best: " + runningData.seasonBestCS + "/km)";
      }
      runLog += " | D'=" + (runningData.dPrime ? runningData.dPrime.toFixed(0) + "m" : 'N/A');
      runLog += " | Threshold=" + (runningData.thresholdPace || 'N/A') + "/km";
      Logger.log(runLog);

      // Log best efforts
      if (runningData.bestEfforts && Object.keys(runningData.bestEfforts).length > 0) {
        const effortParts = [];
        if (runningData.bestEfforts[800]) effortParts.push("800m:" + runningData.bestEfforts[800].pace);
        if (runningData.bestEfforts[1500]) effortParts.push("1.5k:" + runningData.bestEfforts[1500].pace);
        if (runningData.bestEfforts[3000]) effortParts.push("3k:" + runningData.bestEfforts[3000].pace);
        if (effortParts.length > 0) {
          Logger.log("Best Efforts (42d): " + effortParts.join(" | "));
        }
      }
    }
  } else {
    const powerCurve = fetchPowerCurve();
    powerProfile = analyzePowerProfile(powerCurve);
  }

  Logger.log("Athlete Summary: TSB=" + summary.tsb_current.toFixed(1));
  Logger.log("Current Phase: " + phaseInfo.phaseName + " (" + phaseInfo.weeksOut + " weeks out)");

  if (!isRun && powerProfile.available) {
    let ftpLog = "Power Profile: eFTP=" + (powerProfile.currentEftp || powerProfile.eFTP || 'N/A') + "W";
    if (powerProfile.allTimeEftp && powerProfile.currentEftp && powerProfile.allTimeEftp > powerProfile.currentEftp) {
      ftpLog += " (all-time: " + powerProfile.allTimeEftp + "W)";
    }
    ftpLog += " | 5min=" + powerProfile.peak5min + "W | 1min=" + powerProfile.peak1min + "W";
    if (powerProfile.weight) {
      ftpLog += " | " + (powerProfile.ftp / powerProfile.weight).toFixed(2) + " W/kg";
    }
    Logger.log(ftpLog);

    // Log new metrics
    let physioLog = "Physio: W'=" + (powerProfile.wPrimeKj || 'N/A') + "kJ";
    if (powerProfile.seasonWPrime && powerProfile.wPrime) {
      physioLog += " (season: " + (powerProfile.seasonWPrime/1000).toFixed(1) + "kJ)";
    }
    physioLog += " | VO2max=" + (powerProfile.vo2max ? powerProfile.vo2max.toFixed(1) : 'N/A');
    physioLog += " | pMax=" + (powerProfile.pMax || 'N/A') + "W";
    if (powerProfile.wPrimeStatus) {
      physioLog += " | Status: " + powerProfile.wPrimeStatus;
    }
    Logger.log(physioLog);

    Logger.log("Power Analysis: " + powerProfile.summary);
  }
  Logger.log("Target Duration: " + availability.duration.min + "-" + availability.duration.max + " min");

  if (wellness && wellness.available) {
    Logger.log("Recovery Status: " + wellness.recoveryStatus + " | Sleep: " + wellness.today.sleep.toFixed(1) + "h (" + wellness.sleepStatus + ")");
    Logger.log("HRV: " + (wellness.today.hrv || 'N/A') + " | Resting HR: " + (wellness.today.restingHR || 'N/A'));
  } else {
    Logger.log("Wellness data: Not available");
  }

  // Get recent workout types for variety tracking
  const recentTypes = getRecentWorkoutTypes(7);
  const recentDisplay = isRun
    ? (recentTypes.runs.length > 0 ? recentTypes.runs.join(", ") : "None")
    : (recentTypes.rides.length > 0 ? recentTypes.rides.join(", ") : "None");
  Logger.log("Recent " + activityType + " types (7 days): " + recentDisplay);
  Logger.log("All recent activities: Rides=" + recentTypes.rides.length + ", Runs=" + recentTypes.runs.length);

  // Check for events around today (affects workout intensity selection)
  const eventTomorrow = hasEventTomorrow();
  const eventYesterday = hasEventYesterday();
  if (eventTomorrow.hasEvent) {
    Logger.log("Event tomorrow: " + eventTomorrow.category + " priority");
  }
  if (eventYesterday.hadEvent) {
    Logger.log("Event yesterday: " + eventYesterday.category + " priority");
  }

  // Get adaptive training context (RPE/Feel feedback + training gap analysis)
  const adaptiveContext = getAdaptiveTrainingContext(wellness);
  if (adaptiveContext.available) {
    let adaptiveLog = "Adaptive Training: " + adaptiveContext.adaptation.recommendation.toUpperCase();
    if (adaptiveContext.feedback.avgFeel) {
      adaptiveLog += " | Feel: " + adaptiveContext.feedback.avgFeel.toFixed(1) + "/5";
    }
    if (adaptiveContext.feedback.avgRpe) {
      adaptiveLog += " | RPE: " + adaptiveContext.feedback.avgRpe.toFixed(1) + "/10";
    }
    if (adaptiveContext.gap.hasSignificantGap) {
      adaptiveLog += " | Gap: " + adaptiveContext.gap.daysSinceLastWorkout + " days (" + adaptiveContext.gap.interpretation + ")";
    }
    adaptiveLog += " | Adjustment: " + (adaptiveContext.adaptation.intensityAdjustment > 0 ? '+' : '') + adaptiveContext.adaptation.intensityAdjustment + "%";
    Logger.log(adaptiveLog);
  } else {
    Logger.log("Adaptive Training: " + (adaptiveContext.gap.daysSinceLastWorkout || 0) + " days since last workout, no feedback data");
  }

  // Select workout types based on phase, TSB, recovery, events, and variety
  const typeSelection = selectWorkoutTypes({
    wellness: wellness,
    recentWorkouts: {
      types: recentTypes,
      lastIntensity: getYesterdayIntensity(recentTypes)
    },
    activityType: activityType,
    phaseInfo: phaseInfo,
    tsb: summary.tsb_current,
    eventTomorrow: eventTomorrow,
    eventYesterday: eventYesterday
  });
  Logger.log("Type selection: " + typeSelection.reason);

  if (typeSelection.isRestDay) {
    Logger.log("*** REST DAY RECOMMENDED - generating easy workout ***");
  }

  // Select the best workout type based on phase, recovery, and variety
  const selectedType = typeSelection.types[0]; // First type is the best option
  Logger.log("Selected workout type: " + selectedType);

  const dateStr = Utilities.formatDate(today, SYSTEM_SETTINGS.TIMEZONE, "MMdd");
  const fileDateStr = Utilities.formatDate(today, SYSTEM_SETTINGS.TIMEZONE, "yyyyMMdd");

  // Generate workout with appropriate prompt
  Logger.log("Generating " + activityType + " workout: " + selectedType + "...");

  const prompt = isRun
    ? createRunPrompt(selectedType, summary, phaseInfo, dateStr, availability.duration, wellness, runningData, adaptiveContext)
    : createPrompt(selectedType, summary, phaseInfo, dateStr, availability.duration, wellness, powerProfile, adaptiveContext);

  const result = callGeminiAPI(prompt);

  if (!result.success) {
    Logger.log("Failed to generate workout: " + result.error);
    return;
  }

  const safeType = selectedType.replace(/[^a-zA-Z0-9]/g, "");
  const isoDateStr = formatDateISO(today);

  let workout;

  if (isRun) {
    // For runs: save description and upload as text workout to Intervals.icu
    const fileName = `IntervalCoach_${safeType}_${fileDateStr}.txt`;
    const workoutText = result.workoutDescription || result.explanation;
    const blob = Utilities.newBlob(workoutText, "text/plain", fileName);
    folder.createFile(blob);
    Logger.log(" -> Saved to Drive: " + fileName);

    workout = {
      type: selectedType,
      explanation: result.explanation,
      recommendationScore: result.recommendationScore,
      recommendationReason: result.recommendationReason,
      blob: blob,
      fileName: fileName,
      workoutDescription: workoutText
    };

    // Upload run to Intervals.icu calendar
    uploadRunToIntervals(fileName.replace('.txt', ''), result.workoutDescription || result.explanation, isoDateStr, availability.placeholder, availability.duration);
  } else {
    // For rides: save ZWO and upload
    const fileName = `IntervalCoach_${safeType}_${fileDateStr}.zwo`;
    const blob = Utilities.newBlob(result.xml, "text/xml", fileName);
    folder.createFile(blob);
    Logger.log(" -> Saved to Drive: " + fileName);

    workout = {
      type: selectedType,
      explanation: result.explanation,
      recommendationScore: result.recommendationScore,
      recommendationReason: result.recommendationReason,
      blob: blob,
      fileName: fileName,
      xml: result.xml
    };

    // Upload to Intervals.icu calendar (replaces placeholder)
    uploadWorkoutToIntervals(fileName.replace('.zwo', ''), result.xml, isoDateStr, availability.placeholder);
  }

  // Send Email
  sendSmartSummaryEmail(summary, phaseInfo, workout, wellness, isRun ? null : powerProfile);
}

// =========================================================
// DATA SYNC: Fetch Activities from Intervals.icu
// =========================================================

/**
 * Fetch activities from Intervals.icu and update the tracking spreadsheet
 * Syncs last 90 days of activities with power zones, HR zones, and metrics
 */
function fetchAndLogActivities() {
  requireValidConfig();

  const sheet = SpreadsheetApp.openById(USER_SETTINGS.SPREADSHEET_ID).getSheetByName(USER_SETTINGS.SHEET_NAME);

  const to = new Date();
  const from = new Date();
  from.setDate(to.getDate() - TRAINING_CONSTANTS.LOOKBACK.ACTIVITIES_DEFAULT);

  const endpoint = `/athlete/0/activities?oldest=${formatDateISO(from)}&newest=${formatDateISO(to)}`;
  const result = fetchIcuApi(endpoint);

  if (!result.success) {
    Logger.log("Error fetching activities: " + result.error);
    return;
  }

  const activities = result.data;
  if (!activities || activities.length === 0) {
    Logger.log("No activities to write");
    return;
  }

  const rows = activities.map(a => mapActivityToRow(a));
  sheet.clear();
  sheet.getRange(1, 1, 1, HEADERS_FIXED.length).setValues([HEADERS_FIXED]);
  sheet.getRange(2, 1, rows.length, rows[0].length).setValues(rows);
  Logger.log(`${rows.length} rows added to spreadsheet.`);
}

// =========================================================
// ATHLETE SUMMARY
// =========================================================

/**
 * Create athlete summary from spreadsheet data
 * Combines spreadsheet data with live fitness metrics from Intervals.icu
 * @param {Array} data - Spreadsheet data rows
 * @returns {object} Athlete summary with CTL, ATL, TSB, recent activity
 */
function createAthleteSummary(data) {
  const today = new Date();
  const threeWeeksAgo = new Date();
  threeWeeksAgo.setDate(today.getDate() - 21);

  // Get CTL/ATL/TSB directly from Intervals.icu (more reliable)
  const fitness = fetchFitnessMetrics();

  const recent3Weeks = data.filter(r => new Date(r[0]) >= threeWeeksAgo)
    .map(r => HEADERS_FIXED.reduce((obj, h, i) => ({ ...obj, [h]: r[i] ?? 0 }), {}));

  const newestRow = data[0];
  const lastRowObj = newestRow ? HEADERS_FIXED.reduce((obj, h, i) => ({ ...obj, [h]: newestRow[i] ?? 0 }), {}) : null;

  // Use Intervals.icu fitness data, fallback to spreadsheet if needed
  const ctl = fitness.ctl || (lastRowObj ? lastRowObj.icu_ctl : 0) || 0;
  const atl = fitness.atl || (lastRowObj ? lastRowObj.icu_atl : 0) || 0;

  return {
    ctl_90: ctl,
    atl: atl,
    tsb_current: fitness.tsb || (ctl - atl),
    rampRate: fitness.rampRate,
    last_activity: lastRowObj ? {
      date: Utilities.formatDate(new Date(lastRowObj.start_date_local), SYSTEM_SETTINGS.TIMEZONE, "MM/dd"),
      name: lastRowObj.name,
      load: lastRowObj.icu_training_load
    } : null,
    z5_recent_total: sum(recent3Weeks.map(r => r["Z5_secs"] || 0))
  };
}

/**
 * Map an Intervals.icu activity to a spreadsheet row
 * @param {object} a - Activity object from API
 * @returns {Array} Row data for spreadsheet
 */
function mapActivityToRow(a) {
  const zoneIds = ["Z1","Z2","Z3","Z4","Z5","Z6","Z7","SS"];
  const powerZoneTimes = zoneIds.map(id => {
    const zone = a.icu_zone_times ? a.icu_zone_times.find(z => z.id === id) : null;
    return zone ? zone.secs : 0;
  });
  const hrZoneTimes = a.icu_hr_zone_times ? a.icu_hr_zone_times.slice(0,7) : Array(7).fill(0);
  while(hrZoneTimes.length < 7) hrZoneTimes.push(0);

  return [
    a.start_date_local, a.name, a.type, a.moving_time, a.distance,
    a.icu_ftp, a.icu_training_load, a.icu_ctl, a.icu_atl, a.icu_intensity,
    a.icu_joules_above_ftp, 0, ...powerZoneTimes.slice(0,7), powerZoneTimes[7], 0,
    ...hrZoneTimes, a.icu_power_zones?.join(",") || "", a.icu_hr_zones?.join(",") || "",
    a.icu_weighted_avg_watts || 0, a.icu_average_watts || 0, a.icu_variability_index || 0,
    a.icu_efficiency_factor || 0, a.decoupling || 0, a.icu_max_wbal_depletion || 0,
    a.trimp || 0, (a.icu_ctl - a.icu_atl)
  ];
}

// =========================================================
// TEST FUNCTIONS
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
 * Test rest day email functionality
 * Simulates a red recovery scenario and generates the rest day email content
 */
function testRestDayEmail() {
  Logger.log("=== REST DAY EMAIL TEST ===");

  // Fetch current wellness data
  const wellnessRecords = fetchWellnessData(7);
  const wellness = createWellnessSummary(wellnessRecords);

  Logger.log("--- Current Wellness Data ---");
  Logger.log("Recovery Status: " + wellness.recoveryStatus);
  Logger.log("Recovery Score: " + (wellness.today?.recovery != null ? wellness.today.recovery + "%" : "N/A"));
  Logger.log("Is Rest Day Recommended: " + isRestDayRecommended(wellness));

  // Calculate phase info
  const goals = fetchUpcomingGoals();
  const targetDate = goals?.available && goals?.primaryGoal ? goals.primaryGoal.date : USER_SETTINGS.TARGET_DATE;
  const phaseInfo = calculateTrainingPhase(targetDate);

  Logger.log("\n--- Phase Info ---");
  Logger.log("Phase: " + phaseInfo.phaseName);
  Logger.log("Weeks to Goal: " + phaseInfo.weeksOut);

  // Test AI advice generation
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
 * Test personalized coaching note generation
 * Generates a sample coaching note based on current data
 */
function testCoachingNote() {
  Logger.log("=== COACHING NOTE TEST ===");

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

  // Create a mock workout object
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
 * Test function to verify workout type selection logic
 * Tests various scenarios: phase, TSB, recovery, events
 */
function testWorkoutSelection() {
  Logger.log("=== WORKOUT SELECTION TEST ===\n");

  // Fetch real data
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
    recentWorkouts: { types: recentTypes, lastIntensity: getYesterdayIntensity(recentTypes) },
    activityType: "Ride",
    phaseInfo: phaseInfo,
    tsb: summary.tsb_current,
    eventTomorrow: eventTomorrow,
    eventYesterday: eventYesterday
  });
  Logger.log("Max intensity: " + rideSelection.maxIntensity);
  Logger.log("Reason: " + rideSelection.reason);
  Logger.log("Recommended types: " + rideSelection.types.slice(0, 5).join(", "));

  // Test with real data - Run
  Logger.log("\n--- Run Selection (Real Data) ---");
  const runSelection = selectWorkoutTypes({
    wellness: wellness,
    recentWorkouts: { types: recentTypes, lastIntensity: getYesterdayIntensity(recentTypes) },
    activityType: "Run",
    phaseInfo: phaseInfo,
    tsb: summary.tsb_current,
    eventTomorrow: eventTomorrow,
    eventYesterday: eventYesterday
  });
  Logger.log("Max intensity: " + runSelection.maxIntensity);
  Logger.log("Reason: " + runSelection.reason);
  Logger.log("Recommended types: " + runSelection.types.slice(0, 5).join(", "));

  // Test scenario: A event tomorrow
  Logger.log("\n--- Scenario: A Event Tomorrow ---");
  const aEventSelection = selectWorkoutTypes({
    wellness: wellness,
    recentWorkouts: { types: recentTypes, lastIntensity: 3 },
    activityType: "Ride",
    phaseInfo: phaseInfo,
    tsb: 0,
    eventTomorrow: { hasEvent: true, category: "A" },
    eventYesterday: { hadEvent: false, category: null }
  });
  Logger.log("Max intensity: " + aEventSelection.maxIntensity);
  Logger.log("Reason: " + aEventSelection.reason);
  Logger.log("Recommended types: " + aEventSelection.types.slice(0, 3).join(", "));

  // Test scenario: C event yesterday
  Logger.log("\n--- Scenario: C Event Yesterday ---");
  const postCEventSelection = selectWorkoutTypes({
    wellness: wellness,
    recentWorkouts: { types: recentTypes, lastIntensity: 4 },
    activityType: "Ride",
    phaseInfo: phaseInfo,
    tsb: -15,
    eventTomorrow: { hasEvent: false, category: null },
    eventYesterday: { hadEvent: true, category: "C" }
  });
  Logger.log("Max intensity: " + postCEventSelection.maxIntensity);
  Logger.log("Reason: " + postCEventSelection.reason);
  Logger.log("Recommended types: " + postCEventSelection.types.slice(0, 3).join(", "));

  // Test scenario: Very fatigued (TSB -25)
  Logger.log("\n--- Scenario: Very Fatigued (TSB -25) ---");
  const fatiguedSelection = selectWorkoutTypes({
    wellness: wellness,
    recentWorkouts: { types: recentTypes, lastIntensity: 3 },
    activityType: "Ride",
    phaseInfo: phaseInfo,
    tsb: -25,
    eventTomorrow: { hasEvent: false, category: null },
    eventYesterday: { hadEvent: false, category: null }
  });
  Logger.log("Max intensity: " + fatiguedSelection.maxIntensity);
  Logger.log("Reason: " + fatiguedSelection.reason);
  Logger.log("Recommended types: " + fatiguedSelection.types.slice(0, 3).join(", "));

  Logger.log("\n=== TEST COMPLETE ===");
}

/**
 * Test function to verify training proposal generation for weekly email
 */
function testTrainingProposal() {
  Logger.log("=== TRAINING PROPOSAL TEST ===\n");

  // Fetch all required data
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
    Logger.log("Add 'Ride' or 'Run' placeholders to your Intervals.icu calendar to test.");
    Logger.log("\n=== TEST COMPLETE ===");
    return;
  }

  upcoming.forEach(function(day) {
    let info = day.dayName + " (" + day.date + "): ";
    if (day.hasEvent) {
      info += day.eventCategory + " Event";
      if (day.activityType) {
        info += " + " + day.activityType;
      }
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

/**
 * Debug fitness-model-events endpoint to understand eFTP event structure
 */
function debugFitnessModelEvents() {
  Logger.log("=== FITNESS MODEL EVENTS DEBUG ===");

  const result = fetchIcuApi("/athlete/0/fitness-model-events");

  if (!result.success) {
    Logger.log("API call failed: " + result.error);
    return;
  }

  const events = result.data;
  Logger.log("Total events: " + (Array.isArray(events) ? events.length : "NOT AN ARRAY: " + typeof events));

  if (!Array.isArray(events)) {
    Logger.log("Raw data: " + JSON.stringify(events).substring(0, 500));
    return;
  }

  // Show unique categories
  const categories = [...new Set(events.map(e => e.category))];
  Logger.log("Categories found: " + categories.join(", "));

  // Show first few events
  Logger.log("--- Sample events ---");
  events.slice(0, 5).forEach(function(e, i) {
    Logger.log((i+1) + ". " + JSON.stringify(e));
  });

  // Look for any eFTP-related events
  const eftpRelated = events.filter(e =>
    (e.category && e.category.toLowerCase().includes("eftp")) ||
    (e.category && e.category.toLowerCase().includes("ftp"))
  );
  Logger.log("--- eFTP-related events (" + eftpRelated.length + ") ---");
  eftpRelated.slice(0, 5).forEach(function(e, i) {
    Logger.log((i+1) + ". " + JSON.stringify(e));
  });
}
