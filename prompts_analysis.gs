/**
 * IntervalCoach - Analysis Prompts
 *
 * AI prompts for power profile, recovery, fatigue, and post-workout analysis.
 * Related modules: prompts_workout.gs, prompts_planning.gs, api.gs
 */

// =========================================================
// AI POWER PROFILE ANALYSIS
// =========================================================

/**
 * Generate AI-driven power profile analysis
 * Replaces hardcoded benchmarks with context-aware analysis
 * @param {object} powerData - Raw power curve data (peak powers, W', pMax, etc.)
 * @param {object} goals - Goal events from fetchUpcomingGoals()
 * @returns {object} { strengths, weaknesses, recommendations, eventRelevance, confidence }
 */
function generateAIPowerProfileAnalysis(powerData, goals) {
  if (!powerData || !powerData.available) {
    return null;
  }

  const langName = getPromptLanguage();

  const ftp = powerData.currentEftp || powerData.eFTP || powerData.ftp;

  // Build goal context
  let goalContext = 'General fitness improvement';
  let eventType = 'Unknown';
  if (goals && goals.available && goals.primaryGoal) {
    const g = goals.primaryGoal;
    goalContext = g.name + ' (' + g.date + ')';
    eventType = g.type || 'Unknown';
    if (g.description) {
      goalContext += '. ' + g.description;
    }
  }

  // Calculate ratios for context
  const ratios = {
    peak5s: ftp > 0 ? (powerData.peak5s / ftp * 100).toFixed(0) : 'N/A',
    peak1min: ftp > 0 ? (powerData.peak1min / ftp * 100).toFixed(0) : 'N/A',
    peak5min: ftp > 0 ? (powerData.peak5min / ftp * 100).toFixed(0) : 'N/A',
    peak20min: ftp > 0 ? (powerData.peak20min / ftp * 100).toFixed(0) : 'N/A'
  };

  const prompt = `You are an expert cycling coach analyzing an athlete's power profile to identify strengths, weaknesses, and training priorities.

**Power Profile Data:**
- **Current eFTP:** ${ftp}W${powerData.weight ? ' (' + (ftp / powerData.weight).toFixed(2) + ' W/kg)' : ''}
- **Peak Powers (all-time bests):**
  - 5s: ${powerData.peak5s}W (${ratios.peak5s}% of FTP)
  - 30s: ${powerData.peak30s}W
  - 1min: ${powerData.peak1min}W (${ratios.peak1min}% of FTP)
  - 2min: ${powerData.peak2min}W
  - 5min: ${powerData.peak5min}W (${ratios.peak5min}% of FTP)
  - 8min: ${powerData.peak8min}W
  - 20min: ${powerData.peak20min}W (${ratios.peak20min}% of FTP)
  - 60min: ${powerData.peak60min || 'N/A'}W
- **W' (Anaerobic Capacity):** ${powerData.wPrime ? (powerData.wPrime / 1000).toFixed(1) + 'kJ' : 'N/A'}${powerData.seasonWPrime ? ' (season best: ' + (powerData.seasonWPrime / 1000).toFixed(1) + 'kJ)' : ''}
- **pMax:** ${powerData.pMax || 'N/A'}W${powerData.seasonPMax ? ' (season best: ' + powerData.seasonPMax + 'W)' : ''}
- **VO2max (est):** ${powerData.vo2max5m ? powerData.vo2max5m.toFixed(1) + ' ml/kg/min' : 'N/A'}

**Goal Event:**
- ${goalContext}
- Event Type: ${eventType}

**Your Analysis Task:**
1. Identify this athlete's STRENGTHS relative to their goal event (not generic benchmarks)
2. Identify LIMITERS that would hold them back in their target event
3. Provide SPECIFIC training recommendations to address limiters
4. Consider the event type: climbing requires 5-20min power, crits need sprints, TTs need threshold endurance

**Output JSON only (no markdown wrapping):**
Write all text fields in ${langName}.
{
  "strengths": ["Concise strength 1 in ${langName}", "Concise strength 2"],
  "weaknesses": ["Concise limiter 1 in ${langName}", "Concise limiter 2"],
  "recommendations": ["Specific training recommendation 1 in ${langName}", "Specific recommendation 2"],
  "eventRelevance": "1-2 sentence analysis in ${langName} of how this profile matches the goal event",
  "confidence": "high|medium|low"
}`;

  const response = callGeminiAPIText(prompt);
  const analysis = parseGeminiJsonResponse(response);
  if (!analysis) {
    Logger.log("AI power profile analysis: Failed to parse response");
  }
  return analysis;
}

// =========================================================
// AI RECOVERY ASSESSMENT
// =========================================================

/**
 * Generate AI-driven recovery assessment using personal baselines
 * Replaces fixed thresholds with individualized analysis
 * @param {object} today - Today's wellness data
 * @param {object} averages - 7-day averages (personal baselines)
 * @param {object} baselineAnalysis - Optional: 30-day baseline deviation analysis
 * @returns {object} { recoveryStatus, intensityModifier, personalizedReason, confidence }
 */
function generateAIRecoveryAssessment(today, averages, baselineAnalysis) {
  if (!today) {
    return null;
  }

  const langName = getPromptLanguage();

  // Calculate trend indicators (vs 7-day average)
  const hrvTrend = (today.hrv && averages.hrv)
    ? ((today.hrv - averages.hrv) / averages.hrv * 100).toFixed(1)
    : null;
  const sleepTrend = (today.sleep && averages.sleep)
    ? (today.sleep - averages.sleep).toFixed(1)
    : null;
  const recoveryTrend = (today.recovery != null && averages.recovery)
    ? (today.recovery - averages.recovery).toFixed(0)
    : null;

  // Build subjective markers context
  let subjectiveContext = '';
  if (today.soreness || today.fatigue || today.stress || today.mood) {
    subjectiveContext = `\n**Subjective Markers (1-5 scale, 1=best):**`;
    if (today.soreness) subjectiveContext += `\n- Soreness: ${today.soreness}/5`;
    if (today.fatigue) subjectiveContext += `\n- Fatigue: ${today.fatigue}/5`;
    if (today.stress) subjectiveContext += `\n- Stress: ${today.stress}/5`;
    if (today.mood) subjectiveContext += `\n- Mood: ${today.mood}/5`;
  }

  // Build 30-day baseline deviation context
  let baselineContext = '';
  if (baselineAnalysis?.available) {
    baselineContext = '\n\n**30-Day Baseline Deviation Analysis:**';
    if (baselineAnalysis.hrvDeviation?.available) {
      const hrv = baselineAnalysis.hrvDeviation;
      baselineContext += `\n- HRV: ${hrv.current}ms vs ${hrv.baseline.toFixed(0)}ms baseline (${hrv.deviationPercent >= 0 ? '+' : ''}${hrv.deviationPercent.toFixed(1)}%, z=${hrv.zScore.toFixed(1)})`;
      baselineContext += `\n  Status: ${hrv.status} - ${hrv.interpretation}`;
    }
    if (baselineAnalysis.rhrDeviation?.available) {
      const rhr = baselineAnalysis.rhrDeviation;
      baselineContext += `\n- RHR: ${rhr.current}bpm vs ${rhr.baseline.toFixed(0)}bpm baseline (${rhr.deviationPercent >= 0 ? '+' : ''}${rhr.deviationPercent.toFixed(1)}%, z=${rhr.zScore.toFixed(1)})`;
      baselineContext += `\n  Status: ${rhr.status} - ${rhr.interpretation}`;
    }
    if (baselineAnalysis.concerns?.length > 0) {
      baselineContext += `\n- **CONCERNS**: ${baselineAnalysis.concerns.join(', ')}`;
    }
    baselineContext += `\n- Overall baseline status: ${baselineAnalysis.overallStatus}`;
  }

  const prompt = `You are an expert coach assessing an athlete's recovery status for today's training.

**Today's Wellness Data:**
- Recovery Score: ${today.recovery != null ? today.recovery + '%' : 'N/A'}${recoveryTrend ? ` (${recoveryTrend >= 0 ? '+' : ''}${recoveryTrend}% vs 7d avg)` : ''}
- HRV: ${today.hrv || 'N/A'} ms${hrvTrend ? ` (${hrvTrend >= 0 ? '+' : ''}${hrvTrend}% vs 7d avg)` : ''}
- Sleep: ${today.sleep ? today.sleep.toFixed(1) + 'h' : 'N/A'}${sleepTrend ? ` (${sleepTrend >= 0 ? '+' : ''}${sleepTrend}h vs 7d avg)` : ''}
- Resting HR: ${today.restingHR || 'N/A'} bpm${subjectiveContext}

**Personal Baselines (7-day averages):**
- Avg Recovery: ${averages.recovery ? averages.recovery.toFixed(0) + '%' : 'N/A'}
- Avg HRV: ${averages.hrv ? averages.hrv.toFixed(0) + ' ms' : 'N/A'}
- Avg Sleep: ${averages.sleep ? averages.sleep.toFixed(1) + 'h' : 'N/A'}
- Avg Resting HR: ${averages.restingHR ? averages.restingHR.toFixed(0) + ' bpm' : 'N/A'}${baselineContext}

**Assessment Guidelines:**
- Consider BOTH 7-day trends AND 30-day baseline deviations
- Z-score interpretation: |z| < 0.5 = normal, 0.5-1.5 = notable, > 1.5 = significant
- HRV significantly below 30-day baseline (z < -1.5) = concerning even if 7-day avg looks OK
- RHR significantly above 30-day baseline (z > 1.5) = potential illness/stress marker
- Weight multiple signals: both HRV low AND RHR elevated = strong warning
- If 30-day baseline shows "warning" status, be conservative

**Determine recovery status:**
- **Green (Primed)**: Above personal baseline on HRV/RHR, ready for hard training
- **Yellow (Recovering)**: Near baseline or mixed signals, moderate training OK
- **Red (Strained)**: Below baseline on multiple metrics, easy day recommended

**Output JSON only (no markdown wrapping):**
Write the "personalizedReason" in ${langName}.
{
  "recoveryStatus": "Green (Primed)|Yellow (Recovering)|Red (Strained)",
  "intensityModifier": <number 0.7-1.0>,
  "personalizedReason": "1-2 sentence explanation in ${langName} referencing baseline deviations",
  "confidence": "high|medium|low"
}`;

  const response = callGeminiAPIText(prompt);
  const assessment = parseGeminiJsonResponse(response);
  if (!assessment) {
    Logger.log("AI recovery assessment: Failed to parse response");
  }
  return assessment;
}

// =========================================================
// AI TRAINING GAP ANALYSIS
// =========================================================

/**
 * Generate AI-driven training gap analysis
 * Replaces rule-based gap interpretation with context-aware analysis
 * @param {object} gapData - From getDaysSinceLastWorkout() { daysSinceLastWorkout, lastWorkoutType, lastIntensity }
 * @param {object} wellness - Wellness summary with recovery status and trends
 * @param {object} phaseInfo - Training phase info
 * @param {object} fitnessMetrics - CTL, ATL, TSB
 * @returns {object} { interpretation, intensityModifier, recommendation, reasoning, confidence }
 */
function generateAITrainingGapAnalysis(gapData, wellness, phaseInfo, fitnessMetrics) {
  const langName = getPromptLanguage();
  const days = gapData?.daysSinceLastWorkout;

  // Skip AI for normal training rhythm (< 3 days)
  if (days === null || days < 3) {
    return null;
  }

  // Build wellness context
  let wellnessContext = 'No wellness data available';
  if (wellness && wellness.available) {
    wellnessContext = `- Recovery Status: ${wellness.recoveryStatus}
- Today's Recovery Score: ${wellness.today?.recovery != null ? wellness.today.recovery + '%' : 'N/A'}
- 7-day Avg Recovery: ${wellness.averages?.recovery ? wellness.averages.recovery.toFixed(0) + '%' : 'N/A'}
- Sleep: ${wellness.today?.sleep ? wellness.today.sleep.toFixed(1) + 'h' : 'N/A'} (avg: ${wellness.averages?.sleep ? wellness.averages.sleep.toFixed(1) + 'h' : 'N/A'})
- HRV trend: ${wellness.today?.hrv && wellness.averages?.hrv ? (wellness.today.hrv > wellness.averages.hrv ? 'Above' : 'Below') + ' baseline' : 'Unknown'}`;
  }

  // Build fitness context
  let fitnessContext = 'No fitness data available';
  if (fitnessMetrics) {
    fitnessContext = `- CTL (Fitness): ${fitnessMetrics.ctl?.toFixed(1) || 'N/A'}
- ATL (Fatigue): ${fitnessMetrics.atl?.toFixed(1) || 'N/A'}
- TSB (Form): ${fitnessMetrics.tsb?.toFixed(1) || 'N/A'} ${fitnessMetrics.tsb > 10 ? '(Very Fresh)' : fitnessMetrics.tsb > 0 ? '(Fresh)' : fitnessMetrics.tsb > -10 ? '(Neutral)' : '(Fatigued)'}`;
  }

  const prompt = `You are an expert cycling/running coach analyzing an athlete's training gap to determine the best return-to-training approach.

**Training Gap:**
- Days since last workout: ${days}
- Last workout type: ${gapData.lastWorkoutType || 'Unknown'}
- Last workout intensity: ${gapData.lastIntensity || 'Unknown'}/5

**Wellness/Recovery:**
${wellnessContext}

**Fitness State:**
${fitnessContext}

**Training Context:**
- Phase: ${phaseInfo?.phaseName || 'Unknown'}
- Weeks to Goal: ${phaseInfo?.weeksOut || 'Unknown'}

**Your Analysis Task:**
Determine if this training gap was:
1. **Planned rest** - Good recovery scores suggest intentional recovery block
2. **Illness/stress** - Poor recovery, elevated RHR, low HRV suggest the athlete was unwell
3. **Life interference** - Moderate recovery but gap suggests schedule disruption
4. **Taper** - If in taper phase, gap is expected and beneficial

Consider:
- Is the athlete returning fresh and ready for intensity?
- Should they ease back in to avoid injury/setback?
- Has there been any fitness loss (unlikely if < 10 days)?
- What does their current form (TSB) suggest about readiness?

**Output JSON only (no markdown wrapping):**
Write "recommendation" and "reasoning" in ${langName}.
{
  "interpretation": "planned_rest|returning_from_illness|life_interference|taper|unknown",
  "intensityModifier": <number 0.6-1.0>,
  "recommendation": "1-2 sentence recommendation in ${langName}",
  "reasoning": ["Array of 2-3 reasoning points in ${langName}"],
  "fitnessImpact": "none|minimal|moderate",
  "confidence": "high|medium|low"
}`;

  const response = callGeminiAPIText(prompt);
  const analysis = parseGeminiJsonResponse(response);
  if (!analysis) {
    Logger.log("AI training gap analysis: Failed to parse response");
  }
  return analysis;
}

// =========================================================
// AI EFTP TRAJECTORY ANALYSIS
// =========================================================

/**
 * Generate AI-driven eFTP trajectory analysis
 * Predicts if athlete is on track to hit target FTP by goal date
 * @param {object} powerData - Current power profile with eFTP history
 * @param {object} fitnessMetrics - CTL trend data
 * @param {object} phaseInfo - Training phase and weeks to goal
 * @param {object} goals - Goal event information
 * @returns {object} { onTrack, projectedEftp, gap, recommendation, adjustments, confidence }
 */
function generateAIEftpTrajectoryAnalysis(powerData, fitnessMetrics, phaseInfo, goals) {
  const langName = getPromptLanguage();

  if (!powerData || !powerData.available) {
    return null;
  }

  const currentEftp = powerData.currentEftp || powerData.eFTP || powerData.ftp;
  const targetFtp = powerData.manualFTP || null;
  const weeksOut = phaseInfo?.weeksOut || 12;

  if (!currentEftp || !targetFtp) {
    return null;
  }

  const gap = targetFtp - currentEftp;
  const weeklyGainNeeded = weeksOut > 0 ? gap / weeksOut : gap;

  // Build goal context
  let goalContext = 'General fitness';
  if (goals && goals.available && goals.primaryGoal) {
    goalContext = `${goals.primaryGoal.name} (${goals.primaryGoal.date})`;
    if (goals.primaryGoal.type) {
      goalContext += ` - ${goals.primaryGoal.type}`;
    }
  }

  const prompt = `You are an expert cycling coach analyzing an athlete's FTP trajectory to determine if they're on track to peak for their goal event.

**Current Power:**
- Current eFTP: ${currentEftp}W
- Target FTP: ${targetFtp}W
- Gap to Target: ${gap}W (${gap > 0 ? 'below target' : 'at or above target'})
- W/kg: ${powerData.weight ? (currentEftp / powerData.weight).toFixed(2) : 'N/A'}

**Timeline:**
- Weeks to Goal: ${weeksOut}
- Required weekly gain: ${weeklyGainNeeded.toFixed(1)}W/week ${weeklyGainNeeded > 2 ? '(AGGRESSIVE)' : weeklyGainNeeded > 1 ? '(challenging)' : '(achievable)'}
- Phase: ${phaseInfo?.phaseName || 'Unknown'}

**Fitness Trend:**
- CTL: ${fitnessMetrics?.ctl?.toFixed(1) || 'N/A'}
- Ramp Rate: ${fitnessMetrics?.rampRate?.toFixed(2) || 'N/A'} CTL/week
- CTL Trend: ${fitnessMetrics?.rampRate > 0.5 ? 'Building' : fitnessMetrics?.rampRate < -0.5 ? 'Declining' : 'Stable'}

**Goal Event:**
${goalContext}

**Analysis Guidelines:**
- Typical FTP gains: 1-2W/week with consistent training, 2-4W/week during focused blocks
- Athletes can gain ~5-8% FTP over a 12-week block with optimal training
- Late-phase gains slow down as athlete approaches genetic ceiling
- Taper adds 2-5% through freshness, not actual FTP gains
- Consider: Is the gap realistic given time remaining?

**Output JSON only (no markdown wrapping):**
Write "assessment", "recommendation", and "adjustments" in ${langName}.
{
  "onTrack": true|false,
  "trajectoryStatus": "ahead|on_track|slightly_behind|significantly_behind|at_target",
  "projectedEftp": <estimated FTP at goal date>,
  "projectedGap": <projected gap to target at goal date>,
  "assessment": "1-2 sentence assessment in ${langName}",
  "recommendation": "1-2 sentence recommendation in ${langName}",
  "adjustments": ["Array of 1-3 specific training adjustments in ${langName}"],
  "confidence": "high|medium|low"
}`;

  const response = callGeminiAPIText(prompt);
  const analysis = parseGeminiJsonResponse(response);
  if (!analysis) {
    Logger.log("AI eFTP trajectory analysis: Failed to parse response");
  }
  return analysis;
}

// =========================================================
// AI CUMULATIVE FATIGUE PREDICTION
// =========================================================

/**
 * AI-driven cumulative fatigue analysis
 * Distinguishes "good" vs "bad" fatigue and predicts recovery timeline
 *
 * @param {object} fitnessMetrics - CTL, ATL, TSB, rampRate
 * @param {object} fitnessTrend - Historical fitness data (7-14 days)
 * @param {object} wellness - Current and recent wellness data
 * @param {object} workoutFeedback - RPE/Feel from recent workouts
 * @param {object} phaseInfo - Training phase context
 * @returns {object} Fatigue analysis with type, severity, recovery prediction
 */
function generateAICumulativeFatigueAnalysis(fitnessMetrics, fitnessTrend, wellness, workoutFeedback, phaseInfo) {
  const langName = getPromptLanguage();

  // Build fitness context
  const fitnessContext = `
CURRENT FITNESS STATE:
- CTL (Chronic Load): ${fitnessMetrics?.ctl?.toFixed(1) || 'Unknown'}
- ATL (Acute Load): ${fitnessMetrics?.atl?.toFixed(1) || 'Unknown'}
- TSB (Form): ${fitnessMetrics?.tsb?.toFixed(1) || 'Unknown'}
- Ramp Rate: ${fitnessMetrics?.rampRate?.toFixed(2) || 'Unknown'} CTL/week
`;

  // Build trend context
  let trendContext = '\nFITNESS TREND (last 7-14 days):\n';
  if (fitnessTrend && fitnessTrend.length > 0) {
    fitnessTrend.slice(0, 10).forEach(d => {
      trendContext += `- ${d.date}: CTL=${d.ctl?.toFixed(0) || '?'}, ATL=${d.atl?.toFixed(0) || '?'}, TSB=${d.tsb?.toFixed(0) || '?'}\n`;
    });
  } else {
    trendContext += '- No historical data available\n';
  }

  // Build wellness context (wellness comes from createWellnessSummary)
  let wellnessContext = '\nWELLNESS INDICATORS:\n';
  if (wellness && wellness.available) {
    const today = wellness.today || {};
    const avg = wellness.averages || {};
    wellnessContext += `- Recovery Score: ${today.recovery || 'Unknown'}%\n`;
    wellnessContext += `- HRV: ${today.hrv || 'Unknown'} (7-day avg: ${avg.hrv?.toFixed(0) || 'Unknown'})\n`;
    wellnessContext += `- Resting HR: ${today.restingHR || 'Unknown'} (7-day avg: ${avg.restingHR?.toFixed(0) || 'Unknown'})\n`;
    wellnessContext += `- Sleep: ${today.sleep?.toFixed(1) || 'Unknown'}h (7-day avg: ${avg.sleep?.toFixed(1) || 'Unknown'}h)\n`;
    wellnessContext += `- Recovery Status: ${wellness.recoveryStatus || 'Unknown'}\n`;
    if (today.soreness) wellnessContext += `- Soreness: ${today.soreness}/5\n`;
    if (today.fatigue) wellnessContext += `- Subjective Fatigue: ${today.fatigue}/5\n`;
    if (today.stress) wellnessContext += `- Stress: ${today.stress}/5\n`;
    if (today.mood) wellnessContext += `- Mood: ${today.mood}/5\n`;
  }

  // Build workout feedback context
  // Note: Intervals.icu Feel scale: 1=Strong (best), 2=Good, 3=Normal, 4=Poor, 5=Weak (worst)
  let feedbackContext = '\nRECENT WORKOUT FEEDBACK:\n';
  if (workoutFeedback && workoutFeedback.summary) {
    feedbackContext += `- Activities with feedback: ${workoutFeedback.summary.totalWithFeedback}\n`;
    feedbackContext += `- Average RPE: ${workoutFeedback.summary.avgRpe?.toFixed(1) || 'N/A'}/10\n`;
    const avgFeel = workoutFeedback.summary.avgFeel;
    feedbackContext += `- Average Feel: ${avgFeel?.toFixed(1) || 'N/A'} (${avgFeel != null ? getFeelLabel(avgFeel) : 'N/A'}) - scale: 1=Strong to 5=Weak\n`;
    if (workoutFeedback.summary.feelDistribution) {
      const fd = workoutFeedback.summary.feelDistribution;
      feedbackContext += `- Feel distribution: Strong=${fd.great || 0}, Good=${fd.good || 0}, Normal=${fd.okay || 0}, Poor=${fd.poor || 0}, Weak=${fd.bad || 0}\n`;
    }
  }

  // Training phase context
  const phaseContext = `
TRAINING CONTEXT:
- Phase: ${phaseInfo?.phaseName || 'Unknown'}
- Weeks to Goal: ${phaseInfo?.weeksOut || 'Unknown'}
`;

  const prompt = `You are an expert sports scientist analyzing an athlete's fatigue state to determine if they're experiencing productive training stress or showing warning signs of overtraining.

${fitnessContext}${trendContext}${wellnessContext}${feedbackContext}${phaseContext}

Analyze the cumulative fatigue and provide:

1. **Fatigue Classification** - Determine the type of fatigue:
   - **Functional Overreaching (FOR)**: Intentional short-term overload that leads to supercompensation. Signs: Temporary performance dip, maintained motivation, recovery within 1-2 weeks.
   - **Non-Functional Overreaching (NFOR)**: Excessive training without adequate recovery. Signs: Prolonged fatigue (2-4 weeks), decreased performance, disturbed sleep, mood changes.
   - **Overtraining Syndrome (OTS)**: Severe chronic fatigue requiring months to recover. Signs: Persistent fatigue despite rest, hormonal disruption, depression, illness.
   - **Normal Training Fatigue**: Expected day-to-day fatigue that clears with routine recovery.
   - **Fresh/Recovered**: Low fatigue, ready for quality training.

2. **Warning Signs Analysis** - Look for:
   - TSB deeply negative for extended periods (< -20 for > 7 days)
   - HRV trending down or below personal baseline
   - Sleep quality declining
   - Elevated resting HR
   - Increasing RPE for same workouts
   - Declining "Feel" scores
   - High soreness/fatigue/stress markers

3. **Recovery Prediction** - Based on current state:
   - Estimated days until TSB returns to neutral/positive
   - Whether training should continue, reduce, or stop
   - Recommended recovery activities

**IMPORTANT: Respond with ONLY valid JSON. No introductory text, no explanations. Just the JSON object.**
Use ${langName} for all string values within the JSON:
{
  "fatigueType": "fresh|normal|functional_overreaching|non_functional_overreaching|overtraining_warning",
  "fatigueSeverity": 1-10 (1=fresh, 5=moderately fatigued, 10=severe),
  "fatigueQuality": "productive|neutral|concerning|dangerous",
  "tsbTrend": "improving|stable|declining|rapidly_declining",
  "warningSignsPresent": true/false,
  "warningSigns": ["list of specific warning signs observed, or empty if none"],
  "recoveryPrediction": {
    "daysToNeutralTSB": estimated days until TSB reaches 0,
    "daysToPositiveTSB": estimated days until TSB reaches +5,
    "recoveryConfidence": "high|medium|low"
  },
  "recommendation": {
    "trainingAdvice": "continue_normal|reduce_intensity|reduce_volume|recovery_week|complete_rest",
    "durationDays": number of days to follow this advice,
    "specificActions": ["2-3 specific actionable recommendations"]
  },
  "physiologicalInsight": "2-3 sentences explaining what's happening physiologically and whether the current fatigue is productive for adaptation",
  "riskLevel": "low|moderate|high|critical",
  "confidence": "high|medium|low"
}`;

  const response = callGeminiAPIText(prompt);
  const result = parseGeminiJsonResponse(response);
  if (!result) {
    Logger.log("AI cumulative fatigue analysis: Failed to parse response");
    return null;
  }
  result.aiEnhanced = true;
  return result;
}

// =========================================================
// POST-WORKOUT ANALYSIS
// =========================================================

/**
 * Generate AI-powered post-workout analysis
 * Compares predicted vs actual difficulty, analyzes effectiveness
 * @param {object} activity - Completed activity from Intervals.icu
 * @param {object} wellness - Current wellness data
 * @param {object} fitness - Current fitness metrics
 * @param {object} powerProfile - Power profile (for cycling)
 * @param {object} runningData - Running data (for runs)
 * @returns {object} AI analysis with effectiveness, insights, recommendations
 */
function generatePostWorkoutAnalysis(activity, wellness, fitness, powerProfile, runningData, activityCategory) {
  const langName = getPromptLanguage();

  // Determine activity category if not provided (backwards compatibility)
  if (!activityCategory) {
    activityCategory = activity.type === "Run" || activity.type === "VirtualRun" ? 'running' :
                       activity.type === "Ride" || activity.type === "VirtualRide" ? 'cycling' : 'other';
  }

  // Extract zone distribution for stimulus analysis (if available)
  const zoneDistribution = activity.icu_zone_times ?
    activity.icu_zone_times.map(z => `${z.id}: ${Math.round(z.secs / 60)}min`).join(", ") :
    "Not available";

  // Build activity-specific analysis instructions (initialize early)
  let analysisInstructions = "";
  let stimulusOptions = "recovery|endurance|tempo|threshold|vo2max|anaerobic|mixed";

  // Build sport-specific context based on category
  let sportContext = "";
  let coachType = "fitness";

  if (activityCategory === 'running' && runningData?.available) {
    coachType = "running";
    sportContext = `
**Running Profile:**
- Critical Speed: ${runningData.criticalSpeed || 'N/A'}/km
- D': ${runningData.dPrime ? runningData.dPrime.toFixed(0) + 'm' : 'N/A'}
- Threshold Pace: ${runningData.thresholdPace || 'N/A'}/km`;
  } else if (activityCategory === 'cycling') {
    coachType = "cycling";
    // Check for missing power data (e.g. MTB ride without power meter)
    const hasPower = activity.icu_average_watts && activity.icu_average_watts > 0;
    
    if (hasPower && powerProfile?.available) {
      sportContext = `
**Power Profile:**
- eFTP: ${powerProfile.currentEftp || powerProfile.eFTP || 'N/A'}W
- W': ${powerProfile.wPrimeKj || 'N/A'}kJ
- VO2max: ${powerProfile.vo2max ? powerProfile.vo2max.toFixed(1) : 'N/A'}
- Peak Powers: 5s=${powerProfile.peak5s}W | 1min=${powerProfile.peak1min}W | 5min=${powerProfile.peak5min}W`;
    } else {
      // HR-based context for rides without power
      sportContext = `
**Cycling Context (No Power Data - MTB/Commute):**
- Analysis Mode: Heart Rate & RPE based
- LTHR: ${fitness.lthr || 'N/A'} bpm
- Max HR: ${fitness.maxHr || 'N/A'} bpm
- Resting HR: ${wellness?.today?.restingHR || 'N/A'} bpm`;
      
      analysisInstructions += `
**Missing Power Data Note:**
- This ride has no power data (likely MTB or commute).
- Base your analysis STRICTLY on Heart Rate, RPE, and Duration.
- Do NOT mention power or watts in the feedback.
- Focus on cardiac drift, time in HR zones, and perceived exertion.`;
    }
  } else if (activityCategory === 'strength') {
    coachType = "strength and conditioning";
    sportContext = `
**Strength Training Notes:**
- Focus on muscle groups worked, volume, and recovery needs
- Consider interaction with endurance training schedule`;
  } else if (activityCategory === 'walking') {
    coachType = "fitness";
    sportContext = `
**Walking/Hiking Notes:**
- Low-impact cardiovascular activity
- Good for active recovery and general fitness`;
  } else if (activityCategory === 'swimming') {
    coachType = "triathlon";
    sportContext = `
**Swimming Notes:**
- Upper body dominant cardiovascular workout
- Low impact, good cross-training for runners/cyclists`;
  } else {
    coachType = "fitness";
    sportContext = `
**General Activity Notes:**
- Cross-training activity contributing to overall fitness
- Consider recovery impact on primary training`;
  }

  // Build wellness context
  let wellnessContext = "";
  if (wellness && wellness.available) {
    wellnessContext = `
**Wellness Today:**
- Recovery Status: ${wellness.recoveryStatus}
- Sleep: ${wellness.today.sleep ? wellness.today.sleep.toFixed(1) + 'h' : 'N/A'}
- HRV: ${wellness.today.hrv || 'N/A'} ms (avg: ${wellness.averages.hrv ? wellness.averages.hrv.toFixed(0) : 'N/A'})
- Resting HR: ${wellness.today.restingHR || 'N/A'} bpm`;
  }

  if (activityCategory === 'strength') {
    stimulusOptions = "recovery|strength_maintenance|hypertrophy|power|endurance_strength|mixed";
    analysisInstructions = `
**Strength-Specific Analysis:**
- Consider muscle fatigue impact on cycling/running
- Evaluate timing relative to key endurance workouts
- Assess whether volume/intensity was appropriate for current training phase`;
  } else if (activityCategory === 'walking') {
    stimulusOptions = "active_recovery|light_cardio|endurance|mixed";
    analysisInstructions = `
**Walking/Hiking-Specific Analysis:**
- Good for active recovery days
- Consider elevation gain and duration for load assessment
- Minimal interference with primary training`;
  } else if (activityCategory === 'swimming') {
    stimulusOptions = "recovery|endurance|tempo|threshold|intervals|mixed";
    analysisInstructions = `
**Swimming-Specific Analysis:**
- Upper body focus, minimal leg fatigue
- Good active recovery for cyclists/runners
- Consider technique work vs pure cardio`;
  } else if (activityCategory === 'other_cardio' || activityCategory === 'other') {
    stimulusOptions = "recovery|light_cardio|moderate_cardio|high_intensity|mixed";
    analysisInstructions = `
**Cross-Training Analysis:**
- Assess cardiovascular contribution
- Consider fatigue transfer to primary sports
- Evaluate as part of overall training load`;
  }

  const prompt = `You are an expert ${coachType} coach analyzing a completed workout.

**Workout Details:**
- Name: ${activity.name}
- Type: ${activity.type} (Category: ${activityCategory})
- Duration: ${Math.round(activity.moving_time / 60)} minutes
- TSS/Training Load: ${activity.icu_training_load || 'N/A'}
- Intensity Factor: ${activity.icu_intensity || 'N/A'}
- Average HR: ${activity.average_heartrate || activity.icu_average_hr || 'N/A'} bpm
- Max HR: ${activity.max_heartrate || 'N/A'} bpm
- Calories: ${activity.calories || activity.icu_calories || 'N/A'}
- RPE: ${activity.icu_rpe || 'Not recorded'} / 10
- Feel: ${activity.feel ? getFeelLabel(activity.feel) : 'Not recorded'} (scale: 1=Strong to 5=Weak)
${activityCategory === 'cycling' || activityCategory === 'running' ? `- Zone Distribution: ${zoneDistribution}` : ''}
${sportContext}

**Current Fitness State:**
- CTL (Fitness): ${fitness.ctl || 'N/A'}
- ATL (Fatigue): ${fitness.atl || 'N/A'}
- TSB (Form): ${fitness.tsb || 'N/A'}
- CTL Ramp Rate: ${fitness.rampRate || 'N/A'} per week
${wellnessContext}
${analysisInstructions}

**Analysis Tasks:**

1. **Workout Effectiveness** (1-10 scale):
   - Was the workout executed well for its intended purpose?
   - Did it achieve its intended stimulus?
   - Quality of execution and effort

2. **Difficulty Assessment**:
   - Based on RPE/Feel and the metrics, was this workout:
     - "easier_than_expected"
     - "as_expected"
     - "harder_than_expected"

3. **Recovery Impact**:
   - How will this workout affect recovery over next 24-48h?
   - Should next workout be adjusted based on this session?

4. **Key Insight**:
   - What's the single most important takeaway from this workout?
   - How does it fit into overall training?

5. **Training Adjustments**:
   - Should we adjust future workouts based on this?
   - Any scheduling considerations for upcoming training?

**IMPORTANT: Respond with ONLY valid JSON. No introductory text, no explanations. Just the JSON object.**
Use ${langName} for all string values within the JSON:
{
  "effectiveness": 1-10 (how well the workout was executed),
  "effectivenessReason": "1-2 sentences explaining the effectiveness rating",
  "difficultyMatch": "easier_than_expected|as_expected|harder_than_expected",
  "difficultyReason": "1-2 sentences explaining why difficulty matched or didn't match expectations",
  "workoutStimulus": "${stimulusOptions}",
  "stimulusQuality": "poor|fair|good|excellent",
  "recoveryImpact": {
    "severity": "minimal|moderate|significant|severe",
    "estimatedRecoveryHours": 12-72 hours until ready for next quality session,
    "nextWorkoutAdjustment": "none|reduce_intensity|reduce_volume|add_rest_day"
  },
  "keyInsight": "Single most important takeaway (2-3 sentences)",
  "performanceHighlights": ["List 2-3 specific positive observations or concerns"],
  "trainingAdjustments": {
    "needed": true/false,
    "recommendation": "Brief recommendation for future sessions",
    "reasoning": "1-2 sentences explaining why adjustments are or aren't needed"
  },
  "congratsMessage": "Brief encouraging message about the workout (1-2 sentences)",
  "confidence": "high|medium|low"
}`;

  const response = callGeminiAPIText(prompt);
  const result = parseGeminiJsonResponse(response);
  if (!result) {
    Logger.log("Post-workout analysis: Failed to parse response");
    return { success: false, error: "Failed to parse AI response" };
  }
  result.success = true;
  result.aiEnhanced = true;
  result.activityCategory = activityCategory;
  return result;
}

// =========================================================
// WORKOUT IMPACT PREVIEW
// =========================================================

/**
 * Generate AI-powered workout impact preview narrative
 * Explains how today's workout affects fitness over the next 2 weeks
 * @param {object} impactData - Data from generateWorkoutImpactPreview()
 * @param {object} goals - Upcoming goals/races
 * @param {object} phaseInfo - Current training phase info
 * @returns {object} {summary, narrative, keyInsights, aiEnhanced}
 */
function generateAIWorkoutImpactPreview(impactData, goals, phaseInfo) {
  const analysisLang = getPromptLanguage();

  // Format 2-week projection for AI
  const projectionSummary = impactData.withWorkout.map(function(p) {
    return p.dayName + " " + p.date.substring(5) + ": TSS=" + p.tss + " -> CTL=" + p.ctl + ", TSB=" + p.tsb;
  }).join("\n");

  // Format goals if available
  let goalContext = "No specific events in next 2 weeks";
  if (goals && goals.length > 0) {
    const upcomingGoals = goals.filter(function(g) {
      const goalDate = new Date(g.date);
      const twoWeeksOut = new Date();
      twoWeeksOut.setDate(twoWeeksOut.getDate() + 14);
      return goalDate <= twoWeeksOut;
    });
    if (upcomingGoals.length > 0) {
      goalContext = upcomingGoals.map(function(g) {
        return g.name + " (" + g.category + ") on " + g.date;
      }).join(", ");
    }
  }

  const prompt = `You are an expert cycling coach analyzing how today's workout impacts an athlete's fitness trajectory.

CURRENT STATE:
- CTL (Fitness): ${impactData.currentMetrics.ctl}
- ATL (Fatigue): ${impactData.currentMetrics.atl}
- TSB (Form): ${impactData.currentMetrics.tsb}
- Training Phase: ${phaseInfo ? phaseInfo.phaseName : 'Build'}
- Weeks to Goal: ${phaseInfo ? phaseInfo.weeksOut : 'Unknown'}

TODAY'S WORKOUT:
- Estimated TSS: ${impactData.todaysTSS}

IMPACT ANALYSIS:
- Tomorrow's TSB change: ${impactData.impact.tomorrowTSBDelta.toFixed(1)} (more negative = more tired)
- 2-week CTL gain: +${impactData.impact.twoWeekCTLDelta.toFixed(1)} fitness points
- Lowest TSB this week: ${impactData.impact.lowestTSB.toFixed(1)}
- Days until positive TSB: ${impactData.impact.daysToPositiveTSB !== null ? impactData.impact.daysToPositiveTSB : "14+"}
${impactData.impact.peakFormWindow.length > 0 ? "- Peak form window (TSB 0-20): " + impactData.impact.peakFormWindow.slice(0, 3).join(", ") : "- No peak form days in next 2 weeks"}

2-WEEK PROJECTION:
${projectionSummary}

UPCOMING EVENTS:
${goalContext}

Provide a concise workout impact analysis in ${analysisLang}. Return JSON:
{
  "summary": "One-sentence summary of the workout's impact (e.g., 'This workout builds fitness while keeping you fresh for Sunday')",
  "narrative": "2-3 sentence coaching explanation of the trade-offs. Mention specific CTL/TSB values when relevant. Connect to their goals.",
  "keyInsights": [
    "Insight 1 (e.g., 'TSB drops to -15 tomorrow but recovers by Friday')",
    "Insight 2 (e.g., 'On track for peak form on race day')"
  ],
  "formStatus": "optimal|building|fatigued|recovering",
  "recommendation": "proceed|modify|skip"
}`;

  const response = callGeminiAPIText(prompt);
  const result = parseGeminiJsonResponse(response);
  if (!result) {
    Logger.log("Workout impact preview: Failed to parse response");
    return createFallbackImpactPreview(impactData);
  }
  result.success = true;
  result.aiEnhanced = true;
  return result;
}

/**
 * Create fallback impact preview when AI is unavailable
 * @param {object} impactData - Data from generateWorkoutImpactPreview()
 * @returns {object} Basic impact preview
 */
function createFallbackImpactPreview(impactData) {
  const tsbDelta = impactData.impact.tomorrowTSBDelta;
  const ctlGain = impactData.impact.twoWeekCTLDelta;
  const daysToRecover = impactData.impact.daysToPositiveTSB;

  let summary = "";
  let formStatus = "building";
  let recommendation = "proceed";

  if (impactData.currentMetrics.tsb < -20) {
    summary = "Adds training load during a fatigued period";
    formStatus = "fatigued";
    recommendation = "modify";
  } else if (impactData.currentMetrics.tsb > 10) {
    summary = "Builds fitness from a well-rested state";
    formStatus = "recovering";
  } else {
    summary = "Contributes +" + ctlGain.toFixed(1) + " CTL over 2 weeks";
    formStatus = "building";
  }

  const narrative = "This " + impactData.todaysTSS + " TSS workout will drop your TSB by " +
    Math.abs(tsbDelta).toFixed(1) + " points tomorrow. " +
    (daysToRecover ? "You'll return to positive form in " + daysToRecover + " days." : "Recovery may take over 2 weeks.");

  const keyInsights = [];
  keyInsights.push("CTL gain: +" + ctlGain.toFixed(1) + " over 2 weeks");
  if (daysToRecover !== null && daysToRecover <= 3) {
    keyInsights.push("Quick recovery: positive TSB in " + daysToRecover + " days");
  } else if (impactData.impact.lowestTSB < -25) {
    keyInsights.push("Watch fatigue: TSB dips to " + impactData.impact.lowestTSB.toFixed(0));
  }

  return {
    success: true,
    aiEnhanced: false,
    summary: summary,
    narrative: narrative,
    keyInsights: keyInsights,
    formStatus: formStatus,
    recommendation: recommendation
  };
}

// =========================================================
// YESTERDAY ACKNOWLEDGMENT
// =========================================================

/**
 * Generate personalized acknowledgment of yesterday's workout using AI
 * Creates a brief, meaningful sentence about the last workout
 * @param {object} lastWorkoutAnalysis - Data from getLastWorkoutAnalysis()
 * @param {object} wellness - Current wellness summary
 * @param {boolean} isNL - Dutch language flag
 * @returns {string|null} Personalized acknowledgment or null if no recent workout
 */
function generateYesterdayAcknowledgment(lastWorkoutAnalysis, wellness, isNL) {
  if (!lastWorkoutAnalysis || !lastWorkoutAnalysis.date) {
    return null;
  }

  // Check if workout is within 3 days
  const workoutDate = new Date(lastWorkoutAnalysis.date);
  const today = new Date();
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const workoutDayStart = new Date(workoutDate.getFullYear(), workoutDate.getMonth(), workoutDate.getDate());
  const daysDiff = Math.floor((todayStart - workoutDayStart) / (1000 * 60 * 60 * 24));

  if (daysDiff > 3 || daysDiff < 1) {
    return null;
  }

  // Build when label
  let whenLabel;
  if (daysDiff === 1) {
    whenLabel = isNL ? 'gisteren' : 'yesterday';
  } else if (daysDiff === 2) {
    whenLabel = isNL ? 'eergisteren' : '2 days ago';
  } else {
    whenLabel = isNL ? '3 dagen geleden' : '3 days ago';
  }

  const langName = getPromptLanguage();
  const lw = lastWorkoutAnalysis;

  // Build context for AI
  let difficultyContext = '';
  if (lw.difficultyMatch === 'harder_than_expected') {
    difficultyContext = isNL ? 'voelde zwaarder dan verwacht' : 'felt harder than expected';
  } else if (lw.difficultyMatch === 'easier_than_expected') {
    difficultyContext = isNL ? 'voelde makkelijker dan verwacht' : 'felt easier than expected';
  } else {
    difficultyContext = isNL ? 'voelde zoals gepland' : 'matched expectations';
  }

  // Recovery context
  const recovery = wellness?.today?.recovery;
  let recoveryContext = '';
  if (recovery != null) {
    if (recovery < 34) {
      recoveryContext = isNL
        ? 'Je lichaam verwerkt die inspanning nog.'
        : 'Your body is still processing that effort.';
    } else if (recovery < 67) {
      recoveryContext = isNL
        ? 'Je herstel vordert goed.'
        : 'Your recovery is progressing well.';
    } else {
      recoveryContext = isNL
        ? 'Je bent goed hersteld.'
        : 'You\'ve recovered well.';
    }
  }

  const prompt = `You are a cycling/running coach giving a brief acknowledgment of a recent workout.

Language: ${langName}

Workout details:
- Activity: ${lw.activityName || 'Training'}
- When: ${whenLabel}
- TSS: ${lw.tss || 'unknown'}
- Effectiveness score: ${lw.effectiveness || 'unknown'}/10
- Difficulty: ${difficultyContext}
- Key insight from analysis: ${lw.keyInsight || 'none'}
${recoveryContext ? '- Current recovery status: ' + recoveryContext : ''}

Write a single conversational sentence (max 20 words) acknowledging this workout.
- Be specific about what they did
- Reference the key insight if relevant
- Connect to their current recovery state if relevant
- Tone: warm but not over-the-top positive
- Do NOT use emojis

Return ONLY the sentence, nothing else.`;

  try {
    const response = callGeminiAPIText(prompt);

    if (response) {
      // Clean up the response
      let text = response.trim();
      // Remove quotes if present
      text = text.replace(/^["']|["']$/g, '');
      // Ensure it ends with proper punctuation
      if (!/[.!?]$/.test(text)) {
        text += '.';
      }
      return text;
    }
  } catch (e) {
    Logger.log("AI yesterday acknowledgment failed: " + e.toString());
  }

  // Fallback to simple static acknowledgment
  const activityName = lw.activityName || (isNL ? 'Training' : 'Workout');
  return isNL
    ? `Goed bezig ${whenLabel} met je ${activityName}.`
    : `Nice work on your ${activityName} ${whenLabel}.`;
}
