/**
 * IntervalCoach - Workout Generation Prompts
 *
 * AI prompts for generating cycling and running workouts.
 * Related modules: prompts_analysis.gs, prompts_planning.gs, api.gs
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
// ZONE CONTEXT HELPER
// =========================================================

/**
 * Build personalized zone context string for AI prompt
 * @param {object} powerProfile - Power profile with optional zoneAnalysis
 * @returns {string} Zone context string (empty if no analysis available)
 */
function buildZoneContext(powerProfile) {
  if (!powerProfile || !powerProfile.zoneAnalysis || !powerProfile.zoneAnalysis.available) {
    return '';
  }

  const za = powerProfile.zoneAnalysis;
  const recs = za.zoneRecommendations;
  const profileType = determineProfileType(za);

  // Format suggested zones as percentages
  const zones = recs.suggestedZones;
  const zoneStr = `Z1: 0-${zones.z1.high}% | Z2: ${zones.z2.low}-${zones.z2.high}% | Z3: ${zones.z3.low}-${zones.z3.high}% | Z4: ${zones.z4.low}-${zones.z4.high}% | Z5: ${zones.z5.low}-${zones.z5.high}% | Z6: ${zones.z6.low}%+`;

  // Build insights string
  const insights = recs.insights.length > 0 ? recs.insights.slice(0, 2).join('. ') : '';

  return `
**1f. Personalized Power Zones (${profileType} Profile):**
- **Zones:** ${zoneStr}
- **Capacities:** Sprint=${za.sprintCapacity}, Anaerobic=${za.anaerobicCapacity}, VO2max=${za.vo2maxCapacity}, Durability=${za.aerobicDurability}
${insights ? `- **Note:** ${insights}` : ''}
`;
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
function createPrompt(type, summary, phaseInfo, dateStr, duration, wellness, powerProfile, adaptiveContext, crossSportEquivalency, lastWorkoutAnalysis, warnings) {
  const analysisLang = getPromptLanguage();

  // Initialize warnings object if not provided
  warnings = warnings || {};

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
${buildZoneContext(powerProfile)}
**POWER PROFILE RULES:**
- Use current eFTP (${powerProfile.ftp}W) for zone calculations - this reflects current fitness.
- **W' (${powerProfile.wPrimeKj || 'N/A'}kJ)** represents anaerobic capacity. Use W' to guide interval structure:
  - **Low W' (<15kJ):** Athlete depletes anaerobic reserves quickly. Use LONGER recovery (3-4min between hard efforts), FEWER repeats per set (3-4 max), and avoid stacking back-to-back max efforts. Build W' with 30s-2min efforts with full recovery.
  - **Normal W' (15-25kJ):** Standard interval structure. 2-3min recovery between VO2max efforts, 4-5 repeats per set.
  - **High W' (>25kJ):** Athlete can sustain repeated hard efforts. Can use SHORTER recovery (1.5-2min), MORE repeats (5-6 per set), and stack efforts with incomplete recovery for race simulation.
- **TTE** (time to exhaustion at FTP) indicates threshold endurance. Low TTE = prescribe longer threshold intervals.
- Peak powers are all-time bests; current capabilities may be lower due to seasonal fitness variation.
- Design intervals that target identified weaknesses when appropriate for the phase.
- For climbing goals, prioritize 5-20 minute power development.
- **Personalized Zones:** If provided in 1f, use those zone boundaries instead of standard percentages. This ensures intervals match the athlete's unique physiology.
`;
  }

  // Build wellness context string
  let wellnessContext = "";
  if (wellness && wellness.available) {
    const w = wellness.today;
    const avg = wellness.averages;

    // Build sleep quality details if available
    let sleepDetails = '';
    if (w.remSleep || w.deepSleep) {
      const parts = [];
      if (w.deepSleep) parts.push(`Deep: ${w.deepSleep.toFixed(1)}h`);
      if (w.remSleep) parts.push(`REM: ${w.remSleep.toFixed(1)}h`);
      if (w.sleepEfficiency) parts.push(`Efficiency: ${w.sleepEfficiency.toFixed(0)}%`);
      sleepDetails = parts.length > 0 ? ` (${parts.join(', ')})` : '';
    }

    // Build physiological indicators
    let physioIndicators = '';
    if (w.spO2 || w.skinTemp) {
      const parts = [];
      if (w.spO2) parts.push(`SpO2: ${w.spO2.toFixed(1)}%`);
      if (w.skinTemp) parts.push(`Skin Temp: ${w.skinTemp.toFixed(1)}°C`);
      physioIndicators = `\n- **Physiological:** ${parts.join(' | ')}`;
    }

    // Build z-score intensity context if available
    let zScoreContext = '';
    const zsi = wellness.zScoreIntensity;
    if (zsi && zsi.confidence !== 'low') {
      const hrvBreakdown = zsi.breakdown?.hrv ? `HRV z=${zsi.breakdown.hrv.zScore?.toFixed(1)}σ → ${(zsi.breakdown.hrv.modifier * 100).toFixed(0)}%` : '';
      const rhrBreakdown = zsi.breakdown?.rhr ? `RHR z=${zsi.breakdown.rhr.zScore?.toFixed(1)}σ → ${(zsi.breakdown.rhr.modifier * 100).toFixed(0)}%` : '';
      const breakdownParts = [hrvBreakdown, rhrBreakdown].filter(x => x).join(', ');
      zScoreContext = `
- **Z-Score Intensity (continuous):** ${(zsi.modifier * 100).toFixed(0)}% (${zsi.confidence} confidence)
  - ${zsi.description}
  - Breakdown: ${breakdownParts}`;
    }

    wellnessContext = `
**1b. Recovery & Wellness Data (${w.source === 'whoop_api' ? 'Whoop API - real-time' : 'Intervals.icu'}):**
- **Recovery Status:** ${wellness.recoveryStatus}
- **Recommended Intensity Modifier:** ${(wellness.intensityModifier * 100).toFixed(0)}%${zScoreContext}
- **Sleep:** ${w.sleep ? w.sleep.toFixed(1) + 'h' : 'N/A'} (${wellness.sleepStatus})${sleepDetails} | 7-day avg: ${avg.sleep ? avg.sleep.toFixed(1) + 'h' : 'N/A'}
- **HRV (rMSSD):** ${w.hrv ? w.hrv.toFixed(0) : 'N/A'} ms | 7-day avg: ${avg.hrv ? avg.hrv.toFixed(0) : 'N/A'} ms
- **Resting HR:** ${w.restingHR || 'N/A'} bpm | 7-day avg: ${avg.restingHR ? avg.restingHR.toFixed(0) : 'N/A'} bpm
- **Whoop Recovery Score:** ${w.recovery != null ? w.recovery + '%' : 'N/A'}${physioIndicators}
${w.soreness ? `- **Soreness:** ${w.soreness}/5` : ''}
${w.fatigue ? `- **Fatigue:** ${w.fatigue}/5` : ''}
${w.stress ? `- **Stress:** ${w.stress}/5` : ''}
${w.mood ? `- **Mood:** ${w.mood}/5` : ''}

**CRITICAL RECOVERY RULES (use Z-Score Intensity for precise scaling):**
- The Z-Score Intensity Modifier provides continuous scaling based on personal baseline, not discrete categories.
- Apply the Intensity Modifier directly to target power zones (e.g., 82% modifier → use 82% of prescribed FTP-based power).
- If modifier < 85%: STRONGLY favor Endurance/Recovery workouts. VO2max/Threshold should score very low (1-3).
- If modifier 85-94%: Reduce interval intensity. Favor Tempo/SST over VO2max.
- If modifier 95-100%: Full intensity appropriate. High-intensity workouts can score higher.
- If modifier > 100%: Athlete is exceptionally recovered - can push slightly harder if training plan allows.
- Poor sleep (<6h) should reduce recommendation scores for high-intensity work.
- Low deep sleep (<1.5h) indicates poor recovery quality even if total sleep is adequate.
- Low SpO2 (<95%) or elevated skin temp may indicate illness - recommend easier workout.
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

  // Build last workout feedback context
  let lastWorkoutContext = "";
  if (lastWorkoutAnalysis) {
    const lw = lastWorkoutAnalysis;
    const daysSince = lw.date ? Math.floor((new Date() - new Date(lw.date)) / (1000 * 60 * 60 * 24)) : null;

    // Only include if within last 3 days
    if (daysSince !== null && daysSince <= 3) {
      const difficultyText = lw.difficultyMatch === 'harder_than_expected' ? 'HARDER than expected'
        : lw.difficultyMatch === 'easier_than_expected' ? 'easier than expected'
        : lw.difficultyMatch === 'as_expected' ? 'as expected'
        : lw.difficultyMatch || 'unknown';

      lastWorkoutContext = `
**1g. Yesterday's Workout Feedback:**
- **Last Workout:** ${lw.activityName || 'Unknown'} (${daysSince === 0 ? 'today' : daysSince === 1 ? 'yesterday' : daysSince + ' days ago'})
- **Difficulty Match:** ${difficultyText}
- **Effectiveness:** ${lw.effectiveness || 'N/A'}/10
${lw.stimulus ? `- **Stimulus:** ${lw.stimulus}` : ''}
${lw.recoveryHours ? `- **Est. Recovery Needed:** ${lw.recoveryHours}h` : ''}
${lw.ftpCalibration && lw.ftpCalibration !== 'none' ? `- **FTP Calibration:** ${lw.ftpCalibration.replace('_', ' ')}` : ''}
${lw.keyInsight ? `- **Key Insight:** ${lw.keyInsight}` : ''}

**YESTERDAY'S FEEDBACK RULES (Critical):**
${lw.difficultyMatch === 'harder_than_expected' ? `- Last workout was HARDER than expected. REDUCE today's intensity by 10%. Favor endurance/tempo over threshold/VO2max.
- If planning intervals, reduce power targets by 5-10W or shorten interval duration.
- The athlete may be more fatigued than metrics suggest.` : ''}
${lw.difficultyMatch === 'easier_than_expected' ? `- Last workout was easier than expected. The athlete is responding well to training.
- Can maintain or slightly increase intensity if recovery metrics support it.` : ''}
${lw.difficultyMatch === 'as_expected' ? `- Last workout difficulty matched expectations. Current training load is calibrated well.
- Continue with planned intensity levels.` : ''}
${lw.ftpCalibration === 'decrease_5w' ? `- FTP may be set too high. Consider using 95-98% of prescribed power for intervals.` : ''}
${lw.ftpCalibration === 'increase_5w' ? `- FTP may be set too low. Athlete can handle slightly higher intensity.` : ''}
`;
    }
  }

  // Build training load warnings context
  let warningsContext = "";
  const hasWarnings = warnings.volumeJump?.detected || warnings.rampRateWarning?.warning || warnings.deloadCheck?.needed;

  if (hasWarnings) {
    let warningItems = [];

    // Volume Jump Warning
    if (warnings.volumeJump?.detected) {
      const vj = warnings.volumeJump;
      const riskText = vj.risk === 'high' ? 'HIGH INJURY RISK' : vj.risk === 'medium' ? 'MEDIUM RISK' : 'ELEVATED';
      warningItems.push(`- **VOLUME JUMP (${riskText}):** Week-over-week TSS increased ${vj.percentChange}% (${vj.lastWeekTSS} → ${vj.thisWeekTSS}). ${vj.risk === 'high' ? 'Reduce intensity significantly today.' : 'Monitor fatigue closely.'}`);
    }

    // Ramp Rate Warning
    if (warnings.rampRateWarning?.warning) {
      const rr = warnings.rampRateWarning;
      const levelText = rr.level === 'critical' ? 'CRITICAL' : rr.level === 'warning' ? 'WARNING' : 'CAUTION';
      warningItems.push(`- **RAMP RATE ${levelText}:** Sustained high CTL ramp rate (${rr.avgRate} CTL/week avg) for ${rr.consecutiveWeeks} weeks. ${rr.level === 'critical' ? 'Recovery day strongly recommended.' : 'Consider reducing intensity.'}`);
    }

    // Deload Check
    if (warnings.deloadCheck?.needed) {
      const dl = warnings.deloadCheck;
      const urgencyText = dl.urgency === 'high' ? 'URGENT' : dl.urgency === 'medium' ? 'RECOMMENDED' : 'SUGGESTED';
      warningItems.push(`- **DELOAD ${urgencyText}:** ${dl.weeksWithoutDeload} weeks without recovery week. ${dl.urgency === 'high' ? 'Today should be easy/recovery only.' : 'Plan recovery week soon.'}`);
    }

    warningsContext = `
**1h. TRAINING LOAD WARNINGS (Critical - Must Factor Into Decision):**
${warningItems.join('\n')}

**WARNING RESPONSE RULES (Must Follow):**
- If ANY warning is HIGH/CRITICAL/URGENT: Score VO2max/Threshold workouts 1-3 only. Favor Recovery/Endurance.
- If multiple warnings present: Compound effect - be MORE conservative than any single warning suggests.
- Volume Jump + High Ramp Rate = Overreaching risk. Today must be easy regardless of recovery metrics.
- If Deload is URGENT: Override normal workout selection. Return Recovery or easy Endurance only.
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
${wellnessContext}${powerContext}${adaptiveTrainingContext}${crossSportContext}${lastWorkoutContext}${warningsContext}
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
function createRunPrompt(type, summary, phaseInfo, dateStr, duration, wellness, runningData, adaptiveContext, crossSportEquivalency, lastWorkoutAnalysis, warnings) {
  const analysisLang = getPromptLanguage();

  // Initialize warnings object if not provided
  warnings = warnings || {};

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
- **D' (${runningData.dPrime ? runningData.dPrime.toFixed(0) + 'm' : 'N/A'})** represents anaerobic capacity. Use D' to guide interval structure:
  - **Low D' (<150m):** Athlete depletes anaerobic reserves quickly. Use LONGER recovery (2-3min jog between hard efforts), FEWER repeats per set (4-5 max), and prioritize building D' with 200-400m repeats with full recovery.
  - **Normal D' (150-250m):** Standard interval structure. 90s-2min jog recovery between VO2max efforts, 5-6 repeats per set.
  - **High D' (>250m):** Athlete can sustain repeated hard efforts. Can use SHORTER recovery (60-90s), MORE repeats (6-8 per set), and include race-simulation workouts with incomplete recovery.
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

    // Build z-score intensity context if available
    let zScoreContext = '';
    const zsi = wellness.zScoreIntensity;
    if (zsi && zsi.confidence !== 'low') {
      const hrvBreakdown = zsi.breakdown?.hrv ? `HRV z=${zsi.breakdown.hrv.zScore?.toFixed(1)}σ → ${(zsi.breakdown.hrv.modifier * 100).toFixed(0)}%` : '';
      const rhrBreakdown = zsi.breakdown?.rhr ? `RHR z=${zsi.breakdown.rhr.zScore?.toFixed(1)}σ → ${(zsi.breakdown.rhr.modifier * 100).toFixed(0)}%` : '';
      const breakdownParts = [hrvBreakdown, rhrBreakdown].filter(x => x).join(', ');
      zScoreContext = `
- **Z-Score Intensity (continuous):** ${(zsi.modifier * 100).toFixed(0)}% (${zsi.confidence} confidence)
  - ${zsi.description}
  - Breakdown: ${breakdownParts}`;
    }

    wellnessContext = `
**1b. Recovery & Wellness Data (from Whoop/wearable):**
- **Recovery Status:** ${wellness.recoveryStatus}
- **Recommended Intensity Modifier:** ${(wellness.intensityModifier * 100).toFixed(0)}%${zScoreContext}
- **Sleep:** ${w.sleep ? w.sleep.toFixed(1) + 'h' : 'N/A'} (${wellness.sleepStatus}) | 7-day avg: ${avg.sleep ? avg.sleep.toFixed(1) + 'h' : 'N/A'}
- **HRV (rMSSD):** ${w.hrv || 'N/A'} ms | 7-day avg: ${avg.hrv ? avg.hrv.toFixed(0) : 'N/A'} ms
- **Resting HR:** ${w.restingHR || 'N/A'} bpm | 7-day avg: ${avg.restingHR ? avg.restingHR.toFixed(0) : 'N/A'} bpm
- **Whoop Recovery Score:** ${w.recovery != null ? w.recovery + '%' : 'N/A'}
${w.soreness ? `- **Soreness:** ${w.soreness}/5` : ''}
${w.fatigue ? `- **Fatigue:** ${w.fatigue}/5` : ''}

**CRITICAL RECOVERY RULES (use Z-Score Intensity for precise scaling):**
- The Z-Score Intensity Modifier provides continuous scaling based on personal baseline.
- If modifier < 85%: ONLY easy/recovery runs. No intervals.
- If modifier 85-94%: Reduce interval intensity. Favor tempo over VO2max.
- If modifier 95-100%: Full intensity is appropriate.
- If modifier > 100%: Athlete is exceptionally recovered - can push slightly.
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

  // Build last workout feedback context (same logic as cycling)
  let lastWorkoutContext = "";
  if (lastWorkoutAnalysis) {
    const lw = lastWorkoutAnalysis;
    const daysSince = lw.date ? Math.floor((new Date() - new Date(lw.date)) / (1000 * 60 * 60 * 24)) : null;

    if (daysSince !== null && daysSince <= 3) {
      const difficultyText = lw.difficultyMatch === 'harder_than_expected' ? 'HARDER than expected'
        : lw.difficultyMatch === 'easier_than_expected' ? 'easier than expected'
        : lw.difficultyMatch === 'as_expected' ? 'as expected'
        : lw.difficultyMatch || 'unknown';

      lastWorkoutContext = `
**1f. Yesterday's Workout Feedback:**
- **Last Workout:** ${lw.activityName || 'Unknown'} (${daysSince === 0 ? 'today' : daysSince === 1 ? 'yesterday' : daysSince + ' days ago'})
- **Difficulty Match:** ${difficultyText}
- **Effectiveness:** ${lw.effectiveness || 'N/A'}/10
${lw.keyInsight ? `- **Key Insight:** ${lw.keyInsight}` : ''}

**YESTERDAY'S FEEDBACK RULES:**
${lw.difficultyMatch === 'harder_than_expected' ? `- Last workout was HARDER than expected. REDUCE today's intensity. For running this is CRITICAL due to impact stress.
- Favor easy/recovery runs over intervals. If intervals are needed, reduce pace or distance.` : ''}
${lw.difficultyMatch === 'easier_than_expected' ? `- Last workout was easier than expected. Athlete is responding well to training.` : ''}
${lw.difficultyMatch === 'as_expected' ? `- Last workout difficulty matched expectations. Continue with planned intensity.` : ''}
`;
    }
  }

  // Build training load warnings context (same as cycling)
  let warningsContext = "";
  const hasWarnings = warnings.volumeJump?.detected || warnings.rampRateWarning?.warning || warnings.deloadCheck?.needed;

  if (hasWarnings) {
    let warningItems = [];

    if (warnings.volumeJump?.detected) {
      const vj = warnings.volumeJump;
      const riskText = vj.risk === 'high' ? 'HIGH INJURY RISK' : vj.risk === 'medium' ? 'MEDIUM RISK' : 'ELEVATED';
      warningItems.push(`- **VOLUME JUMP (${riskText}):** Week-over-week TSS increased ${vj.percentChange}%. ${vj.risk === 'high' ? 'Reduce intensity significantly - running has high injury risk!' : 'Monitor fatigue closely.'}`);
    }

    if (warnings.rampRateWarning?.warning) {
      const rr = warnings.rampRateWarning;
      const levelText = rr.level === 'critical' ? 'CRITICAL' : rr.level === 'warning' ? 'WARNING' : 'CAUTION';
      warningItems.push(`- **RAMP RATE ${levelText}:** Sustained high CTL ramp rate for ${rr.consecutiveWeeks} weeks. ${rr.level === 'critical' ? 'Easy run only today!' : 'Consider reducing intensity.'}`);
    }

    if (warnings.deloadCheck?.needed) {
      const dl = warnings.deloadCheck;
      const urgencyText = dl.urgency === 'high' ? 'URGENT' : dl.urgency === 'medium' ? 'RECOMMENDED' : 'SUGGESTED';
      warningItems.push(`- **DELOAD ${urgencyText}:** ${dl.weeksWithoutDeload} weeks without recovery. ${dl.urgency === 'high' ? 'Recovery run only!' : 'Plan easy week soon.'}`);
    }

    warningsContext = `
**1g. TRAINING LOAD WARNINGS (Critical - Running has HIGH injury risk):**
${warningItems.join('\n')}

**WARNING RESPONSE RULES FOR RUNNING:**
- Running has HIGHER injury risk than cycling. Be MORE conservative with any warning.
- If ANY warning is HIGH/CRITICAL: Only Recovery or Easy runs. No intervals.
- Volume Jump + Running = High risk. Favor cycling over running when warnings are present.
- If Deload is URGENT: Recovery run only, or consider rest day instead of running.
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
${wellnessContext}${runContext}${adaptiveTrainingContext}${crossSportContext}${lastWorkoutContext}${warningsContext}
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
