/**
 * IntervalCoach - Goals & Training Phase
 *
 * Goal event fetching and training phase calculation.
 */

// =========================================================
// GOALS & EVENTS
// =========================================================

/**
 * Fetch upcoming goal events (A, B, and C priority races) from Intervals.icu
 * @returns {object} { available, primaryGoal, secondaryGoals, subGoals, allGoals }
 */
function fetchUpcomingGoals() {
  const today = new Date();
  const futureDate = new Date(today);
  futureDate.setMonth(today.getMonth() + 12); // Look 12 months ahead

  const oldestStr = formatDateISO(today);
  const newestStr = formatDateISO(futureDate);

  const result = {
    available: false,
    primaryGoal: null,      // Next A-race
    secondaryGoals: [],     // B-races
    subGoals: [],           // C-races (stepping stones toward A/B goals)
    allGoals: []            // All A, B, and C races
  };

  const endpoint = "/athlete/0/events?oldest=" + oldestStr + "&newest=" + newestStr;
  const apiResult = fetchIcuApi(endpoint);

  if (!apiResult.success) {
    Logger.log("Error fetching goals: " + apiResult.error);
    return result;
  }

  const events = apiResult.data;
  if (!Array.isArray(events)) {
    return result;
  }

  // Filter for A, B, and C priority races
  const goalEvents = events.filter(function(e) {
    return e.category === 'RACE_A' || e.category === 'RACE_B' || e.category === 'RACE_C';
  });

  // Sort by date
  goalEvents.sort(function(a, b) {
    return new Date(a.start_date_local) - new Date(b.start_date_local);
  });

  if (goalEvents.length > 0) {
    result.available = true;
    result.allGoals = goalEvents.map(function(e) {
      let priority = 'C';
      if (e.category === 'RACE_A') priority = 'A';
      else if (e.category === 'RACE_B') priority = 'B';
      return {
        name: e.name,
        date: e.start_date_local.split('T')[0],
        priority: priority,
        type: e.type,
        description: e.description || ''
      };
    });

    // Find the next A-race (primary goal)
    const nextARace = goalEvents.find(function(e) { return e.category === 'RACE_A'; });
    if (nextARace) {
      result.primaryGoal = {
        name: nextARace.name,
        date: nextARace.start_date_local.split('T')[0],
        type: nextARace.type,
        description: nextARace.description || ''
      };
    } else {
      // If no A-race, use the first B-race
      const nextBRace = goalEvents[0];
      result.primaryGoal = {
        name: nextBRace.name,
        date: nextBRace.start_date_local.split('T')[0],
        type: nextBRace.type,
        description: nextBRace.description || ''
      };
    }

    // Collect B-races
    result.secondaryGoals = goalEvents
      .filter(function(e) { return e.category === 'RACE_B'; })
      .map(function(e) {
        return {
          name: e.name,
          date: e.start_date_local.split('T')[0],
          type: e.type,
          description: e.description || ''
        };
      });

    // Collect C-races (subgoals/stepping stones)
    result.subGoals = goalEvents
      .filter(function(e) { return e.category === 'RACE_C'; })
      .map(function(e) {
        return {
          name: e.name,
          date: e.start_date_local.split('T')[0],
          type: e.type,
          description: e.description || ''
        };
      });
  }

  return result;
}

/**
 * Build a dynamic goal description from fetched goals
 * @param {object} goals - Goals object from fetchUpcomingGoals
 * @returns {string} Goal description string
 */
function buildGoalDescription(goals) {
  if (!goals.available || !goals.primaryGoal) {
    return USER_SETTINGS.GOAL_DESCRIPTION; // Fall back to manual setting
  }

  const primary = goals.primaryGoal;
  let description = primary.name;

  // Add date context
  const today = new Date();
  const targetDate = new Date(primary.date);
  const weeksOut = Math.ceil((targetDate - today) / (7 * 24 * 60 * 60 * 1000));

  description += " (" + primary.date + ", " + weeksOut + " weeks out)";

  // Add type
  if (primary.type) {
    description += ". Type: " + primary.type;
  }

  // Add description if available
  if (primary.description) {
    description += ". " + primary.description;
  }

  // Add secondary goals context
  if (goals.secondaryGoals?.length > 0) {
    const otherEvents = goals.secondaryGoals
      .filter(function(g) { return g.date !== primary.date; })
      .slice(0, 3)
      .map(function(g) { return g.name + " (" + g.date + ")"; });

    if (otherEvents.length > 0) {
      description += " Related events: " + otherEvents.join(", ");
    }
  }

  // Add C-races as stepping stones toward main goal
  if (goals.subGoals?.length > 0) {
    const steppingStones = goals.subGoals
      .filter(function(g) { return g.date !== primary.date; })
      .slice(0, 3)
      .map(function(g) { return g.name + " (" + g.date + ")"; });

    if (steppingStones.length > 0) {
      description += " Stepping stones: " + steppingStones.join(", ") + ".";
    }
  }

  // Add peak form indicator
  description += ". Peak form indicator: eFTP should reach or exceed FTP.";

  return description;
}

// =========================================================
// TRAINING PHASE CALCULATION
// =========================================================

/**
 * Calculate training phase - AI-enhanced with date-based fallback
 * @param {string} targetDate - Target date in yyyy-MM-dd format
 * @param {object} context - Optional full context for AI assessment
 * @returns {object} { phaseName, weeksOut, focus, aiEnhanced, reasoning, adjustments, upcomingEventNote }
 */
function calculateTrainingPhase(targetDate, context) {
  const today = new Date();
  const target = new Date(targetDate);
  const weeksOut = Math.ceil((target - today) / (7 * 24 * 60 * 60 * 1000));

  // Date-based fallback (always calculated)
  let phaseName, focus;

  if (weeksOut >= TRAINING_CONSTANTS.PHASE.BASE_START) {
    phaseName = "Base";
    focus = "Aerobic endurance, Z2, Tempo, SweetSpot";
  } else if (weeksOut >= TRAINING_CONSTANTS.PHASE.BUILD_START) {
    phaseName = "Build";
    focus = "FTP development, Threshold, increasing CTL";
  } else if (weeksOut >= TRAINING_CONSTANTS.PHASE.SPECIALTY_START) {
    phaseName = "Specialty";
    focus = "Race specificity, VO2max, Anaerobic";
  } else if (weeksOut >= TRAINING_CONSTANTS.PHASE.TAPER_START) {
    phaseName = "Taper";
    focus = "Reduce volume, maintain intensity";
  } else {
    phaseName = "Race Week";
    focus = "Sharpness, short openers";
  }

  const result = {
    phaseName: phaseName,
    weeksOut: weeksOut,
    focus: focus,
    aiEnhanced: false,
    reasoning: "Date-based calculation"
  };

  // If context provided, attempt AI enhancement
  if (context && context.enableAI !== false) {
    try {
      const aiContext = {
        weeksOut: weeksOut,
        traditionalPhase: phaseName,
        goalDescription: context.goalDescription,
        goals: context.goals,
        ctl: context.ctl || 0,
        rampRate: context.rampRate,
        currentEftp: context.currentEftp,
        targetFtp: context.targetFtp,
        eftpGap: context.targetFtp && context.currentEftp ? context.targetFtp - context.currentEftp : null,
        hrvAvg: context.wellnessAverages?.hrv,
        sleepAvg: context.wellnessAverages?.sleep,
        recoveryAvg: context.wellnessAverages?.recovery,
        recoveryStatus: context.recoveryStatus,
        z5Recent: context.z5Recent || 0,
        tsb: context.tsb || 0,
        recentWorkouts: context.recentWorkouts
      };

      const aiAssessment = generateAIPhaseAssessment(aiContext);

      if (aiAssessment && aiAssessment.phaseName) {
        result.phaseName = aiAssessment.phaseName;
        result.focus = aiAssessment.focus || focus;
        result.aiEnhanced = true;
        result.reasoning = aiAssessment.reasoning;
        result.adjustments = aiAssessment.adjustments;
        result.confidenceLevel = aiAssessment.confidenceLevel;
        result.phaseOverride = aiAssessment.phaseOverride;
        result.upcomingEventNote = aiAssessment.upcomingEventNote;

        if (aiAssessment.phaseOverride) {
          Logger.log("AI Phase Override: " + phaseName + " -> " + aiAssessment.phaseName);
          Logger.log("Reason: " + aiAssessment.reasoning);
        }
      }
    } catch (e) {
      Logger.log("AI phase assessment failed, using date-based: " + e.toString());
    }
  }

  return result;
}
