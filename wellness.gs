/**
 * IntervalCoach - Wellness & Recovery Data
 *
 * Fetches and processes wellness data from multiple sources:
 * - Whoop API (real-time, if configured)
 * - Intervals.icu (synced from Whoop/Garmin/Oura)
 */

// =========================================================
// SMART WELLNESS DATA FETCHING
// =========================================================

/**
 * Fetch today's wellness data with Whoop API as primary source
 * Falls back to Intervals.icu if Whoop is not configured or fails
 * @returns {object} Wellness record for today
 */
function fetchTodayWellness() {
  // Try Whoop API first (real-time data)
  if (typeof isWhoopConfigured === 'function' && isWhoopConfigured()) {
    try {
      const whoopData = fetchWhoopWellnessData();
      if (whoopData.available) {
        Logger.log('Using Whoop API for today\'s wellness (real-time)');
        return {
          date: whoopData.date,
          sleep: whoopData.sleep,
          sleepQuality: null,
          sleepScore: whoopData.sleepScore,
          restingHR: whoopData.restingHR,
          hrv: whoopData.hrv,
          recovery: whoopData.recovery,
          spO2: whoopData.spO2,
          respiration: null,
          soreness: null,
          fatigue: null,
          stress: null,
          mood: null,
          source: 'whoop_api'
        };
      } else {
        Logger.log('Whoop API: ' + whoopData.reason + ', falling back to Intervals.icu');
      }
    } catch (e) {
      Logger.log('Whoop API error: ' + e.toString() + ', falling back to Intervals.icu');
    }
  }

  // Fallback to Intervals.icu
  const icuData = fetchWellnessData(1, 0);
  if (icuData.length > 0) {
    icuData[0].source = 'intervals_icu';
    return icuData[0];
  }

  return null;
}

/**
 * Fetch wellness data with Whoop enhancement for today
 * Merges real-time Whoop data with Intervals.icu historical data
 * @param {number} daysBack - How many days back to fetch
 * @param {number} daysBackEnd - End offset from today
 * @returns {Array} Array of wellness records
 */
function fetchWellnessDataEnhanced(daysBack = 7, daysBackEnd = 0) {
  // Get Intervals.icu data for historical records
  const icuRecords = fetchWellnessData(daysBack, daysBackEnd);

  // If fetching today's data, try to enhance with Whoop API
  if (daysBackEnd === 0 && typeof isWhoopConfigured === 'function' && isWhoopConfigured()) {
    try {
      const whoopData = fetchWhoopWellnessData();
      if (whoopData.available) {
        const today = formatDateISO(new Date());

        // Find today's record in ICU data
        const todayIdx = icuRecords.findIndex(r => r.date === today);

        // Create enhanced today record
        const enhancedToday = {
          date: today,
          sleep: whoopData.sleep || (todayIdx >= 0 ? icuRecords[todayIdx].sleep : null),
          sleepQuality: todayIdx >= 0 ? icuRecords[todayIdx].sleepQuality : null,
          sleepScore: whoopData.sleepScore || (todayIdx >= 0 ? icuRecords[todayIdx].sleepScore : null),
          restingHR: whoopData.restingHR,
          hrv: whoopData.hrv,
          recovery: whoopData.recovery,
          spO2: whoopData.spO2 || (todayIdx >= 0 ? icuRecords[todayIdx].spO2 : null),
          respiration: todayIdx >= 0 ? icuRecords[todayIdx].respiration : null,
          // Subjective markers from Intervals.icu (user-entered)
          soreness: todayIdx >= 0 ? icuRecords[todayIdx].soreness : null,
          fatigue: todayIdx >= 0 ? icuRecords[todayIdx].fatigue : null,
          stress: todayIdx >= 0 ? icuRecords[todayIdx].stress : null,
          mood: todayIdx >= 0 ? icuRecords[todayIdx].mood : null,
          source: 'whoop_api'
        };

        // Replace or add today's record
        if (todayIdx >= 0) {
          icuRecords[todayIdx] = enhancedToday;
        } else {
          icuRecords.unshift(enhancedToday);
        }

        Logger.log('Enhanced today\'s wellness with Whoop API data');
      }
    } catch (e) {
      Logger.log('Whoop enhancement failed: ' + e.toString());
    }
  }

  return icuRecords;
}

// =========================================================
// INTERVALS.ICU WELLNESS DATA
// =========================================================

/**
 * Fetch wellness data from Intervals.icu for the specified period
 * @param {number} daysBack - How many days back to fetch (default 7)
 * @param {number} daysBackEnd - End offset from today (default 0)
 * @returns {Array} Array of wellness records sorted by date descending
 */
function fetchWellnessData(daysBack = 7, daysBackEnd = 0) {
  const today = new Date();
  const newest = new Date(today);
  newest.setDate(today.getDate() - daysBackEnd);
  const oldest = new Date(today);
  oldest.setDate(today.getDate() - daysBack);

  const newestStr = formatDateISO(newest);
  const oldestStr = formatDateISO(oldest);

  const endpoint = "/athlete/0/wellness?oldest=" + oldestStr + "&newest=" + newestStr;
  const result = fetchIcuApi(endpoint);

  if (!result.success) {
    Logger.log("Failed to fetch wellness data: " + result.error);
    return [];
  }

  const dataArray = result.data;
  if (!Array.isArray(dataArray)) {
    return [];
  }

  // Map and sort by date descending (newest first)
  const wellnessRecords = dataArray.map(function(data) {
    // Convert sleepSecs to hours (API returns seconds)
    const sleepHours = data.sleepSecs ? data.sleepSecs / 3600 : 0;

    return {
      date: data.id,                             // Date is stored as "id"
      sleep: sleepHours,                         // Converted to hours
      sleepQuality: data.sleepQuality || null,   // 1-5 scale
      sleepScore: data.sleepScore || null,       // Whoop sleep score (0-100)
      restingHR: data.restingHR || null,         // Resting heart rate
      hrv: data.hrv || null,                     // HRV rMSSD
      hrvSDNN: data.hrvSDNN || null,             // HRV SDNN (if available)
      recovery: data.readiness || null,          // Whoop recovery score is stored as "readiness"
      spO2: data.spO2 || null,                   // Blood oxygen
      respiration: data.respiration || null,     // Breathing rate
      soreness: data.soreness || null,           // 1-5 scale
      fatigue: data.fatigue || null,             // 1-5 scale
      stress: data.stress || null,               // 1-5 scale
      mood: data.mood || null                    // 1-5 scale
    };
  });

  // Sort by date descending (newest first)
  wellnessRecords.sort(function(a, b) {
    return b.date.localeCompare(a.date);
  });

  return wellnessRecords;
}

// =========================================================
// WELLNESS SUMMARY & ANALYSIS
// =========================================================

/**
 * Create a wellness summary from wellness records
 * @param {Array} wellnessRecords - Array of wellness records
 * @returns {object} Summary with recovery status and recommendations
 */
function createWellnessSummary(wellnessRecords) {
  if (!wellnessRecords || wellnessRecords.length === 0) {
    return {
      available: false,
      message: "No wellness data available"
    };
  }

  // Find the most recent record with actual wellness data (sleep/HRV/recovery)
  // Today's data might be empty if Whoop hasn't synced yet
  const latestWithData = wellnessRecords.find(r => r.sleep > 0 || r.hrv || r.recovery) || wellnessRecords[0];
  const last7Days = wellnessRecords.slice(0, 7);

  // Calculate averages for trend analysis
  const avgSleep = average(last7Days.map(w => w.sleep).filter(v => v > 0));
  const avgHRV = average(last7Days.map(w => w.hrv).filter(v => v != null));
  const avgRestingHR = average(last7Days.map(w => w.restingHR).filter(v => v != null));
  const avgRecovery = average(last7Days.map(w => w.recovery).filter(v => v != null));

  // Store/update baseline if we have enough records
  if (wellnessRecords.length >= 7) {
    storeWellnessBaseline(wellnessRecords);
  }

  // Analyze vs personal baseline
  const baselineAnalysis = analyzeWellnessVsBaseline(latestWithData);

  // Determine recovery status - AI-enhanced with personal baselines
  let recoveryStatus = "Unknown";
  let intensityModifier = TRAINING_CONSTANTS.INTENSITY.GREEN_MODIFIER;
  let aiEnhanced = false;
  let personalizedReason = null;

  // Build today's data object for AI
  const todayData = {
    recovery: latestWithData.recovery,
    hrv: latestWithData.hrv,
    sleep: latestWithData.sleep,
    restingHR: latestWithData.restingHR,
    soreness: latestWithData.soreness,
    fatigue: latestWithData.fatigue,
    stress: latestWithData.stress,
    mood: latestWithData.mood
  };

  const averagesData = {
    recovery: avgRecovery,
    hrv: avgHRV,
    sleep: avgSleep,
    restingHR: avgRestingHR
  };

  // Try AI-driven assessment first (pass baseline analysis for 30-day context)
  try {
    const aiAssessment = generateAIRecoveryAssessment(todayData, averagesData, baselineAnalysis);

    if (aiAssessment && aiAssessment.recoveryStatus) {
      Logger.log("AI Recovery Assessment: " + JSON.stringify(aiAssessment));
      recoveryStatus = aiAssessment.recoveryStatus;
      intensityModifier = aiAssessment.intensityModifier || TRAINING_CONSTANTS.INTENSITY.GREEN_MODIFIER;
      personalizedReason = aiAssessment.personalizedReason || null;
      aiEnhanced = true;
    }
  } catch (e) {
    Logger.log("AI recovery assessment failed, using fallback: " + e.toString());
  }

  // ===== FALLBACK: Fixed threshold logic =====
  if (!aiEnhanced) {
    Logger.log("Using fallback fixed-threshold recovery assessment");

    if (latestWithData.recovery != null) {
      if (latestWithData.recovery >= TRAINING_CONSTANTS.RECOVERY.GREEN_THRESHOLD) {
        recoveryStatus = "Green (Primed)";
        intensityModifier = TRAINING_CONSTANTS.INTENSITY.GREEN_MODIFIER;
      } else if (latestWithData.recovery >= TRAINING_CONSTANTS.RECOVERY.RED_THRESHOLD) {
        recoveryStatus = "Yellow (Recovering)";
        intensityModifier = TRAINING_CONSTANTS.INTENSITY.YELLOW_MODIFIER;
      } else {
        recoveryStatus = "Red (Strained)";
        intensityModifier = TRAINING_CONSTANTS.INTENSITY.RED_MODIFIER;
      }
    } else if (latestWithData.hrv != null && avgHRV > 0) {
      // Fallback: Use HRV trend if no recovery score
      const hrvDeviation = (latestWithData.hrv - avgHRV) / avgHRV;
      if (hrvDeviation >= TRAINING_CONSTANTS.HRV_DEVIATION_THRESHOLD) {
        recoveryStatus = "Above Baseline (Well Recovered)";
        intensityModifier = TRAINING_CONSTANTS.INTENSITY.GREEN_MODIFIER;
      } else if (hrvDeviation >= -0.1) {
        recoveryStatus = "Normal";
        intensityModifier = 0.9;
      } else {
        recoveryStatus = "Below Baseline (Fatigued)";
        intensityModifier = TRAINING_CONSTANTS.INTENSITY.RED_MODIFIER;
      }
    }
  }

  // Sleep quality assessment
  let sleepStatus = "Unknown";
  if (latestWithData.sleep > 0) {
    if (latestWithData.sleep >= 7.5) sleepStatus = "Excellent";
    else if (latestWithData.sleep >= 6.5) sleepStatus = "Adequate";
    else if (latestWithData.sleep >= 5) sleepStatus = "Poor";
    else sleepStatus = "Insufficient";
  }

  // ===== Z-SCORE INTENSITY MODIFIER =====
  // Use continuous z-score based modifier when baseline data is available
  // This replaces the discrete Red/Yellow/Green categories with smooth scaling
  let zScoreIntensity = null;
  if (baselineAnalysis?.zScoreIntensity?.modifier != null) {
    zScoreIntensity = baselineAnalysis.zScoreIntensity;

    // Override the discrete intensity modifier with z-score based continuous modifier
    // Only if we have high or medium confidence (actual baseline data)
    if (zScoreIntensity.confidence !== 'low') {
      intensityModifier = zScoreIntensity.modifier;
      Logger.log(`Z-Score Intensity: ${(zScoreIntensity.modifier * 100).toFixed(0)}% (${zScoreIntensity.description})`);
    }
  }

  return {
    available: true,
    today: {
      date: latestWithData.date,
      sleep: latestWithData.sleep,
      sleepQuality: latestWithData.sleepQuality,
      sleepScore: latestWithData.sleepScore,
      restingHR: latestWithData.restingHR,
      hrv: latestWithData.hrv,
      recovery: latestWithData.recovery,
      // Whoop-specific metrics
      spO2: latestWithData.spO2,
      skinTemp: latestWithData.skinTemp,
      remSleep: latestWithData.remSleep,
      deepSleep: latestWithData.deepSleep,
      sleepEfficiency: latestWithData.sleepEfficiency,
      // Subjective markers
      soreness: latestWithData.soreness,
      fatigue: latestWithData.fatigue,
      stress: latestWithData.stress,
      mood: latestWithData.mood,
      // Data source
      source: latestWithData.source
    },
    averages: {
      sleep: avgSleep,
      hrv: avgHRV,
      restingHR: avgRestingHR,
      recovery: avgRecovery
    },
    recoveryStatus: recoveryStatus,
    sleepStatus: sleepStatus,
    intensityModifier: intensityModifier,
    aiEnhanced: aiEnhanced,
    personalizedReason: personalizedReason,
    // Baseline deviation analysis
    baselineAnalysis: baselineAnalysis,
    // Z-score based continuous intensity modifier
    zScoreIntensity: zScoreIntensity
  };
}

// =========================================================
// REST DAY DETECTION
// =========================================================

/**
 * Check if a rest day is recommended based on recovery status
 * @param {object} wellness - Wellness summary object
 * @returns {boolean} True if rest is recommended
 */
function isRestDayRecommended(wellness) {
  if (!wellness?.available) return false;

  // Check for Red recovery status
  if (wellness.recoveryStatus?.includes("Red") || wellness.recoveryStatus?.includes("Strained")) {
    return true;
  }

  // Check for very low recovery score
  if (wellness.today?.recovery != null && wellness.today.recovery < TRAINING_CONSTANTS.RECOVERY.RED_THRESHOLD) {
    return true;
  }

  return false;
}

/**
 * AI-driven rest day assessment - considers full context beyond simple thresholds
 * @param {object} context - Full context for decision
 * @returns {object} { isRestDay, confidence, reasoning, alternatives }
 */
function generateAIRestDayAssessment(context) {
  // Build subjective markers context
  let subjectiveContext = '';
  if (context.wellness?.today) {
    const w = context.wellness.today;
    const markers = [];
    if (w.soreness) markers.push('Soreness: ' + w.soreness + '/5');
    if (w.fatigue) markers.push('Fatigue: ' + w.fatigue + '/5');
    if (w.stress) markers.push('Stress: ' + w.stress + '/5');
    if (w.mood) markers.push('Mood: ' + w.mood + '/5');
    if (markers.length > 0) {
      subjectiveContext = '\n- Subjective Markers: ' + markers.join(', ');
    }
  }

  // Build events context
  let eventsContext = '';
  if (context.eventTomorrow?.hasEvent) {
    let eventDesc = context.eventTomorrow.eventName
      ? `${context.eventTomorrow.category} - ${context.eventTomorrow.eventName}`
      : `${context.eventTomorrow.category} priority race`;
    if (context.eventTomorrow.eventDescription) {
      eventDesc += ` (${context.eventTomorrow.eventDescription})`;
    }
    eventsContext += '\n- EVENT TOMORROW: ' + eventDesc;
  }
  if (context.eventIn2Days?.hasEvent) {
    let eventDesc = context.eventIn2Days.eventName
      ? `${context.eventIn2Days.category} - ${context.eventIn2Days.eventName}`
      : `${context.eventIn2Days.category} priority`;
    if (context.eventIn2Days.eventDescription) {
      eventDesc += ` (${context.eventIn2Days.eventDescription})`;
    }
    eventsContext += '\n- Event in 2 days: ' + eventDesc;
  }

  // Build recent training context
  let trainingContext = '';
  if (context.recentWorkouts) {
    const rides = context.recentWorkouts.rides || [];
    const runs = context.recentWorkouts.runs || [];
    trainingContext = `
- Recent Rides (7d): ${rides.length > 0 ? rides.join(', ') : 'None'}
- Recent Runs (7d): ${runs.length > 0 ? runs.join(', ') : 'None'}
- Last Workout Intensity: ${context.lastIntensity || 0}/5 (${context.daysSinceLastWorkout || 0} days ago)
- Consecutive Training Days: ${context.consecutiveDays || 'Unknown'}`;
  }

  const prompt = `You are an expert coach deciding if today should be a REST DAY.

**RECOVERY DATA:**
- Recovery Status: ${context.wellness?.recoveryStatus || 'Unknown'}
- Recovery Score: ${context.wellness?.today?.recovery ? context.wellness.today.recovery + '%' : 'N/A'}
- Sleep: ${context.wellness?.today?.sleep ? context.wellness.today.sleep.toFixed(1) + 'h' : 'N/A'} (${context.wellness?.sleepStatus || 'Unknown'})
- HRV: ${context.wellness?.today?.hrv ? context.wellness.today.hrv + 'ms' : 'N/A'} (7d avg: ${context.wellness?.averages?.hrv ? context.wellness.averages.hrv.toFixed(0) + 'ms' : 'N/A'})${subjectiveContext}

**FITNESS & FATIGUE:**
- TSB (Form): ${context.tsb != null ? context.tsb.toFixed(1) : 'N/A'} ${context.tsb < -25 ? '(VERY FATIGUED)' : context.tsb < -15 ? '(fatigued)' : context.tsb < -5 ? '(tired)' : '(okay)'}
- CTL (Fitness): ${context.ctl ? context.ctl.toFixed(0) : 'N/A'}
- ATL (Fatigue): ${context.atl ? context.atl.toFixed(0) : 'N/A'}
${eventsContext}

**RECENT TRAINING:**${trainingContext}

**TRAINING PHASE:** ${context.phase || 'Unknown'}

**DECISION CRITERIA:**
Consider rest day if:
1. TSB < -25 (very fatigued) + Yellow/Red recovery
2. Recovery < 50% even if TSB okay
3. 4+ consecutive hard training days
4. Important race in 1-2 days (pre-race rest)
5. Subjective markers all high (soreness/fatigue/stress 4-5)
6. Sleep consistently < 6h + other warning signs

But DON'T recommend rest if:
- Green recovery with TSB > -15 (athlete is coping fine)
- Recovery Yellow but TSB > -5 (form is good)
- No subjective complaints and metrics borderline

**Output JSON only:**
{
  "isRestDay": true/false,
  "confidence": "high|medium|low",
  "reasoning": "2-3 sentence explanation",
  "alternatives": "If not rest day, what intensity is appropriate? If rest day, what light activity is okay?"
}`;

  const response = callGeminiAPIText(prompt);
  const assessment = parseGeminiJsonResponse(response);
  if (!assessment) {
    Logger.log("AI rest day assessment: Failed to parse response");
  }
  return assessment;
}

/**
 * Generate AI intensity advice for group rides (C events)
 * Considers recovery, fatigue, and upcoming schedule to advise on effort level
 * @param {object} context - { wellness, tsb, ctl, atl, eventName, eventTomorrow, recentWorkouts }
 * @returns {object} { intensity: 'easy'|'moderate'|'hard', advice, tips }
 */
function generateGroupRideAdvice(context) {
  // Build subjective markers context
  let subjectiveContext = '';
  if (context.wellness?.today) {
    const w = context.wellness.today;
    const markers = [];
    if (w.soreness) markers.push('Soreness: ' + w.soreness + '/5');
    if (w.fatigue) markers.push('Fatigue: ' + w.fatigue + '/5');
    if (w.stress) markers.push('Stress: ' + w.stress + '/5');
    if (markers.length > 0) {
      subjectiveContext = '\n- Subjective Markers: ' + markers.join(', ');
    }
  }

  // Build Whoop-specific context (SpO2, skin temp, sleep details)
  let whoopContext = '';
  if (context.wellness?.today) {
    const w = context.wellness.today;
    const whoopMarkers = [];
    if (w.spO2) whoopMarkers.push('SpO2: ' + w.spO2.toFixed(1) + '%');
    if (w.skinTemp) whoopMarkers.push('Skin Temp: ' + w.skinTemp.toFixed(1) + '°C');
    if (w.deepSleep) whoopMarkers.push('Deep Sleep: ' + w.deepSleep.toFixed(1) + 'h');
    if (w.remSleep) whoopMarkers.push('REM Sleep: ' + w.remSleep.toFixed(1) + 'h');
    if (w.sleepEfficiency) whoopMarkers.push('Sleep Efficiency: ' + w.sleepEfficiency.toFixed(0) + '%');
    if (whoopMarkers.length > 0) {
      whoopContext = '\n- Physiological: ' + whoopMarkers.join(', ');
    }
  }

  // Build upcoming events context
  let upcomingContext = '';
  if (context.eventTomorrow?.hasEvent) {
    let eventDesc = context.eventTomorrow.eventName
      ? `${context.eventTomorrow.category} - ${context.eventTomorrow.eventName}`
      : `${context.eventTomorrow.category} priority`;
    if (context.eventTomorrow.eventDescription) {
      eventDesc += ` (${context.eventTomorrow.eventDescription})`;
    }
    upcomingContext += '\n- EVENT TOMORROW: ' + eventDesc;
  }
  if (context.eventIn2Days?.hasEvent) {
    let eventDesc = context.eventIn2Days.eventName
      ? `${context.eventIn2Days.category} - ${context.eventIn2Days.eventName}`
      : `${context.eventIn2Days.category} priority`;
    if (context.eventIn2Days.eventDescription) {
      eventDesc += ` (${context.eventIn2Days.eventDescription})`;
    }
    upcomingContext += '\n- Event in 2 days: ' + eventDesc;
  }

  // Build recent training context
  let trainingContext = '';
  if (context.recentWorkouts) {
    const rides = context.recentWorkouts.rides || [];
    const runs = context.recentWorkouts.runs || [];
    trainingContext = `
- Recent Rides (7d): ${rides.length > 0 ? rides.join(', ') : 'None'}
- Recent Runs (7d): ${runs.length > 0 ? runs.join(', ') : 'None'}
- Days since last workout: ${context.daysSinceLastWorkout || 0}`;
  }

  // Build adaptive context (RPE/Feel from recent workouts)
  let adaptiveContext = '';
  if (context.adaptiveTraining?.available) {
    const fb = context.adaptiveTraining.feedback;
    const adapt = context.adaptiveTraining.adaptation;
    const adaptMarkers = [];
    if (fb.avgFeel) adaptMarkers.push('Avg Feel: ' + fb.avgFeel.toFixed(1) + '/5');
    if (fb.avgRpe) adaptMarkers.push('Avg RPE: ' + fb.avgRpe.toFixed(1) + '/10');
    if (adapt.recommendation) adaptMarkers.push('Trend: ' + adapt.recommendation);
    if (adaptMarkers.length > 0) {
      adaptiveContext = '\n- Recent Feedback: ' + adaptMarkers.join(', ');
    }
  }

  // Build zone progression context
  let zoneContext = '';
  if (context.zoneProgression?.available) {
    const prog = context.zoneProgression;
    if (prog.focusAreas?.length > 0) {
      zoneContext = '\n- Zone Focus Areas: ' + prog.focusAreas.join(', ');
    }
    if (prog.strengths?.length > 0) {
      zoneContext += '\n- Zone Strengths: ' + prog.strengths.join(', ');
    }
  }

  // Get language for localized output
  const langName = getPromptLanguage();

  const prompt = `You are an expert coach advising on how hard to push during today's GROUP RIDE.

**TODAY'S EVENT:**
${context.eventName || 'Group Ride'}${context.eventDescription ? '\nDescription: ' + context.eventDescription : ''}

**RECOVERY DATA:**
- Recovery Status: ${context.wellness?.recoveryStatus || 'Unknown'}
- Recovery Score: ${context.wellness?.today?.recovery ? context.wellness.today.recovery + '%' : 'N/A'}
- Sleep: ${context.wellness?.today?.sleep ? context.wellness.today.sleep.toFixed(1) + 'h' : 'N/A'} (${context.wellness?.sleepStatus || 'Unknown'})
- HRV: ${context.wellness?.today?.hrv ? context.wellness.today.hrv + 'ms' : 'N/A'}${subjectiveContext}${whoopContext}

**FITNESS & FATIGUE:**
- TSB (Form): ${context.tsb != null ? context.tsb.toFixed(1) : 'N/A'} ${context.tsb < -25 ? '(VERY FATIGUED)' : context.tsb < -15 ? '(fatigued)' : context.tsb < -5 ? '(tired)' : context.tsb > 5 ? '(FRESH)' : '(okay)'}
- CTL (Fitness): ${context.ctl ? context.ctl.toFixed(0) : 'N/A'}
- ATL (Fatigue): ${context.atl ? context.atl.toFixed(0) : 'N/A'}
${upcomingContext}

**RECENT TRAINING:**${trainingContext}${adaptiveContext}${zoneContext}

**TRAINING PHASE:** ${context.phase || 'Unknown'}

**CONTEXT:**
Group rides are unstructured. The athlete can't control intervals but CAN control:
- Whether to stay with the front group or sit in
- Whether to contest sprints/climbs or soft-pedal
- Overall effort level and recovery from surges

**DECISION CRITERIA:**
- EASY: TSB < -20, Red/Yellow recovery, important event coming soon, or need recovery
- MODERATE: Normal TSB (-20 to +5), Green/Yellow recovery, no critical events upcoming
- HARD (go all out): TSB > 0 (fresh), Green recovery, no important events for 3+ days, recent training was light

**IMPORTANT: Respond in ${langName}.**

**Output JSON only:**
{
  "intensity": "easy|moderate|hard",
  "advice": "1-2 sentence personalized advice in ${langName}",
  "tips": ["Tip 1 in ${langName}", "Tip 2 in ${langName}", "Tip 3 in ${langName}"]
}`;

  const response = callGeminiAPIText(prompt);
  const advice = parseGeminiJsonResponse(response);
  if (!advice) {
    Logger.log("AI group ride advice: Failed to parse response");
    // Return default moderate advice
    return {
      intensity: 'moderate',
      advice: 'Enjoy the group ride. Listen to your body and adjust effort accordingly.',
      tips: ['Stay with the group when you can', 'Don\'t chase every attack', 'Fuel and hydrate properly']
    };
  }
  return advice;
}

/**
 * Generate AI advice for A/B race events
 * Handles three scenarios: race today, race tomorrow, race yesterday
 * @param {object} context - Full training context
 * @returns {object} { scenario, strategy, tips, warmup, nutrition, recovery }
 */
function generateRaceDayAdvice(context) {
  // Determine which scenario we're in
  let scenario = 'unknown';
  let raceEvent = null;

  if (context.raceToday?.hasEvent) {
    scenario = 'race_today';
    raceEvent = context.raceToday;
  } else if (context.eventTomorrow?.hasEvent &&
             (context.eventTomorrow.category === 'A' || context.eventTomorrow.category === 'B')) {
    scenario = 'race_tomorrow';
    raceEvent = context.eventTomorrow;
  } else if (context.eventYesterday?.hadEvent &&
             (context.eventYesterday.category === 'A' || context.eventYesterday.category === 'B')) {
    scenario = 'race_yesterday';
    raceEvent = context.eventYesterday;
  }

  if (scenario === 'unknown') {
    return null;
  }

  // Build recovery context
  let recoveryContext = '';
  if (context.wellness?.today) {
    const w = context.wellness.today;
    const markers = [];
    markers.push('Recovery: ' + (w.recovery ? w.recovery + '%' : 'N/A'));
    markers.push('Sleep: ' + (w.sleep ? w.sleep.toFixed(1) + 'h' : 'N/A'));
    if (w.hrv) markers.push('HRV: ' + w.hrv + 'ms');
    if (w.restingHR) markers.push('RHR: ' + w.restingHR + 'bpm');
    if (w.spO2) markers.push('SpO2: ' + w.spO2.toFixed(1) + '%');
    if (w.deepSleep) markers.push('Deep: ' + w.deepSleep.toFixed(1) + 'h');
    recoveryContext = markers.join(', ');
  }

  // Build power/fitness context
  let fitnessContext = '';
  if (context.powerProfile?.available) {
    const pp = context.powerProfile;
    fitnessContext = `FTP: ${pp.currentEftp || pp.ftp}W`;
    if (pp.peak5min) fitnessContext += ` | 5min: ${pp.peak5min}W`;
    if (pp.peak1min) fitnessContext += ` | 1min: ${pp.peak1min}W`;
    if (pp.wPrimeKj) fitnessContext += ` | W': ${pp.wPrimeKj}kJ`;
  }

  // Build recent training context
  let trainingContext = '';
  if (context.recentWorkouts) {
    const rides = context.recentWorkouts.rides || [];
    const runs = context.recentWorkouts.runs || [];
    trainingContext = `Recent (7d): ${rides.length} rides, ${runs.length} runs`;
    if (context.daysSinceLastWorkout > 0) {
      trainingContext += ` | ${context.daysSinceLastWorkout} days rest`;
    }
  }

  // Get language for localized output
  const langName = getPromptLanguage();

  // Build scenario-specific prompt
  let scenarioPrompt = '';
  let outputFormat = '';

  if (scenario === 'race_today') {
    scenarioPrompt = `The athlete has a ${raceEvent.category} priority RACE TODAY.
Event: ${raceEvent.eventName || 'Race'}${raceEvent.eventDescription ? '\nDescription: ' + raceEvent.eventDescription : ''}

Provide race-day advice including:
1. Pre-race assessment based on recovery data
2. Pacing strategy based on power profile
3. Warmup recommendations
4. Nutrition/hydration reminders
5. Mental focus tips`;

    outputFormat = `{
  "scenario": "race_today",
  "readiness": "excellent|good|fair|compromised",
  "readinessNote": "Brief assessment of readiness based on recovery data",
  "strategy": "1-2 sentence pacing/race strategy",
  "warmup": "Warmup recommendation based on recovery status",
  "nutrition": "Pre-race and during-race nutrition tips",
  "mentalTips": ["Tip 1", "Tip 2"],
  "powerTargets": {
    "conservative": "Power targets if feeling compromised",
    "normal": "Normal race power targets",
    "aggressive": "Power targets if feeling excellent"
  }
}`;

  } else if (scenario === 'race_tomorrow') {
    scenarioPrompt = `The athlete has a ${raceEvent.category} priority RACE TOMORROW.
Event: ${raceEvent.eventName || 'Race'}${raceEvent.eventDescription ? '\nDescription: ' + raceEvent.eventDescription : ''}

Provide pre-race day advice including:
1. Today's activity recommendation (rest vs openers)
2. Sleep and recovery optimization
3. Nutrition loading strategy
4. Equipment/logistics reminders
5. Mental preparation tips`;

    outputFormat = `{
  "scenario": "race_tomorrow",
  "todayActivity": "rest|openers|light_spin",
  "activityDetails": "What to do today (if openers, describe them)",
  "sleepTips": "Sleep optimization advice",
  "nutritionToday": "What to eat today",
  "nutritionTomorrow": "Race morning nutrition plan",
  "logisticsTips": ["Prep tip 1", "Prep tip 2"],
  "mentalTips": ["Mental prep tip 1", "Mental prep tip 2"]
}`;

  } else if (scenario === 'race_yesterday') {
    scenarioPrompt = `The athlete had a ${raceEvent.category} priority RACE YESTERDAY.
Event: ${raceEvent.eventName || 'Race'}${raceEvent.eventDescription ? '\nDescription: ' + raceEvent.eventDescription : ''}

Provide post-race recovery advice including:
1. Recovery status assessment
2. Today's activity recommendation
3. Nutrition for recovery
4. When to resume normal training
5. Signs to watch for (overreaching, illness)`;

    outputFormat = `{
  "scenario": "race_yesterday",
  "recoveryStatus": "good|moderate|poor",
  "recoveryNote": "Assessment of current recovery state",
  "todayActivity": "rest|active_recovery|easy_spin",
  "activityDetails": "What to do today",
  "nutrition": "Recovery nutrition advice",
  "resumeTraining": "When to resume normal training",
  "warningSignsToWatch": ["Sign 1", "Sign 2"]
}`;
  }

  const prompt = `You are an expert cycling/running coach providing ${scenario.replace('_', ' ')} advice.

**RECOVERY DATA:**
${recoveryContext}

**FITNESS:**
${fitnessContext}
- TSB (Form): ${context.tsb != null ? context.tsb.toFixed(1) : 'N/A'} ${context.tsb < -25 ? '(VERY FATIGUED)' : context.tsb < -15 ? '(fatigued)' : context.tsb < -5 ? '(tired)' : context.tsb > 5 ? '(FRESH)' : '(okay)'}
- CTL (Fitness): ${context.ctl ? context.ctl.toFixed(0) : 'N/A'}

**RECENT TRAINING:**
${trainingContext}

**TRAINING PHASE:** ${context.phase || 'Unknown'}

**SCENARIO:**
${scenarioPrompt}

**IMPORTANT: Respond in ${langName}.**

**Output JSON only:**
${outputFormat}`;

  const response = callGeminiAPIText(prompt);
  const advice = parseGeminiJsonResponse(response);

  if (!advice) {
    Logger.log("AI race day advice: Failed to parse response");
    // Return default advice based on scenario
    return getDefaultRaceDayAdvice(scenario, raceEvent, langName);
  }

  // Add event info to response
  advice.eventName = raceEvent.eventName;
  advice.eventDescription = raceEvent.eventDescription;
  advice.category = raceEvent.category;

  return advice;
}

/**
 * Get default race day advice when AI fails
 */
function getDefaultRaceDayAdvice(scenario, raceEvent, langName) {
  const eventName = raceEvent?.eventName || 'Race';

  if (scenario === 'race_today') {
    return {
      scenario: 'race_today',
      readiness: 'unknown',
      readinessNote: 'Unable to assess - trust your body',
      strategy: 'Start conservatively, build into the race',
      warmup: '15-20 min easy with 2-3 short efforts',
      nutrition: 'Eat familiar foods, hydrate well',
      mentalTips: ['Focus on your own race', 'Stay calm at the start'],
      eventName: eventName,
      category: raceEvent?.category
    };
  } else if (scenario === 'race_tomorrow') {
    return {
      scenario: 'race_tomorrow',
      todayActivity: 'openers',
      activityDetails: '30 min easy with 3x30s race pace efforts',
      sleepTips: 'Go to bed early, limit screen time',
      nutritionToday: 'Carb-rich meals, stay hydrated',
      nutritionTomorrow: 'Familiar breakfast 2-3h before start',
      logisticsTips: ['Check equipment tonight', 'Lay out race kit'],
      mentalTips: ['Visualize the race', 'Review your race plan'],
      eventName: eventName,
      category: raceEvent?.category
    };
  } else {
    return {
      scenario: 'race_yesterday',
      recoveryStatus: 'unknown',
      recoveryNote: 'Listen to your body',
      todayActivity: 'rest',
      activityDetails: 'Complete rest or very easy spin if legs feel good',
      nutrition: 'Focus on protein and carbs for recovery',
      resumeTraining: 'Light training in 2-3 days based on how you feel',
      warningSignsToWatch: ['Elevated resting HR', 'Poor sleep', 'Excessive fatigue'],
      eventName: eventName,
      category: raceEvent?.category
    };
  }
}

