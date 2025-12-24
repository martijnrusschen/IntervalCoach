/**
 * IntervalCoach - AI Prompts
 *
 * Prompt construction for workout generation via Gemini AI.
 */

// =========================================================
// CYCLING WORKOUT PROMPT
// =========================================================

/**
 * Create prompt for cycling workout generation
 * @param {string} type - Workout type
 * @param {object} summary - Athlete summary
 * @param {object} phaseInfo - Training phase info
 * @param {string} dateStr - Date string for naming
 * @param {object} duration - Duration range { min, max }
 * @param {object} wellness - Wellness data
 * @param {object} powerProfile - Power profile analysis
 * @param {object} adaptiveContext - Adaptive training context
 * @returns {string} Complete prompt for Gemini
 */
function createPrompt(type, summary, phaseInfo, dateStr, duration, wellness, powerProfile, adaptiveContext) {
  const langMap = { "ja": "Japanese", "en": "English", "es": "Spanish", "fr": "French", "nl": "Dutch" };
  const analysisLang = langMap[USER_SETTINGS.LANGUAGE] || "English";

  // Zwift Display Name (Clean, short name without "IntervalCoach_" prefix)
  const safeType = type.replace(/[^a-zA-Z0-9]/g,"");
  const zwiftDisplayName = safeType + "_" + dateStr;

  // Format duration string
  const durationStr = duration ? (duration.min + "-" + duration.max + " min") : "60 min (+/- 5min)";

  // Build power profile context
  let powerContext = "";
  if (powerProfile && powerProfile.available) {
    const currentEftp = powerProfile.currentEftp || powerProfile.eFTP;
    const manualFtp = powerProfile.manualFTP || 303;
    let ftpContext = `**Current eFTP:** ${currentEftp || 'N/A'}W`;

    if (currentEftp && manualFtp) {
      const gapToTarget = manualFtp - currentEftp;
      if (gapToTarget > 0) {
        ftpContext += ` (Target FTP: ${manualFtp}W, ${gapToTarget}W to peak form)`;
      } else {
        ftpContext += ` (AT OR ABOVE target FTP ${manualFtp}W - PEAK FORM!)`;
      }
    }

    if (powerProfile.allTimeEftp && currentEftp && powerProfile.allTimeEftp > currentEftp) {
      ftpContext += ` | All-time: ${powerProfile.allTimeEftp}W`;
    }
    if (powerProfile.weight) {
      const wpkg = (powerProfile.ftp / powerProfile.weight).toFixed(2);
      ftpContext += ` | ${wpkg} W/kg`;
    }

    let wPrimeContext = "";
    if (powerProfile.wPrime) {
      wPrimeContext = `\n- **W' (Anaerobic Capacity):** ${powerProfile.wPrimeKj}kJ`;
      if (powerProfile.seasonWPrime && powerProfile.wPrime < powerProfile.seasonWPrime) {
        const wPrimeGap = ((powerProfile.seasonWPrime - powerProfile.wPrime) / 1000).toFixed(1);
        wPrimeContext += ` (season best: ${(powerProfile.seasonWPrime/1000).toFixed(1)}kJ, ${wPrimeGap}kJ below)`;
      }
      if (powerProfile.wPrimeStatus) {
        wPrimeContext += ` - ${powerProfile.wPrimeStatus}`;
      }
    }

    let physioContext = "";
    if (powerProfile.vo2max) {
      physioContext += `\n- **VO2max (est):** ${powerProfile.vo2max.toFixed(1)} ml/kg/min`;
    }
    if (powerProfile.tteEstimate) {
      physioContext += ` | **TTE (est):** ~${powerProfile.tteEstimate}min`;
    }
    if (powerProfile.pMax) {
      physioContext += `\n- **pMax:** ${powerProfile.pMax}W`;
      if (powerProfile.seasonPMax && powerProfile.pMax < powerProfile.seasonPMax) {
        physioContext += ` (season best: ${powerProfile.seasonPMax}W)`;
      }
    }

    powerContext = `
**1c. Power Profile Analysis:**
- ${ftpContext}${wPrimeContext}${physioContext}
- **Peak Powers:** 5s=${powerProfile.peak5s}W | 30s=${powerProfile.peak30s}W | 1min=${powerProfile.peak1min}W | 2min=${powerProfile.peak2min}W | 5min=${powerProfile.peak5min}W | 8min=${powerProfile.peak8min}W | 20min=${powerProfile.peak20min}W | 60min=${powerProfile.peak60min || 'N/A'}W
- **Strengths:** ${powerProfile.strengths.length > 0 ? powerProfile.strengths.join(", ") : "Balanced profile"}
- **Weaknesses:** ${powerProfile.weaknesses.length > 0 ? powerProfile.weaknesses.join(", ") : "None identified"}
${powerProfile.recommendations.length > 0 ? `- **Training Recommendations:** ${powerProfile.recommendations.join("; ")}` : ''}
${powerProfile.climbingStrength ? `- **Note:** ${powerProfile.climbingStrength}` : ''}

**POWER PROFILE RULES:**
- Use current eFTP (${powerProfile.ftp}W) for zone calculations - this reflects current fitness.
- **W' (${powerProfile.wPrimeKj || 'N/A'}kJ)** represents anaerobic capacity. If low, include 30s-2min hard efforts to build it.
- **TTE** (time to exhaustion at FTP) indicates threshold endurance. Low TTE = prescribe longer threshold intervals.
- Peak powers are all-time bests; current capabilities may be lower due to seasonal fitness variation.
- Design intervals that target identified weaknesses when appropriate for the phase.
- For climbing goals, prioritize 5-20 minute power development.
`;
  }

  // Build wellness context string
  let wellnessContext = "";
  if (wellness && wellness.available) {
    const w = wellness.today;
    const avg = wellness.averages;

    wellnessContext = `
**1b. Recovery & Wellness Data (from Whoop/wearable):**
- **Recovery Status:** ${wellness.recoveryStatus}
- **Recommended Intensity Modifier:** ${(wellness.intensityModifier * 100).toFixed(0)}%
- **Sleep:** ${w.sleep ? w.sleep.toFixed(1) + 'h' : 'N/A'} (${wellness.sleepStatus}) | 7-day avg: ${avg.sleep ? avg.sleep.toFixed(1) + 'h' : 'N/A'}
- **HRV (rMSSD):** ${w.hrv || 'N/A'} ms | 7-day avg: ${avg.hrv ? avg.hrv.toFixed(0) : 'N/A'} ms
- **Resting HR:** ${w.restingHR || 'N/A'} bpm | 7-day avg: ${avg.restingHR ? avg.restingHR.toFixed(0) : 'N/A'} bpm
- **Whoop Recovery Score:** ${w.recovery != null ? w.recovery + '%' : 'N/A'}
${w.soreness ? `- **Soreness:** ${w.soreness}/5` : ''}
${w.fatigue ? `- **Fatigue:** ${w.fatigue}/5` : ''}
${w.stress ? `- **Stress:** ${w.stress}/5` : ''}
${w.mood ? `- **Mood:** ${w.mood}/5` : ''}

**CRITICAL RECOVERY RULES:**
- If Recovery Status is "Red (Strained)" or HRV is significantly below baseline: STRONGLY favor Endurance/Recovery workouts. VO2max/Threshold should score very low (1-3).
- If Recovery Status is "Yellow (Recovering)": Reduce interval intensity by 5-10%. Favor Tempo/SST over VO2max.
- If Recovery Status is "Green (Primed)": Full intensity is appropriate. High-intensity workouts can score higher.
- Poor sleep (<6h) should reduce recommendation scores for high-intensity work.
`;
  }

  // Build adaptive training context
  let adaptiveTrainingContext = "";
  if (adaptiveContext && adaptiveContext.available) {
    adaptiveTrainingContext = `
**1d. Adaptive Training (Athlete Feedback Analysis):**
${adaptiveContext.promptContext}
**ADAPTIVE TRAINING RULES:**
- If recommendation is EASIER: Reduce interval intensity by ${Math.abs(adaptiveContext.adaptation.intensityAdjustment)}%. Favor endurance/tempo over threshold/VO2max.
- If recommendation is HARDER: Athlete is handling load well. Can push intensity slightly higher.
- If recommendation is MAINTAIN: Current approach is appropriate. Continue as planned.
- Recent Feel scores indicate how the athlete is responding to training load. Low feel = accumulated fatigue.
- High RPE relative to workout type suggests the athlete may need more recovery.
`;
  }

  return `
You are an expert cycling coach using the logic of Coggan, Friel, and Seiler.
Generate a Zwift workout (.zwo) and evaluate its suitability.

**1a. Athlete Training Context:**
- **Goal:** ${phaseInfo.goalDescription || USER_SETTINGS.GOAL_DESCRIPTION}
- **Target Race:** In ${phaseInfo.weeksOut} weeks.
- **Current Phase:** "${phaseInfo.phaseName}"
- **Phase Focus:** ${phaseInfo.focus}
- **Current TSB:** ${summary.tsb_current.toFixed(1)}
- **Recent Load (Z5+):** ${summary.z5_recent_total > 1500 ? "High" : "Normal"}
${wellnessContext}${powerContext}${adaptiveTrainingContext}
**2. Assignment: Design a "${type}" Workout**
- **Duration:** ${durationStr}. Design the workout to fit within this time window.
- **Structure:** Engaging (Pyramids, Over-Unders). NO boring steady states.
- **Intensity:** Adjust based on TSB AND Recovery Status.
  - If TSB < -20 OR Recovery is Red/Yellow, reduce intensity significantly.
  - Apply the Intensity Modifier (${wellness && wellness.available ? (wellness.intensityModifier * 100).toFixed(0) + '%' : '100%'}) to target power zones.

**3. REQUIRED ZWO FEATURES (Critical):**
- **Cadence:** You MUST specify target cadence for every interval using \`Cadence="85"\`.
- **Text Events (Messages):**
  - You MUST include motivational or instructional text messages.
  - **LANGUAGE: Messages MUST be in ENGLISH.** (Even if the user's language is different, Zwift works best with English text).
  - Nest them: \`<SteadyState ... ><TextEvent timeoffset="10" message="Keep pushing!"/></SteadyState>\`
  - **Workout Name:** The <name> tag MUST be exactly: "${zwiftDisplayName}" (Do NOT add "IntervalCoach_" prefix here).

**4. Evaluate Recommendation (1-10):**
- Logic: Based on **Current Phase**, **TSB**, AND **Recovery/Wellness Status**, is "${type}" the right choice today?
- A well-recovered athlete in Build phase doing Threshold = high score.
- A poorly-recovered athlete (Red status, low HRV) doing VO2max = very low score (1-3).
- Example: If Phase is "Base", VO2max should score low (unless maintenance). If Phase is "Peak", high volume SST should score low.

**Output Format (JSON Only):**
{
  "explanation": "Strategy explanation in **${analysisLang}**. Include how recovery status influenced the workout design.",
  "recommendation_score": (integer 1-10),
  "recommendation_reason": "Reason based on Phase(${phaseInfo.phaseName}), TSB, AND Recovery Status in **${analysisLang}**.",
  "xml": "<workout_file>...<author>IntervalCoach AI Coach</author><name>${zwiftDisplayName}</name>...valid xml...</workout_file>"
}
`;
}

// =========================================================
// RUNNING WORKOUT PROMPT
// =========================================================

/**
 * Create prompt for running workout generation
 * @param {string} type - Workout type
 * @param {object} summary - Athlete summary
 * @param {object} phaseInfo - Training phase info
 * @param {string} dateStr - Date string for naming
 * @param {object} duration - Duration range { min, max }
 * @param {object} wellness - Wellness data
 * @param {object} runningData - Running pace data
 * @param {object} adaptiveContext - Adaptive training context
 * @returns {string} Complete prompt for Gemini
 */
function createRunPrompt(type, summary, phaseInfo, dateStr, duration, wellness, runningData, adaptiveContext) {
  const langMap = { "ja": "Japanese", "en": "English", "es": "Spanish", "fr": "French", "nl": "Dutch" };
  const analysisLang = langMap[USER_SETTINGS.LANGUAGE] || "English";

  const safeType = type.replace(/[^a-zA-Z0-9]/g, "");
  const workoutName = "IntervalCoach_" + safeType + "_" + dateStr;
  const durationStr = duration ? (duration.min + "-" + duration.max + " min") : "30-45 min";

  // Build running data context
  let runContext = "";
  if (runningData && runningData.available) {
    const primaryPace = runningData.criticalSpeed || runningData.thresholdPace || '5:30';
    const hasCriticalSpeed = runningData.criticalSpeed != null;

    let bestEffortsStr = "";
    if (runningData.bestEfforts && Object.keys(runningData.bestEfforts).length > 0) {
      const effortParts = [];
      if (runningData.bestEfforts[400]) effortParts.push("400m: " + runningData.bestEfforts[400].time + " (" + runningData.bestEfforts[400].pace + "/km)");
      if (runningData.bestEfforts[800]) effortParts.push("800m: " + runningData.bestEfforts[800].time + " (" + runningData.bestEfforts[800].pace + "/km)");
      if (runningData.bestEfforts[1500]) effortParts.push("1.5k: " + runningData.bestEfforts[1500].time + " (" + runningData.bestEfforts[1500].pace + "/km)");
      if (runningData.bestEfforts[3000]) effortParts.push("3k: " + runningData.bestEfforts[3000].time + " (" + runningData.bestEfforts[3000].pace + "/km)");
      if (runningData.bestEfforts[5000]) effortParts.push("5k: " + runningData.bestEfforts[5000].time + " (" + runningData.bestEfforts[5000].pace + "/km)");
      if (effortParts.length > 0) {
        bestEffortsStr = "\n- **Best Efforts (42 days):** " + effortParts.join(" | ");
      }
    }

    let peakGapStr = "";
    if (runningData.seasonBestCS && runningData.criticalSpeed && runningData.seasonBestCS !== runningData.criticalSpeed) {
      peakGapStr = " (Season best: " + runningData.seasonBestCS + "/km)";
    }

    runContext = `
**1c. Running Profile (Pace Curve Analysis):**
- **Critical Speed (CS):** ${runningData.criticalSpeed || 'N/A'} min/km${peakGapStr} ${hasCriticalSpeed ? '← Use this for zone calculations' : ''}
- **D' (Anaerobic Capacity):** ${runningData.dPrime ? runningData.dPrime.toFixed(0) + 'm' : 'N/A'}
- **Threshold Pace (set):** ${runningData.thresholdPace || 'N/A'} min/km
- **LTHR:** ${runningData.lthr || 'N/A'} bpm | **Max HR:** ${runningData.maxHr || 'N/A'} bpm${bestEffortsStr}

**RUNNING ZONE CALCULATIONS (based on CS ${primaryPace}/km):**
- **Z1 (Recovery):** ${primaryPace} + 1:00 to 1:30 (~${addPace(primaryPace, 60)} - ${addPace(primaryPace, 90)}/km)
- **Z2 (Endurance):** ${primaryPace} + 0:30 to 1:00 (~${addPace(primaryPace, 30)} - ${addPace(primaryPace, 60)}/km)
- **Z3 (Tempo):** ${primaryPace} + 0:10 to 0:20 (~${addPace(primaryPace, 10)} - ${addPace(primaryPace, 20)}/km)
- **Z4 (Threshold/CS):** At ${primaryPace}/km
- **Z5 (VO2max):** ${primaryPace} - 0:10 to 0:20 (~${subtractPace(primaryPace, 20)} - ${subtractPace(primaryPace, 10)}/km)
- **Z6 (Anaerobic):** ${primaryPace} - 0:30+ (~${subtractPace(primaryPace, 30)}/km or faster)

**CRITICAL NOTES:**
- Critical Speed (${primaryPace}/km) is the running equivalent of cycling FTP.
- D' (${runningData.dPrime ? runningData.dPrime.toFixed(0) + 'm' : 'N/A'}) represents anaerobic capacity - larger = better sprint/kick.
- Include warm-up (10-15 min Z1-Z2) and cool-down (5-10 min Z1).
- For intervals, specify target pace AND duration clearly.
`;
  } else {
    runContext = `
**1c. Running Profile:**
- No specific running data available. Use RPE (Rate of Perceived Exertion) for intensity guidance.
- Easy: RPE 3-4 (can hold conversation)
- Tempo: RPE 5-6 (challenging but sustainable)
- Threshold: RPE 7-8 (hard, 20-30 min sustainable)
- VO2max: RPE 9 (very hard, 3-6 min sustainable)
`;
  }

  // Build wellness context
  let wellnessContext = "";
  if (wellness && wellness.available) {
    const w = wellness.today;
    const avg = wellness.averages;

    wellnessContext = `
**1b. Recovery & Wellness Data (from Whoop/wearable):**
- **Recovery Status:** ${wellness.recoveryStatus}
- **Recommended Intensity Modifier:** ${(wellness.intensityModifier * 100).toFixed(0)}%
- **Sleep:** ${w.sleep ? w.sleep.toFixed(1) + 'h' : 'N/A'} (${wellness.sleepStatus}) | 7-day avg: ${avg.sleep ? avg.sleep.toFixed(1) + 'h' : 'N/A'}
- **HRV (rMSSD):** ${w.hrv || 'N/A'} ms | 7-day avg: ${avg.hrv ? avg.hrv.toFixed(0) : 'N/A'} ms
- **Resting HR:** ${w.restingHR || 'N/A'} bpm | 7-day avg: ${avg.restingHR ? avg.restingHR.toFixed(0) : 'N/A'} bpm
- **Whoop Recovery Score:** ${w.recovery != null ? w.recovery + '%' : 'N/A'}
${w.soreness ? `- **Soreness:** ${w.soreness}/5` : ''}
${w.fatigue ? `- **Fatigue:** ${w.fatigue}/5` : ''}

**CRITICAL RECOVERY RULES:**
- If Recovery Status is "Red (Strained)": ONLY easy/recovery runs. No intervals.
- If Recovery Status is "Yellow (Recovering)": Reduce interval intensity. Favor tempo over VO2max.
- If Recovery Status is "Green (Primed)": Full intensity is appropriate.
- Running is higher impact than cycling - be MORE conservative with recovery.
`;
  }

  // Build adaptive training context
  let adaptiveTrainingContext = "";
  if (adaptiveContext && adaptiveContext.available) {
    adaptiveTrainingContext = `
**1d. Adaptive Training (Athlete Feedback Analysis):**
${adaptiveContext.promptContext}
**ADAPTIVE TRAINING RULES:**
- If recommendation is EASIER: Reduce intensity. Favor easy/recovery runs over intervals.
- If recommendation is HARDER: Athlete is handling load well. Can push pace slightly.
- If recommendation is MAINTAIN: Current approach is appropriate.
- Running has higher injury risk - be MORE conservative than cycling when feel is low.
`;
  }

  return `
You are an expert running coach using principles from Daniels, Pfitzinger, and modern training science.
Generate a running workout and evaluate its suitability.

**1a. Athlete Training Context:**
- **Goal:** ${phaseInfo.goalDescription || USER_SETTINGS.GOAL_DESCRIPTION}
- **Target Event:** In ${phaseInfo.weeksOut} weeks.
- **Current Phase:** "${phaseInfo.phaseName}"
- **Phase Focus:** ${phaseInfo.focus}
- **Current TSB (Training Stress Balance):** ${summary.tsb_current.toFixed(1)}
- **Note:** This is a RUNNING workout to complement cycling training.
${wellnessContext}${runContext}${adaptiveTrainingContext}
**2. Assignment: Design a "${type}" Running Workout**
- **Duration:** ${durationStr}. Total workout time including warm-up and cool-down.
- **Type Guidance:**
  - Run_Easy: Recovery/easy run, mostly Z1-Z2, conversational pace
  - Run_Tempo: Sustained effort at tempo/Z3 pace, build aerobic capacity
  - Run_Intervals: High-intensity intervals (400m-1km repeats) with recovery jogs
  - Run_Recovery: Very easy, regeneration focus, never exceed Z2

**3. REQUIRED WORKOUT FORMAT:**
Provide the workout as a clear, structured description that can be followed on any watch/app.
Include:
- Warm-up phase (time and pace/effort)
- Main set (intervals with specific pace/effort and recovery)
- Cool-down phase (time and pace/effort)
- Total estimated distance (if possible)

**4. Evaluate Recommendation (1-10):**
- Consider: Current Phase, TSB, Recovery Status, and that this is cross-training for a cyclist
- Running when fatigued increases injury risk - be conservative
- In cycling Peak phase, running should be easy (maintain, don't build)
- In Base phase, running can be more structured

**Output Format (JSON Only):**
{
  "explanation": "Strategy explanation in **${analysisLang}**. Include how recovery status influenced the workout design.",
  "recommendation_score": (integer 1-10),
  "recommendation_reason": "Reason based on Phase(${phaseInfo.phaseName}), TSB, Recovery, and cross-training context in **${analysisLang}**.",
  "workoutDescription": "Structured workout description with warm-up, main set, cool-down. Use clear formatting."
}
`;
}

// =========================================================
// COACHING NOTE GENERATION
// =========================================================

/**
 * Generate a personalized AI coaching note for the workout email
 * @param {object} summary - Athlete summary
 * @param {object} phaseInfo - Training phase info
 * @param {object} workout - Selected workout details
 * @param {object} wellness - Wellness data
 * @param {object} powerProfile - Power profile (optional)
 * @returns {string} AI-generated coaching note
 */
function generatePersonalizedCoachingNote(summary, phaseInfo, workout, wellness, powerProfile) {
  const language = USER_SETTINGS.LANGUAGE || 'en';
  const langMap = { en: 'English', nl: 'Dutch', ja: 'Japanese', es: 'Spanish', fr: 'French' };
  const langName = langMap[language] || 'English';

  const w = wellness?.today || {};
  const avg = wellness?.averages || {};

  let context = `You are an experienced cycling/running coach writing a brief, personalized note to your athlete about today's training.

**Athlete Context:**
- Training Phase: ${phaseInfo.phaseName} (${phaseInfo.weeksOut} weeks to goal)
- Phase Focus: ${phaseInfo.focus}
- Goal: ${phaseInfo.goalDescription || 'General fitness'}
- Current Fitness: CTL=${summary.ctl_90.toFixed(0)}, TSB=${summary.tsb_current.toFixed(0)} (${summary.tsb_current > 5 ? 'fresh' : summary.tsb_current < -15 ? 'fatigued' : 'balanced'})
`;

  if (wellness?.available) {
    context += `
**Today's Recovery Status:**
- Recovery: ${wellness.recoveryStatus}${w.recovery != null ? ` (${w.recovery}%)` : ''}
- Sleep: ${w.sleep ? w.sleep.toFixed(1) + 'h' : 'N/A'} (avg: ${avg.sleep ? avg.sleep.toFixed(1) + 'h' : 'N/A'})
- HRV: ${w.hrv || 'N/A'} ms (avg: ${avg.hrv ? avg.hrv.toFixed(0) : 'N/A'} ms)
- Resting HR: ${w.restingHR || 'N/A'} bpm
`;
  }

  if (powerProfile?.available) {
    context += `
**Power Profile:**
- eFTP: ${powerProfile.currentEftp || powerProfile.eFTP || 'N/A'}W
- Strengths: ${powerProfile.strengths?.join(', ') || 'N/A'}
- Areas to develop: ${powerProfile.weaknesses?.join(', ') || 'N/A'}
`;
  }

  context += `
**Today's Workout:**
- Type: ${workout.type}
- Why chosen: ${workout.recommendationReason || 'Based on training phase and recovery'}

**Instructions:**
Write a short, personalized coaching note (3-5 sentences) in ${langName} that:
1. Acknowledges how they're feeling today (based on recovery/sleep data)
2. Connects today's workout to their bigger goal and current phase
3. Gives one specific thing to focus on during the workout
4. Ends with brief encouragement

Be warm but professional. Use "you" to address the athlete directly. Don't repeat data they'll see elsewhere in the email. Be concise and motivating.`;

  return callGeminiAPIText(context);
}

// =========================================================
// REST DAY ADVICE
// =========================================================

/**
 * Generate AI-powered rest day advice based on wellness data
 * @param {object} wellness - Wellness summary
 * @returns {string} AI-generated rest day advice
 */
function generateRestDayAdvice(wellness) {
  const language = USER_SETTINGS.LANGUAGE || 'en';
  const langMap = { en: 'English', nl: 'Dutch', ja: 'Japanese', es: 'Spanish', fr: 'French' };
  const langName = langMap[language] || 'English';

  const w = wellness.today || {};
  const avg = wellness.averages || {};

  const prompt = `You are a professional cycling and running coach. The athlete has RED recovery status today, indicating they need rest.

**Today's Wellness Data:**
- Recovery Score: ${w.recovery != null ? w.recovery + '%' : 'N/A'} (RED = below 34%)
- Sleep: ${w.sleep ? w.sleep.toFixed(1) + 'h' : 'N/A'} (7-day avg: ${avg.sleep ? avg.sleep.toFixed(1) + 'h' : 'N/A'})
- HRV: ${w.hrv || 'N/A'} ms (7-day avg: ${avg.hrv ? avg.hrv.toFixed(0) : 'N/A'} ms)
- Resting HR: ${w.restingHR || 'N/A'} bpm (7-day avg: ${avg.restingHR ? avg.restingHR.toFixed(0) : 'N/A'} bpm)
- Soreness: ${w.soreness ? w.soreness + '/5' : 'N/A'}
- Fatigue: ${w.fatigue ? w.fatigue + '/5' : 'N/A'}
- Stress: ${w.stress ? w.stress + '/5' : 'N/A'}

**Instructions:**
Write a brief, encouraging rest day message in ${langName}. Include:
1. A short explanation of why rest is important today (2-3 sentences max)
2. Two light alternatives if they want to move (keep it simple):
   - Easy walk suggestion (duration, intensity)
   - Light strength/mobility suggestion (duration, focus areas)
3. A motivating closing line

Keep the tone supportive, not preachy. Be concise (max 150 words total).`;

  return callGeminiAPIText(prompt);
}

// =========================================================
// WEEKLY INSIGHT
// =========================================================

/**
 * Generate AI-powered weekly insight based on training data
 */
function generateWeeklyInsight(weekData, prevWeekData, fitnessMetrics, prevFitnessMetrics, wellnessSummary, prevWellnessSummary, currentEftp, prevWeekEftp, phaseInfo, goals) {
  const language = USER_SETTINGS.LANGUAGE || 'en';

  const ctlChange = fitnessMetrics.ctl - (prevFitnessMetrics.ctl || 0);
  const tsbChange = fitnessMetrics.tsb - (prevFitnessMetrics.tsb || 0);
  const eftpChange = (currentEftp && prevWeekEftp) ? currentEftp - prevWeekEftp : null;

  const prevAvg = prevWellnessSummary && prevWellnessSummary.available ? prevWellnessSummary.averages : {};
  const currAvg = wellnessSummary && wellnessSummary.available ? wellnessSummary.averages : {};
  const sleepChange = (currAvg.sleep && prevAvg.sleep) ? currAvg.sleep - prevAvg.sleep : null;
  const hrvChange = (currAvg.hrv && prevAvg.hrv) ? currAvg.hrv - prevAvg.hrv : null;

  const prompt = `You are a friendly, expert cycling and running coach reviewing an athlete's weekly training.

ATHLETE'S WEEK DATA:
- Activities: ${weekData.totalActivities} (${weekData.rides} rides, ${weekData.runs} runs)
- Total Time: ${Math.round(weekData.totalTime / 60)} minutes
- Total TSS: ${weekData.totalTss.toFixed(0)}
- Total Distance: ${(weekData.totalDistance / 1000).toFixed(1)} km

PREVIOUS WEEK:
- Activities: ${prevWeekData.totalActivities}
- Total TSS: ${prevWeekData.totalTss.toFixed(0)}

FITNESS METRICS (current → change vs last week):
- CTL (Fitness): ${fitnessMetrics.ctl.toFixed(1)} (${ctlChange >= 0 ? '+' : ''}${ctlChange.toFixed(1)})
- ATL (Fatigue): ${fitnessMetrics.atl.toFixed(1)}
- TSB (Form): ${fitnessMetrics.tsb.toFixed(1)} (${tsbChange >= 0 ? '+' : ''}${tsbChange.toFixed(1)})
- Ramp Rate: ${fitnessMetrics.rampRate ? fitnessMetrics.rampRate.toFixed(2) : 'N/A'}
- eFTP: ${currentEftp || 'N/A'}W${eftpChange !== null ? ' (' + (eftpChange >= 0 ? '+' : '') + eftpChange + 'W)' : ''}

WELLNESS (7-day averages → change vs last week):
- Sleep: ${currAvg.sleep ? currAvg.sleep.toFixed(1) + 'h' : 'N/A'}${sleepChange !== null ? ' (' + (sleepChange >= 0 ? '+' : '') + sleepChange.toFixed(1) + 'h)' : ''}
- HRV: ${currAvg.hrv ? currAvg.hrv.toFixed(0) + ' ms' : 'N/A'}${hrvChange !== null ? ' (' + (hrvChange >= 0 ? '+' : '') + hrvChange.toFixed(0) + ')' : ''}
- Resting HR: ${currAvg.restingHR ? currAvg.restingHR.toFixed(0) + ' bpm' : 'N/A'}

TRAINING PHASE: ${phaseInfo.phaseName}
GOAL: ${goals?.available && goals?.primaryGoal ? goals.primaryGoal.name + ' (' + goals.primaryGoal.date + ')' : 'General fitness'}
WEEKS TO GOAL: ${phaseInfo.weeksOut}

Write a brief, personalized weekly summary (3-4 sentences max) in ${language === 'nl' ? 'Dutch' : language === 'ja' ? 'Japanese' : language === 'es' ? 'Spanish' : language === 'fr' ? 'French' : 'English'}.

Include:
1. Acknowledge their training effort this week
2. Comment on significant changes: fitness (CTL/eFTP trends), form (TSB), or recovery (HRV/sleep)
3. One actionable insight based on the data trends
4. Brief encouragement for the upcoming week based on their phase

Keep it conversational, supportive, and concise. Do not use bullet points or headers. Just write natural sentences.`;

  try {
    const response = callGeminiAPIText(prompt);
    if (response) {
      return response.trim();
    }
  } catch (e) {
    Logger.log("Error generating weekly insight: " + e.toString());
  }

  return null;
}

// =========================================================
// MONTHLY INSIGHT
// =========================================================

/**
 * Generate AI-powered monthly insight based on training trends
 */
function generateMonthlyInsight(currentMonth, previousMonth, phaseInfo, goals) {
  const language = USER_SETTINGS.LANGUAGE || 'en';

  const activityChange = currentMonth.totals.activities - previousMonth.totals.activities;
  const tssChange = currentMonth.totals.tss - previousMonth.totals.tss;
  const ctlChange = currentMonth.fitness.ctlEnd - previousMonth.fitness.ctlEnd;
  const eftpChange = (currentMonth.fitness.eftpEnd && previousMonth.fitness.eftpEnd)
    ? currentMonth.fitness.eftpEnd - previousMonth.fitness.eftpEnd : null;

  const prompt = `You are a friendly, expert cycling and running coach reviewing an athlete's monthly training progress for ${currentMonth.monthName} ${currentMonth.monthYear}.

THIS MONTH (${currentMonth.monthName}):
- Total Activities: ${currentMonth.totals.activities}
- Total TSS: ${currentMonth.totals.tss.toFixed(0)}
- Average Weekly TSS: ${currentMonth.totals.avgWeeklyTss.toFixed(0)}
- CTL at end of month: ${currentMonth.fitness.ctlEnd.toFixed(1)}
- eFTP: ${currentMonth.fitness.eftpEnd || 'N/A'}W
- Consistency: ${currentMonth.consistency.weeksWithTraining}/${currentMonth.weeks} weeks trained

PREVIOUS MONTH (${previousMonth.monthName}) - FOR COMPARISON:
- Total Activities: ${previousMonth.totals.activities}
- Total TSS: ${previousMonth.totals.tss.toFixed(0)}
- CTL at end of month: ${previousMonth.fitness.ctlEnd.toFixed(1)}
- eFTP: ${previousMonth.fitness.eftpEnd || 'N/A'}W

MONTH-OVER-MONTH CHANGES:
- Activities: ${activityChange >= 0 ? '+' : ''}${activityChange}
- TSS: ${tssChange >= 0 ? '+' : ''}${tssChange.toFixed(0)}
- CTL: ${ctlChange >= 0 ? '+' : ''}${ctlChange.toFixed(1)}
${eftpChange != null ? '- eFTP: ' + (eftpChange >= 0 ? '+' : '') + eftpChange + 'W' : ''}

WEEKLY BREAKDOWN THIS MONTH (TSS per week):
${currentMonth.weeklyData.map((w, i) => `Week ${i + 1}: ${w.totalTss.toFixed(0)} TSS, CTL ${w.ctl.toFixed(0)}`).join('\n')}

TRAINING PHASE: ${phaseInfo.phaseName}
GOAL: ${goals?.available && goals?.primaryGoal ? goals.primaryGoal.name + ' (' + goals.primaryGoal.date + ')' : 'General fitness'}
WEEKS TO GOAL: ${phaseInfo.weeksOut}

Write a personalized monthly progress summary (3-4 sentences) in ${language === 'nl' ? 'Dutch' : language === 'ja' ? 'Japanese' : language === 'es' ? 'Spanish' : language === 'fr' ? 'French' : 'English'}.

Include:
1. Overall assessment of this month compared to last month
2. Comment on fitness progression (CTL trend, eFTP changes)
3. One key observation or recommendation
4. Brief encouragement based on progress toward their goal

Keep it conversational, insightful, and motivating. Do NOT wrap your response in quotes.`;

  try {
    const response = callGeminiAPIText(prompt);
    if (response) {
      let text = response.trim();
      if ((text.startsWith('"') && text.endsWith('"')) || (text.startsWith("'") && text.endsWith("'"))) {
        text = text.slice(1, -1);
      }
      return text;
    }
  } catch (e) {
    Logger.log("Error generating monthly insight: " + e.toString());
  }

  return null;
}

// =========================================================
// AI-DRIVEN PERIODIZATION
// =========================================================

/**
 * Generate AI-driven training phase assessment
 * Considers fitness trajectory, events, wellness trends, and workout patterns
 * @param {object} context - Full athlete context
 * @returns {object} { phaseName, focus, reasoning, adjustments, confidenceLevel, phaseOverride, upcomingEventNote }
 */
function generateAIPhaseAssessment(context) {
  // Build events context string
  let eventsContext = '';
  if (context.goals && context.goals.available) {
    const g = context.goals;
    const primaryStr = g.primaryGoal
      ? g.primaryGoal.name + ' (' + g.primaryGoal.date + ', ' + (g.primaryGoal.type || 'Unknown type') + ')'
      : 'None set';
    const bRacesStr = g.secondaryGoals && g.secondaryGoals.length > 0
      ? g.secondaryGoals.map(function(r) { return r.name + ' (' + r.date + ')'; }).join(', ')
      : '';
    const cRacesStr = g.subGoals && g.subGoals.length > 0
      ? g.subGoals.map(function(r) { return r.name + ' (' + r.date + ')'; }).join(', ')
      : '';

    eventsContext = `
**Race Calendar & Events:**
- **Primary Goal (A-Race):** ${primaryStr}
${bRacesStr ? '- **B-Races:** ' + bRacesStr : ''}
${cRacesStr ? '- **C-Races (Stepping Stones):** ' + cRacesStr : ''}
- **Total Events Planned:** ${g.allGoals ? g.allGoals.length : 0}
`;
  }

  // Build recent workouts pattern
  let workoutPatternContext = '';
  if (context.recentWorkouts) {
    const rw = context.recentWorkouts;
    const ridesStr = rw.rides && rw.rides.length > 0 ? rw.rides.join(', ') : 'None';
    const runsStr = rw.runs && rw.runs.length > 0 ? rw.runs.join(', ') : 'None';
    workoutPatternContext = `
**Recent Workout Patterns (7 days):**
- Rides: ${ridesStr}
- Runs: ${runsStr}
- Yesterday's Intensity: ${rw.lastIntensity || 'Unknown'}/5
`;
  }

  const prompt = `You are an expert cycling coach analyzing an athlete's current training phase.

**Date-Based Reference:**
- Target Event: ${context.goalDescription || 'Not specified'}
- Weeks to Event: ${context.weeksOut}
- Traditional Phase (by date): ${context.traditionalPhase}
${eventsContext}
**Fitness Trajectory:**
- Current CTL: ${context.ctl ? context.ctl.toFixed(1) : 'N/A'} | Weekly Ramp: ${context.rampRate ? context.rampRate.toFixed(2) : 'N/A'}/week
- Current eFTP: ${context.currentEftp || 'N/A'}W | Target FTP: ${context.targetFtp || 'N/A'}W
- eFTP Gap to Peak: ${context.eftpGap !== null && context.eftpGap !== undefined ? context.eftpGap + 'W' : 'N/A'}

**Recovery Trends (7-day averages):**
- HRV: ${context.hrvAvg ? context.hrvAvg.toFixed(0) + 'ms' : 'N/A'}
- Sleep: ${context.sleepAvg ? context.sleepAvg.toFixed(1) + 'h' : 'N/A'}
- Recovery Score: ${context.recoveryAvg ? context.recoveryAvg.toFixed(0) + '%' : 'N/A'}
- Today's Status: ${context.recoveryStatus || 'Unknown'}

**Recent Training Load:**
- Recent Z5+ Time: ${context.z5Recent > 1500 ? 'High' : 'Normal'}
- TSB: ${context.tsb ? context.tsb.toFixed(1) : 'N/A'}
${workoutPatternContext}
**Question:** Based on fitness trajectory AND the event calendar (not just weeks to A-race), what phase should this athlete be in?

Consider:
1. Is CTL building appropriately for the goal timeline?
2. Is eFTP trending toward target or stalling?
3. Are recovery metrics supporting the current load?
4. Should we accelerate, maintain, or ease the progression?
5. **Are there upcoming B/C races that require mini-tapers or intensity peaks?**
6. **Is the athlete's current fitness on track for the A-race, or behind/ahead of schedule?**

**Output JSON only (no markdown wrapping):**
{
  "phaseName": "Base|Build|Specialty|Taper|Race Week",
  "focus": "1-sentence phase focus description",
  "reasoning": "Brief explanation of why this phase (2-3 sentences)",
  "adjustments": "Any modifications to standard phase approach (e.g., mini-taper for upcoming C-race)",
  "confidenceLevel": "high|medium|low",
  "phaseOverride": true or false,
  "upcomingEventNote": "Note about any near-term B/C races affecting this week's approach (optional, null if none)"
}`;

  const response = callGeminiAPIText(prompt);

  if (!response) {
    Logger.log("AI phase assessment: No response from Gemini");
    return null;
  }

  try {
    // Parse JSON from response (handle markdown wrapping if present)
    let cleaned = response.trim();
    cleaned = cleaned.replace(/^```json\n?/g, '').replace(/^```\n?/g, '').replace(/```$/g, '').trim();
    return JSON.parse(cleaned);
  } catch (e) {
    Logger.log("Failed to parse AI phase assessment: " + e.toString());
    Logger.log("Raw response: " + response.substring(0, 500));
    return null;
  }
}

