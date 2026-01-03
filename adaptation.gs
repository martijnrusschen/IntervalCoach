/**
 * IntervalCoach - Adaptive Training & Load Advice
 *
 * RPE/Feel feedback analysis, training load recommendations, and weekly plan adaptation.
 */

// =========================================================
// ADAPTIVE TRAINING (RPE/Feel Feedback)
// =========================================================

/**
 * Fetch recent activity feedback (RPE, Feel) for adaptive training
 * @param {number} days - Days to look back (default 14)
 * @returns {object} Feedback data with summary statistics
 */
function fetchRecentActivityFeedback(days) {
  days = days || 14;
  const today = new Date();
  const from = new Date(today);
  from.setDate(today.getDate() - days);

  const endpoint = `/athlete/0/activities?oldest=${formatDateISO(from)}&newest=${formatDateISO(today)}`;

  const result = {
    activities: [],
    summary: {
      totalWithFeedback: 0,
      avgRpe: null,
      avgFeel: null,
      rpeDistribution: { easy: 0, moderate: 0, hard: 0, veryHard: 0 },
      feelDistribution: { bad: 0, poor: 0, okay: 0, good: 0, great: 0 }
    }
  };

  const apiResult = fetchIcuApi(endpoint);

  if (!apiResult.success) {
    Logger.log("Error fetching activity feedback: " + apiResult.error);
    return result;
  }

  const activities = apiResult.data;
  if (!Array.isArray(activities)) {
    return result;
  }

  let totalRpe = 0;
  let rpeCount = 0;
  let totalFeel = 0;
  let feelCount = 0;

  activities.forEach(function(a) {
    if (isSportActivity(a)) {
      const activity = {
        date: a.start_date_local,
        name: a.name,
        type: a.type,
        duration: a.moving_time,
        tss: a.icu_training_load || 0,
        intensity: a.icu_intensity || null,
        rpe: a.icu_rpe || null,
        feel: a.feel || null
      };

      result.activities.push(activity);

      if (a.icu_rpe != null) {
        totalRpe += a.icu_rpe;
        rpeCount++;
        if (a.icu_rpe <= 4) result.summary.rpeDistribution.easy++;
        else if (a.icu_rpe <= 6) result.summary.rpeDistribution.moderate++;
        else if (a.icu_rpe <= 8) result.summary.rpeDistribution.hard++;
        else result.summary.rpeDistribution.veryHard++;
      }

      if (a.feel != null) {
        totalFeel += a.feel;
        feelCount++;
        // Intervals.icu scale: 1=Strong, 2=Good, 3=Normal, 4=Poor, 5=Weak
        if (a.feel === 1) result.summary.feelDistribution.great++;      // Strong
        else if (a.feel === 2) result.summary.feelDistribution.good++;  // Good
        else if (a.feel === 3) result.summary.feelDistribution.okay++;  // Normal
        else if (a.feel === 4) result.summary.feelDistribution.poor++;  // Poor
        else if (a.feel === 5) result.summary.feelDistribution.bad++;   // Weak
      }
    }
  });

  result.summary.totalWithFeedback = Math.max(rpeCount, feelCount);
  result.summary.avgRpe = rpeCount > 0 ? totalRpe / rpeCount : null;
  result.summary.avgFeel = feelCount > 0 ? totalFeel / feelCount : null;

  return result;
}

/**
 * Analyze recent feedback to determine training adaptation recommendation
 * @param {object} feedback - Result from fetchRecentActivityFeedback
 * @returns {object} Adaptive training recommendation
 */
function analyzeTrainingAdaptation(feedback) {
  const result = {
    recommendation: "maintain", // "easier", "maintain", "harder"
    confidenceLevel: "low",     // "low", "medium", "high"
    intensityAdjustment: 0,     // -10 to +10 (percentage adjustment)
    reasoning: [],
    feedbackQuality: "insufficient"
  };

  // Need at least 3 activities with feedback for meaningful analysis
  if (feedback.summary.totalWithFeedback < 3) {
    result.reasoning.push("Insufficient feedback data (< 3 activities with RPE/Feel)");
    return result;
  }

  result.feedbackQuality = feedback.summary.totalWithFeedback >= 7 ? "good" : "moderate";
  result.confidenceLevel = feedback.summary.totalWithFeedback >= 7 ? "high" : "medium";

  const avgRpe = feedback.summary.avgRpe;
  const avgFeel = feedback.summary.avgFeel;
  const feelDist = feedback.summary.feelDistribution;
  const rpeDist = feedback.summary.rpeDistribution;

  // Analyze Feel distribution
  const negativeFeels = feelDist.bad + feelDist.poor;
  const positiveFeels = feelDist.good + feelDist.great;
  const totalFeels = negativeFeels + feelDist.okay + positiveFeels;

  // Analyze RPE distribution
  const hardWorkouts = rpeDist.hard + rpeDist.veryHard;
  const easyWorkouts = rpeDist.easy;
  const totalRpe = easyWorkouts + rpeDist.moderate + hardWorkouts;

  // Decision logic
  let adjustmentScore = 0;

  // Factor 1: Average Feel (Intervals.icu scale: 1=Strong, 2=Good, 3=Normal, 4=Poor, 5=Weak)
  // Lower is better! Target: 2.0-3.0
  if (avgFeel != null) {
    if (isPoorFeel(avgFeel)) {
      adjustmentScore -= 2;
      result.reasoning.push(`Poor average feel (${avgFeel.toFixed(1)} - ${getFeelLabel(avgFeel)}) suggests overreaching`);
    } else if (avgFeel > 3.5) {
      adjustmentScore -= 1;
      result.reasoning.push(`Below-target feel (${avgFeel.toFixed(1)} - ${getFeelLabel(avgFeel)}) suggests accumulated fatigue`);
    } else if (isGoodFeel(avgFeel)) {
      adjustmentScore += 1;
      result.reasoning.push(`Strong feel scores (${avgFeel.toFixed(1)} - ${getFeelLabel(avgFeel)}) indicate good recovery`);
    } else {
      result.reasoning.push(`Feel scores in target range (${avgFeel.toFixed(1)} - ${getFeelLabel(avgFeel)})`);
    }
  }

  // Factor 2: Average RPE relative to workout intent
  if (avgRpe != null) {
    if (avgRpe > 8.0) {
      adjustmentScore -= 1;
      result.reasoning.push(`High average RPE (${avgRpe.toFixed(1)}/10) suggests workouts feel harder than intended`);
    } else if (avgRpe < 5.0) {
      adjustmentScore += 1;
      result.reasoning.push(`Low average RPE (${avgRpe.toFixed(1)}/10) suggests capacity for more intensity`);
    }
  }

  // Factor 3: Proportion of negative feels
  if (totalFeels > 0 && negativeFeels / totalFeels > 0.4) {
    adjustmentScore -= 1;
    result.reasoning.push(`High proportion of negative feels (${Math.round(negativeFeels/totalFeels*100)}%)`);
  }

  // Factor 4: Recent trend (look at last 3 activities)
  // Remember: Intervals.icu scale 1=Strong (best), 5=Weak (worst)
  const recentActivities = feedback.activities.slice(0, 3);
  const recentWithFeel = recentActivities.filter(a => a.feel != null);
  if (recentWithFeel.length >= 2) {
    const recentAvgFeel = recentWithFeel.reduce((sum, a) => sum + a.feel, 0) / recentWithFeel.length;
    if (recentAvgFeel > 3.5) {
      adjustmentScore -= 1;
      result.reasoning.push(`Recent workouts trending negative (last ${recentWithFeel.length} avg: ${recentAvgFeel.toFixed(1)})`);
    } else if (recentAvgFeel < 2.5 && avgFeel != null && recentAvgFeel < avgFeel) {
      adjustmentScore += 0.5;
      result.reasoning.push(`Recent workouts trending positive`);
    }
  }

  // Convert score to recommendation
  if (adjustmentScore <= -2) {
    result.recommendation = "easier";
    result.intensityAdjustment = -10;
  } else if (adjustmentScore <= -1) {
    result.recommendation = "easier";
    result.intensityAdjustment = -5;
  } else if (adjustmentScore >= 2) {
    result.recommendation = "harder";
    result.intensityAdjustment = 5;
  } else if (adjustmentScore >= 1) {
    result.recommendation = "harder";
    result.intensityAdjustment = 3;
  } else {
    result.recommendation = "maintain";
    result.intensityAdjustment = 0;
  }

  return result;
}

/**
 * Get adaptive training context for workout generation
 * Combines RPE/Feel feedback with training gap analysis
 * @param {object} wellness - Wellness data for gap interpretation (optional)
 * @returns {object} Adaptive context with recommendation and summary
 */
function getAdaptiveTrainingContext(wellness) {
  const feedback = fetchRecentActivityFeedback(14);
  const adaptation = analyzeTrainingAdaptation(feedback);

  // Get training gap data
  const gapData = getDaysSinceLastWorkout();
  const gapAnalysis = analyzeTrainingGap(gapData, wellness);

  // Combine intensity modifiers
  let combinedIntensityAdjustment = adaptation.intensityAdjustment;
  if (gapAnalysis.hasSignificantGap && gapAnalysis.intensityModifier < 1.0) {
    // Convert modifier to percentage adjustment (e.g., 0.7 → -30%)
    const gapAdjustment = Math.round((gapAnalysis.intensityModifier - 1.0) * 100);
    combinedIntensityAdjustment = Math.min(combinedIntensityAdjustment, gapAdjustment);
  }

  return {
    available: feedback.summary.totalWithFeedback >= 3 || gapAnalysis.hasSignificantGap,
    feedback: {
      activitiesAnalyzed: feedback.activities.length,
      activitiesWithFeedback: feedback.summary.totalWithFeedback,
      avgRpe: feedback.summary.avgRpe,
      avgFeel: feedback.summary.avgFeel,
      feelDistribution: feedback.summary.feelDistribution,
      rpeDistribution: feedback.summary.rpeDistribution
    },
    adaptation: {
      ...adaptation,
      intensityAdjustment: combinedIntensityAdjustment
    },
    gap: {
      daysSinceLastWorkout: gapData.daysSinceLastWorkout,
      hasSignificantGap: gapAnalysis.hasSignificantGap,
      interpretation: gapAnalysis.interpretation,
      lastActivity: gapData.lastActivity
    },
    // Generate a text summary for the AI prompt
    promptContext: generateAdaptivePromptContext(feedback, adaptation, gapData, gapAnalysis)
  };
}

/**
 * Generate text context for AI workout generation prompt
 */
function generateAdaptivePromptContext(feedback, adaptation, gapData, gapAnalysis) {
  let context = "";
  let hasContent = false;

  // Training gap section (if significant)
  if (gapAnalysis && gapAnalysis.hasSignificantGap) {
    hasContent = true;
    context += `TRAINING GAP DETECTED:\n`;
    context += `- Days since last workout: ${gapData.daysSinceLastWorkout}\n`;
    if (gapData.lastActivity) {
      context += `- Last activity: ${gapData.lastActivity.type} on ${gapData.lastActivity.date.substring(0, 10)}\n`;
    }
    context += `- Status: ${gapAnalysis.interpretation.toUpperCase()}\n`;
    context += `- ${gapAnalysis.recommendation}\n`;
    gapAnalysis.reasoning.forEach(r => {
      context += `  - ${r}\n`;
    });
    context += `\n`;
  }

  // RPE/Feel feedback section
  if (feedback.summary.totalWithFeedback >= 3) {
    hasContent = true;
    context += `RECENT WORKOUT FEEDBACK (last 14 days, ${feedback.summary.totalWithFeedback} workouts with data):\n`;

    if (feedback.summary.avgFeel != null) {
      context += `- Average Feel: ${feedback.summary.avgFeel.toFixed(1)} (${getFeelLabel(feedback.summary.avgFeel)}) - scale: 1=Strong to 5=Weak\n`;
    }
    if (feedback.summary.avgRpe != null) {
      context += `- Average RPE: ${feedback.summary.avgRpe.toFixed(1)}/10\n`;
    }

    // Feel distribution (great=Strong, good=Good, okay=Normal, poor=Poor, bad=Weak)
    const fd = feedback.summary.feelDistribution;
    context += `- Feel distribution: ${fd.great} Strong, ${fd.good} Good, ${fd.okay} Normal, ${fd.poor} Poor, ${fd.bad} Weak\n`;
    context += `\n`;
  }

  if (!hasContent) {
    return "No recent workout feedback available (RPE/Feel not logged).";
  }

  // Combined adaptation recommendation
  context += `ADAPTIVE RECOMMENDATION: ${adaptation.recommendation.toUpperCase()}\n`;
  context += `- Confidence: ${adaptation.confidenceLevel}\n`;
  if (adaptation.intensityAdjustment !== 0) {
    context += `- Suggested intensity adjustment: ${adaptation.intensityAdjustment > 0 ? '+' : ''}${adaptation.intensityAdjustment}%\n`;
  }
  context += `- Reasoning:\n`;
  adaptation.reasoning.forEach(r => {
    context += `  - ${r}\n`;
  });

  return context;
}

// =========================================================
// TRAINING LOAD ADVISOR
// =========================================================

/**
 * Calculate training load recommendations based on current fitness and goals
 * AI-enhanced with wellness-aware recommendations, falls back to fixed thresholds
 * @param {object} fitnessMetrics - Current CTL, ATL, TSB, rampRate
 * @param {object} phaseInfo - Training phase info (weeksOut, phaseName)
 * @param {object} goals - Goal information
 * @param {object} wellness - Optional wellness data with averages
 * @returns {object} Training load advice
 */
function calculateTrainingLoadAdvice(fitnessMetrics, phaseInfo, goals, wellness) {
  const currentCTL = fitnessMetrics.ctl || 0;
  const currentATL = fitnessMetrics.atl || 0;
  const currentTSB = fitnessMetrics.tsb || 0;
  const currentRampRate = fitnessMetrics.rampRate || 0;
  const weeksOut = phaseInfo.weeksOut || 12;

  // Target CTL based on current fitness and time to goal
  let targetCTL = currentCTL;
  if (weeksOut > 3) {
    const maxGain = Math.min(weeksOut * 5, 40);
    targetCTL = currentCTL + Math.min(maxGain, currentCTL * 0.25);
    targetCTL = Math.max(targetCTL, currentCTL + 10);
  }

  // Base weekly TSS calculation
  const baseWeeklyTSS = Math.round(currentCTL * 7);

  // Try AI-driven advice first
  try {
    const aiAdvice = generateAITrainingLoadAdvice(fitnessMetrics, phaseInfo, goals, wellness);

    if (aiAdvice && aiAdvice.rampRateCategory && aiAdvice.personalizedAdvice) {
      Logger.log("AI Training Load Advice: " + JSON.stringify(aiAdvice));

      // Calculate TSS based on AI recommendation
      const tssMultiplier = aiAdvice.weeklyTSSMultiplier || 1.0;
      const recommendedWeeklyTSS = Math.round(baseWeeklyTSS * tssMultiplier);
      const tssMin = Math.round(recommendedWeeklyTSS * 0.9);
      const tssMax = Math.round(recommendedWeeklyTSS * 1.1);

      return {
        currentCTL: currentCTL,
        targetCTL: Math.round(targetCTL),
        weeksToGoal: weeksOut,
        recommendedWeeklyTSS: recommendedWeeklyTSS,
        tssRange: { min: tssMin, max: tssMax },
        dailyTSSRange: { min: Math.round(recommendedWeeklyTSS / 6), max: Math.round(recommendedWeeklyTSS / 5) },
        rampRateAdvice: aiAdvice.rampRateCategory,
        loadAdvice: aiAdvice.personalizedAdvice,
        warning: aiAdvice.warnings && aiAdvice.warnings.length > 0 ? aiAdvice.warnings.join(". ") : null,
        requiredWeeklyIncrease: aiAdvice.recommendedRampRate,
        aiEnhanced: true,
        aiConfidence: aiAdvice.confidence || 'medium'
      };
    }
  } catch (e) {
    Logger.log("AI training load advice failed, using fallback: " + e.toString());
  }

  // ===== FALLBACK: Fixed threshold logic =====
  Logger.log("Using fallback fixed-threshold training load advice");

  const ctlGapToTarget = targetCTL - currentCTL;
  const buildWeeks = Math.max(weeksOut - 2, 1);
  const requiredWeeklyIncrease = ctlGapToTarget / buildWeeks;

  const SAFE_RAMP_MIN = 3;
  const SAFE_RAMP_MAX = 5;
  const AGGRESSIVE_RAMP_MAX = 7;

  let recommendedWeeklyTSS;
  let rampRateAdvice;
  let loadAdvice;
  let warning = null;

  if (phaseInfo.phaseName.includes("Taper") || phaseInfo.phaseName.includes("Race Week")) {
    recommendedWeeklyTSS = Math.round(currentCTL * 7 * 0.5);
    rampRateAdvice = "Reduce";
    loadAdvice = "Fallback: Focus on freshness. Reduce volume by 40-50%.";
  } else if (phaseInfo.phaseName.includes("Peak")) {
    recommendedWeeklyTSS = Math.round(currentCTL * 7 * 0.7);
    rampRateAdvice = "Reduce";
    loadAdvice = "Fallback: Begin tapering. Reduce volume by 20-30%.";
  } else if (phaseInfo.phaseName.includes("Transition")) {
    recommendedWeeklyTSS = Math.round(currentCTL * 7 * 0.4);
    rampRateAdvice = "Recovery";
    loadAdvice = "Fallback: Off-season recovery.";
  } else {
    const targetWeeklyIncrease = Math.min(requiredWeeklyIncrease, SAFE_RAMP_MAX);
    const targetCTLThisWeek = currentCTL + targetWeeklyIncrease;
    recommendedWeeklyTSS = Math.round(targetCTLThisWeek * 7);

    if (requiredWeeklyIncrease <= SAFE_RAMP_MIN) {
      rampRateAdvice = "Maintain";
      loadAdvice = "Fallback: On track. Maintain current load.";
    } else if (requiredWeeklyIncrease <= SAFE_RAMP_MAX) {
      rampRateAdvice = "Build";
      loadAdvice = "Fallback: Good progression rate.";
    } else if (requiredWeeklyIncrease <= AGGRESSIVE_RAMP_MAX) {
      rampRateAdvice = "Aggressive";
      loadAdvice = "Fallback: Aggressive build needed.";
      warning = "High ramp rate - ensure adequate recovery.";
    } else {
      rampRateAdvice = "Caution";
      loadAdvice = "Fallback: Goal may be ambitious.";
      warning = "Required ramp rate exceeds safe limits.";
    }

    if (currentTSB < -25) {
      warning = "High fatigue detected (TSB: " + currentTSB.toFixed(0) + ").";
      recommendedWeeklyTSS = Math.round(currentCTL * 7 * 0.6);
      loadAdvice = "Fallback: Recovery week recommended.";
      rampRateAdvice = "Recover";
    }

    if (currentRampRate > AGGRESSIVE_RAMP_MAX) {
      warning = "Current ramp rate (" + currentRampRate.toFixed(1) + ") is high.";
    }
  }

  const tssMin = Math.round(recommendedWeeklyTSS * 0.9);
  const tssMax = Math.round(recommendedWeeklyTSS * 1.1);

  return {
    currentCTL: currentCTL,
    targetCTL: Math.round(targetCTL),
    weeksToGoal: weeksOut,
    recommendedWeeklyTSS: recommendedWeeklyTSS,
    tssRange: { min: tssMin, max: tssMax },
    dailyTSSRange: { min: Math.round(recommendedWeeklyTSS / 6), max: Math.round(recommendedWeeklyTSS / 5) },
    rampRateAdvice: rampRateAdvice,
    loadAdvice: loadAdvice,
    warning: warning,
    requiredWeeklyIncrease: Math.round(requiredWeeklyIncrease * 10) / 10,
    aiEnhanced: false
  };
}

// =========================================================
// WEEKLY ACTIVITIES
// =========================================================

/**
 * Fetch activities for a given period
 * @param {number} daysBack - How many days back to start
 * @param {number} daysOffset - Offset from today (default 0)
 * @returns {object} Aggregated activity data
 */
function fetchWeeklyActivities(daysBack, daysOffset) {
  daysOffset = daysOffset || 0;
  const today = new Date();
  const to = new Date(today);
  to.setDate(today.getDate() - daysOffset);
  const from = new Date(to);
  from.setDate(to.getDate() - daysBack + 1);

  const endpoint = `/athlete/0/activities?oldest=${formatDateISO(from)}&newest=${formatDateISO(to)}`;

  const result = {
    totalActivities: 0,
    rides: 0,
    runs: 0,
    totalTime: 0,
    totalTss: 0,
    totalDistance: 0,
    activities: []
  };

  const apiResult = fetchIcuApi(endpoint);

  if (!apiResult.success) {
    Logger.log("Error fetching weekly activities: " + apiResult.error);
    return result;
  }

  const activities = apiResult.data;
  if (!Array.isArray(activities)) {
    return result;
  }

  activities.forEach(function(a) {
    result.totalActivities++;
    result.totalTime += a.moving_time || 0;
    result.totalTss += a.icu_training_load || 0;
    result.totalDistance += a.distance || 0;

    if (isCyclingActivity(a)) {
      result.rides++;
    } else if (isRunningActivity(a)) {
      result.runs++;
    }

    result.activities.push({
      date: a.start_date_local,
      name: a.name,
      type: a.type,
      duration: a.moving_time,
      tss: a.icu_training_load,
      distance: a.distance
    });
  });

  return result;
}

// =========================================================
// WEEKLY PLAN PROGRESS & ADAPTATION
// =========================================================

/**
 * Check this week's progress: planned vs completed workouts
 * Useful for daily trigger to adapt based on execution so far
 * @returns {object} { plannedSessions, completedSessions, missedSessions, tssPlanned, tssCompleted, adherenceRate, summary }
 */
function checkWeekProgress() {
  const today = new Date();
  const dayOfWeek = today.getDay(); // 0 = Sunday
  const weekStart = new Date(today);
  weekStart.setDate(today.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1)); // Monday
  weekStart.setHours(0, 0, 0, 0);

  const startStr = formatDateISO(weekStart);
  const todayStr = formatDateISO(today);

  // Calculate week end (Sunday)
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);
  const weekEndStr = formatDateISO(weekEnd);

  const result = {
    plannedSessions: 0,        // Planned sessions for past days (for missed detection)
    totalPlannedSessions: 0,   // Total planned sessions for entire week
    completedSessions: 0,
    missedSessions: 0,
    extraSessions: 0,
    tssPlanned: 0,             // TSS planned for past days
    totalTssPlanned: 0,        // Total TSS planned for entire week
    tssCompleted: 0,
    adherenceRate: 100,
    completedTypes: [],
    missedTypes: [],
    missedWorkouts: [], // Detailed info about each missed workout
    dayByDay: [], // Day-by-day breakdown for the week so far
    summary: '',
    adaptationAdvice: '', // Guidance on how to adapt remaining week
    aheadLevel: null, // null, 'slightly_ahead', 'moderately_ahead', 'way_ahead'
    daysAnalyzed: dayOfWeek === 0 ? 6 : dayOfWeek - 1 // Days from Monday to yesterday (for planned vs completed analysis)
  };

  try {
    // Fetch events (planned workouts) for this week up to yesterday (for missed workout detection)
    const yesterdayDate = new Date(today);
    yesterdayDate.setDate(today.getDate() - 1);
    const yesterdayStr = formatDateISO(yesterdayDate);

    const eventsResult = fetchIcuApi("/athlete/0/events?oldest=" + startStr + "&newest=" + yesterdayStr);

    // Fetch ALL events for the entire week (Monday to Sunday) for total planned count
    const allWeekEventsResult = fetchIcuApi("/athlete/0/events?oldest=" + startStr + "&newest=" + weekEndStr);

    // Fetch activities for the ENTIRE week so far (including today) for total TSS count
    const activitiesResult = fetchIcuApi("/athlete/0/activities?oldest=" + startStr + "&newest=" + todayStr);

    // Calculate total planned sessions and TSS for the entire week
    // Include: Our workouts + all races (A/B/C events) that have planned TSS
    if (allWeekEventsResult.success && allWeekEventsResult.data) {
      const plannedWorkouts = allWeekEventsResult.data.filter(e => {
        // Our generated workouts or placeholders
        const isOurWorkout = e.category === 'WORKOUT' &&
          (e.description?.includes('[Weekly Plan]') || e.name?.match(/^(Ride|Run|IntervalCoach)/i));
        // Any race/event (A, B, C) - these all have planned TSS
        const isRaceEvent = e.category === 'RACE_A' || e.category === 'RACE_B' || e.category === 'RACE_C';
        return isOurWorkout || isRaceEvent;
      });
      result.totalPlannedSessions = plannedWorkouts.length;
      result.totalTssPlanned = plannedWorkouts.reduce((sum, e) => {
        const tssMatch = e.description?.match(/TSS.*?(\d+)/);
        return sum + (tssMatch ? parseInt(tssMatch[1]) : (e.icu_training_load || 60));
      }, 0);
    }

    // Calculate total completed TSS for the week (including today)
    if (activitiesResult.success && activitiesResult.data) {
      const weekActivities = activitiesResult.data.filter(a =>
        isSportActivity(a) && a.icu_training_load && a.icu_training_load > 0
      );
      result.tssCompleted = weekActivities.reduce((sum, a) => sum + (a.icu_training_load || 0), 0);
      result.completedSessions = weekActivities.length;
    }

    // Early return if it's Monday (no days to analyze for missed workouts)
    if (result.daysAnalyzed === 0) {
      result.summary = result.totalPlannedSessions > 0
        ? `${result.completedSessions}/${result.totalPlannedSessions} sessions | TSS: ${Math.round(result.tssCompleted)}/${result.totalTssPlanned}`
        : (result.completedSessions > 0
          ? `${result.completedSessions} session(s) completed | TSS: ${Math.round(result.tssCompleted)}`
          : "Starting fresh week");
      return result;
    }

    if (!eventsResult.success || !activitiesResult.success) {
      result.summary = "Unable to check week progress (API error)";
      return result;
    }

    // Build day-by-day analysis (Monday to yesterday)
    const dayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

    for (let i = 0; i < result.daysAnalyzed; i++) {
      const dayDate = new Date(weekStart);
      dayDate.setDate(weekStart.getDate() + i);
      const dayStr = formatDateISO(dayDate);
      const dayName = dayNames[i];

      // Find planned workout for this day
      const plannedEvent = (eventsResult.data || []).find(e =>
        e.start_date_local?.startsWith(dayStr) &&
        e.category === 'WORKOUT' &&
        (e.description?.includes('[Weekly Plan]') || e.name?.match(/^(Ride|Run|IntervalCoach)/i))
      );

      // Find completed activity for this day (only Ride/Run count as training)
      const completedActivity = (activitiesResult.data || []).find(a =>
        a.start_date_local?.startsWith(dayStr) &&
        isSportActivity(a) &&  // Only cycling/running, not walks
        a.icu_training_load && a.icu_training_load > 0 && a.moving_time > 300
      );

      const dayInfo = {
        date: dayStr,
        dayName: dayName,
        planned: null,
        completed: null,
        status: 'rest' // rest, completed, missed, extra
      };

      if (plannedEvent) {
        // Extract workout type and intensity from name/description
        const workoutName = plannedEvent.name || 'Workout';
        const workoutType = workoutName.split(' - ')[0];
        const tssMatch = plannedEvent.description?.match(/TSS.*?(\d+)/);
        const intensityMatch = plannedEvent.description?.match(/(Threshold|VO2max|Endurance|Sweet Spot|Tempo|Recovery|Long)/i);

        dayInfo.planned = {
          eventId: plannedEvent.id, // Store event ID for cleanup
          name: workoutName,
          type: workoutType,
          tss: tssMatch ? parseInt(tssMatch[1]) : 60,
          intensity: intensityMatch ? intensityMatch[1] : 'Mixed',
          description: plannedEvent.description
        };
        result.plannedSessions++;
        result.tssPlanned += dayInfo.planned.tss;
      }

      if (completedActivity) {
        dayInfo.completed = {
          type: completedActivity.type,
          tss: completedActivity.icu_training_load || 0,
          duration: Math.round((completedActivity.moving_time || 0) / 60),
          name: completedActivity.name
        };
        // Note: completedSessions and tssCompleted are calculated earlier for the entire week (including today)
        // Here we just track the day-by-day breakdown for missed/extra detection
        result.completedTypes.push(completedActivity.type);
      }

      // Determine status and track matched sessions
      if (dayInfo.planned && dayInfo.completed) {
        dayInfo.status = 'completed';
        result.matchedSessions = (result.matchedSessions || 0) + 1;
      } else if (dayInfo.planned && !dayInfo.completed) {
        dayInfo.status = 'missed';
        result.missedSessions++;
        result.missedTypes.push(dayInfo.planned.type);
        result.missedWorkouts.push({
          eventId: dayInfo.planned.eventId, // For cleanup
          day: dayName,
          date: dayStr,
          workoutType: dayInfo.planned.type,
          intensity: dayInfo.planned.intensity,
          tss: dayInfo.planned.tss,
          description: dayInfo.planned.name
        });
      } else if (!dayInfo.planned && dayInfo.completed) {
        dayInfo.status = 'extra';
      }

      result.dayByDay.push(dayInfo);
    }

    // Calculate extra sessions: activities not matching a planned day
    result.extraSessions = result.completedSessions - (result.matchedSessions || 0);

    // Calculate adherence (based on planned sessions vs matched)
    if (result.plannedSessions > 0) {
      result.adherenceRate = Math.round(((result.matchedSessions || 0) / result.plannedSessions) * 100);
    }

    // Build summary using total week planned (not just past days)
    const weekSummary = result.totalPlannedSessions > 0
      ? `${result.completedSessions}/${result.totalPlannedSessions} sessions | TSS: ${Math.round(result.tssCompleted)}/${result.totalTssPlanned}`
      : `${result.completedSessions} sessions | TSS: ${Math.round(result.tssCompleted)}`;

    if (result.missedSessions > 0) {
      const missedDays = result.missedWorkouts.map(m => m.day).join(', ');
      result.summary = `Behind plan (missed: ${missedDays}). ${weekSummary}`;

      // Build adaptation advice based on what was missed
      result.adaptationAdvice = buildAdaptationAdvice(result.missedWorkouts, result.tssPlanned - result.tssCompleted);
    } else if (result.extraSessions > 0) {
      // Determine how far ahead: slightly, moderately, or way ahead
      const tssRatio = result.totalTssPlanned > 0 ? result.tssCompleted / result.totalTssPlanned : 1;

      if (result.extraSessions >= 3 || tssRatio > 1.5) {
        // Way ahead: 3+ extra sessions OR >150% TSS
        result.aheadLevel = 'way_ahead';
        result.summary = `Way ahead of plan (${result.extraSessions} extra). ${weekSummary}`;
        result.adaptationAdvice = 'Significantly ahead of plan. Consider a recovery day or very easy session to avoid overtraining.';
      } else if (result.extraSessions >= 2 || tssRatio > 1.3) {
        // Moderately ahead: 2 extra OR 130-150% TSS
        result.aheadLevel = 'moderately_ahead';
        result.summary = `Moderately ahead (${result.extraSessions} extra). ${weekSummary}`;
        result.adaptationAdvice = 'Ahead of plan. Consider slightly easier intensity for remaining workouts.';
      } else {
        // Slightly ahead: 1 extra AND <130% TSS - continue as planned
        result.aheadLevel = 'slightly_ahead';
        result.summary = `Slightly ahead (${result.extraSessions} extra). ${weekSummary}`;
        result.adaptationAdvice = 'Slightly ahead but within normal range. Continue with planned workouts.';
      }
    } else if (result.totalPlannedSessions === 0) {
      result.summary = weekSummary;
    } else {
      result.summary = `On track. ${weekSummary}`;
      result.adaptationAdvice = 'Stick with the planned workouts for the remainder of the week.';
    }

  } catch (e) {
    Logger.log("Error checking week progress: " + e.toString());
    result.summary = "Unable to check week progress";
  }

  return result;
}

/**
 * Build adaptation advice based on missed workouts
 * Prioritizes key intensity sessions and provides specific guidance
 * @param {Array} missedWorkouts - Array of missed workout details
 * @param {number} tssDelta - TSS behind plan
 * @returns {string} Advice for adapting remaining week
 */
function buildAdaptationAdvice(missedWorkouts, tssDelta) {
  if (!missedWorkouts || missedWorkouts.length === 0) {
    return '';
  }

  const advice = [];
  const priorityIntensities = ['VO2max', 'Threshold', 'Sweet Spot'];
  const lowPriorityIntensities = ['Endurance', 'Recovery', 'Long'];

  // Find high-priority missed sessions
  const missedHighPriority = missedWorkouts.filter(m =>
    priorityIntensities.some(p => m.intensity?.toLowerCase().includes(p.toLowerCase()))
  );

  const missedLowPriority = missedWorkouts.filter(m =>
    lowPriorityIntensities.some(p => m.intensity?.toLowerCase().includes(p.toLowerCase()))
  );

  if (missedHighPriority.length > 0) {
    const types = [...new Set(missedHighPriority.map(m => m.intensity))].join(', ');
    advice.push(`PRIORITY: Missed key intensity session(s): ${types}. If recovery allows, try to include this stimulus in today's workout or later this week.`);
  }

  if (missedLowPriority.length > 0 && missedHighPriority.length === 0) {
    advice.push('Missed endurance/recovery session. This is less critical - focus on remaining quality sessions.');
  }

  // TSS guidance
  if (tssDelta > 100) {
    advice.push(`Significant TSS deficit (${tssDelta}). Consider slightly longer or more intense remaining workouts if feeling fresh.`);
  } else if (tssDelta > 0 && tssDelta <= 100) {
    advice.push(`Minor TSS deficit (${tssDelta}). Can be recovered with normal remaining workouts.`);
  }

  // General guidance
  if (missedWorkouts.length >= 2) {
    advice.push('Multiple sessions missed. Prioritize quality over volume for remaining days.');
  }

  return advice.join(' ');
}

/**
 * Clean up missed placeholders from past days
 * Removes workout events from days where the workout was not completed
 * @param {object} weekProgress - Week progress data from checkWeekProgress()
 * @returns {object} { cleaned: number, errors: string[] }
 */
function cleanupMissedPlaceholders(weekProgress) {
  const result = { cleaned: 0, errors: [] };

  if (!weekProgress?.missedWorkouts?.length) {
    return result;
  }

  for (const missed of weekProgress.missedWorkouts) {
    if (!missed.eventId) {
      result.errors.push(`No event ID for ${missed.day}`);
      continue;
    }

    try {
      // deleteIntervalEvent expects object with id property
      const deleted = deleteIntervalEvent({ id: missed.eventId });
      if (deleted) {
        Logger.log(`Cleaned up missed placeholder: ${missed.day} (${missed.workoutType})`);
        result.cleaned++;
      } else {
        result.errors.push(`Failed to delete ${missed.day}`);
      }
    } catch (e) {
      result.errors.push(`Error deleting ${missed.day}: ${e.toString()}`);
    }
  }

  if (result.cleaned > 0) {
    Logger.log(`Cleaned up ${result.cleaned} missed placeholder(s) from past days`);
  }

  return result;
}

// NOTE: checkWeeklyPlanAdaptation() has been removed and unified into
// checkMidWeekAdaptationNeeded() in workouts_planning.gs which handles
// both missed sessions AND fatigue-based triggers, and actually applies changes.

// =========================================================
// PLANNED DELOAD DETECTION
// =========================================================

/**
 * Check if a deload/recovery week is needed based on recent training patterns
 * Analyzes last 4 weeks of training to detect:
 * - Sustained high load without recovery
 * - Accumulated fatigue indicators
 * - Missing deload pattern in training cycle
 *
 * @param {object} fitnessMetrics - Current CTL/ATL/TSB from fetchFitnessMetrics()
 * @returns {object} { needed: boolean, urgency: 'low'|'medium'|'high', reason: string, weeklyBreakdown: [], recommendation: string }
 */
function checkDeloadNeeded(fitnessMetrics, wellness) {
  const result = {
    needed: false,
    urgency: 'low',
    reason: '',
    weeklyBreakdown: [],
    weeksWithoutDeload: 0,
    recommendation: '',
    suggestedDeloadTSS: null,
    sleepDebt: null  // Track sleep debt for display
  };

  // Support both field naming conventions (ctl vs ctl_90, tsb vs tsb_current)
  const currentCTL = fitnessMetrics?.ctl || fitnessMetrics?.ctl_90 || 0;
  const currentTSB = fitnessMetrics?.tsb || fitnessMetrics?.tsb_current || 0;
  const currentRampRate = fitnessMetrics?.rampRate || 0;

  // Fetch last 4 weeks of activities
  const weeklyData = [];
  for (let week = 0; week < 4; week++) {
    const weekActivities = fetchWeeklyActivities(7, week * 7);
    weeklyData.push({
      weekNumber: 4 - week, // Week 4 = oldest, Week 1 = most recent
      totalTSS: weekActivities.totalTss,
      totalTime: weekActivities.totalTime,
      activities: weekActivities.totalActivities,
      avgDailyTSS: Math.round(weekActivities.totalTss / 7)
    });
  }

  // Reverse so oldest is first
  weeklyData.reverse();
  result.weeklyBreakdown = weeklyData;

  // Calculate average weekly TSS
  const avgWeeklyTSS = weeklyData.reduce((sum, w) => sum + w.totalTSS, 0) / 4;
  const targetWeeklyTSS = currentCTL * 7; // Expected TSS to maintain current CTL

  // Use the higher of: target TSS or minimum 100 TSS as "real training" threshold
  // This prevents low CTL athletes from triggering false "sustained load" warnings
  const minTrainingTSS = Math.max(targetWeeklyTSS, 100);

  // Deload threshold: 70% of target or 70 TSS minimum
  const deloadThreshold = Math.max(minTrainingTSS * 0.70, 70);

  // Count consecutive weeks of actual high load (TSS > target)
  // Only weeks above target count as "sustained load"
  let consecutiveHighWeeks = 0;
  let hadRecentDeload = false;

  for (let i = weeklyData.length - 1; i >= 0; i--) {
    const week = weeklyData[i];
    // A week is "recovery" if below deload threshold
    if (week.totalTSS < deloadThreshold) {
      hadRecentDeload = true;
      result.weeksWithoutDeload = consecutiveHighWeeks;
      break;
    } else if (week.totalTSS >= minTrainingTSS) {
      // Only count as "high load" if actually above target
      consecutiveHighWeeks++;
    }
    // Weeks between deload threshold and target don't count as "sustained load"
  }

  if (!hadRecentDeload) {
    result.weeksWithoutDeload = consecutiveHighWeeks;
  }

  // Analyze weekly TSS pattern
  const reasons = [];
  let urgencyScore = 0;

  // Trigger 1: 4+ weeks without deload
  if (result.weeksWithoutDeload >= 4) {
    reasons.push(`${result.weeksWithoutDeload} consecutive weeks without recovery week`);
    urgencyScore += 3;
  } else if (result.weeksWithoutDeload >= 3) {
    reasons.push(`${result.weeksWithoutDeload} consecutive weeks of sustained load`);
    urgencyScore += 2;
  }

  // Trigger 2: High sustained ramp rate
  if (currentRampRate > 5) {
    reasons.push(`High ramp rate (${currentRampRate.toFixed(1)} CTL/week) sustained`);
    urgencyScore += 2;
  } else if (currentRampRate > 3) {
    reasons.push(`Elevated ramp rate (${currentRampRate.toFixed(1)} CTL/week)`);
    urgencyScore += 1;
  }

  // Trigger 3: Deep negative TSB (accumulated fatigue)
  if (currentTSB < -30) {
    reasons.push(`High fatigue (TSB: ${currentTSB.toFixed(0)})`);
    urgencyScore += 3;
  } else if (currentTSB < -20) {
    reasons.push(`Moderate fatigue accumulation (TSB: ${currentTSB.toFixed(0)})`);
    urgencyScore += 1;
  }

  // Trigger 4: Consistently above target TSS (overreaching pattern)
  const weeksAboveTarget = weeklyData.filter(w => w.totalTSS > targetWeeklyTSS * 1.1).length;
  if (weeksAboveTarget >= 3) {
    reasons.push(`${weeksAboveTarget}/4 weeks above target load`);
    urgencyScore += 2;
  }

  // Trigger 5: Accumulated sleep debt (from Whoop)
  const sleepDebtHours = wellness?.today?.sleepDebtHours;
  if (sleepDebtHours != null) {
    result.sleepDebt = sleepDebtHours;

    if (sleepDebtHours >= 5) {
      reasons.push(`Severe sleep debt (${sleepDebtHours.toFixed(1)}h accumulated)`);
      urgencyScore += 3;  // Major recovery concern
    } else if (sleepDebtHours >= 3) {
      reasons.push(`Significant sleep debt (${sleepDebtHours.toFixed(1)}h accumulated)`);
      urgencyScore += 2;
    } else if (sleepDebtHours >= 1.5) {
      reasons.push(`Moderate sleep debt (${sleepDebtHours.toFixed(1)}h accumulated)`);
      urgencyScore += 1;
    }
  }

  // Determine if deload is needed
  if (urgencyScore >= 4) {
    result.needed = true;
    result.urgency = 'high';
  } else if (urgencyScore >= 2 && result.weeksWithoutDeload >= 3) {
    result.needed = true;
    result.urgency = 'medium';
  } else if (urgencyScore >= 1 && result.weeksWithoutDeload >= 4) {
    result.needed = true;
    result.urgency = 'low';
  }

  result.reason = reasons.join('; ');

  // Generate recommendation
  if (result.needed) {
    const deloadTSS = Math.round(avgWeeklyTSS * 0.5);
    result.suggestedDeloadTSS = deloadTSS;

    if (result.urgency === 'high') {
      result.recommendation = `Deload strongly recommended. Reduce to ${deloadTSS} TSS this week (50% of normal). Focus on recovery and easy spinning only.`;
    } else if (result.urgency === 'medium') {
      result.recommendation = `Consider scheduling a deload week soon. Target ${deloadTSS}-${Math.round(avgWeeklyTSS * 0.6)} TSS with reduced intensity.`;
    } else {
      result.recommendation = `A recovery week in the next 1-2 weeks would help consolidate fitness gains. Plan for ${Math.round(avgWeeklyTSS * 0.6)}-${Math.round(avgWeeklyTSS * 0.7)} TSS.`;
    }
  } else if (result.weeksWithoutDeload >= 2) {
    result.recommendation = `Training pattern is sustainable. Consider a deload in ${4 - result.weeksWithoutDeload} week(s) to optimize adaptation.`;
  }

  return result;
}

/**
 * Format deload check results for logging
 * @param {object} deloadCheck - Result from checkDeloadNeeded()
 * @returns {string} Formatted log string
 */
function formatDeloadCheckLog(deloadCheck) {
  let log = '\n=== DELOAD CHECK ===\n';
  log += `Deload Needed: ${deloadCheck.needed ? 'YES (' + deloadCheck.urgency.toUpperCase() + ')' : 'No'}\n`;
  log += `Weeks Without Recovery: ${deloadCheck.weeksWithoutDeload}\n`;

  if (deloadCheck.reason) {
    log += `Reasons: ${deloadCheck.reason}\n`;
  }

  log += '\nWeekly TSS Breakdown:\n';
  deloadCheck.weeklyBreakdown.forEach((week, i) => {
    const marker = (i === deloadCheck.weeklyBreakdown.length - 1) ? ' <- This week' : '';
    log += `  Week ${week.weekNumber}: ${week.totalTSS} TSS (${week.activities} activities)${marker}\n`;
  });

  if (deloadCheck.recommendation) {
    log += `\nRecommendation: ${deloadCheck.recommendation}\n`;
  }

  return log;
}

// =========================================================
// VOLUME JUMP DETECTION
// =========================================================

/**
 * Check for volume jump between calendar weeks
 * Compares last complete week (prev Mon-Sun) vs week before that
 * Flags week-to-week TSS increases >15% as injury risk
 *
 * @returns {object} { detected, percentChange, thisWeekTSS, lastWeekTSS, risk, recommendation }
 */
function checkVolumeJump() {
  const result = {
    detected: false,
    percentChange: 0,
    thisWeekTSS: 0,
    lastWeekTSS: 0,
    risk: 'none',  // none, low, medium, high
    recommendation: null
  };

  try {
    // Calculate calendar week boundaries
    const today = new Date();
    const dayOfWeek = today.getDay(); // 0 = Sunday

    // Find the most recent Monday (start of current week)
    const currentWeekStart = new Date(today);
    currentWeekStart.setDate(today.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
    currentWeekStart.setHours(0, 0, 0, 0);

    // Previous week: Monday to Sunday before current week
    const prevWeekEnd = new Date(currentWeekStart);
    prevWeekEnd.setDate(currentWeekStart.getDate() - 1); // Sunday
    const prevWeekStart = new Date(prevWeekEnd);
    prevWeekStart.setDate(prevWeekEnd.getDate() - 6); // Monday

    // Week before that
    const olderWeekEnd = new Date(prevWeekStart);
    olderWeekEnd.setDate(prevWeekStart.getDate() - 1); // Sunday before
    const olderWeekStart = new Date(olderWeekEnd);
    olderWeekStart.setDate(olderWeekEnd.getDate() - 6); // Monday before

    // Fetch activities for both complete weeks
    const prevWeekResult = fetchIcuApi(`/athlete/0/activities?oldest=${formatDateISO(prevWeekStart)}&newest=${formatDateISO(prevWeekEnd)}`);
    const olderWeekResult = fetchIcuApi(`/athlete/0/activities?oldest=${formatDateISO(olderWeekStart)}&newest=${formatDateISO(olderWeekEnd)}`);

    if (!prevWeekResult.success || !olderWeekResult.success) {
      return result;
    }

    // Sum TSS for each week
    const prevWeekActivities = prevWeekResult.data || [];
    const olderWeekActivities = olderWeekResult.data || [];

    result.thisWeekTSS = Math.round(prevWeekActivities.reduce((sum, a) => sum + (a.icu_training_load || 0), 0));
    result.lastWeekTSS = Math.round(olderWeekActivities.reduce((sum, a) => sum + (a.icu_training_load || 0), 0));

    // Calculate percentage change
    if (result.lastWeekTSS > 0) {
      result.percentChange = Math.round(((result.thisWeekTSS - result.lastWeekTSS) / result.lastWeekTSS) * 100);
    } else if (result.thisWeekTSS > 0) {
      // Last week was 0, any TSS is technically infinite increase
      result.percentChange = 100;
    }

    // Determine risk level based on % increase
    if (result.percentChange > 30) {
      result.detected = true;
      result.risk = 'high';
      result.recommendation = `Volume jumped ${result.percentChange}% (${result.lastWeekTSS} → ${result.thisWeekTSS} TSS). High injury risk! Consider reducing intensity or spreading load over more days.`;
    } else if (result.percentChange > 20) {
      result.detected = true;
      result.risk = 'medium';
      result.recommendation = `Volume increased ${result.percentChange}% week-over-week. Monitor fatigue closely and prioritize recovery.`;
    } else if (result.percentChange > 15) {
      result.detected = true;
      result.risk = 'low';
      result.recommendation = `Volume up ${result.percentChange}% from last week. Within acceptable range but stay attentive to recovery signals.`;
    }

    // Also check for sudden drops (could indicate illness/fatigue)
    if (result.percentChange < -30 && result.lastWeekTSS > 100) {
      result.detected = true;
      result.risk = 'check';
      result.recommendation = `Volume dropped ${Math.abs(result.percentChange)}% from last week. If unplanned, check for illness or accumulated fatigue.`;
    }

  } catch (e) {
    Logger.log('Volume jump detection error: ' + e.toString());
  }

  return result;
}

// =========================================================
// RAMP RATE WARNING
// =========================================================

/**
 * Check for sustained high ramp rate over multiple weeks
 * Warns when CTL ramp rate exceeds safe thresholds for 2+ consecutive weeks
 *
 * Safe thresholds:
 * - Normal: 0-5 CTL/week (sustainable long-term)
 * - Elevated: 5-7 CTL/week (OK for 1-2 weeks, then needs recovery)
 * - High: >7 CTL/week (injury risk, only sustainable very short term)
 *
 * @param {object} currentFitness - Current fitness metrics with rampRate
 * @returns {object} { warning, level, consecutiveWeeks, weeklyRates, recommendation }
 */
function checkRampRateWarning(currentFitness) {
  const result = {
    warning: false,
    level: 'none',  // none, caution, warning, critical
    consecutiveWeeks: 0,
    currentRate: currentFitness?.rampRate || 0,
    weeklyRates: [],
    avgRate: 0,
    recommendation: null
  };

  try {
    // Get weekly CTL values for the last 4 weeks to calculate per-week ramp rates
    const weeklyRates = [];

    for (let week = 0; week < 4; week++) {
      const daysAgo = week * 7;
      const weekEndDate = new Date();
      weekEndDate.setDate(weekEndDate.getDate() - daysAgo);
      const weekStartDate = new Date();
      weekStartDate.setDate(weekStartDate.getDate() - daysAgo - 7);

      // Fetch CTL at end and start of each week
      const endStr = formatDateISO(weekEndDate);
      const startStr = formatDateISO(weekStartDate);

      const endResult = fetchIcuApi("/athlete/0/wellness/" + endStr);
      const startResult = fetchIcuApi("/athlete/0/wellness/" + startStr);

      if (endResult.success && startResult.success && endResult.data && startResult.data) {
        const endCTL = endResult.data.ctl || 0;
        const startCTL = startResult.data.ctl || 0;
        const weeklyRate = endCTL - startCTL;

        weeklyRates.push({
          week: week,
          label: week === 0 ? 'This week' : week === 1 ? 'Last week' : `${week} weeks ago`,
          startCTL: Math.round(startCTL * 10) / 10,
          endCTL: Math.round(endCTL * 10) / 10,
          rate: Math.round(weeklyRate * 10) / 10
        });
      }
    }

    result.weeklyRates = weeklyRates;

    // Calculate average rate
    if (weeklyRates.length > 0) {
      result.avgRate = Math.round((weeklyRates.reduce((sum, w) => sum + w.rate, 0) / weeklyRates.length) * 10) / 10;
    }

    // Count consecutive weeks of high ramp rate (>5 CTL/week)
    let consecutiveHigh = 0;
    let consecutiveElevated = 0;

    for (let i = 0; i < weeklyRates.length; i++) {
      const rate = weeklyRates[i].rate;

      if (rate > 7) {
        consecutiveHigh++;
        consecutiveElevated++;
      } else if (rate > 5) {
        consecutiveHigh = 0; // Reset high counter
        consecutiveElevated++;
      } else {
        break; // Stop counting when we hit a normal week
      }
    }

    result.consecutiveWeeks = Math.max(consecutiveHigh, consecutiveElevated);

    // Determine warning level
    if (consecutiveHigh >= 2) {
      // 2+ weeks at >7 CTL/week = critical
      result.warning = true;
      result.level = 'critical';
      result.recommendation = `CRITICAL: Ramp rate has been very high (>${7} CTL/week) for ${consecutiveHigh} consecutive weeks. High overtraining and injury risk. Schedule a recovery week immediately.`;
    } else if (consecutiveHigh >= 1 && consecutiveElevated >= 2) {
      // 1 week high + 1 week elevated = warning
      result.warning = true;
      result.level = 'warning';
      result.recommendation = `WARNING: Sustained high ramp rate for ${consecutiveElevated} weeks (avg ${result.avgRate} CTL/week). Consider reducing load or adding extra recovery days.`;
    } else if (consecutiveElevated >= 3) {
      // 3+ weeks at >5 CTL/week = warning
      result.warning = true;
      result.level = 'warning';
      result.recommendation = `Elevated ramp rate (${result.avgRate} CTL/week avg) for ${consecutiveElevated} weeks. Plan a recovery week soon to consolidate gains.`;
    } else if (consecutiveElevated >= 2) {
      // 2 weeks at >5 CTL/week = caution
      result.warning = true;
      result.level = 'caution';
      result.recommendation = `Ramp rate has been elevated (>${5} CTL/week) for 2 weeks. Monitor fatigue closely and ensure adequate recovery.`;
    } else if (weeklyRates.length > 0 && weeklyRates[0].rate > 7) {
      // Current week very high but not sustained yet
      result.warning = true;
      result.level = 'caution';
      result.recommendation = `This week's ramp rate (${weeklyRates[0].rate} CTL/week) is very high. If this continues, recovery will be needed soon.`;
    }

  } catch (e) {
    Logger.log('Ramp rate warning check error: ' + e.toString());
  }

  return result;
}

// =========================================================
// FTP TEST SUGGESTION
// =========================================================

/**
 * Check if FTP test (ramp test) should be suggested
 * Conditions:
 * - eFTP hasn't been updated in 28+ days
 * - TSB is positive (athlete is fresh)
 * - Recovery is not red
 * - Not in taper phase (within 2 weeks of A race)
 *
 * @param {object} fitnessMetrics - Current fitness (TSB, CTL, etc)
 * @param {object} wellness - Current wellness data
 * @param {object} phaseInfo - Current training phase
 * @returns {object} { suggest: boolean, reason: string, daysSinceUpdate: number }
 */
function checkFtpTestSuggestion(fitnessMetrics, wellness, phaseInfo) {
  const result = {
    suggest: false,
    reason: null,
    daysSinceUpdate: null,
    currentEftp: null,
    blockers: []
  };

  try {
    // Get the last eFTP update date from fitness-model-events
    const eventsResult = fetchIcuApi("/athlete/0/fitness-model-events");

    if (!eventsResult.success) {
      result.blockers.push("Could not fetch eFTP history");
      return result;
    }

    const events = eventsResult.data;

    // Find most recent SET_EFTP event
    const eftpEvents = events
      .filter(function(e) { return e.category === "SET_EFTP"; })
      .sort(function(a, b) { return b.start_date.localeCompare(a.start_date); });

    if (eftpEvents.length === 0) {
      // No eFTP history - definitely suggest a test
      result.suggest = true;
      result.reason = "No FTP test on record. A ramp test will establish your training zones.";
      result.daysSinceUpdate = 999;
      return result;
    }

    const lastUpdate = eftpEvents[0];
    result.currentEftp = lastUpdate.value;

    // Calculate days since last update
    const lastUpdateDate = new Date(lastUpdate.start_date);
    const today = new Date();
    const daysSince = Math.floor((today - lastUpdateDate) / (1000 * 60 * 60 * 24));
    result.daysSinceUpdate = daysSince;

    // Check if it's been long enough (28+ days)
    if (daysSince < 28) {
      result.blockers.push(`eFTP updated ${daysSince} days ago (need 28+)`);
      return result;
    }

    // Check TSB - need to be fresh (TSB > 0)
    const tsb = fitnessMetrics?.tsb || fitnessMetrics?.tsb_current || 0;
    if (tsb < 0) {
      result.blockers.push(`TSB is ${tsb.toFixed(0)} (need positive for accurate test)`);
      return result;
    }

    // Check recovery status - not red
    const recoveryStatus = wellness?.recoveryStatus;
    if (recoveryStatus === 'red' || recoveryStatus === 'strained') {
      result.blockers.push(`Recovery is ${recoveryStatus} (need better recovery for accurate test)`);
      return result;
    }

    // Check phase - not in taper (within 2 weeks of race)
    if (phaseInfo?.weeksOut && phaseInfo.weeksOut <= 2) {
      result.blockers.push(`In taper phase (${phaseInfo.weeksOut} weeks to race)`);
      return result;
    }

    // All conditions met - suggest the test
    result.suggest = true;
    result.reason = `eFTP hasn't been tested in ${daysSince} days. You're fresh (TSB +${tsb.toFixed(0)}) - perfect time for a ramp test to recalibrate your zones.`;

  } catch (e) {
    Logger.log('FTP test suggestion check error: ' + e.toString());
    result.blockers.push("Error checking FTP history");
  }

  return result;
}
