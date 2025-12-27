/**
 * IntervalCoach - Zone Progression & Cross-Sport
 *
 * Zone progression tracking, cross-sport equivalency, and personalized zone boundaries.
 */

// =========================================================
// ZONE PROGRESSION LEVELS
// =========================================================

/**
 * Analyze zone exposure for a single activity
 * Extracts time in each power/pace zone and compares to workout intent
 * @param {object} activity - Activity data from Intervals.icu
 * @returns {object} Zone exposure analysis { zones: { z1, z2, z3, z4, z5, z6 }, totalTime, dominantZone, stimulus }
 */
function analyzeZoneExposure(activity) {
  if (!activity) return null;

  // Get zone times (in seconds) - works for both power zones and pace zones
  const zoneTimes = activity.icu_zone_times || activity.gap_zone_times || [];

  const getZoneSecs = function(zoneId) {
    const zone = zoneTimes.find(function(z) { return z.id === zoneId; });
    return zone ? zone.secs : 0;
  };

  const zones = {
    z1: getZoneSecs("Z1"),
    z2: getZoneSecs("Z2"),
    z3: getZoneSecs("Z3"),
    z4: getZoneSecs("Z4"),
    z5: getZoneSecs("Z5"),
    z6: getZoneSecs("Z6"),
    z7: getZoneSecs("Z7"),
    ss: getZoneSecs("SS")  // Sweet Spot zone if tracked separately
  };

  const totalTime = activity.moving_time || Object.values(zones).reduce(function(a, b) { return a + b; }, 0);

  if (totalTime < 600) return null; // Skip very short activities (<10 min)

  // Determine dominant zone
  let dominantZone = 'z2';
  let maxTime = zones.z2;

  for (const [zone, time] of Object.entries(zones)) {
    if (time > maxTime) {
      maxTime = time;
      dominantZone = zone;
    }
  }

  // Determine training stimulus based on zone distribution
  let stimulus = 'endurance';
  const highIntensity = zones.z5 + zones.z6 + zones.z7;
  const threshold = zones.z4 + zones.ss;
  const endurance = zones.z2 + zones.z3;

  if (highIntensity > 300) {
    stimulus = 'vo2max';
  } else if (threshold > 600) {
    stimulus = 'threshold';
  } else if (zones.ss > 300) {
    stimulus = 'sweetspot';
  } else if (zones.z3 > zones.z2 * 0.5) {
    stimulus = 'tempo';
  } else if (endurance > totalTime * 0.5) {
    stimulus = 'endurance';
  } else if (zones.z1 > totalTime * 0.5) {
    stimulus = 'recovery';
  }

  return {
    activityId: activity.id,
    date: activity.start_date_local?.substring(0, 10),
    type: activity.type,
    zones: zones,
    totalTime: totalTime,
    dominantZone: dominantZone,
    stimulus: stimulus,
    tss: activity.icu_training_load || 0,
    // Calculate zone percentages
    zonePercentages: {
      z1: Math.round((zones.z1 / totalTime) * 100),
      z2: Math.round((zones.z2 / totalTime) * 100),
      z3: Math.round((zones.z3 / totalTime) * 100),
      z4: Math.round((zones.z4 / totalTime) * 100),
      z5: Math.round((zones.z5 / totalTime) * 100),
      z6: Math.round((zones.z6 / totalTime) * 100)
    }
  };
}

/**
 * Calculate zone progression levels from recent activities
 * Tracks fitness per power zone similar to TrainerRoad's Progression Levels
 * @param {number} daysBack - Number of days to analyze (default 42 = 6 weeks)
 * @returns {object} Zone progression data
 */
function calculateZoneProgression(daysBack) {
  daysBack = daysBack || 42;

  const today = new Date();
  const oldest = new Date(today);
  oldest.setDate(today.getDate() - daysBack);

  const oldestStr = formatDateISO(oldest);
  const todayStr = formatDateISO(today);

  // Fetch activities for the period
  const result = fetchIcuApi("/athlete/0/activities?oldest=" + oldestStr + "&newest=" + todayStr);

  if (!result.success || !Array.isArray(result.data)) {
    Logger.log("Error fetching activities for zone progression: " + (result.error || "No data"));
    return { available: false };
  }

  // Initialize zone tracking
  const zoneData = {
    endurance: { totalTime: 0, sessions: 0, lastTrained: null, tssSum: 0, activities: [] },
    tempo: { totalTime: 0, sessions: 0, lastTrained: null, tssSum: 0, activities: [] },
    threshold: { totalTime: 0, sessions: 0, lastTrained: null, tssSum: 0, activities: [] },
    vo2max: { totalTime: 0, sessions: 0, lastTrained: null, tssSum: 0, activities: [] },
    anaerobic: { totalTime: 0, sessions: 0, lastTrained: null, tssSum: 0, activities: [] }
  };

  // Map zones to training categories
  const zoneToCategory = {
    z1: 'endurance',
    z2: 'endurance',
    z3: 'tempo',
    z4: 'threshold',
    ss: 'threshold',
    z5: 'vo2max',
    z6: 'anaerobic',
    z7: 'anaerobic'
  };

  // Process each activity
  const activities = result.data.filter(isSportActivity);
  const exposures = [];

  for (const activity of activities) {
    const exposure = analyzeZoneExposure(activity);
    if (!exposure) continue;

    exposures.push(exposure);

    // Accumulate time for each zone category
    for (const [zone, seconds] of Object.entries(exposure.zones)) {
      const category = zoneToCategory[zone];
      if (category && seconds > 0) {
        zoneData[category].totalTime += seconds;

        // Track session if significant time in this zone
        if (seconds > 300) { // > 5 minutes
          if (!zoneData[category].activities.includes(activity.id)) {
            zoneData[category].sessions++;
            zoneData[category].activities.push(activity.id);
            zoneData[category].tssSum += exposure.tss;

            // Update last trained date
            const activityDate = exposure.date;
            if (!zoneData[category].lastTrained || activityDate > zoneData[category].lastTrained) {
              zoneData[category].lastTrained = activityDate;
            }
          }
        }
      }
    }
  }

  // Calculate progression levels (1.0 - 10.0 scale)
  // Based on: time in zone, session frequency, recency
  const progression = {};
  const baselineMinutes = {
    endurance: 300,   // ~5 hours for level 5
    tempo: 120,       // ~2 hours for level 5
    threshold: 90,    // ~1.5 hours for level 5
    vo2max: 45,       // ~45 min for level 5
    anaerobic: 20     // ~20 min for level 5
  };

  for (const [category, data] of Object.entries(zoneData)) {
    const minutes = data.totalTime / 60;
    const baseline = baselineMinutes[category];

    // Base level from accumulated time (0-7 points)
    let level = Math.min(7, (minutes / baseline) * 5);

    // Frequency bonus (0-2 points): more sessions = higher level
    const frequencyBonus = Math.min(2, (data.sessions / (daysBack / 7)) * 0.5);
    level += frequencyBonus;

    // Recency factor (0-1 points): recent training maintains level
    let recencyFactor = 0;
    if (data.lastTrained) {
      const daysSince = Math.floor((today - new Date(data.lastTrained)) / (1000 * 60 * 60 * 24));
      if (daysSince <= 7) {
        recencyFactor = 1.0;
      } else if (daysSince <= 14) {
        recencyFactor = 0.5;
      } else if (daysSince <= 21) {
        recencyFactor = 0.25;
      }
    }
    level += recencyFactor;

    // Clamp to 1.0-10.0
    level = Math.max(1.0, Math.min(10.0, level));

    // Determine trend based on recent vs older activity
    let trend = 'stable';
    const twoWeeksAgo = new Date(today);
    twoWeeksAgo.setDate(today.getDate() - 14);
    const twoWeeksAgoStr = formatDateISO(twoWeeksAgo);

    const recentSessions = exposures.filter(function(e) {
      return e.date >= twoWeeksAgoStr &&
        (category === 'endurance' && (e.dominantZone === 'z1' || e.dominantZone === 'z2') ||
         category === 'tempo' && e.dominantZone === 'z3' ||
         category === 'threshold' && (e.dominantZone === 'z4' || e.dominantZone === 'ss') ||
         category === 'vo2max' && e.dominantZone === 'z5' ||
         category === 'anaerobic' && (e.dominantZone === 'z6' || e.dominantZone === 'z7'));
    }).length;

    if (recentSessions >= 2) {
      trend = 'improving';
    } else if (data.lastTrained && new Date(data.lastTrained) < twoWeeksAgo) {
      trend = 'declining';
    }

    progression[category] = {
      level: Math.round(level * 10) / 10,
      trend: trend,
      lastTrained: data.lastTrained,
      sessions: data.sessions,
      totalMinutes: Math.round(minutes),
      avgTssPerSession: data.sessions > 0 ? Math.round(data.tssSum / data.sessions) : 0
    };
  }

  // Identify focus areas (lowest levels that should be trained)
  const sortedCategories = Object.entries(progression)
    .sort(function(a, b) { return a[1].level - b[1].level; });

  const focusAreas = sortedCategories
    .slice(0, 2)
    .map(function(entry) { return entry[0]; });

  // Identify strengths (highest levels)
  const strengths = sortedCategories
    .slice(-2)
    .reverse()
    .map(function(entry) { return entry[0]; });

  return {
    available: true,
    calculatedAt: todayStr,
    periodDays: daysBack,
    activitiesAnalyzed: exposures.length,
    progression: progression,
    focusAreas: focusAreas,
    strengths: strengths
  };
}

/**
 * Generate AI-powered zone recommendations based on progression levels
 * @param {object} progression - Zone progression from calculateZoneProgression()
 * @param {object} phaseInfo - Training phase info
 * @param {object} goals - Goal events
 * @returns {object} AI recommendations for zone training
 */
function getZoneRecommendations(progression, phaseInfo, goals) {
  if (!progression || !progression.available) {
    return null;
  }

  const langName = getPromptLanguage();

  const prompt = 'You are an expert cycling/running coach analyzing an athlete\'s zone-specific fitness levels.\n\n' +
    '**ZONE PROGRESSION LEVELS (1.0-10.0 scale):**\n' +
    Object.entries(progression.progression).map(function(entry) {
      var zone = entry[0];
      var data = entry[1];
      return '- ' + zone.charAt(0).toUpperCase() + zone.slice(1) + ': Level ' + data.level + ' (' + data.trend + ', ' + data.sessions + ' sessions, last trained: ' + (data.lastTrained || 'never') + ')';
    }).join('\n') + '\n\n' +
    '**IDENTIFIED PATTERNS:**\n' +
    '- Strengths: ' + progression.strengths.join(', ') + '\n' +
    '- Focus Areas (underdeveloped): ' + progression.focusAreas.join(', ') + '\n\n' +
    '**TRAINING CONTEXT:**\n' +
    '- Phase: ' + (phaseInfo?.phaseName || 'Build') + ' (' + (phaseInfo?.weeksOut || '?') + ' weeks to goal)\n' +
    (goals?.primaryGoal ? '- Goal: ' + goals.primaryGoal.name + ' (' + goals.primaryGoal.date + ')\n' : '') + '\n' +
    '**YOUR TASK:**\n' +
    'Provide personalized recommendations based on zone progression levels.\n\n' +
    'Write all text output in ' + langName + '.\n\n' +
    '**Output JSON only:**\n{\n  "summary": "1-2 sentence overview of current zone fitness",\n  "priorityZone": "zone that needs most attention this week",\n  "priorityReason": "why this zone should be prioritized",\n  "weeklyRecommendations": [\n    "Specific workout recommendation 1",\n    "Specific workout recommendation 2"\n  ],\n  "avoidanceNote": "any zones to avoid or reduce focus on",\n  "longTermTrend": "overall trajectory of zone fitness (improving/plateauing/declining)"\n}';

  const response = callGeminiAPIText(prompt);
  const recommendations = parseGeminiJsonResponse(response);

  if (!recommendations) {
    // Fallback recommendations
    const weakestZone = progression.focusAreas[0];
    return {
      summary: 'Your ' + weakestZone + ' is the least developed zone. Consider adding targeted training.',
      priorityZone: weakestZone,
      priorityReason: 'Level ' + progression.progression[weakestZone].level + ' is below other zones',
      weeklyRecommendations: [
        'Add 1-2 ' + weakestZone + ' focused sessions this week',
        'Maintain your ' + progression.strengths[0] + ' strength with one quality session'
      ],
      avoidanceNote: null,
      longTermTrend: 'stable',
      aiEnhanced: false
    };
  }

  recommendations.aiEnhanced = true;
  return recommendations;
}

/**
 * Format zone progression for text display
 * @param {object} progression - Zone progression data
 * @returns {string} Formatted text
 */
function formatZoneProgressionText(progression) {
  if (!progression || !progression.available) {
    return '';
  }

  var text = 'Zone Progression (last ' + progression.periodDays + ' days):\n';

  for (const [zone, data] of Object.entries(progression.progression)) {
    const zoneName = zone.charAt(0).toUpperCase() + zone.slice(1);
    const bar = '#'.repeat(Math.round(data.level)) + '-'.repeat(10 - Math.round(data.level));
    text += '  ' + zoneName.padEnd(12) + ' ' + data.level.toFixed(1) + ' [' + bar + '] (' + data.trend + ')\n';
  }

  text += '\nFocus areas: ' + progression.focusAreas.join(', ') + '\n';
  text += 'Strengths: ' + progression.strengths.join(', ') + '\n';

  return text;
}

// =========================================================
// CROSS-SPORT ZONE EQUIVALENCY
// =========================================================

/**
 * Calculate cross-sport zone equivalencies between cycling and running
 * Maps power zones to pace zones based on physiological equivalence
 * @returns {object} Cross-sport equivalency data with zone mappings
 */
function calculateCrossSportEquivalency() {
  // Fetch both cycling and running data
  const powerCurve = fetchPowerCurve();
  const runningData = fetchRunningData();

  const result = {
    available: false,
    cycling: {
      available: false,
      ftp: null,
      wPrime: null,
      zones: []
    },
    running: {
      available: false,
      criticalSpeed: null,
      criticalSpeedMs: null,
      dPrime: null,
      thresholdPace: null,
      zones: []
    },
    equivalencies: [],
    crossSportInsights: null
  };

  // Process cycling data
  if (powerCurve && powerCurve.available) {
    const ftp = powerCurve.currentEftp || powerCurve.eFTP || powerCurve.ftp;
    result.cycling = {
      available: true,
      ftp: ftp,
      wPrime: powerCurve.wPrime,
      wPrimeKj: powerCurve.wPrime ? (powerCurve.wPrime / 1000).toFixed(1) : null,
      weight: powerCurve.weight,
      // Standard 7-zone power model (% of FTP)
      zones: [
        { zone: 'Z1', name: 'Recovery', minPct: 0, maxPct: 55, minWatts: 0, maxWatts: Math.round(ftp * 0.55) },
        { zone: 'Z2', name: 'Endurance', minPct: 56, maxPct: 75, minWatts: Math.round(ftp * 0.56), maxWatts: Math.round(ftp * 0.75) },
        { zone: 'Z3', name: 'Tempo', minPct: 76, maxPct: 87, minWatts: Math.round(ftp * 0.76), maxWatts: Math.round(ftp * 0.87) },
        { zone: 'SS', name: 'Sweet Spot', minPct: 88, maxPct: 94, minWatts: Math.round(ftp * 0.88), maxWatts: Math.round(ftp * 0.94) },
        { zone: 'Z4', name: 'Threshold', minPct: 95, maxPct: 105, minWatts: Math.round(ftp * 0.95), maxWatts: Math.round(ftp * 1.05) },
        { zone: 'Z5', name: 'VO2max', minPct: 106, maxPct: 120, minWatts: Math.round(ftp * 1.06), maxWatts: Math.round(ftp * 1.20) },
        { zone: 'Z6', name: 'Anaerobic', minPct: 121, maxPct: 150, minWatts: Math.round(ftp * 1.21), maxWatts: Math.round(ftp * 1.50) }
      ]
    };
  }

  // Process running data
  if (runningData && runningData.available && runningData.criticalSpeedMs) {
    const csMs = runningData.criticalSpeedMs;
    const csPace = runningData.criticalSpeed; // min/km format

    // Helper to convert m/s to min/km pace string
    const msToMinKm = function(ms) {
      if (!ms || ms <= 0) return null;
      const secsPerKm = 1000 / ms;
      const mins = Math.floor(secsPerKm / 60);
      const secs = Math.round(secsPerKm % 60);
      return mins + ':' + (secs < 10 ? '0' : '') + secs;
    };

    result.running = {
      available: true,
      criticalSpeed: csPace,
      criticalSpeedMs: csMs,
      dPrime: runningData.dPrime,
      thresholdPace: runningData.thresholdPace,
      // Running zones based on % of Critical Speed
      zones: [
        { zone: 'Z1', name: 'Recovery', minPct: 0, maxPct: 78, pace: msToMinKm(csMs * 0.78), paceRange: 'slower than ' + msToMinKm(csMs * 0.78) },
        { zone: 'Z2', name: 'Easy/Aerobic', minPct: 78, maxPct: 88, pace: msToMinKm(csMs * 0.83), paceRange: msToMinKm(csMs * 0.78) + ' - ' + msToMinKm(csMs * 0.88) },
        { zone: 'Z3', name: 'Tempo', minPct: 88, maxPct: 95, pace: msToMinKm(csMs * 0.915), paceRange: msToMinKm(csMs * 0.88) + ' - ' + msToMinKm(csMs * 0.95) },
        { zone: 'Z4', name: 'Threshold', minPct: 95, maxPct: 100, pace: csPace, paceRange: msToMinKm(csMs * 0.95) + ' - ' + csPace },
        { zone: 'Z5', name: 'VO2max', minPct: 100, maxPct: 108, pace: msToMinKm(csMs * 1.04), paceRange: csPace + ' - ' + msToMinKm(csMs * 1.08) },
        { zone: 'Z6', name: 'Anaerobic', minPct: 108, maxPct: 130, pace: msToMinKm(csMs * 1.15), paceRange: 'faster than ' + msToMinKm(csMs * 1.08) }
      ]
    };
  }

  // Build cross-sport equivalencies if both sports available
  if (result.cycling.available && result.running.available) {
    result.available = true;

    // Zone equivalency mapping (same physiological stimulus)
    result.equivalencies = [
      {
        zone: 'Recovery',
        description: 'Easy movement, active recovery',
        cycling: { zone: 'Z1', watts: '< ' + result.cycling.zones[0].maxWatts + 'W', pctFtp: '< 55%' },
        running: { zone: 'Z1', pace: result.running.zones[0].paceRange, pctCS: '< 78%' },
        physiological: 'Promotes blood flow without stress'
      },
      {
        zone: 'Endurance',
        description: 'Aerobic base building',
        cycling: { zone: 'Z2', watts: result.cycling.zones[1].minWatts + '-' + result.cycling.zones[1].maxWatts + 'W', pctFtp: '56-75%' },
        running: { zone: 'Z2', pace: result.running.zones[1].paceRange, pctCS: '78-88%' },
        physiological: 'Fat oxidation, mitochondrial development'
      },
      {
        zone: 'Tempo',
        description: 'Moderate sustained effort',
        cycling: { zone: 'Z3', watts: result.cycling.zones[2].minWatts + '-' + result.cycling.zones[2].maxWatts + 'W', pctFtp: '76-87%' },
        running: { zone: 'Z3', pace: result.running.zones[2].paceRange, pctCS: '88-95%' },
        physiological: 'Lactate clearance, aerobic capacity'
      },
      {
        zone: 'Threshold',
        description: 'Max sustained 40-60min effort',
        cycling: { zone: 'Z4', watts: result.cycling.zones[4].minWatts + '-' + result.cycling.zones[4].maxWatts + 'W', pctFtp: '95-105%' },
        running: { zone: 'Z4', pace: result.running.zones[3].paceRange, pctCS: '95-100%' },
        physiological: 'Lactate threshold improvement'
      },
      {
        zone: 'VO2max',
        description: 'Hard 3-8min efforts',
        cycling: { zone: 'Z5', watts: result.cycling.zones[5].minWatts + '-' + result.cycling.zones[5].maxWatts + 'W', pctFtp: '106-120%' },
        running: { zone: 'Z5', pace: result.running.zones[4].paceRange, pctCS: '100-108%' },
        physiological: 'Maximal oxygen uptake'
      },
      {
        zone: 'Anaerobic',
        description: 'Short max efforts <2min',
        cycling: { zone: 'Z6', watts: '> ' + result.cycling.zones[6].minWatts + 'W', pctFtp: '> 121%' },
        running: { zone: 'Z6', pace: result.running.zones[5].paceRange, pctCS: '> 108%' },
        physiological: 'Glycolytic capacity, neuromuscular'
      }
    ];

    // Calculate anaerobic capacity comparison
    const wPrimeKj = result.cycling.wPrime ? result.cycling.wPrime / 1000 : null;
    const dPrime = result.running.dPrime;

    result.crossSportInsights = {
      thresholdComparison: {
        cycling: result.cycling.ftp + 'W',
        running: result.running.criticalSpeed + '/km',
        note: 'Both represent ~1hr max sustainable effort'
      },
      anaerobicCapacity: {
        cycling: wPrimeKj ? wPrimeKj + ' kJ (W\')' : 'Not available',
        running: dPrime ? Math.round(dPrime) + 'm (D\')' : 'Not available',
        note: 'Higher values = better short, hard efforts'
      }
    };
  }

  return result;
}

/**
 * Get equivalent running pace for a cycling zone
 * @param {string} cyclingZone - Cycling zone (Z1, Z2, Z3, SS, Z4, Z5, Z6)
 * @param {object} equivalencies - Output from calculateCrossSportEquivalency()
 * @returns {object} Equivalent running zone and pace
 */
function getRunningEquivalent(cyclingZone, equivalencies) {
  if (!equivalencies || !equivalencies.available) return null;

  const zoneMap = {
    'Z1': 'Recovery',
    'Z2': 'Endurance',
    'Z3': 'Tempo',
    'SS': 'Threshold',
    'Z4': 'Threshold',
    'Z5': 'VO2max',
    'Z6': 'Anaerobic'
  };

  const targetZone = zoneMap[cyclingZone.toUpperCase()];
  if (!targetZone) return null;

  const equiv = equivalencies.equivalencies.find(function(e) {
    return e.zone === targetZone;
  });

  return equiv ? equiv.running : null;
}

/**
 * Get equivalent cycling power for a running zone
 * @param {string} runningZone - Running zone (Z1, Z2, Z3, Z4, Z5, Z6)
 * @param {object} equivalencies - Output from calculateCrossSportEquivalency()
 * @returns {object} Equivalent cycling zone and power
 */
function getCyclingEquivalent(runningZone, equivalencies) {
  if (!equivalencies || !equivalencies.available) return null;

  const zoneMap = {
    'Z1': 'Recovery',
    'Z2': 'Endurance',
    'Z3': 'Tempo',
    'Z4': 'Threshold',
    'Z5': 'VO2max',
    'Z6': 'Anaerobic'
  };

  const targetZone = zoneMap[runningZone.toUpperCase()];
  if (!targetZone) return null;

  const equiv = equivalencies.equivalencies.find(function(e) {
    return e.zone === targetZone;
  });

  return equiv ? equiv.cycling : null;
}

/**
 * Generate AI-powered cross-sport training recommendations
 * @param {object} equivalencies - Output from calculateCrossSportEquivalency()
 * @param {object} zoneProgression - Zone progression data (optional)
 * @param {object} phaseInfo - Training phase info
 * @param {object} goals - Goal events
 * @returns {object} AI recommendations for cross-sport training
 */
function generateCrossSportRecommendations(equivalencies, zoneProgression, phaseInfo, goals) {
  if (!equivalencies || !equivalencies.available) {
    return {
      available: false,
      reason: 'Both cycling and running data required'
    };
  }

  const langName = getPromptLanguage();

  // Build context about current fitness in both sports
  let zoneContext = '';
  if (zoneProgression && zoneProgression.available) {
    zoneContext = '\n**ZONE PROGRESSION LEVELS (both sports combined):**\n' +
      Object.entries(zoneProgression.progression).map(function(entry) {
        return '- ' + entry[0].charAt(0).toUpperCase() + entry[0].slice(1) + ': Level ' + entry[1].level + ' (' + entry[1].trend + ')';
      }).join('\n') +
      '\n- Focus areas: ' + zoneProgression.focusAreas.join(', ') +
      '\n- Strengths: ' + zoneProgression.strengths.join(', ');
  }

  const prompt = 'You are a multi-sport endurance coach analyzing an athlete\'s cycling and running fitness.\n\n' +
    '**CYCLING FITNESS:**\n' +
    '- FTP: ' + equivalencies.cycling.ftp + 'W\n' +
    '- W\' (Anaerobic Capacity): ' + (equivalencies.cycling.wPrimeKj || 'Unknown') + ' kJ\n' +
    (equivalencies.cycling.weight ? '- Weight: ' + equivalencies.cycling.weight + 'kg (' + (equivalencies.cycling.ftp / equivalencies.cycling.weight).toFixed(2) + ' W/kg)\n' : '') +
    '\n**RUNNING FITNESS:**\n' +
    '- Critical Speed: ' + equivalencies.running.criticalSpeed + '/km\n' +
    '- D\' (Anaerobic Capacity): ' + (equivalencies.running.dPrime ? Math.round(equivalencies.running.dPrime) + 'm' : 'Unknown') + '\n' +
    '- Threshold Pace: ' + (equivalencies.running.thresholdPace || equivalencies.running.criticalSpeed) + '/km\n' +
    zoneContext + '\n\n' +
    '**TRAINING CONTEXT:**\n' +
    '- Phase: ' + (phaseInfo?.phaseName || 'Build') + ' (' + (phaseInfo?.weeksOut || '?') + ' weeks to goal)\n' +
    (goals?.primaryGoal ? '- Primary Goal: ' + goals.primaryGoal.name + ' (' + goals.primaryGoal.date + ', ' + (goals.primaryGoal.type || 'unknown type') + ')\n' : '') +
    '\n**YOUR TASK:**\n' +
    'Provide personalized cross-sport training recommendations.\n\n' +
    'Write all output in ' + langName + '.\n\n' +
    '**Output JSON only:**\n{\n  "crossTrainingStrategy": "Overall approach to mixing cycling and running",\n  "cyclingToRunningTransfer": {\n    "summary": "How cycling fitness supports running",\n    "bestZones": ["zones that transfer well"],\n    "tip": "Specific advice"\n  },\n  "runningToCyclingTransfer": {\n    "summary": "How running fitness supports cycling",\n    "bestZones": ["zones that transfer well"],\n    "tip": "Specific advice"\n  },\n  "weeklyMixRecommendation": {\n    "cyclingDays": 3,\n    "runningDays": 2,\n    "rationale": "Why this mix works for current goals"\n  },\n  "keyInsight": "Most important cross-sport observation",\n  "warnings": ["Any concerns about current approach"]\n}';

  try {
    const response = callGeminiAPIText(prompt);
    if (!response || typeof response !== 'string') {
      return generateFallbackCrossSportRecommendations(equivalencies);
    }

    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return generateFallbackCrossSportRecommendations(equivalencies);
    }

    const parsed = JSON.parse(jsonMatch[0]);
    parsed.available = true;
    parsed.aiEnhanced = true;

    return parsed;
  } catch (e) {
    Logger.log('AI cross-sport recommendations failed: ' + e.toString());
    return generateFallbackCrossSportRecommendations(equivalencies);
  }
}

/**
 * Fallback cross-sport recommendations when AI is unavailable
 */
function generateFallbackCrossSportRecommendations(equivalencies) {
  return {
    available: true,
    aiEnhanced: false,
    crossTrainingStrategy: 'Mix cycling and running to build aerobic fitness while managing sport-specific stress.',
    cyclingToRunningTransfer: {
      summary: 'Cycling builds aerobic base with less impact stress',
      bestZones: ['Endurance', 'Tempo', 'Threshold'],
      tip: 'Use cycling for volume; use running for sport-specific work'
    },
    runningToCyclingTransfer: {
      summary: 'Running develops VO2max and leg strength efficiently',
      bestZones: ['Endurance', 'VO2max'],
      tip: 'Short runs can maintain running fitness while focusing on cycling'
    },
    weeklyMixRecommendation: {
      cyclingDays: 3,
      runningDays: 2,
      rationale: 'Balanced approach for multi-sport fitness'
    },
    keyInsight: 'FTP (' + equivalencies.cycling.ftp + 'W) and Critical Speed (' + equivalencies.running.criticalSpeed + '/km) represent equivalent threshold efforts.',
    warnings: []
  };
}

/**
 * Format cross-sport equivalency for email/display
 * @param {object} equivalencies - Output from calculateCrossSportEquivalency()
 * @returns {string} Formatted text section
 */
function formatCrossSportSection(equivalencies) {
  if (!equivalencies || !equivalencies.available) {
    return '';
  }

  const t = getTranslations();

  let section = '\n-----------------------------------\n';
  section += (t.cross_sport_title || 'Cross-Sport Equivalencies') + '\n';
  section += '-----------------------------------\n';

  // Threshold comparison
  section += '\n' + (t.threshold_comparison || 'Threshold Comparison') + ':\n';
  section += '- Cycling FTP: ' + equivalencies.cycling.ftp + 'W\n';
  section += '- Running CS: ' + equivalencies.running.criticalSpeed + '/km\n';

  // Zone equivalencies table
  section += '\n' + (t.zone_equivalencies || 'Zone Equivalencies') + ':\n';
  section += 'Zone       | Cycling        | Running\n';
  section += '-----------|----------------|----------------\n';

  for (const equiv of equivalencies.equivalencies) {
    const zoneName = equiv.zone.padEnd(10);
    const cyclingInfo = (equiv.cycling.pctFtp).padEnd(14);
    const runningInfo = equiv.running.pctCS;
    section += zoneName + ' | ' + cyclingInfo + ' | ' + runningInfo + '\n';
  }

  // Anaerobic capacity comparison
  if (equivalencies.crossSportInsights) {
    section += '\n' + (t.anaerobic_capacity || 'Anaerobic Capacity') + ':\n';
    section += '- Cycling W\': ' + equivalencies.crossSportInsights.anaerobicCapacity.cycling + '\n';
    section += '- Running D\': ' + equivalencies.crossSportInsights.anaerobicCapacity.running + '\n';
  }

  return section;
}

// =========================================================
// PERSONALIZED ZONE BOUNDARIES
// =========================================================

/**
 * Analyze power curve to determine personalized zone boundaries
 * Uses power duration decay patterns to identify individual physiology
 * @returns {object} Zone boundary analysis with recommendations
 */
function analyzeZoneBoundaries() {
  const powerCurve = fetchPowerCurve();

  if (!powerCurve || !powerCurve.available) {
    return { available: false, reason: 'Power curve not available' };
  }

  const ftp = powerCurve.currentEftp || powerCurve.eFTP || powerCurve.ftp;
  if (!ftp) {
    return { available: false, reason: 'FTP not available' };
  }

  // Calculate key power ratios (relative to FTP)
  const ratios = {
    peak5s: powerCurve.peak5s / ftp,
    peak1min: powerCurve.peak1min / ftp,
    peak5min: powerCurve.peak5min / ftp,
    peak20min: powerCurve.peak20min / ftp,
    peak60min: powerCurve.peak60min / ftp
  };

  // Standard benchmarks for comparison
  const benchmarks = {
    peak5s: 2.0,
    peak1min: 1.35,
    peak5min: 1.10,
    peak20min: 1.05,
    peak60min: 0.95
  };

  // Analyze decay patterns
  const analysis = {
    available: true,
    ftp: ftp,
    ratios: ratios,
    sprintCapacity: ratios.peak5s > benchmarks.peak5s * 1.1 ? 'high' :
                    ratios.peak5s < benchmarks.peak5s * 0.9 ? 'low' : 'normal',
    anaerobicCapacity: ratios.peak1min > benchmarks.peak1min * 1.1 ? 'high' :
                       ratios.peak1min < benchmarks.peak1min * 0.9 ? 'low' : 'normal',
    vo2maxCapacity: ratios.peak5min > benchmarks.peak5min * 1.05 ? 'high' :
                    ratios.peak5min < benchmarks.peak5min * 0.95 ? 'low' : 'normal',
    aerobicDurability: ratios.peak60min / ratios.peak20min > 0.92 ? 'high' :
                       ratios.peak60min / ratios.peak20min < 0.88 ? 'low' : 'normal',
    tteEstimate: powerCurve.wPrime ? Math.round(powerCurve.wPrime / 500) : null
  };

  // Derive zone boundary recommendations
  analysis.zoneRecommendations = deriveZoneRecommendations(analysis, ftp);

  return analysis;
}

/**
 * Derive personalized zone boundary recommendations based on power analysis
 * @param {object} analysis - Output from power ratio analysis
 * @param {number} ftp - Current FTP
 * @returns {object} Recommended zone boundaries with reasoning
 */
function deriveZoneRecommendations(analysis, ftp) {
  const recommendations = {
    currentZones: {
      z1: { low: 0, high: 55, name: 'Recovery' },
      z2: { low: 55, high: 75, name: 'Endurance' },
      z3: { low: 75, high: 90, name: 'Tempo' },
      z4: { low: 90, high: 105, name: 'Threshold' },
      z5: { low: 105, high: 120, name: 'VO2max' },
      z6: { low: 120, high: 150, name: 'Anaerobic' }
    },
    suggestedZones: {},
    adjustments: [],
    insights: []
  };

  // Copy current zones as starting point
  Object.keys(recommendations.currentZones).forEach(function(zone) {
    recommendations.suggestedZones[zone] = Object.assign({}, recommendations.currentZones[zone]);
  });

  // Adjustment 1: Aerobic durability affects Z2/Z3 boundary
  if (analysis.aerobicDurability === 'high') {
    recommendations.suggestedZones.z2.high = 78;
    recommendations.suggestedZones.z3.low = 78;
    recommendations.adjustments.push('Extended Z2 upper limit (78% vs 75%) - high aerobic durability');
    recommendations.insights.push('You can sustain steady endurance efforts longer than average - your Z2 ceiling is higher');
  } else if (analysis.aerobicDurability === 'low') {
    recommendations.suggestedZones.z2.high = 72;
    recommendations.suggestedZones.z3.low = 72;
    recommendations.adjustments.push('Lowered Z2 upper limit (72% vs 75%) - limited aerobic durability');
    recommendations.insights.push('Power drops faster over long efforts - keep endurance rides truly easy');
  }

  // Adjustment 2: VO2max capacity affects Z4/Z5 boundary
  if (analysis.vo2maxCapacity === 'high') {
    recommendations.suggestedZones.z4.high = 108;
    recommendations.suggestedZones.z5.low = 108;
    recommendations.adjustments.push('Raised Z4/Z5 boundary (108% vs 105%) - strong VO2max');
    recommendations.insights.push('Your high aerobic capacity means you can sustain above-FTP efforts longer');
  } else if (analysis.vo2maxCapacity === 'low') {
    recommendations.suggestedZones.z4.high = 102;
    recommendations.suggestedZones.z5.low = 102;
    recommendations.adjustments.push('Lowered Z4/Z5 boundary (102% vs 105%) - developing VO2max');
    recommendations.insights.push('Focus on building VO2max - intervals at 102-115% will be challenging');
  }

  // Adjustment 3: Anaerobic capacity affects Z5/Z6 boundary
  if (analysis.anaerobicCapacity === 'high') {
    recommendations.suggestedZones.z5.high = 125;
    recommendations.suggestedZones.z6.low = 125;
    recommendations.adjustments.push('Raised Z5/Z6 boundary (125% vs 120%) - high anaerobic capacity');
    recommendations.insights.push('Strong anaerobic system - you can handle higher VO2max targets');
  } else if (analysis.anaerobicCapacity === 'low') {
    recommendations.suggestedZones.z5.high = 115;
    recommendations.suggestedZones.z6.low = 115;
    recommendations.adjustments.push('Lowered Z5/Z6 boundary (115% vs 120%) - developing anaerobic');
    recommendations.insights.push('Anaerobic capacity needs development - focus on repeatability over peak power');
  }

  // Adjustment 4: TTE affects threshold zone width
  if (analysis.tteEstimate) {
    if (analysis.tteEstimate > 50) {
      recommendations.insights.push('High W\' (' + analysis.tteEstimate + ' min TTE) - can tolerate longer threshold efforts');
    } else if (analysis.tteEstimate < 30) {
      recommendations.insights.push('Lower W\' (' + analysis.tteEstimate + ' min TTE) - use shorter threshold intervals with more recovery');
    }
  }

  return recommendations;
}

/**
 * Generate AI-powered zone boundary recommendations
 * @param {object} zoneAnalysis - Output from analyzeZoneBoundaries()
 * @param {object} goals - Goal events for context
 * @returns {object} AI recommendations
 */
function generateAIZoneRecommendations(zoneAnalysis, goals) {
  if (!zoneAnalysis || !zoneAnalysis.available) {
    return { available: false };
  }

  const langName = getPromptLanguage();

  const prompt = 'Analyze this cyclist\'s power profile and explain the personalized zone recommendations.\n\n' +
    '**Power Ratios (vs FTP ' + zoneAnalysis.ftp + 'W):**\n' +
    '5s: ' + zoneAnalysis.ratios.peak5s.toFixed(2) + 'x | 1min: ' + zoneAnalysis.ratios.peak1min.toFixed(2) + 'x | 5min: ' + zoneAnalysis.ratios.peak5min.toFixed(2) + 'x | 60min: ' + zoneAnalysis.ratios.peak60min.toFixed(2) + 'x\n\n' +
    '**Assessment:** Sprint=' + zoneAnalysis.sprintCapacity + ', Anaerobic=' + zoneAnalysis.anaerobicCapacity + ', VO2max=' + zoneAnalysis.vo2maxCapacity + ', Durability=' + zoneAnalysis.aerobicDurability + '\n\n' +
    '**Zone Adjustments Made:**\n' + zoneAnalysis.zoneRecommendations.adjustments.join('; ') + '\n\n' +
    (goals?.primaryGoal ? 'Goal: ' + goals.primaryGoal.name + ' in ' + goals.primaryGoal.weeksOut + ' weeks\n\n' : '') +
    'Return JSON:\n{\n  "profileType": "short name like \'Sprinter\', \'Diesel\', \'Puncher\', \'Time-Trialist\', \'All-Rounder\'",\n  "summary": "2 sentences describing this athlete\'s power characteristics",\n  "philosophy": "1 sentence on zone personalization approach",\n  "implications": ["training implication 1", "training implication 2"],\n  "warning": "optional caution or null"\n}\n\nWrite in ' + langName + '.';

  try {
    const response = callGeminiAPIText(prompt);
    if (response) {
      const parsed = parseGeminiJsonResponse(response);
      if (parsed && parsed.profileType) {
        return {
          available: true,
          aiEnhanced: true,
          profileType: parsed.profileType,
          profileSummary: parsed.summary,
          zonePhilosophy: parsed.philosophy,
          trainingImplications: parsed.implications || [],
          warnings: parsed.warning ? [parsed.warning] : []
        };
      }
    }
  } catch (e) {
    Logger.log('AI zone recommendation failed: ' + e.toString());
  }

  // Fallback to rule-based insights
  return {
    available: true,
    aiEnhanced: false,
    profileType: determineProfileType(zoneAnalysis),
    profileSummary: 'Power profile analysis complete',
    zonePhilosophy: 'Zones adjusted based on power duration curve shape',
    trainingImplications: zoneAnalysis.zoneRecommendations.insights,
    warnings: []
  };
}

/**
 * Determine athlete profile type from analysis
 */
function determineProfileType(analysis) {
  if (analysis.sprintCapacity === 'high' && analysis.anaerobicCapacity === 'high') {
    return analysis.aerobicDurability === 'high' ? 'All-Rounder' : 'Puncher';
  }
  if (analysis.aerobicDurability === 'high' && analysis.vo2maxCapacity !== 'high') {
    return 'Diesel';
  }
  if (analysis.vo2maxCapacity === 'high' && analysis.aerobicDurability === 'high') {
    return 'Time-Trialist';
  }
  if (analysis.sprintCapacity === 'high') {
    return 'Sprinter';
  }
  return 'Balanced';
}
