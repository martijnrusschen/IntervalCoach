/**
 * IntervalCoach - Main Entry Points
 *
 * Primary functions for daily workout generation and data sync
 * Test functions are in tests.gs
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
    Logger.log("No placeholder found: " + availability.reason);

    // Still send a daily status email with fitness overview and week schedule
    const fitnessMetrics = fetchFitnessMetrics();
    const goals = fetchUpcomingGoals();
    const targetDate = goals?.available && goals?.primaryGoal ? goals.primaryGoal.date : USER_SETTINGS.TARGET_DATE;
    const phaseInfo = calculateTrainingPhase(targetDate);

    // Fetch upcoming week schedule and progress
    const upcomingDays = fetchUpcomingPlaceholders(7);
    const weekProgress = checkWeekProgress();
    const weeklyPlanContext = checkWeeklyPlanAdaptation(wellness, fitnessMetrics, upcomingDays);

    // Send unified daily email (status type)
    sendDailyEmail({
      type: 'status',
      summary: fitnessMetrics,
      phaseInfo: phaseInfo,
      wellness: wellness,
      weekProgress: weekProgress,
      upcomingDays: upcomingDays,
      weeklyPlanContext: weeklyPlanContext
    });

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

    // Keep the placeholder for tomorrow (don't delete - user may want to train when recovered)
    Logger.log("Keeping placeholder for potential rescheduling");

    // Send unified daily email (rest type)
    const upcomingDays = fetchUpcomingPlaceholders(7);
    const weekProgress = checkWeekProgress();
    sendDailyEmail({
      type: 'rest',
      summary: { ctl_90: 0, tsb_current: 0 }, // Will be fetched in full flow
      phaseInfo: phaseInfo,
      wellness: wellness,
      weekProgress: weekProgress,
      upcomingDays: upcomingDays
    });

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
    powerProfile = analyzePowerProfile(powerCurve, goals);
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

    const analysisLabel = powerProfile.aiEnhanced ? "AI Power Analysis" : "Power Analysis (fallback)";
    Logger.log(analysisLabel + ": " + powerProfile.summary);
    if (powerProfile.eventRelevance) {
      Logger.log("Event Relevance: " + powerProfile.eventRelevance);
    }
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

  // Get 2-week stimulus history for AI variety check
  const twoWeekHistory = getTwoWeekWorkoutHistory();
  const sportStimuli = isRun ? twoWeekHistory.recentStimuli.run : twoWeekHistory.recentStimuli.ride;
  if (sportStimuli && sportStimuli.length > 0) {
    Logger.log("Recent stimuli (2 weeks): " + sportStimuli.join(", "));
  }

  // Recalculate phase with full context (now that we have all data)
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

  // Update phaseInfo with enhanced assessment
  const enhancedPhaseInfo = calculateTrainingPhase(targetDate, phaseContext);
  // Preserve goalDescription and update phaseInfo properties
  phaseInfo.phaseName = enhancedPhaseInfo.phaseName;
  phaseInfo.focus = enhancedPhaseInfo.focus;
  phaseInfo.aiEnhanced = enhancedPhaseInfo.aiEnhanced;
  phaseInfo.reasoning = enhancedPhaseInfo.reasoning;
  phaseInfo.adjustments = enhancedPhaseInfo.adjustments;
  phaseInfo.upcomingEventNote = enhancedPhaseInfo.upcomingEventNote;

  if (phaseInfo.aiEnhanced) {
    Logger.log("Phase: " + phaseInfo.phaseName);
    Logger.log("  Reasoning: " + phaseInfo.reasoning);
    if (phaseInfo.adjustments) {
      Logger.log("  Adjustments: " + phaseInfo.adjustments);
    }
    if (phaseInfo.upcomingEventNote) {
      Logger.log("  Event Note: " + phaseInfo.upcomingEventNote);
    }
  }

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

  // Check week progress (planned vs completed so far)
  const weekProgress = checkWeekProgress();
  Logger.log("Week Progress: " + weekProgress.summary);

  // Clean up missed placeholders from past days
  if (weekProgress.missedSessions > 0) {
    const cleanup = cleanupMissedPlaceholders(weekProgress);
    if (cleanup.cleaned > 0) {
      Logger.log(`Cleaned ${cleanup.cleaned} missed placeholder(s) from calendar`);
    }
  }

  // ===== REST DAY ASSESSMENT (with full context) =====
  // The early RED check (line 66) handles emergencies, this considers full context
  const restDayContext = {
    wellness: wellness,
    tsb: summary.tsb_current,
    ctl: summary.ctl_90,
    atl: summary.atl_7,
    phase: phaseInfo.phaseName,
    eventTomorrow: eventTomorrow,
    eventIn2Days: hasEventInDays(2),
    recentWorkouts: {
      rides: recentTypes.rides,
      runs: recentTypes.runs
    },
    lastIntensity: getLastWorkoutIntensity(recentTypes),
    daysSinceLastWorkout: adaptiveContext.gap?.daysSinceLastWorkout || 0,
    consecutiveDays: adaptiveContext.gap?.daysSinceLastWorkout === 0 ?
      (adaptiveContext.consecutiveTrainingDays || 'Unknown') : 0
  };

  const restAssessment = generateAIRestDayAssessment(restDayContext);

  if (restAssessment) {
    Logger.log("Rest Assessment: " + (restAssessment.isRestDay ? "REST DAY" : "Train") +
               " (confidence: " + restAssessment.confidence + ")");
    Logger.log("  Reasoning: " + restAssessment.reasoning);

    if (restAssessment.isRestDay && restAssessment.confidence !== 'low') {
      Logger.log("*** REST DAY RECOMMENDED ***");
      Logger.log("  Alternatives: " + restAssessment.alternatives);

      // Keep the placeholder for tomorrow (don't delete - user may want to train when recovered)
      Logger.log("Keeping placeholder for potential rescheduling");

      // Send unified daily email (rest type with AI assessment)
      const upcomingDays = fetchUpcomingPlaceholders(7);
      sendDailyEmail({
        type: 'rest',
        summary: summary,
        phaseInfo: phaseInfo,
        wellness: wellness,
        restAssessment: restAssessment,
        weekProgress: weekProgress,
        upcomingDays: upcomingDays
      });

      Logger.log("Workout generation skipped - rest day email sent");
      return;
    }
  }

  // Log if this is a weekly plan refresh
  if (availability.isWeeklyPlan) {
    Logger.log("Weekly plan workout - suggested type: " + (availability.suggestedType || "none"));
  }

  // Select workout types based on phase, TSB, recovery, events, and variety
  const typeSelection = selectWorkoutTypes({
    wellness: wellness,
    recentWorkouts: {
      types: recentTypes,
      lastIntensity: getLastWorkoutIntensity(recentTypes)
    },
    activityType: activityType,
    phaseInfo: phaseInfo,
    tsb: summary.tsb_current,
    eventTomorrow: eventTomorrow,
    eventYesterday: eventYesterday,
    // Additional context for decision
    ctl: summary.ctl_90,
    duration: availability.duration,
    goals: goals,
    powerProfile: powerProfile,
    daysSinceLastWorkout: adaptiveContext.gap?.daysSinceLastWorkout || 0,
    // Weekly plan hint - AI may adjust based on current conditions
    suggestedType: availability.suggestedType,
    isWeeklyPlan: availability.isWeeklyPlan,
    // Stimulus variety tracking (AI-first variety check)
    recentStimuli: twoWeekHistory.recentStimuli,
    stimulusCounts: twoWeekHistory.stimulusCounts,
    // Week progress - adapt if behind/ahead of plan
    weekProgress: weekProgress,
    enableAI: true
  });

  if (typeSelection.aiEnhanced) {
    Logger.log("Type selection: " + typeSelection.reason);
  } else {
    Logger.log("Type selection (fallback): " + typeSelection.reason);
  }

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

  // Build context for regeneration feedback loop
  const regenerationContext = {
    workoutType: selectedType,
    recoveryStatus: wellness.available ? wellness.recoveryStatus : 'Unknown',
    tsb: summary.tsb_current,
    phase: phaseInfo.phaseName,
    duration: availability.duration
  };

  // Generate workout with feedback loop - regenerate if score < 6
  const result = generateWorkoutWithFeedback(prompt, regenerationContext, 2, 6);

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

  // Send unified daily email (workout type)
  const upcomingDays = fetchUpcomingPlaceholders(7);
  sendDailyEmail({
    type: 'workout',
    summary: summary,
    phaseInfo: phaseInfo,
    wellness: wellness,
    workout: workout,
    powerProfile: isRun ? null : powerProfile,
    weekProgress: weekProgress,
    upcomingDays: upcomingDays
  });
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
// POST-WORKOUT ANALYSIS: Check for Completed Workouts
// =========================================================

/**
 * Check for completed workouts and analyze them with AI
 * - Hourly check with smart caching (early exit if no new activities)
 * - Compares predicted vs actual difficulty
 * - Sends analysis email
 * - Feeds insights into next day's workout generation
 */
function checkForCompletedWorkouts() {
  requireValidConfig();

  const scriptProperties = PropertiesService.getScriptProperties();
  const lastCheckKey = 'lastPostWorkoutAnalysis';

  // Get last analysis timestamp (default to 24 hours ago for first run)
  let lastCheckTime = scriptProperties.getProperty(lastCheckKey);
  if (!lastCheckTime) {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    lastCheckTime = yesterday.toISOString();
    Logger.log("First run - checking last 24 hours");
  }

  const now = new Date();
  const lastCheck = new Date(lastCheckTime);

  Logger.log(`Checking for completed workouts since ${Utilities.formatDate(lastCheck, SYSTEM_SETTINGS.TIMEZONE, "yyyy-MM-dd HH:mm")}`);

  // Fetch activities completed since last check
  const endpoint = `/athlete/0/activities?oldest=${formatDateISO(lastCheck)}&newest=${formatDateISO(now)}`;
  const result = fetchIcuApi(endpoint);

  if (!result.success) {
    Logger.log("Error fetching activities: " + result.error);
    return;
  }

  const activities = result.data;
  if (!activities || activities.length === 0) {
    Logger.log("No new completed activities - early exit (2-5 seconds)");
    // Update timestamp even on no activities to avoid repeated API calls
    scriptProperties.setProperty(lastCheckKey, now.toISOString());
    return;
  }

  Logger.log(`Found ${activities.length} new completed activity(ies)`);

  // Filter to actual workouts (exclude manual entries without data)
  const realWorkouts = activities.filter(a => {
    // Must have training load and be a real activity (not just a placeholder)
    return a.icu_training_load && a.icu_training_load > 0 && a.moving_time && a.moving_time > 300; // At least 5 minutes
  });

  if (realWorkouts.length === 0) {
    Logger.log("No real workouts found (filtered out placeholders/manual entries)");
    scriptProperties.setProperty(lastCheckKey, now.toISOString());
    return;
  }

  // Filter out already-analyzed workouts
  const newWorkouts = realWorkouts.filter(a => !isActivityAlreadyAnalyzed(a.id));

  if (newWorkouts.length === 0) {
    Logger.log("All workouts already analyzed - skipping");
    scriptProperties.setProperty(lastCheckKey, now.toISOString());
    return;
  }

  Logger.log(`Analyzing ${newWorkouts.length} new workout(s) (${realWorkouts.length - newWorkouts.length} already analyzed)...`);

  // Analyze each new workout
  for (const activity of newWorkouts) {
    try {
      analyzeCompletedWorkout(activity);
    } catch (error) {
      Logger.log(`Error analyzing activity ${activity.id}: ${error.message}`);
    }
  }

  // Update last check timestamp
  scriptProperties.setProperty(lastCheckKey, now.toISOString());
  Logger.log("Post-workout analysis complete");
}

/**
 * Analyze a completed workout using AI
 * @param {object} activity - Activity object from Intervals.icu API
 */
function analyzeCompletedWorkout(activity) {
  Logger.log(`\n=== Analyzing: ${activity.name} ===`);
  Logger.log(`Type: ${activity.type} | TSS: ${activity.icu_training_load} | Duration: ${formatDuration(activity.moving_time)}`);

  // Fetch current wellness and fitness context
  const wellnessRecords = fetchWellnessData(7);
  const wellness = createWellnessSummary(wellnessRecords);
  const fitness = fetchFitnessMetrics();

  // Get power/running data based on activity type
  const isRun = activity.type === "Run";
  let powerProfile = { available: false };
  let runningData = { available: false };

  if (isRun) {
    runningData = fetchRunningData();
  } else {
    const powerCurve = fetchPowerCurve();
    const goals = fetchUpcomingGoals();
    powerProfile = analyzePowerProfile(powerCurve, goals);
  }

  // Generate AI analysis
  const analysis = generatePostWorkoutAnalysis(activity, wellness, fitness, powerProfile, runningData);

  if (!analysis || !analysis.success) {
    Logger.log("AI analysis failed: " + (analysis?.error || "Unknown error"));
    return;
  }

  Logger.log("AI Analysis Results:");
  Logger.log(`  Effectiveness: ${analysis.effectiveness}/10`);
  Logger.log(`  Difficulty Match: ${analysis.difficultyMatch}`);
  Logger.log(`  Key Insight: ${analysis.keyInsight}`);

  // Send email with analysis
  sendPostWorkoutAnalysisEmail(activity, analysis, wellness, fitness, powerProfile, runningData);

  // Store analysis for next day's adaptive context
  storeWorkoutAnalysis(activity, analysis);

  Logger.log("Post-workout analysis email sent");
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
