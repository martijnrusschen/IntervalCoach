/**
 * IntervalCoach - Workout Selection & Availability
 *
 * Smart workout type selection, placeholder detection, and variety tracking.
 * Related modules: workouts_planning.gs, workouts_upload.gs
 */

// =========================================================
// PLACEHOLDER DETECTION
// =========================================================

/**
 * Check Intervals.icu calendar for workout placeholders or existing generated workouts
 * Uses cached fetchEventsForDate() to avoid duplicate API calls
 * Looks for:
 * 1. Placeholders starting with "Ride" or "Run" (e.g., "Ride - 90min" or "Run - 45min")
 * 2. Existing generated workouts (workout types from catalog, or workouts with .zwo files)
 *
 * @param {string} dateStr - Date in yyyy-MM-dd format
 * @returns {object} { hasPlaceholder, placeholder, duration, activityType, isExisting, suggestedType, isWeeklyPlan }
 */
function findIntervalCoachPlaceholder(dateStr) {
  // Use cached event fetching
  const eventData = fetchEventsForDate(dateStr);

  if (!eventData.success) {
    Logger.log("Error checking Intervals.icu calendar");
    return { hasPlaceholder: false, placeholder: null, duration: null, activityType: null, isExisting: false };
  }

  // First priority: Check for placeholders (already parsed by fetchEventsForDate)
  if (eventData.placeholders.length > 0) {
    const placeholder = eventData.placeholders[0];
    const activityType = placeholder.type; // "Run" or "Ride"
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

    // Find full event data for the placeholder (needed for id, etc.)
    const fullPlaceholder = eventData.events.find(e => e.id === placeholder.id) || placeholder;

    return {
      hasPlaceholder: true,
      placeholder: fullPlaceholder,
      duration: duration,
      activityType: activityType,
      isExisting: false,
      isWeeklyPlan: isWeeklyPlan,
      suggestedType: suggestedType
    };
  }

  // Second priority: Find existing generated workout that can be replaced
  // Get all workout type names for matching existing workouts
  const rideWorkoutTypes = Object.keys(WORKOUT_TYPES.ride).map(t => t.toLowerCase().replace(/_/g, ''));
  const runWorkoutTypes = Object.keys(WORKOUT_TYPES.run).map(t => t.toLowerCase().replace(/_/g, ''));

  const existingWorkout = eventData.workoutEvents.find(function(e) {
    if (!e.name) return false;
    // Normalize name by removing underscores for flexible matching
    const nameNormalized = e.name.toLowerCase().replace(/_/g, '');

    // Check if it's a workout type we generated (ride or run)
    const isRideType = rideWorkoutTypes.some(t => nameNormalized.includes(t));
    const isRunType = runWorkoutTypes.some(t => nameNormalized.includes(t));

    // Also check for workouts with .zwo files
    const isZwoWorkout = e.filename && e.filename.endsWith('.zwo');

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
      : parseDurationFromName(existingWorkout.name, activityType);

    // Find full event data (needed for id, etc.)
    const fullWorkout = eventData.events.find(e => e.id === existingWorkout.id) || existingWorkout;

    // Check if this is a weekly plan workout and extract suggested type
    let suggestedType = null;
    let isWeeklyPlan = false;
    const description = existingWorkout.description || fullWorkout.description || '';
    if (description.includes('[Weekly Plan]')) {
      isWeeklyPlan = true;
      // Extract workout type from event name (format: "VO2max_Intervals - 60min")
      const workoutTypePart = existingWorkout.name.split(' - ')[0];
      if (workoutTypePart) {
        suggestedType = workoutTypePart.replace(/_/g, ' ');
      }
    }

    Logger.log("Found existing workout to replace: " + existingWorkout.name + (isWeeklyPlan ? " [Weekly Plan]" : ""));

    return {
      hasPlaceholder: true,
      placeholder: fullWorkout,
      duration: duration,
      activityType: activityType,
      isExisting: true,
      isWeeklyPlan: isWeeklyPlan,
      suggestedType: suggestedType
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
 * Also checks for C events (group rides) which are unstructured training
 * @param {object} wellness - Wellness summary
 * @returns {object} { shouldGenerate, reason, duration, placeholder, activityType, isCEvent, cEventName }
 */
function checkAvailability(wellness) {
  const todayStr = formatDateISO(new Date());

  // First check for events on today
  const eventToday = hasEventOnDate(0);

  // A/B events = races, no workout generation (athlete is racing)
  if (eventToday.hasEvent && (eventToday.category === "A" || eventToday.category === "B")) {
    const raceName = eventToday.eventName || "Race";
    const raceDescription = eventToday.eventDescription || null;

    return {
      shouldGenerate: false,
      reason: eventToday.category + " race today: " + raceName + " - race day, no workout generation.",
      duration: null,
      placeholder: null,
      activityType: null,
      isExisting: false,
      isCEvent: false,
      isRaceDay: true,
      raceCategory: eventToday.category,
      raceName: raceName,
      raceDescription: raceDescription
    };
  }

  // C events = group rides where we can't control structure
  if (eventToday.hasEvent && eventToday.category === "C") {
    const cEventName = eventToday.eventName || "Group Ride";
    const cEventDescription = eventToday.eventDescription || null;

    return {
      shouldGenerate: false,
      reason: "C event today: " + cEventName + (cEventDescription ? " (" + cEventDescription + ")" : "") + " - unstructured training, no workout generation needed.",
      duration: null,
      placeholder: null,
      activityType: null,
      isExisting: false,
      isCEvent: true,
      cEventName: cEventName,
      cEventDescription: cEventDescription
    };
  }

  const result = findIntervalCoachPlaceholder(todayStr);

  if (!result.hasPlaceholder) {
    return {
      shouldGenerate: false,
      reason: "No placeholder found for today. Add '" + USER_SETTINGS.PLACEHOLDER_RIDE + "' or '" + USER_SETTINGS.PLACEHOLDER_RUN + " - 45min' to your Intervals.icu calendar.",
      duration: null,
      placeholder: null,
      activityType: null,
      isExisting: false,
      isCEvent: false
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

  // Get zone times (in seconds) - works for both power zones, pace zones, AND HR zones (fallback)
  // For cycling: icu_zone_times = power, icu_hr_zone_times = HR
  // For running: gap_zone_times = pace, icu_hr_zone_times = HR
  let zones = activity.icu_zone_times || activity.gap_zone_times || [];
  
  // If power/pace zones are empty, try HR zones
  if (zones.length === 0 && activity.icu_hr_zone_times) {
    zones = activity.icu_hr_zone_times;
  }

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

  let totalTime = activity.moving_time || (z1 + z2 + z3 + z4 + z5 + z6 + z7);
  
  // Double check: if zone sum is zero but moving time is big, try HR zones explicitly
  if ((z1+z2+z3+z4+z5+z6+z7) === 0 && activity.icu_hr_zone_times && activity.icu_hr_zone_times.length > 0) {
     zones = activity.icu_hr_zone_times;
     // Re-calculate zone secs
     // (We have to redefine them or just re-run the getZoneSecs logic. 
     //  For simplicity, we'll just recurse or copy logic. Let's just update variables.)
     //  Actually, simpler to just use HR zones if the primary zones failed.
  }

  // Refetch if we switched to HR zones
  const rZ1 = getZoneSecs("Z1");
  const rZ2 = getZoneSecs("Z2");
  const rZ3 = getZoneSecs("Z3");
  const rZ4 = getZoneSecs("Z4");
  const rZ5 = getZoneSecs("Z5");
  const rZ6 = getZoneSecs("Z6");
  const rZ7 = getZoneSecs("Z7");
  const rSS = getZoneSecs("SS");
  
  // Update total time based on zones if moving_time is missing
  if (!activity.moving_time) {
     totalTime = rZ1 + rZ2 + rZ3 + rZ4 + rZ5 + rZ6 + rZ7;
  }

  if (totalTime < 600) return null; // Skip very short activities (<10 min)

  const highIntensity = rZ5 + rZ6 + rZ7;
  const threshold = rZ4 + rSS;
  const endurance = rZ2 + rZ3;

  // Classify based on time in zones
  let type;
  if (highIntensity > 300) {
    type = sport === "Run" ? "Run_Intervals" : "VO2maxHighIntensity";
  } else if (threshold > 600) {
    type = sport === "Run" ? "Run_Tempo" : "FTPThreshold";
  } else if (endurance > totalTime * 0.5) {
    type = sport === "Run" ? "Run_Easy" : "EnduranceTempo";
  } else if (rZ1 > totalTime * 0.5) {
    type = sport === "Run" ? "Run_Recovery" : "RecoveryEasy";
  } else {
    type = sport === "Run" ? "Run_Easy" : "EnduranceTempo";
  }

  return { type: type, sport: sport };
}

/**
 * Fetch recent activities from Intervals.icu to track variety
 * @param {number} daysBack - How many days to look back (default 14)
 * @returns {object} { rides, runs, all } arrays of workout types
 */
function getRecentWorkoutTypes(daysBack = 14) {
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
      if (isSportActivity(a)) {
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

  // Note: We only count completed activities, not planned events.
  // Planned events would cause duplicates since completed workouts
  // appear in both activities (actual) and events (planned).

  return result;
}

/**
 * Get 2-week workout history with frequency and stimulus analysis for variety planning
 * @returns {object} { rideTypes, runTypes, mostFrequent, typeCounts, stimulusCounts, recentStimuli }
 */
function getTwoWeekWorkoutHistory() {
  const twoWeekTypes = getRecentWorkoutTypes(14);

  // Count frequency of each type
  const allTypes = [...twoWeekTypes.rides, ...twoWeekTypes.runs];
  const typeCounts = {};
  allTypes.forEach(function(t) {
    typeCounts[t] = (typeCounts[t] || 0) + 1;
  });

  // Count frequency of each training stimulus (for AI variety check)
  const stimulusCounts = { ride: {}, run: {} };
  const recentStimuli = { ride: [], run: [] };

  // Helper to find workout definition with flexible name matching
  function findWorkoutDef(catalog, typeName) {
    // Direct match first
    if (catalog[typeName]) return catalog[typeName];

    // Try with underscores (e.g., "FTPThreshold" → "FTP_Threshold")
    const withUnderscores = typeName.replace(/([a-z])([A-Z])/g, '$1_$2');
    if (catalog[withUnderscores]) return catalog[withUnderscores];

    // Try case-insensitive match
    const lowerName = typeName.toLowerCase();
    for (const key in catalog) {
      if (key.toLowerCase() === lowerName ||
          key.toLowerCase().replace(/_/g, '') === lowerName.replace(/_/g, '')) {
        return catalog[key];
      }
    }
    return null;
  }

  // Map workout types to their stimulus
  twoWeekTypes.rides.forEach(function(typeName) {
    const workoutDef = findWorkoutDef(WORKOUT_TYPES.ride, typeName);
    if (workoutDef && workoutDef.stimulus) {
      const stim = workoutDef.stimulus;
      stimulusCounts.ride[stim] = (stimulusCounts.ride[stim] || 0) + 1;
      if (recentStimuli.ride.indexOf(stim) === -1) {
        recentStimuli.ride.push(stim);
      }
    }
  });

  twoWeekTypes.runs.forEach(function(typeName) {
    const workoutDef = findWorkoutDef(WORKOUT_TYPES.run, typeName);
    if (workoutDef && workoutDef.stimulus) {
      const stim = workoutDef.stimulus;
      stimulusCounts.run[stim] = (stimulusCounts.run[stim] || 0) + 1;
      if (recentStimuli.run.indexOf(stim) === -1) {
        recentStimuli.run.push(stim);
      }
    }
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
    typeCounts: typeCounts,
    stimulusCounts: stimulusCounts,
    recentStimuli: recentStimuli
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

  // Build workout options for the AI (now includes training stimulus)
  const catalog = isRun ? WORKOUT_TYPES.run : WORKOUT_TYPES.ride;
  const workoutOptions = Object.keys(catalog).map(function(name) {
    const type = catalog[name];
    return name + " (intensity: " + type.intensity + "/5, zones: " + type.zones + ", stimulus: " + type.stimulus + ", phases: " + type.phases.join("/") + ")";
  }).join("\n");

  // Build recent workout context
  const recentList = isRun
    ? (context.recentWorkouts?.runs || [])
    : (context.recentWorkouts?.rides || []);
  const recentStr = recentList.length > 0 ? recentList.join(", ") : "None in last 7 days";

  // Build recent stimulus exposure for AI variety check
  const recentStimuli = context.recentStimuli || {};
  const stimulusCounts = context.stimulusCounts || {};
  const sportStimuli = isRun ? recentStimuli.run : recentStimuli.ride;
  const sportStimulusCounts = isRun ? stimulusCounts.run : stimulusCounts.ride;

  let stimulusStr = "None tracked";
  if (sportStimuli && sportStimuli.length > 0) {
    stimulusStr = sportStimuli.map(function(stim) {
      const count = sportStimulusCounts[stim] || 0;
      return stim + " (" + count + "x)";
    }).join(", ");
  }

  // Build zone progression context if available
  let zoneProgressionContext = '';
  if (context.zoneProgression && context.zoneProgression.available) {
    const prog = context.zoneProgression;
    zoneProgressionContext = `
**ZONE PROGRESSION LEVELS (1.0-10.0 scale):**
${Object.entries(prog.progression).map(([zone, data]) =>
  `- ${zone.charAt(0).toUpperCase() + zone.slice(1)}: ${data.level.toFixed(1)} (${data.trend}${data.lastTrained ? ', last: ' + data.lastTrained : ''})`
).join('\n')}
- Strengths: ${prog.strengths.join(', ')}
- Focus Areas (underdeveloped): ${prog.focusAreas.join(', ')}
${prog.plateauedZones && prog.plateauedZones.length > 0 ? `- ⚠️ PLATEAUED (need stimulus rotation): ${prog.plateauedZones.join(', ')}` : ''}
`;
  }

  const prompt = `You are an expert cycling/running coach making a training decision for today.

**ATHLETE CONTEXT:**
- Activity Type: ${context.activityType}
- Training Phase: ${context.phase} (${context.weeksOut} weeks to goal)
- Phase Focus: ${context.phaseFocus || 'Not specified'}
- Goal: ${context.goalDescription || 'General fitness'}
${context.phaseReasoning ? '- AI Phase Reasoning: ' + context.phaseReasoning : ''}
${zoneProgressionContext}

**FITNESS & FATIGUE:**
- CTL (Fitness): ${context.ctl ? context.ctl.toFixed(0) : 'N/A'}
- TSB (Form): ${context.tsb ? context.tsb.toFixed(1) : 'N/A'} ${context.tsb < -20 ? '(VERY FATIGUED)' : context.tsb < -10 ? '(fatigued)' : context.tsb > 10 ? '(fresh)' : '(balanced)'}
- Recovery Status: ${context.recoveryStatus || 'Unknown'}${context.recoveryScore ? ' (' + context.recoveryScore + '%)' : ''}

**EVENT CONTEXT:**
- Event Tomorrow: ${context.eventTomorrow?.hasEvent ? (context.eventTomorrow.eventName ? context.eventTomorrow.category + ' - ' + context.eventTomorrow.eventName + (context.eventTomorrow.eventDescription ? ' (' + context.eventTomorrow.eventDescription + ')' : '') : context.eventTomorrow.category + ' priority event') : 'No'}
- Event Yesterday: ${context.eventYesterday?.hadEvent ? (context.eventYesterday.eventName ? context.eventYesterday.category + ' - ' + context.eventYesterday.eventName + (context.eventYesterday.eventDescription ? ' (' + context.eventYesterday.eventDescription + ')' : '') : context.eventYesterday.category + ' priority event') : 'No'}

**RECENT TRAINING (for variety):**
- Recent ${context.activityType}s: ${recentStr}
- Last Workout Intensity: ${context.lastIntensity || 0}/5 (${context.daysSinceLastWorkout || 0} days ago)
- Recent Stimulus Exposure (2 weeks): ${stimulusStr}

**DURATION WINDOW:** ${context.duration?.min || 45}-${context.duration?.max || 60} minutes
${context.suggestedType ? `
**WEEKLY PLAN SUGGESTION:**
The weekly plan suggests "${context.suggestedType}" for today.
Consider this as a starting point, but adjust based on current conditions (especially recovery, TSB, and yesterday's intensity).
If conditions have changed significantly, choose a more appropriate workout type.
` : ''}${context.weekProgress ? `
**THIS WEEK'S PROGRESS (Monday-Sunday week):**
- ${context.weekProgress.summary}
- Adherence: ${context.weekProgress.adherenceRate}%${context.weekProgress.missedWorkouts?.length > 0 ? `
- MISSED WORKOUTS (need adaptation):
${context.weekProgress.missedWorkouts.map(m => `  * ${m.day}: ${m.workoutType} (${m.intensity}, TSS ~${m.tss})`).join('\n')}
- ADAPTATION ADVICE: ${context.weekProgress.adaptationAdvice}` : ''}${context.weekProgress.extraSessions > 0 ? `
- Extra sessions completed (${context.weekProgress.extraSessions}): May need easier remaining days to balance weekly load.` : ''}
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
10. Prioritize STIMULUS variety - avoid repeating the same training effect (stimulus field), not just workout names.
    E.g., SweetSpot and Tempo_Sustained both have "subthreshold" stimulus = same physiological stress = avoid back-to-back.
    If a stimulus was done 3+ times in 2 weeks, prioritize a different one.
11. Match workout to training phase
12. ZONE PROGRESSION: If zone progression data is available, consider prioritizing underdeveloped zones (focus areas).
    A zone with declining trend that hasn't been trained in 2+ weeks should be prioritized.
    Balance zone development with recovery status - don't push hard zones when fatigued.
13. PLATEAU DETECTION: If a zone shows "plateaued" trend, it needs STIMULUS ROTATION:
    - Change the workout structure (different interval lengths, recovery times, or rep schemes)
    - Example: if threshold is plateaued after 2x20min efforts, try 4x10min or 3x15min instead
    - Or try a different approach: over-unders, progressive intervals, or race-pace simulation

**YOUR TASK:**
Recommend THREE specific workout types from the list above, ranked by suitability (best first).
Each option should have a confidence score (1-10) and brief explanation.
Consider all factors holistically.

**IMPORTANT: Write all text fields (reasoning, whyThisWorkout) in ${getPromptLanguage()}.**

**Output JSON only (no markdown):**
{
  "shouldTrain": true,
  "options": [
    {
      "workoutType": "exact_workout_name_from_list",
      "intensity": 1-5,
      "score": 1-10,
      "whyThisWorkout": "1-2 sentence explanation why this is a good choice today in ${getPromptLanguage()}"
    },
    {
      "workoutType": "second_best_option",
      "intensity": 1-5,
      "score": 1-10,
      "whyThisWorkout": "1-2 sentence explanation in ${getPromptLanguage()}"
    },
    {
      "workoutType": "third_option",
      "intensity": 1-5,
      "score": 1-10,
      "whyThisWorkout": "1-2 sentence explanation in ${getPromptLanguage()}"
    }
  ],
  "reasoning": "Overall 1-2 sentence summary of today's training decision in ${getPromptLanguage()}"
}`;

  const response = callGeminiAPIText(prompt);

  const decision = parseGeminiJsonResponse(response);
  if (!decision) {
    Logger.log("AI workout decision: Failed to parse response");
    return null;
  }

  // Handle new multi-option format
  if (decision.options && Array.isArray(decision.options)) {
    // Validate all workout types exist
    const validOptions = decision.options.filter(function(opt) {
      return opt.workoutType && catalog[opt.workoutType];
    });

    if (validOptions.length === 0) {
      Logger.log("AI suggested no valid workout types");
      return null;
    }

    // Sort by score (highest first)
    validOptions.sort(function(a, b) { return (b.score || 0) - (a.score || 0); });

    return {
      shouldTrain: decision.shouldTrain !== false,
      options: validOptions,
      reasoning: decision.reasoning || ""
    };
  }

  // Fallback: Handle old single-workout format for backwards compatibility
  if (decision.workoutType && catalog[decision.workoutType]) {
    return {
      shouldTrain: decision.shouldTrain !== false,
      options: [{
        workoutType: decision.workoutType,
        intensity: decision.intensity || 3,
        score: 7,
        whyThisWorkout: decision.reasoning || ""
      }],
      reasoning: decision.reasoning || ""
    };
  }

  Logger.log("AI suggested unknown workout type format");
  return null;
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
        isWeeklyPlan: params.isWeeklyPlan,
        // Stimulus variety tracking (AI-first variety check)
        recentStimuli: params.recentStimuli || {},
        stimulusCounts: params.stimulusCounts || {},
        // Zone progression levels
        zoneProgression: params.zoneProgression || null,
        // Week progress - planned vs completed this week
        weekProgress: params.weekProgress || null
      };

      const aiDecision = generateAIWorkoutDecision(aiContext);

      if (aiDecision && aiDecision.options && aiDecision.options.length > 0) {
        // Log all options
        Logger.log("=== AI WORKOUT OPTIONS (ranked by score) ===");
        aiDecision.options.forEach(function(opt, idx) {
          Logger.log("  " + (idx + 1) + ". " + opt.workoutType + " - Score: " + opt.score + "/10 (intensity " + opt.intensity + "/5)");
          Logger.log("     " + opt.whyThisWorkout);
        });
        Logger.log("  Overall: " + aiDecision.reasoning);

        const bestOption = aiDecision.options[0];

        return {
          types: aiDecision.options.map(function(opt) { return opt.workoutType; }),
          options: aiDecision.options,  // Full options array with scores
          reason: aiDecision.reasoning,
          maxIntensity: bestOption.intensity,
          isRestDay: !aiDecision.shouldTrain,
          aiEnhanced: true
        };
      }
    } catch (e) {
      Logger.log("Workout decision failed, using fallback: " + e.toString());
    }
  }

  // ===== SIMPLIFIED FALLBACK =====
  // AI-first approach: this only runs if AI fails or is disabled
  const fallbackReason = params.enableAI === false ? "AI disabled" : "AI failed";
  Logger.log("Using fallback workout selection (" + fallbackReason + ")");

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


