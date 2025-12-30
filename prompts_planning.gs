/**
 * IntervalCoach - Planning & Coaching Prompts
 *
 * AI prompts for training phase assessment, load advice, email content, and insights.
 * Related modules: prompts_workout.gs, prompts_analysis.gs, api.gs
 */

// =========================================================
// AI EMAIL SUBJECT LINE
// =========================================================

/**
 * Generate an engaging AI-powered email subject line
 * @param {object} phaseInfo - Training phase info
 * @param {object} workout - Selected workout details
 * @param {object} wellness - Wellness data
 * @returns {string} AI-generated subject line
 */
function generateAIEmailSubject(phaseInfo, workout, wellness) {
  const langName = getPromptLanguage();

  // Build context for AI
  let recoveryContext = 'Unknown';
  if (wellness?.available) {
    if (wellness.recoveryStatus.includes("Green") || wellness.recoveryStatus.includes("Primed")) {
      recoveryContext = 'Excellent (green/primed)';
    } else if (wellness.recoveryStatus.includes("Yellow") || wellness.recoveryStatus.includes("Normal")) {
      recoveryContext = 'Moderate (yellow/normal)';
    } else if (wellness.recoveryStatus.includes("Red") || wellness.recoveryStatus.includes("Fatigued")) {
      recoveryContext = 'Low (red/fatigued)';
    }
  }

  const prompt = `Generate a SHORT, engaging email subject line for a cycling/running workout email.

Context:
- Workout type: ${workout.type}
- Training phase: ${phaseInfo.phaseName}
- Recovery status: ${recoveryContext}
- Goal: ${phaseInfo.goalDescription || 'General fitness'}

Requirements:
- Write in ${langName}
- Maximum 50 characters (STRICT LIMIT)
- Be motivating and specific to the workout
- NO brackets, NO tags like [GREEN]
- Examples: "Base building: Z2 duurrit", "Hersteldag: rustig aan", "Topvorm! VO2max intervals"

Return ONLY the subject line, nothing else.`;

  try {
    const response = callGeminiAPIText(prompt);
    if (response && response.trim().length > 0 && response.trim().length <= 60) {
      return response.trim();
    }
  } catch (e) {
    Logger.log("AI subject generation failed: " + e.toString());
  }

  // Fallback to simple format
  return workout.type;
}

// =========================================================
// COACHING NOTE GENERATION
// =========================================================

/**
 * Generate a personalized AI coaching note for the workout email
 * @param {object} summary - Athlete summary
 * @param {object} phaseInfo - Training phase info
 * @param {object} workout - Selected workout details
 * @param {object} wellness - Wellness data
 * @param {object} powerProfile - Power profile (optional)
 * @returns {string} AI-generated coaching note
 */
function generatePersonalizedCoachingNote(summary, phaseInfo, workout, wellness, powerProfile) {
  const langName = getPromptLanguage();

  const w = wellness?.today || {};
  const avg = wellness?.averages || {};

  let context = `You are an experienced cycling/running coach writing a brief, personalized note to your athlete about today's training.

**Athlete Context:**
- Training Phase: ${phaseInfo.phaseName} (${phaseInfo.weeksOut} weeks to goal)
- Phase Focus: ${phaseInfo.focus}
- Goal: ${phaseInfo.goalDescription || 'General fitness'}
- Current Fitness: CTL=${summary.ctl_90.toFixed(0)}, TSB=${summary.tsb_current.toFixed(0)} (${summary.tsb_current > 5 ? 'fresh' : summary.tsb_current < -15 ? 'fatigued' : 'balanced'})
`;

  if (wellness?.available) {
    context += `
**Today's Recovery Status:**
- Recovery: ${wellness.recoveryStatus}${w.recovery != null ? ` (${w.recovery}%)` : ''}
- Sleep: ${w.sleep ? w.sleep.toFixed(1) + 'h' : 'N/A'} (avg: ${avg.sleep ? avg.sleep.toFixed(1) + 'h' : 'N/A'})
- HRV: ${w.hrv || 'N/A'} ms (avg: ${avg.hrv ? avg.hrv.toFixed(0) : 'N/A'} ms)
- Resting HR: ${w.restingHR || 'N/A'} bpm
`;
  }

  if (powerProfile?.available) {
    context += `
**Power Profile:**
- eFTP: ${powerProfile.currentEftp || powerProfile.eFTP || 'N/A'}W
- Strengths: ${powerProfile.strengths?.join(', ') || 'N/A'}
- Areas to develop: ${powerProfile.weaknesses?.join(', ') || 'N/A'}
`;
  }

  context += `
**Today's Workout:**
- Type: ${workout.type}
- Why chosen: ${workout.recommendationReason || 'Based on training phase and recovery'}

**Instructions:**
Write a short, personalized coaching note (3-5 sentences) in ${langName} that:
1. Acknowledges how they're feeling today (based on recovery/sleep data)
2. Connects today's workout to their bigger goal and current phase
3. Gives one specific thing to focus on during the workout
4. Ends with brief encouragement

Be warm but professional. Use "you" to address the athlete directly. Don't repeat data they'll see elsewhere in the email. Be concise and motivating.`;

  return callGeminiAPIText(context);
}

// =========================================================
// REST DAY ADVICE
// =========================================================

/**
 * Generate AI-powered rest day advice based on wellness data
 * @param {object} wellness - Wellness summary
 * @returns {string} AI-generated rest day advice
 */
function generateRestDayAdvice(wellness) {
  const langName = getPromptLanguage();

  const w = wellness.today || {};
  const avg = wellness.averages || {};

  const prompt = `You are a professional cycling and running coach. The athlete has RED recovery status today, indicating they need rest.

**Today's Wellness Data:**
- Recovery Score: ${w.recovery != null ? w.recovery + '%' : 'N/A'} (RED = below 34%)
- Sleep: ${w.sleep ? w.sleep.toFixed(1) + 'h' : 'N/A'} (7-day avg: ${avg.sleep ? avg.sleep.toFixed(1) + 'h' : 'N/A'})
- HRV: ${w.hrv || 'N/A'} ms (7-day avg: ${avg.hrv ? avg.hrv.toFixed(0) : 'N/A'} ms)
- Resting HR: ${w.restingHR || 'N/A'} bpm (7-day avg: ${avg.restingHR ? avg.restingHR.toFixed(0) : 'N/A'} bpm)
- Soreness: ${w.soreness ? w.soreness + '/5' : 'N/A'}
- Fatigue: ${w.fatigue ? w.fatigue + '/5' : 'N/A'}
- Stress: ${w.stress ? w.stress + '/5' : 'N/A'}

**Instructions:**
Write a brief, encouraging rest day message in ${langName}. Include:
1. A short explanation of why rest is important today (2-3 sentences max)
2. Two light alternatives if they want to move (keep it simple):
   - Easy walk suggestion (duration, intensity)
   - Light strength/mobility suggestion (duration, focus areas)
3. A motivating closing line

Keep the tone supportive, not preachy. Be concise (max 150 words total).`;

  return callGeminiAPIText(prompt);
}

/**
 * Generate AI-powered rest day coaching note
 * Provides context about why rest fits in the training plan and what's ahead
 * Works for any rest day scenario (no placeholder, recovery day, planned rest, etc.)
 * @param {object} params - Context for generating the note
 * @returns {string} AI-generated coaching note
 */
function generateRestDayCoachingNote(params) {
  const { wellness, phaseInfo, weekProgress, upcomingDays, fitness } = params;
  const langName = getPromptLanguage();

  const w = wellness?.today || {};
  const avg = wellness?.averages || {};

  // Build upcoming workouts context
  let upcomingContext = 'No workouts planned';
  if (upcomingDays && upcomingDays.length > 0) {
    const nextWorkouts = upcomingDays
      .filter(d => d.activityType || d.hasEvent)
      .slice(0, 3)
      .map(d => {
        if (d.hasEvent) return `${d.dayName}: [${d.eventCategory}] ${d.eventName || 'Event'}`;
        return `${d.dayName}: ${d.placeholderName || d.activityType}`;
      });
    if (nextWorkouts.length > 0) {
      upcomingContext = nextWorkouts.join('\n');
    }
  }

  // Build week progress context
  let progressContext = 'No data yet';
  if (weekProgress && weekProgress.daysAnalyzed > 0) {
    progressContext = `Completed: ${weekProgress.completedSessions}/${weekProgress.plannedSessions} sessions (${weekProgress.tssCompleted}/${weekProgress.tssPlanned} TSS)`;
    if (weekProgress.missedTypes?.length > 0) {
      progressContext += `\nMissed: ${weekProgress.missedTypes.join(', ')}`;
    }
  }

  const prompt = `You are an experienced cycling/running coach writing a brief coaching note for a rest day.

**Athlete Context:**
- Training Phase: ${phaseInfo?.phaseName || 'Build'} (${phaseInfo?.weeksOut || '?'} weeks to goal)
- Goal: ${phaseInfo?.goalDescription || 'General fitness'}
- Fitness: CTL=${fitness?.ctl?.toFixed(0) || 'N/A'}, TSB=${fitness?.tsb?.toFixed(1) || 'N/A'}

**Today's Status:**
- Recovery: ${wellness?.recoveryStatus || 'Unknown'}${w.recovery != null ? ` (${w.recovery}%)` : ''}
- Sleep: ${w.sleep ? w.sleep.toFixed(1) + 'h' : 'N/A'}
- HRV: ${w.hrv || 'N/A'} ms (avg: ${avg.hrv ? avg.hrv.toFixed(0) : 'N/A'})

**This Week's Progress:**
${progressContext}

**Coming Up:**
${upcomingContext}

**Instructions:**
Write a short, personalized rest day coaching note (4-6 sentences) in ${langName} that:
1. Acknowledges their current state (fresh, recovering, etc.)
2. Explains how today's rest fits in the bigger picture (training phase, upcoming workouts)
3. If there were missed workouts this week, briefly address how rest helps recalibrate
4. Gives one specific recovery tip (nutrition, sleep, mobility - be specific)
5. Ends with a forward-looking statement about what's ahead

Be warm and conversational. Use "je/jij" (Dutch) or "you" (English) to address them directly. Don't be preachy about rest - be positive and strategic.`;

  try {
    return callGeminiAPIText(prompt);
  } catch (e) {
    Logger.log("Error generating rest day coaching note: " + e.toString());
    return null;
  }
}

// =========================================================
// WEEKLY INSIGHT
// =========================================================

/**
 * Generate AI-powered weekly coaching narrative
 * Enhanced to produce comprehensive coaching letter, not just brief insight
 * @param {object} weekData - This week's activity data
 * @param {object} prevWeekData - Previous week's activity data
 * @param {object} fitnessMetrics - Current fitness metrics
 * @param {object} prevFitnessMetrics - Previous week's fitness metrics
 * @param {object} wellnessSummary - Wellness summary with averages
 * @param {object} prevWellnessSummary - Previous week's wellness summary
 * @param {number} currentEftp - Current eFTP
 * @param {number} prevWeekEftp - Previous week's eFTP
 * @param {object} phaseInfo - Training phase info
 * @param {object} goals - Goal information
 * @param {object} loadAdvice - Training load advice (optional)
 * @param {Array} upcomingPlaceholders - Upcoming week's planned workouts (optional)
 */
function generateWeeklyInsight(weekData, prevWeekData, fitnessMetrics, prevFitnessMetrics, wellnessSummary, prevWellnessSummary, currentEftp, prevWeekEftp, phaseInfo, goals, loadAdvice, upcomingPlaceholders) {
  const langName = getPromptLanguage();

  const ctlChange = fitnessMetrics.ctl - (prevFitnessMetrics.ctl || 0);
  const tsbChange = fitnessMetrics.tsb - (prevFitnessMetrics.tsb || 0);
  const eftpChange = (currentEftp && prevWeekEftp) ? currentEftp - prevWeekEftp : null;
  const tssChange = weekData.totalTss - (prevWeekData.totalTss || 0);

  const prevAvg = prevWellnessSummary && prevWellnessSummary.available ? prevWellnessSummary.averages : {};
  const currAvg = wellnessSummary && wellnessSummary.available ? wellnessSummary.averages : {};
  const sleepChange = (currAvg.sleep && prevAvg.sleep) ? currAvg.sleep - prevAvg.sleep : null;
  const hrvChange = (currAvg.hrv && prevAvg.hrv) ? currAvg.hrv - prevAvg.hrv : null;

  // Build upcoming week context (filter out rest days)
  let upcomingContext = '';
  if (upcomingPlaceholders && upcomingPlaceholders.length > 0) {
    // Filter to only days with actual workouts (has activityType or placeholderName)
    const actualWorkouts = upcomingPlaceholders.filter(p => p.activityType || p.placeholderName);
    if (actualWorkouts.length > 0) {
      const workoutList = actualWorkouts.map(p => p.placeholderName || p.activityType || 'Workout').join(', ');
      upcomingContext = `\nUPCOMING WEEK PLANNED:\n- ${actualWorkouts.length} workouts: ${workoutList}`;
    }
  }

  // Build load advice context
  let loadContext = '';
  if (loadAdvice) {
    loadContext = `\nLOAD RECOMMENDATION:\n- Advice: ${loadAdvice.rampRateAdvice}\n- Weekly TSS Target: ${loadAdvice.tssRange?.min}-${loadAdvice.tssRange?.max}`;
    if (loadAdvice.warning) {
      loadContext += `\n- Warning: ${loadAdvice.warning}`;
    }
  }

  const prompt = `You are a friendly, expert cycling and running coach writing a personalized weekly coaching letter to your athlete.

THIS WEEK'S TRAINING:
- Activities: ${weekData.totalActivities} (${weekData.rides} rides, ${weekData.runs} runs)
- Total Time: ${Math.round(weekData.totalTime / 60)} minutes (${(weekData.totalTime / 3600).toFixed(1)} hours)
- Total TSS: ${weekData.totalTss.toFixed(0)} (${tssChange >= 0 ? '+' : ''}${tssChange.toFixed(0)} vs last week)
- Total Distance: ${(weekData.totalDistance / 1000).toFixed(1)} km

PREVIOUS WEEK:
- Activities: ${prevWeekData.totalActivities}
- Total TSS: ${prevWeekData.totalTss.toFixed(0)}

FITNESS PROGRESS:
- CTL (Fitness): ${fitnessMetrics.ctl.toFixed(1)} (${ctlChange >= 0 ? '+' : ''}${ctlChange.toFixed(1)} this week)
- TSB (Form): ${fitnessMetrics.tsb.toFixed(1)} (${tsbChange >= 0 ? '+' : ''}${tsbChange.toFixed(1)})
- eFTP: ${currentEftp || 'N/A'}W${eftpChange !== null ? ' (' + (eftpChange >= 0 ? '+' : '') + eftpChange + 'W)' : ''}
- Ramp Rate: ${fitnessMetrics.rampRate ? fitnessMetrics.rampRate.toFixed(2) + ' CTL/week' : 'N/A'}

RECOVERY & WELLNESS (7-day averages):
- Sleep: ${currAvg.sleep ? currAvg.sleep.toFixed(1) + 'h' : 'N/A'}${sleepChange !== null ? ' (' + (sleepChange >= 0 ? '+' : '') + sleepChange.toFixed(1) + 'h vs last week)' : ''}
- HRV: ${currAvg.hrv ? currAvg.hrv.toFixed(0) + ' ms' : 'N/A'}${hrvChange !== null ? ' (' + (hrvChange >= 0 ? '+' : '') + hrvChange.toFixed(0) + ')' : ''}
- Recovery Status: ${wellnessSummary?.recoveryStatus || 'Unknown'}

TRAINING CONTEXT:
- Phase: ${phaseInfo.phaseName}
- Goal: ${goals?.available && goals?.primaryGoal ? goals.primaryGoal.name + ' (' + goals.primaryGoal.date + ')' : 'General fitness'}
- Weeks to Goal: ${phaseInfo.weeksOut}${loadContext}${upcomingContext}

Write a personalized coaching letter (5-7 sentences) in ${langName}.

Your letter should feel like it's from a personal coach who knows this athlete. Include:
1. Open with acknowledgment of their week (effort, consistency, key sessions)
2. Highlight the most significant metric change (fitness gains, recovery trends)
3. Connect their progress to their goal (what this week means for Marmotte/their A race)
4. Address any concerns (fatigue building up, recovery declining) with reassurance
5. Preview next week with coaching intent (what to focus on, what to watch for)
6. Close with motivating but genuine encouragement

Write in a warm, conversational tone. Use "you" and "your" to make it personal. Do not use bullet points, headers, or emoji. Just write natural paragraphs.`;

  try {
    const response = callGeminiAPIText(prompt);
    if (response) {
      return response.trim();
    }
  } catch (e) {
    Logger.log("Error generating weekly insight: " + e.toString());
  }

  return null;
}

// =========================================================
// MONTHLY INSIGHT
// =========================================================

/**
 * Generate AI-powered monthly insight based on training trends
 */
function generateMonthlyInsight(currentMonth, previousMonth, phaseInfo, goals) {
  const langName = getPromptLanguage();

  const activityChange = currentMonth.totals.activities - previousMonth.totals.activities;
  const tssChange = currentMonth.totals.tss - previousMonth.totals.tss;
  const ctlChange = currentMonth.fitness.ctlEnd - previousMonth.fitness.ctlEnd;
  const eftpChange = (currentMonth.fitness.eftpEnd && previousMonth.fitness.eftpEnd)
    ? currentMonth.fitness.eftpEnd - previousMonth.fitness.eftpEnd : null;

  // Calculate consistency and training pattern
  const avgWeeklyTss = currentMonth.totals.avgWeeklyTss;
  const tssVariance = currentMonth.weeklyData.map(w => Math.abs(w.totalTss - avgWeeklyTss));
  const avgVariance = tssVariance.reduce((a, b) => a + b, 0) / tssVariance.length;
  const consistencyScore = avgVariance < 30 ? 'very consistent' : avgVariance < 60 ? 'moderately consistent' : 'variable';

  // CTL trend analysis
  const ctlTrend = currentMonth.weeklyData.map(w => w.ctl);
  const ctlDirection = ctlTrend[ctlTrend.length - 1] > ctlTrend[0] ? 'upward' : ctlTrend[ctlTrend.length - 1] < ctlTrend[0] ? 'downward' : 'flat';

  const prompt = `You are a friendly, expert cycling and running coach writing a comprehensive monthly progress review for your athlete. This is ${currentMonth.monthName} ${currentMonth.monthYear}.

THIS MONTH'S TRAINING:
- Total Activities: ${currentMonth.totals.activities} sessions
- Total Time: ${Math.round(currentMonth.totals.time / 60)} minutes (${(currentMonth.totals.time / 3600).toFixed(1)} hours)
- Total TSS: ${currentMonth.totals.tss.toFixed(0)}
- Average Weekly TSS: ${avgWeeklyTss.toFixed(0)}
- Training Pattern: ${consistencyScore}
- Weeks with Training: ${currentMonth.consistency.weeksWithTraining}/${currentMonth.weeks}

WEEKLY BREAKDOWN:
${currentMonth.weeklyData.map((w, i) => `Week ${i + 1}: ${w.totalTss.toFixed(0)} TSS, ${w.activities} activities, CTL ${w.ctl.toFixed(0)}`).join('\n')}

FITNESS PROGRESSION:
- CTL Start of Month: ${currentMonth.fitness.ctlStart.toFixed(1)}
- CTL End of Month: ${currentMonth.fitness.ctlEnd.toFixed(1)} (${ctlDirection} trend)
- CTL Change: ${ctlChange >= 0 ? '+' : ''}${ctlChange.toFixed(1)}
- eFTP: ${currentMonth.fitness.eftpEnd || 'N/A'}W${eftpChange != null ? ' (' + (eftpChange >= 0 ? '+' : '') + eftpChange + 'W vs last month)' : ''}

COMPARISON TO PREVIOUS MONTH (${previousMonth.monthName}):
- Activities: ${previousMonth.totals.activities} (${activityChange >= 0 ? '+' : ''}${activityChange} change)
- TSS: ${previousMonth.totals.tss.toFixed(0)} (${tssChange >= 0 ? '+' : ''}${tssChange.toFixed(0)} change)
- CTL: ${previousMonth.fitness.ctlEnd.toFixed(1)}

TRAINING CONTEXT:
- Current Phase: ${phaseInfo.phaseName}
- Goal: ${goals?.available && goals?.primaryGoal ? goals.primaryGoal.name + ' on ' + goals.primaryGoal.date : 'General fitness'}
- Weeks to Goal: ${phaseInfo.weeksOut}
- Phase Focus: ${phaseInfo.focus || 'Build fitness'}

Write a personalized monthly coaching letter (8-12 sentences, 3-4 paragraphs) in ${langName}.

Your letter should feel like a thorough monthly review from a personal coach. Include:

PARAGRAPH 1 - Month in Review:
- Open with acknowledgment of this month's effort and commitment
- Comment on training volume and consistency compared to last month
- Note any significant patterns (consistent weeks vs variable)

PARAGRAPH 2 - Fitness Analysis:
- Discuss the CTL trend throughout the month (week by week progression)
- Explain what the fitness changes mean in practical terms
- If eFTP changed, explain its significance
- If fitness declined, explain whether this is concerning or expected

PARAGRAPH 3 - Goal Progress & Phase Guidance:
- Connect this month's training to their goal (${phaseInfo.weeksOut} weeks out)
- Explain what this month meant for their preparation
- Give phase-specific guidance for next month based on where they are

PARAGRAPH 4 - Forward Look:
- One key focus area for next month
- Motivating close that's genuine, not generic

Write in a warm, conversational tone. Use "you" and "your" to make it personal. Do not use bullet points, headers, or emoji. Just write natural paragraphs that flow together.`;

  try {
    const response = callGeminiAPIText(prompt);
    if (response) {
      let text = response.trim();
      if ((text.startsWith('"') && text.endsWith('"')) || (text.startsWith("'") && text.endsWith("'"))) {
        text = text.slice(1, -1);
      }
      return text;
    }
  } catch (e) {
    Logger.log("Error generating monthly insight: " + e.toString());
  }

  return null;
}

// =========================================================
// AI-DRIVEN PERIODIZATION
// =========================================================

/**
 * Generate AI-driven training phase assessment
 * Considers fitness trajectory, events, wellness trends, and workout patterns
 * @param {object} context - Full athlete context
 * @returns {object} { phaseName, focus, reasoning, adjustments, confidenceLevel, phaseOverride, upcomingEventNote }
 */
function generateAIPhaseAssessment(context) {
  // Build events context string
  let eventsContext = '';
  if (context.goals && context.goals.available) {
    const g = context.goals;
    const primaryStr = g.primaryGoal
      ? g.primaryGoal.name + ' (' + g.primaryGoal.date + ', ' + (g.primaryGoal.type || 'Unknown type') + ')'
      : 'None set';
    const bRacesStr = g.secondaryGoals && g.secondaryGoals.length > 0
      ? g.secondaryGoals.map(function(r) { return r.name + ' (' + r.date + ')'; }).join(', ')
      : '';
    const cRacesStr = g.subGoals && g.subGoals.length > 0
      ? g.subGoals.map(function(r) { return r.name + ' (' + r.date + ')'; }).join(', ')
      : '';

    eventsContext = `
**Race Calendar & Events:**
- **Primary Goal (A-Race):** ${primaryStr}
${bRacesStr ? '- **B-Races:** ' + bRacesStr : ''}
${cRacesStr ? '- **C-Races (Stepping Stones):** ' + cRacesStr : ''}
- **Total Events Planned:** ${g.allGoals ? g.allGoals.length : 0}
`;
  }

  // Build recent workouts pattern
  let workoutPatternContext = '';
  if (context.recentWorkouts) {
    const rw = context.recentWorkouts;
    const ridesStr = rw.rides && rw.rides.length > 0 ? rw.rides.join(', ') : 'None';
    const runsStr = rw.runs && rw.runs.length > 0 ? rw.runs.join(', ') : 'None';
    const daysAgo = rw.daysSinceLastWorkout != null ? rw.daysSinceLastWorkout : 'Unknown';
    workoutPatternContext = `
**Recent Workout Patterns (7 days):**
- Rides: ${ridesStr}
- Runs: ${runsStr}
- Last Workout Intensity: ${rw.lastIntensity || 'Unknown'}/5 (${daysAgo} days ago)
`;
  }

  // Build fitness trajectory context (for adaptive phase transitions)
  let trajectoryContext = '';
  if (context.trajectory && context.trajectory.available) {
    const traj = context.trajectory;
    const ctlTrend = traj.ctlTrajectory;
    const eftpTrend = traj.eftpTrajectory;
    const recoveryTrend = traj.recoveryTrend;
    const readiness = traj.phaseReadiness;

    trajectoryContext = `
**Fitness Trajectory Analysis (${traj.weeksAnalyzed} weeks):**
- CTL Trend: ${ctlTrend.current || 'N/A'} (${ctlTrend.trend}) | Weekly Change: ${ctlTrend.avgChange || 'N/A'}/week
- CTL Consistency: ${ctlTrend.consistency || 'N/A'}% positive weeks
- eFTP Trend: ${eftpTrend.trend || 'N/A'} | Progress to Target: ${eftpTrend.progressToTarget || 'N/A'}%
- Recovery Trend: ${recoveryTrend.trend || 'N/A'} | Sustainable Load: ${recoveryTrend.sustainableLoad ? 'Yes' : 'No'}

**Phase Readiness Indicators:**
- Base Complete: ${readiness.baseComplete ? 'Yes' : 'No'}
- Build Complete: ${readiness.buildComplete ? 'Yes' : 'No'}
- Ready for Specialty: ${readiness.readyForSpecialty ? 'Yes' : 'No'}
- Ready for Taper: ${readiness.readyForTaper ? 'Yes' : 'No'}
${readiness.indicators.length > 0 ? '- Indicators: ' + readiness.indicators.join('; ') : ''}
`;
  }

  // Build transition recommendation context
  let transitionContext = '';
  if (context.transitionRecommendation && context.transitionRecommendation.reason) {
    const tr = context.transitionRecommendation;
    transitionContext = `
**Trajectory-Based Transition Recommendation:**
- Should Transition: ${tr.shouldTransition ? 'Yes' : 'No'}
- Recommended Phase: ${tr.recommendedPhase}
- Reason: ${tr.reason}
- Urgency: ${tr.urgency}
- Adaptation Type: ${tr.adaptationType || 'maintain'}
`;
  }

  const prompt = `You are an expert cycling coach analyzing an athlete's current training phase.

**Date-Based Reference:**
- Target Event: ${context.goalDescription || 'Not specified'}
- Weeks to Event: ${context.weeksOut}
- Traditional Phase (by date): ${context.traditionalPhase}
${eventsContext}
**Fitness Trajectory:**
- Current CTL: ${context.ctl ? context.ctl.toFixed(1) : 'N/A'} | Weekly Ramp: ${context.rampRate ? context.rampRate.toFixed(2) : 'N/A'}/week
- Current eFTP: ${context.currentEftp || 'N/A'}W | Target FTP: ${context.targetFtp || 'N/A'}W
- eFTP Gap to Peak: ${context.eftpGap !== null && context.eftpGap !== undefined ? context.eftpGap + 'W' : 'N/A'}

**Recovery Trends (7-day averages):**
- HRV: ${context.hrvAvg ? context.hrvAvg.toFixed(0) + 'ms' : 'N/A'}
- Sleep: ${context.sleepAvg ? context.sleepAvg.toFixed(1) + 'h' : 'N/A'}
- Recovery Score: ${context.recoveryAvg ? context.recoveryAvg.toFixed(0) + '%' : 'N/A'}
- Today's Status: ${context.recoveryStatus || 'Unknown'}

**Recent Training Load:**
- Recent Z5+ Time: ${context.z5Recent > 1500 ? 'High' : 'Normal'}
- TSB: ${context.tsb ? context.tsb.toFixed(1) : 'N/A'}
${workoutPatternContext}${trajectoryContext}${transitionContext}
**IMPORTANT: Adaptive Phase Transitions**
The phase should be determined by BOTH calendar timing AND fitness readiness. Use the trajectory analysis above to determine if the athlete:
- Should ACCELERATE to the next phase (objectives achieved ahead of schedule)
- Should DELAY transition (not yet ready, extend current phase)
- Should stay on the traditional schedule

**Question:** Based on fitness trajectory, phase readiness indicators, AND the event calendar (not just weeks to A-race), what phase should this athlete be in?

Consider:
1. Is CTL building appropriately for the goal timeline?
2. Is eFTP trending toward target or stalling?
3. Are recovery metrics supporting the current load?
4. Should we accelerate, maintain, or ease the progression?
5. **Are there upcoming B/C races that require mini-tapers or intensity peaks?**
6. **Is the athlete's current fitness on track for the A-race, or behind/ahead of schedule?**
7. **Do the Phase Readiness Indicators suggest the athlete is ready to advance or should extend current phase?**
8. **Is the trajectory-based transition recommendation appropriate given all factors?**

**Output JSON only (no markdown wrapping):**
{
  "phaseName": "Base|Build|Specialty|Taper|Race Week",
  "focus": "1-sentence phase focus description",
  "reasoning": "Brief explanation of why this phase, including trajectory-based reasoning (2-3 sentences)",
  "adjustments": "Any modifications to standard phase approach (e.g., mini-taper for upcoming C-race)",
  "confidenceLevel": "high|medium|low",
  "phaseOverride": true or false,
  "trajectoryInfluence": "How fitness trajectory affected the phase decision (accelerate/delay/maintain)",
  "upcomingEventNote": "Note about any near-term B/C races affecting this week's approach (optional, null if none)"
}`;

  const response = callGeminiAPIText(prompt);
  const assessment = parseGeminiJsonResponse(response);
  if (!assessment) {
    Logger.log("AI phase assessment: Failed to parse response");
  }
  return assessment;
}

// =========================================================
// AI TRAINING LOAD ADVISOR
// =========================================================

/**
 * Generate AI-driven training load advice
 * Replaces fixed ramp rate thresholds with personalized recommendations
 * @param {object} fitnessMetrics - Current CTL, ATL, TSB, rampRate
 * @param {object} phaseInfo - Training phase info (weeksOut, phaseName)
 * @param {object} goals - Goal information
 * @param {object} wellness - Wellness data with averages
 * @returns {object} { recommendedRampRate, rampRateCategory, personalizedAdvice, warnings, confidence }
 */
function generateAITrainingLoadAdvice(fitnessMetrics, phaseInfo, goals, wellness) {
  const langName = getPromptLanguage();

  const currentCTL = fitnessMetrics.ctl || 0;
  const currentATL = fitnessMetrics.atl || 0;
  const currentTSB = fitnessMetrics.tsb || 0;
  const currentRampRate = fitnessMetrics.rampRate || 0;
  const weeksOut = phaseInfo.weeksOut || 12;

  // Build goal context
  let goalContext = 'General fitness improvement';
  if (goals && goals.available && goals.primaryGoal) {
    goalContext = goals.primaryGoal.name + ' (' + goals.primaryGoal.date + ')';
    if (goals.primaryGoal.type) {
      goalContext += ' - ' + goals.primaryGoal.type;
    }
  }

  // Build wellness context
  let wellnessContext = 'No wellness data available';
  if (wellness && wellness.available && wellness.averages) {
    const avg = wellness.averages;
    wellnessContext = `7-day averages:
- Sleep: ${avg.sleep ? avg.sleep.toFixed(1) + 'h' : 'N/A'}
- HRV: ${avg.hrv ? avg.hrv.toFixed(0) + ' ms' : 'N/A'}
- Resting HR: ${avg.restingHR ? avg.restingHR.toFixed(0) + ' bpm' : 'N/A'}
- Recovery Score: ${avg.recovery ? avg.recovery.toFixed(0) + '%' : 'N/A'}`;

    // Add trend indicators if today's data available
    if (wellness.today) {
      const t = wellness.today;
      if (t.hrv && avg.hrv) {
        const hrvDiff = t.hrv - avg.hrv;
        wellnessContext += `\nToday vs avg: HRV ${hrvDiff >= 0 ? '+' : ''}${hrvDiff.toFixed(0)} ms`;
      }
      if (t.sleep && avg.sleep) {
        const sleepDiff = t.sleep - avg.sleep;
        wellnessContext += `, Sleep ${sleepDiff >= 0 ? '+' : ''}${sleepDiff.toFixed(1)}h`;
      }
    }
  }

  const prompt = `You are an expert cycling coach advising on training load progression.

**Current Fitness State:**
- CTL (Chronic Training Load): ${currentCTL.toFixed(1)}
- ATL (Acute Training Load): ${currentATL.toFixed(1)}
- TSB (Training Stress Balance): ${currentTSB.toFixed(1)} ${currentTSB > 5 ? '(Fresh)' : currentTSB < -15 ? '(Fatigued)' : '(Balanced)'}
- Current Ramp Rate: ${currentRampRate.toFixed(1)} CTL/week

**Training Context:**
- Phase: ${phaseInfo.phaseName}
- Weeks to Goal: ${weeksOut}
- Goal: ${goalContext}

**Wellness/Recovery Data:**
${wellnessContext}

**Standard Ramp Rate Guidelines (for reference):**
- Maintain: 0-3 CTL/week (on track, minimal stress)
- Build: 3-5 CTL/week (sustainable progression)
- Aggressive: 5-7 CTL/week (monitor closely)
- Caution: >7 CTL/week (risk of overtraining)

**Your Task:**
Based on the athlete's current state, wellness trends, and training context:
1. Recommend an appropriate ramp rate for the coming week
2. Consider wellness signals - poor sleep/HRV suggests conservative approach
3. Factor in TSB - high fatigue may warrant recovery week
4. Account for training phase - taper phases need reduction, not building

**Output JSON only (no markdown wrapping):**
Write the "personalizedAdvice" and "warnings" in ${langName}.
{
  "recommendedRampRate": <number between -5 and 8>,
  "rampRateCategory": "Recovery|Maintain|Build|Aggressive|Reduce",
  "personalizedAdvice": "1-2 sentence personalized recommendation in ${langName}",
  "warnings": ["Array of specific warnings in ${langName}, empty array if none"],
  "weeklyTSSMultiplier": <number 0.4-1.1 to adjust base weekly TSS>,
  "confidence": "high|medium|low"
}`;

  const response = callGeminiAPIText(prompt);
  const advice = parseGeminiJsonResponse(response);
  if (!advice) {
    Logger.log("AI training load advice: Failed to parse response");
  }
  return advice;
}

// =========================================================
// AI EVENT-SPECIFIC ANALYSIS
// =========================================================

/**
 * AI-driven event-specific training analysis
 * Analyzes race profile and returns custom training emphasis and peaking strategy
 *
 * @param {object} goal - Goal event (name, date, type, description, priority)
 * @param {object} powerProfile - Athlete's power profile
 * @param {object} fitnessMetrics - Current fitness (CTL, ATL, TSB)
 * @param {number} weeksOut - Weeks until event
 * @returns {object} Event-specific training recommendations
 */
function generateAIEventAnalysis(goal, powerProfile, fitnessMetrics, weeksOut) {
  const langName = getPromptLanguage();

  // Build event context
  const eventContext = `
EVENT DETAILS:
- Name: ${goal.name}
- Date: ${goal.date}
- Priority: ${goal.priority || 'A'}-race
- Type: ${goal.type || 'Unknown'}
- Description: ${goal.description || 'No description provided'}
- Weeks Until Event: ${weeksOut}
`;

  // Build athlete context
  const athleteContext = `
ATHLETE PROFILE:
- Current eFTP: ${powerProfile?.eFTP || 'Unknown'}W
- W': ${powerProfile?.wPrime || 'Unknown'}kJ
- Current CTL: ${fitnessMetrics?.ctl?.toFixed(0) || 'Unknown'}
- Current ATL: ${fitnessMetrics?.atl?.toFixed(0) || 'Unknown'}
- Current TSB: ${fitnessMetrics?.tsb?.toFixed(0) || 'Unknown'}
- Power Strengths: ${powerProfile?.strengths?.join(', ') || 'Unknown'}
- Power Weaknesses: ${powerProfile?.focusAreas?.join(', ') || 'Unknown'}
`;

  const prompt = `You are an expert cycling coach analyzing an upcoming event to create a tailored training strategy.

${eventContext}
${athleteContext}

Analyze this event and provide specific training recommendations. Consider:

1. **Event Demands Analysis** - What physiological systems does this event stress?
   - Climbing events → sustained power, threshold, weight-to-power
   - Criteriums → repeated hard efforts, anaerobic capacity, acceleration
   - Time trials → sustained threshold power, pacing
   - Gran fondos → endurance, fueling, steady-state efficiency
   - Hilly races → variable power, surges, recovery between efforts

2. **Training Emphasis** - Based on event demands and athlete's current strengths/weaknesses:
   - Which energy systems to prioritize?
   - What workout types are most important?
   - How should intensity distribution shift?

3. **Peaking Strategy** - How to arrive fresh and fit:
   - Recommended taper length and style
   - When to do the last hard workout
   - Volume reduction curve

4. **Timeline Recommendations** - Given ${weeksOut} weeks out:
   - What phase should training be in now?
   - Key focuses for the remaining weeks
   - Any benchmark workouts to gauge readiness

**IMPORTANT: Respond with ONLY valid JSON. No introductory text, no explanations. Just the JSON object.**
Use ${langName} for all string values within the JSON:
{
  "eventProfile": {
    "category": "climbing|criterium|time_trial|gran_fondo|road_race|mixed",
    "primaryDemands": ["list of 2-3 key physiological demands"],
    "secondaryDemands": ["list of 1-2 secondary demands"],
    "estimatedDuration": "expected race duration",
    "keyChallenge": "single most important factor for success"
  },
  "trainingEmphasis": {
    "priorityWorkouts": ["top 3 workout types to focus on"],
    "secondaryWorkouts": ["2-3 supporting workout types"],
    "avoidWorkouts": ["workout types that are less important now"],
    "weeklyStructure": "recommended weekly structure description",
    "intensityFocus": "threshold|vo2max|endurance|anaerobic|mixed"
  },
  "peakingStrategy": {
    "taperLength": "recommended taper in weeks (1-3)",
    "taperStyle": "linear|step|exponential",
    "lastHardWorkout": "days before event for last intensity",
    "volumeReduction": "percentage reduction per week during taper",
    "openerWorkout": "recommended day-before-race workout"
  },
  "currentPhaseAdvice": {
    "phase": "what phase athlete should be in now",
    "weeklyFocus": "primary focus for this week",
    "keyWorkout": "most important workout to nail",
    "buildVsTaper": "building|maintaining|tapering"
  },
  "athleteSpecificNotes": "2-3 sentences on how this athlete's profile matches or mismatches the event demands, and what to prioritize",
  "confidence": "high|medium|low"
}`;

  const response = callGeminiAPIText(prompt);
  const result = parseGeminiJsonResponse(response);
  if (!result) {
    Logger.log("AI event analysis: Failed to parse response");
    return null;
  }
  result.aiEnhanced = true;
  return result;
}

// =========================================================
// MID-WEEK ADAPTATION PROMPT
// =========================================================

/**
 * Build AI prompt for mid-week adaptation decisions
 * Handles both missed session rescheduling and fatigue-based adjustments
 *
 * @param {object} weekProgress - Week progress data
 * @param {array} remainingDays - Remaining placeholders for the week
 * @param {object} wellness - Wellness data
 * @param {object} fitness - Fitness metrics
 * @param {object} phaseInfo - Training phase info
 * @param {object} goals - Goal information
 * @param {object} triggers - Adaptation triggers from checkMidWeekAdaptationNeeded()
 * @returns {string} AI prompt
 */
function buildMidWeekAdaptationPrompt(weekProgress, remainingDays, wellness, fitness, phaseInfo, goals, triggers) {
  const langName = getPromptLanguage();

  // Build week progress summary
  let progressSummary = 'No data available';
  if (weekProgress) {
    progressSummary = `Days analyzed: ${weekProgress.daysAnalyzed}
Planned: ${weekProgress.plannedSessions} sessions (${weekProgress.tssPlanned} TSS)
Completed: ${weekProgress.completedSessions} sessions (${weekProgress.tssCompleted} TSS)
Missed: ${weekProgress.missedSessions} sessions
Adherence: ${weekProgress.adherenceRate?.toFixed(0) || 'N/A'}%`;

    if (weekProgress.missedTypes && weekProgress.missedTypes.length > 0) {
      progressSummary += `\nMissed workout types: ${weekProgress.missedTypes.join(', ')}`;
    }
    if (weekProgress.completedTypes && weekProgress.completedTypes.length > 0) {
      progressSummary += `\nCompleted workout types: ${weekProgress.completedTypes.join(', ')}`;
    }
  }

  // Build remaining days summary
  const remainingSummary = remainingDays.map(d => {
    const type = d.placeholderName ? extractWorkoutType(d.placeholderName) : 'Unspecified';
    const duration = d.duration ? `${d.duration.min || d.duration}-${d.duration.max || d.duration}min` : 'TBD';
    const event = d.hasEvent ? ` [${d.eventCategory} event: ${d.eventName}]` : '';
    return `- ${d.dayName} (${d.date}): ${type} ${duration}${event}`;
  }).join('\n');

  // Build wellness context
  let wellnessContext = 'Not available';
  if (wellness?.available) {
    wellnessContext = `Recovery status: ${wellness.recoveryStatus}
Sleep: ${wellness.today?.sleep?.toFixed(1) || 'N/A'}h (${wellness.sleepStatus || 'N/A'})
HRV: ${wellness.today?.hrv || 'N/A'}
Resting HR: ${wellness.today?.restingHR || 'N/A'}`;
  }

  // Build fitness context
  let fitnessContext = 'Not available';
  if (fitness) {
    fitnessContext = `CTL: ${fitness.ctl?.toFixed(0) || 'N/A'}
ATL: ${fitness.atl?.toFixed(0) || 'N/A'}
TSB: ${fitness.tsb?.toFixed(1) || 'N/A'}
Ramp rate: ${fitness.rampRate?.toFixed(1) || 'N/A'} TSS/week`;
  }

  // Build trigger context
  let triggerContext = 'Unknown triggers';
  if (triggers) {
    const triggerList = [];
    if (triggers.missedIntensity?.length > 0) {
      triggerList.push(`Missed intensity sessions: ${triggers.missedIntensity.join(', ')}`);
    }
    if (triggers.tssDeficit > 0) {
      triggerList.push(`TSS deficit: ${triggers.tssDeficit.toFixed(0)}`);
    }
    if (triggers.lowRecovery) {
      triggerList.push('Low recovery status');
    }
    if (triggers.highFatigue) {
      triggerList.push('High fatigue (low TSB)');
    }
    if (triggers.recoveryMismatch) {
      triggerList.push('Recovery/intensity mismatch');
    }
    triggerContext = triggerList.join('; ') || 'General adjustment';
  }

  // Build goal context
  let goalContext = 'General fitness improvement';
  if (goals?.available && goals.primaryGoal) {
    const daysOut = goals.primaryGoal.daysUntil || 'Unknown';
    goalContext = `${goals.primaryGoal.name} (${goals.primaryGoal.date}, ${daysOut} days away)
Event type: ${goals.primaryGoal.type || 'Unknown'}`;
  }

  const prompt = `You are a professional cycling/running coach. The athlete needs their remaining week adjusted based on what happened earlier this week.

**ADAPTATION TRIGGERS:**
${triggerContext}

**WEEK PROGRESS (Monday to yesterday):**
${progressSummary}

**REMAINING DAYS (to adapt):**
${remainingSummary}

**CURRENT WELLNESS:**
${wellnessContext}

**CURRENT FITNESS:**
${fitnessContext}

**TRAINING PHASE:**
Phase: ${phaseInfo?.phaseName || 'Unknown'}
Focus: ${phaseInfo?.focus || 'General fitness'}
Weeks out: ${phaseInfo?.weeksOut || 'N/A'}

**GOAL:**
${goalContext}

**YOUR TASK:**
Analyze the situation and recommend adaptations to the remaining week. Consider:

1. **If intensity was missed**: Can it be rescheduled to a remaining day? Don't stack too much intensity on one day.
2. **If recovery is low**: Should intensity be reduced, swapped to endurance, or postponed?
3. **If TSS deficit is large**: Can remaining workouts be extended, or is it better to accept the shortfall?
4. **Constraints**:
   - Don't schedule hard workouts the day before events
   - Maximum 2 intensity days remaining in a week
   - If overreaching (TSB < -30), prioritize recovery over catching up

Return a JSON response in ${langName} with this structure:
{
  "needsChanges": true|false,
  "summary": "Brief explanation of what's being changed and why (2-3 sentences)",
  "adaptedPlan": [
    {
      "date": "YYYY-MM-DD",
      "dayName": "Friday",
      "workoutType": "Threshold",
      "duration": 60,
      "intensity": "moderate",
      "description": "Brief description of the adapted workout",
      "durationChanged": true|false,
      "typeChanged": true|false
    }
  ],
  "changes": [
    "Moved VO2max from missed Wednesday to Saturday",
    "Reduced Friday's intensity due to low recovery"
  ],
  "reasoning": "Detailed reasoning for the adaptations"
}

If no changes are needed, set needsChanges to false and explain why in the summary.`;

  return prompt;
}
