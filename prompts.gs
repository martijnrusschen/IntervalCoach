/**
 * IntervalCoach - AI Prompts
 *
 * Prompt construction for workout generation via Gemini AI.
 */

// =========================================================
// LANGUAGE HELPER
// =========================================================

/**
 * Get the language name for AI prompts based on user settings
 * @returns {string} Language name (e.g., "Dutch", "English")
 */
function getPromptLanguage() {
  const langMap = { "ja": "Japanese", "en": "English", "es": "Spanish", "fr": "French", "nl": "Dutch" };
  return langMap[USER_SETTINGS.LANGUAGE] || "English";
}

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
function createPrompt(type, summary, phaseInfo, dateStr, duration, wellness, powerProfile, adaptiveContext, crossSportEquivalency) {
  const analysisLang = getPromptLanguage();

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

  // Build cross-sport context
  let crossSportContext = "";
  if (crossSportEquivalency && crossSportEquivalency.available) {
    const cs = crossSportEquivalency;
    crossSportContext = `
**1e. Cross-Sport Context (Cycling ↔ Running):**
- **Cycling FTP:** ${cs.cycling.ftp}W | **Running CS:** ${cs.running.criticalSpeed}/km
- **Cycling W':** ${cs.cycling.wPrimeKj || 'N/A'} kJ | **Running D':** ${cs.running.dPrime ? Math.round(cs.running.dPrime) + 'm' : 'N/A'}
- **Zone Equivalence:** Same zone = same physiological stress across sports

**CROSS-SPORT RULES:**
- This athlete also runs. Consider cumulative training load from both sports.
- If athlete ran recently (especially Z4+), adjust cycling intensity to manage total stress.
- Cycling is lower impact but still contributes to overall fatigue.
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
${wellnessContext}${powerContext}${adaptiveTrainingContext}${crossSportContext}
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
function createRunPrompt(type, summary, phaseInfo, dateStr, duration, wellness, runningData, adaptiveContext, crossSportEquivalency) {
  const analysisLang = getPromptLanguage();

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

  // Build cross-sport context
  let crossSportContext = "";
  if (crossSportEquivalency && crossSportEquivalency.available) {
    const cs = crossSportEquivalency;
    crossSportContext = `
**1e. Cross-Sport Context (Cycling ↔ Running):**
- **Cycling FTP:** ${cs.cycling.ftp}W | **Running CS:** ${cs.running.criticalSpeed}/km
- **Cycling W':** ${cs.cycling.wPrimeKj || 'N/A'} kJ | **Running D':** ${cs.running.dPrime ? Math.round(cs.running.dPrime) + 'm' : 'N/A'}
- **Zone Equivalence:** Same zone = same physiological stress across sports

**CROSS-SPORT RULES:**
- This athlete also cycles. Running zones should match equivalent cycling effort.
- If recent cycling was intense (Z4+), consider easier running to manage total load.
- Running has higher impact stress - even equivalent zones feel harder on the body.
- Use running strategically: efficient for VO2max work, harder on joints than cycling.
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
${wellnessContext}${runContext}${adaptiveTrainingContext}${crossSportContext}
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
// AI EMAIL SUBJECT LINE
// =========================================================

/**
 * Generate an engaging AI-powered email subject line
 * @param {object} phaseInfo - Training phase info
 * @param {object} workout - Selected workout details
 * @param {object} wellness - Wellness data
 * @returns {string} AI-generated subject line
 */
function generateAIEmailSubject(phaseInfo, workout, wellness) {
  const langName = getPromptLanguage();

  // Build context for AI
  let recoveryContext = 'Unknown';
  if (wellness?.available) {
    if (wellness.recoveryStatus.includes("Green") || wellness.recoveryStatus.includes("Primed")) {
      recoveryContext = 'Excellent (green/primed)';
    } else if (wellness.recoveryStatus.includes("Yellow") || wellness.recoveryStatus.includes("Normal")) {
      recoveryContext = 'Moderate (yellow/normal)';
    } else if (wellness.recoveryStatus.includes("Red") || wellness.recoveryStatus.includes("Fatigued")) {
      recoveryContext = 'Low (red/fatigued)';
    }
  }

  const prompt = `Generate a SHORT, engaging email subject line for a cycling/running workout email.

Context:
- Workout type: ${workout.type}
- Training phase: ${phaseInfo.phaseName}
- Recovery status: ${recoveryContext}
- Goal: ${phaseInfo.goalDescription || 'General fitness'}

Requirements:
- Write in ${langName}
- Maximum 50 characters (STRICT LIMIT)
- Be motivating and specific to the workout
- NO brackets, NO tags like [GREEN]
- Examples: "Base building: Z2 duurrit", "Hersteldag: rustig aan", "Topvorm! VO2max intervals"

Return ONLY the subject line, nothing else.`;

  try {
    const response = callGeminiAPIText(prompt);
    if (response && response.trim().length > 0 && response.trim().length <= 60) {
      return response.trim();
    }
  } catch (e) {
    Logger.log("AI subject generation failed: " + e.toString());
  }

  // Fallback to simple format
  return workout.type;
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
  const langName = getPromptLanguage();

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
  const langName = getPromptLanguage();

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
 * Generate AI-powered weekly coaching narrative
 * Enhanced to produce comprehensive coaching letter, not just brief insight
 * @param {object} weekData - This week's activity data
 * @param {object} prevWeekData - Previous week's activity data
 * @param {object} fitnessMetrics - Current fitness metrics
 * @param {object} prevFitnessMetrics - Previous week's fitness metrics
 * @param {object} wellnessSummary - Wellness summary with averages
 * @param {object} prevWellnessSummary - Previous week's wellness summary
 * @param {number} currentEftp - Current eFTP
 * @param {number} prevWeekEftp - Previous week's eFTP
 * @param {object} phaseInfo - Training phase info
 * @param {object} goals - Goal information
 * @param {object} loadAdvice - Training load advice (optional)
 * @param {Array} upcomingPlaceholders - Upcoming week's planned workouts (optional)
 */
function generateWeeklyInsight(weekData, prevWeekData, fitnessMetrics, prevFitnessMetrics, wellnessSummary, prevWellnessSummary, currentEftp, prevWeekEftp, phaseInfo, goals, loadAdvice, upcomingPlaceholders) {
  const langName = getPromptLanguage();

  const ctlChange = fitnessMetrics.ctl - (prevFitnessMetrics.ctl || 0);
  const tsbChange = fitnessMetrics.tsb - (prevFitnessMetrics.tsb || 0);
  const eftpChange = (currentEftp && prevWeekEftp) ? currentEftp - prevWeekEftp : null;
  const tssChange = weekData.totalTss - (prevWeekData.totalTss || 0);

  const prevAvg = prevWellnessSummary && prevWellnessSummary.available ? prevWellnessSummary.averages : {};
  const currAvg = wellnessSummary && wellnessSummary.available ? wellnessSummary.averages : {};
  const sleepChange = (currAvg.sleep && prevAvg.sleep) ? currAvg.sleep - prevAvg.sleep : null;
  const hrvChange = (currAvg.hrv && prevAvg.hrv) ? currAvg.hrv - prevAvg.hrv : null;

  // Build upcoming week context
  let upcomingContext = '';
  if (upcomingPlaceholders && upcomingPlaceholders.length > 0) {
    const workoutList = upcomingPlaceholders.map(p => p.name || p.type || 'Workout').join(', ');
    upcomingContext = `\nUPCOMING WEEK PLANNED:\n- ${upcomingPlaceholders.length} sessions: ${workoutList}`;
  }

  // Build load advice context
  let loadContext = '';
  if (loadAdvice) {
    loadContext = `\nLOAD RECOMMENDATION:\n- Advice: ${loadAdvice.rampRateAdvice}\n- Weekly TSS Target: ${loadAdvice.tssRange?.min}-${loadAdvice.tssRange?.max}`;
    if (loadAdvice.warning) {
      loadContext += `\n- Warning: ${loadAdvice.warning}`;
    }
  }

  const prompt = `You are a friendly, expert cycling and running coach writing a personalized weekly coaching letter to your athlete.

THIS WEEK'S TRAINING:
- Activities: ${weekData.totalActivities} (${weekData.rides} rides, ${weekData.runs} runs)
- Total Time: ${Math.round(weekData.totalTime / 60)} minutes (${(weekData.totalTime / 3600).toFixed(1)} hours)
- Total TSS: ${weekData.totalTss.toFixed(0)} (${tssChange >= 0 ? '+' : ''}${tssChange.toFixed(0)} vs last week)
- Total Distance: ${(weekData.totalDistance / 1000).toFixed(1)} km

PREVIOUS WEEK:
- Activities: ${prevWeekData.totalActivities}
- Total TSS: ${prevWeekData.totalTss.toFixed(0)}

FITNESS PROGRESS:
- CTL (Fitness): ${fitnessMetrics.ctl.toFixed(1)} (${ctlChange >= 0 ? '+' : ''}${ctlChange.toFixed(1)} this week)
- TSB (Form): ${fitnessMetrics.tsb.toFixed(1)} (${tsbChange >= 0 ? '+' : ''}${tsbChange.toFixed(1)})
- eFTP: ${currentEftp || 'N/A'}W${eftpChange !== null ? ' (' + (eftpChange >= 0 ? '+' : '') + eftpChange + 'W)' : ''}
- Ramp Rate: ${fitnessMetrics.rampRate ? fitnessMetrics.rampRate.toFixed(2) + ' CTL/week' : 'N/A'}

RECOVERY & WELLNESS (7-day averages):
- Sleep: ${currAvg.sleep ? currAvg.sleep.toFixed(1) + 'h' : 'N/A'}${sleepChange !== null ? ' (' + (sleepChange >= 0 ? '+' : '') + sleepChange.toFixed(1) + 'h vs last week)' : ''}
- HRV: ${currAvg.hrv ? currAvg.hrv.toFixed(0) + ' ms' : 'N/A'}${hrvChange !== null ? ' (' + (hrvChange >= 0 ? '+' : '') + hrvChange.toFixed(0) + ')' : ''}
- Recovery Status: ${wellnessSummary?.recoveryStatus || 'Unknown'}

TRAINING CONTEXT:
- Phase: ${phaseInfo.phaseName}
- Goal: ${goals?.available && goals?.primaryGoal ? goals.primaryGoal.name + ' (' + goals.primaryGoal.date + ')' : 'General fitness'}
- Weeks to Goal: ${phaseInfo.weeksOut}${loadContext}${upcomingContext}

Write a personalized coaching letter (5-7 sentences) in ${langName}.

Your letter should feel like it's from a personal coach who knows this athlete. Include:
1. Open with acknowledgment of their week (effort, consistency, key sessions)
2. Highlight the most significant metric change (fitness gains, recovery trends)
3. Connect their progress to their goal (what this week means for Marmotte/their A race)
4. Address any concerns (fatigue building up, recovery declining) with reassurance
5. Preview next week with coaching intent (what to focus on, what to watch for)
6. Close with motivating but genuine encouragement

Write in a warm, conversational tone. Use "you" and "your" to make it personal. Do not use bullet points, headers, or emoji. Just write natural paragraphs.`;

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
  const langName = getPromptLanguage();

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

Write a personalized monthly progress summary (3-4 sentences) in ${langName}.

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
    const daysAgo = rw.daysSinceLastWorkout != null ? rw.daysSinceLastWorkout : 'Unknown';
    workoutPatternContext = `
**Recent Workout Patterns (7 days):**
- Rides: ${ridesStr}
- Runs: ${runsStr}
- Last Workout Intensity: ${rw.lastIntensity || 'Unknown'}/5 (${daysAgo} days ago)
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
  const assessment = parseGeminiJsonResponse(response);
  if (!assessment) {
    Logger.log("AI phase assessment: Failed to parse response");
  }
  return assessment;
}

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
// AI TRAINING LOAD ADVISOR
// =========================================================

/**
 * Generate AI-driven training load advice
 * Replaces fixed ramp rate thresholds with personalized recommendations
 * @param {object} fitnessMetrics - Current CTL, ATL, TSB, rampRate
 * @param {object} phaseInfo - Training phase info (weeksOut, phaseName)
 * @param {object} goals - Goal information
 * @param {object} wellness - Wellness data with averages
 * @returns {object} { recommendedRampRate, rampRateCategory, personalizedAdvice, warnings, confidence }
 */
function generateAITrainingLoadAdvice(fitnessMetrics, phaseInfo, goals, wellness) {
  const langName = getPromptLanguage();

  const currentCTL = fitnessMetrics.ctl || 0;
  const currentATL = fitnessMetrics.atl || 0;
  const currentTSB = fitnessMetrics.tsb || 0;
  const currentRampRate = fitnessMetrics.rampRate || 0;
  const weeksOut = phaseInfo.weeksOut || 12;

  // Build goal context
  let goalContext = 'General fitness improvement';
  if (goals && goals.available && goals.primaryGoal) {
    goalContext = goals.primaryGoal.name + ' (' + goals.primaryGoal.date + ')';
    if (goals.primaryGoal.type) {
      goalContext += ' - ' + goals.primaryGoal.type;
    }
  }

  // Build wellness context
  let wellnessContext = 'No wellness data available';
  if (wellness && wellness.available && wellness.averages) {
    const avg = wellness.averages;
    wellnessContext = `7-day averages:
- Sleep: ${avg.sleep ? avg.sleep.toFixed(1) + 'h' : 'N/A'}
- HRV: ${avg.hrv ? avg.hrv.toFixed(0) + ' ms' : 'N/A'}
- Resting HR: ${avg.restingHR ? avg.restingHR.toFixed(0) + ' bpm' : 'N/A'}
- Recovery Score: ${avg.recovery ? avg.recovery.toFixed(0) + '%' : 'N/A'}`;

    // Add trend indicators if today's data available
    if (wellness.today) {
      const t = wellness.today;
      if (t.hrv && avg.hrv) {
        const hrvDiff = t.hrv - avg.hrv;
        wellnessContext += `\nToday vs avg: HRV ${hrvDiff >= 0 ? '+' : ''}${hrvDiff.toFixed(0)} ms`;
      }
      if (t.sleep && avg.sleep) {
        const sleepDiff = t.sleep - avg.sleep;
        wellnessContext += `, Sleep ${sleepDiff >= 0 ? '+' : ''}${sleepDiff.toFixed(1)}h`;
      }
    }
  }

  const prompt = `You are an expert cycling coach advising on training load progression.

**Current Fitness State:**
- CTL (Chronic Training Load): ${currentCTL.toFixed(1)}
- ATL (Acute Training Load): ${currentATL.toFixed(1)}
- TSB (Training Stress Balance): ${currentTSB.toFixed(1)} ${currentTSB > 5 ? '(Fresh)' : currentTSB < -15 ? '(Fatigued)' : '(Balanced)'}
- Current Ramp Rate: ${currentRampRate.toFixed(1)} CTL/week

**Training Context:**
- Phase: ${phaseInfo.phaseName}
- Weeks to Goal: ${weeksOut}
- Goal: ${goalContext}

**Wellness/Recovery Data:**
${wellnessContext}

**Standard Ramp Rate Guidelines (for reference):**
- Maintain: 0-3 CTL/week (on track, minimal stress)
- Build: 3-5 CTL/week (sustainable progression)
- Aggressive: 5-7 CTL/week (monitor closely)
- Caution: >7 CTL/week (risk of overtraining)

**Your Task:**
Based on the athlete's current state, wellness trends, and training context:
1. Recommend an appropriate ramp rate for the coming week
2. Consider wellness signals - poor sleep/HRV suggests conservative approach
3. Factor in TSB - high fatigue may warrant recovery week
4. Account for training phase - taper phases need reduction, not building

**Output JSON only (no markdown wrapping):**
Write the "personalizedAdvice" and "warnings" in ${langName}.
{
  "recommendedRampRate": <number between -5 and 8>,
  "rampRateCategory": "Recovery|Maintain|Build|Aggressive|Reduce",
  "personalizedAdvice": "1-2 sentence personalized recommendation in ${langName}",
  "warnings": ["Array of specific warnings in ${langName}, empty array if none"],
  "weeklyTSSMultiplier": <number 0.4-1.1 to adjust base weekly TSS>,
  "confidence": "high|medium|low"
}`;

  const response = callGeminiAPIText(prompt);
  const advice = parseGeminiJsonResponse(response);
  if (!advice) {
    Logger.log("AI training load advice: Failed to parse response");
  }
  return advice;
}

// =========================================================
// AI RECOVERY ASSESSMENT
// =========================================================

/**
 * Generate AI-driven recovery assessment using personal baselines
 * Replaces fixed thresholds with individualized analysis
 * @param {object} today - Today's wellness data
 * @param {object} averages - 7-day averages (personal baselines)
 * @returns {object} { recoveryStatus, intensityModifier, personalizedReason, confidence }
 */
function generateAIRecoveryAssessment(today, averages) {
  if (!today) {
    return null;
  }

  const langName = getPromptLanguage();

  // Calculate trend indicators
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

  const prompt = `You are an expert coach assessing an athlete's recovery status for today's training.

**Today's Wellness Data:**
- Recovery Score: ${today.recovery != null ? today.recovery + '%' : 'N/A'}${recoveryTrend ? ` (${recoveryTrend >= 0 ? '+' : ''}${recoveryTrend}% vs avg)` : ''}
- HRV: ${today.hrv || 'N/A'} ms${hrvTrend ? ` (${hrvTrend >= 0 ? '+' : ''}${hrvTrend}% vs avg)` : ''}
- Sleep: ${today.sleep ? today.sleep.toFixed(1) + 'h' : 'N/A'}${sleepTrend ? ` (${sleepTrend >= 0 ? '+' : ''}${sleepTrend}h vs avg)` : ''}
- Resting HR: ${today.restingHR || 'N/A'} bpm${subjectiveContext}

**Personal Baselines (7-day averages):**
- Avg Recovery: ${averages.recovery ? averages.recovery.toFixed(0) + '%' : 'N/A'}
- Avg HRV: ${averages.hrv ? averages.hrv.toFixed(0) + ' ms' : 'N/A'}
- Avg Sleep: ${averages.sleep ? averages.sleep.toFixed(1) + 'h' : 'N/A'}
- Avg Resting HR: ${averages.restingHR ? averages.restingHR.toFixed(0) + ' bpm' : 'N/A'}

**Assessment Guidelines:**
- Consider personal baselines, not population norms
- HRV above personal average = positive sign, below = concerning
- Recovery trends matter: improving = green, declining = yellow/red
- Weight multiple signals: a low recovery score with high HRV may still be OK
- Sleep debt compounds: multiple poor nights = more conservative

**Determine recovery status:**
- **Green (Primed)**: Above personal baseline, ready for hard training
- **Yellow (Recovering)**: Near baseline or mixed signals, moderate training OK
- **Red (Strained)**: Below baseline on multiple metrics, easy day recommended

**Output JSON only (no markdown wrapping):**
Write the "personalizedReason" in ${langName}.
{
  "recoveryStatus": "Green (Primed)|Yellow (Recovering)|Red (Strained)",
  "intensityModifier": <number 0.7-1.0>,
  "personalizedReason": "1-2 sentence explanation in ${langName} using their specific data",
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

/**
 * AI-driven event-specific training analysis
 * Analyzes race profile and returns custom training emphasis and peaking strategy
 *
 * @param {object} goal - Goal event (name, date, type, description, priority)
 * @param {object} powerProfile - Athlete's power profile
 * @param {object} fitnessMetrics - Current fitness (CTL, ATL, TSB)
 * @param {number} weeksOut - Weeks until event
 * @returns {object} Event-specific training recommendations
 */
function generateAIEventAnalysis(goal, powerProfile, fitnessMetrics, weeksOut) {
  const langName = getPromptLanguage();

  // Build event context
  const eventContext = `
EVENT DETAILS:
- Name: ${goal.name}
- Date: ${goal.date}
- Priority: ${goal.priority || 'A'}-race
- Type: ${goal.type || 'Unknown'}
- Description: ${goal.description || 'No description provided'}
- Weeks Until Event: ${weeksOut}
`;

  // Build athlete context
  const athleteContext = `
ATHLETE PROFILE:
- Current eFTP: ${powerProfile?.eFTP || 'Unknown'}W
- W': ${powerProfile?.wPrime || 'Unknown'}kJ
- Current CTL: ${fitnessMetrics?.ctl?.toFixed(0) || 'Unknown'}
- Current ATL: ${fitnessMetrics?.atl?.toFixed(0) || 'Unknown'}
- Current TSB: ${fitnessMetrics?.tsb?.toFixed(0) || 'Unknown'}
- Power Strengths: ${powerProfile?.strengths?.join(', ') || 'Unknown'}
- Power Weaknesses: ${powerProfile?.focusAreas?.join(', ') || 'Unknown'}
`;

  const prompt = `You are an expert cycling coach analyzing an upcoming event to create a tailored training strategy.

${eventContext}
${athleteContext}

Analyze this event and provide specific training recommendations. Consider:

1. **Event Demands Analysis** - What physiological systems does this event stress?
   - Climbing events → sustained power, threshold, weight-to-power
   - Criteriums → repeated hard efforts, anaerobic capacity, acceleration
   - Time trials → sustained threshold power, pacing
   - Gran fondos → endurance, fueling, steady-state efficiency
   - Hilly races → variable power, surges, recovery between efforts

2. **Training Emphasis** - Based on event demands and athlete's current strengths/weaknesses:
   - Which energy systems to prioritize?
   - What workout types are most important?
   - How should intensity distribution shift?

3. **Peaking Strategy** - How to arrive fresh and fit:
   - Recommended taper length and style
   - When to do the last hard workout
   - Volume reduction curve

4. **Timeline Recommendations** - Given ${weeksOut} weeks out:
   - What phase should training be in now?
   - Key focuses for the remaining weeks
   - Any benchmark workouts to gauge readiness

**IMPORTANT: Respond with ONLY valid JSON. No introductory text, no explanations. Just the JSON object.**
Use ${langName} for all string values within the JSON:
{
  "eventProfile": {
    "category": "climbing|criterium|time_trial|gran_fondo|road_race|mixed",
    "primaryDemands": ["list of 2-3 key physiological demands"],
    "secondaryDemands": ["list of 1-2 secondary demands"],
    "estimatedDuration": "expected race duration",
    "keyChallenge": "single most important factor for success"
  },
  "trainingEmphasis": {
    "priorityWorkouts": ["top 3 workout types to focus on"],
    "secondaryWorkouts": ["2-3 supporting workout types"],
    "avoidWorkouts": ["workout types that are less important now"],
    "weeklyStructure": "recommended weekly structure description",
    "intensityFocus": "threshold|vo2max|endurance|anaerobic|mixed"
  },
  "peakingStrategy": {
    "taperLength": "recommended taper in weeks (1-3)",
    "taperStyle": "linear|step|exponential",
    "lastHardWorkout": "days before event for last intensity",
    "volumeReduction": "percentage reduction per week during taper",
    "openerWorkout": "recommended day-before-race workout"
  },
  "currentPhaseAdvice": {
    "phase": "what phase athlete should be in now",
    "weeklyFocus": "primary focus for this week",
    "keyWorkout": "most important workout to nail",
    "buildVsTaper": "building|maintaining|tapering"
  },
  "athleteSpecificNotes": "2-3 sentences on how this athlete's profile matches or mismatches the event demands, and what to prioritize",
  "confidence": "high|medium|low"
}`;

  const response = callGeminiAPIText(prompt);
  const result = parseGeminiJsonResponse(response);
  if (!result) {
    Logger.log("AI event analysis: Failed to parse response");
    return null;
  }
  result.aiEnhanced = true;
  return result;
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
function generatePostWorkoutAnalysis(activity, wellness, fitness, powerProfile, runningData) {
  const langName = getPromptLanguage();
  const isRun = activity.type === "Run";

  // Extract zone distribution for stimulus analysis
  const zoneDistribution = activity.icu_zone_times ?
    activity.icu_zone_times.map(z => `${z.id}: ${Math.round(z.secs / 60)}min`).join(", ") :
    "Not available";

  // Build sport-specific context
  let sportContext = "";
  if (isRun && runningData.available) {
    sportContext = `
**Running Profile:**
- Critical Speed: ${runningData.criticalSpeed || 'N/A'}/km
- D': ${runningData.dPrime ? runningData.dPrime.toFixed(0) + 'm' : 'N/A'}
- Threshold Pace: ${runningData.thresholdPace || 'N/A'}/km`;
  } else if (!isRun && powerProfile.available) {
    sportContext = `
**Power Profile:**
- eFTP: ${powerProfile.currentEftp || powerProfile.eFTP || 'N/A'}W
- W': ${powerProfile.wPrimeKj || 'N/A'}kJ
- VO2max: ${powerProfile.vo2max ? powerProfile.vo2max.toFixed(1) : 'N/A'}
- Peak Powers: 5s=${powerProfile.peak5s}W | 1min=${powerProfile.peak1min}W | 5min=${powerProfile.peak5min}W`;
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

  const prompt = `You are an expert cycling and running coach analyzing a completed workout.

**Workout Details:**
- Name: ${activity.name}
- Type: ${activity.type}
- Duration: ${Math.round(activity.moving_time / 60)} minutes
- TSS/Training Load: ${activity.icu_training_load}
- Intensity Factor: ${activity.icu_intensity || 'N/A'}
- Variability Index: ${activity.icu_variability_index || 'N/A'} (cycling)
- RPE: ${activity.icu_rpe || 'Not recorded'} / 10
- Feel: ${activity.feel ? getFeelLabel(activity.feel) : 'Not recorded'} (scale: 1=Strong to 5=Weak)
- Zone Distribution: ${zoneDistribution}
${sportContext}

**Current Fitness State:**
- CTL (Fitness): ${fitness.ctl || 'N/A'}
- ATL (Fatigue): ${fitness.atl || 'N/A'}
- TSB (Form): ${fitness.tsb || 'N/A'}
- CTL Ramp Rate: ${fitness.rampRate || 'N/A'} per week
${wellnessContext}

**Analysis Tasks:**

1. **Workout Effectiveness** (1-10 scale):
   - Was the workout executed well based on zone distribution and metrics?
   - Did it achieve its intended stimulus?
   - Quality of execution (consistent power/pace, appropriate pacing)

2. **Difficulty Assessment**:
   - Based on RPE/Feel and the metrics, was this workout:
     - "easier_than_expected" (RPE < 6 for structured workout)
     - "as_expected" (RPE 6-8 for hard intervals, 3-5 for endurance)
     - "harder_than_expected" (RPE > 8, or much higher than typical)

3. **Recovery Impact**:
   - How will this workout affect recovery over next 24-48h?
   - Should next workout be adjusted based on this session?

4. **Key Insight**:
   - What's the single most important takeaway from this workout?
   - Any red flags or exceptional performances to highlight?

5. **Training Adjustments**:
   - Should we adjust future workouts based on this performance?
   - Calibration needed for FTP/zones or workout intensity?

**IMPORTANT: Respond with ONLY valid JSON. No introductory text, no explanations. Just the JSON object.**
Use ${langName} for all string values within the JSON:
{
  "effectiveness": 1-10 (how well the workout was executed),
  "effectivenessReason": "1-2 sentences explaining the effectiveness rating",
  "difficultyMatch": "easier_than_expected|as_expected|harder_than_expected",
  "difficultyReason": "1-2 sentences explaining why difficulty matched or didn't match expectations",
  "workoutStimulus": "recovery|endurance|tempo|threshold|vo2max|anaerobic|mixed",
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
    "ftpCalibration": "none|increase_5w|decrease_5w|retest_recommended",
    "futureIntensity": "maintain|increase_slightly|decrease_slightly",
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
