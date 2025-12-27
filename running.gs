/**
 * IntervalCoach - Running Data
 *
 * Running pace data, Critical Speed, and pace curve analysis.
 */

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
