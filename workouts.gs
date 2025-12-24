/**
 * IntervalCoach - Workout Selection & Availability
 *
 * Smart workout type selection, placeholder detection, and variety tracking.
 */

// =========================================================
// PLACEHOLDER DETECTION
// =========================================================

/**
 * Check Intervals.icu calendar for workout placeholders or existing generated workouts
 * Looks for:
 * 1. Placeholders starting with "Ride" or "Run" (e.g., "Ride - 90min" or "Run - 45min")
 * 2. Existing generated workouts (workout types from catalog, or workouts with .zwo files)
 * @param {string} dateStr - Date in yyyy-MM-dd format
 * @returns {object} { hasPlaceholder, placeholder, duration, activityType, isExisting }
 */
function findIntervalCoachPlaceholder(dateStr) {
  const endpoint = "/athlete/0/events?oldest=" + dateStr + "&newest=" + dateStr;
  const ridePlaceholder = USER_SETTINGS.PLACEHOLDER_RIDE.toLowerCase();
  const runPlaceholder = USER_SETTINGS.PLACEHOLDER_RUN.toLowerCase();

  const result = fetchIcuApi(endpoint);

  if (!result.success) {
    Logger.log("Error checking Intervals.icu calendar: " + result.error);
    return { hasPlaceholder: false, placeholder: null, duration: null, activityType: null, isExisting: false };
  }

  const events = result.data;
  if (!Array.isArray(events)) {
    return { hasPlaceholder: false, placeholder: null, duration: null, activityType: null, isExisting: false };
  }

  // Get all workout type names for matching existing workouts
  // Normalize by removing underscores for flexible matching
  const rideWorkoutTypes = Object.keys(WORKOUT_TYPES.ride).map(t => t.toLowerCase().replace(/_/g, ''));
  const runWorkoutTypes = Object.keys(WORKOUT_TYPES.run).map(t => t.toLowerCase().replace(/_/g, ''));

  // First priority: Find placeholder event starting with "Ride", "Run", or "Hardlopen"
  const placeholder = events.find(function(e) {
    if (!e.name) return false;
    const nameLower = e.name.toLowerCase();
    return nameLower.startsWith(ridePlaceholder) ||
           nameLower.startsWith(runPlaceholder) ||
           nameLower.startsWith("hardlopen");
  });

  if (placeholder) {
    const nameLower = placeholder.name.toLowerCase();
    const isRun = nameLower.startsWith(runPlaceholder) || nameLower.startsWith("hardlopen");
    const activityType = isRun ? "Run" : "Ride";
    const duration = parseDurationFromName(placeholder.name, activityType);

    // Check if this is a weekly plan placeholder and extract suggested workout type
    let suggestedType = null;
    let isWeeklyPlan = false;
    if (placeholder.description && placeholder.description.includes('[Weekly Plan]')) {
      isWeeklyPlan = true;
      // Extract workout type from description (format: "[Weekly Plan]\nWorkoutType\n...")
      const lines = placeholder.description.split('\n');
      if (lines.length >= 2 && lines[1].trim()) {
        suggestedType = lines[1].trim();
      }
    }

    return {
      hasPlaceholder: true,
      placeholder: placeholder,
      duration: duration,
      activityType: activityType,
      isExisting: false,
      isWeeklyPlan: isWeeklyPlan,
      suggestedType: suggestedType
    };
  }

  // Second priority: Find existing generated workout that can be replaced
  const existingWorkout = events.find(function(e) {
    if (!e.name) return false;
    // Normalize name by removing underscores for flexible matching
    const nameNormalized = e.name.toLowerCase().replace(/_/g, '');

    // Check if it's a workout type we generated (ride or run)
    const isRideType = rideWorkoutTypes.some(t => nameNormalized.includes(t));
    const isRunType = runWorkoutTypes.some(t => nameNormalized.includes(t));

    // Also check for workouts with .zwo files (category WORKOUT)
    const isZwoWorkout = e.category === 'WORKOUT' && e.filename && e.filename.endsWith('.zwo');

    // Also check for IntervalCoach prefix
    const hasIntervalCoachPrefix = nameNormalized.includes('intervalcoach');

    return isRideType || isRunType || isZwoWorkout || hasIntervalCoachPrefix;
  });

  if (existingWorkout) {
    const nameNormalized = existingWorkout.name.toLowerCase().replace(/_/g, '');
    const isRunType = runWorkoutTypes.some(t => nameNormalized.includes(t));
    const activityType = isRunType ? "Run" : "Ride";

    // Try to extract duration from the existing workout or use default
    const duration = existingWorkout.moving_time
      ? { min: Math.round(existingWorkout.moving_time / 60 * 0.9), max: Math.round(existingWorkout.moving_time / 60 * 1.1) }
      : (activityType === "Run" ? USER_SETTINGS.DEFAULT_DURATION_RUN : USER_SETTINGS.DEFAULT_DURATION_RIDE);

    Logger.log("Found existing workout to replace: " + existingWorkout.name);

    return {
      hasPlaceholder: true,
      placeholder: existingWorkout,
      duration: duration,
      activityType: activityType,
      isExisting: true
    };
  }

  return { hasPlaceholder: false, placeholder: null, duration: null, activityType: null, isExisting: false };
}

/**
 * Parse duration from placeholder name
 * Supports formats: "Ride - 90min", "Run - 45min", "Ride-90", "Hardlopen - 30min"
 * @param {string} name - Placeholder name
 * @param {string} activityType - "Ride" or "Run"
 * @returns {object} { min, max } duration range
 */
function parseDurationFromName(name, activityType) {
  const defaultDuration = activityType === "Run"
    ? USER_SETTINGS.DEFAULT_DURATION_RUN
    : USER_SETTINGS.DEFAULT_DURATION_RIDE;

  // Match patterns like "90min", "90 min", "90m", or just "90" after separator
  const match = name.match(/[\s\-]+(\d+)\s*(min|m)?/i);

  if (match) {
    const minutes = parseInt(match[1], 10);
    // Runs: 20-60 min, Rides: 20-300 min
    const maxAllowed = activityType === "Run" ? 60 : 300;
    if (minutes >= 20 && minutes <= maxAllowed) {
      // Give +/- 10% flexibility around the specified duration
      const buffer = Math.round(minutes * 0.1);
      return {
        min: minutes - buffer,
        max: minutes + buffer
      };
    }
  }

  return defaultDuration;
}

/**
 * Determine if workout should be generated today
 * Checks for IntervalCoach placeholder in Intervals.icu calendar
 * @param {object} wellness - Wellness summary
 * @returns {object} { shouldGenerate, reason, duration, placeholder, activityType }
 */
function checkAvailability(wellness) {
  const todayStr = formatDateISO(new Date());
  const result = findIntervalCoachPlaceholder(todayStr);

  if (!result.hasPlaceholder) {
    return {
      shouldGenerate: false,
      reason: "No placeholder found for today. Add '" + USER_SETTINGS.PLACEHOLDER_RIDE + "' or '" + USER_SETTINGS.PLACEHOLDER_RUN + " - 45min' to your Intervals.icu calendar.",
      duration: null,
      placeholder: null,
      activityType: null,
      isExisting: false
    };
  }

  // Found placeholder or existing workout - extract info
  const placeholderName = result.placeholder.name;
  const duration = result.duration;
  const activityType = result.activityType;
  const isExisting = result.isExisting;

  // Add recovery note if wellness data available
  let recoveryNote = "";
  if (wellness?.available) {
    if (wellness.today?.recovery != null && wellness.today.recovery < TRAINING_CONSTANTS.RECOVERY.RED_THRESHOLD) {
      recoveryNote = " | Low recovery (" + wellness.today.recovery + "%)";
    }
  }

  const reasonPrefix = isExisting ? "Replacing existing workout: " : "Found placeholder: ";
  const weeklyPlanNote = result.isWeeklyPlan ? " [from weekly plan: " + (result.suggestedType || "no type") + "]" : "";

  return {
    shouldGenerate: true,
    reason: reasonPrefix + placeholderName + " (" + activityType + ")" + weeklyPlanNote + recoveryNote,
    duration: duration,
    placeholder: result.placeholder,
    activityType: activityType,
    isExisting: isExisting,
    isWeeklyPlan: result.isWeeklyPlan || false,
    suggestedType: result.suggestedType || null
  };
}

/**
 * Fetch upcoming workout placeholders for the next N days
 * @param {number} days - Number of days to look ahead (default 7)
 * @returns {Array} Array of upcoming placeholder info
 */
function fetchUpcomingPlaceholders(days = 7) {
  const upcoming = [];
  const ridePlaceholder = USER_SETTINGS.PLACEHOLDER_RIDE.toLowerCase();
  const runPlaceholder = USER_SETTINGS.PLACEHOLDER_RUN.toLowerCase();

  for (let i = 0; i < days; i++) {
    const date = new Date();
    date.setDate(date.getDate() + i);
    const dateStr = formatDateISO(date);
    const dayName = Utilities.formatDate(date, SYSTEM_SETTINGS.TIMEZONE, "EEEE");

    const endpoint = "/athlete/0/events?oldest=" + dateStr + "&newest=" + dateStr;
    const result = fetchIcuApi(endpoint);

    let placeholder = null;
    let eventCategory = null;

    if (result.success && Array.isArray(result.data)) {
      // Check for race events
      for (const e of result.data) {
        if (e.category === "RACE_A" || e.category === "RACE_B" || e.category === "RACE_C") {
          eventCategory = e.category.replace("RACE_", "");
          break;
        }
      }

      // Check for workout placeholders
      placeholder = result.data.find(function(e) {
        if (!e.name) return false;
        const nameLower = e.name.toLowerCase();
        return nameLower.startsWith(ridePlaceholder) ||
               nameLower.startsWith(runPlaceholder) ||
               nameLower.startsWith("hardlopen");
      });
    }

    if (placeholder || eventCategory) {
      let activityType = null;
      let duration = null;

      if (placeholder) {
        const nameLower = placeholder.name.toLowerCase();
        const isRun = nameLower.startsWith(runPlaceholder) || nameLower.startsWith("hardlopen");
        activityType = isRun ? "Run" : "Ride";
        duration = parseDurationFromName(placeholder.name, activityType);
      }

      upcoming.push({
        date: dateStr,
        dayName: dayName,
        activityType: activityType,
        duration: duration,
        hasEvent: eventCategory !== null,
        eventCategory: eventCategory,
        placeholderName: placeholder ? placeholder.name : null
      });
    }
  }

  return upcoming;
}

// =========================================================
// VARIETY & WORKOUT HISTORY
// =========================================================

/**
 * Classify an activity based on its zone distribution and intensity
 * @param {object} activity - Activity data from Intervals.icu
 * @returns {object|null} { type, sport } or null if too short
 */
function classifyActivityType(activity) {
  // Determine sport type
  const sport = (activity.type === "Run" || activity.type === "VirtualRun") ? "Run" : "Ride";

  // Get zone times (in seconds) - works for both power zones and pace zones
  const zones = activity.icu_zone_times || activity.gap_zone_times || [];
  const getZoneSecs = function(zoneId) {
    const zone = zones.find(function(z) { return z.id === zoneId; });
    return zone ? zone.secs : 0;
  };

  const z1 = getZoneSecs("Z1");
  const z2 = getZoneSecs("Z2");
  const z3 = getZoneSecs("Z3");
  const z4 = getZoneSecs("Z4");
  const z5 = getZoneSecs("Z5");
  const z6 = getZoneSecs("Z6");
  const z7 = getZoneSecs("Z7");
  const ss = getZoneSecs("SS");

  const totalTime = activity.moving_time || (z1 + z2 + z3 + z4 + z5 + z6 + z7);
  if (totalTime < 600) return null; // Skip very short activities (<10 min)

  const highIntensity = z5 + z6 + z7;
  const threshold = z4 + ss;
  const endurance = z2 + z3;

  // Classify based on time in zones
  let type;
  if (highIntensity > 300) {
    type = sport === "Run" ? "Run_Intervals" : "VO2maxHighIntensity";
  } else if (threshold > 600) {
    type = sport === "Run" ? "Run_Tempo" : "FTPThreshold";
  } else if (endurance > totalTime * 0.5) {
    type = sport === "Run" ? "Run_Easy" : "EnduranceTempo";
  } else if (z1 > totalTime * 0.5) {
    type = sport === "Run" ? "Run_Recovery" : "RecoveryEasy";
  } else {
    type = sport === "Run" ? "Run_Easy" : "EnduranceTempo";
  }

  return { type: type, sport: sport };
}

/**
 * Fetch recent activities from Intervals.icu to track variety
 * @param {number} daysBack - How many days to look back (default 7)
 * @returns {object} { rides, runs, all } arrays of workout types
 */
function getRecentWorkoutTypes(daysBack = 7) {
  const today = new Date();
  const oldest = new Date(today);
  oldest.setDate(today.getDate() - daysBack);

  const todayStr = formatDateISO(today);
  const oldestStr = formatDateISO(oldest);

  const result = { rides: [], runs: [], all: [] };

  // Fetch actual activities (not just planned workouts)
  const activitiesEndpoint = "/athlete/0/activities?oldest=" + oldestStr + "&newest=" + todayStr;
  const activitiesResult = fetchIcuApi(activitiesEndpoint);

  if (activitiesResult.success && Array.isArray(activitiesResult.data)) {
    activitiesResult.data.forEach(function(a) {
      if (a.type === "Ride" || a.type === "VirtualRide" || a.type === "Run" || a.type === "VirtualRun") {
        const classified = classifyActivityType(a);
        if (classified) {
          result.all.push(classified.type);
          if (classified.sport === "Ride") {
            result.rides.push(classified.type);
          } else {
            result.runs.push(classified.type);
          }
        }
      }
    });
  } else if (activitiesResult.error) {
    Logger.log("Error fetching recent activities: " + activitiesResult.error);
  }

  // Also check IntervalCoach workouts from events (for planned but not yet executed)
  const eventsEndpoint = "/athlete/0/events?oldest=" + oldestStr + "&newest=" + todayStr;
  const eventsResult = fetchIcuApi(eventsEndpoint);

  if (eventsResult.success && Array.isArray(eventsResult.data)) {
    eventsResult.data.forEach(function(e) {
      if (e.name?.startsWith("IntervalCoach_")) {
        const match = e.name.match(/IntervalCoach_([A-Za-z]+)_/);
        if (match) {
          const type = match[1];
          result.all.push(type);
          if (type.startsWith("Run")) {
            result.runs.push(type);
          } else {
            result.rides.push(type);
          }
        }
      }
    });
  } else if (eventsResult.error) {
    Logger.log("Error fetching recent events: " + eventsResult.error);
  }

  return result;
}

/**
 * Get 2-week workout history with frequency analysis for variety planning
 * @returns {object} { rideTypes, runTypes, mostFrequent, typeCounts }
 */
function getTwoWeekWorkoutHistory() {
  const twoWeekTypes = getRecentWorkoutTypes(14);

  // Count frequency of each type
  const allTypes = [...twoWeekTypes.rides, ...twoWeekTypes.runs];
  const typeCounts = {};
  allTypes.forEach(function(t) {
    typeCounts[t] = (typeCounts[t] || 0) + 1;
  });

  // Find most frequent
  let mostFrequent = null;
  let maxCount = 0;
  Object.keys(typeCounts).forEach(function(type) {
    if (typeCounts[type] > maxCount) {
      maxCount = typeCounts[type];
      mostFrequent = type;
    }
  });

  // Get unique types (de-duplicated)
  const uniqueRides = [...new Set(twoWeekTypes.rides)];
  const uniqueRuns = [...new Set(twoWeekTypes.runs)];

  return {
    rideTypes: uniqueRides,
    runTypes: uniqueRuns,
    mostFrequent: mostFrequent ? mostFrequent + ' (' + maxCount + 'x)' : null,
    typeCounts: typeCounts
  };
}

// =========================================================
// AI-DRIVEN WORKOUT DECISION
// =========================================================

/**
 * Generate AI-powered workout decision based on full context
 * @param {object} context - Full context for decision
 * @returns {object|null} { workoutType, intensity, reasoning, shouldTrain } or null if AI fails
 */
function generateAIWorkoutDecision(context) {
  const isRun = context.activityType === "Run";
  const catalogType = isRun ? "run" : "ride";

  // Build workout options for the AI
  const catalog = isRun ? WORKOUT_TYPES.run : WORKOUT_TYPES.ride;
  const workoutOptions = Object.keys(catalog).map(function(name) {
    const type = catalog[name];
    return name + " (intensity: " + type.intensity + "/5, zones: " + type.zones + ", phases: " + type.phases.join("/") + ")";
  }).join("\n");

  // Build recent workout context
  const recentList = isRun
    ? (context.recentWorkouts?.runs || [])
    : (context.recentWorkouts?.rides || []);
  const recentStr = recentList.length > 0 ? recentList.join(", ") : "None in last 7 days";

  const prompt = `You are an expert cycling/running coach making a training decision for today.

**ATHLETE CONTEXT:**
- Activity Type: ${context.activityType}
- Training Phase: ${context.phase} (${context.weeksOut} weeks to goal)
- Phase Focus: ${context.phaseFocus || 'Not specified'}
- Goal: ${context.goalDescription || 'General fitness'}
${context.phaseReasoning ? '- AI Phase Reasoning: ' + context.phaseReasoning : ''}

**FITNESS & FATIGUE:**
- CTL (Fitness): ${context.ctl ? context.ctl.toFixed(0) : 'N/A'}
- TSB (Form): ${context.tsb ? context.tsb.toFixed(1) : 'N/A'} ${context.tsb < -20 ? '(VERY FATIGUED)' : context.tsb < -10 ? '(fatigued)' : context.tsb > 10 ? '(fresh)' : '(balanced)'}
- Recovery Status: ${context.recoveryStatus || 'Unknown'}${context.recoveryScore ? ' (' + context.recoveryScore + '%)' : ''}

**EVENT CONTEXT:**
- Event Tomorrow: ${context.eventTomorrow?.hasEvent ? context.eventTomorrow.category + ' priority event' : 'No'}
- Event Yesterday: ${context.eventYesterday?.hadEvent ? context.eventYesterday.category + ' priority event' : 'No'}

**RECENT TRAINING (for variety):**
- Recent ${context.activityType}s: ${recentStr}
- Last Workout Intensity: ${context.lastIntensity || 0}/5 (${context.daysSinceLastWorkout || 0} days ago)

**DURATION WINDOW:** ${context.duration?.min || 45}-${context.duration?.max || 60} minutes
${context.suggestedType ? `
**WEEKLY PLAN SUGGESTION:**
The weekly plan suggests "${context.suggestedType}" for today.
Consider this as a starting point, but adjust based on current conditions (especially recovery, TSB, and yesterday's intensity).
If conditions have changed significantly, choose a more appropriate workout type.
` : ''}
**AVAILABLE WORKOUT TYPES:**
${workoutOptions}

**DECISION RULES:**
1. If event tomorrow (A/B): Only intensity 1-2 (recovery/easy)
2. If event tomorrow (C): Max intensity 3
3. If event yesterday (A/B): Max intensity 2
4. If event yesterday (C): Max intensity 3
5. If TSB < -20: Max intensity 2 (very fatigued)
6. If TSB < -10: Max intensity 3 (fatigued)
7. If recovery is Yellow (<50%): Max intensity 3
8. If last workout was intensity 4-5 AND was yesterday/2 days ago: Today should be 1-3
9. If 4+ days since last workout: Athlete is fresh, any intensity appropriate
10. Prioritize variety - avoid repeating recent workout types
11. Match workout to training phase

**YOUR TASK:**
Recommend ONE specific workout type from the list above. Consider all factors holistically.

**Output JSON only (no markdown):**
{
  "shouldTrain": true,
  "workoutType": "exact_workout_name_from_list",
  "intensity": 1-5,
  "reasoning": "2-3 sentence explanation of why this workout",
  "varietyNote": "optional note about avoiding recently done types"
}`;

  const response = callGeminiAPIText(prompt);

  if (!response) {
    Logger.log("AI workout decision: No response from Gemini");
    return null;
  }

  try {
    let cleaned = response.trim();
    cleaned = cleaned.replace(/^```json\n?/g, '').replace(/^```\n?/g, '').replace(/```$/g, '').trim();
    const decision = JSON.parse(cleaned);

    // Validate the workout type exists
    if (decision.workoutType && catalog[decision.workoutType]) {
      return decision;
    } else {
      Logger.log("AI suggested unknown workout type: " + decision.workoutType);
      return null;
    }
  } catch (e) {
    Logger.log("Failed to parse AI workout decision: " + e.toString());
    Logger.log("Raw response: " + response.substring(0, 500));
    return null;
  }
}

// =========================================================
// SMART WORKOUT SELECTION
// =========================================================

/**
 * Smart workout type selection - AI-enhanced with rule-based fallback
 * @param {object} params - Selection parameters
 * @returns {object} { types, reason, maxIntensity, isRestDay }
 */
function selectWorkoutTypes(params) {
  // Support both old and new calling conventions
  let wellness, recentWorkouts, activityType, phaseInfo, tsb, eventTomorrow, eventYesterday;

  if (arguments.length === 3) {
    // Old format: selectWorkoutTypes(wellness, recentTypes, activityType)
    wellness = arguments[0];
    recentWorkouts = { types: arguments[1], lastIntensity: 0 };
    activityType = arguments[2];
    phaseInfo = { phaseName: "Build" };
    tsb = 0;
    eventTomorrow = { hasEvent: false, category: null };
    eventYesterday = { hadEvent: false, category: null };
  } else {
    wellness = params.wellness;
    recentWorkouts = params.recentWorkouts || { types: {}, lastIntensity: 0 };
    activityType = params.activityType;
    phaseInfo = params.phaseInfo || { phaseName: "Build" };
    tsb = params.tsb || 0;
    // Support both boolean (legacy) and object format for eventTomorrow
    eventTomorrow = typeof params.eventTomorrow === 'object'
      ? params.eventTomorrow
      : { hasEvent: !!params.eventTomorrow, category: null };
    eventYesterday = params.eventYesterday || { hadEvent: false, category: null };
  }

  const isRun = activityType === "Run";
  const catalog = isRun ? WORKOUT_TYPES.run : WORKOUT_TYPES.ride;
  const phaseName = phaseInfo.phaseName || "Build";

  // Get recovery score (default to 70 if not available)
  const recoveryScore = wellness?.today?.recovery ?? 70;

  // ===== TRY AI-DRIVEN DECISION FIRST =====
  if (params.enableAI !== false) {
    try {
      const aiContext = {
        activityType: activityType,
        phase: phaseName,
        weeksOut: phaseInfo.weeksOut,
        phaseFocus: phaseInfo.focus,
        phaseReasoning: phaseInfo.reasoning,
        goalDescription: phaseInfo.goalDescription,
        ctl: params.ctl,
        tsb: tsb,
        recoveryStatus: wellness?.recoveryStatus || 'Unknown',
        recoveryScore: recoveryScore,
        eventTomorrow: eventTomorrow,
        eventYesterday: eventYesterday,
        recentWorkouts: recentWorkouts.types,
        lastIntensity: recentWorkouts.lastIntensity,
        daysSinceLastWorkout: params.daysSinceLastWorkout,
        duration: params.duration,
        // Weekly plan hint (may be adjusted based on current conditions)
        suggestedType: params.suggestedType,
        isWeeklyPlan: params.isWeeklyPlan
      };

      const aiDecision = generateAIWorkoutDecision(aiContext);

      if (aiDecision && aiDecision.workoutType) {
        Logger.log("Workout Decision: " + aiDecision.workoutType + " (intensity " + aiDecision.intensity + "/5)");
        Logger.log("  Reasoning: " + aiDecision.reasoning);
        if (aiDecision.varietyNote) {
          Logger.log("  Variety: " + aiDecision.varietyNote);
        }

        return {
          types: [aiDecision.workoutType],
          reason: aiDecision.reasoning,
          maxIntensity: aiDecision.intensity,
          isRestDay: !aiDecision.shouldTrain,
          aiEnhanced: true
        };
      }
    } catch (e) {
      Logger.log("Workout decision failed, using fallback: " + e.toString());
    }
  }

  // ===== SIMPLIFIED FALLBACK =====
  // AI-first approach: this only runs if AI fails, so keep it simple and safe
  Logger.log("Using fallback workout selection");

  // Simple intensity cap based on critical factors only
  let maxIntensity = 3; // Default to moderate when AI unavailable

  // Event tomorrow = easy
  if (eventTomorrow.hasEvent) {
    maxIntensity = eventTomorrow.category === "C" ? 3 : 2;
  }

  // Very fatigued = easy
  if (tsb < -15) {
    maxIntensity = 2;
  }

  // Low recovery = easy
  if (recoveryScore < TRAINING_CONSTANTS.RECOVERY.YELLOW_THRESHOLD) {
    maxIntensity = 2;
  }

  // Select safe default based on intensity cap
  let fallbackType, reason;

  if (maxIntensity <= 2) {
    fallbackType = isRun ? "Run_Easy" : "Endurance_Z2";
    reason = "Fallback: conservative selection due to fatigue/recovery/event";
  } else {
    // Moderate intensity - pick phase-appropriate workout
    if (phaseName === "Base") {
      fallbackType = isRun ? "Run_Easy" : "Endurance_Tempo";
    } else if (phaseName === "Build") {
      fallbackType = isRun ? "Run_Tempo" : "SweetSpot_Standard";
    } else {
      fallbackType = isRun ? "Run_Tempo" : "Endurance_Tempo";
    }
    reason = "Fallback: " + phaseName + " phase default";
  }

  return {
    types: [fallbackType],
    reason: reason,
    maxIntensity: maxIntensity,
    isRestDay: false,
    aiEnhanced: false
  };
}

// =========================================================
// EVENT DETECTION
// =========================================================

/**
 * Check if there's an A, B, or C priority event tomorrow
 * @returns {object} { hasEvent, category }
 */
function hasEventTomorrow() {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = formatDateISO(tomorrow);

  const endpoint = "/athlete/0/events?oldest=" + tomorrowStr + "&newest=" + tomorrowStr;
  const result = fetchIcuApi(endpoint);

  if (!result.success || !Array.isArray(result.data)) {
    return { hasEvent: false, category: null };
  }

  // Check for A, B, or C priority events
  for (const e of result.data) {
    if (e.category === "RACE_A") {
      return { hasEvent: true, category: "A" };
    }
    if (e.category === "RACE_B") {
      return { hasEvent: true, category: "B" };
    }
    if (e.category === "RACE_C") {
      return { hasEvent: true, category: "C" };
    }
  }

  return { hasEvent: false, category: null };
}

/**
 * Check if there was an A, B, or C priority event yesterday
 * @returns {object} { hadEvent, category }
 */
function hasEventYesterday() {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = formatDateISO(yesterday);

  const endpoint = "/athlete/0/events?oldest=" + yesterdayStr + "&newest=" + yesterdayStr;
  const result = fetchIcuApi(endpoint);

  if (!result.success || !Array.isArray(result.data)) {
    return { hadEvent: false, category: null };
  }

  // Check for A, B, or C priority events
  for (const e of result.data) {
    if (e.category === "RACE_A") {
      return { hadEvent: true, category: "A" };
    }
    if (e.category === "RACE_B") {
      return { hadEvent: true, category: "B" };
    }
    if (e.category === "RACE_C") {
      return { hadEvent: true, category: "C" };
    }
  }

  return { hadEvent: false, category: null };
}

/**
 * Check if there's an A, B, or C priority event in N days
 * @param {number} days - Number of days from today
 * @returns {object} { hasEvent, category }
 */
function hasEventInDays(days) {
  const targetDate = new Date();
  targetDate.setDate(targetDate.getDate() + days);
  const dateStr = formatDateISO(targetDate);

  const endpoint = "/athlete/0/events?oldest=" + dateStr + "&newest=" + dateStr;
  const result = fetchIcuApi(endpoint);

  if (!result.success || !Array.isArray(result.data)) {
    return { hasEvent: false, category: null };
  }

  for (const e of result.data) {
    if (e.category === "RACE_A") {
      return { hasEvent: true, category: "A" };
    }
    if (e.category === "RACE_B") {
      return { hasEvent: true, category: "B" };
    }
    if (e.category === "RACE_C") {
      return { hasEvent: true, category: "C" };
    }
  }

  return { hasEvent: false, category: null };
}

/**
 * Get most recent workout's intensity (1-5 scale)
 * Note: This returns intensity regardless of when workout occurred
 * Use daysSinceLastWorkout from adaptiveContext for timing info
 * @param {object} recentTypes - Recent workout types data
 * @returns {number} Intensity of last workout (0 if none)
 */
function getLastWorkoutIntensity(recentTypes) {
  // Check the most recent workout
  const allRecent = recentTypes.all || [];
  if (allRecent.length === 0) return 0;

  const lastType = allRecent[0];
  const catalog = { ...WORKOUT_TYPES.ride, ...WORKOUT_TYPES.run };

  if (catalog[lastType]) {
    return catalog[lastType].intensity;
  }

  // Estimate from type name
  if (lastType.includes("VO2") || lastType.includes("Interval") || lastType.includes("Sprint")) {
    return 5;
  }
  if (lastType.includes("Threshold") || lastType.includes("FTP")) {
    return 4;
  }
  if (lastType.includes("Tempo") || lastType.includes("SweetSpot")) {
    return 3;
  }
  if (lastType.includes("Easy") || lastType.includes("Z2")) {
    return 2;
  }
  if (lastType.includes("Recovery")) {
    return 1;
  }

  return 3; // Default to moderate
}

// =========================================================
// TRAINING PROPOSAL
// =========================================================

/**
 * Generate AI-powered training proposal for upcoming week
 * @param {object} params - Context for generating proposal
 * @returns {string|null} Training proposal text
 */
function generateWeeklyTrainingProposal(params) {
  const { upcoming, phaseInfo, fitnessMetrics, goals, wellness, loadAdvice } = params;
  const lang = USER_SETTINGS.LANGUAGE || "en";

  if (!upcoming || upcoming.length === 0) {
    return null;
  }

  // Format upcoming days
  const upcomingText = upcoming.map(function(day) {
    let desc = day.dayName + " (" + day.date + "): ";
    if (day.hasEvent) {
      desc += day.eventCategory + " Event";
      if (day.activityType) {
        desc += " + " + day.activityType + " placeholder";
      }
    } else if (day.activityType) {
      desc += day.activityType + " (" + day.duration.min + "-" + day.duration.max + " min)";
    }
    return desc;
  }).join("\n");

  const prompt = `You are an expert cycling and running coach. Generate a training proposal for the upcoming week.

ATHLETE CONTEXT:
- Training Phase: ${phaseInfo.phaseName} (${phaseInfo.weeksOut} weeks to goal)
- Goal: ${phaseInfo.goalDescription || goals?.primaryGoal?.name || "General fitness"}
- Current CTL: ${fitnessMetrics.ctl?.toFixed(0) || "N/A"}
- Current TSB: ${fitnessMetrics.tsb?.toFixed(0) || "N/A"}
- Recovery Status: ${wellness?.recoveryStatus || "Unknown"}
- Weekly TSS Target: ${loadAdvice?.tssRange?.min || 300}-${loadAdvice?.tssRange?.max || 500}

UPCOMING SCHEDULED DAYS:
${upcomingText}

WORKOUT TYPE OPTIONS:
Cycling: Recovery_Easy, Endurance_Z2, Endurance_Tempo, SweetSpot, Tempo_Sustained, FTP_Threshold, Over_Unders, VO2max_Intervals, Anaerobic_Sprints
Running: Run_Recovery, Run_Easy, Run_Long, Run_Tempo, Run_Fartlek, Run_Threshold, Run_Intervals, Run_Strides

INSTRUCTIONS:
1. For each scheduled day, suggest a specific workout type and brief focus
2. Consider hard-easy alternation (don't schedule back-to-back hard days)
3. If there's an event, suggest appropriate pre/post-event training
4. Keep suggestions practical and aligned with current fitness/phase
5. Use ${lang === "nl" ? "Dutch" : lang === "ja" ? "Japanese" : lang === "es" ? "Spanish" : lang === "fr" ? "French" : "English"} language
6. Be concise - max 2-3 sentences per day
7. Format each day on its own line with the day name

Generate a personalized training proposal:`;

  try {
    const proposal = callGeminiAPIText(prompt);
    return proposal;
  } catch (e) {
    Logger.log("Error generating training proposal: " + e.toString());
    return null;
  }
}

/**
 * Generate comprehensive AI weekly training plan
 * @param {object} context - Full context for planning
 * @returns {object} Structured weekly plan with day-by-day recommendations
 */
function generateAIWeeklyPlan(context) {
  // Build last week summary
  let lastWeekContext = '';
  if (context.lastWeek) {
    const lw = context.lastWeek;
    lastWeekContext = `
**LAST WEEK REVIEW:**
- Total TSS: ${lw.totalTss?.toFixed(0) || 'N/A'}
- Activities: ${lw.activities || 0}
- Rides: ${lw.rideTypes?.join(', ') || 'None'}
- Runs: ${lw.runTypes?.join(', ') || 'None'}
- High Intensity Days: ${lw.highIntensityDays || 0}
`;
  }

  // Build 2-week workout history for variety
  let historyContext = '';
  if (context.twoWeekHistory) {
    const hist = context.twoWeekHistory;
    historyContext = `
**RECENT WORKOUT HISTORY (2 weeks - avoid repeating):**
- Ride Types Used: ${hist.rideTypes?.join(', ') || 'None'}
- Run Types Used: ${hist.runTypes?.join(', ') || 'None'}
- Most Frequent: ${hist.mostFrequent || 'N/A'}
`;
  }

  // Build upcoming events context
  let eventsContext = '';
  if (context.upcomingEvents && context.upcomingEvents.length > 0) {
    eventsContext = '\n**UPCOMING EVENTS:**\n' + context.upcomingEvents.map(e =>
      `- ${e.date} (${e.dayName}): ${e.eventCategory} priority${e.name ? ' - ' + e.name : ''}`
    ).join('\n');
  }

  // Build scheduled days context
  let scheduledContext = '';
  if (context.scheduledDays && context.scheduledDays.length > 0) {
    scheduledContext = '\n**ALREADY SCHEDULED:**\n' + context.scheduledDays.map(d =>
      `- ${d.dayName} (${d.date}): ${d.activityType} ${d.duration ? d.duration.min + '-' + d.duration.max + 'min' : ''}`
    ).join('\n');
  }

  // Build goals context
  let goalsContext = '';
  if (context.goals?.available) {
    const g = context.goals;
    goalsContext = `
**GOALS:**
- Primary (A): ${g.primaryGoal ? g.primaryGoal.name + ' (' + g.primaryGoal.date + ')' : 'None'}
- Secondary (B): ${g.secondaryGoals?.length > 0 ? g.secondaryGoals.map(r => r.name).join(', ') : 'None'}
`;
  }

  const prompt = `You are an expert cycling and running coach creating a WEEKLY TRAINING PLAN.

**ATHLETE STATUS:**
- Training Phase: ${context.phase || 'Build'} (${context.weeksOut || '?'} weeks to goal)
- Phase Focus: ${context.phaseFocus || 'General development'}
${context.phaseReasoning ? '- AI Phase Reasoning: ' + context.phaseReasoning : ''}

**CURRENT FITNESS:**
- CTL (Fitness): ${context.ctl?.toFixed(0) || 'N/A'}
- ATL (Fatigue): ${context.atl?.toFixed(0) || 'N/A'}
- TSB (Form): ${context.tsb?.toFixed(1) || 'N/A'} ${context.tsb < -15 ? '(FATIGUED)' : context.tsb > 5 ? '(FRESH)' : '(BALANCED)'}
- eFTP: ${context.eftp || 'N/A'}W
- CTL Trend: ${context.ctlTrend || 'stable'}
${goalsContext}
**RECOVERY STATUS:**
- Current: ${context.recoveryStatus || 'Unknown'}
- 7-day Avg Recovery: ${context.avgRecovery ? context.avgRecovery.toFixed(0) + '%' : 'N/A'}
- 7-day Avg Sleep: ${context.avgSleep ? context.avgSleep.toFixed(1) + 'h' : 'N/A'}
${lastWeekContext}${historyContext}${eventsContext}${scheduledContext}

**WEEKLY TARGETS:**
- Recommended TSS: ${context.tssTarget?.min || 300}-${context.tssTarget?.max || 500}
- Daily TSS Range: ${context.dailyTss?.min || 50}-${context.dailyTss?.max || 100}

**AVAILABLE WORKOUT TYPES:**
Cycling: Recovery_Easy (1), Endurance_Z2 (2), Endurance_Tempo (3), SweetSpot (3), Tempo_Sustained (3), FTP_Threshold (4), Over_Unders (4), VO2max_Intervals (5), Anaerobic_Sprints (5)
Running: Run_Recovery (1), Run_Easy (2), Run_Long (3), Run_Tempo (3), Run_Fartlek (3), Run_Threshold (4), Run_Intervals (5), Run_Strides (2)
(Numbers = intensity 1-5)

**PLANNING RULES:**
1. Maximum 3 rides and 1-2 runs per week (athlete has limited time)
2. Never schedule back-to-back intensity 4-5 days
3. After intensity 5, next day should be 1-2
4. Include at least 1 full rest day if TSB < -10
5. Pre-race day (A/B event): intensity 1-2 only
6. Post-race day (A/B event): rest or intensity 1
7. Build week = 3-4 quality sessions; Recovery week = 1-2 quality sessions
8. Respect already scheduled days, enhance with type recommendations
9. If fatigued (TSB < -15), reduce volume and intensity
10. VARIETY: Avoid repeating same workout type from last 2 weeks unless strategically needed

**YOUR TASK:**
Create a 7-day plan starting from ${context.startDate || 'today'}. For each day provide:
- Recommended activity (Ride/Run/Rest)
- Specific workout type (from list above)
- Estimated TSS
- Brief focus/notes

**Output JSON only:**
{
  "weeklyStrategy": "2-3 sentence overview of the week's approach",
  "totalPlannedTSS": 350,
  "intensityDistribution": {
    "high": 2,
    "medium": 2,
    "low": 2,
    "rest": 1
  },
  "days": [
    {
      "date": "2024-01-15",
      "dayName": "Monday",
      "activity": "Ride",
      "workoutType": "Endurance_Z2",
      "intensity": 2,
      "estimatedTSS": 50,
      "duration": 60,
      "focus": "Easy spin to start the week"
    },
    ...
  ],
  "keyWorkouts": ["Wednesday: Threshold intervals for FTP development", "Saturday: Long endurance for aerobic base"],
  "recoveryNotes": "Include foam rolling after Thursday's session"
}`;

  const response = callGeminiAPIText(prompt);

  if (!response) {
    Logger.log("AI weekly plan: No response from Gemini");
    return null;
  }

  try {
    let cleaned = response.trim();
    cleaned = cleaned.replace(/^```json\n?/g, '').replace(/^```\n?/g, '').replace(/```$/g, '').trim();
    return JSON.parse(cleaned);
  } catch (e) {
    Logger.log("Failed to parse AI weekly plan: " + e.toString());
    Logger.log("Raw response: " + response.substring(0, 500));
    return null;
  }
}

// =========================================================
// UPLOAD FUNCTIONS
// =========================================================

/**
 * Upload workout to Intervals.icu, replacing existing placeholder if provided
 * @param {string} name - Workout name
 * @param {string} zwoContent - ZWO file content
 * @param {string} dateStr - Date in yyyy-MM-dd format
 * @param {object} placeholder - Optional placeholder event to replace
 */
function uploadWorkoutToIntervals(name, zwoContent, dateStr, placeholder) {
  // Validate ZWO structure before upload
  const validation = validateZwoXml(zwoContent);
  if (!validation.valid) {
    Logger.log(" -> ZWO validation failed: " + validation.errors.join(", "));
    return;
  }
  if (validation.warnings.length > 0) {
    Logger.log(" -> ZWO warnings: " + validation.warnings.join(", "));
  }

  const athleteId = "0"; // "0" works for the API key owner

  // If we have a placeholder, update it (PUT); otherwise create new (POST)
  const isUpdate = placeholder?.id;
  const url = isUpdate
    ? "https://intervals.icu/api/v1/athlete/" + athleteId + "/events/" + placeholder.id
    : "https://intervals.icu/api/v1/athlete/" + athleteId + "/events";

  const payload = {
    category: "WORKOUT",
    type: "Ride",
    name: name,
    description: "Generated by IntervalCoach AI Coach",
    start_date_local: dateStr + "T10:00:00", // Schedule for 10:00 AM
    file_contents: zwoContent,
    file_extension: "zwo"
  };

  const options = {
    method: isUpdate ? "put" : "post",
    headers: {
      "Authorization": getIcuAuthHeader(),
      "Content-Type": "application/json"
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };

  try {
    const response = UrlFetchApp.fetch(url, options);
    const code = response.getResponseCode();
    if (code === 200 || code === 201) {
      Logger.log(" -> " + (isUpdate ? "Replaced placeholder" : "Uploaded") + " to Intervals.icu: " + name);
    } else {
      Logger.log(" -> Failed to upload to Intervals.icu: " + response.getContentText());
    }
  } catch (e) {
    Logger.log(" -> Error uploading to Intervals.icu: " + e.toString());
  }
}

/**
 * Upload running workout to Intervals.icu, replacing existing placeholder if provided
 * @param {string} name - Workout name
 * @param {string} description - Workout description (text format for runs)
 * @param {string} dateStr - Date in yyyy-MM-dd format
 * @param {object} placeholder - Optional placeholder event to replace
 * @param {object} duration - Duration object { min, max } for estimated time
 */
function uploadRunToIntervals(name, description, dateStr, placeholder, duration) {
  const athleteId = "0"; // "0" works for the API key owner

  // If we have a placeholder, update it (PUT); otherwise create new (POST)
  const isUpdate = placeholder?.id;
  const url = isUpdate
    ? "https://intervals.icu/api/v1/athlete/" + athleteId + "/events/" + placeholder.id
    : "https://intervals.icu/api/v1/athlete/" + athleteId + "/events";

  // Estimate moving time from duration (use midpoint)
  const estimatedMinutes = duration ? Math.round((duration.min + duration.max) / 2) : 40;
  const movingTime = estimatedMinutes * 60; // Convert to seconds

  const payload = {
    category: "WORKOUT",
    type: "Run",
    name: name,
    description: "Generated by IntervalCoach AI Coach\n\n" + description,
    start_date_local: dateStr + "T10:00:00", // Schedule for 10:00 AM
    moving_time: movingTime
  };

  const options = {
    method: isUpdate ? "put" : "post",
    headers: {
      "Authorization": getIcuAuthHeader(),
      "Content-Type": "application/json"
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };

  try {
    const response = UrlFetchApp.fetch(url, options);
    const code = response.getResponseCode();
    if (code === 200 || code === 201) {
      Logger.log(" -> " + (isUpdate ? "Replaced placeholder" : "Uploaded") + " run to Intervals.icu: " + name);
    } else {
      Logger.log(" -> Failed to upload run to Intervals.icu: " + response.getContentText());
    }
  } catch (e) {
    Logger.log(" -> Error uploading run to Intervals.icu: " + e.toString());
  }
}

// =========================================================
// WEEKLY PLAN CALENDAR CREATION
// =========================================================

/**
 * Create placeholder events in Intervals.icu calendar from weekly plan
 * These are simple placeholders that will be replaced by detailed workouts on the day
 * @param {object} weeklyPlan - Weekly plan from generateAIWeeklyPlan
 * @returns {object} { created: number, skipped: number, errors: number }
 */
function createWeeklyPlanEvents(weeklyPlan) {
  if (!weeklyPlan || !weeklyPlan.days) {
    Logger.log("No weekly plan to create events from");
    return { created: 0, skipped: 0, errors: 0 };
  }

  const athleteId = "0";
  const results = { created: 0, skipped: 0, errors: 0 };

  Logger.log("Creating calendar events from weekly plan...");

  for (const day of weeklyPlan.days) {
    // Skip rest days
    if (day.activity === 'Rest') {
      Logger.log(` -> ${day.date} (${day.dayName}): Rest day - skipping`);
      results.skipped++;
      continue;
    }

    // Check if there's already an event on this date
    const existingCheck = fetchIcuApi("/athlete/" + athleteId + "/events?oldest=" + day.date + "&newest=" + day.date);
    let existingEventId = null;

    if (existingCheck.success && existingCheck.data?.length > 0) {
      // Look for existing weekly plan placeholder or simple Ride/Run to update
      const existingPlaceholder = existingCheck.data.find(e =>
        e.description?.includes('[Weekly Plan]') ||
        (e.category === 'WORKOUT' && ['Ride', 'Run'].includes(e.name?.split(' - ')[0]))
      );

      if (existingPlaceholder) {
        existingEventId = existingPlaceholder.id;
        Logger.log(` -> ${day.date} (${day.dayName}): Updating existing placeholder`);
      } else {
        // Check if there's a real workout (not a placeholder)
        const hasRealWorkout = existingCheck.data.some(e =>
          e.category === 'WORKOUT' &&
          e.name &&
          !['Ride', 'Run'].includes(e.name) &&
          !e.description?.includes('[Weekly Plan]')
        );
        if (hasRealWorkout) {
          Logger.log(` -> ${day.date} (${day.dayName}): Real workout exists - skipping`);
          results.skipped++;
          continue;
        }
      }
    }

    // Create event with workout type in name
    const isRun = day.activity === 'Run';
    const workoutLabel = day.workoutType || (isRun ? 'Run' : 'Ride');
    const eventName = `${workoutLabel} - ${day.duration}min`;

    const payload = {
      category: "WORKOUT",
      type: day.activity,
      name: eventName,
      description: `[Weekly Plan]\n\n${day.focus}\n\nTSS Target: ~${day.estimatedTSS}\nDuration: ${day.duration} min\n\nThis workout will be refined with detailed intervals when generated.`,
      start_date_local: day.date + "T10:00:00",
      moving_time: day.duration * 60
    };

    // Use PUT to update if event exists, POST to create new
    const url = existingEventId
      ? "https://intervals.icu/api/v1/athlete/" + athleteId + "/events/" + existingEventId
      : "https://intervals.icu/api/v1/athlete/" + athleteId + "/events";

    const options = {
      method: existingEventId ? "put" : "post",
      headers: {
        "Authorization": getIcuAuthHeader(),
        "Content-Type": "application/json"
      },
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    };

    try {
      const response = UrlFetchApp.fetch(url, options);
      const code = response.getResponseCode();
      if (code === 200 || code === 201) {
        const action = existingEventId ? 'Updated' : 'Created';
        Logger.log(` -> ${day.date} (${day.dayName}): ${action} ${eventName}`);
        results.created++;
      } else {
        Logger.log(` -> ${day.date}: Failed to create/update event - ${response.getContentText().substring(0, 100)}`);
        results.errors++;
      }
    } catch (e) {
      Logger.log(` -> ${day.date}: Error creating/updating event - ${e.toString()}`);
      results.errors++;
    }

    // Small delay between API calls
    Utilities.sleep(200);
  }

  Logger.log(`Weekly plan events: ${results.created} created, ${results.skipped} skipped, ${results.errors} errors`);
  return results;
}

