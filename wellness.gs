/**
 * IntervalCoach - Wellness & Recovery Data
 *
 * Fetches and processes wellness data from Intervals.icu (Whoop/Garmin/Oura)
 */

// =========================================================
// WELLNESS DATA FETCHING
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

  // Try AI-driven assessment first
  try {
    const aiAssessment = generateAIRecoveryAssessment(todayData, averagesData);

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
      soreness: latestWithData.soreness,
      fatigue: latestWithData.fatigue,
      stress: latestWithData.stress,
      mood: latestWithData.mood
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
    personalizedReason: personalizedReason
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
    eventsContext += '\n- EVENT TOMORROW: ' + context.eventTomorrow.category + ' priority race';
  }
  if (context.eventIn2Days?.hasEvent) {
    eventsContext += '\n- Event in 2 days: ' + context.eventIn2Days.category + ' priority';
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

  // Build upcoming events context
  let upcomingContext = '';
  if (context.eventTomorrow?.hasEvent) {
    upcomingContext += '\n- EVENT TOMORROW: ' + context.eventTomorrow.category + ' priority';
  }
  if (context.eventIn2Days?.hasEvent) {
    upcomingContext += '\n- Event in 2 days: ' + context.eventIn2Days.category + ' priority';
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

  const prompt = `You are an expert coach advising on how hard to push during today's GROUP RIDE.

**TODAY'S EVENT:**
${context.eventName || 'Group Ride'}

**RECOVERY DATA:**
- Recovery Status: ${context.wellness?.recoveryStatus || 'Unknown'}
- Recovery Score: ${context.wellness?.today?.recovery ? context.wellness.today.recovery + '%' : 'N/A'}
- Sleep: ${context.wellness?.today?.sleep ? context.wellness.today.sleep.toFixed(1) + 'h' : 'N/A'} (${context.wellness?.sleepStatus || 'Unknown'})
- HRV: ${context.wellness?.today?.hrv ? context.wellness.today.hrv + 'ms' : 'N/A'}${subjectiveContext}

**FITNESS & FATIGUE:**
- TSB (Form): ${context.tsb != null ? context.tsb.toFixed(1) : 'N/A'} ${context.tsb < -25 ? '(VERY FATIGUED)' : context.tsb < -15 ? '(fatigued)' : context.tsb < -5 ? '(tired)' : context.tsb > 5 ? '(FRESH)' : '(okay)'}
- CTL (Fitness): ${context.ctl ? context.ctl.toFixed(0) : 'N/A'}
- ATL (Fatigue): ${context.atl ? context.atl.toFixed(0) : 'N/A'}
${upcomingContext}

**RECENT TRAINING:**${trainingContext}

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

**Output JSON only:**
{
  "intensity": "easy|moderate|hard",
  "advice": "1-2 sentence personalized advice for today's ride based on their specific metrics",
  "tips": ["Specific actionable tip 1", "Specific actionable tip 2", "Specific actionable tip 3"]
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

