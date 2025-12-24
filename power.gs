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
 * Calculate training phase based on target date
 * @param {string} targetDate - Target date in yyyy-MM-dd format
 * @returns {object} { phaseName, weeksOut, focus }
 */
function calculateTrainingPhase(targetDate) {
  const today = new Date();
  const target = new Date(targetDate);
  const weeksOut = Math.ceil((target - today) / (7 * 24 * 60 * 60 * 1000));

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

  return {
    phaseName: phaseName,
    weeksOut: weeksOut,
    focus: focus
  };
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
 * @param {object} powerCurve - Power curve data
 * @returns {object} Analysis with strengths, weaknesses, and recommendations
 */
function analyzePowerProfile(powerCurve) {
  if (!powerCurve || !powerCurve.available) {
    return { available: false };
  }

  // Use current eFTP for analysis (rolling daily value), fallback to other sources
  const ftp = powerCurve.currentEftp || powerCurve.eFTP || powerCurve.ftp;

  // Calculate ratios (as % of current FTP)
  const ratios = {
    peak5s: powerCurve.peak5s / ftp,
    peak1min: powerCurve.peak1min / ftp,
    peak5min: powerCurve.peak5min / ftp,
    peak20min: powerCurve.peak20min / ftp
  };

  // Typical ratios for well-rounded cyclist
  const benchmarks = {
    peak5s: 2.0,    // Sprint ~200% of FTP
    peak1min: 1.5,  // Anaerobic ~150% of FTP
    peak5min: 1.2,  // VO2max ~120% of FTP
    peak20min: 1.05 // ~105% of FTP
  };

  const strengths = [];
  const weaknesses = [];
  const recommendations = [];

  // Analyze each duration
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

  // For climbing events, check 5-20min power specifically
  const climbingPower = (powerCurve.peak5min + powerCurve.peak20min) / 2;
  const climbingStrength = climbingPower / ftp > 1.1 ? "Strong climber" : null;

  // Analyze W' (anaerobic capacity) trend
  let wPrimeStatus = null;
  if (powerCurve.wPrime && powerCurve.seasonWPrime) {
    const wPrimeRatio = powerCurve.wPrime / powerCurve.seasonWPrime;
    if (wPrimeRatio < TRAINING_CONSTANTS.POWER.W_PRIME_LOW) {
      wPrimeStatus = "Low (needs anaerobic work)";
      recommendations.push("Build W' with hard 30s-2min efforts");
    } else if (wPrimeRatio > TRAINING_CONSTANTS.POWER.W_PRIME_HIGH) {
      wPrimeStatus = "Strong";
    } else {
      wPrimeStatus = "Moderate";
    }
  }

  // Calculate TTE estimate (time to exhaustion at FTP)
  let tteEstimate = null;
  if (powerCurve.wPrime && ftp) {
    // Rough TTE in minutes based on W' (higher W' = longer TTE)
    tteEstimate = Math.round(powerCurve.wPrime / 500); // Simplified formula
  }

  return {
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
    tteEstimate: tteEstimate,
    // Analysis
    strengths: strengths,
    weaknesses: weaknesses,
    recommendations: recommendations,
    climbingStrength: climbingStrength,
    summary: weaknesses.length > 0
      ? "Focus areas: " + weaknesses.join(", ")
      : "Well-rounded power profile"
  };
}

// =========================================================
// FITNESS METRICS
// =========================================================

/**
 * Fetch current fitness metrics (CTL, ATL, TSB) from Intervals.icu
 * @returns {object} { ctl, atl, tsb, rampRate }
 */
function fetchFitnessMetrics() {
  const today = new Date();
  const todayStr = formatDateISO(today);
  const weekAgo = new Date(today);
  weekAgo.setDate(today.getDate() - 7);
  const weekAgoStr = formatDateISO(weekAgo);

  // Fetch today's fitness
  const todayResult = fetchIcuApi("/athlete/0/wellness/" + todayStr);
  const weekAgoResult = fetchIcuApi("/athlete/0/wellness/" + weekAgoStr);

  let ctl = null, atl = null, tsb = null, rampRate = null;

  if (todayResult.success && todayResult.data) {
    ctl = todayResult.data.ctl;
    atl = todayResult.data.atl;
    if (ctl != null && atl != null) {
      tsb = ctl - atl;
    }
  }

  // Calculate ramp rate (CTL change per week)
  if (weekAgoResult.success && weekAgoResult.data && ctl != null) {
    const oldCtl = weekAgoResult.data.ctl;
    if (oldCtl != null) {
      rampRate = ctl - oldCtl;
    }
  }

  return {
    ctl: ctl,
    atl: atl,
    tsb: tsb,
    rampRate: rampRate
  };
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
