/**
 * IntervalCoach - Power Data & Analysis
 *
 * Power curve analysis and athlete power metrics.
 * Related modules: running.gs (pace data), fitness.gs (CTL/ATL/TSB), zones.gs (zone analysis), goals.gs (events)
 */

// =========================================================
// ATHLETE & POWER DATA
// =========================================================

/**
 * Fetch athlete data including weight, FTP, and eFTP from Intervals.icu
 * @returns {object} { ftp, eFtp, weight, wPrime, pMax }
 */
function fetchAthleteData() {
  const result = fetchIcuApi("/athlete/0");

  if (!result.success) {
    Logger.log("Error fetching athlete data: " + result.error);
    return { ftp: null, eFtp: null, weight: null };
  }

  const data = result.data;

  // sportSettings may be array or object with numeric keys - find Ride settings
  let manualFtp = null;
  let eFtp = null;
  let currentWPrime = null;
  let currentPMax = null;

  if (data.sportSettings) {
    const settingsArray = Array.isArray(data.sportSettings)
      ? data.sportSettings
      : Object.values(data.sportSettings);

    const rideSetting = settingsArray.find(function(s) {
      return s?.types?.includes("Ride");
    });

    if (rideSetting) {
      manualFtp = rideSetting.ftp || null;
      if (rideSetting.mmp_model) {
        eFtp = rideSetting.mmp_model.ftp || null;
        currentWPrime = rideSetting.mmp_model.wPrime || null;
        currentPMax = rideSetting.mmp_model.pMax || null;
      }
    }
  }

  return {
    ftp: manualFtp,
    eFtp: eFtp,
    weight: data.icu_weight || data.weight || null,
    wPrime: currentWPrime,
    pMax: currentPMax
  };
}

/**
 * Extract eFTP from powerModels array
 * @param {Array} powerModels - Array of power model objects
 * @returns {number|null} FTP value
 */
function extractEftpFromModels(powerModels) {
  if (!powerModels || !Array.isArray(powerModels) || powerModels.length === 0) {
    return null;
  }

  // Priority: ECP > MORTON_3P > FFT_CURVES > MS_2P
  const modelPriority = ["ECP", "MORTON_3P", "FFT_CURVES", "MS_2P"];

  for (let i = 0; i < modelPriority.length; i++) {
    const model = powerModels.find(function(m) { return m.type === modelPriority[i]; });
    if (model && model.ftp) {
      return model.ftp;
    }
  }

  // Fallback: use first model with ftp
  const anyModel = powerModels.find(function(m) { return m.ftp; });
  return anyModel ? anyModel.ftp : null;
}

/**
 * Fetch power curve data from Intervals.icu
 * @returns {object} Power curve with peak powers and FTP values
 */
function fetchPowerCurve() {
  // Get athlete data for weight, manual FTP, and current eFTP
  const athleteData = fetchAthleteData();

  // Get all-time power curve for peak powers
  const result = fetchIcuApi("/athlete/0/power-curves?type=Ride");

  if (!result.success) {
    Logger.log("Error fetching power curve: " + result.error);
    return { available: false };
  }

  const data = result.data;

  // Power curve is in data.list array
  if (!data?.list?.length) {
    return { available: false };
  }

  const curve = data.list[0];
  const watts = curve.watts;
  const secs = curve.secs;

  if (!watts || !secs) {
    return { available: false };
  }

  // Find power at key durations by searching the secs array
  const getPowerAt = function(targetSecs) {
    for (let i = 0; i < secs.length; i++) {
      if (secs[i] === targetSecs) {
        return watts[i];
      }
    }
    let bestIdx = 0;
    for (let i = 0; i < secs.length; i++) {
      if (secs[i] <= targetSecs) {
        bestIdx = i;
      } else {
        break;
      }
    }
    return watts[bestIdx];
  };

  // Calculate FTP from 20-min power as fallback
  const peak20min = getPowerAt(1200);
  const curveFtp = Math.round(peak20min * TRAINING_CONSTANTS.POWER.FTP_FROM_20MIN);

  // Extract eFTP from powerModels for comparison
  const modelEftp = extractEftpFromModels(curve.powerModels);
  const currentEftp = athleteData.eFtp;
  const effectiveFtp = currentEftp || modelEftp || athleteData.ftp || curveFtp;

  // Extract W' and pMax from season powerModels
  let seasonWPrime = null;
  let seasonPMax = null;
  const fftModel = curve.powerModels?.find(function(m) { return m.type === "FFT_CURVES"; });
  if (fftModel) {
    seasonWPrime = fftModel.wPrime;
    seasonPMax = fftModel.pMax;
  }

  return {
    available: true,
    peak5s: getPowerAt(5),
    peak10s: getPowerAt(10),
    peak30s: getPowerAt(30),
    peak1min: getPowerAt(60),
    peak2min: getPowerAt(120),
    peak5min: getPowerAt(300),
    peak8min: getPowerAt(480),
    peak20min: peak20min,
    peak30min: getPowerAt(1800),
    peak60min: getPowerAt(3600),
    ftp: effectiveFtp,
    eFTP: currentEftp || modelEftp || curveFtp,
    currentEftp: currentEftp,
    allTimeEftp: modelEftp,
    manualFTP: athleteData.ftp,
    curveFTP: curveFtp,
    wPrime: athleteData.wPrime,
    seasonWPrime: seasonWPrime,
    pMax: athleteData.pMax,
    seasonPMax: seasonPMax,
    weight: athleteData.weight,
    vo2max5m: curve.vo2max_5m
  };
}

/**
 * Analyze power curve to identify strengths and weaknesses
 * AI-enhanced with goal-aware analysis, falls back to benchmarks if AI unavailable
 * @param {object} powerCurve - Power curve data
 * @param {object} goals - Optional goal events from fetchUpcomingGoals()
 * @returns {object} Analysis with strengths, weaknesses, and recommendations
 */
function analyzePowerProfile(powerCurve, goals) {
  if (!powerCurve || !powerCurve.available) {
    return { available: false };
  }

  // Use current eFTP for analysis (rolling daily value), fallback to other sources
  const ftp = powerCurve.currentEftp || powerCurve.eFTP || powerCurve.ftp;

  // Analyze W' (anaerobic capacity) trend
  let wPrimeStatus = null;
  if (powerCurve.wPrime && powerCurve.seasonWPrime) {
    const wPrimeRatio = powerCurve.wPrime / powerCurve.seasonWPrime;
    if (wPrimeRatio < TRAINING_CONSTANTS.POWER.W_PRIME_LOW) {
      wPrimeStatus = "Low (needs anaerobic work)";
    } else if (wPrimeRatio > TRAINING_CONSTANTS.POWER.W_PRIME_HIGH) {
      wPrimeStatus = "Strong";
    } else {
      wPrimeStatus = "Moderate";
    }
  }

  // Calculate TTE estimate (time to exhaustion at FTP)
  let tteEstimate = null;
  if (powerCurve.wPrime && ftp) {
    tteEstimate = Math.round(powerCurve.wPrime / 500);
  }

  // Build base result with power data
  const baseResult = {
    available: true,
    ftp: ftp,
    currentEftp: powerCurve.currentEftp,
    eFTP: powerCurve.eFTP,
    allTimeEftp: powerCurve.allTimeEftp,
    manualFTP: powerCurve.manualFTP,
    weight: powerCurve.weight,
    // Peak powers
    peak5s: powerCurve.peak5s,
    peak10s: powerCurve.peak10s,
    peak30s: powerCurve.peak30s,
    peak1min: powerCurve.peak1min,
    peak2min: powerCurve.peak2min,
    peak5min: powerCurve.peak5min,
    peak8min: powerCurve.peak8min,
    peak20min: powerCurve.peak20min,
    peak30min: powerCurve.peak30min,
    peak60min: powerCurve.peak60min,
    // W' (Anaerobic Work Capacity)
    wPrime: powerCurve.wPrime,
    seasonWPrime: powerCurve.seasonWPrime,
    wPrimeKj: powerCurve.wPrime ? (powerCurve.wPrime / 1000).toFixed(1) : null,
    wPrimeStatus: wPrimeStatus,
    // pMax (Max Power)
    pMax: powerCurve.pMax,
    seasonPMax: powerCurve.seasonPMax,
    // VO2max & TTE
    vo2max: powerCurve.vo2max5m,
    tteEstimate: tteEstimate
  };

  // Try AI-driven analysis first
  try {
    const aiAnalysis = generateAIPowerProfileAnalysis(powerCurve, goals);

    if (aiAnalysis && aiAnalysis.strengths && aiAnalysis.weaknesses) {
      Logger.log("AI Power Profile Analysis: " + JSON.stringify(aiAnalysis));
      return Object.assign({}, baseResult, {
        strengths: aiAnalysis.strengths,
        weaknesses: aiAnalysis.weaknesses,
        recommendations: aiAnalysis.recommendations || [],
        eventRelevance: aiAnalysis.eventRelevance || null,
        climbingStrength: null, // AI handles this contextually
        summary: aiAnalysis.weaknesses.length > 0
          ? "Focus areas: " + aiAnalysis.weaknesses.join(", ")
          : "Well-rounded power profile",
        aiEnhanced: true,
        aiConfidence: aiAnalysis.confidence || 'medium'
      });
    }
  } catch (e) {
    Logger.log("AI power profile analysis failed, using fallback: " + e.toString());
  }

  // ===== FALLBACK: Benchmark-based analysis =====
  Logger.log("Using fallback benchmark-based power profile analysis");

  const ratios = {
    peak5s: powerCurve.peak5s / ftp,
    peak1min: powerCurve.peak1min / ftp,
    peak5min: powerCurve.peak5min / ftp,
    peak20min: powerCurve.peak20min / ftp
  };

  const benchmarks = {
    peak5s: 2.0,
    peak1min: 1.5,
    peak5min: 1.2,
    peak20min: 1.05
  };

  const strengths = [];
  const weaknesses = [];
  const recommendations = [];

  if (ratios.peak5s > benchmarks.peak5s * 1.1) {
    strengths.push("Sprint power (5s)");
  } else if (ratios.peak5s < benchmarks.peak5s * 0.9) {
    weaknesses.push("Sprint power (5s)");
    recommendations.push("Include neuromuscular sprints");
  }

  if (ratios.peak1min > benchmarks.peak1min * 1.1) {
    strengths.push("Anaerobic capacity (1min)");
  } else if (ratios.peak1min < benchmarks.peak1min * 0.9) {
    weaknesses.push("Anaerobic capacity (1min)");
    recommendations.push("Add 1-minute max efforts");
  }

  if (ratios.peak5min > benchmarks.peak5min * 1.05) {
    strengths.push("VO2max power (5min)");
  } else if (ratios.peak5min < benchmarks.peak5min * 0.95) {
    weaknesses.push("VO2max power (5min)");
    recommendations.push("Focus on 3-5 minute intervals at 105-120% FTP");
  }

  if (ratios.peak20min > benchmarks.peak20min * 1.02) {
    strengths.push("Threshold endurance (20min)");
  } else if (ratios.peak20min < benchmarks.peak20min * 0.98) {
    weaknesses.push("Threshold endurance (20min)");
    recommendations.push("Include longer threshold intervals (2x20min)");
  }

  if (wPrimeStatus === "Low (needs anaerobic work)") {
    recommendations.push("Build W' with hard 30s-2min efforts");
  }

  const climbingPower = (powerCurve.peak5min + powerCurve.peak20min) / 2;
  const climbingStrength = climbingPower / ftp > 1.1 ? "Strong climber" : null;

  return Object.assign({}, baseResult, {
    strengths: strengths,
    weaknesses: weaknesses,
    recommendations: recommendations,
    climbingStrength: climbingStrength,
    summary: weaknesses.length > 0
      ? "Fallback: " + weaknesses.join(", ")
      : "Well-rounded power profile",
    aiEnhanced: false
  });
}
