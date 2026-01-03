/**
 * IntervalCoach - Email & Impact Tests
 *
 * Tests for email structure, workout impact preview, and daily email sending.
 * Run these from the Apps Script editor to test email features.
 */

// =========================================================
// EMAIL TESTS
// =========================================================

/**
 * Simple email test to verify Gmail is working
 */
function testSimpleEmail() {
  Logger.log("Sending simple test email...");
  GmailApp.sendEmail(
    USER_SETTINGS.EMAIL_TO,
    "[IntervalCoach] Simple Test",
    "This is a simple test email to verify Gmail is working.\n\nIf you see this, email delivery works!"
  );
  Logger.log("Simple email sent to " + USER_SETTINGS.EMAIL_TO);
}

/**
 * Test monthly email structure without sending
 * Shows the email content in the log for review
 */
function testMonthlyEmail() {
  Logger.log("=== MONTHLY EMAIL TEST ===\n");
  requireValidConfig();

  const t = getTranslations();
  const lang = USER_SETTINGS.LANGUAGE || 'en';
  const isNL = lang === 'nl';

  Logger.log("Fetching monthly data...");
  const currentMonth = fetchMonthlyProgressData(0);
  const previousMonth = fetchMonthlyProgressData(1);

  Logger.log(`Current month: ${currentMonth.monthName} ${currentMonth.monthYear}`);
  Logger.log(`Previous month: ${previousMonth.monthName} ${previousMonth.monthYear}`);

  const goals = fetchUpcomingGoals();
  const phaseInfo = goals?.available && goals?.primaryGoal
    ? calculateTrainingPhase(goals.primaryGoal.date)
    : calculateTrainingPhase(USER_SETTINGS.TARGET_DATE);

  Logger.log("Generating AI insight...");
  const aiInsight = generateMonthlyInsight(currentMonth, previousMonth, phaseInfo, goals);

  Logger.log("Fetching zone progression...");
  const zoneProgression = getZoneProgression(true);
  let zoneRecommendations = null;
  if (zoneProgression && zoneProgression.available) {
    zoneRecommendations = getZoneRecommendations(zoneProgression, phaseInfo, goals);
  }

  // Build the email body (same logic as sendMonthlyProgressEmail but don't send)
  const athleteName = USER_SETTINGS.ATHLETE_NAME || (isNL ? 'atleet' : 'athlete');
  let body = isNL
    ? `Hoi ${athleteName},\n\n`
    : `Hi ${athleteName},\n\n`;

  if (aiInsight) {
    body += `${aiInsight}\n\n`;
  }

  const formatDiff = function(val, suffix, decimals) {
    if (val == null || val === 0) return '';
    const sign = val > 0 ? '+' : '';
    const formatted = decimals != null ? val.toFixed(decimals) : Math.round(val);
    return ` (${sign}${formatted}${suffix || ''})`;
  };

  // I. TRAININGSVOLUME
  body += '═══════════════════════════════════════\n';
  body += isNL ? 'I. TRAININGSVOLUME\n' : 'I. TRAINING VOLUME\n';
  body += '═══════════════════════════════════════\n';
  body += isNL ? 'Vergelijking met vorige maand\n\n' : 'Comparison with previous month\n\n';

  const tssChange = currentMonth.totals.tss - previousMonth.totals.tss;
  const timeChange = currentMonth.totals.time - previousMonth.totals.time;
  const activityChange = currentMonth.totals.activities - previousMonth.totals.activities;

  body += (isNL ? 'Totaal TSS: ' : 'Total TSS: ') + `${currentMonth.totals.tss.toFixed(0)}${formatDiff(tssChange)}\n`;
  body += (isNL ? 'Totaal Tijd: ' : 'Total Time: ') + `${formatDuration(currentMonth.totals.time)}${formatDiff(Math.round(timeChange / 60), ' min')}\n`;
  body += (isNL ? 'Sessies: ' : 'Sessions: ') + `${currentMonth.totals.activities}${formatDiff(activityChange)}\n`;
  body += (isNL ? 'Gem. per week: ' : 'Avg per week: ') + `${currentMonth.totals.avgWeeklyTss.toFixed(0)} TSS | ${formatDuration(currentMonth.totals.avgWeeklyTime)}\n\n`;
  body += (isNL ? 'Wekelijkse verdeling (TSS): ' : 'Weekly breakdown (TSS): ');
  body += currentMonth.weeklyData.map((w, i) => `W${i + 1}: ${w.totalTss.toFixed(0)}`).join(' | ') + '\n';

  // II. FITNESS PROGRESSIE
  body += '\n═══════════════════════════════════════\n';
  body += isNL ? 'II. FITNESS PROGRESSIE (CTL)\n' : 'II. FITNESS PROGRESSION (CTL)\n';
  body += '═══════════════════════════════════════\n';
  body += isNL ? 'De CTL-waarde representeert je belastbaarheid op lange termijn.\n\n' : 'CTL represents your long-term training capacity.\n\n';

  const ctlChange = currentMonth.fitness.ctlEnd - currentMonth.fitness.ctlStart;
  body += `Start: ${currentMonth.fitness.ctlStart.toFixed(1)}\n`;
  body += `Eind: ${currentMonth.fitness.ctlEnd.toFixed(1)}${formatDiff(ctlChange, '', 1)}\n`;
  body += (isNL ? 'Trend: [ ' : 'Trend: [ ') + currentMonth.weeklyData.map(w => w.ctl.toFixed(0)).join(' > ') + ' ]\n';

  body += '\n';
  if (ctlChange > 5) {
    body += isNL ? 'Status: Sterke fitness opbouw. Goed werk!\n' : 'Status: Strong fitness build. Good work!\n';
  } else if (ctlChange > 0) {
    body += isNL ? 'Status: Geleidelijke opbouw. De basis groeit weer.\n' : 'Status: Gradual build. The base is growing again.\n';
  } else if (ctlChange > -3) {
    body += isNL ? 'Status: Fitness stabiel gehouden.\n' : 'Status: Fitness maintained.\n';
  } else {
    body += isNL ? 'Status: Fitness gedaald. Check of dit gepland was.\n' : 'Status: Fitness decreased. Check if this was planned.\n';
  }

  // III. ZONE ONTWIKKELING
  if (zoneProgression && zoneProgression.available) {
    body += '\n═══════════════════════════════════════\n';
    body += isNL ? 'III. ZONE ONTWIKKELING\n' : 'III. ZONE DEVELOPMENT\n';
    body += '═══════════════════════════════════════\n';
    body += isNL ? 'Score op een schaal van 1-10\n\n' : 'Score on a scale of 1-10\n\n';

    const prog = zoneProgression.progression;
    const zoneLabels = { endurance: isNL ? 'DUURVERMOGEN' : 'ENDURANCE', tempo: 'TEMPO', threshold: isNL ? 'DREMPEL' : 'THRESHOLD', vo2max: 'VO2MAX', anaerobic: isNL ? 'ANAEROOB' : 'ANAEROBIC' };
    const trendLabels = { improving: isNL ? 'Verbeterend' : 'Improving', stable: isNL ? 'Stabiel' : 'Stable', declining: isNL ? 'Dalend' : 'Declining' };

    const zoneOrder = ['endurance', 'tempo', 'threshold', 'vo2max', 'anaerobic'];
    for (const zone of zoneOrder) {
      const data = prog[zone];
      if (!data) continue;
      const name = zoneLabels[zone];
      const filled = Math.round(data.level);
      const bar = '[' + '='.repeat(filled) + ' '.repeat(10 - filled) + ']';
      const trend = trendLabels[data.trend] || data.trend;
      body += `${name} ${bar} ${data.level.toFixed(1)} (${trend})\n`;
    }

    if (zoneRecommendations?.summary) {
      body += '\n' + zoneRecommendations.summary + '\n';
    }
  }

  // IV. PLANNING
  const nextMonthName = isNL
    ? ['Januari', 'Februari', 'Maart', 'April', 'Mei', 'Juni', 'Juli', 'Augustus', 'September', 'Oktober', 'November', 'December'][new Date().getMonth()]
    : ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'][new Date().getMonth()];

  body += '\n═══════════════════════════════════════\n';
  body += `IV. PLANNING ${nextMonthName.toUpperCase()}\n`;
  body += '═══════════════════════════════════════\n';

  if (goals?.available && goals?.primaryGoal) {
    const goal = goals.primaryGoal;
    body += (isNL ? `Doel: ${goal.name} (${goal.date})\n` : `Goal: ${goal.name} (${goal.date})\n`);
    body += (isNL ? `Fase: ${phaseInfo.phaseName}\n\n` : `Phase: ${phaseInfo.phaseName}\n\n`);
  }

  body += isNL ? 'Maanddoelen:\n' : 'Monthly goals:\n';
  const avgWeeklyTss = currentMonth.totals.avgWeeklyTss;
  const targetTss = avgWeeklyTss < 150 ? Math.round(avgWeeklyTss * 1.15) : Math.round(avgWeeklyTss * 1.05);
  body += (isNL ? `• Consistentie: Minimaal 4 sessies per week.\n` : `• Consistency: Minimum 4 sessions per week.\n`);
  body += (isNL ? `• Volume: Toewerken naar ${targetTss} TSS/week.\n` : `• Volume: Work towards ${targetTss} TSS/week.\n`);
  body += (isNL ? `• Focus: 80% van de tijd in Zone 2.\n` : `• Focus: 80% of time in Zone 2.\n`);

  try {
    const fitnessMetrics = fetchFitnessMetrics();
    const deloadCheck = checkDeloadNeeded(fitnessMetrics, null);
    const fourWeekOutlook = generateFourWeekOutlook(fitnessMetrics, phaseInfo, zoneProgression, deloadCheck);
    if (fourWeekOutlook && fourWeekOutlook.weeks) {
      body += isNL ? '\nWeekschema:\n' : '\nWeekly schedule:\n';

      const weekTypeTranslations = {
        'Build': 'Opbouw',
        'Recovery': 'Herstel',
        'Recovery (tentative)': 'Herstel (optioneel)',
        'Race Week': 'Wedstrijdweek',
        'Taper': 'Taper',
        'Holiday': 'Vakantie',
        'Pre-Holiday Push': 'Pre-vakantie push'
      };

      const focusTranslations = {
        'Endurance': 'Duurzaamheid',
        'Tempo': 'Tempo',
        'Threshold': 'Drempel',
        'VO2max': 'VO2max',
        'Anaerobic': 'Anaeroob',
        'Endurance volume': 'Duurzaamheid volume',
        'Aerobic base': 'Aerobe basis',
        'Threshold development': 'Drempel ontwikkeling',
        'VO2max introduction': 'VO2max introductie',
        'Race-specific efforts': 'Wedstrijdspecifiek',
        'Sharpening': 'Verscherpen',
        'Freshness': 'Frisheid',
        'Openers only': 'Alleen openers',
        'Easy spinning': 'Rustig fietsen',
        'Active recovery': 'Actief herstel',
        'Freshness & race prep': 'Frisheid & wedstrijdvoorbereiding',
        'Taper & race prep': 'Taper & wedstrijdvoorbereiding',
        'Maintain sharpness, reduce volume': 'Behoud scherpte, verminder volume',
        'Recovery week - body needs rest': 'Herstelweek - lichaam heeft rust nodig',
        'Potential recovery - monitor wellness': 'Mogelijk herstel - monitor welzijn'
      };

      for (let i = 0; i < fourWeekOutlook.weeks.length; i++) {
        const week = fourWeekOutlook.weeks[i];
        const weekType = isNL
          ? (weekTypeTranslations[week.type] || week.type)
          : week.type;

        body += isNL
          ? `• Week ${i + 1}: ${weekType} (TSS doel: ${week.tssTarget})`
          : `• Week ${i + 1}: ${weekType} (TSS target: ${week.tssTarget})`;

        if (week.focus) {
          let focus = week.focus;
          if (isNL) {
            if (week.focus.startsWith('Planned rest:')) {
              const holidayName = week.focus.replace('Planned rest: ', '');
              focus = `Geplande rust: ${holidayName}`;
            } else if (week.focus.startsWith('Push hard before')) {
              const holidayName = week.focus.replace('Push hard before ', '');
              focus = `Extra hard trainen voor ${holidayName}`;
            } else {
              focus = focusTranslations[week.focus] || week.focus;
            }
            // In Base phase, prefix high-intensity focuses with "Prikkel:"
            const highIntensityFocuses = ['VO2max', 'Anaeroob'];
            if (phaseInfo?.phaseName === 'Base' && highIntensityFocuses.includes(focus)) {
              focus = `Prikkel: ${focus}`;
            }
          } else {
            // English: prefix with "Stimulus:" in Base phase
            const highIntensityFocuses = ['VO2max', 'Anaerobic'];
            if (phaseInfo?.phaseName === 'Base' && highIntensityFocuses.includes(week.focus)) {
              focus = `Stimulus: ${week.focus}`;
            }
          }
          body += ` - ${focus}`;
        }
        body += '\n';
      }
    }
  } catch (e) {
    Logger.log("Four-week outlook failed: " + e.toString());
  }

  body += isNL ? '\nMet sportieve groet,\n' : '\nWith athletic regards,\n';
  body += 'IntervalCoach\n';

  Logger.log("\n" + "=".repeat(60));
  Logger.log("MONTHLY EMAIL PREVIEW:");
  Logger.log("=".repeat(60) + "\n");
  Logger.log(body);
  Logger.log("\n=== TEST COMPLETE ===");
}

/**
 * Test unified daily email - tests all three types
 * @param {string} emailType - 'workout', 'rest', or 'status' (default: 'status')
 */
function testUnifiedDailyEmail(emailType) {
  const type = emailType || 'status';
  logTestHeader("UNIFIED DAILY EMAIL (" + type.toUpperCase() + ")");

  const ctx = setupTestContext();
  const upcomingDays = fetchUpcomingPlaceholders(7);

  // Check for mid-week adaptation (unified approach)
  let midWeekAdaptation = null;
  const adaptationCheck = checkMidWeekAdaptationNeeded(ctx.weekProgress, upcomingDays, ctx.wellness, ctx.fitness);
  if (adaptationCheck.needed) {
    Logger.log("Adaptation needed: " + adaptationCheck.reason);
  }

  Logger.log("Recovery: " + (ctx.wellness.recoveryStatus || "Unknown"));
  Logger.log("Phase: " + ctx.phase + " (" + ctx.phaseInfo.weeksOut + " weeks out)");
  Logger.log("Week Progress: " + ctx.weekProgress.summary);

  // Build email params based on type
  const emailParams = {
    type: type,
    summary: ctx.fitness,
    phaseInfo: ctx.phaseInfo,
    wellness: ctx.wellness,
    weekProgress: ctx.weekProgress,
    upcomingDays: upcomingDays,
    midWeekAdaptation: midWeekAdaptation
  };

  // Add type-specific params
  if (type === 'workout') {
    const powerCurve = fetchPowerCurve();
    const powerProfile = analyzePowerProfile(powerCurve);
    emailParams.workout = {
      type: 'Test_Workout',
      explanation: 'This is a test workout explanation.',
      recommendationReason: 'Testing the unified email with a fake workout.',
      recommendationScore: 8
    };
    emailParams.powerProfile = powerProfile;
  } else if (type === 'rest') {
    emailParams.restAssessment = {
      reasoning: 'Test rest day reasoning - your body needs recovery.',
      alternatives: '- Light walk\n- Stretching\n- Foam rolling',
      confidence: 'high'
    };
  } else if (type === 'group_ride') {
    emailParams.cEventName = 'Zwift Crit City Race';

    // Fetch real context for AI advice
    const recentTypes = getRecentWorkoutTypes(7);
    const adaptiveContext = getAdaptiveTrainingContext();

    // Get AI advice on how hard to push
    const groupRideAdvice = generateGroupRideAdvice({
      wellness: wellness,
      tsb: fitnessMetrics.tsb_current || fitnessMetrics.tsb,
      ctl: fitnessMetrics.ctl_90 || fitnessMetrics.ctl,
      atl: fitnessMetrics.atl_7 || fitnessMetrics.atl,
      eventName: emailParams.cEventName,
      eventTomorrow: hasEventTomorrow(),
      eventIn2Days: hasEventInDays(2),
      recentWorkouts: { rides: recentTypes.rides, runs: recentTypes.runs },
      daysSinceLastWorkout: adaptiveContext.gap?.daysSinceLastWorkout || 0,
      phase: phaseInfo?.phaseName
    });

    Logger.log("Group ride intensity: " + (groupRideAdvice?.intensity || 'unknown'));
    Logger.log("AI advice: " + (groupRideAdvice?.advice || 'none'));

    emailParams.groupRideAdvice = groupRideAdvice;
  }

  Logger.log("\n--- Sending Unified Daily Email (" + type + ") ---");
  sendDailyEmail(emailParams);

  Logger.log("\n=== TEST COMPLETE ===");
  Logger.log("Check your inbox for the email.");
}

/**
 * Quick test wrappers for each email type (actually sends emails)
 */
function testUnifiedEmail_Status() { testUnifiedDailyEmail('status'); }
function testUnifiedEmail_Rest() { testUnifiedDailyEmail('rest'); }
function testUnifiedEmail_Workout() { testUnifiedDailyEmail('workout'); }
function testUnifiedEmail_GroupRide() { testUnifiedDailyEmail('group_ride'); }

/**
 * Test all Whoop-style email formats (logs to console, does not send)
 * Use this to preview email content without sending
 * @param {string} emailType - Optional: 'rest', 'workout', 'group_ride', 'race_day', 'sick' (default: all)
 */
function testEmailStyles(emailType) {
  logTestHeader("EMAIL STYLES");

  const lang = USER_SETTINGS.LANGUAGE || 'en';
  const isNL = lang === 'nl';

  const ctx = setupTestContext();
  const upcomingDays = fetchUpcomingPlaceholders(7);

  // Fetch last workout analysis for AI-generated yesterday acknowledgment
  let lastWorkoutAnalysis = null;
  try {
    lastWorkoutAnalysis = getLastWorkoutAnalysis();
    if (lastWorkoutAnalysis) {
      Logger.log("Last workout analysis found: " + lastWorkoutAnalysis.activityName +
                 " (" + lastWorkoutAnalysis.date + ") - Effectiveness: " + (lastWorkoutAnalysis.effectiveness || 'N/A'));
    } else {
      Logger.log("No last workout analysis available - yesterday acknowledgment will be skipped");
    }
  } catch (e) {
    Logger.log("Could not fetch last workout analysis: " + e.toString());
  }

  const types = emailType ? [emailType] : ['rest', 'workout', 'group_ride', 'race_day', 'sick'];

  types.forEach(type => {
    Logger.log(`\n${'='.repeat(50)}`);
    Logger.log(`  ${type.toUpperCase()} EMAIL`);
    Logger.log(`${'='.repeat(50)}\n`);

    let body = '';
    const baseParams = { wellness: ctx.wellness, weekProgress: ctx.weekProgress, upcomingDays, summary: ctx.fitness, phaseInfo: ctx.phaseInfo, lastWorkoutAnalysis };

    if (type === 'rest') {
      body = buildWhoopStyleRestDayEmail(baseParams, isNL);

    } else if (type === 'workout') {
      const powerCurve = fetchPowerCurve();
      const powerProfile = analyzePowerProfile(powerCurve);
      const params = {
        ...baseParams,
        workout: { type: 'Sweet_Spot' },
        workoutSelection: {
          reason: isNL ? 'Sweet Spot voor aerobe basis.' : 'Sweet Spot for aerobic base.',
          varietyNote: isNL ? 'Afwisseling in je training.' : 'Variety in training.'
        },
        powerProfile: powerProfile
      };
      body = buildWhoopStyleWorkoutEmail(params, isNL);

    } else if (type === 'group_ride') {
      const recentTypes = getRecentWorkoutTypes(7);
      const adaptiveContext = getAdaptiveTrainingContext();
      const groupRideAdvice = generateGroupRideAdvice({
        wellness, tsb: fitnessMetrics.tsb_current || fitnessMetrics.tsb,
        ctl: fitnessMetrics.ctl_90 || fitnessMetrics.ctl,
        atl: fitnessMetrics.atl_7 || fitnessMetrics.atl,
        eventName: 'Test Group Ride', eventTomorrow: false, eventIn2Days: false,
        recentWorkouts: { rides: recentTypes.rides, runs: recentTypes.runs },
        daysSinceLastWorkout: adaptiveContext.gap?.daysSinceLastWorkout || 0,
        phase: phaseInfo?.phaseName
      });
      const params = {
        ...baseParams, cEventName: 'Test Group Ride',
        cEventDescription: 'Social ride', groupRideAdvice
      };
      body = buildWhoopStyleGroupRideEmail(params, isNL);

    } else if (type === 'race_day') {
      const powerCurve = fetchPowerCurve();
      const powerProfile = analyzePowerProfile(powerCurve);
      const ctx = {
        wellness, fitnessMetrics, phaseInfo, powerProfile,
        raceToday: { hasEvent: true, category: 'A', eventName: 'Test Race', eventDescription: '100km' }
      };
      const raceDayAdvice = generateRaceDayAdvice(ctx);
      const params = {
        ...baseParams, raceName: 'Test Race', raceCategory: 'A',
        raceDescription: '100km road race', raceDayAdvice, powerProfile
      };
      body = buildWhoopStyleRaceDayEmail(params, isNL);

    } else if (type === 'sick') {
      const mockSickStatus = {
        isSick: true, isInjured: false,
        event: { name: 'Verkoudheid', startDate: '2024-12-29', endDate: '2025-01-02', daysSinceStart: 1, daysRemaining: 3 }
      };
      const params = {
        ...baseParams, sickStatus: mockSickStatus,
        returnAdvice: getReturnToTrainingAdvice(mockSickStatus)
      };
      body = buildWhoopStyleSickEmail(params, isNL);
    }

    Logger.log(body);
  });

  Logger.log("\n=== TEST COMPLETE ===");
}

// =========================================================
// WORKOUT IMPACT PREVIEW TESTS
// =========================================================

/**
 * Test the Workout Impact Preview feature
 * Tests projection calculations, TSS estimation, and AI narrative generation
 */
function testWorkoutImpactPreview() {
  Logger.log("=== WORKOUT IMPACT PREVIEW TEST ===\n");

  // 1. Test fitness metrics fetching
  Logger.log("--- Current Fitness Metrics ---");
  const fitnessMetrics = fetchFitnessMetrics();
  Logger.log("CTL: " + fitnessMetrics.ctl);
  Logger.log("ATL: " + fitnessMetrics.atl);
  Logger.log("TSB: " + fitnessMetrics.tsb);
  Logger.log("Ramp Rate: " + fitnessMetrics.rampRate);

  // 2. Test upcoming planned TSS fetching
  Logger.log("\n--- Upcoming Planned Workouts (14 days) ---");
  const upcomingWorkouts = fetchUpcomingPlannedTSS(14);
  upcomingWorkouts.forEach(function(w) {
    if (w.tss > 0 || w.activityType) {
      Logger.log(w.date + ": " + (w.activityType || "Rest") + " TSS=" + w.tss + " (" + w.source + ")");
    }
  });

  // 3. Test projection calculation
  Logger.log("\n--- Fitness Projection (60 TSS workout) ---");
  const testTSS = 60;
  const projections = projectFitnessMetrics(fitnessMetrics.ctl, fitnessMetrics.atl, upcomingWorkouts, 14);
  projections.slice(0, 7).forEach(function(p) {
    Logger.log(p.dayName + " " + p.date + ": TSS=" + p.tss + " -> CTL=" + p.ctl + " ATL=" + p.atl + " TSB=" + p.tsb);
  });

  // 4. Test impact preview generation
  Logger.log("\n--- Impact Preview (comparing with/without workout) ---");
  const impactData = generateWorkoutImpactPreview(testTSS, fitnessMetrics, 14);

  Logger.log("Current state: CTL=" + impactData.currentMetrics.ctl + " TSB=" + impactData.currentMetrics.tsb);
  Logger.log("Today's TSS: " + impactData.todaysTSS);
  Logger.log("Tomorrow TSB delta: " + impactData.impact.tomorrowTSBDelta.toFixed(1));
  Logger.log("2-week CTL gain: +" + impactData.impact.twoWeekCTLDelta.toFixed(1));
  Logger.log("Lowest TSB this week: " + impactData.impact.lowestTSB.toFixed(1));
  Logger.log("Days to positive TSB: " + (impactData.impact.daysToPositiveTSB !== null ? impactData.impact.daysToPositiveTSB : "14+"));

  if (impactData.impact.peakFormWindow.length > 0) {
    Logger.log("Peak form window: " + impactData.impact.peakFormWindow.slice(0, 3).join(", "));
  }

  // 5. Test TSS estimation
  Logger.log("\n--- TSS Estimation by Workout Type ---");
  const testWorkouts = [
    { type: "Recovery_Z1", duration: 45 },
    { type: "Endurance_Z2", duration: 90 },
    { type: "SweetSpot_SST", duration: 60 },
    { type: "Threshold_FTP", duration: 60 },
    { type: "VO2max_Intervals", duration: 60 }
  ];
  testWorkouts.forEach(function(w) {
    const tss = estimateWorkoutTSS(w);
    Logger.log(w.type + " (" + w.duration + "min): ~" + tss + " TSS");
  });

  // 6. Test AI narrative generation
  Logger.log("\n--- AI Impact Preview Narrative ---");
  const goals = fetchUpcomingGoals();
  const phaseInfo = calculateTrainingPhase(goals);

  const aiPreview = generateAIWorkoutImpactPreview(impactData, goals, phaseInfo);

  if (aiPreview.success) {
    Logger.log("AI Enhanced: " + aiPreview.aiEnhanced);
    Logger.log("Summary: " + aiPreview.summary);
    Logger.log("Form Status: " + aiPreview.formStatus);
    Logger.log("Recommendation: " + aiPreview.recommendation);
    Logger.log("\nNarrative:\n" + aiPreview.narrative);
    if (aiPreview.keyInsights && aiPreview.keyInsights.length > 0) {
      Logger.log("\nKey Insights:");
      aiPreview.keyInsights.forEach(function(insight, i) {
        Logger.log("  " + (i + 1) + ". " + insight);
      });
    }
  } else {
    Logger.log("AI preview failed: " + (aiPreview.error || "Unknown error"));
  }

  // 7. Test full email section generation
  Logger.log("\n--- Full Email Section ---");
  const testSummary = {
    ctl_90: fitnessMetrics.ctl,
    atl: fitnessMetrics.atl,
    tsb_current: fitnessMetrics.tsb
  };
  const testWorkout = { type: "SweetSpot_SST", duration: 75 };

  const emailSection = generateWorkoutImpactSection(testSummary, phaseInfo, testWorkout);
  if (emailSection) {
    Logger.log("Email section generated (" + emailSection.length + " chars):");
    Logger.log(emailSection);
  } else {
    Logger.log("Email section was empty (skipped)");
  }

  // 8. Test Weekly Impact Preview
  Logger.log("\n--- Weekly Impact Preview ---");
  const mockWeeklyPlan = [
    { date: formatDateISO(new Date()), dayName: "Today", workoutType: "SweetSpot_SST", estimatedTSS: 55, duration: 60 },
    { date: formatDateISO(new Date(Date.now() + 86400000)), dayName: "Tomorrow", activity: "Rest", estimatedTSS: 0 },
    { date: formatDateISO(new Date(Date.now() + 2*86400000)), dayName: "Day 3", workoutType: "Endurance_Z2", estimatedTSS: 45, duration: 75 },
    { date: formatDateISO(new Date(Date.now() + 3*86400000)), dayName: "Day 4", workoutType: "VO2max_Intervals", estimatedTSS: 65, duration: 60 },
    { date: formatDateISO(new Date(Date.now() + 4*86400000)), dayName: "Day 5", activity: "Rest", estimatedTSS: 0 },
    { date: formatDateISO(new Date(Date.now() + 5*86400000)), dayName: "Day 6", workoutType: "Threshold_FTP", estimatedTSS: 60, duration: 60 },
    { date: formatDateISO(new Date(Date.now() + 6*86400000)), dayName: "Day 7", workoutType: "Recovery_Z1", estimatedTSS: 20, duration: 45 }
  ];

  const weeklyImpact = generateWeeklyImpactPreview(mockWeeklyPlan, fitnessMetrics, 7);

  Logger.log("Weekly projections:");
  weeklyImpact.projections.forEach(function(p) {
    Logger.log("  " + p.dayName + " " + p.date.substring(5) + ": " + p.workoutType + " (TSS " + p.tss + ") -> CTL " + p.ctl + ", TSB " + p.tsb);
  });

  Logger.log("\nWeekly Summary:");
  Logger.log("  Total TSS: " + weeklyImpact.summary.totalTSS);
  Logger.log("  CTL change: " + weeklyImpact.summary.startCTL.toFixed(1) + " -> " + weeklyImpact.summary.endCTL.toFixed(1) + " (" + (weeklyImpact.summary.ctlChange >= 0 ? "+" : "") + weeklyImpact.summary.ctlChange.toFixed(1) + ")");
  Logger.log("  TSB range: " + weeklyImpact.summary.lowestTSB + " to " + weeklyImpact.summary.highestTSB);
  Logger.log("  Sustainable: " + weeklyImpact.summary.sustainableLoad);
  if (weeklyImpact.summary.peakFormDays.length > 0) {
    Logger.log("  Peak form days: " + weeklyImpact.summary.peakFormDays.join(", "));
  }
  if (weeklyImpact.summary.fatigueWarningDays.length > 0) {
    Logger.log("  Fatigue warning days: " + weeklyImpact.summary.fatigueWarningDays.join(", "));
  }

  // 9. Test AI Weekly Narrative
  Logger.log("\n--- AI Weekly Impact Narrative ---");
  const weeklyNarrative = generateAIWeeklyImpactNarrative(weeklyImpact, goals, phaseInfo);

  if (weeklyNarrative.success) {
    Logger.log("AI Enhanced: " + weeklyNarrative.aiEnhanced);
    Logger.log("Week Summary: " + weeklyNarrative.weekSummary);
    Logger.log("Load Assessment: " + weeklyNarrative.loadAssessment);
    Logger.log("Risk Level: " + weeklyNarrative.riskLevel);
    Logger.log("Recommendation: " + weeklyNarrative.recommendation);
    if (weeklyNarrative.keyInsights && weeklyNarrative.keyInsights.length > 0) {
      Logger.log("Key Insights:");
      weeklyNarrative.keyInsights.forEach(function(insight, i) {
        Logger.log("  " + (i + 1) + ". " + insight);
      });
    }
  } else {
    Logger.log("Weekly narrative failed");
  }

  // 10. Test formatted section for email
  Logger.log("\n--- Formatted Weekly Impact Section ---");
  const weeklySection = formatWeeklyImpactSection(weeklyImpact, weeklyNarrative);
  Logger.log(weeklySection);

  Logger.log("\n=== END WORKOUT IMPACT PREVIEW TEST ===");
}

// =========================================================
// EMAIL PREVIEW TESTS (NO SENDING, NO AI GENERATION)
// =========================================================

/**
 * Preview daily email content without sending
 * Uses mock data to show email structure quickly
 */
function previewDailyEmail() {
  Logger.log("=== DAILY EMAIL PREVIEW ===\n");

  const lang = USER_SETTINGS.LANGUAGE || 'en';
  const isNL = lang === 'nl';
  const t = getTranslations();

  // Fetch real data
  const fitnessMetrics = fetchFitnessMetrics();
  const wellnessRecords = fetchWellnessData(7);
  const wellness = createWellnessSummary(wellnessRecords);
  const goals = fetchUpcomingGoals();
  const phaseInfo = calculateTrainingPhase(goals?.primaryGoal?.date || USER_SETTINGS.TARGET_DATE);
  const upcomingDays = fetchUpcomingPlaceholders(7);
  const weekProgress = checkWeekProgress();

  // Mock workout data (skip AI generation)
  const mockWorkout = {
    type: 'Sweet Spot',
    explanation: 'Building aerobic capacity with sustainable intensity.',
    recommendationReason: 'Recovery is good and you have not done SS recently.'
  };

  const mockSelection = {
    reason: isNL
      ? 'Goed herstel en je hebt de afgelopen dagen geen sweet spot gedaan.'
      : 'Good recovery and you haven\'t done sweet spot recently.',
    varietyNote: isNL ? 'Variatie in trainingstype.' : 'Adding variety to your training.',
    zoneNote: ''
  };

  // Build email params
  const params = {
    type: 'workout',
    summary: fitnessMetrics,
    phaseInfo: phaseInfo,
    wellness: wellness,
    workout: mockWorkout,
    workoutSelection: mockSelection,
    powerProfile: { available: false },
    weekProgress: weekProgress,
    upcomingDays: upcomingDays
  };

  // Build email body manually (same logic as sendDailyEmail)
  const today = new Date();
  const dateStr = Utilities.formatDate(today, SYSTEM_SETTINGS.TIMEZONE, "MM/dd");
  const subject = `${t.subject_prefix}${mockWorkout.type} (${dateStr})`;

  const tsb = fitnessMetrics.tsb || 0;
  const recoveryStatus = wellness?.recoveryStatus || 'Unknown';

  let body = buildDailyOpening('workout', recoveryStatus, tsb, wellness, phaseInfo, isNL);
  body += '\n';
  body += isNL ? `Vandaag: ${mockWorkout.type}\n\n` : `Today: ${mockWorkout.type}\n\n`;
  body += mockSelection.reason;
  if (mockSelection.varietyNote) body += ` ${mockSelection.varietyNote}`;
  body += '\n';

  // Week progress
  if (weekProgress && weekProgress.daysAnalyzed > 0) {
    const wp = weekProgress;
    body += '\n';
    body += isNL
      ? `Deze week: ${wp.completedSessions}/${wp.plannedSessions} sessies`
      : `This week: ${wp.completedSessions}/${wp.plannedSessions} sessions`;
    body += ` (${wp.tssCompleted}${wp.tssPlanned > 0 ? '/' + wp.tssPlanned : ''} TSS)\n`;
  }

  // Schedule
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
      let status = day.hasEvent ? `[${day.eventCategory}]` : day.activityType || '-';
      const dayAbbrev = isNL ? (dutchDayAbbrev[day.dayName] || day.dayName.substring(0, 2).toLowerCase()) : day.dayName.substring(0, 3);
      body += `${prefix}${dayAbbrev}: ${status}${isToday ? (isNL ? ' (vandaag)' : ' (today)') : ''}\n`;
    }
  }

  body += '\n- IntervalCoach\n';

  Logger.log("Subject: " + subject);
  Logger.log("\n--- EMAIL BODY ---\n");
  Logger.log(body);
  Logger.log("\n--- END PREVIEW ---");
}

/**
 * Preview weekly email content without sending
 * Uses real data but skips AI weekly plan generation
 */
function previewWeeklyEmail() {
  Logger.log("=== WEEKLY EMAIL PREVIEW ===\n");

  const lang = USER_SETTINGS.LANGUAGE || 'en';
  const isNL = lang === 'nl';
  const t = getTranslations();
  const today = new Date();

  // Fetch real data
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

  const goals = fetchUpcomingGoals();
  const phaseInfo = goals?.available && goals?.primaryGoal
    ? calculateTrainingPhase(goals.primaryGoal.date)
    : calculateTrainingPhase(USER_SETTINGS.TARGET_DATE);

  const subject = t.weekly_subject + " (" + Utilities.formatDate(today, SYSTEM_SETTINGS.TIMEZONE, "MM/dd") + ")";

  let body = `${t.weekly_greeting}\n\n`;

  // Dynamic multi-paragraph insight (skip API call for speed)
  const ctlChange = fitnessMetrics.ctl - (prevFitnessMetrics.ctl || 0);
  const tssChange = weekData.totalTss - (prevWeekData.totalTss || 0);
  const currAvg = wellnessSummary?.available ? wellnessSummary.averages : {};

  let insight = '';
  if (isNL) {
    // Opening - week acknowledgment
    if (tssChange > 50) {
      insight += `Een flinke trainingsweek met ${weekData.totalTss.toFixed(0)} TSS, ${Math.abs(tssChange).toFixed(0)} meer dan vorige week. `;
    } else if (tssChange < -50) {
      insight += `Een rustigere week met ${weekData.totalTss.toFixed(0)} TSS. `;
      insight += `Soms is minder meer - herstel is ook training. `;
    } else {
      insight += `Een consistente week met ${weekData.totalTss.toFixed(0)} TSS, vergelijkbaar met vorige week. `;
    }

    // Fitness trend
    if (ctlChange > 1) {
      insight += `Je fitness groeit: CTL steeg met ${ctlChange.toFixed(1)} naar ${fitnessMetrics.ctl.toFixed(0)}. `;
    } else if (ctlChange < -1) {
      insight += `Je fitness daalde licht (CTL ${fitnessMetrics.ctl.toFixed(0)}), wat normaal kan zijn na een rustperiode. `;
    } else {
      insight += `Je fitnessniveau blijft stabiel rond CTL ${fitnessMetrics.ctl.toFixed(0)}. `;
    }

    // Recovery/wellness
    if (wellnessSummary?.available) {
      if (wellnessSummary.recoveryStatus?.toLowerCase().includes('green')) {
        insight += `Je herstel is goed - je lichaam is klaar voor intensieve training.\n\n`;
      } else if (wellnessSummary.recoveryStatus?.toLowerCase().includes('yellow')) {
        insight += `Je herstel vraagt aandacht - luister naar je lichaam deze week.\n\n`;
      } else {
        insight += `\n\n`;
      }
    } else {
      insight += '\n\n';
    }

    // Goal connection
    if (phaseInfo.weeksOut > 0) {
      insight += `Met ${phaseInfo.weeksOut} weken tot je doel bouw je gestaag verder. `;
      insight += `Focus deze week op ${phaseInfo.focus || 'consistentie en kwaliteit'}.`;
    }
  } else {
    // English version
    if (tssChange > 50) {
      insight += `A solid training week with ${weekData.totalTss.toFixed(0)} TSS, ${Math.abs(tssChange).toFixed(0)} more than last week. `;
    } else if (tssChange < -50) {
      insight += `A lighter week with ${weekData.totalTss.toFixed(0)} TSS. `;
      insight += `Sometimes less is more - recovery is also training. `;
    } else {
      insight += `A consistent week with ${weekData.totalTss.toFixed(0)} TSS, similar to last week. `;
    }

    if (ctlChange > 1) {
      insight += `Your fitness is growing: CTL increased by ${ctlChange.toFixed(1)} to ${fitnessMetrics.ctl.toFixed(0)}. `;
    } else if (ctlChange < -1) {
      insight += `Your fitness dipped slightly (CTL ${fitnessMetrics.ctl.toFixed(0)}), which can be normal after a rest period. `;
    } else {
      insight += `Your fitness level remains stable around CTL ${fitnessMetrics.ctl.toFixed(0)}. `;
    }

    if (wellnessSummary?.available) {
      if (wellnessSummary.recoveryStatus?.toLowerCase().includes('green')) {
        insight += `Your recovery is good - your body is ready for intense training.\n\n`;
      } else if (wellnessSummary.recoveryStatus?.toLowerCase().includes('yellow')) {
        insight += `Your recovery needs attention - listen to your body this week.\n\n`;
      } else {
        insight += '\n\n';
      }
    } else {
      insight += '\n\n';
    }

    if (phaseInfo.weeksOut > 0) {
      insight += `With ${phaseInfo.weeksOut} weeks to your goal, you're building steadily. `;
      insight += `Focus this week on ${phaseInfo.focus || 'consistency and quality'}.`;
    }
  }

  body += insight + '\n\n';

  // Week in Review - expanded
  body += buildWeekInReviewSection(t, weekData, prevWeekData, fitnessMetrics, prevFitnessMetrics, wellnessSummary, prevWellnessSummary, isNL);

  // Training Highlights
  body += buildWeeklyHighlightsSection(weekData, isNL);

  // Fitness Status
  body += buildFitnessStatusSection(fitnessMetrics, wellnessSummary, phaseInfo, isNL);

  // Zone Progression
  let zoneProgression = null;
  try {
    zoneProgression = calculateZoneProgression(42);
    if (zoneProgression?.available) {
      body += buildZoneProgressionSection(zoneProgression, isNL, false);
    }
  } catch (e) {
    Logger.log("Zone progression failed: " + e.toString());
  }

  // 4-Week Outlook (dynamic recovery timing)
  try {
    const deloadCheck = checkDeloadNeeded(fitnessMetrics, wellnessSummary);
    const fourWeekOutlook = generateFourWeekOutlook(fitnessMetrics, phaseInfo, zoneProgression, deloadCheck);
    if (fourWeekOutlook) {
      body += formatFourWeekOutlookSection(fourWeekOutlook, isNL);
    }
  } catch (e) {
    Logger.log("4-week outlook failed: " + e.toString());
  }

  // Goal Progress
  if (goals?.available && goals?.primaryGoal) {
    body += buildGoalProgressSection(goals, phaseInfo, fitnessMetrics, isNL);
  }

  // Mock weekly plan (skip AI generation)
  const mockPlan = {
    days: [
      { dayName: 'Monday', workoutType: 'Sweet Spot', duration: 60, estimatedTSS: 55, description: 'Aerobe basis versterken' },
      { dayName: 'Tuesday', activity: 'Rest', duration: 0, estimatedTSS: 0 },
      { dayName: 'Wednesday', workoutType: 'Endurance', duration: 75, estimatedTSS: 45, description: 'Rustige duurtraining' },
      { dayName: 'Thursday', workoutType: 'VO2max', duration: 60, estimatedTSS: 65, description: '5x4min @ 110% FTP' },
      { dayName: 'Friday', activity: 'Rest', duration: 0, estimatedTSS: 0 },
      { dayName: 'Saturday', workoutType: 'Threshold', duration: 60, estimatedTSS: 60, description: '2x20min @ FTP' },
      { dayName: 'Sunday', workoutType: 'Endurance', duration: 90, estimatedTSS: 50, description: 'Lange duurrit' }
    ],
    totalPlannedTSS: 275,
    keyWorkouts: ['Thursday VO2max - belangrijkste workout voor VO2max ontwikkeling'],
    intensityDistribution: { high: 2, medium: 2, low: 1, rest: 2 },
    weeklyFocus: 'Aerobe basis en VO2max ontwikkeling'
  };

  body += buildExpandedWeekPlanSection(t, mockPlan, { created: 0 }, null, phaseInfo, isNL);
  body += '\n- IntervalCoach\n';

  Logger.log("Subject: " + subject);
  Logger.log("\n--- EMAIL BODY ---\n");
  Logger.log(body);
  Logger.log("\n--- END PREVIEW ---");
}

/**
 * Preview monthly email content without sending - expanded format
 */
function previewMonthlyEmail() {
  Logger.log("=== MONTHLY EMAIL PREVIEW ===\n");

  const lang = USER_SETTINGS.LANGUAGE || 'en';
  const isNL = lang === 'nl';
  const t = getTranslations();

  const currentMonth = fetchMonthlyProgressData(0);
  const previousMonth = fetchMonthlyProgressData(1);
  const goals = fetchUpcomingGoals();
  const phaseInfo = goals?.available && goals?.primaryGoal
    ? calculateTrainingPhase(goals.primaryGoal.date)
    : calculateTrainingPhase(USER_SETTINGS.TARGET_DATE);

  const subject = t.monthly_subject + " (" + currentMonth.monthName + " " + currentMonth.monthYear + ")";

  let body = `${t.monthly_greeting}\n\n`;

  // Dynamic multi-paragraph insight based on actual data (no AI call for preview speed)
  const ctlDiff = currentMonth.fitness.ctlEnd - previousMonth.fitness.ctlEnd;
  const tssDiff = currentMonth.totals.tss - previousMonth.totals.tss;
  const activityDiff = currentMonth.totals.activities - previousMonth.totals.activities;
  const avgWeeklyTss = currentMonth.totals.avgWeeklyTss;

  let insight = '';

  // Paragraph 1 - Month in Review
  if (isNL) {
    if (ctlDiff > 3) {
      insight += `Een sterke maand achter de rug. Met ${currentMonth.totals.activities} sessies en ${currentMonth.totals.tss.toFixed(0)} totaal TSS heb je flink getraind. `;
      insight += activityDiff > 0 ? `Dat zijn ${activityDiff} sessies meer dan vorige maand. ` : '';
      insight += `Je consistentie was goed met ${currentMonth.consistency.weeksWithTraining} van de ${currentMonth.weeks} weken actief.\n\n`;
    } else if (ctlDiff > -2) {
      insight += `Een stabiele maand met ${currentMonth.totals.activities} sessies over ${currentMonth.consistency.weeksWithTraining} weken. `;
      insight += `Het trainingsvolume van ${currentMonth.totals.tss.toFixed(0)} TSS is vergelijkbaar met vorige maand. `;
      insight += `Dit soort consistentie is waardevol voor het behouden van je fitnessniveau.\n\n`;
    } else {
      insight += `Een rustigere trainingsmaand. Met ${currentMonth.totals.activities} sessies en ${currentMonth.totals.tss.toFixed(0)} TSS was het volume lager dan ${previousMonth.monthName}. `;
      insight += activityDiff > 0 ? `Je deed wel meer sessies, maar met minder intensiteit. ` : '';
      insight += `Dit kan bewust zijn geweest of door omstandigheden.\n\n`;
    }

    // Paragraph 2 - Fitness Analysis
    insight += `Je fitness (CTL) ging van ${currentMonth.fitness.ctlStart.toFixed(0)} naar ${currentMonth.fitness.ctlEnd.toFixed(0)} deze maand. `;
    if (ctlDiff > 5) {
      insight += `Een mooie stijging die laat zien dat de training aanslaat. `;
    } else if (ctlDiff > 0) {
      insight += `Een geleidelijke verbetering die past bij een duurzame opbouw. `;
    } else if (ctlDiff > -3) {
      insight += `Praktisch stabiel, wat prima kan zijn in een onderhoudsfase. `;
    } else {
      insight += `Een daling die kan passen bij een herstelperiode of drukke periode buiten de sport. `;
    }
    insight += `Per week zag het er zo uit: `;
    insight += currentMonth.weeklyData.map((w, i) => `week ${i + 1} CTL ${w.ctl.toFixed(0)}`).join(', ') + '.\n\n';

    // Paragraph 3 - Goal Context
    if (phaseInfo.weeksOut > 0) {
      insight += `Met nog ${phaseInfo.weeksOut} weken tot je doel zit je in de ${phaseInfo.phaseName} fase. `;
      if (phaseInfo.weeksOut > 12) {
        insight += `Je hebt nog ruim de tijd om systematisch op te bouwen. Focus op consistentie boven alles.`;
      } else if (phaseInfo.weeksOut > 6) {
        insight += `De specifieke voorbereiding kan nu beginnen. Bouw voort op je aerobe basis met gerichte intervals.`;
      } else {
        insight += `De eindfase is aangebroken. Kwaliteit boven kwantiteit wordt nu het devies.`;
      }
      insight += '\n\n';
    }

    // Paragraph 4 - Forward Look
    insight += `Komende maand: focus op ${avgWeeklyTss < 150 ? 'het verhogen van je trainingsvolume' : avgWeeklyTss < 300 ? 'het toevoegen van meer kwaliteitssessies' : 'goed herstel tussen de zware blokken'}. `;
    insight += `Met de juiste balans tussen belasting en rust bouw je verder aan je vorm.`;
  } else {
    // English version - similar structure
    if (ctlDiff > 3) {
      insight += `A strong month behind you. With ${currentMonth.totals.activities} sessions and ${currentMonth.totals.tss.toFixed(0)} total TSS, you trained well. `;
      insight += activityDiff > 0 ? `That's ${activityDiff} more sessions than last month. ` : '';
      insight += `Your consistency was good with ${currentMonth.consistency.weeksWithTraining} of ${currentMonth.weeks} weeks active.\n\n`;
    } else if (ctlDiff > -2) {
      insight += `A stable month with ${currentMonth.totals.activities} sessions over ${currentMonth.consistency.weeksWithTraining} weeks. `;
      insight += `The training volume of ${currentMonth.totals.tss.toFixed(0)} TSS is similar to last month. `;
      insight += `This kind of consistency is valuable for maintaining your fitness level.\n\n`;
    } else {
      insight += `A lighter training month. With ${currentMonth.totals.activities} sessions and ${currentMonth.totals.tss.toFixed(0)} TSS, volume was lower than ${previousMonth.monthName}. `;
      insight += activityDiff > 0 ? `You did more sessions but at lower intensity. ` : '';
      insight += `This may have been intentional or due to circumstances.\n\n`;
    }

    insight += `Your fitness (CTL) went from ${currentMonth.fitness.ctlStart.toFixed(0)} to ${currentMonth.fitness.ctlEnd.toFixed(0)} this month. `;
    if (ctlDiff > 5) {
      insight += `A nice increase showing the training is working. `;
    } else if (ctlDiff > 0) {
      insight += `A gradual improvement fitting a sustainable build. `;
    } else if (ctlDiff > -3) {
      insight += `Practically stable, which can be fine in a maintenance phase. `;
    } else {
      insight += `A decline that may fit a recovery period or busy time outside sport. `;
    }
    insight += `Week by week it looked like: `;
    insight += currentMonth.weeklyData.map((w, i) => `week ${i + 1} CTL ${w.ctl.toFixed(0)}`).join(', ') + '.\n\n';

    if (phaseInfo.weeksOut > 0) {
      insight += `With ${phaseInfo.weeksOut} weeks to your goal, you're in the ${phaseInfo.phaseName} phase. `;
      if (phaseInfo.weeksOut > 12) {
        insight += `You have plenty of time to build systematically. Focus on consistency above all.`;
      } else if (phaseInfo.weeksOut > 6) {
        insight += `Specific preparation can begin now. Build on your aerobic base with targeted intervals.`;
      } else {
        insight += `The final phase has arrived. Quality over quantity is now the motto.`;
      }
      insight += '\n\n';
    }

    insight += `Next month: focus on ${avgWeeklyTss < 150 ? 'increasing your training volume' : avgWeeklyTss < 300 ? 'adding more quality sessions' : 'good recovery between hard blocks'}. `;
    insight += `With the right balance between load and rest, you'll continue building your form.`;
  }

  body += insight + '\n\n';

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
  body += isNL ? 'CTL per week: ' : 'CTL by week: ';
  body += currentMonth.weeklyData.map((w, i) => `W${i + 1}:${w.ctl.toFixed(0)}`).join(' | ') + '\n';

  if (currentMonth.fitness.eftpStart && currentMonth.fitness.eftpEnd) {
    const eftpChange = currentMonth.fitness.eftpEnd - previousMonth.fitness.eftpEnd;
    body += `\neFTP: ${currentMonth.fitness.eftpStart}W -> ${currentMonth.fitness.eftpEnd}W${formatDiff(eftpChange, 'W')}\n`;
  }

  // Interpretation
  body += '\n';
  if (ctlChange > 5) {
    body += isNL ? 'Sterke fitness opbouw deze maand. Goed werk!\n' : 'Strong fitness build this month. Good work!\n';
  } else if (ctlChange > 0) {
    body += isNL ? 'Geleidelijke fitness opbouw. Blijf consistent.\n' : 'Gradual fitness build. Stay consistent.\n';
  } else if (ctlChange > -3) {
    body += isNL ? 'Fitness stabiel gehouden.\n' : 'Fitness maintained.\n';
  } else {
    body += isNL ? 'Fitness gedaald. Controleer of dit gepland was.\n' : 'Fitness decreased. Check if planned.\n';
  }

  // ============ CONSISTENCY ============
  body += '\n';
  body += isNL ? 'CONSISTENTIE\n\n' : 'CONSISTENCY\n\n';

  const consistency = currentMonth.consistency.consistencyPercent;
  body += `${currentMonth.consistency.weeksWithTraining}/${currentMonth.weeks} ${isNL ? 'weken met training' : 'weeks with training'} (${consistency}%)\n`;
  if (consistency >= 75) {
    body += isNL ? 'Goede consistentie.\n' : 'Good consistency.\n';
  } else {
    body += isNL ? 'Probeer regelmatiger te trainen.\n' : 'Try to train more regularly.\n';
  }

  // ============ ZONE PROGRESSION ============
  let zoneProgression = null;
  try {
    zoneProgression = calculateZoneProgression(42);
    if (zoneProgression?.available) {
      body += buildZoneProgressionSection(zoneProgression, isNL, true); // true = monthly detail
    }
  } catch (e) {
    Logger.log("Zone progression failed: " + e.toString());
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
    body += isNL
      ? `\nHuidige fitness: CTL ${currentMonth.fitness.ctlEnd.toFixed(0)}\n`
      : `\nCurrent fitness: CTL ${currentMonth.fitness.ctlEnd.toFixed(0)}\n`;
  }

  // ============ 4-WEEK OUTLOOK ============
  try {
    const fitnessMetrics = fetchFitnessMetrics();
    const wellnessRecords = fetchWellnessData(7);
    const wellnessSummary = createWellnessSummary(wellnessRecords);
    const deloadCheck = checkDeloadNeeded(fitnessMetrics, wellnessSummary);
    const fourWeekOutlook = generateFourWeekOutlook(fitnessMetrics, phaseInfo, zoneProgression, deloadCheck);
    if (fourWeekOutlook) {
      body += formatFourWeekOutlookSection(fourWeekOutlook, isNL);
    }
  } catch (e) {
    Logger.log("4-week outlook failed: " + e.toString());
  }

  // ============ NEXT MONTH ============
  body += '\n';
  body += isNL ? 'KOMENDE MAAND\n\n' : 'NEXT MONTH\n\n';

  const currentCtl = currentMonth.fitness.ctlEnd;

  // Volume targets
  if (isNL) {
    body += 'Volume doelen:\n';
    if (avgWeeklyTss < 150) {
      const targetTss = Math.round(avgWeeklyTss * 1.15);
      body += `- Weekdoel: ${targetTss} TSS/week (15% verhoging mogelijk)\n`;
    } else {
      const targetTss = Math.round(avgWeeklyTss * 1.05);
      body += `- Weekdoel: ${targetTss} TSS/week (5% verhoging)\n`;
    }
  } else {
    body += 'Volume targets:\n';
    if (avgWeeklyTss < 150) {
      const targetTss = Math.round(avgWeeklyTss * 1.15);
      body += `- Weekly target: ${targetTss} TSS/week (15% increase possible)\n`;
    } else {
      const targetTss = Math.round(avgWeeklyTss * 1.05);
      body += `- Weekly target: ${targetTss} TSS/week (5% increase)\n`;
    }
  }

  // CTL projection
  body += '\n';
  const projectedCtlGain = avgWeeklyTss > 200 ? 3 : avgWeeklyTss > 100 ? 2 : 1;
  const projectedCtl = Math.round(currentCtl + projectedCtlGain * 4);
  body += isNL
    ? `Fitness projectie: CTL ${currentCtl.toFixed(0)} -> ~${projectedCtl} (bij consistent trainen)\n`
    : `Fitness projection: CTL ${currentCtl.toFixed(0)} -> ~${projectedCtl} (with consistent training)\n`;

  // Zone focus
  if (zoneProgression?.available && zoneProgression.focusAreas?.length > 0) {
    body += '\n';
    const zoneNamesNL = { endurance: 'duurvermogen', tempo: 'tempo', threshold: 'drempel', vo2max: 'VO2max', anaerobic: 'anaeroob' };
    const zoneNamesEN = { endurance: 'endurance', tempo: 'tempo', threshold: 'threshold', vo2max: 'VO2max', anaerobic: 'anaerobic' };
    const zoneNames = isNL ? zoneNamesNL : zoneNamesEN;

    body += isNL ? 'Zone focus:\n' : 'Zone focus:\n';
    body += isNL
      ? `- Prioriteit: ${zoneProgression.focusAreas.map(z => zoneNames[z]).join(', ')}\n`
      : `- Priority: ${zoneProgression.focusAreas.map(z => zoneNames[z]).join(', ')}\n`;
  }

  // Phase guidance
  body += '\n';
  const phaseName = phaseInfo.phaseName.toLowerCase();
  if (isNL) {
    body += 'Fase advies:\n';
    if (phaseName.includes('base')) {
      body += '- Bouw volume geleidelijk op (max 10% per week)\n';
      body += '- Houd 80% van de training in Z2\n';
    } else if (phaseName.includes('build')) {
      body += '- Behoud volume, verhoog intensiteit\n';
      body += '- 2-3 key workouts per week\n';
    } else {
      body += '- Focus op consistentie\n';
      body += '- Varieer trainingsvormen\n';
    }
  } else {
    body += 'Phase guidance:\n';
    if (phaseName.includes('base')) {
      body += '- Build volume gradually (max 10% per week)\n';
      body += '- Keep 80% of training in Z2\n';
    } else if (phaseName.includes('build')) {
      body += '- Maintain volume, increase intensity\n';
      body += '- 2-3 key workouts per week\n';
    } else {
      body += '- Focus on consistency\n';
      body += '- Vary training types\n';
    }
  }

  body += '\n- IntervalCoach\n';

  Logger.log("Subject: " + subject);
  Logger.log("\n--- EMAIL BODY ---\n");
  Logger.log(body);
  Logger.log("\n--- END PREVIEW ---");
}

/**
 * Test Yesterday's Review section in daily email
 * Previews how the last workout analysis appears in the email
 */
function testYesterdaysReview() {
  Logger.log("=== YESTERDAY'S REVIEW TEST ===\n");
  requireValidConfig();

  const lang = USER_SETTINGS.LANGUAGE || 'en';
  const isNL = lang === 'nl';

  // Get the last stored workout analysis
  const lastWorkoutAnalysis = getLastWorkoutAnalysis();

  if (!lastWorkoutAnalysis || !lastWorkoutAnalysis.date) {
    Logger.log("No recent workout analysis found.");
    Logger.log("Run a workout through checkForCompletedWorkouts() first, or mock the data below.");

    // Create mock data for testing
    const mockAnalysis = {
      date: formatDateISO(new Date(Date.now() - 86400000)), // Yesterday
      activityName: 'Sweet Spot Intervals',
      effectiveness: 8,
      difficultyMatch: 'as_expected',
      keyInsight: isNL
        ? 'Goede uitvoering van de intervallen. Power was consistent.'
        : 'Good execution of the intervals. Power was consistent.'
    };

    Logger.log("\n--- Using mock data for testing ---");
    Logger.log("Mock analysis: " + JSON.stringify(mockAnalysis, null, 2));

    testWithAnalysis(mockAnalysis, isNL);
    return;
  }

  Logger.log("Found last workout analysis:");
  Logger.log("  Date: " + lastWorkoutAnalysis.date);
  Logger.log("  Activity: " + (lastWorkoutAnalysis.activityName || 'Unknown'));
  Logger.log("  Effectiveness: " + (lastWorkoutAnalysis.effectiveness || 'N/A'));
  Logger.log("  Difficulty Match: " + (lastWorkoutAnalysis.difficultyMatch || 'N/A'));

  testWithAnalysis(lastWorkoutAnalysis, isNL);
}

function testWithAnalysis(lastWorkoutAnalysis, isNL) {
  // Fetch other required data
  const wellnessRecords = fetchWellnessData(7);
  const wellness = createWellnessSummary(wellnessRecords);
  const fitnessMetrics = fetchFitnessMetrics();
  const goals = fetchUpcomingGoals();
  const targetDate = goals?.available && goals?.primaryGoal ? goals.primaryGoal.date : USER_SETTINGS.TARGET_DATE;
  const phaseInfo = calculateTrainingPhase(targetDate);
  const upcomingDays = fetchUpcomingPlaceholders(7);
  const weekProgress = checkWeekProgress();

  // Mock workout selection
  const mockWorkout = {
    type: 'Endurance_Z2',
    explanation: 'Light endurance ride to continue recovery.'
  };

  const mockSelection = {
    reason: isNL
      ? 'Na gisteren is vandaag een rustige duurtraining ideaal.'
      : 'After yesterday, a light endurance ride is ideal today.',
    varietyNote: ''
  };

  // Build the email with the Yesterday's Review section
  const params = {
    wellness: wellness,
    weekProgress: weekProgress,
    upcomingDays: upcomingDays,
    summary: fitnessMetrics,
    phaseInfo: phaseInfo,
    workout: mockWorkout,
    workoutSelection: mockSelection,
    lastWorkoutAnalysis: lastWorkoutAnalysis
  };

  Logger.log("\n--- EMAIL PREVIEW WITH YESTERDAY'S REVIEW ---\n");

  const emailBody = buildWhoopStyleWorkoutEmail(params, isNL);
  Logger.log(emailBody);

  Logger.log("\n=== TEST COMPLETE ===");
}

/**
 * Test Yesterday's Review with different day offsets
 * Shows how the label changes for 1, 2, and 3 days ago
 */
function testYesterdaysReviewDayLabels() {
  Logger.log("=== YESTERDAY'S REVIEW - DAY LABELS TEST ===\n");

  const lang = USER_SETTINGS.LANGUAGE || 'en';
  const isNL = lang === 'nl';

  const today = new Date();
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());

  // Test 1, 2, and 3 days ago
  [1, 2, 3].forEach(daysAgo => {
    const workoutDate = new Date(Date.now() - daysAgo * 86400000);
    const dateStr = formatDateISO(workoutDate);

    let whenLabel;
    if (daysAgo === 1) {
      whenLabel = isNL ? 'Gisteren' : 'Yesterday';
    } else if (daysAgo === 2) {
      whenLabel = isNL ? 'Eergisteren' : '2 days ago';
    } else {
      whenLabel = isNL ? '3 dagen geleden' : '3 days ago';
    }

    Logger.log(`${daysAgo} day(s) ago (${dateStr}): "${whenLabel}"`);
  });

  // Test 4 days ago (should not show)
  Logger.log("\n4 days ago: Would NOT show (outside 3-day window)");

  Logger.log("\n=== TEST COMPLETE ===");
}

/**
 * Test reschedule suggestion feature
 * Shows how the system suggests alternative days when a rest day is recommended
 */
function testRescheduleSuggestion() {
  Logger.log("=== RESCHEDULE SUGGESTION TEST ===\n");
  requireValidConfig();

  const lang = USER_SETTINGS.LANGUAGE || 'en';
  const isNL = lang === 'nl';

  // Fetch real data
  const wellnessRecords = fetchWellnessData(7);
  const wellness = createWellnessSummary(wellnessRecords);
  const upcomingDays = fetchUpcomingPlaceholders(7);
  const weekProgress = checkWeekProgress();

  Logger.log("Current wellness status: " + (wellness?.recoveryStatus || "Unknown"));
  Logger.log("Recovery %: " + (wellness?.today?.recovery || "N/A"));

  Logger.log("\nUpcoming days:");
  upcomingDays.forEach((day, i) => {
    const activity = day.activityType || (day.hasEvent ? `[${day.eventCategory}] Event` : "-");
    Logger.log(`  ${i === 0 ? '>' : ' '} ${day.dayName} (${day.date}): ${activity}${day.placeholderName ? ' - ' + day.placeholderName : ''}`);
  });

  // Test with today's data
  const todayPlaceholder = upcomingDays[0];

  Logger.log("\n--- Testing with actual today's data ---");
  const reschedule = suggestWorkoutReschedule(todayPlaceholder, upcomingDays, wellness, weekProgress);

  Logger.log("\nResult:");
  Logger.log("  Suggest reschedule: " + reschedule.suggestReschedule);
  Logger.log("  Today's workout: " + JSON.stringify(reschedule.todayWorkout));
  Logger.log("  Reasoning: " + reschedule.reasoning);

  if (reschedule.candidates.length > 0) {
    Logger.log("\n  Candidates:");
    reschedule.candidates.forEach((c, i) => {
      Logger.log(`    ${i + 1}. ${c.dayName} (${c.date}) - ${c.daysFromNow} days out`);
      Logger.log(`       Confidence: ${c.confidence}`);
      Logger.log(`       Reason: ${c.reason}`);
    });
  } else {
    Logger.log("\n  No suitable reschedule candidates found.");
  }

  // Test formatted output
  Logger.log("\n--- Formatted email section ---");
  const formatted = formatRescheduleSuggestion(reschedule, isNL);
  if (formatted) {
    Logger.log(formatted);
  } else {
    Logger.log("(No reschedule section - no workout to reschedule or no candidates)");
  }

  // Test with mock low recovery
  Logger.log("\n\n--- Testing with mock RED recovery ---");
  const mockWellnessRed = {
    ...wellness,
    recoveryStatus: "Red - Strained",
    today: { ...wellness?.today, recovery: 28 }
  };

  const mockTodayRun = {
    activityType: "Run",
    placeholderName: "Run - 45min",
    duration: { min: 40, max: 50 }
  };

  const rescheduleRed = suggestWorkoutReschedule(mockTodayRun, upcomingDays, mockWellnessRed, weekProgress);
  Logger.log("Result with red recovery:");
  Logger.log("  Suggest reschedule: " + rescheduleRed.suggestReschedule);
  Logger.log("  Reasoning: " + rescheduleRed.reasoning);
  if (rescheduleRed.candidates.length > 0) {
    Logger.log("  Best option: " + rescheduleRed.candidates[0].dayName + " (" + rescheduleRed.candidates[0].reason + ")");
  }

  Logger.log("\n=== TEST COMPLETE ===");
}

/**
 * Test creating week labels in Intervals.icu calendar
 * Creates NOTE events with week type (Build/Recovery/Race Week)
 */
function testWeekLabels() {
  Logger.log("=== TESTING WEEK LABELS ===\n");

  // Gather required data
  const fitnessMetrics = fetchFitnessMetrics();
  const goals = fetchUpcomingGoals();
  const phaseInfo = goals?.available && goals?.primaryGoal
    ? calculateTrainingPhase(goals.primaryGoal.date)
    : calculateTrainingPhase(USER_SETTINGS.TARGET_DATE);

  let zoneProgression = null;
  try {
    zoneProgression = calculateZoneProgression(42);
  } catch (e) {
    Logger.log("Zone progression failed: " + e.toString());
  }

  const wellnessRecords = fetchWellnessDataEnhanced(7);
  const wellnessSummary = createWellnessSummary(wellnessRecords);
  const deloadCheck = checkDeloadNeeded(fitnessMetrics, wellnessSummary);

  Logger.log("Deload check: " + JSON.stringify(deloadCheck));

  // Generate outlook
  const fourWeekOutlook = generateFourWeekOutlook(fitnessMetrics, phaseInfo, zoneProgression, deloadCheck);

  if (!fourWeekOutlook) {
    Logger.log("ERROR: Could not generate 4-week outlook");
    return;
  }

  Logger.log("\n4-Week Outlook:");
  fourWeekOutlook.weeks.forEach(w => {
    Logger.log(`  Week ${w.weekNumber} (${w.weekStart}): ${w.type} - ${w.focus}`);
  });

  // Create labels
  Logger.log("\nCreating week labels in Intervals.icu...");
  const labelResults = createWeekLabelEvents(fourWeekOutlook);

  Logger.log("\nResults:");
  Logger.log("  Created: " + labelResults.created);
  Logger.log("  Skipped: " + labelResults.skipped);

  if (labelResults.results && labelResults.results.length > 0) {
    Logger.log("\nPer week:");
    labelResults.results.forEach(r => {
      const status = r.skipped ? 'SKIPPED (exists)' : (r.success ? 'CREATED' : 'FAILED');
      Logger.log(`  Week ${r.week} (${r.date}): ${r.type} - ${status}`);
    });
  }

  Logger.log("\n=== TEST COMPLETE ===");
}
