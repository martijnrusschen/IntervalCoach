/**
 * IntervalCoach - Main Entry Points
 *
 * Primary functions for daily workout generation and data sync
 * Test functions are in tests.gs
 */

// =========================================================
// SMART HOURLY TRIGGER
// =========================================================

/**
 * Smart hourly trigger for workout generation
 * Runs hourly but only triggers workout generation once per day when:
 * 1. Today's wellness data (recovery score) is available
 * 2. We haven't already generated a workout today
 *
 * Set up: Create hourly trigger for this function
 * ScriptApp.newTrigger('checkAndGenerateWorkout').timeBased().everyHours(1).create()
 */
function checkAndGenerateWorkout() {
  const props = PropertiesService.getScriptProperties();
  const today = formatDateISO(new Date());
  const lastRunDate = props.getProperty('LAST_WORKOUT_RUN_DATE');

  // Already ran today - skip
  if (lastRunDate === today) {
    Logger.log('Already generated workout today (' + today + ') - skipping');
    return;
  }

  // Check if wellness data is available
  Logger.log('Checking for wellness data...');

  let wellnessAvailable = false;
  let wellnessSource = 'none';

  // Try Whoop API first
  if (typeof isWhoopConfigured === 'function' && isWhoopConfigured()) {
    try {
      const whoopRecovery = getWhoopCurrentRecovery();
      if (whoopRecovery.available && whoopRecovery.recovery != null) {
        // Check if recovery was created today (not yesterday's data)
        const recoveryDate = whoopRecovery.createdAt ? whoopRecovery.createdAt.substring(0, 10) : null;
        if (recoveryDate === today) {
          wellnessAvailable = true;
          wellnessSource = 'whoop_api';
          Logger.log('Whoop API: Recovery ' + whoopRecovery.recovery + '% available (created: ' + whoopRecovery.createdAt + ')');
        } else {
          Logger.log('Whoop API: Recovery data is from ' + recoveryDate + ', waiting for today\'s data');
        }
      } else {
        Logger.log('Whoop API: No recovery data yet - ' + (whoopRecovery.reason || 'unknown'));
      }
    } catch (e) {
      Logger.log('Whoop API error: ' + e.toString());
    }
  }

  // Fallback to Intervals.icu if Whoop not available
  if (!wellnessAvailable) {
    try {
      const icuRecords = fetchWellnessData(2, 0); // Fetch 2 days to check dates
      const todayRecord = icuRecords.find(r => r.date === today);
      if (todayRecord && todayRecord.recovery != null) {
        wellnessAvailable = true;
        wellnessSource = 'intervals_icu';
        Logger.log('Intervals.icu: Recovery ' + todayRecord.recovery + '% available for ' + today);
      } else {
        Logger.log('Intervals.icu: No recovery data for today (' + today + ') yet');
        if (icuRecords.length > 0) {
          Logger.log('  Latest record is from: ' + icuRecords[0].date);
        }
      }
    } catch (e) {
      Logger.log('Intervals.icu error: ' + e.toString());
    }
  }

  // If no wellness data, wait for next hour
  if (!wellnessAvailable) {
    Logger.log('No wellness data available yet - will retry next hour');
    return;
  }

  // Wellness data available - run workout generation
  Logger.log('Wellness data ready from ' + wellnessSource + ' - generating workout');

  try {
    generateOptimalZwiftWorkoutsAutoByGemini();

    // Mark as completed for today
    props.setProperty('LAST_WORKOUT_RUN_DATE', today);
    Logger.log('Workout generation complete - marked ' + today + ' as done');
  } catch (e) {
    Logger.log('Workout generation failed: ' + e.toString());
    // Don't mark as complete so it retries next hour
  }
}

/**
 * Reset the daily run flag (useful for testing)
 */
function resetDailyWorkoutFlag() {
  PropertiesService.getScriptProperties().deleteProperty('LAST_WORKOUT_RUN_DATE');
  Logger.log('Daily workout flag reset - next hourly check will run');
}

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
  // Uses Whoop API for real-time data if configured, falls back to Intervals.icu
  // Fetch 30 days for baseline tracking (HRV/RHR personal baselines)
  const wellnessRecords = fetchWellnessDataEnhanced(30);
  const wellness = createWellnessSummary(wellnessRecords);

  // Check for IntervalCoach placeholder in Intervals.icu calendar
  const availability = checkAvailability(wellness);

  if (!availability.shouldGenerate) {
    Logger.log("No workout generation: " + availability.reason);

    // Fetch common data for status/group ride emails
    const fitnessMetrics = fetchFitnessMetrics();
    const goals = fetchUpcomingGoals();
    const targetDate = goals?.available && goals?.primaryGoal ? goals.primaryGoal.date : USER_SETTINGS.TARGET_DATE;
    const phaseInfo = calculateTrainingPhase(targetDate);

    // Fetch upcoming week schedule and progress
    const upcomingDays = fetchUpcomingPlaceholders(7);
    const weekProgress = checkWeekProgress();

    // Check and apply mid-week adaptation if needed (unified approach)
    let midWeekAdaptation = null;
    const adaptationCheck = checkMidWeekAdaptationNeeded(weekProgress, upcomingDays, wellness, fitnessMetrics);
    if (adaptationCheck.needed) {
      Logger.log(`Mid-week adaptation needed (${adaptationCheck.priority}): ${adaptationCheck.reason}`);
      try {
        midWeekAdaptation = generateMidWeekAdaptation(
          weekProgress, upcomingDays, wellness, fitnessMetrics, phaseInfo, goals, adaptationCheck
        );
        if (midWeekAdaptation.success && midWeekAdaptation.changes.length > 0) {
          Logger.log(`Mid-week adaptation applied: ${midWeekAdaptation.changes.length} change(s)`);
        }
      } catch (e) {
        Logger.log(`Mid-week adaptation failed (non-critical): ${e.toString()}`);
      }
    }

    // Use centralized context builder - ensures all context is included
    const ctx = gatherTrainingContext({
      wellness: wellness,
      fitnessMetrics: fitnessMetrics,
      goals: goals,
      phaseInfo: phaseInfo
    });

    // Check if this is a race day (A/B event)
    if (availability.isRaceDay) {
      Logger.log("*** RACE DAY: " + availability.raceCategory + " - " + availability.raceName + " ***");

      // Get power profile for race strategy
      let powerProfile = { available: false };
      try {
        const powerCurve = fetchPowerCurve();
        powerProfile = analyzePowerProfile(powerCurve, goals);
      } catch (e) {
        Logger.log("Power profile not available for race advice: " + e.toString());
      }

      // Generate race day advice with full context
      const raceDayAdvice = generateRaceDayAdvice({
        ...ctx,
        powerProfile: powerProfile,
        raceToday: {
          hasEvent: true,
          category: availability.raceCategory,
          eventName: availability.raceName,
          eventDescription: availability.raceDescription
        }
      });

      Logger.log("Race day readiness: " + (raceDayAdvice?.readiness || 'unknown'));

      // Send race day email
      sendDailyEmail({
        type: 'race_day',
        summary: fitnessMetrics,
        phaseInfo: phaseInfo,
        wellness: wellness,
        weekProgress: weekProgress,
        upcomingDays: upcomingDays,
        raceName: availability.raceName,
        raceCategory: availability.raceCategory,
        raceDescription: availability.raceDescription,
        raceDayAdvice: raceDayAdvice
      });

    // Check if this is a C event (group ride) day
    } else if (availability.isCEvent) {
      Logger.log("C Event day: " + availability.cEventName + (availability.cEventDescription ? " (" + availability.cEventDescription + ")" : ""));

      // Get AI advice on how hard to push in the group ride
      const groupRideAdvice = generateGroupRideAdvice({
        // From centralized context
        wellness: ctx.wellness,
        tsb: ctx.tsb,
        ctl: ctx.ctl,
        atl: ctx.atl,
        eventTomorrow: ctx.eventTomorrow,
        eventIn2Days: ctx.eventIn2Days,
        recentWorkouts: ctx.recentWorkouts,
        daysSinceLastWorkout: ctx.daysSinceLastWorkout,
        phase: ctx.phase,
        adaptiveTraining: ctx.adaptiveTraining,
        zoneProgression: ctx.zoneProgression,
        // Event-specific
        eventName: availability.cEventName,
        eventDescription: availability.cEventDescription
      });

      Logger.log("Group ride intensity advice: " + groupRideAdvice?.intensity);

      // Send group ride email with AI advice
      sendDailyEmail({
        type: 'group_ride',
        summary: fitnessMetrics,
        phaseInfo: phaseInfo,
        wellness: wellness,
        weekProgress: weekProgress,
        upcomingDays: upcomingDays,
        cEventName: availability.cEventName,
        cEventDescription: availability.cEventDescription,
        groupRideAdvice: groupRideAdvice
      });

    } else {
      // Check for A/B race tomorrow or yesterday for advice
      let raceDayAdvice = null;
      const hasTomorrowRace = ctx.eventTomorrow?.hasEvent &&
                              (ctx.eventTomorrow.category === 'A' || ctx.eventTomorrow.category === 'B');
      const hasYesterdayRace = ctx.eventYesterday?.hadEvent &&
                               (ctx.eventYesterday.category === 'A' || ctx.eventYesterday.category === 'B');

      if (hasTomorrowRace || hasYesterdayRace) {
        raceDayAdvice = generateRaceDayAdvice(ctx);
        if (raceDayAdvice) {
          Logger.log("Race advice scenario: " + raceDayAdvice.scenario);
        }
      }

      // Send regular status email (no placeholder) with optional race advice
      sendDailyEmail({
        type: 'status',
        summary: fitnessMetrics,
        phaseInfo: phaseInfo,
        wellness: wellness,
        weekProgress: weekProgress,
        upcomingDays: upcomingDays,
        midWeekAdaptation: midWeekAdaptation,
        raceDayAdvice: raceDayAdvice
      });
    }

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

    // Add personalized zone analysis
    if (powerProfile.available) {
      try {
        const zoneAnalysis = analyzeZoneBoundaries();
        if (zoneAnalysis.available) {
          powerProfile.zoneAnalysis = zoneAnalysis;
          Logger.log("Zone Analysis: Profile type likely " + determineProfileType(zoneAnalysis));
        }
      } catch (e) {
        Logger.log("Zone analysis failed (non-critical): " + e.toString());
      }
    }
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

  // ===== GATHER CENTRALIZED TRAINING CONTEXT =====
  // All context is gathered in one place - when adding new data sources,
  // update gatherTrainingContext() in utils.gs and it will be available everywhere
  const ctx = gatherTrainingContext({
    wellness: wellness,
    fitnessMetrics: summary,  // Use summary which has ctl_90, tsb_current etc
    goals: goals,
    phaseInfo: phaseInfo
  });

  // ===== DELOAD CHECK =====
  // Check if a recovery/deload week is needed based on recent training patterns
  // Also considers sleep debt from Whoop for earlier deload triggering
  let deloadCheck = null;
  try {
    deloadCheck = checkDeloadNeeded(summary, wellness);
    if (deloadCheck.needed) {
      Logger.log(formatDeloadCheckLog(deloadCheck));
    } else if (deloadCheck.weeksWithoutDeload >= 2) {
      Logger.log(`Deload tracking: ${deloadCheck.weeksWithoutDeload} weeks without recovery week`);
    }
  } catch (e) {
    Logger.log(`Deload check failed (non-critical): ${e.toString()}`);
  }

  // ===== VOLUME JUMP DETECTION =====
  let volumeJump = null;
  try {
    volumeJump = checkVolumeJump();
    if (volumeJump.detected) {
      Logger.log(`Volume Jump: ${volumeJump.percentChange}% (${volumeJump.lastWeekTSS} → ${volumeJump.thisWeekTSS} TSS) - Risk: ${volumeJump.risk}`);
    }
  } catch (e) {
    Logger.log(`Volume jump check failed (non-critical): ${e.toString()}`);
  }

  // ===== RAMP RATE WARNING =====
  // Check for sustained high ramp rate over multiple weeks
  let rampRateWarning = null;
  try {
    rampRateWarning = checkRampRateWarning(fitnessMetrics);
    if (rampRateWarning.warning) {
      Logger.log(`Ramp Rate Warning (${rampRateWarning.level}): ${rampRateWarning.consecutiveWeeks} weeks at elevated rate`);
      Logger.log(`  Weekly rates: ${rampRateWarning.weeklyRates.map(w => `${w.label}: ${w.rate}`).join(', ')}`);
    }
  } catch (e) {
    Logger.log(`Ramp rate warning check failed (non-critical): ${e.toString()}`);
  }

  // ===== ILLNESS PATTERN DETECTION =====
  // Check for illness indicators: elevated RHR + suppressed HRV + poor sleep + elevated skin temp
  let illnessPattern = null;
  try {
    illnessPattern = checkIllnessPattern();
    if (illnessPattern.detected) {
      Logger.log(`Illness Pattern Detected (${illnessPattern.probability}): ${illnessPattern.consecutiveDays} consecutive day(s)`);
      Logger.log(`  Symptoms: ${illnessPattern.symptoms.join(', ')}`);
      Logger.log(`  Guidance: ${illnessPattern.trainingGuidance}`);
    }
  } catch (e) {
    Logger.log(`Illness pattern check failed (non-critical): ${e.toString()}`);
  }

  // ===== TAPER TIMING =====
  // Calculate optimal taper timing for upcoming A races (within 6 weeks)
  let taperRecommendation = null;
  try {
    const primaryGoal = goals?.available && goals?.primaryGoal ? goals.primaryGoal : null;
    if (primaryGoal && primaryGoal.date) {
      taperRecommendation = generateTaperRecommendation(summary, primaryGoal, phaseInfo);
      if (taperRecommendation.available) {
        const rec = taperRecommendation.analysis.recommended;
        Logger.log(`Taper timing: ${rec.taperType} starting ${rec.taperStartDate} for ${primaryGoal.name}`);
        Logger.log(`  Race day projection: CTL ${rec.raceDayCTL}, TSB ${rec.raceDayTSB}`);
      }
    }
  } catch (e) {
    Logger.log(`Taper timing calculation failed (non-critical): ${e.toString()}`);
  }

  // Aliases for backward compatibility
  const recentTypes = ctx.recentTypes;
  const twoWeekHistory = ctx.twoWeekHistory;
  const eventTomorrow = ctx.eventTomorrow;
  const eventYesterday = ctx.eventYesterday;
  const adaptiveContext = ctx.adaptiveTraining;
  const weekProgress = ctx.weekProgress;
  const zoneProgression = ctx.zoneProgression;

  // Recalculate phase with full context (now that we have power profile data)
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
    recentWorkouts: ctx.recentWorkouts,
    enableAI: true
  };

  // Update phaseInfo with enhanced assessment
  const enhancedPhaseInfo = calculateTrainingPhase(targetDate, phaseContext);
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

  // Clean up missed placeholders from past days
  if (weekProgress.missedSessions > 0) {
    const cleanup = cleanupMissedPlaceholders(weekProgress);
    if (cleanup.cleaned > 0) {
      Logger.log(`Cleaned ${cleanup.cleaned} missed placeholder(s) from calendar`);
    }
  }

  // ===== MID-WEEK ADAPTATION =====
  // Check if remaining week needs adjustment based on missed sessions or wellness
  let midWeekAdaptation = null;
  const upcomingDaysForAdaptation = fetchUpcomingPlaceholders(7);

  const adaptationCheck = checkMidWeekAdaptationNeeded(
    weekProgress,
    upcomingDaysForAdaptation,
    wellness,
    summary,  // fitness metrics
    taperRecommendation  // taper timing for race prep
  );

  if (adaptationCheck.needed) {
    Logger.log(`Mid-week adaptation needed (${adaptationCheck.priority}): ${adaptationCheck.reason}`);

    try {
      midWeekAdaptation = generateMidWeekAdaptation(
        weekProgress,
        upcomingDaysForAdaptation,
        wellness,
        summary,
        phaseInfo,
        goals,
        adaptationCheck
      );

      if (midWeekAdaptation.success && midWeekAdaptation.changes.length > 0) {
        Logger.log(`Mid-week adaptation applied: ${midWeekAdaptation.changes.length} change(s)`);
        for (const change of midWeekAdaptation.changes) {
          Logger.log(`  - ${change}`);
        }
      } else if (midWeekAdaptation.success) {
        Logger.log(`Mid-week adaptation: ${midWeekAdaptation.summary}`);
      }
    } catch (e) {
      Logger.log(`Mid-week adaptation failed (non-critical): ${e.toString()}`);
    }
  }

  // ===== REST DAY ASSESSMENT (with full context) =====
  // The early RED check handles emergencies, this considers full context
  const restDayContext = {
    wellness: ctx.wellness,
    tsb: ctx.tsb,
    ctl: ctx.ctl,
    atl: ctx.atl,
    phase: phaseInfo.phaseName,
    eventTomorrow: ctx.eventTomorrow,
    eventIn2Days: ctx.eventIn2Days,
    recentWorkouts: ctx.recentWorkouts,
    lastIntensity: ctx.recentWorkouts.lastIntensity,
    daysSinceLastWorkout: ctx.daysSinceLastWorkout,
    consecutiveDays: ctx.daysSinceLastWorkout === 0 ?
      (ctx.adaptiveTraining?.consecutiveTrainingDays || 'Unknown') : 0
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
  // Uses centralized context (ctx) for all training data
  const typeSelection = selectWorkoutTypes({
    // From centralized context
    wellness: ctx.wellness,
    recentWorkouts: ctx.recentWorkouts,
    tsb: ctx.tsb,
    ctl: ctx.ctl,
    eventTomorrow: ctx.eventTomorrow,
    eventYesterday: ctx.eventYesterday,
    daysSinceLastWorkout: ctx.daysSinceLastWorkout,
    recentStimuli: ctx.recentStimuli,
    stimulusCounts: ctx.stimulusCounts,
    weekProgress: ctx.weekProgress,
    zoneProgression: ctx.zoneProgression,
    // Workout-specific parameters
    activityType: activityType,
    phaseInfo: phaseInfo,
    duration: availability.duration,
    goals: goals,
    powerProfile: powerProfile,
    suggestedType: availability.suggestedType,
    isWeeklyPlan: availability.isWeeklyPlan,
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

  // Calculate cross-sport equivalency for context
  let crossSportEquivalency = null;
  try {
    crossSportEquivalency = calculateCrossSportEquivalency();
    if (crossSportEquivalency && crossSportEquivalency.available) {
      Logger.log("Cross-sport data available: FTP " + crossSportEquivalency.cycling.ftp + "W ↔ CS " + crossSportEquivalency.running.criticalSpeed + "/km");
    }
  } catch (e) {
    Logger.log("Cross-sport equivalency failed (non-critical): " + e.toString());
  }

  // Fetch last workout analysis for feedback-driven intensity adjustment
  let lastWorkoutAnalysis = null;
  try {
    lastWorkoutAnalysis = getLastWorkoutAnalysis();
    if (lastWorkoutAnalysis) {
      Logger.log("Last workout feedback: " + lastWorkoutAnalysis.activityName +
                 " - Difficulty: " + (lastWorkoutAnalysis.difficultyMatch || 'unknown'));
    }
  } catch (e) {
    Logger.log("Last workout analysis fetch failed (non-critical): " + e.toString());
  }

  // Generate workout with appropriate prompt
  Logger.log("Generating " + activityType + " workout: " + selectedType + "...");

  // Build warnings object to pass to prompt (so AI factors these into decisions)
  const warnings = {
    volumeJump: volumeJump,
    rampRateWarning: rampRateWarning,
    deloadCheck: deloadCheck,
    illnessPattern: illnessPattern
  };

  const prompt = isRun
    ? createRunPrompt(selectedType, summary, phaseInfo, dateStr, availability.duration, wellness, runningData, adaptiveContext, crossSportEquivalency, lastWorkoutAnalysis, warnings)
    : createPrompt(selectedType, summary, phaseInfo, dateStr, availability.duration, wellness, powerProfile, adaptiveContext, crossSportEquivalency, lastWorkoutAnalysis, warnings);

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
    workoutSelection: {
      reason: typeSelection.reason,
      varietyNote: typeSelection.varietyNote,
      zoneNote: typeSelection.zoneNote,
      aiEnhanced: typeSelection.aiEnhanced
    },
    powerProfile: isRun ? null : powerProfile,
    weekProgress: weekProgress,
    upcomingDays: upcomingDays,
    midWeekAdaptation: midWeekAdaptation,  // Include adaptation info if any
    deloadCheck: deloadCheck,  // Include deload recommendation if needed
    taperRecommendation: taperRecommendation,  // Include taper timing if within 6 weeks of race
    volumeJump: volumeJump,  // Include volume jump warning if >15% increase
    rampRateWarning: rampRateWarning,  // Include ramp rate warning if sustained high rate
    illnessPattern: illnessPattern  // Include illness pattern detection if concerning markers found
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
  // Uses Whoop API for real-time data if configured
  // Fetch 30 days for baseline tracking (HRV/RHR personal baselines)
  const wellnessRecords = fetchWellnessDataEnhanced(30);
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
