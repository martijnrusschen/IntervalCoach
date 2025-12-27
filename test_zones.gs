/**
 * IntervalCoach - Zone Progression & Cross-Sport Tests
 *
 * Tests for zone progression tracking, personalized zones, and cross-sport equivalency.
 * Run these from the Apps Script editor to test zone features.
 */

// =========================================================
// ZONE PROGRESSION TESTS
// =========================================================

/**
 * Test zone progression calculation and recommendations
 * Verifies zone-specific fitness tracking and AI recommendations
 */
function testZoneProgression() {
  Logger.log("=== ZONE PROGRESSION TEST ===\n");

  // 1. Test zone exposure analysis for a single activity
  Logger.log("--- Zone Exposure Analysis ---");
  const today = new Date();
  const weekAgo = new Date(today);
  weekAgo.setDate(today.getDate() - 7);

  const activitiesResult = fetchIcuApi("/athlete/0/activities?oldest=" + formatDateISO(weekAgo) + "&newest=" + formatDateISO(today));

  if (activitiesResult.success && activitiesResult.data.length > 0) {
    const sampleActivity = activitiesResult.data.find(a => a.type === "Ride" || a.type === "Run");

    if (sampleActivity) {
      Logger.log("Sample activity: " + sampleActivity.name + " (" + sampleActivity.type + ")");
      Logger.log("Date: " + sampleActivity.start_date_local);

      const exposure = analyzeZoneExposure(sampleActivity);
      if (exposure) {
        Logger.log("Dominant zone: " + exposure.dominantZone);
        Logger.log("Training stimulus: " + exposure.stimulus);
        Logger.log("TSS: " + exposure.tss);
        Logger.log("Zone distribution (%):");
        for (const [zone, pct] of Object.entries(exposure.zonePercentages)) {
          if (pct > 0) {
            Logger.log("  " + zone.toUpperCase() + ": " + pct + "%");
          }
        }
      } else {
        Logger.log("Activity too short for zone analysis");
      }
    } else {
      Logger.log("No Ride/Run activities found in last 7 days");
    }
  } else {
    Logger.log("Failed to fetch activities: " + (activitiesResult.error || "No data"));
  }

  // 2. Test full zone progression calculation
  Logger.log("\n--- Zone Progression Calculation (42 days) ---");
  const progression = calculateZoneProgression(42);

  if (progression.available) {
    Logger.log("Activities analyzed: " + progression.activitiesAnalyzed);
    Logger.log("Period: " + progression.periodDays + " days");
    Logger.log("\nZone Levels (1.0-10.0 scale):");

    for (const [zone, data] of Object.entries(progression.progression)) {
      const zoneName = zone.charAt(0).toUpperCase() + zone.slice(1);
      const bar = "#".repeat(Math.round(data.level)) + "-".repeat(10 - Math.round(data.level));
      Logger.log("  " + zoneName.padEnd(12) + " " + data.level.toFixed(1) + " " + bar + " (" + data.trend + ")");
      Logger.log("    Sessions: " + data.sessions + " | Total: " + data.totalMinutes + " min | Last: " + (data.lastTrained || "never"));
    }

    Logger.log("\nIdentified patterns:");
    Logger.log("  Strengths: " + progression.strengths.join(", "));
    Logger.log("  Focus Areas: " + progression.focusAreas.join(", "));
  } else {
    Logger.log("Zone progression calculation failed");
  }

  // 3. Test storage and retrieval
  Logger.log("\n--- Zone Progression Storage ---");
  if (progression.available) {
    const stored = storeZoneProgression(progression);
    Logger.log("Stored: " + (stored ? "OK" : "FAILED"));

    const retrieved = getZoneProgression(false);
    Logger.log("Retrieved from cache: " + (retrieved.available ? "OK" : "FAILED"));
    Logger.log("Calculated at: " + retrieved.calculatedAt);
  }

  // 4. Test AI recommendations
  Logger.log("\n--- AI Zone Recommendations ---");
  if (progression.available) {
    const goals = fetchUpcomingGoals();
    const targetDate = goals?.available && goals?.primaryGoal ? goals.primaryGoal.date : USER_SETTINGS.TARGET_DATE;
    const phaseInfo = calculateTrainingPhase(targetDate);

    const recommendations = getZoneRecommendations(progression, phaseInfo, goals);

    if (recommendations) {
      Logger.log("AI Enhanced: " + (recommendations.aiEnhanced || false));
      Logger.log("Summary: " + recommendations.summary);
      Logger.log("Priority zone: " + recommendations.priorityZone);
      Logger.log("Reason: " + recommendations.priorityReason);

      if (recommendations.weeklyRecommendations) {
        Logger.log("\nWeekly recommendations:");
        recommendations.weeklyRecommendations.forEach(function(rec, i) {
          Logger.log("  " + (i + 1) + ". " + rec);
        });
      }

      if (recommendations.avoidanceNote) {
        Logger.log("\nAvoidance note: " + recommendations.avoidanceNote);
      }

      Logger.log("Long-term trend: " + recommendations.longTermTrend);
    } else {
      Logger.log("AI recommendations failed");
    }
  }

  // 5. Test formatted output
  Logger.log("\n--- Formatted Zone Progression (for email) ---");
  if (progression.available) {
    const formatted = formatZoneProgressionText(progression);
    Logger.log(formatted);
  }

  // 6. Test zone progression history
  Logger.log("\n--- Zone Progression History ---");
  if (progression.available) {
    addZoneProgressionToHistory(progression);
    const history = getZoneProgressionHistory(4);
    Logger.log("History records: " + history.length);
    history.forEach(function(snapshot, i) {
      Logger.log("  " + (i + 1) + ". " + snapshot.date);
    });
  }

  Logger.log("\n=== ZONE PROGRESSION TEST COMPLETE ===");
}

// =========================================================
// CROSS-SPORT EQUIVALENCY TESTS
// =========================================================

/**
 * Test cross-sport zone equivalency between cycling and running
 */
function testCrossSportEquivalency() {
  Logger.log("=== CROSS-SPORT EQUIVALENCY TEST ===\n");

  // 1. Fetch both cycling and running data
  Logger.log("--- Cycling Data ---");
  const powerCurve = fetchPowerCurve();
  if (powerCurve && powerCurve.available) {
    Logger.log("FTP: " + (powerCurve.currentEftp || powerCurve.eFTP || powerCurve.ftp) + "W");
    Logger.log("W': " + (powerCurve.wPrime ? (powerCurve.wPrime / 1000).toFixed(1) + " kJ" : "N/A"));
    Logger.log("Weight: " + (powerCurve.weight || "N/A") + "kg");
  } else {
    Logger.log("Cycling data not available");
  }

  Logger.log("\n--- Running Data ---");
  const runningData = fetchRunningData();
  if (runningData && runningData.available) {
    Logger.log("Critical Speed: " + runningData.criticalSpeed + "/km");
    Logger.log("D': " + (runningData.dPrime ? Math.round(runningData.dPrime) + "m" : "N/A"));
    Logger.log("Threshold Pace: " + (runningData.thresholdPace || "N/A"));
  } else {
    Logger.log("Running data not available");
  }

  // 2. Calculate cross-sport equivalencies
  Logger.log("\n--- Cross-Sport Equivalencies ---");
  const equivalencies = calculateCrossSportEquivalency();

  if (equivalencies.available) {
    Logger.log("Cross-sport data available: YES");

    Logger.log("\nThreshold Comparison:");
    Logger.log("  Cycling FTP: " + equivalencies.crossSportInsights.thresholdComparison.cycling);
    Logger.log("  Running CS: " + equivalencies.crossSportInsights.thresholdComparison.running);

    Logger.log("\nAnaerobic Capacity:");
    Logger.log("  Cycling W': " + equivalencies.crossSportInsights.anaerobicCapacity.cycling);
    Logger.log("  Running D': " + equivalencies.crossSportInsights.anaerobicCapacity.running);

    Logger.log("\nZone Equivalencies:");
    Logger.log("Zone       | Cycling      | Running");
    Logger.log("-----------|--------------|-------------");
    for (const equiv of equivalencies.equivalencies) {
      const zoneName = equiv.zone.padEnd(10);
      const cyclingPct = equiv.cycling.pctFtp.padEnd(12);
      const runningPct = equiv.running.pctCS;
      Logger.log(zoneName + " | " + cyclingPct + " | " + runningPct);
    }

    // 3. Test zone mapping functions
    Logger.log("\n--- Zone Mapping Functions ---");
    const cyclingZ4 = getRunningEquivalent('Z4', equivalencies);
    if (cyclingZ4) {
      Logger.log("Cycling Z4 (Threshold) -> Running: " + cyclingZ4.zone + " " + cyclingZ4.pace);
    }

    const runningZ5 = getCyclingEquivalent('Z5', equivalencies);
    if (runningZ5) {
      Logger.log("Running Z5 (VO2max) -> Cycling: " + runningZ5.zone + " " + runningZ5.watts);
    }

    // 4. Test AI recommendations
    Logger.log("\n--- AI Cross-Sport Recommendations ---");
    const goals = fetchUpcomingGoals();
    const targetDate = goals?.available && goals?.primaryGoal ? goals.primaryGoal.date : USER_SETTINGS.TARGET_DATE;
    const phaseInfo = calculateTrainingPhase(targetDate);
    const zoneProgression = calculateZoneProgression();

    const recommendations = generateCrossSportRecommendations(equivalencies, zoneProgression, phaseInfo, goals);

    if (recommendations && recommendations.available) {
      Logger.log("AI Enhanced: " + (recommendations.aiEnhanced || false));
      Logger.log("\nCross-Training Strategy:");
      Logger.log("  " + recommendations.crossTrainingStrategy);

      Logger.log("\nCycling -> Running Transfer:");
      Logger.log("  " + recommendations.cyclingToRunningTransfer.summary);
      Logger.log("  Best zones: " + recommendations.cyclingToRunningTransfer.bestZones.join(", "));
      Logger.log("  Tip: " + recommendations.cyclingToRunningTransfer.tip);

      Logger.log("\nRunning -> Cycling Transfer:");
      Logger.log("  " + recommendations.runningToCyclingTransfer.summary);
      Logger.log("  Best zones: " + recommendations.runningToCyclingTransfer.bestZones.join(", "));
      Logger.log("  Tip: " + recommendations.runningToCyclingTransfer.tip);

      Logger.log("\nWeekly Mix Recommendation:");
      Logger.log("  Cycling days: " + recommendations.weeklyMixRecommendation.cyclingDays);
      Logger.log("  Running days: " + recommendations.weeklyMixRecommendation.runningDays);
      Logger.log("  Rationale: " + recommendations.weeklyMixRecommendation.rationale);

      Logger.log("\nKey Insight: " + recommendations.keyInsight);

      if (recommendations.warnings && recommendations.warnings.length > 0) {
        Logger.log("\nWarnings:");
        recommendations.warnings.forEach(function(warning) {
          Logger.log("  - " + warning);
        });
      }
    } else {
      Logger.log("AI recommendations not available");
    }

    // 5. Test formatted output
    Logger.log("\n--- Formatted Cross-Sport Section (for email) ---");
    const formatted = formatCrossSportSection(equivalencies);
    Logger.log(formatted);

  } else {
    Logger.log("Cross-sport data not available (need both cycling and running data)");
    Logger.log("Cycling available: " + equivalencies.cycling.available);
    Logger.log("Running available: " + equivalencies.running.available);
  }

  Logger.log("\n=== CROSS-SPORT EQUIVALENCY TEST COMPLETE ===");
}

/**
 * Test personalized zone boundaries analysis
 */
function testPersonalizedZones() {
  Logger.log("=== PERSONALIZED ZONE BOUNDARIES TEST ===\n");

  // 1. Analyze zone boundaries
  Logger.log("--- Power Curve Analysis ---");
  const zoneAnalysis = analyzeZoneBoundaries();

  if (!zoneAnalysis.available) {
    Logger.log("ERROR: " + zoneAnalysis.reason);
    return;
  }

  Logger.log("FTP: " + zoneAnalysis.ftp + "W");
  Logger.log("\nPower Ratios (vs FTP):");
  Logger.log("  5s:  " + zoneAnalysis.ratios.peak5s.toFixed(2) + " (benchmark: 2.0)");
  Logger.log("  1min: " + zoneAnalysis.ratios.peak1min.toFixed(2) + " (benchmark: 1.35)");
  Logger.log("  5min: " + zoneAnalysis.ratios.peak5min.toFixed(2) + " (benchmark: 1.10)");
  Logger.log("  20min: " + zoneAnalysis.ratios.peak20min.toFixed(2) + " (benchmark: 1.05)");
  Logger.log("  60min: " + zoneAnalysis.ratios.peak60min.toFixed(2) + " (benchmark: 0.95)");

  Logger.log("\nCapacity Assessment:");
  Logger.log("  Sprint: " + zoneAnalysis.sprintCapacity);
  Logger.log("  Anaerobic: " + zoneAnalysis.anaerobicCapacity);
  Logger.log("  VO2max: " + zoneAnalysis.vo2maxCapacity);
  Logger.log("  Aerobic Durability: " + zoneAnalysis.aerobicDurability);
  if (zoneAnalysis.tteEstimate) {
    Logger.log("  TTE Estimate: " + zoneAnalysis.tteEstimate + " min");
  }

  // 2. Show zone recommendations
  Logger.log("\n--- Zone Recommendations ---");
  const recs = zoneAnalysis.zoneRecommendations;

  Logger.log("\nCurrent vs Suggested Zones:");
  Logger.log("Zone       | Current     | Suggested");
  Logger.log("-----------|-------------|-------------");
  Object.keys(recs.currentZones).forEach(zone => {
    const curr = recs.currentZones[zone];
    const sugg = recs.suggestedZones[zone];
    const changed = curr.low !== sugg.low || curr.high !== sugg.high;
    Logger.log(
      zone.toUpperCase().padEnd(10) + " | " +
      (curr.low + "-" + curr.high + "%").padEnd(11) + " | " +
      (sugg.low + "-" + sugg.high + "%") +
      (changed ? " *" : "")
    );
  });

  if (recs.adjustments.length > 0) {
    Logger.log("\nAdjustments:");
    recs.adjustments.forEach(a => Logger.log("  - " + a));
  }

  if (recs.insights.length > 0) {
    Logger.log("\nInsights:");
    recs.insights.forEach(i => Logger.log("  - " + i));
  }

  // 3. Get AI recommendations
  Logger.log("\n--- AI Zone Recommendations ---");
  const goals = fetchUpcomingGoals();
  const aiRecs = generateAIZoneRecommendations(zoneAnalysis, goals);

  if (aiRecs.available) {
    Logger.log("AI Enhanced: " + aiRecs.aiEnhanced);
    Logger.log("\nProfile Type: " + aiRecs.profileType);
    Logger.log("\nSummary:");
    Logger.log("  " + aiRecs.profileSummary);
    Logger.log("\nZone Philosophy:");
    Logger.log("  " + aiRecs.zonePhilosophy);

    if (aiRecs.trainingImplications && aiRecs.trainingImplications.length > 0) {
      Logger.log("\nTraining Implications:");
      aiRecs.trainingImplications.forEach(t => Logger.log("  - " + t));
    }

    if (aiRecs.warnings && aiRecs.warnings.length > 0) {
      Logger.log("\nWarnings:");
      aiRecs.warnings.forEach(w => Logger.log("  ! " + w));
    }
  } else {
    Logger.log("AI recommendations not available");
  }

  Logger.log("\n=== PERSONALIZED ZONE BOUNDARIES TEST COMPLETE ===");
}
