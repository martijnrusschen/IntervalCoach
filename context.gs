/**
 * IntervalCoach - Centralized Context Builder
 *
 * Gathers all training context for AI-powered decisions.
 */

// =========================================================
// CENTRALIZED CONTEXT BUILDER
// =========================================================

/**
 * Gather all training context in one place
 * This ensures all AI-powered decisions have access to the same complete context.
 * When adding new data sources, add them here once and they'll be available everywhere.
 *
 * @param {object} options - { wellness, fitnessMetrics, goals, phaseInfo, wellnessDays, skipLogging }
 * @returns {object} Complete training context
 */
function gatherTrainingContext(options) {
  const {
    wellness,        // Pre-fetched wellness summary (optional, will fetch if not provided)
    fitnessMetrics,  // Pre-fetched fitness metrics (optional, will fetch if not provided)
    goals,           // Pre-fetched goals (optional, will fetch if not provided)
    phaseInfo,       // Pre-fetched phase info (optional, will fetch if not provided)
    wellnessDays,    // Days of wellness data to fetch (default 30 for baseline tracking)
    skipLogging      // Skip logging context details (default false)
  } = options || {};

  // Auto-fetch wellness if not provided
  const wellnessSummary = wellness || getWellnessSummary(wellnessDays || 30);

  // Start with provided data or fetch missing pieces
  const fitness = fitnessMetrics || fetchFitnessMetrics();
  const currentGoals = goals || fetchUpcomingGoals();
  const targetDate = currentGoals?.available && currentGoals?.primaryGoal
    ? currentGoals.primaryGoal.date
    : USER_SETTINGS.TARGET_DATE;
  const phase = phaseInfo || calculateTrainingPhase(targetDate);

  // Get recent workout types for variety tracking
  const recentTypes = getRecentWorkoutTypes(7);
  const twoWeekHistory = getTwoWeekWorkoutHistory();

  // Get adaptive training context (RPE/Feel feedback + training gap analysis)
  const adaptiveContext = getAdaptiveTrainingContext(wellnessSummary);

  // Get zone progression (if available)
  let zoneProgression = null;
  try {
    zoneProgression = getZoneProgression();
  } catch (e) {
    if (!skipLogging) Logger.log("Zone progression not available: " + e.toString());
  }

  // Check for events around today
  const raceToday = hasEventOnDate(0);  // A/B/C event today
  const eventTomorrow = hasEventTomorrow();
  const eventYesterday = hasEventYesterday();
  const eventIn2Days = hasEventInDays(2);

  // Get week progress
  const weekProgress = checkWeekProgress();

  // Build the complete context object
  const ctx = {
    // Core metrics
    wellness: wellnessSummary,
    fitness: fitness,
    tsb: fitness.tsb_current || fitness.tsb || 0,
    ctl: fitness.ctl_90 || fitness.ctl || 0,
    atl: fitness.atl_7 || fitness.atl || 0,

    // Goals and phase
    goals: currentGoals,
    phaseInfo: phase,
    phase: phase?.phaseName || 'Unknown',

    // Recent training (keep both formats for compatibility)
    recentTypes: recentTypes,
    recentWorkouts: {
      types: recentTypes,
      rides: recentTypes.rides || [],
      runs: recentTypes.runs || [],
      lastIntensity: getLastWorkoutIntensity(recentTypes)
    },
    twoWeekHistory: twoWeekHistory,
    recentStimuli: twoWeekHistory.recentStimuli || {},
    stimulusCounts: twoWeekHistory.stimulusCounts || {},

    // Adaptive training (RPE/Feel feedback)
    adaptiveTraining: adaptiveContext,
    daysSinceLastWorkout: adaptiveContext?.gap?.daysSinceLastWorkout || 0,

    // Zone progression
    zoneProgression: zoneProgression,

    // Event awareness
    raceToday: raceToday,
    eventTomorrow: eventTomorrow,
    eventYesterday: eventYesterday,
    eventIn2Days: eventIn2Days,

    // Week progress
    weekProgress: weekProgress,

    // Helper flag
    available: true
  };

  // Log context summary if not skipped
  if (!skipLogging) {
    logTrainingContext(ctx);
  }

  return ctx;
}

/**
 * Log training context details
 * @param {object} ctx - Training context from gatherTrainingContext
 */
function logTrainingContext(ctx) {
  // Recent workouts
  const ridesDisplay = ctx.recentWorkouts.rides.length > 0 ? ctx.recentWorkouts.rides.join(", ") : "None";
  const runsDisplay = ctx.recentWorkouts.runs.length > 0 ? ctx.recentWorkouts.runs.join(", ") : "None";
  Logger.log("Recent workouts (7d): Rides=[" + ridesDisplay + "], Runs=[" + runsDisplay + "]");

  // 2-week stimuli
  const rideStimuli = ctx.recentStimuli.ride || [];
  const runStimuli = ctx.recentStimuli.run || [];
  if (rideStimuli.length > 0 || runStimuli.length > 0) {
    Logger.log("Stimuli (2wk): Ride=[" + rideStimuli.join(", ") + "], Run=[" + runStimuli.join(", ") + "]");
  }

  // Event awareness
  if (ctx.raceToday?.hasEvent) {
    Logger.log("*** RACE TODAY: " + ctx.raceToday.category + " - " +
               (ctx.raceToday.eventName || 'Event') + " ***");
  }
  if (ctx.eventTomorrow?.hasEvent) {
    const cat = ctx.eventTomorrow.category;
    const prefix = (cat === 'A' || cat === 'B') ? "*** RACE TOMORROW: " : "Event tomorrow: ";
    Logger.log(prefix + cat + (ctx.eventTomorrow.eventName ? " - " + ctx.eventTomorrow.eventName : " priority") +
               (cat === 'A' || cat === 'B' ? " ***" : ""));
  }
  if (ctx.eventYesterday?.hadEvent) {
    const cat = ctx.eventYesterday.category;
    const prefix = (cat === 'A' || cat === 'B') ? "Race yesterday: " : "Event yesterday: ";
    Logger.log(prefix + cat + (ctx.eventYesterday.eventName ? " - " + ctx.eventYesterday.eventName : " priority"));
  }

  // Adaptive training
  if (ctx.adaptiveTraining?.available) {
    let adaptiveLog = "Adaptive Training: " + ctx.adaptiveTraining.adaptation.recommendation.toUpperCase();
    if (ctx.adaptiveTraining.feedback.avgFeel) {
      adaptiveLog += " | Feel: " + ctx.adaptiveTraining.feedback.avgFeel.toFixed(1) + "/5";
    }
    if (ctx.adaptiveTraining.feedback.avgRpe) {
      adaptiveLog += " | RPE: " + ctx.adaptiveTraining.feedback.avgRpe.toFixed(1) + "/10";
    }
    if (ctx.adaptiveTraining.gap?.hasSignificantGap) {
      adaptiveLog += " | Gap: " + ctx.adaptiveTraining.gap.daysSinceLastWorkout + " days";
    }
    adaptiveLog += " | Adj: " + (ctx.adaptiveTraining.adaptation.intensityAdjustment > 0 ? '+' : '') +
                   ctx.adaptiveTraining.adaptation.intensityAdjustment + "%";
    Logger.log(adaptiveLog);
  } else {
    Logger.log("Adaptive Training: " + ctx.daysSinceLastWorkout + " days since last workout, no feedback");
  }

  // Week progress
  if (ctx.weekProgress) {
    Logger.log("Week Progress: " + ctx.weekProgress.summary);
  }

  // Zone progression
  if (ctx.zoneProgression?.available) {
    Logger.log("Zone Progression: Focus=" + (ctx.zoneProgression.focusAreas?.join(', ') || 'none') +
               " | Strengths=" + (ctx.zoneProgression.strengths?.join(', ') || 'none'));
  }
}

/**
 * Get the last workout intensity from recent types
 * @param {object} recentTypes - Recent workout types
 * @returns {string|null} Last intensity type or null
 */
function getLastWorkoutIntensity(recentTypes) {
  // Check rides first, then runs
  if (recentTypes.rides && recentTypes.rides.length > 0) {
    return recentTypes.rides[0];
  }
  if (recentTypes.runs && recentTypes.runs.length > 0) {
    return recentTypes.runs[0];
  }
  return null;
}

// =========================================================
// TEST HELPERS
// =========================================================

/**
 * Setup test context with all necessary data (DRY helper for test files)
 * Uses gatherTrainingContext() to ensure consistent context across all tests.
 *
 * @param {object} options - { includePowerProfile, includeRunning, wellnessDays, skipLogging }
 * @returns {object} Complete test context with all data
 */
function setupTestContext(options) {
  options = options || {};
  requireValidConfig();

  // Get base context using centralized function
  const ctx = gatherTrainingContext({
    wellnessDays: options.wellnessDays || 30,
    skipLogging: options.skipLogging !== false ? false : true  // Log by default in tests
  });

  // Add power profile if requested
  if (options.includePowerProfile) {
    try {
      ctx.powerProfile = fetchPowerCurve();
      ctx.powerAnalysis = analyzePowerProfile(ctx.powerProfile, ctx.goals);
    } catch (e) {
      Logger.log("Power profile not available: " + e.toString());
    }
  }

  // Add running data if requested
  if (options.includeRunning) {
    try {
      ctx.runningData = fetchRunningData();
    } catch (e) {
      Logger.log("Running data not available: " + e.toString());
    }
  }

  return ctx;
}

/**
 * Log a test header
 * @param {string} title - Test title
 */
function logTestHeader(title) {
  Logger.log("=== " + title + " TEST ===");
}
