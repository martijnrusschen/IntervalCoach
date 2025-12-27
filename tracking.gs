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

  return analysis;
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
