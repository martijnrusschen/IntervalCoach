/**
 * IntervalCoach - Utility Functions
 *
 * Helper functions for formatting, calculations, and common operations
 */

// =========================================================
// FORMATTING UTILITIES
// =========================================================

/**
 * Format a Date object as ISO date string (yyyy-MM-dd)
 * @param {Date} date - Date to format
 * @returns {string} Formatted date string
 */
function formatDateISO(date) {
  return Utilities.formatDate(date, SYSTEM_SETTINGS.TIMEZONE, "yyyy-MM-dd");
}

/**
 * Format duration in seconds to human readable string
 * @param {number} seconds - Duration in seconds
 * @param {boolean} showSign - Whether to show +/- sign for differences
 * @returns {string} Formatted duration (e.g., "1h 23m" or "+45m")
 */
function formatDuration(seconds, showSign) {
  if (seconds == null) return "0m";

  const sign = showSign ? (seconds >= 0 ? "+" : "-") : "";
  const absSeconds = Math.abs(seconds);

  if (absSeconds < 60) return sign + "0m";

  const hours = Math.floor(absSeconds / 3600);
  const minutes = Math.floor((absSeconds % 3600) / 60);

  if (hours > 0) {
    return sign + hours + "h " + minutes + "m";
  }
  return sign + minutes + "m";
}

/**
 * Format a number change with + or - prefix
 * Supports two calling patterns:
 *   formatChange(changeValue, decimals) - formats pre-calculated change
 *   formatChange(current, previous, decimals, unit) - calculates and formats change
 * @param {number} currentOrChange - Current value or pre-calculated change
 * @param {number} prevOrDecimals - Previous value or decimals
 * @param {number} decimals - Number of decimal places (default 1)
 * @param {string} unit - Optional unit suffix (e.g., 'W', '%', 'h')
 * @returns {string} Formatted change (e.g., "+5.2" or "-3.1W")
 */
function formatChange(currentOrChange, prevOrDecimals, decimals, unit) {
  // Detect calling pattern: if 3rd arg exists, it's (current, prev, decimals, unit)
  if (decimals !== undefined) {
    // Pattern: formatChange(current, previous, decimals, unit)
    const current = currentOrChange;
    const previous = prevOrDecimals;
    if (current == null || previous == null) return '';
    const change = current - previous;
    const dec = typeof decimals === 'number' ? decimals : 1;
    const sign = change >= 0 ? "+" : "";
    const suffix = unit ? unit : '';
    return ` (${sign}${change.toFixed(dec)}${suffix})`;
  } else {
    // Pattern: formatChange(changeValue, decimals)
    const value = currentOrChange;
    if (value == null) return '';
    const dec = typeof prevOrDecimals === 'number' && prevOrDecimals !== false ? prevOrDecimals : 1;
    const sign = value >= 0 ? "+" : "";
    return sign + value.toFixed(dec);
  }
}

/**
 * Convert m/s to min:sec/km pace format
 * @param {number} ms - Speed in meters per second
 * @returns {string} Pace in "M:SS" format (e.g., "5:00")
 */
function convertMsToMinKm(ms) {
  if (!ms || ms <= 0) return 'N/A';
  const secsPerKm = 1000 / ms;
  const mins = Math.floor(secsPerKm / 60);
  const secs = Math.round(secsPerKm % 60);
  return mins + ":" + (secs < 10 ? "0" : "") + secs;
}

/**
 * Add seconds to a pace string (e.g., "5:30" + 30 = "6:00")
 * @param {string} paceStr - Pace in "M:SS" format
 * @param {number} secsToAdd - Seconds to add
 * @returns {string} New pace in "M:SS" format
 */
function addPace(paceStr, secsToAdd) {
  if (!paceStr || typeof paceStr !== 'string') return 'N/A';
  const parts = paceStr.split(':');
  if (parts.length !== 2) return paceStr;

  const mins = parseInt(parts[0], 10);
  const secs = parseInt(parts[1], 10);
  const totalSecs = mins * 60 + secs + secsToAdd;

  const newMins = Math.floor(totalSecs / 60);
  const newSecs = totalSecs % 60;
  return newMins + ":" + (newSecs < 10 ? "0" : "") + newSecs;
}

/**
 * Subtract seconds from a pace string (e.g., "5:30" - 30 = "5:00")
 * @param {string} paceStr - Pace in "M:SS" format
 * @param {number} secsToSubtract - Seconds to subtract
 * @returns {string} New pace in "M:SS" format
 */
function subtractPace(paceStr, secsToSubtract) {
  if (!paceStr || typeof paceStr !== 'string') return 'N/A';
  const parts = paceStr.split(':');
  if (parts.length !== 2) return paceStr;

  const mins = parseInt(parts[0], 10);
  const secs = parseInt(parts[1], 10);
  const totalSecs = Math.max(0, mins * 60 + secs - secsToSubtract);

  const newMins = Math.floor(totalSecs / 60);
  const newSecs = totalSecs % 60;
  return newMins + ":" + (newSecs < 10 ? "0" : "") + newSecs;
}

// =========================================================
// ARRAY & MATH UTILITIES
// =========================================================

/**
 * Calculate average of an array of numbers
 * @param {number[]} arr - Array of numbers
 * @returns {number} Average value (0 if empty)
 */
function average(arr) {
  return arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
}

/**
 * Calculate sum of an array of numbers
 * @param {number[]} arr - Array of numbers
 * @returns {number} Sum value
 */
function sum(arr) {
  return arr.reduce((a, b) => a + b, 0);
}

// =========================================================
// GOOGLE DRIVE UTILITIES
// =========================================================

/**
 * Get or create a folder in Google Drive
 * @param {string} name - Folder name
 * @returns {Folder} Google Drive folder
 */
function getOrCreateFolder(name) {
  const folders = DriveApp.getFoldersByName(name);
  return folders.hasNext() ? folders.next() : DriveApp.createFolder(name);
}

// =========================================================
// API DELAY UTILITY
// =========================================================

/**
 * Simple delay function for rate limiting
 * @param {number} ms - Milliseconds to delay
 */
function delay(ms) {
  Utilities.sleep(ms);
}

// =========================================================
// INTERVALS.ICU EVENT UTILITIES
// =========================================================

/**
 * Delete an event from Intervals.icu calendar
 * @param {object} event - Event object with id property
 * @returns {boolean} True if deleted successfully
 */
function deleteIntervalEvent(event) {
  if (!event?.id) {
    Logger.log("No event ID provided for deletion");
    return false;
  }

  const athleteId = "0"; // 0 = current athlete
  const url = "https://intervals.icu/api/v1/athlete/" + athleteId + "/events/" + event.id;

  const options = {
    method: "delete",
    headers: { "Authorization": getIcuAuthHeader() },
    muteHttpExceptions: true
  };

  try {
    const response = UrlFetchApp.fetch(url, options);
    const code = response.getResponseCode();
    if (code === 200 || code === 204) {
      Logger.log(" -> Deleted placeholder event from Intervals.icu");
      return true;
    } else {
      Logger.log(" -> Failed to delete event: " + response.getContentText());
      return false;
    }
  } catch (e) {
    Logger.log(" -> Error deleting event: " + e.toString());
    return false;
  }
}

// =========================================================
// TRAINING GAP DETECTION
// =========================================================

/**
 * Get days since last cycling or running workout
 * @returns {object} Gap information including days and last activity details
 */
function getDaysSinceLastWorkout() {
  const today = new Date();
  const lookbackDays = 30;
  const from = new Date(today);
  from.setDate(today.getDate() - lookbackDays);

  const endpoint = `/athlete/0/activities?oldest=${formatDateISO(from)}&newest=${formatDateISO(today)}`;

  const result = {
    daysSinceLastWorkout: null,
    lastActivity: null,
    hasRecentActivity: false
  };

  const apiResult = fetchIcuApi(endpoint);

  if (!apiResult.success) {
    Logger.log("Error fetching activities for gap detection: " + apiResult.error);
    return result;
  }

  const activities = apiResult.data;
  if (!Array.isArray(activities)) {
    return result;
  }

  // Filter to cycling and running only
  const relevantActivities = activities.filter(a =>
    a.type === 'Ride' || a.type === 'VirtualRide' ||
    a.type === 'Run' || a.type === 'VirtualRun'
  );

  if (relevantActivities.length > 0) {
    relevantActivities.sort((a, b) =>
      new Date(b.start_date_local) - new Date(a.start_date_local)
    );

    const lastActivity = relevantActivities[0];
    const lastDate = new Date(lastActivity.start_date_local);
    const diffTime = today - lastDate;
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    result.daysSinceLastWorkout = diffDays;
    result.lastActivity = {
      date: lastActivity.start_date_local,
      name: lastActivity.name,
      type: lastActivity.type,
      load: lastActivity.icu_training_load || 0
    };
    result.hasRecentActivity = diffDays <= 3;
  } else {
    result.daysSinceLastWorkout = lookbackDays;
  }

  return result;
}

/**
 * Analyze training gap combined with wellness data
 * @param {object} gapData - From getDaysSinceLastWorkout()
 * @param {object} wellness - Wellness data with recovery status
 * @returns {object} Interpretation and recommendations
 */
function analyzeTrainingGap(gapData, wellness) {
  const days = gapData.daysSinceLastWorkout;

  const result = {
    hasSignificantGap: days >= 4,
    gapDays: days,
    interpretation: 'normal',
    intensityModifier: 1.0,
    recommendation: '',
    reasoning: []
  };

  // No significant gap
  if (days === null || days < 4) {
    result.interpretation = 'normal';
    result.recommendation = 'Continue with planned training';
    result.reasoning.push(`${days || 0} days since last workout - normal training rhythm`);
    return result;
  }

  // Significant gap (4+ days) - interpret based on recovery status
  result.hasSignificantGap = true;

  if (wellness && wellness.available) {
    const recovery = wellness.recoveryStatus || '';

    if (recovery.includes('Green') || recovery.includes('Primed') || recovery.includes('Well Recovered')) {
      // Good recovery + gap = planned rest, athlete is fresh
      result.interpretation = 'fresh';
      result.intensityModifier = 1.0;
      result.recommendation = 'Athlete is fresh after rest period. Full intensity appropriate.';
      result.reasoning.push(`${days} days off with good recovery status`);
      result.reasoning.push('Whoop shows green/primed - this was planned rest');
      result.reasoning.push('No detraining concerns yet (takes 2+ weeks)');

    } else if (recovery.includes('Red') || recovery.includes('Strained') || recovery.includes('Poor')) {
      // Poor recovery + gap = likely illness or high stress
      result.interpretation = 'returning_from_illness';
      result.intensityModifier = 0.7;
      result.recommendation = 'Athlete returning from illness/stress. Start easy, monitor response.';
      result.reasoning.push(`${days} days off with poor recovery status`);
      result.reasoning.push('Whoop shows red/strained - likely recovering from illness or stress');
      result.reasoning.push('Prioritize easy endurance to rebuild without setback');

    } else {
      // Yellow/moderate recovery + gap = uncertain, be cautious
      result.interpretation = 'cautious_return';
      result.intensityModifier = TRAINING_CONSTANTS.INTENSITY.YELLOW_MODIFIER;
      result.recommendation = 'Moderate return after break. Test the waters with tempo work.';
      result.reasoning.push(`${days} days off with moderate recovery status`);
      result.reasoning.push('Whoop shows yellow - recovering but not fully fresh');
      result.reasoning.push('Start moderate, assess how athlete responds');
    }
  } else {
    // No wellness data - be conservative
    result.interpretation = 'unknown';
    result.intensityModifier = 0.8; // Conservative without data
    result.recommendation = 'Extended break without wellness data. Start conservatively.';
    result.reasoning.push(`${days} days off with no wellness data available`);
    result.reasoning.push('Without recovery data, assume conservative return');
    result.reasoning.push('Prefer endurance/tempo over high intensity');
  }

  // Extra caution for very long gaps (7+ days)
  if (days >= 7) {
    result.intensityModifier *= 0.9;
    result.reasoning.push(`Extended gap (${days} days) - additional intensity reduction applied`);
  }

  return result;
}

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
    if (a.type === 'Ride' || a.type === 'VirtualRide' || a.type === 'Run' || a.type === 'VirtualRun') {
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
        if (a.feel === 1) result.summary.feelDistribution.bad++;
        else if (a.feel === 2) result.summary.feelDistribution.poor++;
        else if (a.feel === 3) result.summary.feelDistribution.okay++;
        else if (a.feel === 4) result.summary.feelDistribution.good++;
        else if (a.feel === 5) result.summary.feelDistribution.great++;
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

  // Factor 1: Average Feel (target: 3.5-4.0)
  if (avgFeel != null) {
    if (avgFeel < 2.5) {
      adjustmentScore -= 2;
      result.reasoning.push(`Low average feel (${avgFeel.toFixed(1)}/5) suggests overreaching`);
    } else if (avgFeel < 3.0) {
      adjustmentScore -= 1;
      result.reasoning.push(`Below-target feel (${avgFeel.toFixed(1)}/5) suggests accumulated fatigue`);
    } else if (avgFeel > 4.0) {
      adjustmentScore += 1;
      result.reasoning.push(`High feel scores (${avgFeel.toFixed(1)}/5) indicate good recovery`);
    } else {
      result.reasoning.push(`Feel scores are in target range (${avgFeel.toFixed(1)}/5)`);
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
  const recentActivities = feedback.activities.slice(0, 3);
  const recentWithFeel = recentActivities.filter(a => a.feel != null);
  if (recentWithFeel.length >= 2) {
    const recentAvgFeel = recentWithFeel.reduce((sum, a) => sum + a.feel, 0) / recentWithFeel.length;
    if (recentAvgFeel < 2.5) {
      adjustmentScore -= 1;
      result.reasoning.push(`Recent workouts trending negative (last ${recentWithFeel.length} avg: ${recentAvgFeel.toFixed(1)})`);
    } else if (recentAvgFeel > 4.0 && avgFeel != null && recentAvgFeel > avgFeel) {
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
    const feelMap = { 1: 'Bad', 2: 'Poor', 3: 'Okay', 4: 'Good', 5: 'Great' };
    context += `RECENT WORKOUT FEEDBACK (last 14 days, ${feedback.summary.totalWithFeedback} workouts with data):\n`;

    if (feedback.summary.avgFeel != null) {
      context += `- Average Feel: ${feedback.summary.avgFeel.toFixed(1)}/5 (${feelMap[Math.round(feedback.summary.avgFeel)] || 'N/A'})\n`;
    }
    if (feedback.summary.avgRpe != null) {
      context += `- Average RPE: ${feedback.summary.avgRpe.toFixed(1)}/10\n`;
    }

    // Feel distribution
    const fd = feedback.summary.feelDistribution;
    context += `- Feel distribution: ${fd.great} Great, ${fd.good} Good, ${fd.okay} Okay, ${fd.poor} Poor, ${fd.bad} Bad\n`;
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
 * @param {object} fitnessMetrics - Current CTL, ATL, TSB, rampRate
 * @param {object} phaseInfo - Training phase info (weeksOut, phaseName)
 * @param {object} goals - Goal information
 * @returns {object} Training load advice
 */
function calculateTrainingLoadAdvice(fitnessMetrics, phaseInfo, goals) {
  const currentCTL = fitnessMetrics.ctl || 0;
  const currentATL = fitnessMetrics.atl || 0;
  const currentTSB = fitnessMetrics.tsb || 0;
  const currentRampRate = fitnessMetrics.rampRate || 0;
  const weeksOut = phaseInfo.weeksOut || 12;

  // Target CTL based on current fitness and time to goal
  // Aim to peak 5-15% above current CTL for A race
  let targetCTL = currentCTL;
  let targetTSBAtRace = 0; // Slightly positive for race day

  if (weeksOut > 3) {
    // We have time to build - aim for meaningful improvement
    const maxGain = Math.min(weeksOut * 5, 40); // Max ~5 CTL/week, cap at 40 total
    targetCTL = currentCTL + Math.min(maxGain, currentCTL * 0.25); // Or 25% improvement
    targetCTL = Math.max(targetCTL, currentCTL + 10); // At least try for +10 CTL
  }

  // Calculate required weekly CTL increase
  const ctlGapToTarget = targetCTL - currentCTL;
  const buildWeeks = Math.max(weeksOut - 2, 1); // Leave 2 weeks for taper
  const requiredWeeklyIncrease = ctlGapToTarget / buildWeeks;

  // Define safe ramp rate limits
  const SAFE_RAMP_MIN = 3;
  const SAFE_RAMP_MAX = 5;
  const AGGRESSIVE_RAMP_MAX = 7;
  const MAX_SUSTAINABLE_RAMP = 8;

  // Calculate recommended weekly TSS
  // TSS per week ≈ CTL × 7 (simplified, since CTL is ~42 day average)
  let recommendedWeeklyTSS;
  let rampRateAdvice;
  let loadAdvice;
  let warning = null;

  // Phase-based adjustments
  if (phaseInfo.phaseName.includes("Taper") || phaseInfo.phaseName.includes("Race Week")) {
    // Taper: reduce volume significantly
    recommendedWeeklyTSS = Math.round(currentCTL * 7 * 0.5); // 50% reduction
    rampRateAdvice = "Reduce";
    loadAdvice = "Focus on freshness. Reduce volume by 40-50%, keep some intensity for sharpness.";
  } else if (phaseInfo.phaseName.includes("Peak")) {
    // Peak/late taper: moderate reduction
    recommendedWeeklyTSS = Math.round(currentCTL * 7 * 0.7); // 30% reduction
    rampRateAdvice = "Reduce";
    loadAdvice = "Begin tapering. Reduce volume by 20-30%, maintain intensity.";
  } else if (phaseInfo.phaseName.includes("Transition")) {
    // Off-season: easy recovery
    recommendedWeeklyTSS = Math.round(currentCTL * 7 * 0.4);
    rampRateAdvice = "Recovery";
    loadAdvice = "Off-season recovery. Keep active but prioritize rest and fun.";
  } else {
    // Building phases (Base, Build, Specialty)
    const targetWeeklyIncrease = Math.min(requiredWeeklyIncrease, SAFE_RAMP_MAX);
    const targetCTLThisWeek = currentCTL + targetWeeklyIncrease;
    recommendedWeeklyTSS = Math.round(targetCTLThisWeek * 7);

    // Determine ramp rate advice
    if (requiredWeeklyIncrease <= SAFE_RAMP_MIN) {
      rampRateAdvice = "Maintain";
      loadAdvice = "On track. Maintain current load with slight progression.";
    } else if (requiredWeeklyIncrease <= SAFE_RAMP_MAX) {
      rampRateAdvice = "Build";
      loadAdvice = "Good progression rate. Increase load steadily.";
    } else if (requiredWeeklyIncrease <= AGGRESSIVE_RAMP_MAX) {
      rampRateAdvice = "Aggressive";
      loadAdvice = "Aggressive build needed. Monitor fatigue closely.";
      warning = "High ramp rate - ensure adequate recovery.";
    } else {
      rampRateAdvice = "Caution";
      loadAdvice = "Goal may be ambitious. Consider adjusting target or extending timeline.";
      warning = "Required ramp rate exceeds safe limits. Risk of overtraining.";
    }

    // Check current fatigue state
    if (currentTSB < -25) {
      warning = "High fatigue detected (TSB: " + currentTSB.toFixed(0) + "). Consider a recovery week.";
      recommendedWeeklyTSS = Math.round(currentCTL * 7 * 0.6); // Suggest recovery
      loadAdvice = "Recovery week recommended due to accumulated fatigue.";
      rampRateAdvice = "Recover";
    } else if (currentTSB < -15) {
      loadAdvice += " Monitor fatigue - approaching limit.";
    }

    // Check if current ramp rate is already high
    if (currentRampRate > AGGRESSIVE_RAMP_MAX) {
      warning = "Current ramp rate (" + currentRampRate.toFixed(1) + ") is high. Be cautious with further increases.";
    }
  }

  // Calculate TSS range (±10%)
  const tssMin = Math.round(recommendedWeeklyTSS * 0.9);
  const tssMax = Math.round(recommendedWeeklyTSS * 1.1);

  // Estimate daily TSS (assuming 5-6 training days)
  const dailyTSSMin = Math.round(recommendedWeeklyTSS / 6);
  const dailyTSSMax = Math.round(recommendedWeeklyTSS / 5);

  return {
    currentCTL: currentCTL,
    targetCTL: Math.round(targetCTL),
    weeksToGoal: weeksOut,
    recommendedWeeklyTSS: recommendedWeeklyTSS,
    tssRange: { min: tssMin, max: tssMax },
    dailyTSSRange: { min: dailyTSSMin, max: dailyTSSMax },
    rampRateAdvice: rampRateAdvice,
    loadAdvice: loadAdvice,
    warning: warning,
    requiredWeeklyIncrease: Math.round(requiredWeeklyIncrease * 10) / 10
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

    if (a.type === 'Ride' || a.type === 'VirtualRide') {
      result.rides++;
    } else if (a.type === 'Run' || a.type === 'VirtualRun') {
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
