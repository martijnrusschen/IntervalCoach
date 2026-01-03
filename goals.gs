/**
 * IntervalCoach - Goals & Training Phase
 *
 * Goal event fetching and training phase calculation.
 */

// =========================================================
// GOALS & EVENTS
// =========================================================

/**
 * Fetch upcoming goal events (A, B, and C priority races) from Intervals.icu
 * @returns {object} { available, primaryGoal, secondaryGoals, subGoals, allGoals }
 */
function fetchUpcomingGoals() {
  const today = new Date();
  const futureDate = new Date(today);
  futureDate.setMonth(today.getMonth() + 12); // Look 12 months ahead

  const oldestStr = formatDateISO(today);
  const newestStr = formatDateISO(futureDate);

  const result = {
    available: false,
    primaryGoal: null,      // Next A-race
    secondaryGoals: [],     // B-races
    subGoals: [],           // C-races (stepping stones toward A/B goals)
    allGoals: []            // All A, B, and C races
  };

  const endpoint = "/athlete/0/events?oldest=" + oldestStr + "&newest=" + newestStr;
  const apiResult = fetchIcuApi(endpoint);

  if (!apiResult.success) {
    Logger.log("Error fetching goals: " + apiResult.error);
    return result;
  }

  const events = apiResult.data;
  if (!Array.isArray(events)) {
    return result;
  }

  // Filter for A, B, and C priority races
  const goalEvents = events.filter(function(e) {
    return e.category === 'RACE_A' || e.category === 'RACE_B' || e.category === 'RACE_C';
  });

  // Sort by date
  goalEvents.sort(function(a, b) {
    return new Date(a.start_date_local) - new Date(b.start_date_local);
  });

  if (goalEvents.length > 0) {
    result.available = true;
    result.allGoals = goalEvents.map(function(e) {
      let priority = 'C';
      if (e.category === 'RACE_A') priority = 'A';
      else if (e.category === 'RACE_B') priority = 'B';
      return {
        name: e.name,
        date: e.start_date_local.split('T')[0],
        priority: priority,
        type: e.type,
        description: e.description || ''
      };
    });

    // Find the next A-race (primary goal)
    const nextARace = goalEvents.find(function(e) { return e.category === 'RACE_A'; });
    if (nextARace) {
      result.primaryGoal = {
        name: nextARace.name,
        date: nextARace.start_date_local.split('T')[0],
        type: nextARace.type,
        description: nextARace.description || ''
      };
    } else {
      // If no A-race, use the first B-race (not C-races - those are just group rides)
      const nextBRace = goalEvents.find(function(e) { return e.category === 'RACE_B'; });
      if (nextBRace) {
        result.primaryGoal = {
          name: nextBRace.name,
          date: nextBRace.start_date_local.split('T')[0],
          type: nextBRace.type,
          description: nextBRace.description || ''
        };
      }
      // If only C-races, don't set primaryGoal - they shouldn't influence phase
    }

    // Collect B-races
    result.secondaryGoals = goalEvents
      .filter(function(e) { return e.category === 'RACE_B'; })
      .map(function(e) {
        return {
          name: e.name,
          date: e.start_date_local.split('T')[0],
          type: e.type,
          description: e.description || ''
        };
      });

    // Collect C-races (subgoals/stepping stones)
    result.subGoals = goalEvents
      .filter(function(e) { return e.category === 'RACE_C'; })
      .map(function(e) {
        return {
          name: e.name,
          date: e.start_date_local.split('T')[0],
          type: e.type,
          description: e.description || ''
        };
      });
  }

  return result;
}

/**
 * Build a dynamic goal description from fetched goals
 * @param {object} goals - Goals object from fetchUpcomingGoals
 * @returns {string} Goal description string
 */
function buildGoalDescription(goals) {
  if (!goals.available || !goals.primaryGoal) {
    return USER_SETTINGS.GOAL_DESCRIPTION; // Fall back to manual setting
  }

  const primary = goals.primaryGoal;
  let description = primary.name;

  // Add date context
  const today = new Date();
  const targetDate = new Date(primary.date);
  const weeksOut = Math.ceil((targetDate - today) / (7 * 24 * 60 * 60 * 1000));

  description += " (" + primary.date + ", " + weeksOut + " weeks out)";

  // Add type
  if (primary.type) {
    description += ". Type: " + primary.type;
  }

  // Add description if available
  if (primary.description) {
    description += ". " + primary.description;
  }

  // Add secondary goals context
  if (goals.secondaryGoals?.length > 0) {
    const otherEvents = goals.secondaryGoals
      .filter(function(g) { return g.date !== primary.date; })
      .slice(0, 3)
      .map(function(g) { return g.name + " (" + g.date + ")"; });

    if (otherEvents.length > 0) {
      description += " Related events: " + otherEvents.join(", ");
    }
  }

  // Add C-races as stepping stones toward main goal
  if (goals.subGoals?.length > 0) {
    const steppingStones = goals.subGoals
      .filter(function(g) { return g.date !== primary.date; })
      .slice(0, 3)
      .map(function(g) { return g.name + " (" + g.date + ")"; });

    if (steppingStones.length > 0) {
      description += " Stepping stones: " + steppingStones.join(", ") + ".";
    }
  }

  // Add peak form indicator
  description += ". Peak form indicator: eFTP should reach or exceed FTP.";

  return description;
}

// =========================================================
// FITNESS TRAJECTORY ANALYSIS
// =========================================================

/**
 * Analyze fitness trajectory over recent weeks to determine phase readiness
 * Fetches historical CTL/eFTP data and identifies trends
 *
 * @param {number} weeks - Number of weeks to analyze (default 4)
 * @returns {object} Trajectory analysis with trends and phase readiness indicators
 */
function analyzeFitnessTrajectory(weeks) {
  weeks = weeks || 4;

  const result = {
    available: false,
    weeksAnalyzed: weeks,
    ctlTrajectory: {
      current: null,
      weeklyValues: [],
      weeklyChanges: [],
      avgChange: null,
      trend: 'unknown',  // 'building', 'stable', 'declining'
      consistency: null  // 0-100% how consistent the progression
    },
    eftpTrajectory: {
      current: null,
      target: null,
      weeklyValues: [],
      weeklyChanges: [],
      progressToTarget: null,  // percentage
      trend: 'unknown',
      onTrack: null  // true/false
    },
    recoveryTrend: {
      avgRecovery: null,
      avgSleep: null,
      avgHRV: null,
      trend: 'unknown',  // 'good', 'declining', 'poor'
      sustainableLoad: null  // true/false
    },
    phaseReadiness: {
      baseComplete: false,
      buildComplete: false,
      readyForSpecialty: false,
      readyForTaper: false,
      indicators: []
    }
  };

  try {
    // Fetch fitness trend for the past N weeks
    const trendDays = weeks * 7;
    const fitnessTrend = fetchFitnessTrend(trendDays);

    if (!fitnessTrend || fitnessTrend.length < 7) {
      Logger.log('Fitness trajectory: Insufficient data');
      return result;
    }

    result.available = true;

    // Get weekly snapshots (every 7th day, starting from most recent)
    const weeklySnapshots = [];
    for (let i = 0; i < weeks && i * 7 < fitnessTrend.length; i++) {
      const dayIndex = i * 7;
      if (fitnessTrend[dayIndex]) {
        weeklySnapshots.push(fitnessTrend[dayIndex]);
      }
    }

    // Reverse so oldest is first
    weeklySnapshots.reverse();

    // Analyze CTL trajectory
    if (weeklySnapshots.length >= 2) {
      result.ctlTrajectory.weeklyValues = weeklySnapshots.map(s => s.ctl).filter(v => v != null);
      result.ctlTrajectory.current = result.ctlTrajectory.weeklyValues[result.ctlTrajectory.weeklyValues.length - 1];

      // Calculate weekly changes
      for (let i = 1; i < result.ctlTrajectory.weeklyValues.length; i++) {
        const change = result.ctlTrajectory.weeklyValues[i] - result.ctlTrajectory.weeklyValues[i - 1];
        result.ctlTrajectory.weeklyChanges.push(Math.round(change * 10) / 10);
      }

      // Calculate average change
      if (result.ctlTrajectory.weeklyChanges.length > 0) {
        const sum = result.ctlTrajectory.weeklyChanges.reduce((a, b) => a + b, 0);
        result.ctlTrajectory.avgChange = Math.round((sum / result.ctlTrajectory.weeklyChanges.length) * 10) / 10;

        // Determine trend
        if (result.ctlTrajectory.avgChange >= 3) {
          result.ctlTrajectory.trend = 'building';
        } else if (result.ctlTrajectory.avgChange >= 0) {
          result.ctlTrajectory.trend = 'stable';
        } else {
          result.ctlTrajectory.trend = 'declining';
        }

        // Calculate consistency (how many weeks had positive changes)
        const positiveWeeks = result.ctlTrajectory.weeklyChanges.filter(c => c > 0).length;
        result.ctlTrajectory.consistency = Math.round((positiveWeeks / result.ctlTrajectory.weeklyChanges.length) * 100);
      }
    }

    // Analyze eFTP trajectory
    // Primary source: fetchPowerCurve() which gets eFTP from mmp_model
    // Fallback chain: fetchHistoricalEftp -> fetchFitnessMetrics
    let currentEftp = null;
    let targetFtp = USER_SETTINGS.MANUAL_FTP || null;

    // Try power curve first (most reliable source)
    const powerCurve = fetchPowerCurve();
    if (powerCurve?.available) {
      currentEftp = powerCurve.currentEftp || powerCurve.eFTP || null;
      // Also get manual FTP from power curve if not set in settings
      if (!targetFtp && powerCurve.manualFTP) {
        targetFtp = powerCurve.manualFTP;
      }
    }

    // Fallback to historical eFTP events
    if (!currentEftp) {
      currentEftp = fetchHistoricalEftp(new Date());
    }

    // Last resort: fetchFitnessMetrics
    if (!currentEftp) {
      const currentFitness = fetchFitnessMetrics();
      currentEftp = currentFitness?.eftp || null;
    }

    if (currentEftp) {
      result.eftpTrajectory.current = currentEftp;
      result.eftpTrajectory.target = targetFtp;

      // Always add current eFTP to weekly values
      result.eftpTrajectory.weeklyValues.push(currentEftp);

      // Try to fetch historical eFTP values (from SET_EFTP events)
      for (let i = 1; i < weeks; i++) {
        const date = new Date();
        date.setDate(date.getDate() - (i * 7));
        const historicalEftp = fetchHistoricalEftp(date);
        if (historicalEftp) {
          result.eftpTrajectory.weeklyValues.unshift(historicalEftp);
        }
      }

      // Calculate weekly changes if we have multiple data points
      if (result.eftpTrajectory.weeklyValues.length >= 2) {
        for (let i = 1; i < result.eftpTrajectory.weeklyValues.length; i++) {
          const change = result.eftpTrajectory.weeklyValues[i] - result.eftpTrajectory.weeklyValues[i - 1];
          result.eftpTrajectory.weeklyChanges.push(change);
        }
      }

      // Determine trend
      if (result.eftpTrajectory.weeklyChanges.length > 0) {
        const avgEftpChange = result.eftpTrajectory.weeklyChanges.reduce((a, b) => a + b, 0) / result.eftpTrajectory.weeklyChanges.length;
        if (avgEftpChange >= 1) {
          result.eftpTrajectory.trend = 'improving';
        } else if (avgEftpChange >= -1) {
          result.eftpTrajectory.trend = 'stable';
        } else {
          result.eftpTrajectory.trend = 'declining';
        }
      } else {
        // Only one data point - trend is stable (no change data)
        result.eftpTrajectory.trend = 'stable';
      }

      // Calculate progress to target
      if (targetFtp && currentEftp) {
        const gap = targetFtp - currentEftp;
        if (gap <= 0) {
          result.eftpTrajectory.progressToTarget = 100;
          result.eftpTrajectory.onTrack = true;
        } else {
          result.eftpTrajectory.progressToTarget = Math.round((currentEftp / targetFtp) * 100);
          // With only current data, assume on track if eFTP exists
          const avgEftpChange = result.eftpTrajectory.weeklyChanges.length > 0
            ? result.eftpTrajectory.weeklyChanges.reduce((a, b) => a + b, 0) / result.eftpTrajectory.weeklyChanges.length
            : 0;
          result.eftpTrajectory.onTrack = avgEftpChange >= 0;
        }
      } else if (currentEftp && !targetFtp) {
        // No target set - can't assess progress but eFTP is available
        result.eftpTrajectory.progressToTarget = null;
        result.eftpTrajectory.onTrack = null;
      }
    }

    // Analyze recovery trend
    const wellnessRecords = fetchWellnessDataEnhanced(weeks * 7);
    if (wellnessRecords && wellnessRecords.length > 0) {
      // Use correct field names: 'recovery' and 'sleep' (not 'recovery_score' and 'sleep_time')
      const validRecovery = wellnessRecords.filter(r => r.recovery != null).map(r => r.recovery);
      const validSleep = wellnessRecords.filter(r => r.sleep != null).map(r => r.sleep);
      const validHRV = wellnessRecords.filter(r => r.hrv != null).map(r => r.hrv);

      if (validRecovery.length > 0) {
        result.recoveryTrend.avgRecovery = Math.round(validRecovery.reduce((a, b) => a + b, 0) / validRecovery.length);
      }
      if (validSleep.length > 0) {
        // Sleep is in hours
        result.recoveryTrend.avgSleep = Math.round((validSleep.reduce((a, b) => a + b, 0) / validSleep.length) * 10) / 10;
      }
      if (validHRV.length > 0) {
        result.recoveryTrend.avgHRV = Math.round(validHRV.reduce((a, b) => a + b, 0) / validHRV.length);
      }

      // Determine recovery trend based on available data
      // Prefer recovery score if available, otherwise use HRV trend
      if (result.recoveryTrend.avgRecovery != null) {
        if (result.recoveryTrend.avgRecovery >= 50) {
          result.recoveryTrend.trend = 'good';
          result.recoveryTrend.sustainableLoad = true;
        } else if (result.recoveryTrend.avgRecovery >= 34) {
          result.recoveryTrend.trend = 'moderate';
          result.recoveryTrend.sustainableLoad = true;
        } else {
          result.recoveryTrend.trend = 'poor';
          result.recoveryTrend.sustainableLoad = false;
        }
      } else if (result.recoveryTrend.avgHRV != null) {
        // Fallback to HRV-based assessment if no recovery score
        // Average HRV > 50ms is generally good for most athletes
        if (result.recoveryTrend.avgHRV >= 55) {
          result.recoveryTrend.trend = 'good';
          result.recoveryTrend.sustainableLoad = true;
        } else if (result.recoveryTrend.avgHRV >= 40) {
          result.recoveryTrend.trend = 'moderate';
          result.recoveryTrend.sustainableLoad = true;
        } else {
          result.recoveryTrend.trend = 'poor';
          result.recoveryTrend.sustainableLoad = false;
        }
      }
    }

    // Determine phase readiness indicators
    const indicators = [];

    // Base Complete indicators: stable CTL, good aerobic foundation
    if (result.ctlTrajectory.current >= 40 &&
        result.ctlTrajectory.trend !== 'declining' &&
        result.ctlTrajectory.consistency >= 60) {
      result.phaseReadiness.baseComplete = true;
      indicators.push('Base fitness established (CTL ≥40, consistent progression)');
    }

    // Build Complete indicators: eFTP near target, CTL still building
    if (result.eftpTrajectory.progressToTarget >= 90 ||
        (result.eftpTrajectory.current && result.eftpTrajectory.target &&
         result.eftpTrajectory.current >= result.eftpTrajectory.target - 5)) {
      result.phaseReadiness.buildComplete = true;
      indicators.push('FTP target nearly achieved');
    }

    // Ready for Specialty: fitness foundation in place
    if (result.phaseReadiness.baseComplete &&
        result.ctlTrajectory.current >= 50 &&
        result.recoveryTrend.sustainableLoad) {
      result.phaseReadiness.readyForSpecialty = true;
      indicators.push('Ready for race-specific work');
    }

    // Ready for Taper: peak fitness achieved, time to shed fatigue
    if (result.phaseReadiness.buildComplete &&
        result.ctlTrajectory.current >= 60) {
      result.phaseReadiness.readyForTaper = true;
      indicators.push('Peak fitness achieved, ready to taper');
    }

    result.phaseReadiness.indicators = indicators;

  } catch (e) {
    Logger.log('Fitness trajectory analysis error: ' + e.toString());
  }

  return result;
}

/**
 * Check if athlete should transition to a different phase based on trajectory
 * Returns recommendation for phase adjustment
 *
 * @param {string} currentPhase - Current phase (Base, Build, Specialty, Taper)
 * @param {object} trajectory - Output from analyzeFitnessTrajectory()
 * @param {number} weeksOut - Weeks until goal
 * @returns {object} Phase transition recommendation
 */
function checkPhaseTransitionReadiness(currentPhase, trajectory, weeksOut) {
  const result = {
    shouldTransition: false,
    recommendedPhase: currentPhase,
    reason: '',
    urgency: 'low',  // low, medium, high
    adaptationType: null  // 'accelerate', 'delay', 'maintain'
  };

  if (!trajectory || !trajectory.available) {
    return result;
  }

  const pr = trajectory.phaseReadiness;
  const ctlTrend = trajectory.ctlTrajectory.trend;
  const eftpOnTrack = trajectory.eftpTrajectory.onTrack;
  const sustainableLoad = trajectory.recoveryTrend.sustainableLoad;

  // Analyze based on current phase
  switch (currentPhase) {
    case 'Base':
      // Should move to Build if base objectives achieved
      if (pr.baseComplete && weeksOut <= 12) {
        result.shouldTransition = true;
        result.recommendedPhase = 'Build';
        result.reason = 'Base fitness established, time to build FTP';
        result.urgency = 'medium';
        result.adaptationType = 'accelerate';
      }
      // Should stay in Base longer if not ready
      else if (!pr.baseComplete && weeksOut <= 10) {
        result.shouldTransition = false;
        result.reason = 'Base not yet complete - extend base phase';
        result.urgency = 'low';
        result.adaptationType = 'delay';
      }
      // Default: continue building base
      else {
        result.reason = 'Building aerobic base - on track for timeline';
        result.adaptationType = 'maintain';
      }
      break;

    case 'Build':
      // Should move to Specialty if build objectives achieved
      if (pr.buildComplete && weeksOut <= 6) {
        result.shouldTransition = true;
        result.recommendedPhase = 'Specialty';
        result.reason = 'FTP target achieved, time for race-specific work';
        result.urgency = 'medium';
        result.adaptationType = 'accelerate';
      }
      // Should move back to Base if overreaching
      else if (!sustainableLoad && ctlTrend === 'declining') {
        result.shouldTransition = true;
        result.recommendedPhase = 'Base';
        result.reason = 'Recovery compromised - return to base to rebuild';
        result.urgency = 'high';
        result.adaptationType = 'delay';
      }
      // Should stay in Build longer if behind
      else if (!eftpOnTrack && weeksOut > 4) {
        result.shouldTransition = false;
        result.reason = 'FTP not on track - extend build phase';
        result.urgency = 'low';
        result.adaptationType = 'delay';
      }
      // Default: continue building FTP
      else {
        result.reason = 'Building FTP - progressing well';
        result.adaptationType = 'maintain';
      }
      break;

    case 'Specialty':
      // Should move to Taper if ready
      if (pr.readyForTaper && weeksOut <= 3) {
        result.shouldTransition = true;
        result.recommendedPhase = 'Taper';
        result.reason = 'Peak fitness achieved, begin taper';
        result.urgency = 'high';
        result.adaptationType = 'accelerate';
      }
      // Should stay in Specialty longer if fitness still building
      else if (ctlTrend === 'building' && weeksOut > 2) {
        result.shouldTransition = false;
        result.reason = 'Still gaining fitness - continue specialty work';
        result.urgency = 'low';
        result.adaptationType = 'maintain';
      }
      // Default: continue race-specific work
      else {
        result.reason = 'Race-specific preparation in progress';
        result.adaptationType = 'maintain';
      }
      break;

    case 'Taper':
      // Stay in taper - no transition needed
      result.reason = 'In taper phase - maintain until race';
      result.adaptationType = 'maintain';
      break;

    default:
      // Unknown phase
      result.reason = 'Following current training plan';
      result.adaptationType = 'maintain';
      break;
  }

  return result;
}

// =========================================================
// TRAINING PHASE CALCULATION
// =========================================================

/**
 * Calculate training phase - AI-enhanced with trajectory-based adaptation
 * Uses fitness trajectory to determine phase readiness, not just calendar date
 *
 * @param {string} targetDate - Target date in yyyy-MM-dd format
 * @param {object} context - Optional full context for AI assessment
 * @returns {object} { phaseName, weeksOut, focus, aiEnhanced, reasoning, adjustments, trajectory, transitionRecommendation }
 */
function calculateTrainingPhase(targetDate, context) {
  const today = new Date();
  const target = new Date(targetDate);
  const weeksOut = Math.ceil((target - today) / (7 * 24 * 60 * 60 * 1000));

  // Date-based fallback (always calculated)
  let phaseName, focus;

  if (weeksOut >= TRAINING_CONSTANTS.PHASE.BASE_START) {
    phaseName = "Base";
    focus = "Aerobic endurance, Z2, Tempo, SweetSpot";
  } else if (weeksOut >= TRAINING_CONSTANTS.PHASE.BUILD_START) {
    phaseName = "Build";
    focus = "FTP development, Threshold, increasing CTL";
  } else if (weeksOut >= TRAINING_CONSTANTS.PHASE.SPECIALTY_START) {
    phaseName = "Specialty";
    focus = "Race specificity, VO2max, Anaerobic";
  } else if (weeksOut >= TRAINING_CONSTANTS.PHASE.TAPER_START) {
    phaseName = "Taper";
    focus = "Reduce volume, maintain intensity";
  } else {
    phaseName = "Race Week";
    focus = "Sharpness, short openers";
  }

  const result = {
    phaseName: phaseName,
    weeksOut: weeksOut,
    focus: focus,
    aiEnhanced: false,
    reasoning: "Date-based calculation",
    trajectory: null,
    transitionRecommendation: null
  };

  // Analyze fitness trajectory for adaptive phase transitions
  let trajectory = null;
  let transitionRec = null;
  try {
    trajectory = analyzeFitnessTrajectory(4);  // 4 weeks of data
    if (trajectory && trajectory.available) {
      result.trajectory = trajectory;

      // Check if phase transition is recommended based on fitness, not just calendar
      transitionRec = checkPhaseTransitionReadiness(phaseName, trajectory, weeksOut);
      result.transitionRecommendation = transitionRec;

      // Log trajectory analysis
      Logger.log('Fitness Trajectory:');
      Logger.log('  CTL: ' + trajectory.ctlTrajectory.current + ' (' + trajectory.ctlTrajectory.trend + ')');
      Logger.log('  eFTP: ' + trajectory.eftpTrajectory.current + ' (target: ' + trajectory.eftpTrajectory.target + ')');
      Logger.log('  Recovery: ' + trajectory.recoveryTrend.trend);
      Logger.log('  Phase Readiness: ' + trajectory.phaseReadiness.indicators.join(', '));

      if (transitionRec.shouldTransition) {
        Logger.log('Transition Recommendation: ' + transitionRec.adaptationType.toUpperCase());
        Logger.log('  ' + phaseName + ' -> ' + transitionRec.recommendedPhase);
        Logger.log('  Reason: ' + transitionRec.reason);
      }
    }
  } catch (e) {
    Logger.log('Trajectory analysis skipped: ' + e.toString());
  }

  // If context provided, attempt AI enhancement with trajectory data
  if (context && context.enableAI !== false) {
    try {
      const aiContext = {
        weeksOut: weeksOut,
        traditionalPhase: phaseName,
        goalDescription: context.goalDescription,
        goals: context.goals,
        ctl: context.ctl || 0,
        rampRate: context.rampRate,
        currentEftp: context.currentEftp,
        targetFtp: context.targetFtp,
        eftpGap: context.targetFtp && context.currentEftp ? context.targetFtp - context.currentEftp : null,
        hrvAvg: context.wellnessAverages?.hrv,
        sleepAvg: context.wellnessAverages?.sleep,
        recoveryAvg: context.wellnessAverages?.recovery,
        recoveryStatus: context.recoveryStatus,
        z5Recent: context.z5Recent || 0,
        tsb: context.tsb || 0,
        recentWorkouts: context.recentWorkouts,
        // Add trajectory data for AI consideration
        trajectory: trajectory,
        transitionRecommendation: transitionRec
      };

      const aiAssessment = generateAIPhaseAssessment(aiContext);

      if (aiAssessment && aiAssessment.phaseName) {
        result.phaseName = aiAssessment.phaseName;
        result.focus = aiAssessment.focus || focus;
        result.aiEnhanced = true;
        result.reasoning = aiAssessment.reasoning;
        result.adjustments = aiAssessment.adjustments;
        result.confidenceLevel = aiAssessment.confidenceLevel;
        result.phaseOverride = aiAssessment.phaseOverride;
        result.upcomingEventNote = aiAssessment.upcomingEventNote;

        if (aiAssessment.phaseOverride) {
          Logger.log("AI Phase Override: " + phaseName + " -> " + aiAssessment.phaseName);
          Logger.log("Reason: " + aiAssessment.reasoning);
        }
      }
    } catch (e) {
      Logger.log("AI phase assessment failed, using date-based: " + e.toString());
    }
  }

  return result;
}
