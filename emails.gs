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

function sendDailyEmail(params) {
  const t = getTranslations();
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
    taperRecommendation
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

  // === HEADER: Phase Info ===
  body += `===================================
${t.phase_title}: ${phaseInfo?.phaseName || 'Build'}
(${t.weeks_to_goal}: ${phaseInfo?.weeksOut || '?'} ${t.weeks_unit})
===================================\n`;

  // === SECTION 1: Today's Status (compact) ===
  const ctl = summary?.ctl_90 || summary?.ctl || 0;
  const tsb = summary?.tsb_current || summary?.tsb || 0;
  const recoveryStatus = wellness?.recoveryStatus || 'Unknown';

  body += `
-----------------------------------
${t.status || "Today's Status"}
-----------------------------------
${t.recovery_status}: ${recoveryStatus} | TSB: ${tsb.toFixed(1)} | CTL: ${ctl.toFixed(0)}`;

  if (wellness?.available && wellness.today) {
    const w = wellness.today;
    body += `
${t.sleep}: ${w.sleep ? w.sleep.toFixed(1) + 'h' : 'N/A'} (${wellness.sleepStatus || ''})`;
    body += ` | ${t.hrv}: ${w.hrv ? Math.round(w.hrv) : 'N/A'} ms`;
    body += ` | ${t.resting_hr}: ${w.restingHR || 'N/A'} bpm`;
    if (w.recovery != null) {
      body += `\nWhoop: ${w.recovery}%`;
    }

    // Show baseline deviation if available
    const ba = wellness.baselineAnalysis;
    if (ba?.available) {
      let deviationLine = '\n' + (t.vs_baseline || 'vs Baseline') + ': ';
      const parts = [];
      if (ba.hrvDeviation?.available) {
        const hrv = ba.hrvDeviation;
        const sign = hrv.deviationPercent >= 0 ? '+' : '';
        parts.push(`HRV ${sign}${hrv.deviationPercent.toFixed(0)}%`);
      }
      if (ba.rhrDeviation?.available) {
        const rhr = ba.rhrDeviation;
        const sign = rhr.deviationPercent >= 0 ? '+' : '';
        parts.push(`RHR ${sign}${rhr.deviationPercent.toFixed(0)}%`);
      }
      if (parts.length > 0) {
        deviationLine += parts.join(' | ');
        if (ba.overallStatus === 'warning') {
          deviationLine += ' ⚠️';
        } else if (ba.overallStatus === 'good') {
          deviationLine += ' ✓';
        }
        body += deviationLine;
      }
    }
  }
  body += '\n';

  // === SECTION 2: Today's Plan (conditional) ===
  if (type === 'workout' && workout) {
    // Workout day
    body += `
===================================
${t.recommendation_title || "TODAY'S WORKOUT"}
===================================
${t.workout_details || 'Workout'}: ${workout.type}
`;

    // Show AI selection reasoning (why this workout type was chosen)
    if (workoutSelection?.reason) {
      body += `
${t.why_this_workout || "Why This Workout"}:
${workoutSelection.reason}`;
      if (workoutSelection.varietyNote) {
        body += `\n• ${workoutSelection.varietyNote}`;
      }
      if (workoutSelection.zoneNote) {
        body += `\n• ${workoutSelection.zoneNote}`;
      }
      body += '\n';
    } else {
      // Fallback to old explanation if no AI reasoning available
      body += `
${t.strategy_title || "Workout Strategy"}:
${workout.explanation || workout.recommendationReason || ''}
`;
    }
  } else if (type === 'race_day') {
    // A/B race day - race strategy and advice
    const advice = raceDayAdvice || {};

    body += `
===================================
${t.race_day_title || "RACE DAY"}
===================================
${t.event_label || "Event"}: ${raceCategory} - ${raceName}${raceDescription ? '\n' + raceDescription : ''}

${t.readiness || "Readiness"}: ${(advice.readiness || 'unknown').toUpperCase()}
${advice.readinessNote || ''}

${t.race_strategy || "Race Strategy"}:
${advice.strategy || t.default_race_strategy || "Start conservatively, build into the race."}
`;

    if (advice.powerTargets) {
      body += `
${t.power_targets || "Power Targets"}:
• ${t.conservative || "Conservative"}: ${advice.powerTargets.conservative || 'N/A'}
• ${t.normal || "Normal"}: ${advice.powerTargets.normal || 'N/A'}
• ${t.aggressive || "Aggressive"}: ${advice.powerTargets.aggressive || 'N/A'}
`;
    }

    body += `
${t.warmup || "Warmup"}:
${advice.warmup || t.default_warmup || "15-20 min easy with 2-3 short efforts"}

${t.nutrition || "Nutrition"}:
${advice.nutrition || t.default_nutrition || "Eat familiar foods, hydrate well"}
`;

    if (advice.mentalTips && advice.mentalTips.length > 0) {
      body += `
${t.mental_tips || "Mental Tips"}:
${advice.mentalTips.map(tip => '• ' + tip).join('\n')}
`;
    }

  } else if (type === 'group_ride') {
    // C event day - group ride with unstructured training
    const eventName = params.cEventName || t.group_ride || "Group Ride";
    const eventDescription = params.cEventDescription || null;
    const advice = params.groupRideAdvice || {};

    // Intensity labels
    const intensityLabel = {
      'easy': t.intensity_easy || 'TAKE IT EASY',
      'moderate': t.intensity_moderate || 'MODERATE EFFORT',
      'hard': t.intensity_hard || 'GO ALL OUT'
    }[advice.intensity] || t.intensity_moderate || 'MODERATE EFFORT';

    body += `
===================================
${t.group_ride_title || "GROUP RIDE DAY"}
===================================
${t.event_label || "Event"}: ${eventName}${eventDescription ? '\n' + eventDescription : ''}

${t.recommended_intensity || "Recommended Intensity"}: ${intensityLabel}

${advice.advice || t.group_ride_default_advice || "Enjoy the group ride. Listen to your body and adjust effort accordingly."}

${t.tips_label || "Tips"}:
${(advice.tips || []).map(tip => '• ' + tip).join('\n') || `• ${t.group_ride_tip1 || "Stay with the group, don't burn matches early"}
• ${t.group_ride_tip2 || "Eat and drink regularly"}
• ${t.group_ride_tip3 || "Use the group for draft when you can"}`}
`;
  } else {
    // Rest day (either explicit rest or no placeholder)
    // Determine the reason for rest
    const restReason = determineRestReason(params);

    body += `
===================================
${t.rest_day_title || "REST DAY"}
===================================
${restReason.message}
`;

    if (restAssessment?.alternatives || restReason.showAlternatives) {
      body += `
${t.rest_day_alternatives || "Light alternatives"}:
${restAssessment?.alternatives || `• ${t.rest_day_walk || "Easy walk (20-30 min)"}\n• ${t.rest_day_strength || "Light mobility/stretching"}`}
`;
    }
  }

  // === SECTION 3: Week Progress ===
  if (weekProgress && weekProgress.daysAnalyzed > 0) {
    body += `
-----------------------------------
${t.weekly_overview || "Week Progress"}
-----------------------------------
`;
    // Format week progress with translations
    const wp = weekProgress;
    if (wp.missedSessions > 0) {
      body += `${t.behind_plan || "Behind plan"}: ${wp.completedSessions}/${wp.plannedSessions} ${t.sessions || "sessions"} (${wp.missedSessions} ${t.missed || "missed"})`;
    } else if (wp.extraSessions > 0) {
      body += `${t.ahead_of_plan || "Ahead of plan"}: ${wp.completedSessions} ${t.completed || "completed"} (${wp.extraSessions} ${t.extra || "extra"})`;
    } else if (wp.plannedSessions === 0) {
      body += `${wp.completedSessions} ${t.sessions_completed || "sessions completed"}`;
    } else {
      body += `${t.on_track || "On track"}: ${wp.completedSessions}/${wp.plannedSessions} ${t.sessions || "sessions"}`;
    }
    body += ` | TSS: ${wp.tssCompleted}${wp.tssPlanned > 0 ? '/' + wp.tssPlanned : ''}`;

    // Mid-week adaptation section (when plan was modified)
    if (midWeekAdaptation?.success && midWeekAdaptation?.changes?.length > 0) {
      body += `

[+] ${t.plan_adapted_title || "Plan Adapted"}:
${midWeekAdaptation.summary || 'Your remaining week has been adjusted.'}

${t.changes_made || "Changes"}:`;
      for (const change of midWeekAdaptation.changes) {
        body += `\n• ${change}`;
      }
    }
    body += '\n';
  }

  // === SECTION 3.25: Deload Recommendation ===
  if (deloadCheck?.needed) {
    const urgencyEmoji = {
      'high': '⚠️',
      'medium': '📊',
      'low': '💡'
    }[deloadCheck.urgency] || '📊';

    const urgencyLabel = {
      'high': t.deload_urgent || 'DELOAD RECOMMENDED',
      'medium': t.deload_suggested || 'Recovery Week Suggested',
      'low': t.deload_consider || 'Consider Recovery'
    }[deloadCheck.urgency] || 'Recovery Week';

    body += `
-----------------------------------
${urgencyEmoji} ${urgencyLabel}
-----------------------------------
`;

    if (deloadCheck.reason) {
      body += `${t.reason || "Reason"}: ${deloadCheck.reason}\n`;
    }

    body += `${t.weeks_without_recovery || "Weeks without recovery"}: ${deloadCheck.weeksWithoutDeload}\n`;

    // Show weekly TSS breakdown
    if (deloadCheck.weeklyBreakdown?.length > 0) {
      body += `\n${t.recent_load || "Recent load"}:\n`;
      deloadCheck.weeklyBreakdown.forEach((week, i) => {
        const marker = (i === deloadCheck.weeklyBreakdown.length - 1) ? ` <- ${t.this_week || "This week"}` : '';
        body += `  ${t.week || "Week"} ${week.weekNumber}: ${week.totalTSS} TSS (${week.activities} ${t.activities || "activities"})${marker}\n`;
      });
    }

    if (deloadCheck.recommendation) {
      body += `\n${t.recommendation || "Recommendation"}:\n${deloadCheck.recommendation}\n`;
    }
  } else if (deloadCheck?.weeksWithoutDeload >= 3) {
    // Soft reminder when approaching need for deload
    body += `
${t.deload_reminder || "Deload reminder"}: ${deloadCheck.weeksWithoutDeload} ${t.weeks_training || "weeks of training"}. ${deloadCheck.recommendation || ""}
`;
  }

  // === SECTION 3.4: Taper Timing (within 6 weeks of A race) ===
  if (taperRecommendation?.available) {
    body += formatTaperEmailSection(taperRecommendation);
  }

  // === SECTION 3.5: Race Advice (for race tomorrow or yesterday) ===
  if (raceDayAdvice && type !== 'race_day') {
    const advice = raceDayAdvice;

    if (advice.scenario === 'race_tomorrow') {
      body += `
===================================
${t.race_tomorrow_title || "RACE TOMORROW"}
===================================
${t.event_label || "Event"}: ${advice.category || ''} - ${advice.eventName || 'Race'}

${t.today_activity || "Today's Activity"}: ${(advice.todayActivity || 'openers').toUpperCase()}
${advice.activityDetails || ''}

${t.sleep_tips || "Sleep Tips"}:
${advice.sleepTips || t.default_sleep_tips || "Go to bed early, limit screen time"}

${t.nutrition_today || "Nutrition Today"}:
${advice.nutritionToday || t.default_nutrition_today || "Carb-rich meals, stay hydrated"}

${t.race_morning || "Race Morning"}:
${advice.nutritionTomorrow || t.default_race_morning || "Familiar breakfast 2-3h before start"}
`;

      if (advice.logisticsTips && advice.logisticsTips.length > 0) {
        body += `
${t.prep_checklist || "Prep Checklist"}:
${advice.logisticsTips.map(tip => '• ' + tip).join('\n')}
`;
      }

      if (advice.mentalTips && advice.mentalTips.length > 0) {
        body += `
${t.mental_prep || "Mental Preparation"}:
${advice.mentalTips.map(tip => '• ' + tip).join('\n')}
`;
      }

    } else if (advice.scenario === 'race_yesterday') {
      body += `
===================================
${t.post_race_title || "POST-RACE RECOVERY"}
===================================
${t.event_label || "Event"}: ${advice.category || ''} - ${advice.eventName || 'Race'} (${t.yesterday || "yesterday"})

${t.recovery_status || "Recovery Status"}: ${(advice.recoveryStatus || 'unknown').toUpperCase()}
${advice.recoveryNote || ''}

${t.today_activity || "Today's Activity"}: ${(advice.todayActivity || 'rest').toUpperCase()}
${advice.activityDetails || ''}

${t.nutrition || "Nutrition"}:
${advice.nutrition || t.default_recovery_nutrition || "Focus on protein and carbs for recovery"}

${t.resume_training || "Resume Training"}:
${advice.resumeTraining || t.default_resume || "Light training in 2-3 days based on how you feel"}
`;

      if (advice.warningSignsToWatch && advice.warningSignsToWatch.length > 0) {
        body += `
${t.warning_signs || "Warning Signs to Watch"}:
${advice.warningSignsToWatch.map(sign => '! ' + sign).join('\n')}
`;
      }
    }
  }

  // === SECTION 4: This Week's Schedule (compact) ===
  if (upcomingDays && upcomingDays.length > 0) {
    body += `
-----------------------------------
${t.upcoming_week_title || "This Week"}
-----------------------------------
`;
    const todayStr = formatDateISO(today);

    for (const day of upcomingDays) {
      const isToday = day.date === todayStr;
      const prefix = isToday ? '> ' : '  ';
      let status = '';

      if (day.hasEvent) {
        status = `[${day.eventCategory}]${day.eventName ? ' ' + day.eventName : ''}`;
      } else if (day.activityType) {
        const duration = day.duration ? ` ${day.duration.min}min` : '';
        status = `${day.placeholderName || day.activityType}${duration}`;
      } else {
        status = '-';
      }

      body += `${prefix}${day.dayName.substring(0, 3)}: ${status}${isToday ? ` <-- ${t.today || 'Today'}` : ''}\n`;
    }
  }

  // === SECTION 5: Power Profile (for workout emails with rides) ===
  if (type === 'workout' && powerProfile?.available) {
    const currentEftp = powerProfile.currentEftp || powerProfile.eFTP;
    body += `
-----------------------------------
${t.power_profile_title}
-----------------------------------
eFTP: ${currentEftp}W${powerProfile.allTimeEftp && powerProfile.allTimeEftp > currentEftp ? ` (all-time: ${powerProfile.allTimeEftp}W)` : ''}
${t.peak_powers}: 5s=${powerProfile.peak5s}W | 1min=${powerProfile.peak1min}W | 5min=${powerProfile.peak5min}W
`;
    if (powerProfile.strengths?.length > 0) {
      body += `${t.strengths}: ${powerProfile.strengths.join(', ')}\n`;
    }
    if (powerProfile.focusAreas?.length > 0) {
      body += `${t.focus_areas}: ${powerProfile.focusAreas.join(', ')}\n`;
    }
  }

  // === FOOTER ===
  body += `
-----------------------------------
- IntervalCoach
`;

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
  const subject = t.weekly_subject + " (" + Utilities.formatDate(today, SYSTEM_SETTINGS.TIMEZONE, "MM/dd") + ")";

  let body = `${t.weekly_greeting}\n\n`;

  // --- Section 1: Coach's Brief ---
  if (aiInsight) {
    body += `===================================
${t.coach_note_title || "Coach's Brief"}
===================================
${aiInsight}

`;
  }

  // --- Section 2: Week in Cijfers (compact with diffs) ---
  body += buildWeekInCijfersSection(
    t, weekData, prevWeekData, fitnessMetrics, prevFitnessMetrics,
    wellnessSummary, prevWellnessSummary
  );

  // --- Section 3: Komende Week (compact day-by-day) ---
  if (weeklyPlan) {
    const calendarResults = createWeeklyPlanEvents(weeklyPlan);
    body += buildKomendeWeekSection(t, weeklyPlan, calendarResults);
  }

  // --- Footer ---
  body += `\n${t.weekly_footer}`;

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

  return planContext;
}

/**
 * Build compact "Week in Cijfers" section with diffs vs previous week
 */
function buildWeekInCijfersSection(t, weekData, prevWeekData, fitnessMetrics, prevFitnessMetrics, wellnessSummary, prevWellnessSummary) {
  // Calculate diffs
  const sessionsDiff = weekData.totalActivities - prevWeekData.totalActivities;
  const timeDiff = weekData.totalTime - prevWeekData.totalTime;
  const tssDiff = weekData.totalTss - prevWeekData.totalTss;

  const ctlDiff = fitnessMetrics.ctl - (prevFitnessMetrics.ctl || 0);
  const atlDiff = fitnessMetrics.atl - (prevFitnessMetrics.atl || 0);
  const tsbDiff = fitnessMetrics.tsb - (prevFitnessMetrics.tsb || 0);
  const eftpDiff = (fitnessMetrics.eftp && prevFitnessMetrics.eftp)
    ? fitnessMetrics.eftp - prevFitnessMetrics.eftp : null;

  const prevAvg = prevWellnessSummary?.available ? prevWellnessSummary.averages : {};
  const currAvg = wellnessSummary?.available ? wellnessSummary.averages : {};
  const sleepDiff = (currAvg.sleep && prevAvg.sleep) ? currAvg.sleep - prevAvg.sleep : null;
  const hrvDiff = (currAvg.hrv && prevAvg.hrv) ? currAvg.hrv - prevAvg.hrv : null;
  const recoveryDiff = (currAvg.recovery && prevAvg.recovery) ? currAvg.recovery - prevAvg.recovery : null;

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

  let section = `-----------------------------------
${t.weekly_overview || 'Week in Cijfers'} (vs ${t.previous_week || 'vorige week'})
-----------------------------------
`;

  // Line 1: Training volume
  section += `${t.sessions || 'Sessies'}: ${weekData.totalActivities}${formatDiff(sessionsDiff)}  |  `;
  section += `${t.time || 'Tijd'}: ${formatDuration(weekData.totalTime)}${formatTimeDiff(timeDiff)}  |  `;
  section += `TSS: ${weekData.totalTss.toFixed(0)}${formatDiff(tssDiff)}\n`;

  // Line 2: Fitness metrics
  section += `${t.fitness || 'Fitness'}: CTL ${fitnessMetrics.ctl.toFixed(1)}${formatDiff(ctlDiff, 1)}  |  `;
  section += `ATL ${fitnessMetrics.atl.toFixed(1)}${formatDiff(atlDiff, 1)}  |  `;
  section += `TSB ${fitnessMetrics.tsb.toFixed(1)}${formatDiff(tsbDiff, 1)}`;

  // eFTP if available
  if (fitnessMetrics.eftp) {
    section += `\neFTP: ${fitnessMetrics.eftp}W${eftpDiff != null ? formatDiff(eftpDiff) + 'W' : ''}\n`;
  } else {
    section += '\n';
  }

  // Line 3: Recovery/wellness
  if (wellnessSummary?.available) {
    section += `\n${t.recovery || 'Herstel'}: `;
    section += `${t.sleep || 'Slaap'} ${currAvg.sleep ? currAvg.sleep.toFixed(1) + 'h' : 'N/A'}${sleepDiff != null ? formatDiff(sleepDiff, 1) : ''}  |  `;
    section += `HRV ${currAvg.hrv ? currAvg.hrv.toFixed(0) + 'ms' : 'N/A'}${hrvDiff != null ? formatDiff(hrvDiff) : ''}  |  `;
    section += `${t.recovery_score || 'Recovery'} ${currAvg.recovery ? currAvg.recovery.toFixed(0) + '%' : 'N/A'}${recoveryDiff != null ? formatDiff(recoveryDiff) : ''}\n`;
  }

  section += '\n';
  return section;
}

/**
 * Build compact "Komende Week" section with day-by-day plan
 */
function buildKomendeWeekSection(t, weeklyPlan, calendarResults) {
  let section = `-----------------------------------
${t.weekly_plan_title || 'Komende Week'}
-----------------------------------
`;

  // Day by day - compact format: "Ma  Endurance · 60min · TSS ~45"
  for (const day of weeklyPlan.days) {
    const dayAbbrev = day.dayName.substring(0, 2);

    // Treat as rest if activity is Rest/Rust OR if duration/TSS are 0 or missing
    const isRest = day.activity === 'Rest' || day.activity === 'Rust' ||
                   (!day.duration && !day.estimatedTSS) ||
                   (day.duration === 0 && day.estimatedTSS === 0);

    if (isRest) {
      section += `${dayAbbrev}  ${t.rest || 'Rest'}\n`;
    } else {
      const workoutName = day.workoutType || day.activity;
      const isKeyWorkout = weeklyPlan.keyWorkouts?.some(function(kw) {
        return kw.toLowerCase().includes(day.dayName.toLowerCase());
      });
      const marker = isKeyWorkout ? ' ⭐' : '';
      section += `${dayAbbrev}  ${workoutName} · ${day.duration}min · TSS ~${day.estimatedTSS}${marker}\n`;
    }
  }

  // Week summary line
  const dist = weeklyPlan.intensityDistribution || {};
  section += `\n${t.week_target || 'Weekdoel'}: ${weeklyPlan.totalPlannedTSS} TSS | `;
  section += `Mix: ${dist.high || 0} hard, ${dist.medium || 0} medium, ${dist.low || 0} easy, ${dist.rest || 0} ${t.rest || 'rust'}\n`;

  // Key workout highlight
  if (weeklyPlan.keyWorkouts && weeklyPlan.keyWorkouts.length > 0) {
    section += `\n${t.key_workout || 'Key workout'}: ${weeklyPlan.keyWorkouts[0]}\n`;
  }

  // Calendar sync info
  if (calendarResults && calendarResults.created > 0) {
    section += `\n${calendarResults.created} workout${calendarResults.created > 1 ? 's' : ''} ${t.added_to_calendar || 'added to Intervals.icu calendar'}.\n`;
  }

  return section;
}

// =========================================================
// ZONE PROGRESSION SECTION
// =========================================================

/**
 * Build zone progression section for weekly email
 * @param {object} t - Translations object
 * @param {object} progression - Zone progression data from getZoneProgression()
 * @param {object} recommendations - AI recommendations from getZoneRecommendations()
 * @returns {string} Formatted email section
 */
function buildZoneProgressionSection(t, progression, recommendations) {
  if (!progression || !progression.available) {
    return '';
  }

  const trendSymbols = {
    improving: '↑',
    stable: '→',
    declining: '↓'
  };

  let section = `-----------------------------------
${t.zone_progression_title || 'Zone Progression Levels'}
-----------------------------------
`;

  // Zone levels table
  section += `${t.zone || 'Zone'}        ${t.level || 'Level'}  ${t.trend || 'Trend'}   ${t.last_trained || 'Last'}\n`;
  section += `---------- -----  ------  --------\n`;

  for (const [zone, data] of Object.entries(progression.progression)) {
    const zoneName = zone.charAt(0).toUpperCase() + zone.slice(1);
    const symbol = trendSymbols[data.trend] || '→';
    const lastTrained = data.lastTrained ? data.lastTrained.substring(5) : 'N/A';

    // Create level bar visualization (1-10 scale, simplified for email)
    const levelStr = data.level.toFixed(1).padStart(4);
    const trendStr = (data.trend + ' ' + symbol).padEnd(8);

    section += `${zoneName.padEnd(10)} ${levelStr}  ${trendStr} ${lastTrained}\n`;
  }

  // Summary
  section += `\n${t.strengths || 'Strengths'}: ${progression.strengths.map(s => s.charAt(0).toUpperCase() + s.slice(1)).join(', ')}\n`;
  section += `${t.focus_areas || 'Focus Areas'}: ${progression.focusAreas.map(s => s.charAt(0).toUpperCase() + s.slice(1)).join(', ')}\n`;

  // AI Recommendations
  if (recommendations) {
    section += `\n${t.ai_recommendation || 'AI Recommendation'}:\n`;

    if (recommendations.summary) {
      section += `${recommendations.summary}\n`;
    }

    if (recommendations.priorityZone) {
      section += `\n${t.priority_this_week || 'Priority this week'}: ${recommendations.priorityZone.charAt(0).toUpperCase() + recommendations.priorityZone.slice(1)}\n`;
      if (recommendations.priorityReason) {
        section += `${recommendations.priorityReason}\n`;
      }
    }

    if (recommendations.weeklyRecommendations && recommendations.weeklyRecommendations.length > 0) {
      section += `\n${t.suggested_workouts || 'Suggested workouts'}:\n`;
      for (const rec of recommendations.weeklyRecommendations) {
        section += `• ${rec}\n`;
      }
    }
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
    // Add to history for trend tracking
    addZoneProgressionToHistory(zoneProgression);
  }

  const subject = t.monthly_subject + " (" + currentMonth.monthName + " " + currentMonth.monthYear + ")";

  let body = `${t.monthly_greeting}\n\n`;

  if (aiInsight) {
    body += `${aiInsight}\n\n`;
  }

  body += `===================================
${currentMonth.monthName} ${currentMonth.monthYear}: ${currentMonth.periodStart} - ${currentMonth.periodEnd}
===================================\n`;

  // Month-over-Month Comparison
  const activityChange = currentMonth.totals.activities - previousMonth.totals.activities;
  const tssChange = currentMonth.totals.tss - previousMonth.totals.tss;
  const timeChange = currentMonth.totals.time - previousMonth.totals.time;
  const ctlChange = currentMonth.fitness.ctlEnd - previousMonth.fitness.ctlEnd;

  body += `
-----------------------------------
${t.monthly_comparison || 'Month-over-Month'}
-----------------------------------
${t.monthly_total_activities}: ${currentMonth.totals.activities} ${formatChange(activityChange, false)}
${t.monthly_total_tss || 'Total TSS'}: ${currentMonth.totals.tss.toFixed(0)} ${formatChange(tssChange, false)}
${t.monthly_total_hours || 'Total Time'}: ${formatDuration(currentMonth.totals.time)} ${formatChange(Math.round(timeChange / 60), false, 'min')}
CTL: ${currentMonth.fitness.ctlEnd.toFixed(1)} ${formatChange(ctlChange, true)}
`;

  if (currentMonth.fitness.eftpEnd && previousMonth.fitness.eftpEnd) {
    const eftpChange = currentMonth.fitness.eftpEnd - previousMonth.fitness.eftpEnd;
    body += `eFTP: ${currentMonth.fitness.eftpEnd}W ${formatChange(eftpChange, false, 'W')}
`;
  }

  // Fitness Trend
  body += `
-----------------------------------
${t.monthly_fitness_trend}
-----------------------------------
CTL: ${currentMonth.fitness.ctlStart.toFixed(1)} → ${currentMonth.fitness.ctlEnd.toFixed(1)}
`;

  // Weekly CTL breakdown
  body += `\n  Week:  `;
  currentMonth.weeklyData.forEach((w, i) => {
    body += `${i + 1}`.padStart(5);
  });
  body += `\n  CTL:   `;
  currentMonth.weeklyData.forEach(w => {
    body += `${w.ctl.toFixed(0)}`.padStart(5);
  });
  body += `\n`;

  // eFTP Trend
  if (currentMonth.fitness.eftpStart && currentMonth.fitness.eftpEnd) {
    body += `
-----------------------------------
${t.monthly_eftp_trend}
-----------------------------------
eFTP: ${currentMonth.fitness.eftpStart}W → ${currentMonth.fitness.eftpEnd}W
`;

    body += `\n  Week:  `;
    currentMonth.weeklyData.forEach((w, i) => {
      body += `${i + 1}`.padStart(5);
    });
    body += `\n  eFTP:  `;
    currentMonth.weeklyData.forEach(w => {
      body += `${w.eftp || '-'}`.toString().padStart(5);
    });
    body += `\n`;
  }

  // Volume
  body += `
-----------------------------------
${t.monthly_volume}
-----------------------------------
${t.monthly_avg_weekly_tss}: ${currentMonth.totals.avgWeeklyTss.toFixed(0)}
${t.monthly_avg_weekly_hours}: ${formatDuration(currentMonth.totals.avgWeeklyTime)}
`;

  body += `\n  Week:  `;
  currentMonth.weeklyData.forEach((w, i) => {
    body += `${i + 1}`.padStart(5);
  });
  body += `\n  TSS:   `;
  currentMonth.weeklyData.forEach(w => {
    body += `${w.totalTss.toFixed(0)}`.padStart(5);
  });
  body += `\n`;

  // Consistency
  body += `
-----------------------------------
${t.monthly_consistency}
-----------------------------------
${t.monthly_weeks_trained}: ${currentMonth.consistency.weeksWithTraining}/${currentMonth.weeks} (${currentMonth.consistency.consistencyPercent}%)
`;

  // Zone Progression (monthly review)
  if (zoneProgression && zoneProgression.available) {
    body += buildZoneProgressionSection(t, zoneProgression, zoneRecommendations);
  }

  // Goal
  if (goals?.available && goals?.primaryGoal) {
    body += `
-----------------------------------
${t.phase_title}: ${phaseInfo.phaseName}
-----------------------------------
${t.goal_section}: ${goals.primaryGoal.name} (${goals.primaryGoal.date})
${t.weeks_to_goal}: ${phaseInfo.weeksOut} ${t.weeks_unit}
`;
  }

  body += `\n${t.monthly_footer}`;

  GmailApp.sendEmail(USER_SETTINGS.EMAIL_TO, subject, body, { name: "IntervalCoach" });
  Logger.log("Monthly progress report sent successfully.");
}

// =========================================================
// POST-WORKOUT ANALYSIS EMAIL
// =========================================================

/**
 * Send post-workout AI analysis email
 * @param {object} activity - Completed activity
 * @param {object} analysis - AI analysis results
 * @param {object} wellness - Current wellness data
 * @param {object} fitness - Current fitness metrics
 * @param {object} powerProfile - Power profile (null for runs)
 * @param {object} runningData - Running data (null for cycling)
 */
function sendPostWorkoutAnalysisEmail(activity, analysis, wellness, fitness, powerProfile, runningData) {
  const t = getTranslations();
  const isRun = activity.type === "Run";

  // Generate subject line
  const dateStr = Utilities.formatDate(new Date(activity.start_date_local), SYSTEM_SETTINGS.TIMEZONE, "MM/dd HH:mm");
  const subject = `[IntervalCoach] Workout Analysis: ${activity.name} (${dateStr})`;

  let body = `${t.greeting}\n\n`;

  // Congratulatory message
  if (analysis.congratsMessage) {
    body += `===================================
${t.workout_complete || "Workout Complete"}
===================================
${analysis.congratsMessage}

`;
  }

  // Workout Summary
  body += `===================================
${t.workout_summary || "Workout Summary"}
===================================
${t.workout_type || "Type"}: ${activity.type}
${t.duration || "Duration"}: ${Math.round(activity.moving_time / 60)} minutes
TSS/Load: ${activity.icu_training_load}
${t.intensity || "Intensity Factor"}: ${activity.icu_intensity ? activity.icu_intensity.toFixed(2) : 'N/A'}
`;

  // RPE/Feel if available
  if (activity.icu_rpe || activity.feel) {
    body += `\n${t.subjective_feedback || "Your Feedback"}:
`;
    if (activity.icu_rpe) {
      body += `  RPE: ${activity.icu_rpe}/10`;
    }
    if (activity.feel) {
      body += `${activity.icu_rpe ? ' | ' : '  '}Feel: ${getFeelLabel(activity.feel)}`;
    }
    body += `\n`;
  }

  // AI Analysis
  body += `
===================================
${t.ai_analysis || "AI Analysis"}
===================================
${t.effectiveness || "Effectiveness"}: ${analysis.effectiveness}/10
${analysis.effectivenessReason}

${t.difficulty || "Difficulty"}: ${analysis.difficultyMatch.replace(/_/g, ' ')}
${analysis.difficultyReason}

${t.workout_stimulus || "Workout Stimulus"}: ${analysis.workoutStimulus.toUpperCase()} (${analysis.stimulusQuality})
`;

  // Key Insight
  body += `
-----------------------------------
${t.key_insight || "Key Insight"}
-----------------------------------
${analysis.keyInsight}
`;

  // Performance Highlights
  if (analysis.performanceHighlights && analysis.performanceHighlights.length > 0) {
    body += `
-----------------------------------
${t.highlights || "Highlights"}
-----------------------------------
`;
    analysis.performanceHighlights.forEach(highlight => {
      body += `• ${highlight}\n`;
    });
  }

  // Recovery Impact
  if (analysis.recoveryImpact) {
    body += `
-----------------------------------
${t.recovery_impact || "Recovery Impact"}
-----------------------------------
${t.severity || "Severity"}: ${analysis.recoveryImpact.severity}
${t.estimated_recovery || "Est. Recovery"}: ${analysis.recoveryImpact.estimatedRecoveryHours} hours
${t.next_workout || "Next Workout"}: ${analysis.recoveryImpact.nextWorkoutAdjustment.replace(/_/g, ' ')}
`;
  }

  // Training Adjustments
  if (analysis.trainingAdjustments && analysis.trainingAdjustments.needed) {
    body += `
-----------------------------------
${t.training_adjustments || "Training Adjustments"}
-----------------------------------
`;
    if (analysis.trainingAdjustments.ftpCalibration && analysis.trainingAdjustments.ftpCalibration !== 'none') {
      body += `FTP Calibration: ${analysis.trainingAdjustments.ftpCalibration.replace(/_/g, ' ')}\n`;
    }
    if (analysis.trainingAdjustments.futureIntensity) {
      body += `Future Intensity: ${analysis.trainingAdjustments.futureIntensity.replace(/_/g, ' ')}\n`;
    }
    body += `\n${analysis.trainingAdjustments.reasoning}\n`;
  }

  // Current Fitness State
  body += `
-----------------------------------
${t.current_fitness || "Current Fitness"}
-----------------------------------
CTL: ${fitness.ctl ? fitness.ctl.toFixed(1) : 'N/A'}
ATL: ${fitness.atl ? fitness.atl.toFixed(1) : 'N/A'}
TSB: ${fitness.tsb ? fitness.tsb.toFixed(1) : 'N/A'}
${t.ramp_rate || "Ramp Rate"}: ${fitness.rampRate ? fitness.rampRate.toFixed(2) : 'N/A'} TSS/week
`;

  // Power/Running Profile
  if (!isRun && powerProfile && powerProfile.available) {
    const currentEftp = powerProfile.currentEftp || powerProfile.eFTP;
    body += `
-----------------------------------
${t.power_profile_title || "Power Profile"}
-----------------------------------
eFTP: ${currentEftp}W
Peak Powers: 5s=${powerProfile.peak5s}W | 1min=${powerProfile.peak1min}W | 5min=${powerProfile.peak5min}W
`;
  } else if (isRun && runningData && runningData.available) {
    body += `
-----------------------------------
${t.running_profile || "Running Profile"}
-----------------------------------
Critical Speed: ${runningData.criticalSpeed || 'N/A'}/km
D': ${runningData.dPrime ? runningData.dPrime.toFixed(0) + 'm' : 'N/A'}
Threshold Pace: ${runningData.thresholdPace || 'N/A'}/km
`;
  }

  // Wellness
  if (wellness && wellness.available) {
    body += `
-----------------------------------
${t.recovery_title}
-----------------------------------
${t.recovery_status}: ${wellness.recoveryStatus}
${t.sleep}: ${wellness.today.sleep ? wellness.today.sleep.toFixed(1) + 'h' : 'N/A'}
${t.hrv}: ${wellness.today.hrv || 'N/A'} ms
${t.resting_hr}: ${wellness.today.restingHR || 'N/A'} bpm
`;
  }

  body += `
-----------------------------------
${t.keep_training || "Keep up the great work!"}
- IntervalCoach
`;

  GmailApp.sendEmail(USER_SETTINGS.EMAIL_TO, subject, body, { name: "IntervalCoach" });
  Logger.log("Post-workout analysis email sent successfully.");
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
