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
 * Convert Intervals.icu feel value to label
 * Intervals.icu scale: 1=Strong (best), 2=Good, 3=Normal, 4=Poor, 5=Weak (worst)
 * @param {number} feelValue - Feel value from Intervals.icu (1-5)
 * @returns {string} Human readable label
 */
function getFeelLabel(feelValue) {
  const feelLabels = { 1: 'Strong', 2: 'Good', 3: 'Normal', 4: 'Poor', 5: 'Weak' };
  return feelLabels[Math.round(feelValue)] || String(feelValue);
}

/**
 * Check if feel value indicates good recovery (Strong or Good)
 * @param {number} feelValue - Feel value from Intervals.icu (1-5)
 * @returns {boolean} True if feeling good
 */
function isGoodFeel(feelValue) {
  return feelValue != null && feelValue <= 2;
}

/**
 * Check if feel value indicates poor recovery (Poor or Weak)
 * @param {number} feelValue - Feel value from Intervals.icu (1-5)
 * @returns {boolean} True if feeling poor
 */
function isPoorFeel(feelValue) {
  return feelValue != null && feelValue >= 4;
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
  const relevantActivities = activities.filter(isSportActivity);

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
 * AI-enhanced with context-aware interpretation
 * @param {object} gapData - From getDaysSinceLastWorkout()
 * @param {object} wellness - Wellness data with recovery status
 * @param {object} phaseInfo - Training phase info (optional)
 * @param {object} fitnessMetrics - Fitness metrics (optional)
 * @returns {object} Interpretation and recommendations
 */
function analyzeTrainingGap(gapData, wellness, phaseInfo, fitnessMetrics) {
  const days = gapData.daysSinceLastWorkout;

  const result = {
    hasSignificantGap: days >= 4,
    gapDays: days,
    interpretation: 'normal',
    intensityModifier: 1.0,
    recommendation: '',
    reasoning: [],
    aiEnhanced: false
  };

  // No significant gap
  if (days === null || days < 3) {
    result.interpretation = 'normal';
    result.recommendation = 'Continue with planned training';
    result.reasoning.push(`${days || 0} days since last workout - normal training rhythm`);
    return result;
  }

  // Try AI-driven analysis first
  try {
    const aiAnalysis = generateAITrainingGapAnalysis(gapData, wellness, phaseInfo, fitnessMetrics);

    if (aiAnalysis && aiAnalysis.interpretation) {
      Logger.log("AI Training Gap Analysis: " + JSON.stringify(aiAnalysis));
      result.hasSignificantGap = days >= 4;
      result.interpretation = aiAnalysis.interpretation;
      result.intensityModifier = aiAnalysis.intensityModifier || 1.0;
      result.recommendation = aiAnalysis.recommendation || '';
      result.reasoning = aiAnalysis.reasoning || [];
      result.fitnessImpact = aiAnalysis.fitnessImpact || 'none';
      result.aiEnhanced = true;
      return result;
    }
  } catch (e) {
    Logger.log("AI training gap analysis failed, using fallback: " + e.toString());
  }

  // ===== FALLBACK: Rule-based logic =====
  Logger.log("Using fallback rule-based training gap analysis");

  // Significant gap (4+ days) - set flag
  result.hasSignificantGap = days >= 4;

  if (days < 4) {
    result.interpretation = 'normal';
    result.recommendation = 'Continue with planned training';
    result.reasoning.push(`${days} days since last workout - normal training rhythm`);
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
// POST-WORKOUT ANALYSIS STORAGE
// =========================================================

/**
 * Store workout analysis for future adaptive context
 * Saves analysis data to script properties for next day's workout generation
 * @param {object} activity - Activity object
 * @param {object} analysis - AI analysis results
 */
function storeWorkoutAnalysis(activity, analysis) {
  const scriptProperties = PropertiesService.getScriptProperties();

  // Create analysis record
  const analysisRecord = {
    activityId: activity.id,
    activityName: activity.name,
    activityType: activity.type,
    date: activity.start_date_local,
    tss: activity.icu_training_load,
    effectiveness: analysis.effectiveness,
    difficultyMatch: analysis.difficultyMatch,
    stimulus: analysis.workoutStimulus,
    recoveryHours: analysis.recoveryImpact?.estimatedRecoveryHours || null,
    adjustmentsNeeded: analysis.trainingAdjustments?.needed || false,
    ftpCalibration: analysis.trainingAdjustments?.ftpCalibration || 'none',
    keyInsight: analysis.keyInsight,
    timestamp: new Date().toISOString()
  };

  // Store last 7 days of analyses
  const historyKey = 'workoutAnalysisHistory';
  let history = [];

  try {
    const historyJson = scriptProperties.getProperty(historyKey);
    if (historyJson) {
      history = JSON.parse(historyJson);
    }
  } catch (e) {
    Logger.log("Error parsing workout analysis history: " + e.toString());
    history = [];
  }

  // Add new record
  history.unshift(analysisRecord);

  // Keep only last 7 days
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  history = history.filter(record => {
    const recordDate = new Date(record.date);
    return recordDate >= sevenDaysAgo;
  });

  // Limit to 14 records max (safety)
  if (history.length > 14) {
    history = history.slice(0, 14);
  }

  // Store updated history
  try {
    scriptProperties.setProperty(historyKey, JSON.stringify(history));
    Logger.log(`Stored analysis for ${activity.name} (${history.length} records in history)`);
  } catch (e) {
    Logger.log("Error storing workout analysis: " + e.toString());
  }

  // Also store "last analysis" for quick access
  const lastAnalysisKey = 'lastWorkoutAnalysis';
  try {
    scriptProperties.setProperty(lastAnalysisKey, JSON.stringify(analysisRecord));
  } catch (e) {
    Logger.log("Error storing last workout analysis: " + e.toString());
  }
}

/**
 * Check if an activity has already been analyzed
 * @param {string} activityId - Activity ID to check
 * @returns {boolean} True if already analyzed
 */
function isActivityAlreadyAnalyzed(activityId) {
  const scriptProperties = PropertiesService.getScriptProperties();
  const historyKey = 'workoutAnalysisHistory';

  try {
    const historyJson = scriptProperties.getProperty(historyKey);
    if (!historyJson) {
      return false;
    }

    const history = JSON.parse(historyJson);
    return history.some(record => record.activityId === activityId);
  } catch (e) {
    Logger.log("Error checking analysis history: " + e.toString());
    return false;
  }
}

/**
 * Get recent workout analyses from storage
 * @param {number} days - Number of days to retrieve (default 7)
 * @returns {Array} Array of analysis records
 */
function getWorkoutAnalysisHistory(days) {
  days = days || 7;
  const scriptProperties = PropertiesService.getScriptProperties();
  const historyKey = 'workoutAnalysisHistory';

  try {
    const historyJson = scriptProperties.getProperty(historyKey);
    if (!historyJson) {
      return [];
    }

    const history = JSON.parse(historyJson);

    // Filter by days
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    return history.filter(record => {
      const recordDate = new Date(record.date);
      return recordDate >= cutoffDate;
    });
  } catch (e) {
    Logger.log("Error retrieving workout analysis history: " + e.toString());
    return [];
  }
}

/**
 * Get last workout analysis
 * @returns {object|null} Last analysis record or null
 */
function getLastWorkoutAnalysis() {
  const scriptProperties = PropertiesService.getScriptProperties();
  const lastAnalysisKey = 'lastWorkoutAnalysis';

  try {
    const lastAnalysisJson = scriptProperties.getProperty(lastAnalysisKey);
    if (!lastAnalysisJson) {
      return null;
    }

    return JSON.parse(lastAnalysisJson);
  } catch (e) {
    Logger.log("Error retrieving last workout analysis: " + e.toString());
    return null;
  }
}

// =========================================================
// GEMINI API UTILITIES
// =========================================================

/**
 * Parse Gemini API response, cleaning markdown code blocks
 * @param {string} response - Raw response text from Gemini API
 * @returns {object|null} Parsed JSON object or null if parsing fails
 */
function parseGeminiJsonResponse(response) {
  if (!response || typeof response !== 'string') {
    return null;
  }

  try {
    let cleaned = response.trim();
    // Remove markdown code block wrappers
    cleaned = cleaned.replace(/^```json\n?/g, '').replace(/^```\n?/g, '').replace(/```$/g, '').trim();
    return JSON.parse(cleaned);
  } catch (e) {
    Logger.log("Error parsing Gemini JSON response: " + e.toString());
    return null;
  }
}

// =========================================================
// LOCALIZATION UTILITIES
// =========================================================

/**
 * Get translations for current language setting
 * Falls back to English if language not found
 * @returns {object} Translation object for current language
 */
function getTranslations() {
  return TRANSLATIONS[USER_SETTINGS.LANGUAGE] || TRANSLATIONS.en;
}

// =========================================================
// ACTIVITY TYPE UTILITIES
// =========================================================

/**
 * Check if activity is a cycling workout
 * @param {object} activity - Activity object with type property
 * @returns {boolean} True if cycling activity
 */
function isCyclingActivity(activity) {
  return activity && (activity.type === 'Ride' || activity.type === 'VirtualRide');
}

/**
 * Check if activity is a running workout
 * @param {object} activity - Activity object with type property
 * @returns {boolean} True if running activity
 */
function isRunningActivity(activity) {
  return activity && (activity.type === 'Run' || activity.type === 'VirtualRun');
}

/**
 * Check if activity is a relevant sport activity (cycling or running)
 * @param {object} activity - Activity object with type property
 * @returns {boolean} True if cycling or running activity
 */
function isSportActivity(activity) {
  return isCyclingActivity(activity) || isRunningActivity(activity);
}

// =========================================================
// DATE RANGE UTILITIES
// =========================================================

/**
 * Get date range for API queries
 * @param {number} daysBack - How many days back from reference date
 * @param {number} daysOffset - Days offset from today (default 0, positive = past)
 * @returns {object} Object with oldest and newest date strings (yyyy-MM-dd)
 */
function getDateRange(daysBack, daysOffset) {
  daysOffset = daysOffset || 0;
  const today = new Date();
  const newest = new Date(today);
  newest.setDate(today.getDate() - daysOffset);
  const oldest = new Date(newest);
  oldest.setDate(newest.getDate() - daysBack + 1);

  return {
    oldest: formatDateISO(oldest),
    newest: formatDateISO(newest)
  };
}

/**
 * Get a single date offset from today
 * @param {number} daysOffset - Days offset from today (positive = future, negative = past)
 * @returns {string} Date string in yyyy-MM-dd format
 */
function getDateOffset(daysOffset) {
  const date = new Date();
  date.setDate(date.getDate() + daysOffset);
  return formatDateISO(date);
}

// =========================================================
// EVENT CHECKING UTILITIES
// =========================================================

/**
 * Check if there's a race event on a specific date offset from today
 * Consolidates hasEventTomorrow, hasEventYesterday, hasEventInDays
 * @param {number} daysOffset - Days from today (0 = today, 1 = tomorrow, -1 = yesterday)
 * @returns {object} Object with hasEvent boolean and category (A, B, C, or null)
 */
function hasEventOnDate(daysOffset) {
  const dateStr = getDateOffset(daysOffset);
  const endpoint = "/athlete/0/events?oldest=" + dateStr + "&newest=" + dateStr;
  const result = fetchIcuApi(endpoint);

  if (!result.success || !Array.isArray(result.data)) {
    return { hasEvent: false, category: null };
  }

  for (const e of result.data) {
    if (e.category === "RACE_A") return { hasEvent: true, category: "A" };
    if (e.category === "RACE_B") return { hasEvent: true, category: "B" };
    if (e.category === "RACE_C") return { hasEvent: true, category: "C" };
  }

  return { hasEvent: false, category: null };
}

// =========================================================
// ZONE PROGRESSION STORAGE
// =========================================================

/**
 * Store zone progression data to script properties
 * @param {object} progression - Zone progression data from calculateZoneProgression()
 * @returns {boolean} True if stored successfully
 */
function storeZoneProgression(progression) {
  if (!progression || !progression.available) {
    return false;
  }

  const scriptProperties = PropertiesService.getScriptProperties();
  const key = 'zoneProgression';

  try {
    scriptProperties.setProperty(key, JSON.stringify(progression));
    Logger.log("Zone progression stored successfully");
    return true;
  } catch (e) {
    Logger.log("Error storing zone progression: " + e.toString());
    return false;
  }
}

/**
 * Retrieve zone progression data from storage
 * Returns cached data if fresh (< 24 hours), otherwise recalculates
 * @param {boolean} forceRecalculate - If true, always recalculate regardless of cache
 * @returns {object} Zone progression data
 */
function getZoneProgression(forceRecalculate) {
  const scriptProperties = PropertiesService.getScriptProperties();
  const key = 'zoneProgression';

  // Try to get cached data
  if (!forceRecalculate) {
    try {
      const cached = scriptProperties.getProperty(key);
      if (cached) {
        const progression = JSON.parse(cached);

        // Check if cache is fresh (less than 24 hours old)
        if (progression.calculatedAt) {
          const calculatedDate = new Date(progression.calculatedAt);
          const now = new Date();
          const hoursSinceCalculation = (now - calculatedDate) / (1000 * 60 * 60);

          if (hoursSinceCalculation < 24) {
            Logger.log("Using cached zone progression (calculated " + Math.round(hoursSinceCalculation) + " hours ago)");
            return progression;
          }
        }
      }
    } catch (e) {
      Logger.log("Error reading cached zone progression: " + e.toString());
    }
  }

  // Calculate fresh data
  Logger.log("Calculating fresh zone progression...");
  const progression = calculateZoneProgression();

  // Store for next time
  if (progression.available) {
    storeZoneProgression(progression);
  }

  return progression;
}

/**
 * Get zone progression history (last N calculations)
 * Useful for tracking progression over time
 * @param {number} maxRecords - Maximum records to return (default 4 = ~1 month of weekly snapshots)
 * @returns {Array} Array of historical progression snapshots
 */
function getZoneProgressionHistory(maxRecords) {
  maxRecords = maxRecords || 4;
  const scriptProperties = PropertiesService.getScriptProperties();
  const historyKey = 'zoneProgressionHistory';

  try {
    const historyJson = scriptProperties.getProperty(historyKey);
    if (!historyJson) {
      return [];
    }

    const history = JSON.parse(historyJson);
    return history.slice(0, maxRecords);
  } catch (e) {
    Logger.log("Error reading zone progression history: " + e.toString());
    return [];
  }
}

/**
 * Add current zone progression to history
 * Called weekly to build up historical data
 * @param {object} progression - Current zone progression data
 */
function addZoneProgressionToHistory(progression) {
  if (!progression || !progression.available) {
    return;
  }

  const scriptProperties = PropertiesService.getScriptProperties();
  const historyKey = 'zoneProgressionHistory';

  try {
    let history = [];
    const historyJson = scriptProperties.getProperty(historyKey);
    if (historyJson) {
      history = JSON.parse(historyJson);
    }

    // Create a compact snapshot for history
    const snapshot = {
      date: progression.calculatedAt,
      progression: {}
    };

    for (const [zone, data] of Object.entries(progression.progression)) {
      snapshot.progression[zone] = {
        level: data.level,
        trend: data.trend
      };
    }

    // Add to front of history
    history.unshift(snapshot);

    // Keep only last 12 records (~3 months of weekly snapshots)
    if (history.length > 12) {
      history = history.slice(0, 12);
    }

    scriptProperties.setProperty(historyKey, JSON.stringify(history));
    Logger.log("Zone progression snapshot added to history");
  } catch (e) {
    Logger.log("Error adding zone progression to history: " + e.toString());
  }
}

/**
 * Format zone progression for display in emails/logs
 * @param {object} progression - Zone progression data
 * @returns {string} Formatted text representation
 */
function formatZoneProgressionText(progression) {
  if (!progression || !progression.available) {
    return "Zone progression data not available.";
  }

  const trendSymbols = {
    improving: '↑',
    stable: '→',
    declining: '↓'
  };

  let text = '';

  for (const [zone, data] of Object.entries(progression.progression)) {
    const zoneName = zone.charAt(0).toUpperCase() + zone.slice(1);
    const symbol = trendSymbols[data.trend] || '→';
    const lastTrained = data.lastTrained ? data.lastTrained.substring(5) : 'N/A';

    // Create level bar visualization (1-10 scale)
    const filledBars = Math.round(data.level);
    const emptyBars = 10 - filledBars;
    const bar = '█'.repeat(filledBars) + '░'.repeat(emptyBars);

    text += `${zoneName.padEnd(10)} ${data.level.toFixed(1)} ${bar} ${symbol} (${lastTrained})\n`;
  }

  text += `\nStrengths: ${progression.strengths.join(', ')}\n`;
  text += `Focus: ${progression.focusAreas.join(', ')}\n`;

  return text;
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

/**
 * Check if the weekly plan needs adaptation based on current conditions
 * Compares current wellness/fitness to planned workout intensity
 * @param {object} wellness - Current wellness summary
 * @param {object} fitnessMetrics - Current CTL/ATL/TSB
 * @param {Array} upcomingDays - Upcoming placeholders from fetchUpcomingPlaceholders
 * @returns {object} { needsAdaptation, adaptationReason, suggestion }
 */
function checkWeeklyPlanAdaptation(wellness, fitnessMetrics, upcomingDays) {
  const result = {
    needsAdaptation: false,
    adaptationReason: '',
    suggestion: ''
  };

  if (!wellness || !fitnessMetrics) {
    return result;
  }

  // Check for significant wellness changes that warrant plan review
  const recoveryStatus = wellness.recoveryStatus || 'Unknown';
  const tsb = fitnessMetrics.tsb || 0;

  // Find today's and tomorrow's planned workouts
  const todayStr = formatDateISO(new Date());
  const tomorrowDate = new Date();
  tomorrowDate.setDate(tomorrowDate.getDate() + 1);
  const tomorrowStr = formatDateISO(tomorrowDate);

  const todayPlan = upcomingDays?.find(d => d.date === todayStr);
  const tomorrowPlan = upcomingDays?.find(d => d.date === tomorrowStr);

  // Check for mismatch between recovery and planned intensity
  const isLowRecovery = recoveryStatus.includes('Red') || recoveryStatus.includes('Strained');
  const isVeryFatigued = tsb < -20;
  const isOverreaching = tsb < -30;

  // Count upcoming high-intensity days
  const upcomingIntenseDays = upcomingDays?.filter(d => {
    const name = d.placeholderName || '';
    return name.includes('VO2') || name.includes('Threshold') || name.includes('Intervals') ||
           name.includes('Tempo') || name.includes('SweetSpot');
  }).length || 0;

  // Determine if adaptation is needed
  if (isOverreaching && upcomingIntenseDays > 0) {
    result.needsAdaptation = true;
    result.adaptationReason = `Your TSB is very low (${tsb.toFixed(1)}) indicating significant fatigue. ` +
      `You have ${upcomingIntenseDays} intensity day(s) planned this week.`;
    result.suggestion = 'Consider converting some intensity days to endurance or recovery rides.';
  } else if (isLowRecovery && tomorrowPlan?.placeholderName?.match(/VO2|Threshold|Intervals/)) {
    result.needsAdaptation = true;
    result.adaptationReason = `Recovery status is ${recoveryStatus} but tomorrow has a high-intensity workout planned.`;
    result.suggestion = 'Consider swapping tomorrow\'s intensity for an easier day, or take today fully off.';
  } else if (isVeryFatigued && upcomingIntenseDays >= 2) {
    result.needsAdaptation = true;
    result.adaptationReason = `You're carrying fatigue (TSB: ${tsb.toFixed(1)}) with ${upcomingIntenseDays} hard days ahead.`;
    result.suggestion = 'Consider reducing volume or intensity on one of the upcoming days.';
  }

  // Check for positive adaptation opportunity (very fresh, could add intensity)
  const isVeryFresh = tsb > 15 && !isLowRecovery;
  if (isVeryFresh && upcomingIntenseDays === 0) {
    result.needsAdaptation = true;
    result.adaptationReason = `You're well-rested (TSB: ${tsb.toFixed(1)}) with no intensity planned this week.`;
    result.suggestion = 'This could be a good opportunity to add a quality session if your goals support it.';
  }

  return result;
}
