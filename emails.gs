/**
 * IntervalCoach - Email Functions
 *
 * All email sending functions: daily workout, rest day, weekly summary, monthly report.
 */

// =========================================================
// UNIFIED DAILY EMAIL
// =========================================================

/**
 * Send unified daily email - handles workout, rest day, and no-placeholder scenarios
 * @param {object} params - All parameters for the daily email
 * @param {string} params.type - 'workout' | 'rest' | 'status' (no placeholder)
 * @param {object} params.summary - Athlete summary (CTL/ATL/TSB)
 * @param {object} params.phaseInfo - Training phase info
 * @param {object} params.wellness - Wellness data
 * @param {object} params.workout - Generated workout (for type='workout')
 * @param {object} params.powerProfile - Power profile (for rides)
 * @param {object} params.restAssessment - AI rest assessment (for type='rest')
 * @param {object} params.weekProgress - Week progress data
 * @param {Array} params.upcomingDays - Upcoming 7 days schedule
 * @param {object} params.midWeekAdaptation - Mid-week adaptation results (if any)
 */
/**
 * Determine the reason for a rest day based on context
 * @param {object} params - Email parameters
 * @returns {object} { message, showAlternatives }
 */
function determineRestReason(params) {
  const t = getTranslations();
  const { wellness, restAssessment, weekProgress, upcomingDays } = params;

  // 1. Explicit AI rest assessment (red recovery, illness, etc.)
  if (restAssessment?.reasoning) {
    return {
      message: restAssessment.reasoning,
      showAlternatives: true
    };
  }

  // 2. Low recovery status
  const recoveryStatus = wellness?.recoveryStatus || '';
  if (recoveryStatus.includes('Red') || recoveryStatus.includes('Strained')) {
    return {
      message: t.rest_day_reason || "Your recovery status indicates you need rest to allow adaptation.",
      showAlternatives: true
    };
  }

  // 3. Recently trained (yesterday or day before)
  const completedRecently = weekProgress?.completedSessions > 0 && weekProgress?.daysAnalyzed <= 2;
  if (completedRecently) {
    const lastType = weekProgress?.completedTypes?.[weekProgress.completedTypes.length - 1] || 'workout';
    return {
      message: t.rest_after_training || `Recovery day after recent ${lastType.toLowerCase()}. Your body adapts during rest.`,
      showAlternatives: true
    };
  }

  // 4. Hard workout coming tomorrow
  const tomorrow = upcomingDays?.find((d, i) => i === 1); // Second day in list
  const tomorrowHasIntensity = tomorrow?.placeholderName?.match(/VO2|Threshold|Intervals|Tempo|SweetSpot/i);
  if (tomorrowHasIntensity) {
    return {
      message: t.rest_before_intensity || `Rest day before tomorrow's ${tomorrow.placeholderName}. Arrive fresh for quality work.`,
      showAlternatives: false
    };
  }

  // 5. Event coming soon
  const upcomingEvent = upcomingDays?.find(d => d.hasEvent);
  if (upcomingEvent) {
    const daysUntil = upcomingDays.indexOf(upcomingEvent);
    if (daysUntil <= 2) {
      const eventDesc = upcomingEvent.eventName
        ? `${upcomingEvent.eventCategory} - ${upcomingEvent.eventName}`
        : `${upcomingEvent.eventCategory} event`;
      return {
        message: t.rest_before_event || `Rest day - ${eventDesc} in ${daysUntil} day(s).`,
        showAlternatives: false
      };
    }
  }

  // 6. Default - planned or unplanned rest
  return {
    message: t.rest_day_default || "Rest day. Recovery is as important as training. Enjoy!",
    showAlternatives: true
  };
}

/**
 * Build conversational opening for daily email
 */
function buildDailyOpening(type, recoveryStatus, tsb, wellness, phaseInfo, isNL) {
  let opening = '';

  // Recovery-based opening
  const isGreenRecovery = recoveryStatus.toLowerCase().includes('green') || recoveryStatus.toLowerCase().includes('optimal');
  const isYellowRecovery = recoveryStatus.toLowerCase().includes('yellow') || recoveryStatus.toLowerCase().includes('moderate');
  const isRedRecovery = recoveryStatus.toLowerCase().includes('red') || recoveryStatus.toLowerCase().includes('strained');

  if (type === 'workout') {
    if (isGreenRecovery && tsb > -10) {
      opening = isNL
        ? 'Je bent goed hersteld en klaar om te trainen.'
        : 'You\'re well recovered and ready to train.';
    } else if (isGreenRecovery && tsb <= -10) {
      opening = isNL
        ? 'Goed hersteld ondanks wat vermoeidheid (TSB ' + tsb.toFixed(0) + ').'
        : 'Well recovered despite some fatigue (TSB ' + tsb.toFixed(0) + ').';
    } else if (isYellowRecovery) {
      opening = isNL
        ? 'Matig herstel vandaag. Luister naar je lichaam.'
        : 'Moderate recovery today. Listen to your body.';
    } else {
      opening = isNL
        ? 'Tijd om te trainen.'
        : 'Time to train.';
    }
  } else if (type === 'rest') {
    if (isRedRecovery) {
      opening = isNL
        ? 'Je lichaam heeft rust nodig. Herstel staat voorop.'
        : 'Your body needs rest. Recovery comes first.';
    } else {
      opening = isNL
        ? 'Rustdag vandaag. Herstel is net zo belangrijk als training.'
        : 'Rest day today. Recovery is as important as training.';
    }
  } else if (type === 'race_day') {
    opening = isNL
      ? 'Wedstrijddag! Tijd om te laten zien wat je kunt.'
      : 'Race day! Time to show what you\'ve got.';
  } else if (type === 'group_ride') {
    opening = isNL
      ? 'Groepsrit vandaag. Geniet ervan!'
      : 'Group ride today. Enjoy!';
  }

  // Add wellness context if available
  if (wellness?.available && wellness.today?.sleep) {
    const sleep = wellness.today.sleep;
    if (sleep >= 7.5) {
      opening += isNL ? ` Goed geslapen (${sleep.toFixed(1)}u).` : ` Good sleep (${sleep.toFixed(1)}h).`;
    } else if (sleep < 6) {
      opening += isNL ? ` Let op: weinig slaap (${sleep.toFixed(1)}u).` : ` Note: limited sleep (${sleep.toFixed(1)}h).`;
    }
  }

  // Add phase context
  if (phaseInfo?.weeksOut && phaseInfo.weeksOut <= 8) {
    opening += isNL
      ? ` Nog ${phaseInfo.weeksOut} weken tot je doel.`
      : ` ${phaseInfo.weeksOut} weeks to your goal.`;
  }

  return opening;
}

function sendDailyEmail(params) {
  const t = getTranslations();
  const lang = USER_SETTINGS.LANGUAGE || 'en';
  const isNL = lang === 'nl';
  const today = new Date();
  const dayName = Utilities.formatDate(today, SYSTEM_SETTINGS.TIMEZONE, "EEEE");
  const dateStr = Utilities.formatDate(today, SYSTEM_SETTINGS.TIMEZONE, "MM/dd");

  const {
    type,
    summary,
    phaseInfo,
    wellness,
    workout,
    workoutSelection,
    powerProfile,
    restAssessment,
    weekProgress,
    upcomingDays,
    raceDayAdvice,
    raceName,
    raceCategory,
    raceDescription,
    midWeekAdaptation,
    deloadCheck,
    taperRecommendation,
    volumeJump,
    rampRateWarning,
    illnessPattern
  } = params;

  // Build subject based on type
  let subject;
  if (type === 'workout') {
    subject = `${t.subject_prefix}${workout?.type || 'Workout'} (${dateStr})`;
  } else if (type === 'rest') {
    subject = `${t.rest_day_subject} (${dateStr})`;
  } else if (type === 'group_ride') {
    const eventName = params.cEventName || t.group_ride || 'Group Ride';
    subject = `${t.subject_prefix}${eventName} (${dateStr})`;
  } else if (type === 'race_day') {
    subject = `[IntervalCoach] ${t.race_day || 'RACE DAY'}: ${raceCategory} - ${raceName || 'Race'} (${dateStr})`;
  } else {
    subject = `[IntervalCoach] ${t.daily_status_subject || 'Daily Update'} - ${dayName} (${dateStr})`;
  }

  let body = '';

  // Opening line based on recovery status and type
  const ctl = summary?.ctl_90 || summary?.ctl || 0;
  const tsb = summary?.tsb_current || summary?.tsb || 0;
  const recoveryStatus = wellness?.recoveryStatus || 'Unknown';

  body += buildDailyOpening(type, recoveryStatus, tsb, wellness, phaseInfo, isNL);
  body += '\n';

  // Today's Plan (conditional)
  if (type === 'workout' && workout) {
    // Workout day - conversational style
    body += isNL
      ? `Vandaag: ${workout.type}\n\n`
      : `Today: ${workout.type}\n\n`;

    // Show AI selection reasoning as flowing text
    if (workoutSelection?.reason) {
      body += workoutSelection.reason;
      if (workoutSelection.varietyNote) {
        body += ` ${workoutSelection.varietyNote}`;
      }
      if (workoutSelection.zoneNote) {
        body += ` ${workoutSelection.zoneNote}`;
      }
      body += '\n';
    } else if (workout.explanation || workout.recommendationReason) {
      body += (workout.explanation || workout.recommendationReason) + '\n';
    }
  } else if (type === 'race_day') {
    // A/B race day - race strategy and advice (conversational)
    const advice = raceDayAdvice || {};

    body += `${raceCategory} - ${raceName}${raceDescription ? '\n' + raceDescription : ''}\n\n`;

    body += isNL ? 'Paraatheid: ' : 'Readiness: ';
    body += `${(advice.readiness || 'unknown').toUpperCase()}. ${advice.readinessNote || ''}\n\n`;

    body += isNL ? 'Strategie: ' : 'Strategy: ';
    body += `${advice.strategy || t.default_race_strategy || "Start conservatively, build into the race."}\n`;

    if (advice.powerTargets) {
      body += isNL ? '\nVermogensdoelen: ' : '\nPower targets: ';
      body += `${advice.powerTargets.conservative || 'N/A'} (safe) / ${advice.powerTargets.normal || 'N/A'} (normal) / ${advice.powerTargets.aggressive || 'N/A'} (all-out)\n`;
    }

    body += `\n${isNL ? 'Warming-up' : 'Warmup'}: ${advice.warmup || t.default_warmup || "15-20 min easy with 2-3 short efforts"}\n`;
    body += `${isNL ? 'Voeding' : 'Nutrition'}: ${advice.nutrition || t.default_nutrition || "Eat familiar foods, hydrate well"}\n`;

    if (advice.mentalTips && advice.mentalTips.length > 0) {
      body += `\n${isNL ? 'Mental' : 'Mental'}: ${advice.mentalTips.join('. ')}\n`;
    }

  } else if (type === 'group_ride') {
    // C event day - group ride (conversational)
    const eventName = params.cEventName || t.group_ride || "Group Ride";
    const eventDescription = params.cEventDescription || null;
    const advice = params.groupRideAdvice || {};

    const intensityLabel = {
      'easy': isNL ? 'rustig aan' : 'take it easy',
      'moderate': isNL ? 'matige inspanning' : 'moderate effort',
      'hard': isNL ? 'vol gas' : 'go all out'
    }[advice.intensity] || (isNL ? 'matige inspanning' : 'moderate effort');

    body += `${eventName}${eventDescription ? ' - ' + eventDescription : ''}\n\n`;
    body += isNL ? `Aanbevolen intensiteit: ${intensityLabel}.\n\n` : `Recommended intensity: ${intensityLabel}.\n\n`;
    body += `${advice.advice || t.group_ride_default_advice || "Enjoy the group ride. Listen to your body."}\n`;

    if (advice.tips && advice.tips.length > 0) {
      body += `\n${isNL ? 'Tips' : 'Tips'}: ${advice.tips.join('. ')}\n`;
    }

  } else {
    // Rest day (conversational)
    const restReason = determineRestReason(params);
    body += `${restReason.message}\n`;

    if (restAssessment?.alternatives || restReason.showAlternatives) {
      body += isNL
        ? `\nLichte alternatieven: wandeling (20-30 min), stretching/mobility.\n`
        : `\nLight alternatives: easy walk (20-30 min), stretching/mobility.\n`;
    }

    // Generate and add rest day coaching note
    if (params.enableCoachingNote !== false) {
      try {
        const coachingNote = generateRestDayCoachingNote({
          wellness: wellness,
          phaseInfo: phaseInfo,
          weekProgress: weekProgress,
          upcomingDays: upcomingDays,
          fitness: params.fitness || { ctl: summary?.ctl_90, tsb: summary?.tsb_current }
        });

        if (coachingNote) {
          body += `\n${coachingNote}\n`;
        }
      } catch (e) {
        Logger.log("Error adding rest day coaching note: " + e.toString());
      }
    }
  }

  // Week Progress (compact inline)
  if (weekProgress && weekProgress.daysAnalyzed > 0) {
    const wp = weekProgress;
    body += '\n';

    // Build sessions text
    if (wp.missedSessions > 0) {
      body += isNL
        ? `Deze week: ${wp.completedSessions}/${wp.plannedSessions} sessies (${wp.missedSessions} gemist)`
        : `This week: ${wp.completedSessions}/${wp.plannedSessions} sessions (${wp.missedSessions} missed)`;
    } else if (wp.completedSessions > 0 && (!wp.plannedSessions || wp.plannedSessions === 0)) {
      // Completed sessions but none were planned
      body += isNL
        ? `Deze week: ${wp.completedSessions} ${wp.completedSessions === 1 ? 'sessie' : 'sessies'} gedaan`
        : `This week: ${wp.completedSessions} ${wp.completedSessions === 1 ? 'session' : 'sessions'} done`;
    } else if (wp.plannedSessions > 0) {
      body += isNL
        ? `Deze week: ${wp.completedSessions}/${wp.plannedSessions} sessies`
        : `This week: ${wp.completedSessions}/${wp.plannedSessions} sessions`;
    } else {
      body += isNL ? 'Deze week: geen training gepland' : 'This week: no training planned';
    }

    // Add TSS
    if (wp.tssCompleted > 0) {
      body += wp.tssPlanned > 0
        ? ` (${wp.tssCompleted}/${wp.tssPlanned} TSS)`
        : ` (${wp.tssCompleted} TSS)`;
    }
    body += '\n';

    // Mid-week adaptation
    if (midWeekAdaptation?.success && midWeekAdaptation?.changes?.length > 0) {
      body += isNL ? '\nPlan aangepast: ' : '\nPlan adapted: ';
      body += midWeekAdaptation.changes.join('. ') + '\n';
    }
  }

  // Deload Recommendation (if needed)
  if (deloadCheck?.needed) {
    body += '\n';
    if (deloadCheck.urgency === 'high') {
      body += isNL ? 'Herstelweek aanbevolen. ' : 'Recovery week recommended. ';
    } else {
      body += isNL ? 'Overweeg een herstelweek. ' : 'Consider a recovery week. ';
    }
    body += `${deloadCheck.weeksWithoutDeload} ${isNL ? 'weken zonder rust' : 'weeks without recovery'}. `;
    if (deloadCheck.recommendation) {
      body += deloadCheck.recommendation;
    }
    body += '\n';
  } else if (deloadCheck?.weeksWithoutDeload >= 3) {
    body += isNL
      ? `\n${deloadCheck.weeksWithoutDeload} weken training. ${deloadCheck.recommendation || ''}\n`
      : `\n${deloadCheck.weeksWithoutDeload} weeks of training. ${deloadCheck.recommendation || ''}\n`;
  }

  // Volume Jump Warning (conversational)
  if (volumeJump?.detected) {
    body += '\n';
    const changeDir = volumeJump.percentChange > 0 ? (isNL ? 'toename' : 'increase') : (isNL ? 'afname' : 'decrease');
    const absChange = Math.abs(volumeJump.percentChange);

    if (volumeJump.risk === 'high') {
      body += isNL
        ? `Let op: grote volume ${changeDir} (${volumeJump.lastWeekTSS} naar ${volumeJump.thisWeekTSS} TSS, ${absChange}%). Dit verhoogt het blessurerisico.`
        : `Caution: significant volume ${changeDir} (${volumeJump.lastWeekTSS} to ${volumeJump.thisWeekTSS} TSS, ${absChange}%). This increases injury risk.`;
    } else if (volumeJump.risk === 'medium') {
      body += isNL
        ? `Volume ${changeDir}: ${volumeJump.lastWeekTSS} naar ${volumeJump.thisWeekTSS} TSS (${absChange}%).`
        : `Volume ${changeDir}: ${volumeJump.lastWeekTSS} to ${volumeJump.thisWeekTSS} TSS (${absChange}%).`;
    } else if (volumeJump.risk === 'check') {
      body += isNL
        ? `Volume lager dan vorige week: ${volumeJump.lastWeekTSS} naar ${volumeJump.thisWeekTSS} TSS.`
        : `Volume lower than last week: ${volumeJump.lastWeekTSS} to ${volumeJump.thisWeekTSS} TSS.`;
    } else {
      body += isNL
        ? `Volume ${changeDir}: ${volumeJump.lastWeekTSS} naar ${volumeJump.thisWeekTSS} TSS (${absChange}%).`
        : `Volume ${changeDir}: ${volumeJump.lastWeekTSS} to ${volumeJump.thisWeekTSS} TSS (${absChange}%).`;
    }

    if (volumeJump.recommendation) {
      body += ` ${volumeJump.recommendation}`;
    }
    body += '\n';
  }

  // Illness Pattern Warning (conversational)
  if (illnessPattern?.detected) {
    body += '\n';
    const symptomsDisplay = illnessPattern.symptoms.slice(0, 3).join(', ');

    if (illnessPattern.probability === 'high') {
      body += isNL
        ? `Je lichaam geeft duidelijke signalen af: ${symptomsDisplay} (${illnessPattern.consecutiveDays} dagen). Rust is nu de prioriteit.`
        : `Your body is sending clear signals: ${symptomsDisplay} (${illnessPattern.consecutiveDays} days). Rest is the priority now.`;
    } else if (illnessPattern.probability === 'likely') {
      body += isNL
        ? `Mogelijke ziektesymptomen: ${symptomsDisplay}. Vermijd training tot je je beter voelt.`
        : `Possible illness signs: ${symptomsDisplay}. Avoid training until you feel better.`;
    } else {
      body += isNL
        ? `Let op je lichaam: ${symptomsDisplay}. Overweeg lichter trainen of rust.`
        : `Watch your body: ${symptomsDisplay}. Consider lighter training or rest.`;
    }

    if (illnessPattern.trainingGuidance) {
      body += ` ${illnessPattern.trainingGuidance}`;
    }
    body += '\n';
  }

  // Ramp Rate Warning (conversational)
  if (rampRateWarning?.warning) {
    body += '\n';
    const avgRate = rampRateWarning.avgRate > 0 ? '+' + rampRateWarning.avgRate : rampRateWarning.avgRate;

    if (rampRateWarning.level === 'critical') {
      body += isNL
        ? `Hoge trainingsbelasting: ${rampRateWarning.consecutiveWeeks} weken achtereen met gemiddeld ${avgRate} CTL/week. Risico op overtraining.`
        : `High training load: ${rampRateWarning.consecutiveWeeks} consecutive weeks averaging ${avgRate} CTL/week. Overtraining risk.`;
    } else if (rampRateWarning.level === 'warning') {
      body += isNL
        ? `Aanhoudend hoge belasting: ${rampRateWarning.consecutiveWeeks} weken met ${avgRate} CTL/week gemiddeld.`
        : `Sustained high load: ${rampRateWarning.consecutiveWeeks} weeks at ${avgRate} CTL/week average.`;
    } else {
      body += isNL
        ? `Verhoogde trainingsbelasting: ${avgRate} CTL/week de afgelopen ${rampRateWarning.consecutiveWeeks} weken.`
        : `Elevated training load: ${avgRate} CTL/week over the past ${rampRateWarning.consecutiveWeeks} weeks.`;
    }

    if (rampRateWarning.recommendation) {
      body += ` ${rampRateWarning.recommendation}`;
    }
    body += '\n';
  }

  // === SECTION 3.6: Taper Timing (within 6 weeks of A race) ===
  if (taperRecommendation?.available) {
    body += formatTaperEmailSection(taperRecommendation);
  }

  // Race Advice (for race tomorrow or yesterday) - conversational
  if (raceDayAdvice && type !== 'race_day') {
    const advice = raceDayAdvice;

    if (advice.scenario === 'race_tomorrow') {
      const eventName = advice.eventName || (isNL ? 'wedstrijd' : 'race');
      body += '\n';
      body += isNL
        ? `Morgen: ${advice.category || ''} - ${eventName}\n\n`
        : `Tomorrow: ${advice.category || ''} - ${eventName}\n\n`;

      body += isNL
        ? `Vandaag: ${advice.todayActivity || 'openers'}. ${advice.activityDetails || ''}\n`
        : `Today: ${advice.todayActivity || 'openers'}. ${advice.activityDetails || ''}\n`;

      body += '\n';
      body += isNL ? 'Voorbereiding:\n' : 'Preparation:\n';
      body += `- ${isNL ? 'Slaap' : 'Sleep'}: ${advice.sleepTips || (isNL ? 'Vroeg naar bed, beperk schermtijd' : 'Go to bed early, limit screen time')}\n`;
      body += `- ${isNL ? 'Voeding vandaag' : 'Nutrition today'}: ${advice.nutritionToday || (isNL ? 'Koolhydraatrijke maaltijden, goed hydrateren' : 'Carb-rich meals, stay hydrated')}\n`;
      body += `- ${isNL ? 'Wedstrijdochtend' : 'Race morning'}: ${advice.nutritionTomorrow || (isNL ? 'Vertrouwd ontbijt 2-3u voor start' : 'Familiar breakfast 2-3h before start')}\n`;

      if (advice.logisticsTips && advice.logisticsTips.length > 0) {
        body += `- ${isNL ? 'Checklist' : 'Checklist'}: ${advice.logisticsTips.slice(0, 3).join(', ')}\n`;
      }

      if (advice.mentalTips && advice.mentalTips.length > 0) {
        body += `\n${advice.mentalTips[0]}\n`;
      }

    } else if (advice.scenario === 'race_yesterday') {
      const eventName = advice.eventName || (isNL ? 'wedstrijd' : 'race');
      body += '\n';
      body += isNL
        ? `Na ${eventName} (${advice.category || ''}): herstel ${advice.recoveryStatus || 'onbekend'}.\n`
        : `After ${eventName} (${advice.category || ''}): recovery ${advice.recoveryStatus || 'unknown'}.\n`;

      if (advice.recoveryNote) {
        body += `${advice.recoveryNote}\n`;
      }

      body += '\n';
      body += isNL
        ? `Vandaag: ${advice.todayActivity || 'rust'}. ${advice.activityDetails || ''}\n`
        : `Today: ${advice.todayActivity || 'rest'}. ${advice.activityDetails || ''}\n`;

      body += isNL
        ? `Voeding: ${advice.nutrition || 'Focus op eiwitten en koolhydraten voor herstel'}.\n`
        : `Nutrition: ${advice.nutrition || 'Focus on protein and carbs for recovery'}.\n`;

      body += isNL
        ? `Training hervatten: ${advice.resumeTraining || 'Lichte training over 2-3 dagen op basis van gevoel'}.\n`
        : `Resume training: ${advice.resumeTraining || 'Light training in 2-3 days based on how you feel'}.\n`;

      if (advice.warningSignsToWatch && advice.warningSignsToWatch.length > 0) {
        body += isNL
          ? `\nLet op: ${advice.warningSignsToWatch.slice(0, 2).join(', ')}.\n`
          : `\nWatch for: ${advice.warningSignsToWatch.slice(0, 2).join(', ')}.\n`;
      }
    }
  }

  // Schedule (compact)
  if (upcomingDays && upcomingDays.length > 0) {
    body += '\n';
    body += isNL ? 'Schema:\n' : 'Schedule:\n';

    const todayStr = formatDateISO(today);

    // Dutch day abbreviations
    const dutchDayAbbrev = {
      'Monday': 'ma', 'Tuesday': 'di', 'Wednesday': 'wo', 'Thursday': 'do',
      'Friday': 'vr', 'Saturday': 'za', 'Sunday': 'zo'
    };

    for (const day of upcomingDays) {
      const isToday = day.date === todayStr;
      const prefix = isToday ? '> ' : '  ';
      let status = '';

      if (day.hasEvent) {
        status = `[${day.eventCategory}]${day.eventName ? ' ' + day.eventName : ''}`;
      } else if (day.activityType) {
        // For today, use the uploaded workout name if available (to override stale placeholder data)
        let name;
        if (isToday && type === 'workout' && workout?.type) {
          // Use the actual uploaded workout type
          name = workout.type;
        } else {
          name = day.placeholderName || day.activityType;
        }
        // Only add duration if name doesn't already include it
        const hasDurationInName = name.includes('min');
        const duration = day.duration && !hasDurationInName ? ` ${day.duration.min}min` : '';
        status = `${name}${duration}`;
      } else {
        status = '-';
      }

      // Use Dutch abbreviations when appropriate
      const dayAbbrev = isNL ? (dutchDayAbbrev[day.dayName] || day.dayName.substring(0, 2).toLowerCase()) : day.dayName.substring(0, 3);
      body += `${prefix}${dayAbbrev}: ${status}${isToday ? (isNL ? ' (vandaag)' : ' (today)') : ''}\n`;
    }
  }

  // Power Profile (for workout emails with rides) - compact
  if (type === 'workout' && powerProfile?.available) {
    const currentEftp = powerProfile.currentEftp || powerProfile.eFTP;
    body += '\n';
    body += `eFTP: ${currentEftp}W${powerProfile.allTimeEftp && powerProfile.allTimeEftp > currentEftp ? ` (all-time: ${powerProfile.allTimeEftp}W)` : ''}`;
    body += ` | ${isNL ? 'Piek' : 'Peak'}: 5s=${powerProfile.peak5s}W, 1m=${powerProfile.peak1min}W, 5m=${powerProfile.peak5min}W\n`;

    const profileNotes = [];
    if (powerProfile.strengths?.length > 0) {
      profileNotes.push(`${isNL ? 'Sterk' : 'Strong'}: ${powerProfile.strengths.slice(0, 2).join(', ')}`);
    }
    if (powerProfile.focusAreas?.length > 0) {
      profileNotes.push(`${isNL ? 'Focus' : 'Focus'}: ${powerProfile.focusAreas.slice(0, 2).join(', ')}`);
    }
    if (profileNotes.length > 0) {
      body += profileNotes.join(' | ') + '\n';
    }
  }

  // Footer
  body += '\n- IntervalCoach\n';

  GmailApp.sendEmail(USER_SETTINGS.EMAIL_TO, subject, body, { name: "IntervalCoach" });
  Logger.log(`Daily email sent (${type}).`);
}

// =========================================================
// WEEKLY SUMMARY EMAIL
// =========================================================

/**
 * Send weekly training summary email - simplified structure
 * Set up a weekly trigger (e.g., Sunday evening) to call this function
 */
function sendWeeklySummaryEmail() {
  requireValidConfig();

  const t = getTranslations();
  const today = new Date();

  // ===== FETCH ALL DATA =====
  const weekData = fetchWeeklyActivities(7);
  const prevWeekData = fetchWeeklyActivities(14, 7);

  const fitnessMetrics = fetchFitnessMetrics();
  const prevWeekDate = new Date();
  prevWeekDate.setDate(prevWeekDate.getDate() - 7);
  const prevFitnessMetrics = fetchFitnessMetrics(prevWeekDate);

  const wellnessRecords = fetchWellnessData(7);
  const wellnessSummary = createWellnessSummary(wellnessRecords);
  const prevWellnessRecords = fetchWellnessData(14, 7);
  const prevWellnessSummary = createWellnessSummary(prevWellnessRecords);

  const powerProfile = fetchPowerCurve();

  const goals = fetchUpcomingGoals();
  const phaseInfo = goals?.available && goals?.primaryGoal
    ? calculateTrainingPhase(goals.primaryGoal.date)
    : calculateTrainingPhase(USER_SETTINGS.TARGET_DATE);

  const loadAdvice = calculateTrainingLoadAdvice(fitnessMetrics, phaseInfo, goals, wellnessSummary);
  const upcoming = fetchUpcomingPlaceholders(7);

  // Fetch zone progression
  let zoneProgression = null;
  try {
    zoneProgression = calculateZoneProgression(42); // 6 weeks of data
  } catch (e) {
    Logger.log("Zone progression failed (non-critical): " + e.toString());
  }

  // Check deload status for 4-week outlook
  let deloadCheck = null;
  try {
    deloadCheck = checkDeloadNeeded(fitnessMetrics.ctl, fitnessMetrics.tsb, fitnessMetrics.rampRate, wellnessSummary);
  } catch (e) {
    Logger.log("Deload check failed (non-critical): " + e.toString());
  }

  // ===== GENERATE WEEKLY PLAN =====
  const recentTypes = getRecentWorkoutTypes(7);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const planContext = buildWeeklyPlanContext(
    tomorrow, phaseInfo, fitnessMetrics, powerProfile, wellnessSummary,
    goals, weekData, recentTypes, upcoming, loadAdvice, today
  );

  Logger.log("Generating weekly training plan...");
  const weeklyPlan = generateAIWeeklyPlan(planContext);

  // ===== GENERATE AI COACH'S BRIEF =====
  const aiInsight = generateWeeklyInsight(
    weekData, prevWeekData, fitnessMetrics, prevFitnessMetrics,
    wellnessSummary, prevWellnessSummary, fitnessMetrics.eftp,
    prevFitnessMetrics.eftp, phaseInfo, goals, loadAdvice, upcoming
  );

  // ===== BUILD EMAIL =====
  const lang = USER_SETTINGS.LANGUAGE || 'en';
  const isNL = lang === 'nl';
  const subject = t.weekly_subject + " (" + Utilities.formatDate(today, SYSTEM_SETTINGS.TIMEZONE, "MM/dd") + ")";

  let body = `${t.weekly_greeting}\n\n`;

  // Coach's Brief (conversational opening)
  if (aiInsight) {
    body += `${aiInsight}\n\n`;
  }

  // Week in Review - expanded section
  body += buildWeekInReviewSection(t, weekData, prevWeekData, fitnessMetrics, prevFitnessMetrics, wellnessSummary, prevWellnessSummary, isNL);

  // Training Highlights from this week
  body += buildWeeklyHighlightsSection(weekData, isNL);

  // Fitness & Recovery Status
  body += buildFitnessStatusSection(fitnessMetrics, wellnessSummary, phaseInfo, isNL);

  // Zone Progression
  if (zoneProgression?.available) {
    body += buildZoneProgressionSection(zoneProgression, isNL, false);
  }

  // Goal Progress
  if (goals?.available && goals?.primaryGoal) {
    body += buildGoalProgressSection(goals, phaseInfo, fitnessMetrics, isNL);
  }

  // Upcoming Week Plan with rationale
  if (weeklyPlan) {
    const calendarResults = createWeeklyPlanEvents(weeklyPlan);
    body += buildExpandedWeekPlanSection(t, weeklyPlan, calendarResults, loadAdvice, phaseInfo, isNL);
  }

  // Four-Week Outlook
  try {
    const fourWeekOutlook = generateFourWeekOutlook(fitnessMetrics, phaseInfo, zoneProgression, deloadCheck);
    if (fourWeekOutlook) {
      body += formatFourWeekOutlookSection(fourWeekOutlook, isNL);

      // Create week labels in Intervals.icu calendar
      const labelResults = createWeekLabelEvents(fourWeekOutlook);
      if (labelResults.created > 0) {
        Logger.log(`Created ${labelResults.created} week label events in Intervals.icu`);
      }
    }
  } catch (e) {
    Logger.log("Four-week outlook failed (non-critical): " + e.toString());
  }

  // Footer
  body += '\n- IntervalCoach\n';

  GmailApp.sendEmail(USER_SETTINGS.EMAIL_TO, subject, body, { name: "IntervalCoach" });
  Logger.log("Weekly summary email sent successfully.");
}

/**
 * Build context object for AI weekly plan generation
 */
function buildWeeklyPlanContext(tomorrow, phaseInfo, fitnessMetrics, powerProfile, wellnessSummary, goals, weekData, recentTypes, upcoming, loadAdvice, today) {
  const planContext = {
    startDate: formatDateISO(tomorrow),
    phase: phaseInfo.phaseName,
    weeksOut: phaseInfo.weeksOut,
    phaseFocus: phaseInfo.focus,
    phaseReasoning: phaseInfo.reasoning,
    ctl: fitnessMetrics.ctl,
    atl: fitnessMetrics.atl,
    tsb: fitnessMetrics.tsb,
    eftp: powerProfile && powerProfile.available ? powerProfile.currentEftp : null,
    ctlTrend: fitnessMetrics.rampRate > 0.5 ? 'increasing' : fitnessMetrics.rampRate < -0.5 ? 'decreasing' : 'stable',
    recoveryStatus: wellnessSummary.available ? wellnessSummary.recoveryStatus : 'Unknown',
    avgRecovery: wellnessSummary.available ? wellnessSummary.averages?.recovery : null,
    avgSleep: wellnessSummary.available ? wellnessSummary.averages?.sleep : null,
    goals: goals,
    lastWeek: {
      totalTss: weekData.totalTss,
      activities: weekData.totalActivities,
      rideTypes: recentTypes.rides,
      runTypes: recentTypes.runs,
      highIntensityDays: recentTypes.all.filter(function(t) {
        const catalog = Object.assign({}, WORKOUT_TYPES.ride, WORKOUT_TYPES.run);
        return catalog[t]?.intensity >= 4;
      }).length
    },
    scheduledDays: upcoming.filter(function(d) { return d.activityType; }),
    tssTarget: loadAdvice.tssRange,
    dailyTss: { min: loadAdvice.dailyTSSMin, max: loadAdvice.dailyTSSMax },
    twoWeekHistory: getTwoWeekWorkoutHistory()
  };

  // Get upcoming events (races)
  const upcomingEvents = [];
  for (let i = 0; i < 7; i++) {
    const eventCheck = hasEventInDays(i);
    if (eventCheck.hasEvent) {
      const eventDate = new Date();
      eventDate.setDate(eventDate.getDate() + i);
      upcomingEvents.push({
        date: formatDateISO(eventDate),
        dayName: Utilities.formatDate(eventDate, SYSTEM_SETTINGS.TIMEZONE, "EEEE"),
        eventCategory: eventCheck.category,
        name: eventCheck.eventName,
        description: eventCheck.eventDescription
      });
    }
  }
  planContext.upcomingEvents = upcomingEvents;

  // Get existing scheduled workouts for next 7 days (uses cached event fetching)
  const existingWorkouts = [];
  for (let i = 1; i <= 7; i++) {
    const checkDate = new Date(today);
    checkDate.setDate(today.getDate() + i);
    const dateStr = formatDateISO(checkDate);
    const dayName = Utilities.formatDate(checkDate, SYSTEM_SETTINGS.TIMEZONE, "EEEE");

    const eventData = fetchEventsForDate(dateStr);
    if (eventData.success && eventData.workoutEvents.length > 0) {
      const workout = eventData.workoutEvents[0];
      const isSimplePlaceholder = /^(Ride|Run)( - \d+min)?$/.test(workout.name || '');
      const isWeeklyPlan = workout.description?.includes('[Weekly Plan]');
      if (!isSimplePlaceholder && !isWeeklyPlan) {
        existingWorkouts.push({
          date: dateStr,
          dayName: dayName,
          name: workout.name,
          duration: workout.moving_time ? Math.round(workout.moving_time / 60) : null,
          type: workout.type || (workout.name?.toLowerCase().includes('run') ? 'Run' : 'Ride')
        });
      }
    }
  }
  planContext.existingWorkouts = existingWorkouts;

  // Add zone progression if available
  try {
    const zoneProgression = calculateZoneProgression();
    if (zoneProgression && zoneProgression.available) {
      planContext.zoneProgression = zoneProgression;
    }
  } catch (e) {
    Logger.log("Zone progression failed (non-critical): " + e.toString());
  }

  // Add cross-sport equivalency if both cycling and running data available
  try {
    const crossSportEquivalency = calculateCrossSportEquivalency();
    if (crossSportEquivalency && crossSportEquivalency.available) {
      planContext.crossSportEquivalency = crossSportEquivalency;

      // Get AI cross-sport recommendations
      const crossSportRecommendations = generateCrossSportRecommendations(
        crossSportEquivalency,
        planContext.zoneProgression,
        phaseInfo,
        goals
      );
      if (crossSportRecommendations && crossSportRecommendations.available) {
        planContext.crossSportRecommendations = crossSportRecommendations;
      }
    }
  } catch (e) {
    Logger.log("Cross-sport equivalency failed (non-critical): " + e.toString());
  }

  // Add recovery timing info (dynamic based on body signals)
  try {
    const deloadCheck = checkDeloadNeeded(fitnessMetrics.ctl, fitnessMetrics.tsb, fitnessMetrics.rampRate, wellnessSummary);
    if (deloadCheck) {
      planContext.periodizationBlock = {
        weeksWithoutDeload: deloadCheck.weeksWithoutDeload || 0,
        needsRecovery: deloadCheck.needed,
        urgency: deloadCheck.urgency,
        isRecoveryWeek: deloadCheck.needed && deloadCheck.urgency === 'high'
      };
    }
  } catch (e) {
    Logger.log("Recovery timing check failed (non-critical): " + e.toString());
  }

  return planContext;
}

/**
 * Build compact "Week in Cijfers" section with diffs vs previous week
 */
function buildWeekInCijfersSection(t, weekData, prevWeekData, fitnessMetrics, prevFitnessMetrics, wellnessSummary, prevWellnessSummary, isNL) {
  // Calculate diffs
  const sessionsDiff = weekData.totalActivities - prevWeekData.totalActivities;
  const timeDiff = weekData.totalTime - prevWeekData.totalTime;
  const tssDiff = weekData.totalTss - prevWeekData.totalTss;

  const ctlDiff = fitnessMetrics.ctl - (prevFitnessMetrics.ctl || 0);
  const eftpDiff = (fitnessMetrics.eftp && prevFitnessMetrics.eftp)
    ? fitnessMetrics.eftp - prevFitnessMetrics.eftp : null;

  const prevAvg = prevWellnessSummary?.available ? prevWellnessSummary.averages : {};
  const currAvg = wellnessSummary?.available ? wellnessSummary.averages : {};
  const sleepDiff = (currAvg.sleep && prevAvg.sleep) ? currAvg.sleep - prevAvg.sleep : null;

  // Format helpers
  const formatDiff = function(val, decimals) {
    if (val == null) return '';
    const sign = val >= 0 ? '+' : '';
    return ' (' + sign + val.toFixed(decimals || 0) + ')';
  };

  const formatTimeDiff = function(secs) {
    if (secs == null) return '';
    const sign = secs >= 0 ? '+' : '-';
    const absSecs = Math.abs(secs);
    const h = Math.floor(absSecs / 3600);
    const m = Math.floor((absSecs % 3600) / 60);
    if (h > 0) return ' (' + sign + h + 'h ' + m + 'm)';
    return ' (' + sign + m + 'm)';
  };

  // Conversational opening with week summary
  let section = isNL
    ? `Afgelopen week: ${weekData.totalActivities} sessies${formatDiff(sessionsDiff)}, ${formatDuration(weekData.totalTime)}${formatTimeDiff(timeDiff)}, ${weekData.totalTss.toFixed(0)} TSS${formatDiff(tssDiff)}.\n`
    : `Last week: ${weekData.totalActivities} sessions${formatDiff(sessionsDiff)}, ${formatDuration(weekData.totalTime)}${formatTimeDiff(timeDiff)}, ${weekData.totalTss.toFixed(0)} TSS${formatDiff(tssDiff)}.\n`;

  // Fitness inline
  section += `CTL ${fitnessMetrics.ctl.toFixed(1)}${formatDiff(ctlDiff, 1)} | TSB ${fitnessMetrics.tsb.toFixed(1)}`;
  if (fitnessMetrics.eftp) {
    section += ` | eFTP ${fitnessMetrics.eftp}W${eftpDiff != null ? formatDiff(eftpDiff) : ''}`;
  }
  section += '\n';

  // Wellness inline if available
  if (wellnessSummary?.available && currAvg.sleep) {
    section += isNL ? 'Herstel: ' : 'Recovery: ';
    section += `${isNL ? 'slaap' : 'sleep'} ${currAvg.sleep.toFixed(1)}h${sleepDiff != null ? formatDiff(sleepDiff, 1) : ''}`;
    if (currAvg.hrv) {
      section += ` | HRV ${currAvg.hrv.toFixed(0)}ms`;
    }
    if (currAvg.recovery) {
      section += ` | ${currAvg.recovery.toFixed(0)}%`;
    }
    section += '\n';
  }

  section += '\n';
  return section;
}

/**
 * Build compact "Komende Week" section with day-by-day plan
 */
function buildKomendeWeekSection(t, weeklyPlan, calendarResults, isNL) {
  let section = isNL ? 'Komende week:\n' : 'Upcoming week:\n';

  // Dutch day abbreviations
  const dutchDayAbbrev = {
    'Monday': 'ma', 'Tuesday': 'di', 'Wednesday': 'wo', 'Thursday': 'do',
    'Friday': 'vr', 'Saturday': 'za', 'Sunday': 'zo'
  };

  // Day by day - compact format: "ma  Endurance 60min ~45TSS"
  for (const day of weeklyPlan.days) {
    const dayAbbrev = isNL ? (dutchDayAbbrev[day.dayName] || day.dayName.substring(0, 2).toLowerCase()) : day.dayName.substring(0, 2);

    // Treat as rest if activity is Rest/Rust OR if duration/TSS are 0 or missing
    const isRest = day.activity === 'Rest' || day.activity === 'Rust' ||
                   (!day.duration && !day.estimatedTSS) ||
                   (day.duration === 0 && day.estimatedTSS === 0);

    if (isRest) {
      section += `${dayAbbrev}  ${isNL ? 'rust' : 'rest'}\n`;
    } else {
      const workoutName = day.workoutType || day.activity;
      const isKeyWorkout = weeklyPlan.keyWorkouts?.some(function(kw) {
        return kw.toLowerCase().includes(day.dayName.toLowerCase());
      });
      const marker = isKeyWorkout ? ' *' : '';
      section += `${dayAbbrev}  ${workoutName} ${day.duration}min ~${day.estimatedTSS}TSS${marker}\n`;
    }
  }

  // Week summary line
  const dist = weeklyPlan.intensityDistribution || {};
  section += '\n';
  section += isNL
    ? `Weekdoel: ${weeklyPlan.totalPlannedTSS} TSS (${dist.high || 0} hard, ${dist.medium || 0} medium, ${dist.low || 0} easy)\n`
    : `Week target: ${weeklyPlan.totalPlannedTSS} TSS (${dist.high || 0} hard, ${dist.medium || 0} medium, ${dist.low || 0} easy)\n`;

  // Key workout inline
  if (weeklyPlan.keyWorkouts && weeklyPlan.keyWorkouts.length > 0) {
    section += isNL
      ? `Key workout: ${weeklyPlan.keyWorkouts[0]}\n`
      : `Key workout: ${weeklyPlan.keyWorkouts[0]}\n`;
  }

  // Calendar sync info inline
  if (calendarResults && calendarResults.created > 0) {
    section += isNL
      ? `(${calendarResults.created} workout${calendarResults.created > 1 ? 's' : ''} toegevoegd aan calendar)\n`
      : `(${calendarResults.created} workout${calendarResults.created > 1 ? 's' : ''} added to calendar)\n`;
  }

  return section;
}

// =========================================================
// EXPANDED WEEKLY EMAIL SECTIONS
// =========================================================

/**
 * Build expanded Week in Review section
 */
function buildWeekInReviewSection(t, weekData, prevWeekData, fitnessMetrics, prevFitnessMetrics, wellnessSummary, prevWellnessSummary, isNL) {
  let section = isNL ? 'AFGELOPEN WEEK\n\n' : 'PAST WEEK\n\n';

  const sessionsDiff = weekData.totalActivities - prevWeekData.totalActivities;
  const tssDiff = weekData.totalTss - prevWeekData.totalTss;
  const timeDiff = weekData.totalTime - prevWeekData.totalTime;
  const timeDiffMins = Math.round(timeDiff / 60);

  // Narrative opening about volume
  if (isNL) {
    if (tssDiff > 50) {
      section += `Een flinke week met ${weekData.totalTss.toFixed(0)} TSS - dat is ${Math.abs(tssDiff).toFixed(0)} meer dan vorige week. `;
    } else if (tssDiff < -50) {
      section += `Een rustigere week met ${weekData.totalTss.toFixed(0)} TSS - ${Math.abs(tssDiff).toFixed(0)} minder dan vorige week. `;
    } else {
      section += `Een consistente week met ${weekData.totalTss.toFixed(0)} TSS, vergelijkbaar met vorige week. `;
    }
    section += `In totaal ${weekData.totalActivities} sessies over ${formatDuration(weekData.totalTime)}.\n\n`;
  } else {
    if (tssDiff > 50) {
      section += `A solid week with ${weekData.totalTss.toFixed(0)} TSS - that's ${Math.abs(tssDiff).toFixed(0)} more than last week. `;
    } else if (tssDiff < -50) {
      section += `A lighter week with ${weekData.totalTss.toFixed(0)} TSS - ${Math.abs(tssDiff).toFixed(0)} less than last week. `;
    } else {
      section += `A consistent week with ${weekData.totalTss.toFixed(0)} TSS, similar to last week. `;
    }
    section += `${weekData.totalActivities} sessions totaling ${formatDuration(weekData.totalTime)}.\n\n`;
  }

  // Sport breakdown with context
  if (weekData.activities && weekData.activities.length > 0) {
    const rides = weekData.activities.filter(a => a.type === 'Ride' || a.type === 'VirtualRide');
    const runs = weekData.activities.filter(a => a.type === 'Run' || a.type === 'VirtualRun');
    const rideTss = rides.reduce((sum, a) => sum + (a.tss || 0), 0);
    const runTss = runs.reduce((sum, a) => sum + (a.tss || 0), 0);
    const rideTime = rides.reduce((sum, a) => sum + (a.duration || 0), 0);
    const runTime = runs.reduce((sum, a) => sum + (a.duration || 0), 0);

    if (rides.length > 0) {
      section += isNL
        ? `Fietsen: ${rides.length} ${rides.length === 1 ? 'rit' : 'ritten'}, ${formatDuration(rideTime)}, ${rideTss.toFixed(0)} TSS\n`
        : `Cycling: ${rides.length} ${rides.length === 1 ? 'ride' : 'rides'}, ${formatDuration(rideTime)}, ${rideTss.toFixed(0)} TSS\n`;
    }
    if (runs.length > 0) {
      section += isNL
        ? `Hardlopen: ${runs.length} ${runs.length === 1 ? 'loop' : 'lopen'}, ${formatDuration(runTime)}, ${runTss.toFixed(0)} TSS\n`
        : `Running: ${runs.length} ${runs.length === 1 ? 'run' : 'runs'}, ${formatDuration(runTime)}, ${runTss.toFixed(0)} TSS\n`;
    }
  }

  // Recovery section with interpretation
  section += '\n';
  if (wellnessSummary?.available) {
    const currAvg = wellnessSummary.averages || {};
    const prevAvg = prevWellnessSummary?.available ? prevWellnessSummary.averages : {};

    section += isNL ? 'Herstel & Welzijn\n\n' : 'Recovery & Wellness\n\n';

    // Sleep narrative
    if (currAvg.sleep) {
      const sleepDiff = prevAvg.sleep ? currAvg.sleep - prevAvg.sleep : null;
      let sleepQuality = '';
      if (currAvg.sleep >= 8) {
        sleepQuality = isNL ? 'uitstekend' : 'excellent';
      } else if (currAvg.sleep >= 7) {
        sleepQuality = isNL ? 'goed' : 'good';
      } else if (currAvg.sleep >= 6) {
        sleepQuality = isNL ? 'matig' : 'moderate';
      } else {
        sleepQuality = isNL ? 'onvoldoende' : 'insufficient';
      }

      section += isNL
        ? `Slaap: gemiddeld ${currAvg.sleep.toFixed(1)} uur per nacht (${sleepQuality})`
        : `Sleep: averaging ${currAvg.sleep.toFixed(1)} hours per night (${sleepQuality})`;
      if (sleepDiff && Math.abs(sleepDiff) >= 0.3) {
        section += sleepDiff > 0
          ? (isNL ? `, ${sleepDiff.toFixed(1)}h meer dan vorige week` : `, ${sleepDiff.toFixed(1)}h more than last week`)
          : (isNL ? `, ${Math.abs(sleepDiff).toFixed(1)}h minder dan vorige week` : `, ${Math.abs(sleepDiff).toFixed(1)}h less than last week`);
      }
      section += '.\n';
    }

    // HRV narrative
    if (currAvg.hrv) {
      const hrvDiff = prevAvg.hrv ? currAvg.hrv - prevAvg.hrv : null;
      section += isNL
        ? `HRV: gemiddeld ${currAvg.hrv.toFixed(0)}ms`
        : `HRV: averaging ${currAvg.hrv.toFixed(0)}ms`;
      if (hrvDiff && Math.abs(hrvDiff) >= 3) {
        section += hrvDiff > 0
          ? (isNL ? ` (${hrvDiff.toFixed(0)}ms hoger)` : ` (${hrvDiff.toFixed(0)}ms higher)`)
          : (isNL ? ` (${Math.abs(hrvDiff).toFixed(0)}ms lager)` : ` (${Math.abs(hrvDiff).toFixed(0)}ms lower)`);
      }
      section += '.\n';
    }

    // RHR narrative
    if (currAvg.rhr) {
      const rhrDiff = prevAvg.rhr ? currAvg.rhr - prevAvg.rhr : null;
      section += isNL
        ? `Rusthartslag: gemiddeld ${currAvg.rhr.toFixed(0)} bpm`
        : `Resting HR: averaging ${currAvg.rhr.toFixed(0)} bpm`;
      if (rhrDiff && Math.abs(rhrDiff) >= 2) {
        section += rhrDiff > 0
          ? (isNL ? ` (${rhrDiff.toFixed(0)} hoger - let op vermoeidheid)` : ` (${rhrDiff.toFixed(0)} higher - watch for fatigue)`)
          : (isNL ? ` (${Math.abs(rhrDiff).toFixed(0)} lager - goed hersteld)` : ` (${Math.abs(rhrDiff).toFixed(0)} lower - well recovered)`);
      }
      section += '.\n';
    }

    // Recovery status interpretation
    if (wellnessSummary.recoveryStatus) {
      section += '\n';
      const status = wellnessSummary.recoveryStatus.toLowerCase();
      if (status.includes('green') || status.includes('primed')) {
        section += isNL
          ? 'Je lichaam is goed hersteld en klaar voor intensieve training.\n'
          : 'Your body is well recovered and ready for intense training.\n';
      } else if (status.includes('yellow') || status.includes('recovering')) {
        section += isNL
          ? 'Je bent nog aan het herstellen. Matige training is prima, maar vermijd extreme inspanning.\n'
          : 'You\'re still recovering. Moderate training is fine, but avoid extreme efforts.\n';
      } else if (status.includes('red') || status.includes('strained')) {
        section += isNL
          ? 'Je lichaam vraagt om rust. Overweeg een hersteldag of lichte activiteit.\n'
          : 'Your body needs rest. Consider a recovery day or light activity.\n';
      }
    }
  }

  section += '\n';
  return section;
}

/**
 * Build training highlights section
 */
function buildWeeklyHighlightsSection(weekData, isNL) {
  if (!weekData.activities || weekData.activities.length === 0) {
    return '';
  }

  let section = isNL ? 'HOOGTEPUNTEN\n\n' : 'HIGHLIGHTS\n\n';
  const highlights = [];

  // Find best efforts (using correct property names from fetchWeeklyActivities)
  let maxTss = 0, maxTssActivity = null;
  let maxDuration = 0, maxDurationActivity = null;

  for (const activity of weekData.activities) {
    if ((activity.tss || 0) > maxTss) {
      maxTss = activity.tss || 0;
      maxTssActivity = activity;
    }
    if ((activity.duration || 0) > maxDuration) {
      maxDuration = activity.duration || 0;
      maxDurationActivity = activity;
    }
  }

  // Add highlights
  if (maxTssActivity && maxTss > 0) {
    const day = new Date(maxTssActivity.date).toLocaleDateString(isNL ? 'nl-NL' : 'en-US', { weekday: 'long' });
    highlights.push(isNL
      ? `Zwaarste sessie: ${maxTssActivity.name || maxTssActivity.type} (${maxTss.toFixed(0)} TSS) op ${day}`
      : `Hardest session: ${maxTssActivity.name || maxTssActivity.type} (${maxTss.toFixed(0)} TSS) on ${day}`);
  }

  if (maxDurationActivity && maxDurationActivity !== maxTssActivity && maxDuration > 0) {
    const duration = Math.round(maxDuration / 60);
    highlights.push(isNL
      ? `Langste sessie: ${maxDurationActivity.name || maxDurationActivity.type} (${duration}min)`
      : `Longest session: ${maxDurationActivity.name || maxDurationActivity.type} (${duration}min)`);
  }

  if (highlights.length === 0) {
    return '';
  }

  for (const h of highlights) {
    section += `- ${h}\n`;
  }

  section += '\n';
  return section;
}

/**
 * Build fitness status section
 */
function buildFitnessStatusSection(fitnessMetrics, wellnessSummary, phaseInfo, isNL) {
  let section = isNL ? 'FITNESS STATUS\n\n' : 'FITNESS STATUS\n\n';

  const ctl = fitnessMetrics.ctl;
  const atl = fitnessMetrics.atl;
  const tsb = fitnessMetrics.tsb;

  // Opening narrative about current fitness
  if (isNL) {
    section += `Je huidige fitnessniveau (CTL) staat op ${ctl.toFixed(0)}. `;
    if (ctl > 80) {
      section += 'Dit is een uitstekend niveau voor serieuze wedstrijden.\n';
    } else if (ctl > 60) {
      section += 'Dit is een goed niveau voor competitieve prestaties.\n';
    } else if (ctl > 40) {
      section += 'Dit is een solide basis voor recreatief sporten.\n';
    } else {
      section += 'Er is ruimte voor opbouw richting je doelen.\n';
    }
  } else {
    section += `Your current fitness (CTL) is at ${ctl.toFixed(0)}. `;
    if (ctl > 80) {
      section += 'This is an excellent level for serious competition.\n';
    } else if (ctl > 60) {
      section += 'This is a solid level for competitive performance.\n';
    } else if (ctl > 40) {
      section += 'This is a good base for recreational riding.\n';
    } else {
      section += 'There\'s room to build toward your goals.\n';
    }
  }

  // TSB/Form explanation
  section += '\n';
  if (isNL) {
    if (tsb > 15) {
      section += `Je vorm (TSB ${tsb.toFixed(0)}) is uitstekend - je bent fris en klaar voor een wedstrijd of test. Na een taper periode is dit ideaal.\n`;
    } else if (tsb > 5) {
      section += `Je vorm (TSB ${tsb.toFixed(0)}) is goed - je bent hersteld en kunt goed presteren. Prima moment voor een langere of intensievere sessie.\n`;
    } else if (tsb > -10) {
      section += `Je vorm (TSB ${tsb.toFixed(0)}) is optimaal voor training - genoeg prikkel om te verbeteren, maar niet overbelast. Dit is de sweet spot.\n`;
    } else if (tsb > -20) {
      section += `Je vorm (TSB ${tsb.toFixed(0)}) wijst op enige vermoeidheid - normaal tijdens opbouwweken. Luister naar je lichaam en forceer niet.\n`;
    } else {
      section += `Je vorm (TSB ${tsb.toFixed(0)}) is laag - je lichaam draagt flinke vermoeidheid. Plan een rustdag of herstelweek in.\n`;
    }
  } else {
    if (tsb > 15) {
      section += `Your form (TSB ${tsb.toFixed(0)}) is excellent - you're fresh and ready for a race or test. Ideal after a taper period.\n`;
    } else if (tsb > 5) {
      section += `Your form (TSB ${tsb.toFixed(0)}) is good - you're recovered and can perform well. Good time for a longer or harder session.\n`;
    } else if (tsb > -10) {
      section += `Your form (TSB ${tsb.toFixed(0)}) is optimal for training - enough stimulus to improve without overload. This is the sweet spot.\n`;
    } else if (tsb > -20) {
      section += `Your form (TSB ${tsb.toFixed(0)}) shows some fatigue - normal during build weeks. Listen to your body and don't force it.\n`;
    } else {
      section += `Your form (TSB ${tsb.toFixed(0)}) is low - significant accumulated fatigue. Plan a rest day or recovery week.\n`;
    }
  }

  // Fatigue context
  section += '\n';
  const fatigueRatio = atl / (ctl || 1);
  if (isNL) {
    section += `Vermoeidheid (ATL): ${atl.toFixed(0)}`;
    if (fatigueRatio > 1.3) {
      section += ' - Recente belasting is hoger dan je fitnessniveau. Na een paar dagen rust zal dit zakken.\n';
    } else if (fatigueRatio > 1.1) {
      section += ' - Je traint productief boven je huidige niveau. Goede prikkel voor aanpassing.\n';
    } else {
      section += ' - Vermoeidheid is in balans met je fitness. Stabiele situatie.\n';
    }
  } else {
    section += `Fatigue (ATL): ${atl.toFixed(0)}`;
    if (fatigueRatio > 1.3) {
      section += ' - Recent load exceeds your fitness level. A few days of rest will bring this down.\n';
    } else if (fatigueRatio > 1.1) {
      section += ' - You\'re training productively above your current level. Good stimulus for adaptation.\n';
    } else {
      section += ' - Fatigue is balanced with your fitness. Stable situation.\n';
    }
  }

  // eFTP if available
  if (fitnessMetrics.eftp) {
    section += '\n';
    section += isNL
      ? `Je geschatte FTP (eFTP) is ${fitnessMetrics.eftp}W. Dit is de basis voor je trainingszones.\n`
      : `Your estimated FTP (eFTP) is ${fitnessMetrics.eftp}W. This forms the basis for your training zones.\n`;
  }

  // Ramp rate with context
  if (fitnessMetrics.rampRate != null) {
    const rate = fitnessMetrics.rampRate;
    section += '\n';
    if (isNL) {
      section += `Opbouwtempo: ${rate > 0 ? '+' : ''}${rate.toFixed(1)} CTL/week - `;
      if (rate > 7) {
        section += 'Dit is erg snel. Risico op overbelasting. Overweeg een rustweek.\n';
      } else if (rate > 4) {
        section += 'Ambitieus tempo. Zorg voor goede rust en voeding.\n';
      } else if (rate > 1) {
        section += 'Gezond opbouwtempo. Je kunt dit volhouden.\n';
      } else if (rate > -1) {
        section += 'Stabiel. Goed voor onderhoud of herstelperiode.\n';
      } else {
        section += 'Afbouwend. Prima voor taper of herstel, maar niet langdurig.\n';
      }
    } else {
      section += `Ramp rate: ${rate > 0 ? '+' : ''}${rate.toFixed(1)} CTL/week - `;
      if (rate > 7) {
        section += 'This is very fast. Risk of overload. Consider a rest week.\n';
      } else if (rate > 4) {
        section += 'Aggressive pace. Ensure good rest and nutrition.\n';
      } else if (rate > 1) {
        section += 'Healthy build rate. You can sustain this.\n';
      } else if (rate > -1) {
        section += 'Stable. Good for maintenance or recovery period.\n';
      } else {
        section += 'Decreasing. Fine for taper or recovery, but not long-term.\n';
      }
    }
  }

  section += '\n';
  return section;
}

/**
 * Build goal progress section
 */
function buildGoalProgressSection(goals, phaseInfo, fitnessMetrics, isNL) {
  let section = isNL ? 'DOEL VOORTGANG\n\n' : 'GOAL PROGRESS\n\n';

  const goal = goals.primaryGoal;
  const currentCtl = fitnessMetrics.ctl;
  const weeksOut = phaseInfo.weeksOut;
  const phaseName = phaseInfo.phaseName.toLowerCase();

  // Goal headline
  section += `${goal.name}\n`;
  section += `${goal.date}\n\n`;

  // Time until event with context
  if (isNL) {
    if (weeksOut <= 1) {
      section += 'Het is zover! Je evenement is deze week. ';
    } else if (weeksOut <= 2) {
      section += `Nog ${weeksOut} weken te gaan. De eindsprint is ingezet. `;
    } else if (weeksOut <= 4) {
      section += `Nog ${weeksOut} weken tot je evenement. De laatste opbouwfase. `;
    } else if (weeksOut <= 8) {
      section += `Nog ${weeksOut} weken. Genoeg tijd om gericht te trainen. `;
    } else {
      section += `Nog ${weeksOut} weken. Je hebt ruim de tijd om op te bouwen. `;
    }
  } else {
    if (weeksOut <= 1) {
      section += 'It\'s happening! Your event is this week. ';
    } else if (weeksOut <= 2) {
      section += `${weeksOut} weeks to go. The final countdown. `;
    } else if (weeksOut <= 4) {
      section += `${weeksOut} weeks until your event. The final build phase. `;
    } else if (weeksOut <= 8) {
      section += `${weeksOut} weeks out. Enough time for targeted training. `;
    } else {
      section += `${weeksOut} weeks out. Plenty of time to build up. `;
    }
  }

  // Current phase explanation
  if (isNL) {
    section += `Je zit nu in de ${phaseInfo.phaseName} fase.\n\n`;
    if (phaseName.includes('base')) {
      section += 'In deze fase ligt de nadruk op aerobe basis en uithoudingsvermogen. Volume is belangrijker dan intensiteit. ';
      section += 'Bouw geleidelijk op en focus op consistentie.\n';
    } else if (phaseName.includes('build')) {
      section += 'In deze fase verhoog je de intensiteit terwijl je het volume behoudt. ';
      section += 'Key workouts worden belangrijker - dit zijn de sessies die je specifiek voorbereiden op je doel.\n';
    } else if (phaseName.includes('peak')) {
      section += 'In de piekfase doe je de laatste scherpe training. ';
      section += 'Intensiteit blijft hoog, maar het volume neemt af. Kwaliteit boven kwantiteit.\n';
    } else if (phaseName.includes('taper')) {
      section += 'Tijdens de taper verminder je de belasting om fris aan de start te staan. ';
      section += 'Behoud wat intensiteit om scherp te blijven, maar rust is nu prioriteit.\n';
    } else if (phaseName.includes('race') || phaseName.includes('event')) {
      section += 'Focus nu op je wedstrijdvoorbereiding. Lichte activatie, geen zware training meer.\n';
    }
  } else {
    section += `You're currently in the ${phaseInfo.phaseName} phase.\n\n`;
    if (phaseName.includes('base')) {
      section += 'This phase focuses on aerobic foundation and endurance. Volume matters more than intensity. ';
      section += 'Build gradually and focus on consistency.\n';
    } else if (phaseName.includes('build')) {
      section += 'In this phase, intensity increases while maintaining volume. ';
      section += 'Key workouts become more important - these are the sessions that prepare you specifically for your goal.\n';
    } else if (phaseName.includes('peak')) {
      section += 'The peak phase is for final sharp training. ';
      section += 'Intensity stays high, but volume decreases. Quality over quantity.\n';
    } else if (phaseName.includes('taper')) {
      section += 'During taper, you reduce load to arrive fresh at the start. ';
      section += 'Maintain some intensity to stay sharp, but rest is now the priority.\n';
    } else if (phaseName.includes('race') || phaseName.includes('event')) {
      section += 'Focus now on race preparation. Light activation, no heavy training.\n';
    }
  }

  // Current fitness in context
  section += '\n';
  if (isNL) {
    section += `Je huidige fitness (CTL ${currentCtl.toFixed(0)}) `;
    // Estimate where CTL should be at event time (rough)
    const targetCtl = phaseName.includes('taper') ? currentCtl : currentCtl + weeksOut * 1.5;
    if (weeksOut > 8) {
      section += `geeft je voldoende tijd om richting CTL ${Math.round(targetCtl)} te bouwen voor je evenement.\n`;
    } else if (weeksOut > 4) {
      section += `is een goede basis. Focus nu op specifieke voorbereiding.\n`;
    } else {
      section += `is je vertrekpunt voor de laatste weken. Verfijn je vorm.\n`;
    }
  } else {
    section += `Your current fitness (CTL ${currentCtl.toFixed(0)}) `;
    const targetCtl = phaseName.includes('taper') ? currentCtl : currentCtl + weeksOut * 1.5;
    if (weeksOut > 8) {
      section += `gives you time to build toward CTL ${Math.round(targetCtl)} by your event.\n`;
    } else if (weeksOut > 4) {
      section += `is a solid base. Focus now on specific preparation.\n`;
    } else {
      section += `is your starting point for the final weeks. Refine your form.\n`;
    }
  }

  // Training focus
  if (phaseInfo.focus) {
    section += '\n';
    section += isNL
      ? `Training focus: ${phaseInfo.focus}\n`
      : `Training focus: ${phaseInfo.focus}\n`;
  }

  section += '\n';
  return section;
}

/**
 * Build zone progression section for weekly/monthly emails
 * @param {object} zoneProgression - Zone progression data from calculateZoneProgression
 * @param {boolean} isNL - Dutch language flag
 * @param {boolean} isMonthly - Whether this is for monthly email (more detail)
 * @returns {string} Formatted section
 */
function buildZoneProgressionSection(zoneProgression, isNL, isMonthly) {
  if (!zoneProgression || !zoneProgression.available) {
    return '';
  }

  let section = isNL ? 'ZONE ONTWIKKELING\n\n' : 'ZONE DEVELOPMENT\n\n';

  const prog = zoneProgression.progression;
  const zoneNames = {
    endurance: isNL ? 'Duurvermogen' : 'Endurance',
    tempo: 'Tempo',
    threshold: isNL ? 'Drempel' : 'Threshold',
    vo2max: 'VO2max',
    anaerobic: isNL ? 'Anaeroob' : 'Anaerobic'
  };

  const trendNames = {
    improving: isNL ? 'verbeterend' : 'improving',
    stable: isNL ? 'stabiel' : 'stable',
    declining: isNL ? 'dalend' : 'declining',
    plateaued: isNL ? 'plateau' : 'plateaued'
  };

  // Visual level bar (simplified)
  const levelBar = function(level) {
    const filled = Math.round(level);
    const empty = 10 - filled;
    return '[' + '='.repeat(filled) + '-'.repeat(empty) + '] ' + level.toFixed(1);
  };

  // Opening narrative
  if (isNL) {
    if (zoneProgression.strengths?.length > 0) {
      section += `Je sterkste zones zijn ${zoneProgression.strengths.map(z => zoneNames[z]).join(' en ')}. `;
    }
    if (zoneProgression.focusAreas?.length > 0) {
      section += `Aandachtspunten: ${zoneProgression.focusAreas.map(z => zoneNames[z]).join(' en ')}.\n\n`;
    }
  } else {
    if (zoneProgression.strengths?.length > 0) {
      section += `Your strongest zones are ${zoneProgression.strengths.map(z => zoneNames[z]).join(' and ')}. `;
    }
    if (zoneProgression.focusAreas?.length > 0) {
      section += `Focus areas: ${zoneProgression.focusAreas.map(z => zoneNames[z]).join(' and ')}.\n\n`;
    }
  }

  // Zone breakdown
  for (const [zone, data] of Object.entries(prog)) {
    const name = zoneNames[zone];
    const trend = trendNames[data.trend] || data.trend;

    if (isMonthly) {
      // More detail for monthly
      section += `${name}: ${levelBar(data.level)} (${trend})\n`;
      section += isNL
        ? `  ${data.sessions} sessies, ${data.totalMinutes} min totaal`
        : `  ${data.sessions} sessions, ${data.totalMinutes} min total`;
      if (data.lastTrained) {
        const daysSince = Math.floor((new Date() - new Date(data.lastTrained)) / (1000 * 60 * 60 * 24));
        section += isNL ? `, laatst ${daysSince}d geleden` : `, last ${daysSince}d ago`;
      }
      section += '\n';
    } else {
      // Compact for weekly
      section += `${name}: ${data.level.toFixed(1)}/10 (${trend})`;
      if (data.trend === 'declining' && data.lastTrained) {
        const daysSince = Math.floor((new Date() - new Date(data.lastTrained)) / (1000 * 60 * 60 * 24));
        section += isNL ? ` - ${daysSince}d niet getraind` : ` - ${daysSince}d since training`;
      }
      section += '\n';
    }
  }

  // Recommendations based on trends
  section += '\n';
  const declining = Object.entries(prog).filter(([_, d]) => d.trend === 'declining');
  const plateaued = Object.entries(prog).filter(([_, d]) => d.trend === 'plateaued');

  if (declining.length > 0) {
    const zones = declining.map(([z, _]) => zoneNames[z]).join(', ');
    section += isNL
      ? `Let op: ${zones} ${declining.length === 1 ? 'daalt' : 'dalen'} - overweeg een sessie in deze zone.\n`
      : `Note: ${zones} ${declining.length === 1 ? 'is declining' : 'are declining'} - consider a session in this zone.\n`;
  }

  if (plateaued.length > 0) {
    const zones = plateaued.map(([z, _]) => zoneNames[z]).join(', ');
    section += isNL
      ? `${zones} ${plateaued.length === 1 ? 'zit' : 'zitten'} op een plateau - varieer de training voor doorbraak.\n`
      : `${zones} ${plateaued.length === 1 ? 'has' : 'have'} plateaued - vary training for breakthrough.\n`;
  }

  section += '\n';
  return section;
}

/**
 * Build expanded week plan section with rationale
 */
function buildExpandedWeekPlanSection(t, weeklyPlan, calendarResults, loadAdvice, phaseInfo, isNL) {
  let section = isNL ? 'KOMENDE WEEK\n\n' : 'UPCOMING WEEK\n\n';

  // Dutch day abbreviations
  const dutchDayAbbrev = {
    'Monday': 'ma', 'Tuesday': 'di', 'Wednesday': 'wo', 'Thursday': 'do',
    'Friday': 'vr', 'Saturday': 'za', 'Sunday': 'zo'
  };

  // Week overview
  const dist = weeklyPlan.intensityDistribution || {};
  section += isNL
    ? `Weekdoel: ${weeklyPlan.totalPlannedTSS} TSS\n`
    : `Week target: ${weeklyPlan.totalPlannedTSS} TSS\n`;
  section += isNL
    ? `Mix: ${dist.high || 0} intensief, ${dist.medium || 0} matig, ${dist.low || 0} rustig, ${dist.rest || 0} rust\n\n`
    : `Mix: ${dist.high || 0} hard, ${dist.medium || 0} moderate, ${dist.low || 0} easy, ${dist.rest || 0} rest\n\n`;

  // Day by day with description
  for (const day of weeklyPlan.days) {
    const dayAbbrev = isNL ? (dutchDayAbbrev[day.dayName] || day.dayName.substring(0, 2).toLowerCase()) : day.dayName.substring(0, 3);

    const isRest = day.activity === 'Rest' || day.activity === 'Rust' ||
                   (!day.duration && !day.estimatedTSS) ||
                   (day.duration === 0 && day.estimatedTSS === 0);

    if (isRest) {
      section += `${dayAbbrev}: ${isNL ? 'Rust' : 'Rest'}\n`;
    } else {
      const workoutName = day.workoutType || day.activity;
      const isKeyWorkout = weeklyPlan.keyWorkouts?.some(function(kw) {
        return kw.toLowerCase().includes(day.dayName.toLowerCase());
      });
      const marker = isKeyWorkout ? ' *' : '';
      section += `${dayAbbrev}: ${workoutName} (${day.duration}min, ~${day.estimatedTSS} TSS)${marker}\n`;

      // Add brief description if available
      if (day.description) {
        section += `    ${day.description}\n`;
      }
    }
  }

  // Key workouts explanation
  if (weeklyPlan.keyWorkouts && weeklyPlan.keyWorkouts.length > 0) {
    section += '\n';
    section += isNL ? 'Key workout(s):\n' : 'Key workout(s):\n';
    for (const kw of weeklyPlan.keyWorkouts.slice(0, 2)) {
      section += `- ${kw}\n`;
    }
  }

  // Rationale based on phase
  section += '\n';
  if (weeklyPlan.weeklyFocus) {
    section += isNL ? `Focus deze week: ${weeklyPlan.weeklyFocus}\n` : `This week's focus: ${weeklyPlan.weeklyFocus}\n`;
  }

  // Calendar sync
  if (calendarResults && calendarResults.created > 0) {
    section += isNL
      ? `\n${calendarResults.created} workout${calendarResults.created > 1 ? 's' : ''} toegevoegd aan Intervals.icu calendar.\n`
      : `\n${calendarResults.created} workout${calendarResults.created > 1 ? 's' : ''} added to Intervals.icu calendar.\n`;
  }

  section += '\n';
  return section;
}

// =========================================================
// MONTHLY PROGRESS EMAIL
// =========================================================

/**
 * Fetch monthly progress data for a specific calendar month
 * @param {number} monthOffset - 0 = previous month, 1 = month before that
 * @returns {object} Monthly progress data
 */
function fetchMonthlyProgressData(monthOffset = 0) {
  const today = new Date();
  const targetMonth = new Date(today.getFullYear(), today.getMonth() - 1 - monthOffset, 1);
  const monthStart = new Date(targetMonth.getFullYear(), targetMonth.getMonth(), 1);
  const monthEnd = new Date(targetMonth.getFullYear(), targetMonth.getMonth() + 1, 0);

  const weeklyData = [];
  const numWeeks = Math.ceil((monthEnd.getDate() - monthStart.getDate() + 1) / 7);

  for (let w = 0; w < numWeeks; w++) {
    const weekStart = new Date(monthStart);
    weekStart.setDate(monthStart.getDate() + (w * 7));
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);

    if (weekEnd > monthEnd) {
      weekEnd.setTime(monthEnd.getTime());
    }

    const daysInPeriod = Math.ceil((weekEnd - weekStart) / (1000 * 60 * 60 * 24)) + 1;
    const daysOffset = Math.ceil((today - weekEnd) / (1000 * 60 * 60 * 24));
    const activities = fetchWeeklyActivities(daysInPeriod, daysOffset);
    const fitnessMetrics = fetchFitnessMetrics(weekEnd);

    weeklyData.push({
      weekNumber: w + 1,
      weekEnd: formatDateISO(weekEnd),
      weekStart: formatDateISO(weekStart),
      activities: activities.totalActivities,
      rides: activities.rides,
      runs: activities.runs,
      totalTime: activities.totalTime,
      totalTss: activities.totalTss,
      totalDistance: activities.totalDistance,
      ctl: fitnessMetrics.ctl,
      atl: fitnessMetrics.atl,
      tsb: fitnessMetrics.tsb,
      eftp: fitnessMetrics.eftp
    });
  }

  // Aggregates
  const totalActivities = weeklyData.reduce((sum, w) => sum + w.activities, 0);
  const totalTss = weeklyData.reduce((sum, w) => sum + w.totalTss, 0);
  const totalTime = weeklyData.reduce((sum, w) => sum + w.totalTime, 0);
  const weeksWithTraining = weeklyData.filter(w => w.activities > 0).length;

  const ctlStart = weeklyData[0].ctl;
  const ctlEnd = weeklyData[weeklyData.length - 1].ctl;
  const ctlChange = ctlEnd - ctlStart;

  const eftpValues = weeklyData.map(w => w.eftp).filter(e => e != null);
  const eftpStart = eftpValues.length > 0 ? eftpValues[0] : null;
  const eftpEnd = eftpValues.length > 0 ? eftpValues[eftpValues.length - 1] : null;
  const eftpChange = (eftpStart && eftpEnd) ? eftpEnd - eftpStart : null;

  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
                      'July', 'August', 'September', 'October', 'November', 'December'];

  return {
    weeks: numWeeks,
    monthName: monthNames[monthStart.getMonth()],
    monthYear: monthStart.getFullYear(),
    periodStart: formatDateISO(monthStart),
    periodEnd: formatDateISO(monthEnd),
    weeklyData: weeklyData,
    totals: {
      activities: totalActivities,
      tss: totalTss,
      time: totalTime,
      avgWeeklyTss: totalTss / numWeeks,
      avgWeeklyTime: totalTime / numWeeks
    },
    fitness: {
      ctlStart: ctlStart,
      ctlEnd: ctlEnd,
      ctlChange: ctlChange,
      eftpStart: eftpStart,
      eftpEnd: eftpEnd,
      eftpChange: eftpChange
    },
    consistency: {
      weeksWithTraining: weeksWithTraining,
      consistencyPercent: Math.round((weeksWithTraining / numWeeks) * 100)
    }
  };
}

/**
 * Send monthly progress report email
 * Set up a monthly trigger (e.g., 1st of each month) to call this function
 */
function sendMonthlyProgressEmail() {
  requireValidConfig();

  const t = getTranslations();
  const lang = USER_SETTINGS.LANGUAGE || 'en';
  const isNL = lang === 'nl';

  const currentMonth = fetchMonthlyProgressData(0);
  const previousMonth = fetchMonthlyProgressData(1);

  const goals = fetchUpcomingGoals();
  const phaseInfo = goals?.available && goals?.primaryGoal
    ? calculateTrainingPhase(goals.primaryGoal.date)
    : calculateTrainingPhase(USER_SETTINGS.TARGET_DATE);

  const aiInsight = generateMonthlyInsight(currentMonth, previousMonth, phaseInfo, goals);

  // Fetch zone progression for monthly review
  Logger.log("Fetching zone progression for monthly review...");
  const zoneProgression = getZoneProgression(true); // Force recalculate for fresh data
  let zoneRecommendations = null;

  if (zoneProgression && zoneProgression.available) {
    Logger.log("Zone progression available, generating recommendations...");
    zoneRecommendations = getZoneRecommendations(zoneProgression, phaseInfo, goals);
    addZoneProgressionToHistory(zoneProgression);
  }

  const subject = t.monthly_subject + " (" + currentMonth.monthName + " " + currentMonth.monthYear + ")";

  let body = `${t.monthly_greeting}\n\n`;

  // AI insight as opening narrative
  if (aiInsight) {
    body += `${aiInsight}\n\n`;
  }

  // Month header
  body += `${currentMonth.monthName} ${currentMonth.monthYear}\n`;
  body += `${currentMonth.periodStart} - ${currentMonth.periodEnd}\n\n`;

  // ============ TRAINING VOLUME ============
  body += isNL ? 'TRAININGSVOLUME\n\n' : 'TRAINING VOLUME\n\n';

  const activityChange = currentMonth.totals.activities - previousMonth.totals.activities;
  const tssChange = currentMonth.totals.tss - previousMonth.totals.tss;
  const timeChange = currentMonth.totals.time - previousMonth.totals.time;

  const formatDiff = function(val, suffix) {
    if (val == null || val === 0) return '';
    const sign = val > 0 ? '+' : '';
    return ` (${sign}${Math.round(val)}${suffix || ''})`;
  };

  body += isNL ? 'Deze maand vs vorige maand:\n' : 'This month vs previous:\n';
  body += `- ${currentMonth.totals.activities} ${isNL ? 'sessies' : 'sessions'}${formatDiff(activityChange)}\n`;
  body += `- ${currentMonth.totals.tss.toFixed(0)} ${isNL ? 'totaal' : 'total'} TSS${formatDiff(tssChange)}\n`;
  body += `- ${formatDuration(currentMonth.totals.time)} ${isNL ? 'totaal' : 'total'}${formatDiff(Math.round(timeChange / 60), 'min')}\n`;
  body += `- ${isNL ? 'Gem.' : 'Avg'} ${currentMonth.totals.avgWeeklyTss.toFixed(0)} TSS/${isNL ? 'week' : 'week'}\n`;
  body += `- ${isNL ? 'Gem.' : 'Avg'} ${formatDuration(currentMonth.totals.avgWeeklyTime)}/${isNL ? 'week' : 'week'}\n`;

  // Weekly breakdown
  body += '\n';
  body += isNL ? 'Per week:\n' : 'By week:\n';
  for (let i = 0; i < currentMonth.weeklyData.length; i++) {
    const w = currentMonth.weeklyData[i];
    body += `  W${i + 1}: ${w.totalTss.toFixed(0)} TSS, ${w.activities} ${isNL ? 'sessies' : 'sessions'}\n`;
  }

  // ============ FITNESS PROGRESSION ============
  body += '\n';
  body += isNL ? 'FITNESS PROGRESSIE\n\n' : 'FITNESS PROGRESSION\n\n';

  const ctlChange = currentMonth.fitness.ctlEnd - previousMonth.fitness.ctlEnd;
  const ctlDirection = ctlChange > 2 ? (isNL ? 'gestegen' : 'increased')
                     : ctlChange < -2 ? (isNL ? 'gedaald' : 'decreased')
                     : (isNL ? 'stabiel' : 'stable');

  body += `CTL: ${currentMonth.fitness.ctlStart.toFixed(1)} -> ${currentMonth.fitness.ctlEnd.toFixed(1)} (${ctlDirection}${formatDiff(ctlChange)})\n`;

  // Weekly CTL trend
  body += isNL ? 'CTL per week: ' : 'CTL by week: ';
  body += currentMonth.weeklyData.map((w, i) => `W${i + 1}:${w.ctl.toFixed(0)}`).join(' | ') + '\n';

  // eFTP Trend if available
  if (currentMonth.fitness.eftpStart && currentMonth.fitness.eftpEnd) {
    const eftpChange = currentMonth.fitness.eftpEnd - previousMonth.fitness.eftpEnd;
    const eftpDirection = eftpChange > 0 ? (isNL ? 'gestegen' : 'increased')
                        : eftpChange < 0 ? (isNL ? 'gedaald' : 'decreased')
                        : (isNL ? 'stabiel' : 'stable');

    body += `\neFTP: ${currentMonth.fitness.eftpStart}W -> ${currentMonth.fitness.eftpEnd}W (${eftpDirection}${formatDiff(eftpChange, 'W')})\n`;
    body += isNL ? 'eFTP per week: ' : 'eFTP by week: ';
    body += currentMonth.weeklyData.map((w, i) => `W${i + 1}:${w.eftp || '-'}`).join(' | ') + '\n';
  }

  // Interpretation
  body += '\n';
  if (ctlChange > 5) {
    body += isNL
      ? 'Sterke fitness opbouw deze maand. Goed werk!\n'
      : 'Strong fitness build this month. Good work!\n';
  } else if (ctlChange > 0) {
    body += isNL
      ? 'Geleidelijke fitness opbouw. Blijf consistent.\n'
      : 'Gradual fitness build. Stay consistent.\n';
  } else if (ctlChange > -3) {
    body += isNL
      ? 'Fitness stabiel gehouden. Goede onderhoudsfase.\n'
      : 'Fitness maintained. Good maintenance phase.\n';
  } else {
    body += isNL
      ? 'Fitness gedaald. Controleer of dit gepland was (rust/herstel).\n'
      : 'Fitness decreased. Check if this was planned (rest/recovery).\n';
  }

  // ============ CONSISTENCY ============
  body += '\n';
  body += isNL ? 'CONSISTENTIE\n\n' : 'CONSISTENCY\n\n';

  const consistency = currentMonth.consistency.consistencyPercent;
  body += `${currentMonth.consistency.weeksWithTraining}/${currentMonth.weeks} ${isNL ? 'weken met training' : 'weeks with training'} (${consistency}%)\n`;

  if (consistency >= 90) {
    body += isNL ? 'Uitstekende consistentie!\n' : 'Excellent consistency!\n';
  } else if (consistency >= 75) {
    body += isNL ? 'Goede consistentie.\n' : 'Good consistency.\n';
  } else if (consistency >= 50) {
    body += isNL ? 'Matige consistentie. Probeer regelmatiger te trainen.\n' : 'Moderate consistency. Try to train more regularly.\n';
  } else {
    body += isNL ? 'Lage consistentie. Overweeg je planning aan te passen.\n' : 'Low consistency. Consider adjusting your schedule.\n';
  }

  // ============ ZONE PROGRESSION ============
  if (zoneProgression && zoneProgression.available) {
    body += buildZoneProgressionSection(zoneProgression, isNL, true); // true = monthly (more detail)

    // AI recommendations if available
    if (zoneRecommendations?.summary) {
      body += zoneRecommendations.summary + '\n\n';
    }
  }

  // ============ GOAL STATUS ============
  if (goals?.available && goals?.primaryGoal) {
    body += '\n';
    body += isNL ? 'DOEL STATUS\n\n' : 'GOAL STATUS\n\n';

    const goal = goals.primaryGoal;
    body += `${goal.name}\n`;
    body += `${goal.date}\n\n`;

    body += isNL
      ? `Fase: ${phaseInfo.phaseName}\n`
      : `Phase: ${phaseInfo.phaseName}\n`;
    body += isNL
      ? `Nog ${phaseInfo.weeksOut} weken tot het evenement\n`
      : `${phaseInfo.weeksOut} weeks until event\n`;

    if (phaseInfo.focus) {
      body += isNL ? `\nFocus: ${phaseInfo.focus}\n` : `\nFocus: ${phaseInfo.focus}\n`;
    }

    // Fitness status relative to goal
    const currentCtl = currentMonth.fitness.ctlEnd;
    body += '\n';
    body += isNL
      ? `Huidige fitness: CTL ${currentCtl.toFixed(0)}\n`
      : `Current fitness: CTL ${currentCtl.toFixed(0)}\n`;

    // Rough recommendation based on phase
    if (phaseInfo.phaseName.toLowerCase().includes('base')) {
      body += isNL
        ? 'Advies: Focus op volume en aerobe basis. Bouw geleidelijk op.\n'
        : 'Advice: Focus on volume and aerobic base. Build gradually.\n';
    } else if (phaseInfo.phaseName.toLowerCase().includes('build')) {
      body += isNL
        ? 'Advies: Verhoog intensiteit, behoud volume. Key workouts worden belangrijker.\n'
        : 'Advice: Increase intensity, maintain volume. Key workouts become more important.\n';
    } else if (phaseInfo.phaseName.toLowerCase().includes('peak') || phaseInfo.phaseName.toLowerCase().includes('taper')) {
      body += isNL
        ? 'Advies: Verminder volume, behoud intensiteit. Focus op herstel.\n'
        : 'Advice: Reduce volume, maintain intensity. Focus on recovery.\n';
    }
  }

  // ============ LOOKING AHEAD - NEXT MONTH ============
  body += '\n';
  body += isNL ? 'KOMENDE MAAND\n\n' : 'NEXT MONTH\n\n';

  const avgWeeklyTss = currentMonth.totals.avgWeeklyTss;
  const ctlGain = currentMonth.fitness.ctlChange;
  const currentCtl = currentMonth.fitness.ctlEnd;

  // Volume targets
  if (isNL) {
    body += 'Volume doelen:\n';
    if (ctlGain > 0 && avgWeeklyTss > 200) {
      const targetTss = Math.round(avgWeeklyTss * 1.05);
      body += `- Weekdoel: ${targetTss} TSS/week (5% verhoging)\n`;
      body += `- Maanddoel: ${targetTss * 4} TSS totaal\n`;
    } else if (avgWeeklyTss < 150) {
      const targetTss = Math.round(avgWeeklyTss * 1.15);
      body += `- Weekdoel: ${targetTss} TSS/week (15% verhoging mogelijk)\n`;
      body += `- Focus op meer trainingsdagen\n`;
    } else {
      const targetTss = Math.round(avgWeeklyTss * 1.0);
      body += `- Weekdoel: ${targetTss} TSS/week (behouden)\n`;
      body += `- Focus op kwaliteit boven kwantiteit\n`;
    }
  } else {
    body += 'Volume targets:\n';
    if (ctlGain > 0 && avgWeeklyTss > 200) {
      const targetTss = Math.round(avgWeeklyTss * 1.05);
      body += `- Weekly target: ${targetTss} TSS/week (5% increase)\n`;
      body += `- Monthly target: ${targetTss * 4} TSS total\n`;
    } else if (avgWeeklyTss < 150) {
      const targetTss = Math.round(avgWeeklyTss * 1.15);
      body += `- Weekly target: ${targetTss} TSS/week (15% increase possible)\n`;
      body += `- Focus on more training days\n`;
    } else {
      const targetTss = Math.round(avgWeeklyTss * 1.0);
      body += `- Weekly target: ${targetTss} TSS/week (maintain)\n`;
      body += `- Focus on quality over quantity\n`;
    }
  }

  // CTL projection
  body += '\n';
  const projectedCtlGain = avgWeeklyTss > 200 ? 3 : avgWeeklyTss > 100 ? 2 : 1;
  const projectedCtl = Math.round(currentCtl + projectedCtlGain * 4);
  body += isNL
    ? `Fitness projectie: CTL ${currentCtl.toFixed(0)} -> ~${projectedCtl} (bij consistent trainen)\n`
    : `Fitness projection: CTL ${currentCtl.toFixed(0)} -> ~${projectedCtl} (with consistent training)\n`;

  // Zone focus recommendations
  body += '\n';
  if (zoneProgression?.available) {
    const focusZones = zoneProgression.focusAreas || [];
    const zoneNamesNL = { endurance: 'duurvermogen', tempo: 'tempo', threshold: 'drempel', vo2max: 'VO2max', anaerobic: 'anaeroob' };
    const zoneNamesEN = { endurance: 'endurance', tempo: 'tempo', threshold: 'threshold', vo2max: 'VO2max', anaerobic: 'anaerobic' };

    if (focusZones.length > 0) {
      const zoneNames = isNL ? zoneNamesNL : zoneNamesEN;
      body += isNL ? 'Zone focus:\n' : 'Zone focus:\n';
      body += isNL
        ? `- Prioriteit: ${focusZones.map(z => zoneNames[z]).join(', ')}\n`
        : `- Priority: ${focusZones.map(z => zoneNames[z]).join(', ')}\n`;

      // Specific recommendations per focus zone
      for (const zone of focusZones.slice(0, 2)) {
        if (zone === 'endurance') {
          body += isNL
            ? `- Duurvermogen: 1-2 langere Z2 ritten per week\n`
            : `- Endurance: 1-2 longer Z2 rides per week\n`;
        } else if (zone === 'threshold') {
          body += isNL
            ? `- Drempel: 1x per week Sweet Spot of FTP intervals\n`
            : `- Threshold: 1x per week Sweet Spot or FTP intervals\n`;
        } else if (zone === 'vo2max') {
          body += isNL
            ? `- VO2max: 1x per week korte, harde intervals (3-5min)\n`
            : `- VO2max: 1x per week short, hard intervals (3-5min)\n`;
        } else if (zone === 'tempo') {
          body += isNL
            ? `- Tempo: meer Z3 werk in langere ritten\n`
            : `- Tempo: more Z3 work in longer rides\n`;
        }
      }
    }
  }

  // Phase-specific monthly guidance
  body += '\n';
  const phaseName = phaseInfo.phaseName.toLowerCase();
  if (isNL) {
    body += 'Fase advies:\n';
    if (phaseName.includes('base')) {
      body += '- Bouw volume geleidelijk op (max 10% per week)\n';
      body += '- Houd 80% van de training in Z2\n';
      body += '- 1-2 korte tempo/SS sessies per week is voldoende\n';
    } else if (phaseName.includes('build')) {
      body += '- Behoud volume, verhoog intensiteit\n';
      body += '- 2-3 key workouts per week\n';
      body += '- Zorg voor voldoende herstel tussen harde sessies\n';
    } else if (phaseName.includes('peak') || phaseName.includes('taper')) {
      body += '- Verminder volume met 30-40%\n';
      body += '- Behoud 1-2 scherpe sessies per week\n';
      body += '- Prioriteit: slaap en herstel\n';
    } else {
      body += '- Focus op consistentie\n';
      body += '- Varieer trainingsvormen\n';
      body += '- Luister naar je lichaam\n';
    }
  } else {
    body += 'Phase guidance:\n';
    if (phaseName.includes('base')) {
      body += '- Build volume gradually (max 10% per week)\n';
      body += '- Keep 80% of training in Z2\n';
      body += '- 1-2 short tempo/SS sessions per week is enough\n';
    } else if (phaseName.includes('build')) {
      body += '- Maintain volume, increase intensity\n';
      body += '- 2-3 key workouts per week\n';
      body += '- Ensure adequate recovery between hard sessions\n';
    } else if (phaseName.includes('peak') || phaseName.includes('taper')) {
      body += '- Reduce volume by 30-40%\n';
      body += '- Maintain 1-2 sharp sessions per week\n';
      body += '- Priority: sleep and recovery\n';
    } else {
      body += '- Focus on consistency\n';
      body += '- Vary training types\n';
      body += '- Listen to your body\n';
    }
  }

  // Monthly milestones
  if (goals?.available && goals?.primaryGoal && phaseInfo.weeksOut > 0) {
    body += '\n';
    body += isNL ? 'Mijlpalen:\n' : 'Milestones:\n';
    const weeksNextMonth = Math.min(4, phaseInfo.weeksOut);
    body += isNL
      ? `- Nog ${phaseInfo.weeksOut} weken tot ${goals.primaryGoal.name}\n`
      : `- ${phaseInfo.weeksOut} weeks until ${goals.primaryGoal.name}\n`;

    if (phaseInfo.weeksOut <= 4) {
      body += isNL
        ? `- Dit is de laatste maand voor je evenement!\n`
        : `- This is the final month before your event!\n`;
    } else if (phaseInfo.weeksOut <= 8) {
      body += isNL
        ? `- Specifieke voorbereiding begint deze maand\n`
        : `- Specific preparation begins this month\n`;
    }
  }

  // Four-Week Outlook
  try {
    const fitnessMetrics = fetchFitnessMetrics();
    const deloadCheck = checkDeloadNeeded(fitnessMetrics.ctl, fitnessMetrics.tsb, fitnessMetrics.rampRate, null);
    const fourWeekOutlook = generateFourWeekOutlook(fitnessMetrics, phaseInfo, zoneProgression, deloadCheck);

    if (fourWeekOutlook) {
      body += formatFourWeekOutlookSection(fourWeekOutlook, isNL);

      // Create week labels in Intervals.icu calendar
      const labelResults = createWeekLabelEvents(fourWeekOutlook);
      if (labelResults.created > 0) {
        Logger.log(`Created ${labelResults.created} week label events in Intervals.icu`);
      }
    }
  } catch (e) {
    Logger.log("Four-week outlook failed (non-critical): " + e.toString());
  }

  body += '\n- IntervalCoach\n';

  GmailApp.sendEmail(USER_SETTINGS.EMAIL_TO, subject, body, { name: "IntervalCoach" });
  Logger.log("Monthly progress report sent successfully.");
}

// =========================================================
// POST-WORKOUT ANALYSIS EMAIL
// =========================================================

/**
 * Send post-workout AI analysis email with engaging format
 * @param {object} activity - Completed activity
 * @param {object} analysis - AI analysis results
 * @param {object} wellness - Current wellness data
 * @param {object} fitness - Current fitness metrics
 * @param {object} powerProfile - Power profile (null for runs)
 * @param {object} runningData - Running data (null for cycling)
 * @param {object} context - Additional context { goals, phaseInfo, weekProgress, recentHistory }
 */
function sendPostWorkoutAnalysisEmail(activity, analysis, wellness, fitness, powerProfile, runningData, context) {
  const t = getTranslations();
  const lang = USER_SETTINGS.LANGUAGE || 'en';
  const isNL = lang === 'nl';
  const isRun = activity.type === "Run" || activity.type === "VirtualRun";
  const isCycling = activity.type === "Ride" || activity.type === "VirtualRide";
  context = context || {};

  // Generate subject line
  const dateStr = Utilities.formatDate(new Date(activity.start_date_local), SYSTEM_SETTINGS.TIMEZONE, "MM/dd HH:mm");
  const subject = `[IntervalCoach] ${activity.name} - ${analysis.effectiveness}/10 (${dateStr})`;

  // Build engaging opening based on context
  const opening = buildEngagingOpening(activity, analysis, wellness, fitness, context, isNL);

  // Activity summary line
  const duration = Math.round(activity.moving_time / 60);
  const tss = activity.icu_training_load;
  const intensity = activity.icu_intensity ? (activity.icu_intensity / 100).toFixed(2) : null;
  const activityType = isCycling ? (isNL ? 'rit' : 'ride') : isRun ? (isNL ? 'loop' : 'run') : (isNL ? 'sessie' : 'session');

  // Build flowing narrative - Whoop style
  let body = opening;

  // Weave in the activity details naturally
  body += isNL
    ? ` Deze ${activityType} van ${duration} minuten leverde ${tss} TSS op${intensity ? ` met een IF van ${intensity}` : ''}.`
    : ` This ${duration}-minute ${activityType} delivered ${tss} TSS${intensity ? ` at IF ${intensity}` : ''}.`;

  // RPE inline if available
  if (activity.icu_rpe) {
    body += isNL
      ? ` Je gaf het een RPE van ${activity.icu_rpe}/10${activity.feel ? ` en voelde je ${getFeelLabel(activity.feel).toLowerCase()}` : ''}.`
      : ` You rated it RPE ${activity.icu_rpe}/10${activity.feel ? ` and felt ${getFeelLabel(activity.feel).toLowerCase()}` : ''}.`;
  }

  body += `\n`;

  // Key Insight flows naturally as next paragraph
  body += `\n${analysis.keyInsight}\n`;

  // Analysis woven into narrative (no section header)
  body += `\n`;
  if (analysis.effectiveness >= 8) {
    body += isNL
      ? `Met een effectiviteit van ${analysis.effectiveness}/10 was dit precies wat je nodig had: ${analysis.effectivenessReason.toLowerCase()}`
      : `At ${analysis.effectiveness}/10 effectiveness, this was exactly what you needed: ${analysis.effectivenessReason.toLowerCase()}`;
  } else if (analysis.effectiveness >= 6) {
    body += isNL
      ? `Effectiviteit ${analysis.effectiveness}/10 — ${analysis.effectivenessReason}`
      : `Effectiveness ${analysis.effectiveness}/10 — ${analysis.effectivenessReason}`;
  } else {
    body += isNL
      ? `De effectiviteit van ${analysis.effectiveness}/10 laat zien dat er ruimte voor verbetering is: ${analysis.effectivenessReason}`
      : `The ${analysis.effectiveness}/10 effectiveness shows room for improvement: ${analysis.effectivenessReason}`;
  }

  // Difficulty match woven in
  const difficultyLabel = analysis.difficultyMatch.replace(/_/g, ' ');
  if (difficultyLabel === 'perfect') {
    body += isNL
      ? ` De moeilijkheidsgraad was precies goed afgestemd op je conditie.`
      : ` The difficulty was perfectly matched to your current fitness.`;
  } else if (difficultyLabel.includes('too hard')) {
    body += isNL
      ? ` De workout was wat aan de zware kant — ${analysis.difficultyReason}`
      : ` The workout leaned hard — ${analysis.difficultyReason}`;
  } else if (difficultyLabel.includes('too easy')) {
    body += isNL
      ? ` Je had waarschijnlijk meer in de tank — ${analysis.difficultyReason}`
      : ` You likely had more in the tank — ${analysis.difficultyReason}`;
  }

  // Stimulus as flowing sentence (translate quality terms for Dutch)
  const stimulusType = analysis.workoutStimulus.toLowerCase();
  let stimulusQuality = analysis.stimulusQuality.toLowerCase();
  if (isNL) {
    // Translate common quality terms
    const qualityTranslations = {
      'excellent': 'uitstekend', 'good': 'goed', 'adequate': 'voldoende',
      'poor': 'matig', 'insufficient': 'onvoldoende', 'optimal': 'optimaal'
    };
    stimulusQuality = qualityTranslations[stimulusQuality] || stimulusQuality;
  }
  body += isNL
    ? ` De ${stimulusType} stimulus was ${stimulusQuality}.\n`
    : ` The ${stimulusType} stimulus was ${stimulusQuality}.\n`;

  // Highlights woven in naturally (no header)
  if (analysis.performanceHighlights && analysis.performanceHighlights.length > 0) {
    body += `\n`;
    if (analysis.performanceHighlights.length === 1) {
      body += isNL
        ? `Opvallend: ${analysis.performanceHighlights[0]}`
        : `Notable: ${analysis.performanceHighlights[0]}`;
    } else {
      // Join highlights with proper sentence endings
      const highlights = analysis.performanceHighlights.map(h =>
        h.endsWith('.') ? h.slice(0, -1) : h
      );
      body += highlights.join('. ') + '.';
    }
    body += `\n`;
  }

  // Historical Comparison - inline, no header
  if (context.recentHistory && context.recentHistory.available) {
    body += buildHistoricalComparison(activity, context.recentHistory, isCycling, isRun, isNL);
  }

  // Week Progress + Looking Ahead combined (has its own header)
  body += buildProgressAndOutlookSection(context.weekProgress, analysis, fitness, context, isNL);

  // Compact Stats at bottom - single line divider
  body += `\n--\n`;
  body += `CTL ${fitness.ctl ? fitness.ctl.toFixed(1) : '-'} | ATL ${fitness.atl ? fitness.atl.toFixed(1) : '-'} | TSB ${fitness.tsb ? fitness.tsb.toFixed(1) : '-'}`;

  if (!isRun && powerProfile && powerProfile.available) {
    const currentEftp = powerProfile.currentEftp || powerProfile.eFTP;
    body += ` | eFTP ${currentEftp}W`;
  } else if (isRun && runningData && runningData.available) {
    body += isNL ? ` | CS ${runningData.criticalSpeed || '-'}/km` : ` | CS ${runningData.criticalSpeed || '-'}/km`;
  }

  body += `\n\n- IntervalCoach\n`;

  try {
    Logger.log("Email subject: " + subject);
    Logger.log("Email body length: " + body.length + " chars");
    GmailApp.sendEmail(USER_SETTINGS.EMAIL_TO, subject, body, { name: "IntervalCoach" });
    Logger.log("Post-workout analysis email sent successfully.");
  } catch (e) {
    Logger.log("ERROR sending email: " + e.toString());
    Logger.log("Email body preview: " + body.substring(0, 500));
    throw e;
  }
}

/**
 * Build engaging opening based on workout context
 */
function buildEngagingOpening(activity, analysis, wellness, fitness, context, isNL) {
  const effectiveness = analysis.effectiveness || 5;
  const recoveryStatus = wellness?.recoveryStatus?.toLowerCase() || 'unknown';
  const tsb = fitness?.tsb || 0;

  let opening = "";

  // Recovery + performance combo
  if (recoveryStatus === 'green' || recoveryStatus.includes('primed')) {
    if (effectiveness >= 8) {
      opening = isNL
        ? "Je kwam uitgerust aan de start en hebt dat uitstekend benut."
        : "You brought a fresh system into this session and made it count—excellent execution.";
    } else if (effectiveness >= 6) {
      opening = isNL
        ? "Goed herstel vandaag en dat heb je goed gebruikt—solide sessie."
        : "Good recovery today and you used it well—solid session in the books.";
    } else {
      opening = isNL
        ? "Je kwam fris aan, maar de workout viel wat tegen—laten we kijken waarom."
        : "You came in fresh but the workout didn't quite land as planned—let's look at why.";
    }
  } else if (recoveryStatus === 'yellow' || recoveryStatus.includes('amber')) {
    if (effectiveness >= 7) {
      opening = isNL
        ? "Ondanks matig herstel heb je een kwalitatieve sessie neergezet—slim getraind."
        : "Despite moderate recovery, you delivered a quality session—smart pacing paid off.";
    } else {
      opening = isNL
        ? "Je lichaam gaf vermoeidheidssignalen af en dat was merkbaar in de workout."
        : "Your body was showing some fatigue signals, and the workout reflected that—good awareness.";
    }
  } else if (recoveryStatus === 'red') {
    if (effectiveness >= 6) {
      opening = isNL
        ? "Lastige dag om te trainen, maar je hebt er toch iets productiefs van gemaakt."
        : "Tough day to train, but you managed to get something productive done—respect for showing up.";
    } else {
      opening = isNL
        ? "Herstel was niet optimaal en dat was merkbaar—morgen is er weer een dag."
        : "Recovery was compromised and it showed in the session—tomorrow is another day.";
    }
  } else {
    if (effectiveness >= 8) {
      opening = isNL
        ? "Sterke sessie vandaag—dit is het werk dat fitness bouwt."
        : "Strong session today—this is the kind of work that builds fitness.";
    } else if (effectiveness >= 6) {
      opening = isNL
        ? "Solide werk vandaag—weer een bouwsteen voor je conditie."
        : "Solid work today—another brick in the wall of your fitness foundation.";
    } else {
      opening = isNL
        ? "Sessie voltooid—laten we kijken wat we hiervan kunnen leren."
        : "Session complete—let's see what we can learn from this one.";
    }
  }

  // Add TSB context if interesting
  if (tsb < -20) {
    opening += isNL
      ? " Je draagt behoorlijk wat vermoeidheid met je mee, dus elke kwaliteitssessie telt extra."
      : " You're carrying significant fatigue right now, so every quality session counts extra.";
  } else if (tsb > 10) {
    opening += isNL
      ? " Je bent goed uitgerust en dat was merkbaar."
      : " You're well-rested and it showed in your output.";
  }

  // Add phase context if available
  if (context.phaseInfo && context.phaseInfo.weeksOut && context.phaseInfo.weeksOut <= 4) {
    opening += isNL
      ? ` Met nog ${context.phaseInfo.weeksOut} weken tot je doel, werkt elke sessie toe naar je piek.`
      : ` With ${context.phaseInfo.weeksOut} weeks to your goal, every session is dialing in your peak.`;
  }

  return opening;
}

/**
 * Build historical comparison - inline text
 */
function buildHistoricalComparison(activity, history, isCycling, isRun, isNL) {
  const tss = activity.icu_training_load || 0;
  const duration = Math.round((activity.moving_time || 0) / 60);

  let avgTSS, avgDuration, count;
  if (isCycling && history.cyclingCount > 0) {
    avgTSS = history.cyclingAvgTSS;
    avgDuration = history.cyclingAvgDuration;
    count = history.cyclingCount;
  } else if (isRun && history.runningCount > 0) {
    avgTSS = history.runningAvgTSS;
    avgDuration = history.runningAvgDuration;
    count = history.runningCount;
  } else {
    avgTSS = history.avgTSS;
    avgDuration = history.avgDuration;
    count = history.totalActivities;
  }

  if (count === 0 || !avgTSS) return "";

  const tssDiff = tss - avgTSS;
  const durationDiff = duration - avgDuration;
  const actType = isCycling ? (isNL ? 'ritten' : 'rides') : isRun ? (isNL ? 'loops' : 'runs') : (isNL ? 'sessies' : 'sessions');

  let text = `\n`;
  if (Math.abs(tssDiff) <= 5) {
    text += isNL
      ? `Vergeleken met je laatste ${count} ${actType}: vergelijkbare belasting (${tss} vs gem. ${avgTSS} TSS)`
      : `Compared to your last ${count} ${actType}: similar load (${tss} vs avg ${avgTSS} TSS)`;
  } else if (tssDiff > 0) {
    text += isNL
      ? `Vergeleken met je laatste ${count} ${actType}: ${Math.abs(tssDiff)} TSS zwaarder dan gemiddeld`
      : `Compared to your last ${count} ${actType}: ${Math.abs(tssDiff)} TSS heavier than average`;
  } else {
    text += isNL
      ? `Vergeleken met je laatste ${count} ${actType}: ${Math.abs(tssDiff)} TSS lichter dan gemiddeld`
      : `Compared to your last ${count} ${actType}: ${Math.abs(tssDiff)} TSS lighter than average`;
  }

  if (Math.abs(durationDiff) > 10) {
    text += isNL
      ? (durationDiff > 0 ? `, ${Math.abs(durationDiff)} min langer` : `, ${Math.abs(durationDiff)} min korter`)
      : (durationDiff > 0 ? `, ${Math.abs(durationDiff)} min longer` : `, ${Math.abs(durationDiff)} min shorter`);
  }

  text += `.\n`;
  return text;
}

/**
 * Build combined progress and outlook section - flowing text (no header)
 */
function buildProgressAndOutlookSection(weekProgress, analysis, fitness, context, isNL) {
  let section = `\n`;

  // Week progress as flowing text
  if (weekProgress && weekProgress.totalPlannedSessions > 0) {
    const completed = weekProgress.completedSessions;
    const planned = weekProgress.totalPlannedSessions;
    const tssCompleted = weekProgress.tssCompleted;
    const tssPlanned = weekProgress.totalTssPlanned;
    const tssPercent = tssPlanned > 0 ? Math.round((tssCompleted / tssPlanned) * 100) : 0;

    if (completed >= planned) {
      section += isNL
        ? `Je weekdoel is bereikt met ${completed}/${planned} sessies (${tssCompleted}/${tssPlanned} TSS).`
        : `Your week target is complete: ${completed}/${planned} sessions (${tssCompleted}/${tssPlanned} TSS).`;
    } else {
      section += isNL
        ? `Deze week: ${completed}/${planned} sessies gedaan (${tssCompleted}/${tssPlanned} TSS, ${tssPercent}%).`
        : `This week: ${completed}/${planned} sessions done (${tssCompleted}/${tssPlanned} TSS, ${tssPercent}%).`;
    }
  }

  // Next workout reference - creates connection to training plan
  const nextWorkout = context.nextWorkout;
  if (nextWorkout) {
    const nextName = nextWorkout.placeholderName || nextWorkout.activityType || nextWorkout.eventName;
    let nextDay = nextWorkout.dayName;
    const nextDuration = nextWorkout.duration?.min || nextWorkout.duration;
    // Don't show duration if it's already in the name
    const hasDurationInName = nextName && nextName.match(/\d+\s*min/i);

    // Translate day names for Dutch
    if (isNL && nextDay) {
      const dayTranslations = {
        'Monday': 'maandag', 'Tuesday': 'dinsdag', 'Wednesday': 'woensdag',
        'Thursday': 'donderdag', 'Friday': 'vrijdag', 'Saturday': 'zaterdag', 'Sunday': 'zondag'
      };
      nextDay = dayTranslations[nextDay] || nextDay;
    }

    if (nextName) {
      section += isNL
        ? ` Volgende: ${nextName}${nextDuration && !hasDurationInName ? ` (${nextDuration}min)` : ''} op ${nextDay}.`
        : ` Next up: ${nextName}${nextDuration && !hasDurationInName ? ` (${nextDuration}min)` : ''} on ${nextDay}.`;
    }
  }

  // Recovery advice woven in
  if (analysis.recoveryImpact) {
    const hours = analysis.recoveryImpact.estimatedRecoveryHours || 24;
    const severity = analysis.recoveryImpact.severity || 'moderate';

    if (severity === 'low' || hours <= 12) {
      section += isNL
        ? ` Lichte belasting — je kunt morgen gewoon trainen.`
        : ` Light load — you're good to go tomorrow.`;
    } else if (severity === 'moderate' || hours <= 24) {
      section += isNL
        ? ` Reken op ~${hours}u herstel voordat je weer gas geeft.`
        : ` Allow ~${hours}h before your next hard effort.`;
    } else {
      section += isNL
        ? ` Stevige sessie — morgen rustig aan doen.`
        : ` Solid session — take it easy tomorrow.`;
    }
  }

  // TSB insight woven in if notable
  const tsb = fitness?.tsb || 0;
  if (tsb < -20) {
    section += isNL
      ? ` (TSB ${tsb.toFixed(0)} — vermoeidheid stapelt zich op)`
      : ` (TSB ${tsb.toFixed(0)} — fatigue building)`;
  }

  section += `\n`;

  // Goal context as closing thought if relevant
  if (context.phaseInfo && context.goals?.available && context.goals?.primaryGoal) {
    const goal = context.goals.primaryGoal;
    const weeksOut = context.phaseInfo.weeksOut;

    if (weeksOut && weeksOut <= 12) {
      section += isNL
        ? `\nNog ${weeksOut} weken tot ${goal.name}. ${context.phaseInfo.phaseName}.\n`
        : `\n${weeksOut} weeks to ${goal.name}. ${context.phaseInfo.phaseName}.\n`;
    }
  }

  return section;
}

// =========================================================
// WORKOUT IMPACT PREVIEW SECTION
// =========================================================

/**
 * Generate the workout impact preview section for the daily email
 * Shows how today's workout affects CTL/ATL/TSB over the next 2 weeks
 * @param {object} summary - Athlete summary with CTL/ATL/TSB
 * @param {object} phaseInfo - Training phase info
 * @param {object} workout - Generated workout with type and duration
 * @returns {string} Formatted email section or empty string if unavailable
 */
function generateWorkoutImpactSection(summary, phaseInfo, workout) {
  const t = getTranslations();

  try {
    // Estimate TSS for today's workout based on type and duration
    const estimatedTSS = estimateWorkoutTSS(workout);

    if (!estimatedTSS || estimatedTSS <= 0) {
      Logger.log("Impact preview skipped: Could not estimate TSS");
      return "";
    }

    // Get current fitness metrics
    const fitnessMetrics = {
      ctl: summary.ctl_90 || 0,
      atl: summary.atl || 0,
      tsb: summary.tsb_current || 0
    };

    // Generate impact preview data
    const impactData = generateWorkoutImpactPreview(estimatedTSS, fitnessMetrics, 14);

    if (!impactData || !impactData.withWorkout || impactData.withWorkout.length === 0) {
      Logger.log("Impact preview skipped: No projection data");
      return "";
    }

    // Fetch goals for context
    const goals = fetchUpcomingGoals();

    // Generate AI narrative
    const aiPreview = generateAIWorkoutImpactPreview(impactData, goals, phaseInfo);

    // Format the section
    let section = `
-----------------------------------
${t.impact_preview_title || "Workout Impact Preview"}
-----------------------------------
`;

    // AI Summary
    if (aiPreview && aiPreview.summary) {
      section += `${aiPreview.summary}\n\n`;
    }

    // Key metrics
    section += `Today's TSS: ~${estimatedTSS}
`;

    // Tomorrow's impact
    const tomorrow = impactData.withWorkout[1];
    section += `Tomorrow: CTL ${tomorrow.ctl} | TSB ${tomorrow.tsb}\n`;

    // 2-week outlook
    const endOfWeek2 = impactData.withWorkout[13];
    section += `In 2 weeks: CTL ${endOfWeek2.ctl} (+${impactData.impact.twoWeekCTLDelta.toFixed(1)})\n`;

    // Key insights
    if (aiPreview && aiPreview.keyInsights && aiPreview.keyInsights.length > 0) {
      section += "\n";
      for (var i = 0; i < aiPreview.keyInsights.length && i < 2; i++) {
        section += "• " + aiPreview.keyInsights[i] + "\n";
      }
    }

    // AI narrative
    if (aiPreview && aiPreview.narrative) {
      section += "\n" + aiPreview.narrative + "\n";
    }

    // Mini projection table (next 7 days)
    section += "\n7-Day Projection:\n";
    for (var d = 0; d < 7 && d < impactData.withWorkout.length; d++) {
      var day = impactData.withWorkout[d];
      var tssIndicator = day.tss > 0 ? ("TSS:" + day.tss) : "Rest";
      section += day.dayName + " " + day.date.substring(5) + ": " + tssIndicator + " -> TSB " + day.tsb + "\n";
    }

    Logger.log("Impact preview generated" + (aiPreview.aiEnhanced ? " (AI-enhanced)" : " (fallback)"));
    return section;

  } catch (e) {
    Logger.log("Error generating impact preview: " + e.toString());
    return "";
  }
}

/**
 * Estimate TSS for a workout based on type and duration
 * Uses typical intensity factors for different workout types
 * @param {object} workout - Workout object with type and duration info
 * @returns {number} Estimated TSS
 */
function estimateWorkoutTSS(workout) {
  if (!workout) return 0;

  // Try to extract duration from workout
  let durationMinutes = 60; // default

  // Check for explicit duration
  if (workout.duration) {
    durationMinutes = typeof workout.duration === 'object' ? workout.duration.max : workout.duration;
  } else if (workout.durationMinutes) {
    durationMinutes = workout.durationMinutes;
  }

  // Determine intensity factor based on workout type
  const workoutType = (workout.type || "").toLowerCase();

  // TSS per minute based on workout type
  // Zone 2/Endurance: ~0.5-0.6 TSS/min (IF ~0.65-0.75)
  // Tempo/SweetSpot: ~0.7-0.8 TSS/min (IF ~0.84-0.90)
  // Threshold/VO2max: ~0.9-1.1 TSS/min (IF ~0.95-1.05)
  let tssPerMinute = 0.65; // default moderate

  if (workoutType.indexOf("recovery") !== -1 || workoutType.indexOf("z1") !== -1) {
    tssPerMinute = 0.4;
  } else if (workoutType.indexOf("endurance") !== -1 || workoutType.indexOf("z2") !== -1 || workoutType.indexOf("base") !== -1) {
    tssPerMinute = 0.55;
  } else if (workoutType.indexOf("tempo") !== -1 || workoutType.indexOf("z3") !== -1) {
    tssPerMinute = 0.72;
  } else if (workoutType.indexOf("sweetspot") !== -1 || workoutType.indexOf("sweet_spot") !== -1 || workoutType.indexOf("ss") !== -1) {
    tssPerMinute = 0.80;
  } else if (workoutType.indexOf("threshold") !== -1 || workoutType.indexOf("z4") !== -1 || workoutType.indexOf("ftp") !== -1) {
    tssPerMinute = 0.92;
  } else if (workoutType.indexOf("vo2") !== -1 || workoutType.indexOf("z5") !== -1) {
    tssPerMinute = 1.0;
  } else if (workoutType.indexOf("anaerobic") !== -1 || workoutType.indexOf("z6") !== -1 || workoutType.indexOf("sprint") !== -1) {
    tssPerMinute = 1.1;
  }

  const estimatedTSS = Math.round(durationMinutes * tssPerMinute);

  Logger.log("Estimated TSS for " + workoutType + " (" + durationMinutes + "min): " + estimatedTSS);
  return estimatedTSS;
}
