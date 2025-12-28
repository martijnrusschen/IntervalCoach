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

  const result = {
    plannedSessions: 0,
    completedSessions: 0,
    missedSessions: 0,
    extraSessions: 0,
    tssPlanned: 0,
    tssCompleted: 0,
    adherenceRate: 100,
    completedTypes: [],
    missedTypes: [],
    missedWorkouts: [], // Detailed info about each missed workout
    dayByDay: [], // Day-by-day breakdown for the week so far
    summary: '',
    adaptationAdvice: '', // Guidance on how to adapt remaining week
    daysAnalyzed: dayOfWeek === 0 ? 6 : dayOfWeek - 1 // Days from Monday to yesterday
  };

  // Only analyze if we're past Monday
  if (result.daysAnalyzed === 0) {
    result.summary = "It's Monday - starting fresh week";
    return result;
  }

  try {
    // Fetch events (planned workouts) for this week up to yesterday
    const yesterdayDate = new Date(today);
    yesterdayDate.setDate(today.getDate() - 1);
    const yesterdayStr = formatDateISO(yesterdayDate);

    const eventsResult = fetchIcuApi("/athlete/0/events?oldest=" + startStr + "&newest=" + yesterdayStr);

    // Fetch activities (completed workouts) for same period
    const activitiesResult = fetchIcuApi("/athlete/0/activities?oldest=" + startStr + "&newest=" + yesterdayStr);

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
        (e.description?.includes('[Weekly Plan]') || e.name?.match(/^(Ride|Run)/i))
      );

      // Find completed activity for this day
      const completedActivity = (activitiesResult.data || []).find(a =>
        a.start_date_local?.startsWith(dayStr) &&
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
        result.completedSessions++;
        result.tssCompleted += dayInfo.completed.tss;
        result.completedTypes.push(completedActivity.type);
      }

      // Determine status
      if (dayInfo.planned && dayInfo.completed) {
        dayInfo.status = 'completed';
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
        result.extraSessions++;
      }

      result.dayByDay.push(dayInfo);
    }

    // Calculate adherence
    if (result.plannedSessions > 0) {
      result.adherenceRate = Math.round((result.completedSessions / result.plannedSessions) * 100);
    }

    // Build summary
    if (result.missedSessions > 0) {
      const missedDays = result.missedWorkouts.map(m => m.day).join(', ');
      result.summary = `Behind plan: ${result.completedSessions}/${result.plannedSessions} sessions (missed: ${missedDays}). TSS: ${result.tssCompleted}/${result.tssPlanned}`;

      // Build adaptation advice based on what was missed
      result.adaptationAdvice = buildAdaptationAdvice(result.missedWorkouts, result.tssPlanned - result.tssCompleted);
    } else if (result.extraSessions > 0) {
      result.summary = `Ahead of plan: ${result.completedSessions} completed (${result.extraSessions} extra). TSS: ${result.tssCompleted} (planned: ${result.tssPlanned})`;
      result.adaptationAdvice = 'Consider easier remaining workouts to avoid overtraining this week.';
    } else if (result.plannedSessions === 0) {
      result.summary = `No workouts planned so far. Completed ${result.completedSessions} sessions (TSS: ${result.tssCompleted})`;
    } else {
      result.summary = `On track: ${result.completedSessions}/${result.plannedSessions} sessions. TSS: ${result.tssCompleted}/${result.tssPlanned}`;
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
function checkDeloadNeeded(fitnessMetrics) {
  const result = {
    needed: false,
    urgency: 'low',
    reason: '',
    weeklyBreakdown: [],
    weeksWithoutDeload: 0,
    recommendation: '',
    suggestedDeloadTSS: null
  };

  const currentCTL = fitnessMetrics?.ctl || 0;
  const currentTSB = fitnessMetrics?.tsb || 0;
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

  // Deload threshold: 70% of average = recovery week
  const deloadThreshold = avgWeeklyTSS * 0.70;

  // Count consecutive weeks without deload (TSS > 70% of average)
  let consecutiveHighWeeks = 0;
  let hadRecentDeload = false;

  for (let i = weeklyData.length - 1; i >= 0; i--) {
    const week = weeklyData[i];
    if (week.totalTSS < deloadThreshold && week.totalTSS > 0) {
      hadRecentDeload = true;
      result.weeksWithoutDeload = consecutiveHighWeeks;
      break;
    } else if (week.totalTSS > 0) {
      consecutiveHighWeeks++;
    }
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
 * Check for volume jump between weeks
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
    // Fetch this week's and last week's activities
    const thisWeek = fetchWeeklyActivities(7);
    const lastWeek = fetchWeeklyActivities(7, 7);

    result.thisWeekTSS = Math.round(thisWeek.totalTss);
    result.lastWeekTSS = Math.round(lastWeek.totalTss);

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
