/**
 * IntervalCoach - Weekly Planning
 *
 * Weekly training plan generation and calendar event creation.
 * Related modules: workouts.gs, workouts_upload.gs, prompts_planning.gs
 */

// =========================================================
// UPCOMING PLACEHOLDERS
// =========================================================

/**
 * Fetch upcoming workout placeholders for the next N days
 * Uses cached fetchEventsForDate() to avoid duplicate API calls
 * @param {number} days - Number of days to look ahead (default 7)
 * @returns {Array} Array of upcoming placeholder info
 */
function fetchUpcomingPlaceholders(days) {
  days = days || 7;
  const upcoming = [];

  for (let i = 0; i < days; i++) {
    const date = new Date();
    date.setDate(date.getDate() + i);
    const dateStr = formatDateISO(date);
    const dayName = Utilities.formatDate(date, SYSTEM_SETTINGS.TIMEZONE, "EEEE");

    // Use cached event fetching
    const eventData = fetchEventsForDate(dateStr);

    // Get race event info
    const raceEvent = eventData.raceEvent;
    const eventCategory = raceEvent ? raceEvent.category : null;
    const eventName = raceEvent ? raceEvent.name : null;
    const eventDescription = raceEvent ? raceEvent.description : null;

    // Get placeholder info - check simple placeholders first, then WORKOUT events
    const placeholder = eventData.placeholders.length > 0 ? eventData.placeholders[0] : null;
    const workoutEvent = eventData.workoutEvents.length > 0 ? eventData.workoutEvents[0] : null;

    let activityType = null;
    let duration = null;
    let placeholderName = null;

    if (placeholder) {
      // Simple placeholder (Ride/Run) - these are detected by name prefix
      activityType = placeholder.type;
      duration = parseDurationFromName(placeholder.name, activityType);
      placeholderName = placeholder.name;
    } else if (workoutEvent) {
      // WORKOUT event (weekly plan event like "VO2max_Intervals - 60min", "SweetSpot_Z4 - 60min")
      const workoutName = workoutEvent.name || '';
      // Determine activity type from event type or name
      activityType = workoutEvent.type ||
                     (workoutName.toLowerCase().includes('run') ? 'Run' : 'Ride');
      duration = parseDurationFromName(workoutName, activityType);
      placeholderName = workoutName;
    }

    upcoming.push({
      date: dateStr,
      dayName: dayName,
      activityType: activityType,
      duration: duration,
      hasEvent: eventCategory !== null,
      eventCategory: eventCategory,
      eventName: eventName,
      eventDescription: eventDescription,
      placeholderName: placeholderName
    });
  }

  return upcoming;
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
      desc += day.eventCategory + " Event" + (day.eventName ? " - " + day.eventName : "");
      if (day.eventDescription) {
        desc += " (" + day.eventDescription + ")";
      }
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

// =========================================================
// AI WEEKLY PLAN GENERATION
// =========================================================

/**
 * Generate comprehensive AI weekly training plan
 * @param {object} context - Full context for planning
 * @returns {object} Structured weekly plan with day-by-day recommendations
 */
function generateAIWeeklyPlan(context) {
  // ===== CLOSED-LOOP ADAPTATION =====
  // Analyze last week's plan execution and get AI insights
  let adaptationContext = '';
  try {
    const executionAnalysis = analyzeWeeklyPlanExecution(1);
    if (executionAnalysis && executionAnalysis.summary.plannedSessions > 0) {
      Logger.log("Plan Execution Analysis: " + JSON.stringify(executionAnalysis.summary));

      const adaptationInsights = generateAIPlanAdaptationInsights(executionAnalysis);
      if (adaptationInsights) {
        Logger.log("AI Adaptation Insights: " + JSON.stringify(adaptationInsights));
        adaptationContext = `
**CLOSED-LOOP ADAPTATION (Learn from last week):**
- Adherence Score: ${executionAnalysis.summary.adherenceScore}%
- Completed: ${executionAnalysis.summary.completedSessions}/${executionAnalysis.summary.plannedSessions} sessions
- TSS Variance: ${executionAnalysis.summary.tssVariance >= 0 ? '+' : ''}${executionAnalysis.summary.tssVariance}
- Patterns Observed: ${adaptationInsights.patterns?.join('; ') || 'None'}
- Recommended Adaptations: ${adaptationInsights.adaptations?.join('; ') || 'None'}
- Key Insight: ${adaptationInsights.planningRecommendation || 'Continue as planned'}

**APPLY THESE LEARNINGS TO THIS WEEK'S PLAN.**
`;
      }
    }
  } catch (e) {
    Logger.log("Closed-loop adaptation failed (non-critical): " + e.toString());
  }

  // ===== EVENT-SPECIFIC TRAINING =====
  // Analyze primary goal event and get tailored training recommendations
  let eventTrainingContext = '';
  try {
    if (context.goals?.available && context.goals?.primaryGoal) {
      const goal = context.goals.primaryGoal;
      const weeksOut = context.weeksOut || 12;

      // Build power profile from context
      const powerProfile = {
        eFTP: context.eftp,
        wPrime: context.wPrime,
        strengths: context.powerStrengths || [],
        focusAreas: context.powerWeaknesses || []
      };

      // Build fitness metrics
      const fitnessMetrics = {
        ctl: context.ctl,
        atl: context.atl,
        tsb: context.tsb
      };

      const eventAnalysis = generateAIEventAnalysis(goal, powerProfile, fitnessMetrics, weeksOut);
      if (eventAnalysis) {
        Logger.log("AI Event Analysis: " + JSON.stringify(eventAnalysis.eventProfile));
        eventTrainingContext = `
**EVENT-SPECIFIC TRAINING (Tailored for ${goal.name}):**
- Event Type: ${eventAnalysis.eventProfile?.category || 'Unknown'}
- Key Challenge: ${eventAnalysis.eventProfile?.keyChallenge || 'N/A'}
- Primary Demands: ${eventAnalysis.eventProfile?.primaryDemands?.join(', ') || 'N/A'}
- Priority Workouts: ${eventAnalysis.trainingEmphasis?.priorityWorkouts?.join(', ') || 'N/A'}
- Intensity Focus: ${eventAnalysis.trainingEmphasis?.intensityFocus || 'mixed'}
- Current Phase Advice: ${eventAnalysis.currentPhaseAdvice?.phase || 'Build'} - ${eventAnalysis.currentPhaseAdvice?.buildVsTaper || 'building'}
- Key Workout This Week: ${eventAnalysis.currentPhaseAdvice?.keyWorkout || 'N/A'}
- Athlete Notes: ${eventAnalysis.athleteSpecificNotes || 'N/A'}

**APPLY THIS EVENT-SPECIFIC EMPHASIS TO WORKOUT SELECTION.**
`;
      }
    }
  } catch (e) {
    Logger.log("Event-specific training analysis failed (non-critical): " + e.toString());
  }

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

  // Build zone progression context
  let zoneProgressionContext = '';
  if (context.zoneProgression && context.zoneProgression.available) {
    const prog = context.zoneProgression;
    zoneProgressionContext = `
**ZONE PROGRESSION LEVELS (prioritize underdeveloped zones):**
${Object.entries(prog.progression).map(([zone, data]) =>
  `- ${zone.charAt(0).toUpperCase() + zone.slice(1)}: Level ${data.level.toFixed(1)} (${data.trend})`
).join('\n')}
- Strengths: ${prog.strengths.join(', ')}
- Focus Areas: ${prog.focusAreas.join(', ')} (these zones need attention)
${prog.plateauedZones && prog.plateauedZones.length > 0 ? `- ⚠️ PLATEAUED ZONES: ${prog.plateauedZones.join(', ')} (need different stimulus - vary interval structure)` : ''}
`;
  }

  // Build cross-sport equivalency context
  let crossSportContext = '';
  if (context.crossSportEquivalency && context.crossSportEquivalency.available) {
    const cs = context.crossSportEquivalency;
    crossSportContext = `
**CROSS-SPORT ZONE EQUIVALENCIES:**
- Cycling FTP: ${cs.cycling.ftp}W -> Running Critical Speed: ${cs.running.criticalSpeed}/km
- Use this for equivalent intensities when mixing sports
- Threshold cycling = Threshold running (same physiological stress)
- VO2max efforts transfer well between sports
`;
    if (context.crossSportRecommendations && context.crossSportRecommendations.available) {
      const csr = context.crossSportRecommendations;
      crossSportContext += `- AI Recommended Mix: ${csr.weeklyMixRecommendation?.cyclingDays || 3} cycling, ${csr.weeklyMixRecommendation?.runningDays || 2} running days
- Key Insight: ${csr.keyInsight || 'Balance cycling and running based on goals'}
`;
    }
  }

  // Build upcoming events context
  let eventsContext = '';
  if (context.upcomingEvents && context.upcomingEvents.length > 0) {
    eventsContext = '\n**UPCOMING EVENTS:**\n' + context.upcomingEvents.map(e => {
      let eventStr = `- ${e.date} (${e.dayName}): ${e.eventCategory} priority`;
      if (e.name) eventStr += ' - ' + e.name;
      if (e.description) eventStr += ' (' + e.description + ')';
      // Make it clear that C events ARE the workout for that day
      if (e.eventCategory === 'C') {
        eventStr += ' [THIS IS THE WORKOUT FOR THIS DAY - do not add another]';
      }
      return eventStr;
    }).join('\n');
  }

  // Build scheduled days context (simple placeholders)
  // IMPORTANT: Filter out days that already have C events - those days use the group ride as the workout
  let scheduledContext = '';
  if (context.scheduledDays && context.scheduledDays.length > 0) {
    const cEventDates = new Set(
      (context.upcomingEvents || [])
        .filter(e => e.eventCategory === 'C')
        .map(e => e.date)
    );
    const daysNeedingWorkouts = context.scheduledDays.filter(d => !cEventDates.has(d.date));

    if (daysNeedingWorkouts.length > 0) {
      scheduledContext = '\n**PLACEHOLDER DAYS (need workout type):**\n' + daysNeedingWorkouts.map(d =>
        `- ${d.dayName} (${d.date}): ${d.activityType} ${d.duration ? d.duration.min + '-' + d.duration.max + 'min' : ''}`
      ).join('\n');
    }
  }

  // Build existing workouts context (user already scheduled specific workouts)
  let existingWorkoutsContext = '';
  if (context.existingWorkouts && context.existingWorkouts.length > 0) {
    existingWorkoutsContext = '\n**EXISTING WORKOUTS (DO NOT CHANGE - include as-is in your plan):**\n' + context.existingWorkouts.map(w =>
      `- ${w.dayName} (${w.date}): ${w.name}${w.duration ? ' (' + w.duration + ' min)' : ''}`
    ).join('\n');
  }

  // Build recovery status context (dynamic based on body signals)
  let periodizationContext = '';
  if (context.periodizationBlock) {
    const pb = context.periodizationBlock;
    const weekType = pb.isRecoveryWeek ? 'RECOVERY' : 'BUILD';

    periodizationContext = `
**RECOVERY TIMING (dynamic based on body signals):**
- Current Mode: ${weekType}
- Weeks Without Recovery: ${pb.weeksWithoutDeload}
- Recovery Urgency: ${pb.urgency || 'low'}
${pb.isRecoveryWeek ? '- BODY NEEDS RECOVERY: Reduce volume to 60%, max 1 intensity session' : ''}
${pb.weeksWithoutDeload >= 3 && !pb.isRecoveryWeek ? '- FATIGUE ACCUMULATING: Monitor closely, consider recovery if wellness drops' : ''}
`;
  }

  // Build holiday context
  let holidayContext = '';
  if (context.upcomingHoliday) {
    const h = context.upcomingHoliday;
    const weeksUntil = Math.floor(h.daysUntil / 7);

    holidayContext = `
**UPCOMING HOLIDAY (IMPORTANT - use strategically):**
- Holiday: ${h.name}
- Dates: ${h.startDate} to ${h.endDate} (${h.durationDays} days)
- Days Until: ${h.daysUntil} days (${weeksUntil} weeks)
${h.hasConflictingRace ? '- NOTE: Race during holiday takes priority over rest' : ''}

**HOLIDAY PLANNING RULES:**
${h.daysUntil <= 7 ? '- THIS WEEK BEFORE HOLIDAY: Push hard! Extra intensity sessions OK. Maximize training stress before the break.' : ''}
${h.daysUntil > 7 && h.daysUntil <= 14 ? '- 1-2 WEEKS TO HOLIDAY: Increase training load. Body will recover during holiday.' : ''}
${h.daysUntil > 14 && h.daysUntil <= 28 ? '- HOLIDAY COMING: Plan regular training but consider skipping tentative recovery weeks - holiday will provide rest.' : ''}
- Holiday = guaranteed recovery week. Use it wisely by training harder beforehand.
`;
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

  // Build taper context if within race window
  let taperContext = '';
  if (context.taperRecommendation?.available) {
    const taper = context.taperRecommendation;
    const rec = taper.analysis?.recommended;
    const ai = taper.aiRecommendation;

    taperContext = `
**TAPER TIMING (CRITICAL - follow this guidance):**
- Race: ${taper.analysis.raceDate} (${taper.analysis.daysToRace} days away)
- Recommended: ${rec.taperType} (${rec.taperDescription})
- Taper Start: ${rec.taperStartDate}${rec.daysUntilTaperStart <= 0 ? ' (STARTED)' : rec.daysUntilTaperStart <= 7 ? ' (STARTING THIS WEEK)' : ''}
- Days Until Taper: ${rec.daysUntilTaperStart}
- Target Race Day TSB: ${taper.analysis.targetTSB}
- Projected Race Day CTL: ${rec.raceDayCTL}
${ai?.weekByWeekPlan ? '- Plan: ' + ai.weekByWeekPlan.join(' | ') : ''}

**TAPER RULES TO APPLY:**
${rec.daysUntilTaperStart <= 0 ? '- IN TAPER: Reduce volume to ' + Math.round(rec.taperIntensity * 100) + '%. Keep sessions short and sharp. No long endurance rides.' : ''}
${rec.daysUntilTaperStart > 0 && rec.daysUntilTaperStart <= 7 ? '- TAPER STARTS THIS WEEK: Begin reducing volume from ' + rec.taperStartDate + '. Last hard workout 3-4 days before race.' : ''}
${taper.analysis.daysToRace <= 7 ? '- RACE WEEK: Focus on freshness. Easy spinning with opener 1-2 days before.' : ''}
`;
  }

  // Get user's language for localized output
  const lang = USER_SETTINGS.LANGUAGE || 'en';
  const langMap = { en: 'English', nl: 'Dutch', ja: 'Japanese', es: 'Spanish', fr: 'French' };
  const langName = langMap[lang] || 'English';

  const prompt = `You are an expert cycling and running coach creating a WEEKLY TRAINING PLAN.

**IMPORTANT: Write ALL text output (weeklyStrategy, focus, keyWorkouts, recoveryNotes) in ${langName}.**

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
${goalsContext}${taperContext}${periodizationContext}${holidayContext}
**RECOVERY STATUS:**
- Current: ${context.recoveryStatus || 'Unknown'}
- 7-day Avg Recovery: ${context.avgRecovery ? context.avgRecovery.toFixed(0) + '%' : 'N/A'}
- 7-day Avg Sleep: ${context.avgSleep ? context.avgSleep.toFixed(1) + 'h' : 'N/A'}
${adaptationContext}${eventTrainingContext}${lastWeekContext}${historyContext}${zoneProgressionContext}${crossSportContext}${eventsContext}${scheduledContext}${existingWorkoutsContext}

**WEEKLY TARGETS:**
- Last Week Activities: ${context.lastWeek?.activities || 0} → Max This Week: ${Math.min((context.lastWeek?.activities || 3) + 1, 6)} workouts (including any C events)
- C Events This Week: ${context.upcomingEvents?.filter(e => e.eventCategory === 'C').length || 0} (count these toward weekly total)
- Recommended TSS: ${context.tssTarget?.min || 300}-${context.tssTarget?.max || 500}
- Daily TSS Range: ${context.dailyTss?.min || 50}-${context.dailyTss?.max || 100}

**AVAILABLE WORKOUT TYPES:**
Cycling: Recovery_Easy (1), Endurance_Z2 (2), Endurance_Tempo (3), SweetSpot (3), Tempo_Sustained (3), FTP_Threshold (4), Over_Unders (4), VO2max_Intervals (5), Anaerobic_Sprints (5)
Running: Run_Recovery (1), Run_Easy (2), Run_Long (3), Run_Tempo (3), Run_Fartlek (3), Run_Threshold (4), Run_Intervals (5), Run_Strides (2)
(Numbers = intensity 1-5)

**PLANNING RULES:**
1. ADAPTIVE FREQUENCY: Base workout count on last week's activity count. Max increase of +1 workout from last week. If last week had 3 activities, plan max 4 this week.
2. C EVENTS COUNT: Any C events (group rides) already on the calendar count toward the weekly workout total. If max is 4 and there's 1 C event, only add 3 new workouts. Do NOT add a workout on a day that already has a C event - the group ride IS the workout for that day.
3. Never schedule back-to-back intensity 4-5 days
4. After intensity 5, next day should be 1-2
5. Include at least 1 full rest day if TSB < -10
6. Pre-race day (A/B event): intensity 1-2 only
7. Post-race day (A/B event): rest or intensity 1
8. Build week = 3-4 quality sessions; Recovery week = 1-2 quality sessions
9. Respect already scheduled days, enhance with type recommendations
10. If fatigued (TSB < -15), reduce volume and intensity
11. VARIETY: Avoid repeating same workout type from last 2 weeks unless strategically needed
12. EXISTING WORKOUTS: Include any existing workouts AS-IS in your plan (use exact name, count toward weekly totals)
13. ZONE PROGRESSION: If zone levels are provided, include at least one workout targeting underdeveloped zones (focus areas)
14. TAPER: If in taper period, reduce volume significantly. Keep intensity short and sharp. Last hard workout 3-4 days before race.
15. RACE WEEK: If race is this week, prioritize freshness over fitness. Easy spinning only, with opener workout 1-2 days before.
16. SPORT BALANCE: Aim for roughly 2:1 ratio of cycling to running (e.g., 3 rides + 1-2 runs, or 2 rides + 1 run)
17. RECOVERY TIMING: Take recovery when body signals indicate (high fatigue, poor wellness, 3+ weeks without deload). Don't force fixed patterns - adapt to actual recovery status.
18. HOLIDAY PLANNING: If a holiday is coming within 2 weeks, train harder this week (extra intensity OK). Holiday = guaranteed recovery, so maximize training stress beforehand. Skip tentative recovery weeks if holiday provides rest soon.

**YOUR TASK:**
Create a 7-day plan starting from ${context.startDate || 'tomorrow'}. For each day provide:
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
  const plan = parseGeminiJsonResponse(response);
  if (!plan) {
    Logger.log("AI weekly plan: Failed to parse response");
  }
  return plan;
}

// =========================================================
// WEEKLY PLAN CALENDAR CREATION
// =========================================================

/**
 * Create workout events in Intervals.icu calendar from weekly plan
 * For runs: pre-generates actual workout content with intervals and paces
 * For rides: creates placeholders that will be refined on the day
 * @param {object} weeklyPlan - Weekly plan from generateAIWeeklyPlan
 * @param {object} context - Optional context for pre-generation { runningData, phaseInfo, summary }
 * @returns {object} { created: number, skipped: number, errors: number, preGenerated: number }
 */
function createWeeklyPlanEvents(weeklyPlan, context) {
  if (!weeklyPlan || !weeklyPlan.days) {
    Logger.log("No weekly plan to create events from");
    return { created: 0, skipped: 0, errors: 0, preGenerated: 0 };
  }

  const athleteId = "0";
  const results = { created: 0, skipped: 0, errors: 0, preGenerated: 0 };

  // Fetch running data once if not provided (for pre-generating runs)
  let runningData = context?.runningData;
  if (!runningData) {
    try {
      runningData = fetchRunningData();
    } catch (e) {
      Logger.log("Could not fetch running data for pre-generation: " + e.toString());
      runningData = { available: false };
    }
  }

  Logger.log("Creating calendar events from weekly plan...");

  const todayStr = formatDateISO(new Date());

  for (const day of weeklyPlan.days) {
    // Skip today - weekly plan is for future days
    if (day.date === todayStr) {
      Logger.log(` -> ${day.date} (${day.dayName}): Today - skipping`);
      results.skipped++;
      continue;
    }

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
      // Check for ANY existing workout on this day
      const existingWorkout = existingCheck.data.find(e => e.category === 'WORKOUT');

      if (existingWorkout) {
        const workoutName = existingWorkout.name || '';
        const isWeeklyPlanPlaceholder = existingWorkout.description?.includes('[Weekly Plan]');
        const isSimplePlaceholder = /^(Ride|Run)( - \d+min)?$/i.test(workoutName);

        if (isWeeklyPlanPlaceholder) {
          // Previous Weekly Plan - update it
          existingEventId = existingWorkout.id;
          Logger.log(` -> ${day.date} (${day.dayName}): Updating previous weekly plan`);
        } else if (isSimplePlaceholder) {
          // Simple "Ride" or "Run - 60min" placeholder - update it
          existingEventId = existingWorkout.id;
          Logger.log(` -> ${day.date} (${day.dayName}): Updating simple placeholder`);
        } else {
          // User has a specific workout (like "Run_Easy - 40min") - skip
          Logger.log(` -> ${day.date} (${day.dayName}): User workout exists (${workoutName}) - skipping`);
          results.skipped++;
          continue;
        }
      }
    }

    // Create event with workout type in name
    const isRun = day.activity === 'Run';
    const workoutLabel = day.workoutType || (isRun ? 'Run' : 'Ride');
    const eventName = `${workoutLabel} - ${day.duration}min`;

    // For runs: pre-generate actual workout content
    let description = `[Weekly Plan]\n\n${day.focus}\n\nTSS Target: ~${day.estimatedTSS}\nDuration: ${day.duration} min`;

    if (isRun && runningData?.available) {
      try {
        const preGenerated = preGenerateRunWorkout(day, runningData, context);
        if (preGenerated) {
          description = `[Weekly Plan - Pre-Generated]\n\n${preGenerated}`;
          results.preGenerated++;
          Logger.log(` -> ${day.date}: Pre-generated run workout`);
        } else {
          description += `\n\nThis workout will be refined with detailed intervals when generated.`;
        }
      } catch (e) {
        Logger.log(` -> ${day.date}: Pre-generation failed: ${e.toString()}`);
        description += `\n\nThis workout will be refined with detailed intervals when generated.`;
      }
    } else if (!isRun) {
      description += `\n\nThis workout will be refined with detailed intervals when generated.`;
    }

    const payload = {
      category: "WORKOUT",
      type: day.activity,
      name: eventName,
      description: description,
      start_date_local: day.date + "T10:00:00",
      moving_time: day.duration * 60
    };

    // Use PUT to update if placeholder exists, POST to create new
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

  Logger.log(`Weekly plan events: ${results.created} created, ${results.skipped} skipped, ${results.errors} errors, ${results.preGenerated} runs pre-generated`);
  return results;
}

/**
 * Pre-generate run workout content for weekly planning
 * Creates structured workout description with intervals and target paces
 * @param {object} day - Day info from weekly plan { workoutType, duration, focus, estimatedTSS }
 * @param {object} runningData - Running profile { criticalSpeed, dPrime, thresholdPace, bestEfforts }
 * @param {object} context - Optional additional context { phaseInfo, summary }
 * @returns {string|null} Generated workout description or null if failed
 */
function preGenerateRunWorkout(day, runningData, context) {
  const langName = getPromptLanguage();

  // Get primary pace for zone calculations
  const primaryPace = runningData.criticalSpeed || runningData.thresholdPace || '5:30';
  const dPrime = runningData.dPrime || 200;

  // D' guidance for interval structure
  let dPrimeGuidance = 'Standard recovery (90s-2min jog between efforts)';
  if (dPrime < 150) {
    dPrimeGuidance = 'LOW D\' - Use longer recovery (2-3min), fewer repeats (4-5 max)';
  } else if (dPrime > 250) {
    dPrimeGuidance = 'HIGH D\' - Can use shorter recovery (60-90s), more repeats (6-8)';
  }

  // Build best efforts context if available
  let bestEffortsStr = '';
  if (runningData.bestEfforts && Object.keys(runningData.bestEfforts).length > 0) {
    const parts = [];
    if (runningData.bestEfforts[800]) parts.push(`800m: ${runningData.bestEfforts[800].pace}/km`);
    if (runningData.bestEfforts[1500]) parts.push(`1.5k: ${runningData.bestEfforts[1500].pace}/km`);
    if (runningData.bestEfforts[5000]) parts.push(`5k: ${runningData.bestEfforts[5000].pace}/km`);
    if (parts.length > 0) bestEffortsStr = `\nBest efforts: ${parts.join(' | ')}`;
  }

  const prompt = `You are an expert running coach creating a structured workout.

**WORKOUT REQUEST:**
- Type: ${day.workoutType}
- Duration: ${day.duration} min
- Focus: ${day.focus}
- Target TSS: ~${day.estimatedTSS}

**ATHLETE RUNNING PROFILE:**
- Critical Speed (threshold): ${primaryPace}/km
- D' (anaerobic capacity): ${dPrime}m - ${dPrimeGuidance}${bestEffortsStr}

**RUNNING ZONES (based on CS ${primaryPace}/km):**
- Z1 Recovery: ~${addPace(primaryPace, 75)}/km (easy jog)
- Z2 Endurance: ~${addPace(primaryPace, 45)}/km (conversational)
- Z3 Tempo: ~${addPace(primaryPace, 15)}/km (comfortably hard)
- Z4 Threshold: ~${primaryPace}/km (race pace 10K-HM)
- Z5 VO2max: ~${subtractPace(primaryPace, 15)}/km (hard, 3-6min sustainable)
- Z6 Anaerobic: ~${subtractPace(primaryPace, 30)}/km (very hard, <2min)

**INSTRUCTIONS:**
1. Create a complete, ready-to-execute workout
2. Include warm-up (10-15 min easy) and cool-down (5-10 min easy)
3. Specify exact paces (min:sec/km) for each segment
4. For intervals: specify reps, duration/distance, target pace, and recovery
5. Match the total duration to ${day.duration} min
6. Write in ${langName}
7. Format clearly with sections

**Output the workout description only (no JSON, no markdown code blocks):**`;

  try {
    const response = callGeminiAPIText(prompt);
    if (response && response.length > 50) {
      return response;
    }
    return null;
  } catch (e) {
    Logger.log("preGenerateRunWorkout error: " + e.toString());
    return null;
  }
}

// =========================================================
// CLOSED-LOOP WEEKLY ADAPTATION
// =========================================================

/**
 * Analyze last week's planned vs actual execution
 * Compares what was planned in the weekly plan vs what was actually done
 * @param {number} weeksBack - How many weeks back to analyze (default 1)
 * @returns {object} { planned, actual, comparison, adherenceScore }
 */
function analyzeWeeklyPlanExecution(weeksBack) {
  weeksBack = weeksBack || 1;
  const today = new Date();
  const weekEnd = new Date(today);
  weekEnd.setDate(today.getDate() - (weeksBack - 1) * 7 - 1); // Yesterday for last week
  const weekStart = new Date(weekEnd);
  weekStart.setDate(weekEnd.getDate() - 6);

  const startStr = formatDateISO(weekStart);
  const endStr = formatDateISO(weekEnd);

  Logger.log(`Analyzing plan execution: ${startStr} to ${endStr}`);

  const result = {
    period: { start: startStr, end: endStr },
    planned: [],
    actual: [],
    comparison: [],
    summary: {
      plannedSessions: 0,
      completedSessions: 0,
      skippedSessions: 0,
      extraSessions: 0,
      plannedTSS: 0,
      actualTSS: 0,
      tssVariance: 0,
      adherenceScore: 0
    }
  };

  // Fetch planned workouts (WORKOUT category events or Weekly Plan placeholders)
  const eventsResult = fetchIcuApi(`/athlete/0/events?oldest=${startStr}&newest=${endStr}`);
  Logger.log(`Found ${eventsResult.data?.length || 0} events in period`);
  if (eventsResult.success && Array.isArray(eventsResult.data)) {
    eventsResult.data.forEach(function(e) {
      Logger.log(`  Event: "${e.name}" | category: ${e.category} | description: ${e.description?.substring(0, 50) || 'none'}`);

      // Detect planned workouts: WORKOUT category or [Weekly Plan] placeholders
      const isWorkoutEvent = e.category === 'WORKOUT';
      const isWeeklyPlan = e.description?.includes('[Weekly Plan]');

      if (isWorkoutEvent || isWeeklyPlan) {
        // Parse workout details
        const tssMatch = e.description?.match(/TSS Target: ~(\d+)/) || e.description?.match(/TSS[:\s]+(\d+)/i);
        const durationMatch = e.description?.match(/Duration: (\d+) min/) || e.description?.match(/(\d+)\s*min/i);

        // Extract workout type from name
        let workoutType = 'Unknown';
        if (isIntervalCoachWorkout(e.name)) {
          // New format: "IntervalCoach Sweet Spot" or old format: "IntervalCoach_SweetSpot_20251224"
          workoutType = e.name.replace(/^IntervalCoach[_ ]?/, '').replace(/_\d{8}$/, '').replace(/_/g, ' ').trim() || 'Unknown';
        } else if (isWeeklyPlan) {
          const typeMatch = e.name?.match(/^([A-Za-z_]+)/);
          workoutType = typeMatch ? typeMatch[1] : 'Unknown';
        } else {
          // Use event name as type
          workoutType = e.name || 'Unknown';
        }

        result.planned.push({
          date: e.start_date?.substring(0, 10) || e.start_date_local?.substring(0, 10),
          name: e.name,
          workoutType: workoutType,
          plannedTSS: tssMatch ? parseInt(tssMatch[1]) : (e.icu_training_load || 0),
          plannedDuration: durationMatch ? parseInt(durationMatch[1]) : 0,
          activity: e.type || (e.name?.toLowerCase().includes('run') ? 'Run' : 'Ride'),
          source: isWeeklyPlan ? 'weekly_plan' : 'calendar'
        });
        result.summary.plannedSessions++;
        result.summary.plannedTSS += tssMatch ? parseInt(tssMatch[1]) : (e.icu_training_load || 0);
      }
    });
  }

  // Fetch actual activities
  const activitiesResult = fetchIcuApi(`/athlete/0/activities?oldest=${startStr}&newest=${endStr}`);
  if (activitiesResult.success && Array.isArray(activitiesResult.data)) {
    activitiesResult.data.forEach(function(a) {
      if (isSportActivity(a)) {
        const classified = classifyActivityType(a);
        result.actual.push({
          date: a.start_date_local?.substring(0, 10),
          name: a.name,
          workoutType: classified?.type || 'Unknown',
          actualTSS: a.icu_training_load || 0,
          actualDuration: Math.round((a.moving_time || 0) / 60),
          activity: a.type.replace('Virtual', '')
        });
        result.summary.actualTSS += a.icu_training_load || 0;
      }
    });
  }

  // Compare planned vs actual by date
  const plannedByDate = {};
  result.planned.forEach(p => {
    plannedByDate[p.date] = p;
  });

  const actualByDate = {};
  result.actual.forEach(a => {
    if (!actualByDate[a.date]) actualByDate[a.date] = [];
    actualByDate[a.date].push(a);
  });

  // Analyze each planned day
  result.planned.forEach(planned => {
    const actuals = actualByDate[planned.date] || [];
    const matchingActual = actuals.find(a =>
      a.activity === planned.activity ||
      (a.activity === 'Ride' && planned.activity === 'Ride') ||
      (a.activity === 'Run' && planned.activity === 'Run')
    );

    const comparison = {
      date: planned.date,
      planned: planned,
      actual: matchingActual || null,
      status: 'skipped',
      tssVariance: 0,
      durationVariance: 0,
      typeMatch: false
    };

    if (matchingActual) {
      comparison.status = 'completed';
      comparison.tssVariance = matchingActual.actualTSS - planned.plannedTSS;
      comparison.durationVariance = matchingActual.actualDuration - planned.plannedDuration;
      comparison.typeMatch = matchingActual.workoutType === planned.workoutType ||
        matchingActual.workoutType?.includes(planned.workoutType?.split('_')[0]);
      result.summary.completedSessions++;
    } else {
      result.summary.skippedSessions++;
    }

    result.comparison.push(comparison);
  });

  // Count extra sessions (done but not planned)
  const plannedDates = new Set(result.planned.map(p => p.date));
  result.actual.forEach(a => {
    if (!plannedDates.has(a.date)) {
      result.summary.extraSessions++;
    }
  });

  // Calculate adherence score (0-100)
  if (result.summary.plannedSessions > 0) {
    const completionRate = result.summary.completedSessions / result.summary.plannedSessions;
    const tssAccuracy = result.summary.plannedTSS > 0 ?
      Math.min(1, result.summary.actualTSS / result.summary.plannedTSS) : 0;
    result.summary.adherenceScore = Math.round((completionRate * 0.7 + tssAccuracy * 0.3) * 100);
  }

  result.summary.tssVariance = result.summary.actualTSS - result.summary.plannedTSS;

  return result;
}

/**
 * Generate AI insights from plan execution analysis
 * Learns patterns from what worked and what didn't
 * @param {object} executionData - From analyzeWeeklyPlanExecution()
 * @returns {object} { patterns, adaptations, recommendations }
 */
function generateAIPlanAdaptationInsights(executionData) {
  const langName = getPromptLanguage();

  if (!executionData || executionData.summary.plannedSessions === 0) {
    return null;
  }

  const summary = executionData.summary;
  const comparisons = executionData.comparison;

  // Build comparison details
  const completedDetails = comparisons.filter(c => c.status === 'completed').map(c => {
    const tssSign = c.tssVariance >= 0 ? '+' : '';
    return `${c.date}: ${c.planned.workoutType} → ${c.actual?.workoutType || 'done'} (TSS: ${tssSign}${c.tssVariance})`;
  }).join('\n');

  const skippedDetails = comparisons.filter(c => c.status === 'skipped').map(c =>
    `${c.date}: ${c.planned.workoutType} (TSS target: ${c.planned.plannedTSS})`
  ).join('\n');

  const prompt = `You are an expert coach analyzing how well an athlete followed their training plan last week.

**PLAN EXECUTION SUMMARY:**
- Planned Sessions: ${summary.plannedSessions}
- Completed: ${summary.completedSessions}
- Skipped: ${summary.skippedSessions}
- Extra (unplanned): ${summary.extraSessions}
- Planned TSS: ${summary.plannedTSS}
- Actual TSS: ${summary.actualTSS} (${summary.tssVariance >= 0 ? '+' : ''}${summary.tssVariance})
- Adherence Score: ${summary.adherenceScore}%

**COMPLETED SESSIONS:**
${completedDetails || 'None'}

**SKIPPED SESSIONS:**
${skippedDetails || 'None'}

**Your Analysis Task:**
Identify patterns in what the athlete completes vs skips:
1. Are certain workout types consistently skipped? (intensity too high? wrong day?)
2. Did they exceed or fall short of TSS targets? (over-eager or under-recovered?)
3. Were there unplanned sessions? (athlete prefers flexibility?)
4. What adaptations should future plans make?

**Output JSON only (no markdown wrapping):**
Write all text in ${langName}.
{
  "patterns": ["Pattern 1 observed in ${langName}", "Pattern 2"],
  "adaptations": ["Adaptation 1 for future plans in ${langName}", "Adaptation 2"],
  "adherenceAssessment": "Brief assessment of adherence quality in ${langName}",
  "planningRecommendation": "Key recommendation for next week's plan in ${langName}",
  "confidence": "high|medium|low"
}`;

  const response = callGeminiAPIText(prompt);
  const insights = parseGeminiJsonResponse(response);
  if (!insights) {
    Logger.log("AI plan adaptation: Failed to parse response");
  }
  return insights;
}

// =========================================================
// MID-WEEK ADAPTATION
// =========================================================

/**
 * Check if mid-week adaptation is needed based on missed sessions AND wellness/recovery
 * Combines execution-based (missed workouts) and fatigue-based (wellness) adaptation triggers
 * Also considers taper timing to ensure race readiness
 *
 * @param {object} weekProgress - Result from checkWeekProgress()
 * @param {object} upcomingDays - Remaining week placeholders
 * @param {object} wellness - Wellness summary (optional)
 * @param {object} fitness - Fitness metrics with TSB (optional)
 * @param {object} taperRecommendation - Taper recommendation from generateTaperRecommendation() (optional)
 * @returns {object} { needed: boolean, reason: string, priority: string, triggers: object }
 */
function checkMidWeekAdaptationNeeded(weekProgress, upcomingDays, wellness, fitness, taperRecommendation) {
  const result = {
    needed: false,
    reason: '',
    priority: 'low',
    triggers: {
      missedIntensity: [],
      tssDeficit: 0,
      lowAdherence: false,
      lowRecovery: false,
      highFatigue: false,
      recoveryMismatch: false,
      taperMismatch: false
    }
  };

  const reasons = [];

  // ===== EXECUTION-BASED TRIGGERS (missed sessions) =====
  if (weekProgress && weekProgress.daysAnalyzed > 0) {
    // High-priority workout types that should be rescheduled if missed
    const intensityTypes = ['VO2max', 'Threshold', 'SweetSpot', 'Intervals', 'Tempo'];

    // Check for missed intensity sessions
    const missedIntensity = (weekProgress.missedTypes || []).filter(type =>
      intensityTypes.some(it => type.toLowerCase().includes(it.toLowerCase()))
    );

    if (missedIntensity.length > 0) {
      result.needed = true;
      result.priority = 'high';
      result.triggers.missedIntensity = missedIntensity;
      reasons.push(`Missed key intensity: ${missedIntensity.join(', ')}`);
    }

    // Check TSS deficit
    const tssDelta = (weekProgress.tssPlanned || 0) - (weekProgress.tssCompleted || 0);
    if (tssDelta > 100) {
      result.needed = true;
      if (result.priority !== 'high') result.priority = 'medium';
      result.triggers.tssDeficit = tssDelta;
      reasons.push(`TSS deficit: ${tssDelta.toFixed(0)}`);
    }

    // Check adherence
    const adherence = weekProgress.adherenceRate || 100;
    if (adherence < 70 && weekProgress.plannedSessions >= 2) {
      result.needed = true;
      if (result.priority !== 'high') result.priority = 'medium';
      result.triggers.lowAdherence = true;
      reasons.push(`Low adherence: ${adherence.toFixed(0)}%`);
    }
  }

  // ===== FATIGUE-BASED TRIGGERS (wellness/recovery) =====
  if (wellness && upcomingDays) {
    const recoveryStatus = wellness.recoveryStatus || 'Unknown';
    const isLowRecovery = recoveryStatus.includes('Red') || recoveryStatus.includes('Strained');
    const isYellowRecovery = recoveryStatus.includes('Yellow') || recoveryStatus.includes('Moderate');

    // Check TSB for fatigue
    const tsb = fitness?.tsb || 0;
    const isVeryFatigued = tsb < -20;
    const isOverreaching = tsb < -30;

    // Find upcoming intensity days (tomorrow onwards)
    const today = formatDateISO(new Date());
    const upcomingIntenseDays = upcomingDays.filter(d => {
      if (d.date <= today) return false;
      const name = d.placeholderName || '';
      return name.match(/VO2|Threshold|Intervals|Tempo|SweetSpot/i);
    });

    // Low recovery + intensity planned = adapt
    if (isLowRecovery && upcomingIntenseDays.length > 0) {
      result.needed = true;
      result.priority = 'high';
      result.triggers.lowRecovery = true;
      result.triggers.recoveryMismatch = true;
      reasons.push(`Low recovery (${recoveryStatus}) with ${upcomingIntenseDays.length} intensity day(s) ahead`);
    }

    // Yellow recovery + multiple intensity days = consider adapting
    if (isYellowRecovery && upcomingIntenseDays.length >= 2) {
      result.needed = true;
      if (result.priority !== 'high') result.priority = 'medium';
      result.triggers.recoveryMismatch = true;
      reasons.push(`Moderate recovery with ${upcomingIntenseDays.length} intensity days planned`);
    }

    // Overreaching + any intensity = adapt
    if (isOverreaching && upcomingIntenseDays.length > 0) {
      result.needed = true;
      result.priority = 'high';
      result.triggers.highFatigue = true;
      reasons.push(`High fatigue (TSB: ${tsb.toFixed(1)}) with intensity planned`);
    }

    // Very fatigued + multiple intensity days = adapt
    if (isVeryFatigued && upcomingIntenseDays.length >= 2) {
      result.needed = true;
      if (result.priority !== 'high') result.priority = 'medium';
      result.triggers.highFatigue = true;
      reasons.push(`Fatigued (TSB: ${tsb.toFixed(1)}) with ${upcomingIntenseDays.length} hard days ahead`);
    }
  }

  // ===== TAPER-BASED TRIGGERS (race preparation) =====
  if (taperRecommendation?.available && upcomingDays) {
    const taper = taperRecommendation.analysis;
    const rec = taper.recommended;

    // Check if we're in taper window
    const inTaper = rec.daysUntilTaperStart <= 0;
    const taperStartsThisWeek = rec.daysUntilTaperStart <= 7 && rec.daysUntilTaperStart > 0;
    const raceWeek = taper.daysToRace <= 7;

    // Find high intensity planned in remaining week
    const today = formatDateISO(new Date());
    const upcomingIntense = upcomingDays.filter(d => {
      if (d.date <= today) return false;
      const name = d.placeholderName || '';
      return name.match(/VO2|Threshold|Intervals|SweetSpot/i);
    });

    // In taper but still have hard workouts planned (except opener)
    if (inTaper && upcomingIntense.length > 1) {
      result.needed = true;
      result.priority = 'high';
      result.triggers.taperMismatch = true;
      reasons.push(`In taper (race in ${taper.daysToRace} days) but ${upcomingIntense.length} intensity sessions still planned`);
    }

    // Race week with too much intensity
    if (raceWeek && upcomingIntense.length > 1) {
      result.needed = true;
      result.priority = 'high';
      result.triggers.taperMismatch = true;
      reasons.push(`Race week - too many intensity sessions (${upcomingIntense.length}) planned`);
    }

    // Taper starting this week but no volume reduction yet
    if (taperStartsThisWeek) {
      // Find days after taper start that still have high intensity
      const taperStartDate = rec.taperStartDate;
      const postTaperIntense = upcomingIntense.filter(d => d.date >= taperStartDate);
      if (postTaperIntense.length > 1) {
        result.needed = true;
        if (result.priority !== 'high') result.priority = 'medium';
        result.triggers.taperMismatch = true;
        reasons.push(`Taper starts ${rec.taperStartDate} but ${postTaperIntense.length} hard workouts still planned after`);
      }
    }
  }

  result.reason = reasons.join('; ');

  return result;
}

/**
 * Generate mid-week adaptation plan using AI
 * @param {object} weekProgress - Result from checkWeekProgress()
 * @param {array} upcomingDays - Remaining week placeholders from fetchUpcomingPlaceholders()
 * @param {object} wellness - Wellness summary
 * @param {object} fitness - Fitness metrics
 * @param {object} phaseInfo - Training phase info
 * @param {object} goals - Goal information
 * @param {object} adaptationCheck - Result from checkMidWeekAdaptationNeeded() with triggers
 * @returns {object} { success: boolean, adaptedPlan: array, changes: array, summary: string }
 */
function generateMidWeekAdaptation(weekProgress, upcomingDays, wellness, fitness, phaseInfo, goals, adaptationCheck) {
  const result = {
    success: false,
    adaptedPlan: [],
    changes: [],
    summary: '',
    reasoning: ''
  };

  // Filter to only remaining days with placeholders (excluding today)
  const today = formatDateISO(new Date());
  const remainingDays = upcomingDays.filter(d =>
    d.date > today && d.activityType !== null
  );

  if (remainingDays.length === 0) {
    result.summary = 'No remaining placeholders to adapt';
    return result;
  }

  // Build context for AI with triggers
  const triggers = adaptationCheck?.triggers || {};
  const prompt = buildMidWeekAdaptationPrompt(weekProgress, remainingDays, wellness, fitness, phaseInfo, goals, triggers);

  try {
    const response = callGeminiAPIText(prompt);
    const adaptation = parseGeminiJsonResponse(response);

    if (!adaptation) {
      Logger.log("Mid-week adaptation: Failed to parse AI response");
      return result;
    }

    // Check if AI decided no changes needed
    if (adaptation.needsChanges === false) {
      result.success = true;
      result.summary = adaptation.summary || 'No changes needed';
      result.reasoning = adaptation.reasoning || '';
      Logger.log("Mid-week adaptation: AI determined no changes needed - " + result.summary);
      return result;
    }

    if (!adaptation.adaptedPlan || adaptation.adaptedPlan.length === 0) {
      Logger.log("Mid-week adaptation: No adapted plan in response");
      return result;
    }

    result.success = true;
    result.adaptedPlan = adaptation.adaptedPlan;
    result.changes = adaptation.changes || [];
    result.summary = adaptation.summary || '';
    result.reasoning = adaptation.reasoning || '';

    // Apply the adapted plan to the calendar
    if (result.changes.length > 0) {
      const applied = applyMidWeekAdaptation(result.adaptedPlan, remainingDays);
      Logger.log(`Mid-week adaptation: Applied ${applied} change(s) to calendar`);
    }

    return result;

  } catch (e) {
    Logger.log("Mid-week adaptation error: " + e.toString());
    return result;
  }
}

/**
 * Apply mid-week adaptation by updating placeholders in Intervals.icu
 * @param {array} adaptedPlan - New plan from AI
 * @param {array} remainingDays - Original remaining days
 * @returns {number} Number of changes applied
 */
function applyMidWeekAdaptation(adaptedPlan, remainingDays) {
  let changesApplied = 0;

  // For each day in the adapted plan, update the placeholder if changed
  for (const adapted of adaptedPlan) {
    const original = remainingDays.find(d => d.date === adapted.date);
    if (!original) continue;

    // Check if workout type or duration changed
    const originalType = extractWorkoutType(original.placeholderName);
    const newType = adapted.workoutType;
    const typeChanged = adapted.typeChanged || (originalType !== newType);
    const durationChanged = adapted.durationChanged;

    if (typeChanged || durationChanged) {
      // Delete old placeholder and create new one
      try {
        // Find and delete the existing event
        const eventsResult = fetchIcuApi("/athlete/0/events?oldest=" + adapted.date + "&newest=" + adapted.date);
        if (eventsResult.success && eventsResult.data) {
          const placeholder = eventsResult.data.find(e =>
            e.category === 'WORKOUT' &&
            (e.description?.includes('[Weekly Plan]') || e.name?.match(/^(Ride|Run)/i))
          );

          if (placeholder && placeholder.id) {
            // Delete old placeholder
            deleteIntervalEvent(placeholder.id);

            // Create new placeholder with adapted workout
            const activityType = original.activityType || 'Ride';
            const duration = adapted.duration || original.duration?.max || 60;
            const newName = `${activityType} - ${newType} - ${duration}min [Weekly Plan - Adapted]`;
            const description = `[Weekly Plan] Mid-week adaptation: ${adapted.description || 'Adjusted based on week progress'}`;

            createWeeklyPlanPlaceholder(adapted.date, activityType, newName, description);
            Logger.log(`Adapted ${adapted.date}: ${originalType || 'unspecified'} → ${newType}`);
            changesApplied++;
          }
        }
      } catch (e) {
        Logger.log(`Failed to adapt ${adapted.date}: ${e.toString()}`);
      }
    }
  }

  return changesApplied;
}

/**
 * Extract workout type from placeholder name
 * @param {string} name - Placeholder name like "Ride - Threshold - 60min"
 * @returns {string} Workout type or null
 */
function extractWorkoutType(name) {
  if (!name) return null;

  const types = ['VO2max', 'Threshold', 'SweetSpot', 'Tempo', 'Endurance', 'Recovery', 'Intervals', 'Long'];
  for (const type of types) {
    if (name.toLowerCase().includes(type.toLowerCase())) {
      return type;
    }
  }
  return null;
}

/**
 * Create a weekly plan placeholder in Intervals.icu
 * @param {string} date - ISO date string
 * @param {string} activityType - 'Ride' or 'Run'
 * @param {string} name - Placeholder name
 * @param {string} description - Optional description
 */
function createWeeklyPlanPlaceholder(date, activityType, name, description) {
  const event = {
    category: 'WORKOUT',
    start_date_local: date,
    name: name,
    description: description || '[Weekly Plan] Mid-week adaptation',
    type: activityType
  };

  const result = fetchIcuApi('/athlete/0/events', {
    method: 'POST',
    payload: JSON.stringify(event)
  });

  if (!result.success) {
    Logger.log("Failed to create placeholder: " + result.error);
  }

  return result;
}

// =========================================================
// RESCHEDULE SUGGESTIONS
// =========================================================

/**
 * Suggest the best day to reschedule today's workout when a rest day is recommended
 * Analyzes upcoming days to find optimal rescheduling candidates
 * @param {object} todayPlaceholder - Today's planned workout { activityType, duration, placeholderName }
 * @param {array} upcomingDays - Array of next 7 days from fetchUpcomingPlaceholders()
 * @param {object} wellness - Wellness summary with recovery status
 * @param {object} weekProgress - Week progress from checkWeekProgress()
 * @returns {object} { suggestReschedule, candidates, reasoning, todayWorkout }
 */
function suggestWorkoutReschedule(todayPlaceholder, upcomingDays, wellness, weekProgress) {
  const lang = USER_SETTINGS.LANGUAGE || 'en';
  const isNL = lang === 'nl';

  const result = {
    suggestReschedule: false,
    candidates: [],
    reasoning: '',
    todayWorkout: null
  };

  // Check if there's actually a workout to reschedule today
  if (!todayPlaceholder || !todayPlaceholder.activityType) {
    result.reasoning = isNL ? 'Geen training gepland voor vandaag' : 'No workout scheduled for today';
    return result;
  }

  result.todayWorkout = {
    type: todayPlaceholder.activityType,
    name: todayPlaceholder.placeholderName || todayPlaceholder.activityType,
    duration: todayPlaceholder.duration
  };

  // Get recovery status
  const recoveryStatus = wellness?.recoveryStatus || 'Unknown';
  const isRedRecovery = recoveryStatus.includes('Red') || recoveryStatus.includes('Strained');
  const isYellowRecovery = recoveryStatus.includes('Yellow') || recoveryStatus.includes('Moderate');

  // Look through upcoming days (skip today = index 0)
  const today = formatDateISO(new Date());

  for (let i = 1; i < upcomingDays.length && i <= 5; i++) {
    const day = upcomingDays[i];

    // Skip days that already have workouts or events
    if (day.activityType || day.hasEvent) {
      continue;
    }

    // Skip tomorrow if recovery is very low (red)
    if (i === 1 && isRedRecovery) {
      continue;
    }

    // Calculate confidence based on various factors
    let confidence = 'medium';
    let reason = '';

    if (i === 1) {
      // Tomorrow - good if yellow recovery
      confidence = isYellowRecovery ? 'medium' : 'high';
      reason = isYellowRecovery
        ? (isNL ? 'Morgen beschikbaar, maar recovery monitoren' : 'Tomorrow available, but monitor recovery')
        : (isNL ? 'Morgen beschikbaar, verwacht goed hersteld' : 'Tomorrow available, expect good recovery');
    } else if (i === 2) {
      // Day after tomorrow - usually optimal for red recovery
      confidence = 'high';
      reason = isRedRecovery
        ? (isNL ? 'Optimaal: extra dag herstel na lage recovery' : 'Optimal: extra recovery day after low recovery')
        : (isNL ? 'Goed alternatief met voldoende rusttijd' : 'Good alternative with sufficient rest time');
    } else if (i <= 4) {
      // 3-4 days out - good backup option
      confidence = 'medium';
      reason = isNL ? 'Beschikbaar als langere rust nodig is' : 'Available if longer rest is needed';
    } else {
      // 5+ days - too far, affects weekly structure
      confidence = 'low';
      reason = isNL ? 'Ver weg - kan weekplanning verstoren' : 'Far out - may disrupt weekly planning';
    }

    result.candidates.push({
      date: day.date,
      dayName: day.dayName,
      daysFromNow: i,
      reason: reason,
      confidence: confidence
    });
  }

  // Set overall result
  if (result.candidates.length > 0) {
    result.suggestReschedule = true;

    // Build reasoning based on recovery status
    if (isRedRecovery) {
      result.reasoning = isNL
        ? `Je ${result.todayWorkout.name} staat vandaag gepland, maar met lage recovery is rust nu belangrijker. `
        : `Your ${result.todayWorkout.name} is scheduled for today, but with low recovery, rest is more important right now. `;
    } else if (isYellowRecovery) {
      result.reasoning = isNL
        ? `Je ${result.todayWorkout.name} kan vandaag, maar verschuiven geeft je lichaam meer tijd om te herstellen. `
        : `Your ${result.todayWorkout.name} could be done today, but rescheduling gives your body more time to recover. `;
    } else {
      result.reasoning = isNL
        ? `Vandaag is strategische rust. Je ${result.todayWorkout.name} kan naar een andere dag. `
        : `Today is strategic rest. Your ${result.todayWorkout.name} can be moved to another day. `;
    }
  } else {
    result.reasoning = isNL
      ? 'Geen geschikte dagen gevonden om te verschuiven (komende dagen al bezet of events).'
      : 'No suitable days found for rescheduling (upcoming days already have workouts or events).';
  }

  return result;
}

/**
 * Format reschedule suggestion for email display
 * @param {object} reschedule - Output from suggestWorkoutReschedule()
 * @param {boolean} isNL - Dutch language flag
 * @returns {string} Formatted section for email
 */
function formatRescheduleSuggestion(reschedule, isNL) {
  if (!reschedule || !reschedule.suggestReschedule || reschedule.candidates.length === 0) {
    return '';
  }

  let section = '';

  // Header
  section += isNL
    ? '\n━━━ TRAINING VERSCHUIVEN ━━━\n\n'
    : '\n━━━ RESCHEDULE SUGGESTION ━━━\n\n';

  // Context
  section += reschedule.reasoning + '\n\n';

  // Best options
  const topCandidates = reschedule.candidates.slice(0, 2);
  section += isNL ? 'Beste opties:\n' : 'Best options:\n';

  topCandidates.forEach((candidate, idx) => {
    const arrow = idx === 0 ? '→' : '○';
    const dayLabel = isNL
      ? candidate.dayName
      : candidate.dayName;

    const daysText = candidate.daysFromNow === 1
      ? (isNL ? 'morgen' : 'tomorrow')
      : (isNL ? `over ${candidate.daysFromNow} dagen` : `in ${candidate.daysFromNow} days`);

    section += `  ${arrow} ${dayLabel} (${daysText}): ${candidate.reason}\n`;
  });

  section += '\n';

  // Action hint
  const workoutName = reschedule.todayWorkout?.name || 'training';
  section += isNL
    ? `Om te verschuiven: verplaats "${workoutName}" in je Intervals.icu kalender.\n\n`
    : `To reschedule: move "${workoutName}" in your Intervals.icu calendar.\n\n`;

  return section;
}

// =========================================================
// FOUR-WEEK OUTLOOK
// =========================================================

/**
 * Generate a 4-week training outlook
 * Shows macro-level planning: week themes, volume targets, phase progression
 * Recovery timing is DYNAMIC based on body signals, not fixed 4-week patterns
 * @param {object} fitnessMetrics - Current fitness (CTL, ATL, TSB, rampRate)
 * @param {object} phaseInfo - Training phase info
 * @param {object} zoneProgression - Zone progression data
 * @param {object} deloadCheck - Deload status from checkDeloadNeeded()
 * @returns {object} Four-week outlook with week-by-week breakdown
 */
function generateFourWeekOutlook(fitnessMetrics, phaseInfo, zoneProgression, deloadCheck) {
  const today = new Date();
  const weeks = [];

  // Get current week's Monday
  const currentMonday = new Date(today);
  const dayOfWeek = currentMonday.getDay();
  const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  currentMonday.setDate(currentMonday.getDate() + diff);

  // Calculate base weekly TSS target from current CTL
  const ctl = fitnessMetrics?.ctl || 20;
  const baseWeeklyTSS = Math.round(ctl * 7);

  // Determine periodization pattern based on weeks without deload
  const weeksWithoutDeload = deloadCheck?.weeksWithoutDeload || 0;
  const needsRecoveryThisBlock = weeksWithoutDeload >= 2;

  // Fetch upcoming holidays (look 8 weeks ahead to catch holidays just outside 4-week window)
  let holidayData = { available: false, holidays: [], nextHoliday: null };
  try {
    holidayData = fetchUpcomingHolidays(8);
  } catch (e) {
    Logger.log("Holiday fetch failed (non-critical): " + e.toString());
  }

  // Get focus areas from zone progression
  const focusAreas = zoneProgression?.focusAreas || [];
  const focusLabels = {
    endurance: 'Endurance',
    tempo: 'Tempo',
    threshold: 'Threshold',
    vo2max: 'VO2max',
    anaerobic: 'Anaerobic'
  };

  // Phase-specific focus
  const phaseFocus = {
    'Base': ['Endurance volume', 'Aerobic base'],
    'Build': ['Threshold development', 'VO2max introduction'],
    'Peak': ['Race-specific efforts', 'Sharpening'],
    'Taper': ['Freshness', 'Openers only'],
    'Recovery': ['Easy spinning', 'Active recovery']
  };

  const currentPhaseFocusList = phaseFocus[phaseInfo?.phaseName] || phaseFocus['Build'];

  // Track if we've already scheduled a recovery week (only one per 4-week block)
  let recoveryScheduledThisBlock = false;

  // Generate 4 weeks
  for (let w = 0; w < 4; w++) {
    const weekStart = new Date(currentMonday);
    weekStart.setDate(currentMonday.getDate() + (w * 7));
    const weekStartStr = formatDateISO(weekStart);

    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    const weekEndStr = formatDateISO(weekEnd);

    // Fetch events for this week
    const events = [];
    for (let d = 0; d < 7; d++) {
      const checkDate = new Date(weekStart);
      checkDate.setDate(weekStart.getDate() + d);
      const dateStr = formatDateISO(checkDate);
      const eventData = fetchEventsForDate(dateStr);

      if (eventData.raceEvent) {
        events.push({
          date: dateStr,
          category: eventData.raceEvent.category,
          name: eventData.raceEvent.name
        });
      }
    }

    // Check for holiday this week
    const holidayThisWeek = getHolidayForWeek(weekStartStr, holidayData);

    // Check if holiday is coming in the next 1-2 weeks (for pre-holiday push)
    let holidayComingSoon = false;
    let weeksUntilHoliday = null;
    if (holidayData.nextHoliday && !holidayThisWeek) {
      const nextHolidayStart = new Date(holidayData.nextHoliday.startDate);
      const weekEndDate = new Date(weekEndStr);
      const daysToHoliday = Math.floor((nextHolidayStart - weekEndDate) / (1000 * 60 * 60 * 24));
      weeksUntilHoliday = Math.floor(daysToHoliday / 7);

      // Mark as "holiday coming" if it's 1-2 weeks away
      if (weeksUntilHoliday >= 0 && weeksUntilHoliday <= 2) {
        holidayComingSoon = true;
      }
    }

    // Determine week type
    let weekType = 'Build';
    let tssMultiplier = 1.0;
    let weekFocus = '';

    // Check for A/B race this week
    const hasARace = events.some(e => e.category === 'A');
    const hasBRace = events.some(e => e.category === 'B');

    if (hasARace) {
      // A Race takes highest priority
      weekType = 'Race Week';
      tssMultiplier = 0.5;
      weekFocus = 'Freshness & race prep';
    } else if (hasBRace) {
      // B Race takes priority over holiday
      weekType = 'Race Week';
      tssMultiplier = 0.7;
      weekFocus = 'Taper & race prep';
    } else if (holidayThisWeek && !holidayThisWeek.hasConflictingRace) {
      // Holiday week = planned recovery (unless race during holiday)
      weekType = 'Holiday';
      tssMultiplier = 0.5;
      weekFocus = `Planned rest: ${holidayThisWeek.name}`;
      recoveryScheduledThisBlock = true; // Holiday counts as recovery
    } else if (phaseInfo?.phaseName === 'Taper') {
      weekType = 'Taper';
      tssMultiplier = 0.6 - (w * 0.1); // Progressive taper
      weekFocus = 'Maintain sharpness, reduce volume';
    } else if (holidayComingSoon && weeksUntilHoliday <= 1) {
      // Week right before holiday: push harder (overreaching)
      weekType = 'Pre-Holiday Push';
      tssMultiplier = 1.15; // 15% above normal
      weekFocus = `Push hard before ${holidayData.nextHoliday.name}`;
    } else if (w === 0 && deloadCheck?.needed && !holidayComingSoon) {
      // Immediate recovery if body signals indicate need (but skip if holiday coming soon)
      weekType = 'Recovery';
      tssMultiplier = 0.6;
      weekFocus = 'Recovery week - body needs rest';
      recoveryScheduledThisBlock = true;
    } else if (w > 0 && !recoveryScheduledThisBlock && weeksWithoutDeload + w >= 4 && !events.some(e => e.category === 'A' || e.category === 'B') && !holidayComingSoon) {
      // Suggest recovery when fatigue likely accumulated (but skip if holiday provides recovery soon)
      // Only schedule one recovery week per 4-week block
      weekType = 'Recovery (tentative)';
      tssMultiplier = 0.6;
      weekFocus = 'Potential recovery - monitor wellness';
      recoveryScheduledThisBlock = true;
    } else {
      // Build week with progressive overload
      weekType = 'Build';
      tssMultiplier = 1.0 + (w * 0.05); // 5% increase per week

      // Vary focus across weeks
      if (focusAreas.length > 0) {
        const focusIdx = w % focusAreas.length;
        weekFocus = focusLabels[focusAreas[focusIdx]] || currentPhaseFocusList[w % currentPhaseFocusList.length];
      } else {
        weekFocus = currentPhaseFocusList[w % currentPhaseFocusList.length];
      }
    }

    // Calculate TSS target
    const tssTarget = Math.round(baseWeeklyTSS * tssMultiplier);

    // Determine intensity sessions for the week
    let intensitySessions = 2;
    if (weekType === 'Recovery' || weekType === 'Recovery (tentative)') intensitySessions = 1;
    if (weekType === 'Race Week') intensitySessions = 1;
    if (weekType === 'Taper') intensitySessions = 1;
    if (weekType === 'Holiday') intensitySessions = 0; // Full rest during holiday
    if (weekType === 'Pre-Holiday Push') intensitySessions = 3; // Extra intensity before holiday

    weeks.push({
      weekNumber: w + 1,
      weekStart: weekStartStr,
      weekEnd: weekEndStr,
      type: weekType,
      tssTarget: tssTarget,
      focus: weekFocus,
      intensitySessions: intensitySessions,
      events: events,
      holiday: holidayThisWeek || null
    });
  }

  // Determine periodization pattern
  const weekTypes = weeks.map(w => w.type);
  const buildWeeks = weekTypes.filter(t => t === 'Build').length;
  const recoveryWeeks = weekTypes.filter(t => t === 'Recovery').length;
  const periodization = recoveryWeeks > 0 ? `${buildWeeks}:${recoveryWeeks}` : 'Progressive';

  // Generate summary
  let summary = '';
  const weeksOut = phaseInfo?.weeksOut || 12;
  const phaseName = phaseInfo?.phaseName || 'Build';

  if (phaseName === 'Taper') {
    summary = `Tapering toward your goal event. Reducing volume while maintaining intensity.`;
  } else if (weeks.some(w => w.type === 'Race Week')) {
    const raceWeek = weeks.find(w => w.type === 'Race Week');
    const raceEvent = raceWeek.events.find(e => e.category === 'A' || e.category === 'B');
    summary = `Race week coming up: ${raceEvent?.name || 'Event'}. Building then tapering.`;
  } else if (phaseName === 'Base') {
    summary = `Base phase: ${periodization} periodization. Focus on aerobic development and consistency.`;
  } else {
    summary = `${phaseName} phase: ${periodization} periodization. ${weeksOut} weeks to goal.`;
  }

  return {
    generatedAt: formatDateISO(today),
    periodization: periodization,
    currentPhase: phaseName,
    weeksToGoal: weeksOut,
    weeks: weeks,
    summary: summary
  };
}

/**
 * Format four-week outlook for email display
 * @param {object} outlook - Output from generateFourWeekOutlook()
 * @param {boolean} isNL - Dutch language flag
 * @returns {string} Formatted section for email
 */
function formatFourWeekOutlookSection(outlook, isNL) {
  if (!outlook || !outlook.weeks) return '';

  let section = isNL ? '\nKOMENDE 4 WEKEN\n\n' : '\nNEXT 4 WEEKS\n\n';

  // Generate localized summary
  const phaseName = outlook.currentPhase || 'Build';
  const periodization = outlook.periodization || 'Progressive';
  const weeksOut = outlook.weeksToGoal || 12;
  const hasRaceWeek = outlook.weeks.some(w => w.type === 'Race Week');
  const raceWeek = outlook.weeks.find(w => w.type === 'Race Week');
  const raceEvent = raceWeek?.events?.find(e => e.category === 'A' || e.category === 'B');

  let summary = '';
  if (phaseName === 'Taper') {
    summary = isNL
      ? 'Afbouwen richting je evenement. Volume omlaag, intensiteit behouden.'
      : 'Tapering toward your goal event. Reducing volume while maintaining intensity.';
  } else if (hasRaceWeek) {
    summary = isNL
      ? `Wedstrijdweek komt eraan: ${raceEvent?.name || 'Evenement'}. Opbouw gevolgd door taper.`
      : `Race week coming up: ${raceEvent?.name || 'Event'}. Building then tapering.`;
  } else if (phaseName === 'Base') {
    summary = isNL
      ? `Base fase: ${periodization} periodisering. Focus op aerobe ontwikkeling en consistentie.`
      : `Base phase: ${periodization} periodization. Focus on aerobic development and consistency.`;
  } else {
    summary = isNL
      ? `${phaseName} fase: ${periodization} periodisering. Nog ${weeksOut} weken tot je doel.`
      : `${phaseName} phase: ${periodization} periodization. ${weeksOut} weeks to goal.`;
  }

  section += summary + '\n\n';

  // Week-by-week breakdown
  for (const week of outlook.weeks) {
    const weekLabel = `Week ${week.weekNumber}`;
    const dateRange = `${week.weekStart.substring(5)} - ${week.weekEnd.substring(5)}`;

    // Translate week type
    const typeTranslations = {
      'Build': isNL ? 'Opbouw' : 'Build',
      'Recovery': isNL ? 'Herstel' : 'Recovery',
      'Recovery (tentative)': isNL ? 'Herstel (voorlopig)' : 'Recovery (tentative)',
      'Race Week': isNL ? 'Wedstrijdweek' : 'Race Week',
      'Taper': isNL ? 'Afbouw' : 'Taper',
      'Holiday': isNL ? 'Vakantie' : 'Holiday',
      'Pre-Holiday Push': isNL ? 'Pre-Vakantie Push' : 'Pre-Holiday Push'
    };
    const weekType = typeTranslations[week.type] || week.type;

    // Translate focus (including dynamic holiday names)
    let weekFocus = week.focus;
    if (week.focus?.startsWith('Planned rest:')) {
      const holidayName = week.focus.replace('Planned rest: ', '');
      weekFocus = isNL ? `Geplande rust: ${holidayName}` : `Planned rest: ${holidayName}`;
    } else if (week.focus?.startsWith('Push hard before')) {
      const holidayName = week.focus.replace('Push hard before ', '');
      weekFocus = isNL ? `Extra hard trainen voor ${holidayName}` : `Push hard before ${holidayName}`;
    } else {
      const focusTranslations = {
        'Potential recovery - monitor wellness': isNL ? 'Mogelijk herstel - monitor welzijn' : 'Potential recovery - monitor wellness',
        'Recovery week - body needs rest': isNL ? 'Herstelweek - lichaam heeft rust nodig' : 'Recovery week - body needs rest',
        'Freshness & race prep': isNL ? 'Frisheid & wedstrijdvoorbereiding' : 'Freshness & race prep',
        'Taper & race prep': isNL ? 'Afbouw & wedstrijdvoorbereiding' : 'Taper & race prep',
        'Maintain sharpness, reduce volume': isNL ? 'Scherpte behouden, volume verlagen' : 'Maintain sharpness, reduce volume',
        'Consolidate gains, active recovery': isNL ? 'Winst consolideren, actief herstel' : 'Consolidate gains, active recovery',
        'Endurance': isNL ? 'Duurvermogen' : 'Endurance',
        'Threshold': isNL ? 'Drempel' : 'Threshold',
        'VO2max': 'VO2max',
        'Anaerobic': isNL ? 'Anaeroob' : 'Anaerobic',
        'Aerobic base': isNL ? 'Aerobe basis' : 'Aerobic base'
      };
      weekFocus = focusTranslations[week.focus] || week.focus;
    }

    // Week type indicator for header
    let typeIndicator = '';
    if (week.type === 'Recovery' || week.type === 'Recovery (tentative)') {
      typeIndicator = isNL ? ' [Herstel]' : ' [Recovery]';
    } else if (week.type === 'Race Week') {
      typeIndicator = isNL ? ' [Wedstrijd]' : ' [Race]';
    } else if (week.type === 'Taper') {
      typeIndicator = isNL ? ' [Afbouw]' : ' [Taper]';
    } else if (week.type === 'Holiday') {
      typeIndicator = isNL ? ' [Vakantie]' : ' [Holiday]';
    } else if (week.type === 'Pre-Holiday Push') {
      typeIndicator = isNL ? ' [Push]' : ' [Push]';
    }

    section += `${weekLabel} (${dateRange})${typeIndicator}\n`;
    section += isNL
      ? `  Type: ${weekType} | TSS doel: ${week.tssTarget} | Focus: ${weekFocus}\n`
      : `  Type: ${weekType} | TSS target: ${week.tssTarget} | Focus: ${weekFocus}\n`;

    // Events this week
    if (week.events.length > 0) {
      const eventList = week.events.map(e => `${e.category}: ${e.name}`).join(', ');
      section += isNL ? `  Events: ${eventList}\n` : `  Events: ${eventList}\n`;
    }

    section += '\n';
  }

  return section;
}

/**
 * Create week label notes in Intervals.icu calendar
 * Creates NOTE events at the start of each week showing the week theme
 * @param {object} outlook - Output from generateFourWeekOutlook()
 * @returns {object} Result with created events
 */
function createWeekLabelEvents(outlook) {
  if (!outlook || !outlook.weeks) {
    return { success: false, error: 'No outlook data' };
  }

  const results = [];

  for (const week of outlook.weeks) {
    // Skip week 1 (current week) - only label future weeks
    if (week.weekNumber === 1) continue;

    // Create a NOTE event on Monday of each week
    const weekLabel = `[Week Plan] ${week.type}`;
    let description = `TSS Target: ${week.tssTarget}\nFocus: ${week.focus}`;

    if (week.events.length > 0) {
      description += `\nEvents: ${week.events.map(e => e.name).join(', ')}`;
    }

    description += `\n\nPeriodization: ${outlook.periodization}`;

    const event = {
      category: 'NOTE',
      start_date_local: week.weekStart + 'T00:00:00',
      name: weekLabel,
      description: description
    };

    // Check if label already exists for this week
    const existingEvents = fetchEventsForDate(week.weekStart);
    const hasLabel = existingEvents.notes?.some(n => n.name?.startsWith('[Week Plan]'));

    if (!hasLabel) {
      try {
        const result = fetchIcuApi('/athlete/0/events', {
          method: 'POST',
          contentType: 'application/json',
          payload: JSON.stringify(event)
        });

        results.push({
          week: week.weekNumber,
          date: week.weekStart,
          success: result.success,
          type: week.type
        });
      } catch (e) {
        results.push({
          week: week.weekNumber,
          date: week.weekStart,
          success: false,
          type: week.type,
          error: e.toString()
        });
      }
    } else {
      results.push({
        week: week.weekNumber,
        date: week.weekStart,
        success: true,
        skipped: true,
        type: week.type
      });
    }
  }

  return {
    success: true,
    created: results.filter(r => r.success && !r.skipped).length,
    skipped: results.filter(r => r.skipped).length,
    results: results
  };
}
