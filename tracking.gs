/**
 * IntervalCoach - Training Tracking & Storage
 *
 * Training gap detection, post-workout analysis storage, and zone progression storage.
 */

// =========================================================
// HRV/RHR BASELINE TRACKING
// =========================================================

/**
 * Store HRV/RHR baseline data from wellness records
 * Calculates and stores 30-day rolling averages as personal baselines
 * @param {Array} wellnessRecords - Array of wellness records (should include 30+ days)
 * @returns {object} Stored baseline data
 */
function storeWellnessBaseline(wellnessRecords) {
  if (!wellnessRecords || wellnessRecords.length < 7) {
    Logger.log("Not enough wellness records to calculate baseline");
    return null;
  }

  // Calculate baselines from available data (up to 30 days)
  const records30d = wellnessRecords.slice(0, 30);
  const records7d = wellnessRecords.slice(0, 7);

  const hrvValues30d = records30d.map(w => w.hrv).filter(v => v != null && v > 0);
  const rhrValues30d = records30d.map(w => w.restingHR).filter(v => v != null && v > 0);
  const hrvValues7d = records7d.map(w => w.hrv).filter(v => v != null && v > 0);
  const rhrValues7d = records7d.map(w => w.restingHR).filter(v => v != null && v > 0);

  const baseline = {
    calculatedAt: new Date().toISOString(),
    recordCount: wellnessRecords.length,
    hrv: {
      baseline30d: hrvValues30d.length >= 7 ? average(hrvValues30d) : null,
      baseline7d: hrvValues7d.length >= 3 ? average(hrvValues7d) : null,
      stdDev30d: hrvValues30d.length >= 7 ? calculateStdDev(hrvValues30d) : null,
      min30d: hrvValues30d.length > 0 ? Math.min(...hrvValues30d) : null,
      max30d: hrvValues30d.length > 0 ? Math.max(...hrvValues30d) : null,
      dataPoints: hrvValues30d.length
    },
    rhr: {
      baseline30d: rhrValues30d.length >= 7 ? average(rhrValues30d) : null,
      baseline7d: rhrValues7d.length >= 3 ? average(rhrValues7d) : null,
      stdDev30d: rhrValues30d.length >= 7 ? calculateStdDev(rhrValues30d) : null,
      min30d: rhrValues30d.length > 0 ? Math.min(...rhrValues30d) : null,
      max30d: rhrValues30d.length > 0 ? Math.max(...rhrValues30d) : null,
      dataPoints: rhrValues30d.length
    }
  };

  // Store baseline
  const scriptProperties = PropertiesService.getScriptProperties();
  try {
    scriptProperties.setProperty('wellnessBaseline', JSON.stringify(baseline));
    Logger.log(`Wellness baseline stored: HRV ${baseline.hrv.baseline30d?.toFixed(0)}ms (n=${baseline.hrv.dataPoints}), RHR ${baseline.rhr.baseline30d?.toFixed(0)}bpm (n=${baseline.rhr.dataPoints})`);
  } catch (e) {
    Logger.log("Error storing wellness baseline: " + e.toString());
  }

  return baseline;
}

/**
 * Calculate standard deviation of an array
 * @param {Array<number>} values - Array of numbers
 * @returns {number} Standard deviation
 */
function calculateStdDev(values) {
  if (!values || values.length < 2) return null;
  const avg = average(values);
  const squareDiffs = values.map(v => Math.pow(v - avg, 2));
  return Math.sqrt(average(squareDiffs));
}

/**
 * Get stored wellness baseline
 * @returns {object|null} Baseline data or null if not available
 */
function getWellnessBaseline() {
  const scriptProperties = PropertiesService.getScriptProperties();
  try {
    const baselineJson = scriptProperties.getProperty('wellnessBaseline');
    if (!baselineJson) return null;
    return JSON.parse(baselineJson);
  } catch (e) {
    Logger.log("Error reading wellness baseline: " + e.toString());
    return null;
  }
}

/**
 * Calculate deviation from personal baseline
 * @param {number} currentValue - Today's value
 * @param {object} baselineData - Baseline object with baseline30d, stdDev30d
 * @param {string} metric - 'hrv' or 'rhr' (for interpretation direction)
 * @returns {object} Deviation analysis
 */
function calculateBaselineDeviation(currentValue, baselineData, metric) {
  if (currentValue == null || !baselineData?.baseline30d) {
    return { available: false };
  }

  const baseline = baselineData.baseline30d;
  const stdDev = baselineData.stdDev30d || (baseline * 0.1); // Default to 10% if no stdDev
  const deviation = currentValue - baseline;
  const deviationPercent = (deviation / baseline) * 100;
  const zScore = stdDev > 0 ? deviation / stdDev : 0;

  // Interpretation based on metric type
  // HRV: Higher is generally better
  // RHR: Lower is generally better
  let status = 'normal';
  let interpretation = '';

  if (metric === 'hrv') {
    if (zScore >= 1.5) {
      status = 'elevated';
      interpretation = 'Well above baseline - excellent recovery';
    } else if (zScore >= 0.5) {
      status = 'above_baseline';
      interpretation = 'Above baseline - good recovery';
    } else if (zScore <= -1.5) {
      status = 'suppressed';
      interpretation = 'Significantly below baseline - potential stress/fatigue';
    } else if (zScore <= -0.5) {
      status = 'below_baseline';
      interpretation = 'Below baseline - monitor recovery';
    } else {
      status = 'normal';
      interpretation = 'Within normal range';
    }
  } else if (metric === 'rhr') {
    // RHR: Lower is better, so signs are reversed
    if (zScore <= -1.5) {
      status = 'excellent';
      interpretation = 'Well below baseline - excellent recovery';
    } else if (zScore <= -0.5) {
      status = 'below_baseline';
      interpretation = 'Below baseline - good recovery';
    } else if (zScore >= 1.5) {
      status = 'elevated';
      interpretation = 'Significantly above baseline - potential stress/fatigue/illness';
    } else if (zScore >= 0.5) {
      status = 'above_baseline';
      interpretation = 'Above baseline - monitor recovery';
    } else {
      status = 'normal';
      interpretation = 'Within normal range';
    }
  }

  return {
    available: true,
    current: currentValue,
    baseline: baseline,
    deviation: deviation,
    deviationPercent: deviationPercent,
    zScore: zScore,
    stdDev: stdDev,
    status: status,
    interpretation: interpretation
  };
}

/**
 * Get comprehensive baseline analysis for today's wellness
 * @param {object} todayWellness - Today's wellness data (hrv, restingHR)
 * @returns {object} Analysis with deviations for both metrics
 */
function analyzeWellnessVsBaseline(todayWellness) {
  const baseline = getWellnessBaseline();

  const analysis = {
    available: false,
    hrvDeviation: null,
    rhrDeviation: null,
    overallStatus: 'unknown',
    concerns: [],
    baselineAge: null
  };

  if (!baseline) {
    return analysis;
  }

  // Calculate baseline age in hours
  if (baseline.calculatedAt) {
    const baselineDate = new Date(baseline.calculatedAt);
    analysis.baselineAge = Math.round((new Date() - baselineDate) / (1000 * 60 * 60));
  }

  // HRV deviation
  if (todayWellness?.hrv != null) {
    analysis.hrvDeviation = calculateBaselineDeviation(todayWellness.hrv, baseline.hrv, 'hrv');
  }

  // RHR deviation
  if (todayWellness?.restingHR != null) {
    analysis.rhrDeviation = calculateBaselineDeviation(todayWellness.restingHR, baseline.rhr, 'rhr');
  }

  analysis.available = analysis.hrvDeviation?.available || analysis.rhrDeviation?.available;

  // Determine overall status and concerns
  if (analysis.available) {
    const hrvStatus = analysis.hrvDeviation?.status || 'unknown';
    const rhrStatus = analysis.rhrDeviation?.status || 'unknown';

    // Check for concerning combinations
    if (hrvStatus === 'suppressed' || rhrStatus === 'elevated') {
      analysis.overallStatus = 'warning';
      if (hrvStatus === 'suppressed') {
        analysis.concerns.push('HRV significantly below baseline');
      }
      if (rhrStatus === 'elevated') {
        analysis.concerns.push('Resting HR significantly elevated');
      }
    } else if (hrvStatus === 'below_baseline' || rhrStatus === 'above_baseline') {
      analysis.overallStatus = 'caution';
      if (hrvStatus === 'below_baseline') {
        analysis.concerns.push('HRV below baseline');
      }
      if (rhrStatus === 'above_baseline') {
        analysis.concerns.push('Resting HR above baseline');
      }
    } else if (hrvStatus === 'elevated' || hrvStatus === 'above_baseline' || rhrStatus === 'excellent' || rhrStatus === 'below_baseline') {
      analysis.overallStatus = 'good';
    } else {
      analysis.overallStatus = 'normal';
    }
  }

  // Calculate continuous intensity modifier from z-scores
  if (analysis.available) {
    analysis.zScoreIntensity = calculateZScoreIntensityModifier(
      analysis.hrvDeviation?.zScore,
      analysis.rhrDeviation?.zScore
    );
  }

  return analysis;
}

/**
 * Calculate continuous intensity modifier from HRV and RHR z-scores
 * Replaces discrete Red/Yellow/Green categories with continuous scaling
 *
 * Z-score to intensity mapping (for combined score):
 * z = -2.0 → 0.70 (very fatigued, high injury risk)
 * z = -1.5 → 0.75 (significantly below baseline)
 * z = -1.0 → 0.82 (below baseline)
 * z = -0.5 → 0.88 (slightly below baseline)
 * z =  0.0 → 0.94 (at baseline - slightly conservative default)
 * z =  0.5 → 0.98 (slightly above baseline)
 * z =  1.0 → 1.00 (above baseline - full intensity)
 * z =  1.5 → 1.02 (well above baseline - slight bonus)
 * z =  2.0 → 1.05 (excellent recovery - capped at 5% bonus)
 *
 * @param {number} hrvZScore - HRV z-score (higher = better)
 * @param {number} rhrZScore - RHR z-score (lower = better, will be inverted)
 * @returns {object} { modifier, confidence, breakdown, description }
 */
function calculateZScoreIntensityModifier(hrvZScore, rhrZScore) {
  const result = {
    modifier: 1.0,
    confidence: 'low',
    breakdown: {},
    description: '',
    rawScores: { hrv: hrvZScore, rhr: rhrZScore }
  };

  // If no z-scores available, return default
  if (hrvZScore == null && rhrZScore == null) {
    result.description = 'No baseline data available';
    return result;
  }

  // Convert z-scores to individual modifiers
  // HRV: higher is better (use directly)
  // RHR: lower is better (invert the sign)
  let hrvModifier = null;
  let rhrModifier = null;

  if (hrvZScore != null) {
    hrvModifier = zScoreToModifier(hrvZScore);
    result.breakdown.hrv = {
      zScore: hrvZScore,
      modifier: hrvModifier,
      contribution: getZScoreDescription(hrvZScore, 'hrv')
    };
  }

  if (rhrZScore != null) {
    // Invert RHR z-score (high RHR is bad, so negate)
    const invertedRhrZ = -rhrZScore;
    rhrModifier = zScoreToModifier(invertedRhrZ);
    result.breakdown.rhr = {
      zScore: rhrZScore,
      invertedZ: invertedRhrZ,
      modifier: rhrModifier,
      contribution: getZScoreDescription(invertedRhrZ, 'rhr')
    };
  }

  // Combine modifiers (weighted average if both available)
  if (hrvModifier != null && rhrModifier != null) {
    // Weight HRV slightly more as it's generally more sensitive
    result.modifier = (hrvModifier * 0.6) + (rhrModifier * 0.4);
    result.confidence = 'high';
    result.description = combineDescriptions(hrvZScore, rhrZScore);
  } else if (hrvModifier != null) {
    result.modifier = hrvModifier;
    result.confidence = 'medium';
    result.description = result.breakdown.hrv.contribution;
  } else {
    result.modifier = rhrModifier;
    result.confidence = 'medium';
    result.description = result.breakdown.rhr.contribution;
  }

  // Round to 2 decimal places
  result.modifier = Math.round(result.modifier * 100) / 100;

  return result;
}

/**
 * Convert a single z-score to intensity modifier using smooth curve
 * Uses a modified logistic function for smooth transitions
 */
function zScoreToModifier(z) {
  // Clamp z-score to reasonable range
  z = Math.max(-3, Math.min(3, z));

  // Piecewise linear with smooth transitions
  // This gives us more control over the mapping
  if (z <= -2) {
    return 0.70;
  } else if (z <= -1) {
    // Linear from 0.70 to 0.82
    return 0.70 + (z + 2) * 0.12;
  } else if (z <= 0) {
    // Linear from 0.82 to 0.94
    return 0.82 + (z + 1) * 0.12;
  } else if (z <= 1) {
    // Linear from 0.94 to 1.00
    return 0.94 + z * 0.06;
  } else if (z <= 2) {
    // Linear from 1.00 to 1.05 (smaller gains above baseline)
    return 1.00 + (z - 1) * 0.05;
  } else {
    return 1.05; // Cap at 5% bonus
  }
}

/**
 * Get human-readable description for a z-score contribution
 */
function getZScoreDescription(z, metric) {
  const metricName = metric === 'hrv' ? 'HRV' : 'RHR';

  if (z <= -1.5) {
    return `${metricName} significantly impaired (-${Math.abs(z).toFixed(1)}σ)`;
  } else if (z <= -0.5) {
    return `${metricName} below baseline (-${Math.abs(z).toFixed(1)}σ)`;
  } else if (z <= 0.5) {
    return `${metricName} at baseline`;
  } else if (z <= 1.5) {
    return `${metricName} above baseline (+${z.toFixed(1)}σ)`;
  } else {
    return `${metricName} excellent (+${z.toFixed(1)}σ)`;
  }
}

/**
 * Combine HRV and RHR descriptions into overall assessment
 */
function combineDescriptions(hrvZ, rhrZ) {
  // Invert RHR for combined assessment
  const effectiveRhrZ = -rhrZ;
  const combinedZ = (hrvZ * 0.6) + (effectiveRhrZ * 0.4);

  if (combinedZ <= -1.5) {
    return 'Recovery significantly compromised - reduce intensity 25-30%';
  } else if (combinedZ <= -0.5) {
    return 'Recovery below baseline - reduce intensity 10-18%';
  } else if (combinedZ <= 0.5) {
    return 'Recovery at baseline - normal training appropriate';
  } else if (combinedZ <= 1.5) {
    return 'Recovery above baseline - full intensity OK';
  } else {
    return 'Excellent recovery - can push if training plan allows';
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

// =========================================================
// ILLNESS PATTERN DETECTION
// =========================================================

/**
 * Check for illness pattern in recent wellness data
 * Detects: elevated RHR + suppressed HRV + poor sleep + elevated skin temp
 * over 2+ consecutive days
 *
 * @param {object} options - Optional configuration
 * @param {number} options.daysToCheck - Number of days to check (default 3)
 * @param {number} options.minConsecutiveDays - Minimum days with pattern (default 2)
 * @returns {object} Illness pattern analysis
 */
function checkIllnessPattern(options = {}) {
  const daysToCheck = options.daysToCheck || 3;
  const minConsecutiveDays = options.minConsecutiveDays || 2;

  const result = {
    detected: false,
    probability: 'none',  // none, possible, likely, high
    consecutiveDays: 0,
    symptoms: [],
    dailyAnalysis: [],
    recommendation: '',
    trainingGuidance: ''
  };

  try {
    // Fetch recent wellness data (3-5 days to analyze patterns)
    const wellnessRecords = fetchWellnessData(daysToCheck + 2, 0);
    if (!wellnessRecords || wellnessRecords.length < 2) {
      return result;
    }

    // Get baseline for comparison
    const baseline = getWellnessBaseline();
    if (!baseline) {
      Logger.log("Illness check: No baseline available for comparison");
      return result;
    }

    // Calculate skin temp baseline from recent data if not in stored baseline
    let skinTempBaseline = null;
    let skinTempStdDev = null;
    const skinTempValues = wellnessRecords.map(w => w.skinTemp).filter(v => v != null);
    if (skinTempValues.length >= 3) {
      skinTempBaseline = average(skinTempValues);
      skinTempStdDev = calculateStdDev(skinTempValues) || 0.3; // Default 0.3°C if no std dev
    }

    // Analyze each day
    const dailyPatterns = [];

    for (let i = 0; i < Math.min(daysToCheck, wellnessRecords.length); i++) {
      const day = wellnessRecords[i];
      const dayAnalysis = {
        date: day.date,
        markers: [],
        score: 0,  // Higher score = more concerning
        details: {}
      };

      // Check RHR (elevated = bad)
      if (day.restingHR && baseline.rhr?.baseline30d) {
        const rhrDeviation = calculateBaselineDeviation(day.restingHR, baseline.rhr, 'rhr');
        dayAnalysis.details.rhr = {
          value: day.restingHR,
          baseline: baseline.rhr.baseline30d,
          zScore: rhrDeviation.zScore
        };

        // RHR elevated > 1σ above baseline is concerning
        if (rhrDeviation.zScore >= 1.5) {
          dayAnalysis.markers.push('rhr_very_elevated');
          dayAnalysis.score += 3;
        } else if (rhrDeviation.zScore >= 1.0) {
          dayAnalysis.markers.push('rhr_elevated');
          dayAnalysis.score += 2;
        } else if (rhrDeviation.zScore >= 0.5) {
          dayAnalysis.markers.push('rhr_slightly_elevated');
          dayAnalysis.score += 1;
        }
      }

      // Check HRV (suppressed = bad)
      if (day.hrv && baseline.hrv?.baseline30d) {
        const hrvDeviation = calculateBaselineDeviation(day.hrv, baseline.hrv, 'hrv');
        dayAnalysis.details.hrv = {
          value: day.hrv,
          baseline: baseline.hrv.baseline30d,
          zScore: hrvDeviation.zScore
        };

        // HRV suppressed < -1σ below baseline is concerning
        if (hrvDeviation.zScore <= -1.5) {
          dayAnalysis.markers.push('hrv_very_suppressed');
          dayAnalysis.score += 3;
        } else if (hrvDeviation.zScore <= -1.0) {
          dayAnalysis.markers.push('hrv_suppressed');
          dayAnalysis.score += 2;
        } else if (hrvDeviation.zScore <= -0.5) {
          dayAnalysis.markers.push('hrv_slightly_suppressed');
          dayAnalysis.score += 1;
        }
      }

      // Check sleep (poor sleep = bad)
      if (day.sleep != null) {
        dayAnalysis.details.sleep = { value: day.sleep };

        if (day.sleep < 5) {
          dayAnalysis.markers.push('sleep_very_poor');
          dayAnalysis.score += 3;
        } else if (day.sleep < 6) {
          dayAnalysis.markers.push('sleep_poor');
          dayAnalysis.score += 2;
        } else if (day.sleep < 6.5) {
          dayAnalysis.markers.push('sleep_insufficient');
          dayAnalysis.score += 1;
        }
      }

      // Check skin temperature (elevated = bad, especially from Whoop)
      if (day.skinTemp != null && skinTempBaseline != null) {
        const skinTempDev = (day.skinTemp - skinTempBaseline) / (skinTempStdDev || 0.3);
        dayAnalysis.details.skinTemp = {
          value: day.skinTemp,
          baseline: skinTempBaseline,
          zScore: skinTempDev
        };

        // Skin temp elevated > 0.5°C above baseline (roughly 1.5σ)
        if (skinTempDev >= 2.0) {
          dayAnalysis.markers.push('skinTemp_very_elevated');
          dayAnalysis.score += 3;
        } else if (skinTempDev >= 1.0) {
          dayAnalysis.markers.push('skinTemp_elevated');
          dayAnalysis.score += 2;
        } else if (skinTempDev >= 0.5) {
          dayAnalysis.markers.push('skinTemp_slightly_elevated');
          dayAnalysis.score += 1;
        }
      }

      // Check respiratory rate (elevated = illness indicator, from Whoop)
      // Normal range: 12-20 breaths/min, illness often shows 16+ during sleep
      if (day.respiratoryRate != null) {
        dayAnalysis.details.respiratoryRate = { value: day.respiratoryRate };

        // Respiratory rate above normal is a strong illness signal
        if (day.respiratoryRate >= 18) {
          dayAnalysis.markers.push('respiratory_very_elevated');
          dayAnalysis.score += 3;  // Strong illness indicator
        } else if (day.respiratoryRate >= 16) {
          dayAnalysis.markers.push('respiratory_elevated');
          dayAnalysis.score += 2;
        } else if (day.respiratoryRate >= 14) {
          dayAnalysis.markers.push('respiratory_slightly_elevated');
          dayAnalysis.score += 1;
        }
      }

      // Check recovery score if available (Whoop)
      if (day.recovery != null) {
        dayAnalysis.details.recovery = { value: day.recovery };

        if (day.recovery < 34) {
          dayAnalysis.markers.push('recovery_very_low');
          dayAnalysis.score += 2;
        } else if (day.recovery < 50) {
          dayAnalysis.markers.push('recovery_low');
          dayAnalysis.score += 1;
        }
      }

      dailyPatterns.push(dayAnalysis);
    }

    // Count consecutive days with concerning patterns (score >= 3)
    let consecutiveConcerning = 0;
    for (const day of dailyPatterns) {
      if (day.score >= 3) {
        consecutiveConcerning++;
      } else {
        break; // Stop counting at first non-concerning day (most recent first)
      }
    }

    result.consecutiveDays = consecutiveConcerning;
    result.dailyAnalysis = dailyPatterns;

    // Aggregate symptoms across all days
    const allMarkers = new Set();
    for (const day of dailyPatterns.slice(0, consecutiveConcerning || 1)) {
      day.markers.forEach(m => allMarkers.add(m));
    }

    // Build human-readable symptoms
    const symptomLabels = {
      'rhr_very_elevated': 'Very elevated resting HR',
      'rhr_elevated': 'Elevated resting HR',
      'rhr_slightly_elevated': 'Slightly elevated resting HR',
      'hrv_very_suppressed': 'Very suppressed HRV',
      'hrv_suppressed': 'Suppressed HRV',
      'hrv_slightly_suppressed': 'Slightly suppressed HRV',
      'sleep_very_poor': 'Very poor sleep (<5h)',
      'sleep_poor': 'Poor sleep (<6h)',
      'sleep_insufficient': 'Insufficient sleep (<6.5h)',
      'skinTemp_very_elevated': 'Significantly elevated skin temp',
      'skinTemp_elevated': 'Elevated skin temp',
      'skinTemp_slightly_elevated': 'Slightly elevated skin temp',
      'respiratory_very_elevated': 'Very elevated respiratory rate (18+ br/min)',
      'respiratory_elevated': 'Elevated respiratory rate (16+ br/min)',
      'respiratory_slightly_elevated': 'Slightly elevated respiratory rate',
      'recovery_very_low': 'Very low recovery (<34%)',
      'recovery_low': 'Low recovery (<50%)'
    };

    result.symptoms = Array.from(allMarkers).map(m => symptomLabels[m] || m);

    // Determine illness probability based on pattern
    const recentDayScore = dailyPatterns[0]?.score || 0;
    const totalScore = dailyPatterns.slice(0, minConsecutiveDays).reduce((sum, d) => sum + d.score, 0);

    if (consecutiveConcerning >= minConsecutiveDays && totalScore >= 8) {
      result.detected = true;
      result.probability = 'high';
      result.recommendation = 'Strong illness indicators. Complete rest recommended.';
      result.trainingGuidance = 'NO training. Focus on rest, hydration, and recovery. Resume only when symptoms clear for 24-48 hours.';
    } else if (consecutiveConcerning >= minConsecutiveDays && totalScore >= 5) {
      result.detected = true;
      result.probability = 'likely';
      result.recommendation = 'Likely illness developing. Avoid intensity.';
      result.trainingGuidance = 'Light activity only (walk, easy spin). No structured training. Monitor symptoms closely.';
    } else if (consecutiveConcerning >= 1 && recentDayScore >= 4) {
      result.detected = true;
      result.probability = 'possible';
      result.recommendation = 'Possible early illness signs. Monitor closely.';
      result.trainingGuidance = 'Reduce intensity by 30-50%. Prioritize recovery. Stop immediately if feeling worse.';
    } else if (recentDayScore >= 3) {
      result.detected = false;
      result.probability = 'none';
      result.recommendation = 'Some stress markers present but no clear illness pattern.';
      result.trainingGuidance = 'Train conservatively. Extra attention to recovery.';
    }

    if (result.detected) {
      Logger.log(`Illness pattern detected (${result.probability}): ${result.consecutiveDays} days, symptoms: ${result.symptoms.join(', ')}`);
    }

  } catch (e) {
    Logger.log("Error checking illness pattern: " + e.toString());
  }

  return result;
}

// =========================================================
// RECENT ACTIVITY SUMMARY
// =========================================================

/**
 * Fetch recent activity summary for historical comparison
 * @param {number} days - Number of days to look back (default 14)
 * @returns {object} Summary of recent activities with averages and counts
 */
function fetchRecentActivitySummary(days) {
  days = days || 14;

  const result = {
    available: false,
    days: days,
    totalActivities: 0,
    cyclingCount: 0,
    runningCount: 0,
    avgTSS: 0,
    avgDuration: 0,
    avgIntensity: 0,
    totalTSS: 0,
    cyclingAvgTSS: 0,
    runningAvgTSS: 0,
    cyclingAvgDuration: 0,
    runningAvgDuration: 0
  };

  try {
    const today = new Date();
    const oldest = new Date(today);
    oldest.setDate(today.getDate() - days);

    const oldestStr = formatDateISO(oldest);
    const newestStr = formatDateISO(today);

    const activitiesResult = fetchIcuApi("/athlete/0/activities?oldest=" + oldestStr + "&newest=" + newestStr);

    if (!activitiesResult.success || !activitiesResult.data) {
      return result;
    }

    const activities = activitiesResult.data.filter(a =>
      isSportActivity(a) && a.icu_training_load && a.icu_training_load > 0
    );

    if (activities.length === 0) {
      return result;
    }

    result.available = true;
    result.totalActivities = activities.length;

    // Separate cycling and running
    const cycling = activities.filter(a => isCyclingActivity(a));
    const running = activities.filter(a => isRunningActivity(a));

    result.cyclingCount = cycling.length;
    result.runningCount = running.length;

    // Calculate averages
    const allTSS = activities.map(a => a.icu_training_load || 0);
    const allDurations = activities.map(a => Math.round((a.moving_time || 0) / 60));
    const allIntensity = activities.filter(a => a.icu_intensity).map(a => a.icu_intensity);

    result.totalTSS = sum(allTSS);
    result.avgTSS = Math.round(average(allTSS));
    result.avgDuration = Math.round(average(allDurations));
    result.avgIntensity = allIntensity.length > 0 ? average(allIntensity).toFixed(2) : null;

    // Cycling averages
    if (cycling.length > 0) {
      result.cyclingAvgTSS = Math.round(average(cycling.map(a => a.icu_training_load || 0)));
      result.cyclingAvgDuration = Math.round(average(cycling.map(a => Math.round((a.moving_time || 0) / 60))));
    }

    // Running averages
    if (running.length > 0) {
      result.runningAvgTSS = Math.round(average(running.map(a => a.icu_training_load || 0)));
      result.runningAvgDuration = Math.round(average(running.map(a => Math.round((a.moving_time || 0) / 60))));
    }

  } catch (e) {
    Logger.log("Error fetching recent activity summary: " + e.toString());
  }

  return result;
}
