/**
 * IntervalCoach - Power & Pace Analysis
 *
 * Power curve analysis, running pace data, goals, and training phase calculation.
 */

// =========================================================
// GOALS & EVENTS
// =========================================================

/**
 * Fetch upcoming goal events (A, B, and C priority races) from Intervals.icu
 * @returns {object} { available, primaryGoal, secondaryGoals, subGoals, allGoals }
 */
function fetchUpcomingGoals() {
  const today = new Date();
  const futureDate = new Date(today);
  futureDate.setMonth(today.getMonth() + 12); // Look 12 months ahead

  const oldestStr = formatDateISO(today);
  const newestStr = formatDateISO(futureDate);

  const result = {
    available: false,
    primaryGoal: null,      // Next A-race
    secondaryGoals: [],     // B-races
    subGoals: [],           // C-races (stepping stones toward A/B goals)
    allGoals: []            // All A, B, and C races
  };

  const endpoint = "/athlete/0/events?oldest=" + oldestStr + "&newest=" + newestStr;
  const apiResult = fetchIcuApi(endpoint);

  if (!apiResult.success) {
    Logger.log("Error fetching goals: " + apiResult.error);
    return result;
  }

  const events = apiResult.data;
  if (!Array.isArray(events)) {
    return result;
  }

  // Filter for A, B, and C priority races
  const goalEvents = events.filter(function(e) {
    return e.category === 'RACE_A' || e.category === 'RACE_B' || e.category === 'RACE_C';
  });

  // Sort by date
  goalEvents.sort(function(a, b) {
    return new Date(a.start_date_local) - new Date(b.start_date_local);
  });

  if (goalEvents.length > 0) {
    result.available = true;
    result.allGoals = goalEvents.map(function(e) {
      let priority = 'C';
      if (e.category === 'RACE_A') priority = 'A';
      else if (e.category === 'RACE_B') priority = 'B';
      return {
        name: e.name,
        date: e.start_date_local.split('T')[0],
        priority: priority,
        type: e.type,
        description: e.description || ''
      };
    });

    // Find the next A-race (primary goal)
    const nextARace = goalEvents.find(function(e) { return e.category === 'RACE_A'; });
    if (nextARace) {
      result.primaryGoal = {
        name: nextARace.name,
        date: nextARace.start_date_local.split('T')[0],
        type: nextARace.type,
        description: nextARace.description || ''
      };
    } else {
      // If no A-race, use the first B-race
      const nextBRace = goalEvents[0];
      result.primaryGoal = {
        name: nextBRace.name,
        date: nextBRace.start_date_local.split('T')[0],
        type: nextBRace.type,
        description: nextBRace.description || ''
      };
    }

    // Collect B-races
    result.secondaryGoals = goalEvents
      .filter(function(e) { return e.category === 'RACE_B'; })
      .map(function(e) {
        return {
          name: e.name,
          date: e.start_date_local.split('T')[0],
          type: e.type
        };
      });

    // Collect C-races (subgoals/stepping stones)
    result.subGoals = goalEvents
      .filter(function(e) { return e.category === 'RACE_C'; })
      .map(function(e) {
        return {
          name: e.name,
          date: e.start_date_local.split('T')[0],
          type: e.type
        };
      });
  }

  return result;
}

/**
 * Build a dynamic goal description from fetched goals
 * @param {object} goals - Goals object from fetchUpcomingGoals
 * @returns {string} Goal description string
 */
function buildGoalDescription(goals) {
  if (!goals.available || !goals.primaryGoal) {
    return USER_SETTINGS.GOAL_DESCRIPTION; // Fall back to manual setting
  }

  const primary = goals.primaryGoal;
  let description = primary.name;

  // Add date context
  const today = new Date();
  const targetDate = new Date(primary.date);
  const weeksOut = Math.ceil((targetDate - today) / (7 * 24 * 60 * 60 * 1000));

  description += " (" + primary.date + ", " + weeksOut + " weeks out)";

  // Add type
  if (primary.type) {
    description += ". Type: " + primary.type;
  }

  // Add description if available
  if (primary.description) {
    description += ". " + primary.description;
  }

  // Add secondary goals context
  if (goals.secondaryGoals?.length > 0) {
    const otherEvents = goals.secondaryGoals
      .filter(function(g) { return g.date !== primary.date; })
      .slice(0, 3)
      .map(function(g) { return g.name + " (" + g.date + ")"; });

    if (otherEvents.length > 0) {
      description += " Related events: " + otherEvents.join(", ");
    }
  }

  // Add C-races as stepping stones toward main goal
  if (goals.subGoals?.length > 0) {
    const steppingStones = goals.subGoals
      .filter(function(g) { return g.date !== primary.date; })
      .slice(0, 3)
      .map(function(g) { return g.name + " (" + g.date + ")"; });

    if (steppingStones.length > 0) {
      description += " Stepping stones: " + steppingStones.join(", ") + ".";
    }
  }

  // Add peak form indicator
  description += ". Peak form indicator: eFTP should reach or exceed FTP.";

  return description;
}

// =========================================================
// TRAINING PHASE CALCULATION
// =========================================================

/**
 * Calculate training phase - AI-enhanced with date-based fallback
 * @param {string} targetDate - Target date in yyyy-MM-dd format
 * @param {object} context - Optional full context for AI assessment
 * @returns {object} { phaseName, weeksOut, focus, aiEnhanced, reasoning, adjustments, upcomingEventNote }
 */
function calculateTrainingPhase(targetDate, context) {
  const today = new Date();
  const target = new Date(targetDate);
  const weeksOut = Math.ceil((target - today) / (7 * 24 * 60 * 60 * 1000));

  // Date-based fallback (always calculated)
  let phaseName, focus;

  if (weeksOut >= TRAINING_CONSTANTS.PHASE.BASE_START) {
    phaseName = "Base";
    focus = "Aerobic endurance, Z2, Tempo, SweetSpot";
  } else if (weeksOut >= TRAINING_CONSTANTS.PHASE.BUILD_START) {
    phaseName = "Build";
    focus = "FTP development, Threshold, increasing CTL";
  } else if (weeksOut >= TRAINING_CONSTANTS.PHASE.SPECIALTY_START) {
    phaseName = "Specialty";
    focus = "Race specificity, VO2max, Anaerobic";
  } else if (weeksOut >= TRAINING_CONSTANTS.PHASE.TAPER_START) {
    phaseName = "Taper";
    focus = "Reduce volume, maintain intensity";
  } else {
    phaseName = "Race Week";
    focus = "Sharpness, short openers";
  }

  const result = {
    phaseName: phaseName,
    weeksOut: weeksOut,
    focus: focus,
    aiEnhanced: false,
    reasoning: "Date-based calculation"
  };

  // If context provided, attempt AI enhancement
  if (context && context.enableAI !== false) {
    try {
      const aiContext = {
        weeksOut: weeksOut,
        traditionalPhase: phaseName,
        goalDescription: context.goalDescription,
        goals: context.goals,
        ctl: context.ctl || 0,
        rampRate: context.rampRate,
        currentEftp: context.currentEftp,
        targetFtp: context.targetFtp,
        eftpGap: context.targetFtp && context.currentEftp ? context.targetFtp - context.currentEftp : null,
        hrvAvg: context.wellnessAverages?.hrv,
        sleepAvg: context.wellnessAverages?.sleep,
        recoveryAvg: context.wellnessAverages?.recovery,
        recoveryStatus: context.recoveryStatus,
        z5Recent: context.z5Recent || 0,
        tsb: context.tsb || 0,
        recentWorkouts: context.recentWorkouts
      };

      const aiAssessment = generateAIPhaseAssessment(aiContext);

      if (aiAssessment && aiAssessment.phaseName) {
        result.phaseName = aiAssessment.phaseName;
        result.focus = aiAssessment.focus || focus;
        result.aiEnhanced = true;
        result.reasoning = aiAssessment.reasoning;
        result.adjustments = aiAssessment.adjustments;
        result.confidenceLevel = aiAssessment.confidenceLevel;
        result.phaseOverride = aiAssessment.phaseOverride;
        result.upcomingEventNote = aiAssessment.upcomingEventNote;

        if (aiAssessment.phaseOverride) {
          Logger.log("AI Phase Override: " + phaseName + " -> " + aiAssessment.phaseName);
          Logger.log("Reason: " + aiAssessment.reasoning);
        }
      }
    } catch (e) {
      Logger.log("AI phase assessment failed, using date-based: " + e.toString());
    }
  }

  return result;
}

// =========================================================
// RUNNING DATA
// =========================================================

/**
 * Fetch running data (threshold pace, pace zones) from Intervals.icu
 * @returns {object} Running data including Critical Speed
 */
function fetchRunningData() {
  const result = fetchIcuApi("/athlete/0");

  if (!result.success) {
    Logger.log("Error fetching running data: " + result.error);
    return { available: false };
  }

  const data = result.data;

  // Find Run settings in sportSettings array
  if (data.sportSettings) {
    const settingsArray = Array.isArray(data.sportSettings)
      ? data.sportSettings
      : Object.values(data.sportSettings);

    const runSetting = settingsArray.find(function(s) {
      return s?.types?.includes("Run");
    });

    if (runSetting) {
      // Also fetch pace curve for Critical Speed
      const paceCurve = fetchRunningPaceCurve();

      // Convert threshold_pace from m/s to min:sec/km if it's a number
      let thresholdPaceFormatted = runSetting.threshold_pace;
      if (typeof runSetting.threshold_pace === 'number' && runSetting.threshold_pace > 0) {
        thresholdPaceFormatted = convertMsToMinKm(runSetting.threshold_pace);
      }

      // Convert pace_zones from m/s to min:sec/km
      let paceZonesFormatted = runSetting.pace_zones;
      if (runSetting.pace_zones && Array.isArray(runSetting.pace_zones)) {
        paceZonesFormatted = runSetting.pace_zones.map(function(p) {
          return typeof p === 'number' ? convertMsToMinKm(p) : p;
        });
      }

      return {
        available: true,
        thresholdPace: thresholdPaceFormatted,     // Formatted as "5:00" min/km
        thresholdPaceMs: runSetting.threshold_pace, // Raw m/s value
        paceZones: paceZonesFormatted,             // Array of formatted paces
        paceZoneNames: runSetting.pace_zone_names, // Zone names
        lthr: runSetting.lthr,                     // Lactate threshold HR
        maxHr: runSetting.max_hr,
        // Pace curve data (Critical Speed)
        criticalSpeed: paceCurve.criticalSpeed,       // Current CS in min/km
        criticalSpeedMs: paceCurve.criticalSpeedMs,   // CS in m/s
        dPrime: paceCurve.dPrime,                     // D' anaerobic capacity
        seasonBestCS: paceCurve.seasonBestCS,         // Season best CS
        bestEfforts: paceCurve.bestEfforts            // Best times at key distances
      };
    }
  }

  return { available: false };
}

/**
 * Fetch running pace curve from Intervals.icu
 * @returns {object} { criticalSpeed, criticalSpeedMs, dPrime, seasonBestCS, bestEfforts }
 */
function fetchRunningPaceCurve() {
  const result = {
    criticalSpeed: null,
    criticalSpeedMs: null,
    dPrime: null,
    seasonBestCS: null,
    bestEfforts: {}
  };

  // Fetch current (42-day) pace curve
  const current = fetchIcuApi("/athlete/0/pace-curves?type=Run&id=42d");

  if (current.success && current.data?.list?.length > 0) {
    const curve = current.data.list[0];

    // Extract Critical Speed model (API uses "CS" type with criticalSpeed/dPrime fields)
    if (curve.paceModels?.length > 0) {
      const csModel = curve.paceModels.find(function(m) { return m.type === "CS"; }) || curve.paceModels[0];
      if (csModel) {
        result.criticalSpeedMs = csModel.criticalSpeed;
        result.dPrime = csModel.dPrime;
        if (csModel.criticalSpeed) {
          result.criticalSpeed = convertMsToMinKm(csModel.criticalSpeed);
        }
      }
    }

    // Extract best efforts from values array
    if (curve.values && Array.isArray(curve.values)) {
      const keyDistances = [400, 800, 1500, 1609, 3000, 5000];

      curve.values.forEach(function(v) {
        let dist, totalSecs;
        if (Array.isArray(v)) {
          dist = v[0];
          totalSecs = v[1];
        } else if (v && typeof v === 'object') {
          dist = v.distance || v.d;
          totalSecs = v.secs || v.time || v.s;
        }

        if (dist && totalSecs && keyDistances.includes(dist)) {
          const mins = Math.floor(totalSecs / 60);
          const secs = Math.round(totalSecs % 60);

          result.bestEfforts[dist] = {
            time: mins + ":" + (secs < 10 ? "0" : "") + secs,
            pace: convertMsToMinKm(dist / totalSecs)
          };
        }
      });
    }
  } else if (current.error) {
    Logger.log("Error fetching 42-day pace curve: " + current.error);
  }

  // Fetch season/all-time pace curve for comparison
  const season = fetchIcuApi("/athlete/0/pace-curves?type=Run");

  if (season.success && season.data?.list?.length > 0) {
    const curve = season.data.list[0];

    if (curve.paceModels?.length > 0) {
      const csModel = curve.paceModels.find(function(m) { return m.type === "CS"; }) || curve.paceModels[0];
      if (csModel?.criticalSpeed) {
        result.seasonBestCS = convertMsToMinKm(csModel.criticalSpeed);
      }
    }
  } else if (season.error) {
    Logger.log("Error fetching season pace curve: " + season.error);
  }

  return result;
}

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

// =========================================================
// FITNESS METRICS
// =========================================================

/**
 * Fetch fitness metrics (CTL, ATL, TSB) from Intervals.icu for a specific date
 * @param {Date} targetDate - Optional date to fetch metrics for (defaults to today)
 * @returns {object} { ctl, atl, tsb, rampRate, eftp }
 */
function fetchFitnessMetrics(targetDate) {
  const date = targetDate || new Date();
  const dateStr = formatDateISO(date);
  const weekBefore = new Date(date);
  weekBefore.setDate(date.getDate() - 7);
  const weekBeforeStr = formatDateISO(weekBefore);

  // Fetch wellness data for target date
  const dateResult = fetchIcuApi("/athlete/0/wellness/" + dateStr);
  const weekBeforeResult = fetchIcuApi("/athlete/0/wellness/" + weekBeforeStr);

  let ctl = null, atl = null, tsb = null, rampRate = null, eftp = null;

  if (dateResult.success && dateResult.data) {
    ctl = dateResult.data.ctl;
    atl = dateResult.data.atl;
    if (ctl != null && atl != null) {
      tsb = ctl - atl;
    }
  }

  // Calculate ramp rate (CTL change per week)
  if (weekBeforeResult.success && weekBeforeResult.data && ctl != null) {
    const oldCtl = weekBeforeResult.data.ctl;
    if (oldCtl != null) {
      rampRate = ctl - oldCtl;
    }
  }

  // Fetch eFTP for the target date
  eftp = fetchHistoricalEftp(date);

  return {
    ctl: ctl,
    atl: atl,
    tsb: tsb,
    rampRate: rampRate,
    eftp: eftp
  };
}

/**
 * Fetch fitness trend data (CTL, ATL, TSB) for the last N days
 * @param {number} days - Number of days to look back (default 14)
 * @returns {Array} Array of daily fitness metrics sorted by date descending
 */
function fetchFitnessTrend(days = 14) {
  const today = new Date();
  const startDate = new Date(today);
  startDate.setDate(today.getDate() - days);

  const oldestStr = formatDateISO(startDate);
  const newestStr = formatDateISO(today);

  const result = fetchIcuApi("/athlete/0/wellness?oldest=" + oldestStr + "&newest=" + newestStr);

  if (!result.success || !Array.isArray(result.data)) {
    Logger.log("Error fetching fitness trend: " + (result.error || "No data"));
    return [];
  }

  // Map to simplified format and sort by date descending (most recent first)
  const trend = result.data
    .filter(d => d.ctl != null || d.atl != null)
    .map(d => ({
      date: d.id,  // id is the date string in wellness API
      ctl: d.ctl,
      atl: d.atl,
      tsb: d.ctl != null && d.atl != null ? d.ctl - d.atl : null,
      recoveryScore: d.recovery_score,
      hrv: d.hrv,
      restingHR: d.resting_hr,
      sleep: d.sleep_time
    }))
    .sort((a, b) => new Date(b.date) - new Date(a.date));

  return trend;
}

/**
 * Fetch historical eFTP value for a specific date from fitness-model-events
 * @param {Date} date - The date to get eFTP for (finds most recent SET_EFTP event before this date)
 * @returns {number|null} eFTP value or null if not available
 */
function fetchHistoricalEftp(date) {
  const targetDate = date || new Date();
  const targetDateStr = formatDateISO(targetDate);

  const result = fetchIcuApi("/athlete/0/fitness-model-events");

  if (!result.success) {
    Logger.log("Error fetching historical eFTP: " + result.error);
    return null;
  }

  const events = result.data;

  // Filter SET_EFTP events and find the most recent one on or before the target date
  const eftpEvents = events
    .filter(function(e) { return e.category === "SET_EFTP" && e.start_date <= targetDateStr; })
    .sort(function(a, b) { return b.start_date.localeCompare(a.start_date); });

  if (eftpEvents.length > 0) {
    // The value is stored in the event data
    return eftpEvents[0].value || null;
  }

  return null;
}

// =========================================================
// FITNESS PROJECTION
// =========================================================

/**
 * Project CTL/ATL/TSB over the next N days given planned workouts
 * Uses standard exponential weighted moving average with CTL=42 days, ATL=7 days
 * @param {number} currentCTL - Current CTL value
 * @param {number} currentATL - Current ATL value
 * @param {Array} plannedWorkouts - Array of {date, tss} for upcoming workouts
 * @param {number} days - Number of days to project (default 14)
 * @returns {Array} Array of {date, dayName, ctl, atl, tsb, tss} projections
 */
function projectFitnessMetrics(currentCTL, currentATL, plannedWorkouts, days) {
  days = days || 14;
  const CTL_CONSTANT = 42;
  const ATL_CONSTANT = 7;

  const projections = [];
  let ctl = currentCTL || 0;
  let atl = currentATL || 0;

  // Create a map of date -> TSS for quick lookup
  const tssMap = {};
  if (plannedWorkouts && plannedWorkouts.length > 0) {
    for (var i = 0; i < plannedWorkouts.length; i++) {
      var w = plannedWorkouts[i];
      if (w.date && w.tss) {
        tssMap[w.date] = w.tss;
      }
    }
  }

  for (var d = 0; d < days; d++) {
    var date = new Date();
    date.setDate(date.getDate() + d);
    var dateStr = formatDateISO(date);
    var dayName = Utilities.formatDate(date, SYSTEM_SETTINGS.TIMEZONE, "EEE");

    // Get TSS for this date (0 if no workout planned)
    var tss = tssMap[dateStr] || 0;

    // Update CTL and ATL using exponential weighted moving average
    ctl = ctl + (tss - ctl) / CTL_CONSTANT;
    atl = atl + (tss - atl) / ATL_CONSTANT;
    var tsb = ctl - atl;

    projections.push({
      date: dateStr,
      dayName: dayName,
      ctl: Math.round(ctl * 10) / 10,
      atl: Math.round(atl * 10) / 10,
      tsb: Math.round(tsb * 10) / 10,
      tss: tss
    });
  }

  return projections;
}

/**
 * Fetch upcoming planned workouts with TSS estimates for the next N days
 * Extracts TSS from Weekly Plan events or estimates from workout category
 * @param {number} days - Number of days to look ahead (default 14)
 * @returns {Array} Array of {date, activityType, estimatedTSS, duration, source} for each planned day
 */
function fetchUpcomingPlannedTSS(days) {
  days = days || 14;
  const plannedWorkouts = [];

  const today = new Date();
  const startStr = formatDateISO(today);
  var endDate = new Date(today);
  endDate.setDate(today.getDate() + days - 1);
  const endStr = formatDateISO(endDate);

  // Fetch all events in date range
  const result = fetchIcuApi("/athlete/0/events?oldest=" + startStr + "&newest=" + endStr);

  if (!result.success || !Array.isArray(result.data)) {
    Logger.log("Error fetching upcoming planned TSS: " + (result.error || "No data"));
    return plannedWorkouts;
  }

  // Group events by date
  const eventsByDate = {};
  for (var i = 0; i < result.data.length; i++) {
    var e = result.data[i];
    var eventDate = e.start_date ? e.start_date.substring(0, 10) : null;
    if (eventDate) {
      if (!eventsByDate[eventDate]) {
        eventsByDate[eventDate] = [];
      }
      eventsByDate[eventDate].push(e);
    }
  }

  // Process each day
  for (var d = 0; d < days; d++) {
    var checkDate = new Date(today);
    checkDate.setDate(today.getDate() + d);
    var dateStr = formatDateISO(checkDate);

    var events = eventsByDate[dateStr] || [];
    var dailyTSS = 0;
    var activityType = null;
    var duration = null;
    var source = 'none';

    for (var j = 0; j < events.length; j++) {
      var event = events[j];

      // Check for Weekly Plan placeholder with TSS target
      if (event.description && event.description.indexOf('[Weekly Plan]') !== -1) {
        var tssMatch = event.description.match(/TSS Target: ~(\d+)/);
        if (tssMatch) {
          dailyTSS = parseInt(tssMatch[1], 10);
          source = 'weekly_plan';
        }
        var durationMatch = event.description.match(/Duration: (\d+) min/);
        if (durationMatch) {
          duration = parseInt(durationMatch[1], 10);
        }
        // Detect activity type from name
        if (event.name) {
          var nameLower = event.name.toLowerCase();
          if (nameLower.indexOf('run') !== -1 || nameLower.indexOf('hardlopen') !== -1) {
            activityType = 'Run';
          } else if (nameLower.indexOf('ride') !== -1 || nameLower.indexOf('fietsen') !== -1) {
            activityType = 'Ride';
          }
        }
      }

      // Check for WORKOUT category events (have actual TSS)
      if (event.category === 'WORKOUT' && event.icu_training_load) {
        dailyTSS += event.icu_training_load;
        source = 'workout';
      }

      // Check for race events (estimate high TSS)
      if (event.category && event.category.indexOf('RACE') !== -1) {
        // Races typically have high TSS - estimate based on duration or default
        dailyTSS = Math.max(dailyTSS, event.icu_training_load || 150);
        source = 'race';
        activityType = 'Race';
      }
    }

    plannedWorkouts.push({
      date: dateStr,
      activityType: activityType,
      tss: dailyTSS,
      duration: duration,
      source: source
    });
  }

  return plannedWorkouts;
}

/**
 * Generate workout impact preview showing CTL/ATL/TSB projections
 * Compares with vs without today's workout
 * @param {number} todaysTSS - Estimated TSS for today's workout
 * @param {object} fitnessMetrics - Current fitness metrics {ctl, atl, tsb}
 * @param {number} days - Days to project (default 14)
 * @returns {object} {withWorkout, withoutWorkout, impact} projections and comparison
 */
function generateWorkoutImpactPreview(todaysTSS, fitnessMetrics, days) {
  days = days || 14;
  const currentCTL = fitnessMetrics.ctl || 0;
  const currentATL = fitnessMetrics.atl || 0;

  // Fetch upcoming planned workouts
  const upcomingWorkouts = fetchUpcomingPlannedTSS(days);

  // Scenario 1: WITH today's workout (inject todaysTSS for today)
  const workoutsWithToday = upcomingWorkouts.map(function(w) {
    if (w.date === formatDateISO(new Date())) {
      return { date: w.date, tss: todaysTSS };
    }
    return { date: w.date, tss: w.tss };
  });
  const projectionWithWorkout = projectFitnessMetrics(currentCTL, currentATL, workoutsWithToday, days);

  // Scenario 2: WITHOUT today's workout (rest day)
  const workoutsWithoutToday = upcomingWorkouts.map(function(w) {
    if (w.date === formatDateISO(new Date())) {
      return { date: w.date, tss: 0 };
    }
    return { date: w.date, tss: w.tss };
  });
  const projectionWithoutWorkout = projectFitnessMetrics(currentCTL, currentATL, workoutsWithoutToday, days);

  // Calculate key impact metrics
  var endIdx = projectionWithWorkout.length - 1;
  var tomorrowIdx = 1;

  // Impact analysis
  var impact = {
    // Tomorrow's TSB difference
    tomorrowTSBDelta: projectionWithWorkout[tomorrowIdx].tsb - projectionWithoutWorkout[tomorrowIdx].tsb,
    // End of 2 weeks CTL difference
    twoWeekCTLDelta: projectionWithWorkout[endIdx].ctl - projectionWithoutWorkout[endIdx].ctl,
    // Lowest TSB in next week (fatigue valley)
    lowestTSB: Math.min.apply(null, projectionWithWorkout.slice(0, 7).map(function(p) { return p.tsb; })),
    // Days until TSB returns positive
    daysToPositiveTSB: null,
    // Peak form window (when TSB is optimal 0-20)
    peakFormWindow: []
  };

  // Find days until positive TSB
  for (var i = 0; i < projectionWithWorkout.length; i++) {
    if (projectionWithWorkout[i].tsb >= 0) {
      impact.daysToPositiveTSB = i;
      break;
    }
  }

  // Find peak form windows (TSB between 0 and 20)
  for (var k = 0; k < projectionWithWorkout.length; k++) {
    var proj = projectionWithWorkout[k];
    if (proj.tsb >= 0 && proj.tsb <= 20) {
      impact.peakFormWindow.push(proj.date);
    }
  }

  return {
    withWorkout: projectionWithWorkout,
    withoutWorkout: projectionWithoutWorkout,
    upcomingWorkouts: upcomingWorkouts,
    impact: impact,
    todaysTSS: todaysTSS,
    currentMetrics: {
      ctl: currentCTL,
      atl: currentATL,
      tsb: currentCTL - currentATL
    }
  };
}

// =========================================================
// WEEKLY IMPACT PREVIEW
// =========================================================

/**
 * Generate a weekly impact preview showing how planned workouts affect fitness over the week
 * @param {Array} plannedDays - Array of planned workout days from generateAIWeeklyPlan
 * @param {object} fitnessMetrics - Current CTL/ATL/TSB
 * @param {number} days - Number of days to project (default 7)
 * @returns {object} Weekly projection with day-by-day metrics and summary
 */
function generateWeeklyImpactPreview(plannedDays, fitnessMetrics, days) {
  days = days || 7;

  var currentCTL = fitnessMetrics.ctl || 0;
  var currentATL = fitnessMetrics.atl || 0;
  var currentTSB = currentCTL - currentATL;

  // Build planned workouts array with TSS estimates
  var plannedWorkouts = [];

  if (plannedDays && plannedDays.length > 0) {
    for (var i = 0; i < plannedDays.length; i++) {
      var day = plannedDays[i];
      var tss = day.estimatedTSS || 0;

      // If no TSS but has workout type, estimate it
      if (!tss && day.workoutType && day.activity !== 'Rest') {
        tss = estimateWorkoutTSS({
          type: day.workoutType,
          duration: day.duration || 60
        });
      }

      plannedWorkouts.push({
        date: day.date,
        tss: tss,
        workoutType: day.workoutType || day.activity || 'Rest',
        dayName: day.dayName
      });
    }
  }

  // Project fitness metrics for the week
  var projections = projectFitnessMetrics(currentCTL, currentATL, plannedWorkouts, days);

  // Merge workout info with projections
  var weeklyProjection = [];
  for (var j = 0; j < projections.length; j++) {
    var proj = projections[j];
    var workout = plannedWorkouts.find(function(w) { return w.date === proj.date; });

    weeklyProjection.push({
      date: proj.date,
      dayName: proj.dayName,
      workoutType: workout ? workout.workoutType : 'Rest',
      tss: proj.tss,
      ctl: proj.ctl,
      atl: proj.atl,
      tsb: proj.tsb
    });
  }

  // Calculate weekly summary
  var totalTSS = 0;
  var lowestTSB = currentTSB;
  var highestTSB = currentTSB;
  var peakFormDays = [];
  var fatigueWarningDays = [];

  for (var k = 0; k < weeklyProjection.length; k++) {
    var day = weeklyProjection[k];
    totalTSS += day.tss;

    if (day.tsb < lowestTSB) lowestTSB = day.tsb;
    if (day.tsb > highestTSB) highestTSB = day.tsb;

    // Peak form: TSB between 0 and 20
    if (day.tsb >= 0 && day.tsb <= 20) {
      peakFormDays.push(day.dayName + ' ' + day.date.substring(5));
    }

    // Fatigue warning: TSB below -20
    if (day.tsb < -20) {
      fatigueWarningDays.push(day.dayName + ' ' + day.date.substring(5));
    }
  }

  var endOfWeek = weeklyProjection[weeklyProjection.length - 1];

  return {
    projections: weeklyProjection,
    summary: {
      totalTSS: totalTSS,
      startCTL: currentCTL,
      endCTL: endOfWeek.ctl,
      ctlChange: Math.round((endOfWeek.ctl - currentCTL) * 10) / 10,
      startTSB: currentTSB,
      endTSB: endOfWeek.tsb,
      lowestTSB: Math.round(lowestTSB * 10) / 10,
      highestTSB: Math.round(highestTSB * 10) / 10,
      peakFormDays: peakFormDays,
      fatigueWarningDays: fatigueWarningDays,
      sustainableLoad: lowestTSB >= -30 // TSB staying above -30 is generally sustainable
    }
  };
}

/**
 * Generate AI narrative for weekly impact preview
 * @param {object} weeklyImpact - Output from generateWeeklyImpactPreview
 * @param {object} goals - Upcoming goals
 * @param {object} phaseInfo - Training phase info
 * @returns {object} AI-generated narrative and insights
 */
function generateAIWeeklyImpactNarrative(weeklyImpact, goals, phaseInfo) {
  var t = getTranslations();

  // Build context for AI
  var projectionTable = weeklyImpact.projections.map(function(p) {
    return p.dayName + ' ' + p.date.substring(5) + ': ' + p.workoutType + ' (TSS ' + p.tss + ') -> CTL ' + p.ctl + ', TSB ' + p.tsb;
  }).join('\n');

  var prompt = `You are a cycling coach analyzing a week of planned training.

CURRENT STATE:
- CTL (Fitness): ${weeklyImpact.summary.startCTL.toFixed(1)}
- TSB (Form): ${weeklyImpact.summary.startTSB.toFixed(1)}
- Training Phase: ${phaseInfo.phaseName}
- Weeks to Goal: ${phaseInfo.weeksOut}
${goals && goals.primaryGoal ? '- Goal: ' + goals.primaryGoal.name + ' (' + goals.primaryGoal.date + ')' : ''}

PLANNED WEEK:
${projectionTable}

END OF WEEK:
- CTL Change: ${weeklyImpact.summary.ctlChange > 0 ? '+' : ''}${weeklyImpact.summary.ctlChange.toFixed(1)}
- End TSB: ${weeklyImpact.summary.endTSB.toFixed(1)}
- Lowest TSB: ${weeklyImpact.summary.lowestTSB.toFixed(1)}
- Total TSS: ${weeklyImpact.summary.totalTSS}
${weeklyImpact.summary.peakFormDays.length > 0 ? '- Peak Form Days: ' + weeklyImpact.summary.peakFormDays.join(', ') : ''}
${weeklyImpact.summary.fatigueWarningDays.length > 0 ? '- HIGH FATIGUE WARNING: ' + weeklyImpact.summary.fatigueWarningDays.join(', ') : ''}

Provide a brief analysis in ${USER_SETTINGS.LANGUAGE === 'en' ? 'English' : USER_SETTINGS.LANGUAGE === 'nl' ? 'Dutch' : USER_SETTINGS.LANGUAGE === 'ja' ? 'Japanese' : USER_SETTINGS.LANGUAGE === 'es' ? 'Spanish' : 'French'}.

Return JSON:
{
  "weekSummary": "One sentence summarizing the week's training impact",
  "loadAssessment": "appropriate|aggressive|conservative|overreaching",
  "keyInsights": ["2-3 bullet points about the week"],
  "recommendation": "Brief advice for executing this week",
  "riskLevel": "low|medium|high"
}`;

  try {
    var response = callGeminiAPIText(prompt);
    if (!response || typeof response !== 'string') {
      return generateFallbackWeeklyNarrative(weeklyImpact, phaseInfo);
    }

    // Parse JSON response
    var jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return generateFallbackWeeklyNarrative(weeklyImpact, phaseInfo);
    }

    var parsed = JSON.parse(jsonMatch[0]);

    return {
      success: true,
      aiEnhanced: true,
      weekSummary: parsed.weekSummary || '',
      loadAssessment: parsed.loadAssessment || 'appropriate',
      keyInsights: parsed.keyInsights || [],
      recommendation: parsed.recommendation || '',
      riskLevel: parsed.riskLevel || 'low'
    };
  } catch (e) {
    Logger.log('AI weekly narrative failed: ' + e.toString());
    return generateFallbackWeeklyNarrative(weeklyImpact, phaseInfo);
  }
}

/**
 * Fallback narrative when AI is unavailable
 */
function generateFallbackWeeklyNarrative(weeklyImpact, phaseInfo) {
  var summary = weeklyImpact.summary;
  var t = getTranslations();

  var loadAssessment = 'appropriate';
  var riskLevel = 'low';

  if (summary.lowestTSB < -30) {
    loadAssessment = 'overreaching';
    riskLevel = 'high';
  } else if (summary.lowestTSB < -20) {
    loadAssessment = 'aggressive';
    riskLevel = 'medium';
  } else if (summary.ctlChange < 0) {
    loadAssessment = 'conservative';
  }

  var insights = [];

  if (summary.ctlChange > 0) {
    insights.push('Fitness (CTL) will increase by ' + summary.ctlChange.toFixed(1) + ' points');
  } else {
    insights.push('Fitness (CTL) will decrease by ' + Math.abs(summary.ctlChange).toFixed(1) + ' points (recovery week)');
  }

  if (summary.peakFormDays.length > 0) {
    insights.push('Peak form window: ' + summary.peakFormDays.slice(0, 2).join(', '));
  }

  if (summary.fatigueWarningDays.length > 0) {
    insights.push('High fatigue expected: ' + summary.fatigueWarningDays.join(', '));
  }

  return {
    success: true,
    aiEnhanced: false,
    weekSummary: 'Total ' + summary.totalTSS + ' TSS planned, ending with TSB ' + summary.endTSB.toFixed(1),
    loadAssessment: loadAssessment,
    keyInsights: insights,
    recommendation: summary.sustainableLoad ? 'Load is sustainable for this phase.' : 'Consider adding recovery if fatigue accumulates.',
    riskLevel: riskLevel
  };
}

/**
 * Format weekly impact preview for email inclusion
 * @param {object} weeklyImpact - Output from generateWeeklyImpactPreview
 * @param {object} narrative - Output from generateAIWeeklyImpactNarrative
 * @returns {string} Formatted text section for email
 */
function formatWeeklyImpactSection(weeklyImpact, narrative) {
  var t = getTranslations();

  var section = '\n-----------------------------------\n';
  section += (t.weekly_impact_title || 'Weekly Training Impact') + '\n';
  section += '-----------------------------------\n';

  if (narrative && narrative.weekSummary) {
    section += narrative.weekSummary + '\n\n';
  }

  // Projection table
  section += 'Day       | Workout              | TSS | CTL  | TSB\n';
  section += '----------|----------------------|-----|------|-----\n';

  for (var i = 0; i < weeklyImpact.projections.length; i++) {
    var p = weeklyImpact.projections[i];
    var dayLabel = (p.dayName + ' ' + p.date.substring(5)).padEnd(9);
    var workoutLabel = (p.workoutType || 'Rest').substring(0, 20).padEnd(20);
    var tssLabel = String(p.tss).padStart(3);
    var ctlLabel = p.ctl.toFixed(1).padStart(4);
    var tsbLabel = (p.tsb >= 0 ? '+' : '') + p.tsb.toFixed(1);

    section += dayLabel + ' | ' + workoutLabel + ' | ' + tssLabel + ' | ' + ctlLabel + ' | ' + tsbLabel + '\n';
  }

  // Summary
  section += '\n';
  section += (t.weekly_summary || 'Week Summary') + ':\n';
  section += '• Total TSS: ' + weeklyImpact.summary.totalTSS + '\n';
  section += '• CTL: ' + weeklyImpact.summary.startCTL.toFixed(1) + ' → ' + weeklyImpact.summary.endCTL.toFixed(1);
  section += ' (' + (weeklyImpact.summary.ctlChange >= 0 ? '+' : '') + weeklyImpact.summary.ctlChange.toFixed(1) + ')\n';
  section += '• TSB range: ' + weeklyImpact.summary.lowestTSB.toFixed(1) + ' to ' + weeklyImpact.summary.highestTSB.toFixed(1) + '\n';

  if (weeklyImpact.summary.peakFormDays.length > 0) {
    section += '• ' + (t.peak_form_days || 'Peak form') + ': ' + weeklyImpact.summary.peakFormDays.slice(0, 3).join(', ') + '\n';
  }

  if (narrative && narrative.keyInsights && narrative.keyInsights.length > 0) {
    section += '\n' + (t.key_insights || 'Key Insights') + ':\n';
    for (var j = 0; j < narrative.keyInsights.length; j++) {
      section += '• ' + narrative.keyInsights[j] + '\n';
    }
  }

  if (narrative && narrative.recommendation) {
    section += '\n' + narrative.recommendation + '\n';
  }

  return section;
}
