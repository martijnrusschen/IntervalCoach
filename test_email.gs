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
 * Test unified daily email - tests all three types
 * @param {string} emailType - 'workout', 'rest', or 'status' (default: 'status')
 */
function testUnifiedDailyEmail(emailType) {
  const type = emailType || 'status';
  Logger.log("=== UNIFIED DAILY EMAIL TEST (" + type.toUpperCase() + ") ===");
  requireValidConfig();

  // Fetch all required data
  const wellnessRecords = fetchWellnessData(7);
  const wellness = createWellnessSummary(wellnessRecords);
  const fitnessMetrics = fetchFitnessMetrics();
  const goals = fetchUpcomingGoals();
  const targetDate = goals?.available && goals?.primaryGoal ? goals.primaryGoal.date : USER_SETTINGS.TARGET_DATE;
  const phaseInfo = calculateTrainingPhase(targetDate);
  const upcomingDays = fetchUpcomingPlaceholders(7);
  const weekProgress = checkWeekProgress();

  // Check for mid-week adaptation (unified approach)
  let midWeekAdaptation = null;
  const adaptationCheck = checkMidWeekAdaptationNeeded(weekProgress, upcomingDays, wellness, fitnessMetrics);
  if (adaptationCheck.needed) {
    Logger.log("Adaptation needed: " + adaptationCheck.reason);
    // Note: In test mode, we don't apply changes, just show what would happen
  }

  Logger.log("Recovery: " + (wellness.available ? wellness.recoveryStatus : "Unknown"));
  Logger.log("Phase: " + phaseInfo.phaseName + " (" + phaseInfo.weeksOut + " weeks out)");
  Logger.log("Week Progress: " + weekProgress.summary);

  // Build email params based on type
  const emailParams = {
    type: type,
    summary: fitnessMetrics,
    phaseInfo: phaseInfo,
    wellness: wellness,
    weekProgress: weekProgress,
    upcomingDays: upcomingDays,
    midWeekAdaptation: midWeekAdaptation
  };

  // Add type-specific params
  if (type === 'workout') {
    emailParams.workout = {
      type: 'Test_Workout',
      explanation: 'This is a test workout explanation.',
      recommendationReason: 'Testing the unified email with a fake workout.',
      recommendationScore: 8
    };
    emailParams.powerProfile = { available: false };
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
 * Quick test wrappers for each email type
 */
function testUnifiedEmail_Status() { testUnifiedDailyEmail('status'); }
function testUnifiedEmail_Rest() { testUnifiedDailyEmail('rest'); }
function testUnifiedEmail_Workout() { testUnifiedDailyEmail('workout'); }
function testUnifiedEmail_GroupRide() { testUnifiedDailyEmail('group_ride'); }

/**
 * Test daily workout email structure (does not send email)
 * Verifies the simplified email format with helper functions
 */
function testDailyEmailStructure() {
  Logger.log("=== DAILY EMAIL STRUCTURE TEST ===\n");

  // Fetch all required data
  const wellnessRecords = fetchWellnessData(7);
  const wellness = createWellnessSummary(wellnessRecords);

  const goals = fetchUpcomingGoals();
  const targetDate = goals?.available && goals?.primaryGoal ? goals.primaryGoal.date : USER_SETTINGS.TARGET_DATE;
  const phaseInfo = calculateTrainingPhase(targetDate);
  phaseInfo.goalDescription = goals?.available ? buildGoalDescription(goals) : USER_SETTINGS.GOAL_DESCRIPTION;

  const summary = createAthleteSummary();

  const powerCurve = fetchPowerCurve();
  const powerProfile = analyzePowerProfile(powerCurve);

  const t = getTranslations();

  // Mock workout
  const mockWorkout = {
    type: "Tempo_SweetSpot",
    duration: { min: 60, max: 75 },
    estimatedTSS: 65,
    explanation: "Today focuses on sweet spot training to build sustained power at 88-94% FTP.",
    workoutDescription: "Warmup 10min, 3x12min @ 90% FTP with 4min recovery, cooldown 10min",
    recommendationReason: "Good recovery status and base phase focus on aerobic development"
  };

  Logger.log("--- Input Data ---");
  Logger.log("Phase: " + phaseInfo.phaseName + " (" + phaseInfo.weeksOut + " weeks out)");
  Logger.log("Recovery: " + (wellness.available ? wellness.recoveryStatus : "N/A"));
  Logger.log("TSB: " + (summary.tsb_current?.toFixed(1) || "N/A"));
  Logger.log("Workout: " + mockWorkout.type);

  // Test buildTodaySection
  Logger.log("\n--- buildTodaySection Output ---");
  const todaySection = buildTodaySection(t, mockWorkout, wellness, summary, phaseInfo);
  Logger.log(todaySection);

  // Test buildWorkoutStrategySection
  Logger.log("\n--- buildWorkoutStrategySection Output ---");
  const strategySection = buildWorkoutStrategySection(t, mockWorkout);
  Logger.log(strategySection);

  // Test calculateWorkoutImpact
  Logger.log("\n--- calculateWorkoutImpact ---");
  const impact = calculateWorkoutImpact(summary, mockWorkout);
  if (impact) {
    Logger.log("CTL Change: " + impact.ctlChange.toFixed(2));
    Logger.log("Estimated TSS: " + impact.estimatedTSS);
  } else {
    Logger.log("Impact calculation failed");
  }

  // Show full email preview (without Coach's Note for speed)
  Logger.log("\n--- Full Email Preview ---");
  let preview = t.greeting + "\n\n";
  preview += "[Coach's Note would appear here]\n\n";
  preview += todaySection;
  preview += strategySection;
  preview += "\n" + t.footer;
  Logger.log(preview);

  Logger.log("\n=== DAILY EMAIL TEST COMPLETE ===");
  Logger.log("To send actual email, run generateOptimalZwiftWorkoutsAutoByGemini()");
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

  // ============ LOOKING AHEAD ============
  body += '\n';
  body += isNL ? 'VOORUITBLIK\n\n' : 'LOOKING AHEAD\n\n';
  body += isNL
    ? 'Focus komende maand op consistentie en geleidelijke opbouw.\n'
    : 'Focus next month on consistency and gradual building.\n';

  body += '\n- IntervalCoach\n';

  Logger.log("Subject: " + subject);
  Logger.log("\n--- EMAIL BODY ---\n");
  Logger.log(body);
  Logger.log("\n--- END PREVIEW ---");
}
