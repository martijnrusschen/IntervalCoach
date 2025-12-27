# AI-First Roadmap

This document tracks opportunities to make IntervalCoach more AI-first by replacing rule-based logic with intelligent AI decisions.

## Completed

- [x] **Recommendation Score Feedback Loop** - Regenerates workouts when score < 6
- [x] **AI-Driven Periodization** - Replaces date-based phase calculation
- [x] **AI-Driven Workout Selection** - AI chooses optimal workout type
- [x] **AI Rest Day Assessment** - Full-context rest day decisions
- [x] **AI Weekly Planning** - Comprehensive weekly plan generation
- [x] **Weekly Plan Calendar Sync** - Creates placeholders in Intervals.icu, daily refresh with latest data
- [x] **Simplified Fallback Logic** - Reduced rule-based fallback from 140 to 50 lines
- [x] **Fixed Intensity Bug** - "Last Workout Intensity (X days ago)" instead of misleading "Yesterday"
- [x] **Removed AI Labels** - AI-first is default, only label fallbacks
- [x] **Tests Reorganization** - Moved to dedicated tests.gs
- [x] **AI Power Profile Analysis** - Replaced hardcoded benchmarks with goal-aware AI analysis
- [x] **AI Training Load Advisor** - Replaced fixed ramp rates with wellness-aware AI recommendations
- [x] **AI Recovery Assessment** - Replaced fixed thresholds with personal baseline analysis
- [x] **AI Weekly Email Summary** - Enhanced coaching narrative with load advice and next week preview
- [x] **AI Training Gap Analysis** - Context-aware gap interpretation (planned rest vs illness vs life)
- [x] **AI eFTP Trajectory Analysis** - Predicts if athlete is on track to hit target FTP
- [x] **Workout Impact Preview** - Shows how today's workout affects CTL/ATL/TSB over next 2 weeks
- [x] **Zone Progression Levels** - Track fitness per power zone (not just overall CTL/FTP)
- [x] **Unified Daily Email** - Single email format for workout/rest/status/group ride days
- [x] **Week Progress Tracking** - Day-by-day planned vs completed with auto-cleanup of missed workouts
- [x] **C Event (Group Ride) Support** - AI intensity advice for unstructured group rides
- [x] **Cross-Sport Zone Equivalency** - AI calculates equivalent efforts between cycling and running
- [x] **Personalized Zone Boundaries** - AI adjusts zones based on power curve analysis and athlete physiology
- [x] **Mid-Week Adaptation** - Analyzes week progress and adjusts remaining workouts when sessions are missed or wellness changes
- [x] **HRV/RHR Baseline Tracking** - Tracks 30-day rolling baselines and surfaces deviation % to AI and emails

---

## Backlog

All pending features, ordered by impact. Pick from the top for maximum value.

| Priority | Feature | Description | Source |
|----------|---------|-------------|--------|
| 🔴 **HIGH** | **TrainNow-style Quick Picker** | On-demand workout selection without full generation | TrainerRoad |
| 🔴 **HIGH** | **Race Outcome Prediction** | AI predicts race performance given current fitness, compares to goal time | AI-First |
| 🔴 **HIGH** | **On-Demand Training App** | Web/iOS app for real-time workout generation with instant AI coaching | Platform |
| 🟡 **MEDIUM** | **Interval-Level Intensity Tweaks** | Scale power targets within workouts based on recovery (Yellow → reduce Z4+ by 5-10%) | TrainerRoad Training Approach |
| 🟡 **MEDIUM** | **Multi-Week Forward View** | Extend weekly plan to 2-4 week visibility | TrainerRoad AI |
| 🟡 **MEDIUM** | **Enhanced Workout Feel Prediction** | Predict how workout will feel beyond simple 1-5 difficulty | TrainerRoad AI |
| 🟡 **MEDIUM** | **Visual Analytics Dashboard** | Charts, trends, progress visualization | Both |
| 🟡 **MEDIUM** | **Workout Template Library** | Curated workout database (like JOIN's 400+ workouts) | JOIN |
| 🟡 **MEDIUM** | **Easier Setup** | Setup wizard, better documentation, env validation | Infrastructure |
| 🟢 **LOW** | **Cumulative Cross-Sport Load** | Track combined fatigue from cycling + running (unified fatigue model) | TrainerRoad Training Approach |
| 🟢 **LOW** | **Recovery Debt Tracking** | Track multi-day sleep deficit, trigger recovery week earlier if debt accumulates | TrainerRoad Training Approach |
| 🟢 **LOW** | **Workout Prediction Mode** | Show how choices change with recovery ("If recovery hits 65%, Friday shifts to Threshold") | TrainerRoad Training Approach |
| 🟢 **LOW** | **Training Outcome Simulation** | Simulate multiple workout options before deciding | TrainerRoad AI |
| 🟢 **LOW** | **Workout Difficulty Ratings** | Granular difficulty levels beyond intensity 1-5 | TrainerRoad |
| 🟢 **LOW** | **Multi-year Plan Builder** | Long-term periodization (2+ years) | TrainerRoad |
| 🟢 **LOW** | **Code Cleanup** | Refactor, remove dead code, improve structure | Infrastructure |
| 🟢 **LOW** | **Remove Repetitive Code** | DRY refactoring, shared utilities | Infrastructure |

### Coaching Quality Improvements

Features identified from coaching analysis to improve recommendation quality:

| Priority | Feature | Description | Gap |
|----------|---------|-------------|-----|
| ✅ | ~~**HRV/RHR Baseline Tracking**~~ | ~~Track 30-day rolling baselines and surface deviation % to AI and emails.~~ | **COMPLETE** |
| 🟡 **MEDIUM** | **Planned Deload Weeks** | Auto-insert recovery weeks based on cumulative load (CTL > X for Y weeks), not just reactive to fatigue | Currently reactive only - no proactive deload scheduling |
| 🟡 **MEDIUM** | **Zone Weakness Targeting** | Drive workout selection toward undertrained zones. Zone progression exists but doesn't influence daily workout choice | Zone data tracked but not used as selection criteria |
| 🟡 **MEDIUM** | **Subjective Markers as Constraints** | Enforce soreness/fatigue/stress 4-5 as hard constraints that block high intensity, not just "consider" | Markers shown to AI but not enforced |
| 🟡 **MEDIUM** | **RPE-Based Difficulty Calibration** | Adjust workout difficulty based on RPE feedback patterns. If athlete consistently rates VO2max as RPE 9-10, reduce targets by 3-5% | RPE collected but not used to calibrate |
| 🟡 **MEDIUM** | **Illness Detection Patterns** | Detect illness patterns: elevated RHR + suppressed HRV + poor sleep for 2+ days triggers illness protocol | Individual metrics checked but patterns not detected |
| 🟢 **LOW** | **Training Load Rate Warnings** | Warn when CTL ramp rate exceeds safe thresholds (>7 CTL/week) for multiple weeks | Ramp rate shown but not enforced as constraint |
| 🟢 **LOW** | **Progressive Overload Verification** | Verify that key workouts show progressive overload week-over-week (e.g., increasing interval duration or power) | Workouts generated fresh without referencing previous similar workouts |

---

## Competitor Analysis

### JOIN Cycling ([join.cc](https://join.cc/))
| Feature | JOIN | IntervalCoach | Gap |
|---------|------|---------------|-----|
| Adaptive training plans | ✓ Real-time schedule adaptation | ✓ AI weekly planning | Similar |
| 400+ workout library | ✓ World Tour-level workouts | ✗ Generates on-demand | **Add workout templates** |
| RPE feedback integration | ✓ After each workout | ✓ Collects RPE/Feel | Similar |
| Mobile app | ✓ iOS & Android | ✗ Email/script only | **Phase 3: App** |
| Unplanned ride handling | ✓ Auto-adjusts schedule | ✓ Closed-loop adaptation | Similar |
| Multi-sport | ✓ Running integration | ✓ Cycling + Running | Similar |
| Readiness score | ✓ Daily readiness | ✓ AI recovery assessment | Similar |

### TrainerRoad ([trainerroad.com](https://www.trainerroad.com/))

**TrainerRoad AI** (Launching 2025 - "Biggest Update Ever"):

TrainerRoad claims 27% more accurate workout recommendations using proprietary AI models trained on "tens of millions of rides."

| Feature | TrainerRoad | IntervalCoach | Status |
|---------|-------------|---------------|--------|
| Custom AI models (not ChatGPT) | ✓ Proprietary models | ✓ Custom prompts + Gemini | Similar approach |
| Workout Simulation | ✓ Simulates hundreds of workouts | ✗ Direct AI recommendation | **Add simulation** |
| Predicted FTP | ✓ Shows future FTP based on training | ✓ AI eFTP Trajectory Analysis | Similar |
| Impact Preview | ✓ See how changes affect future weeks | ✓ AI Workout Impact Preview | Similar - 2-week CTL/TSB projection |
| Workout Feel Prediction | ✓ Explains how workout will feel | ~ Partial (difficulty 1-5) | **Enhance feel prediction** |
| Training Future Visibility | ✓ Multi-week forward view | ✓ Weekly planning only | **Extend to multi-week** |
| Fatigue Prediction | ✓ Predicts burnout before it happens | ✓ AI Cumulative Fatigue Prediction | **Ahead** - distinguishes FOR/NFOR/OTS |

**Red Light Green Light** (Flagship fatigue feature, March 2024):

| Feature | TrainerRoad | IntervalCoach | Status |
|---------|-------------|---------------|--------|
| Red/Yellow/Green recovery status | ✓ Calendar day markers | ✓ AI Recovery Assessment | **Ahead** - uses personal baselines not fixed thresholds |
| Auto-adaptation to fatigue | ✓ Adapts to easier workout | ✓ AI Rest Day Assessment | **Ahead** - considers TSB, wellness, events, training phase |
| AI Fatigue Detection | ✓ Built on 250M workouts | ✓ AI Cumulative Fatigue Prediction | **Ahead** - distinguishes FOR/NFOR/OTS |
| Recovery timeline | ✗ Not shown | ✓ Days-to-recovery prediction | **Ahead** |
| Post-workout survey | ✓ RPE feedback | ✓ RPE/Feel + AI analysis email | **Ahead** - proactive insights within 1 hour |
| Fatigue quality assessment | ✗ Binary fatigued/not | ✓ "Good" vs "bad" fatigue classification | **Ahead** |
| Overtraining warning | ✗ Not shown | ✓ OTS risk detection with warning signs | **Ahead** |

**Other TrainerRoad Features:**

| Feature | TrainerRoad | IntervalCoach | Gap |
|---------|-------------|---------------|-----|
| Adaptive Training (ML) | ✓ Adjusts workout difficulty | ✓ AI adapts weekly plan | Similar |
| Progression Levels | ✓ Per-zone fitness tracking | ✓ Zone Progression Levels | **Complete** |
| AI FTP Detection | ✓ No ramp tests needed | ~ Uses Intervals.icu eFTP | Similar |
| TrainNow (on-demand) | ✓ Quick workout picker | ✗ Requires full generation | **Add quick picker** |
| Plan Builder | ✓ 2-year planning, A/B/C events | ✓ Weekly planning, A/B/C races | Similar |
| Workout Difficulty Levels | ✓ Granular difficulty ratings | ✗ Intensity 1-5 only | **Enhance ratings** |
| Post-workout survey | ✓ Structured feedback | ✓ RPE/Feel collection | Similar |
| Calendar drag-drop | ✓ Visual editing | ✗ Intervals.icu calendar | External |
| PowerMatch | ✓ Smart trainer control | ✗ Not applicable | N/A |
| Cross-platform apps | ✓ iOS/Android/Mac/Win/Garmin | ✗ Apps Script only | **Phase 3: App** |
| Outside workouts | ✓ GPS-guided | ✓ Generates for Zwift/.zwo | Partial |
| Zwift Integration (2025) | ✓ All Zwift activities analyzed | ✓ Native Intervals.icu sync | Similar |

---

## Implementation Notes

### Feature 1: AI Power Profile Analysis ✅ COMPLETE

**Implementation:**
- Added `generateAIPowerProfileAnalysis()` in `prompts.gs` - AI prompt that analyzes power curve relative to goal event
- Modified `analyzePowerProfile()` in `power.gs` to call AI first, fall back to benchmarks if AI fails
- Updated `main.gs` to pass `goals` from `fetchUpcomingGoals()` to analysis
- Added `testAIPowerProfileAnalysis()` in `tests.gs`

**Key changes:**
- AI receives full power curve + goal event type + event description
- Returns context-aware strengths/weaknesses (e.g., "Strong 5-min power for climbing events")
- Includes `eventRelevance` field explaining how profile matches goal
- Falls back to hardcoded benchmarks if AI unavailable
- Returns `aiEnhanced: true/false` flag for tracking

### Feature 2: AI Training Load Advisor ✅ COMPLETE

**Implementation:**
- Added `generateAITrainingLoadAdvice()` in `prompts.gs` - AI prompt considering wellness trends
- Modified `calculateTrainingLoadAdvice()` in `utils.gs` to call AI first, fall back to fixed thresholds
- Updated `emails.gs` to pass wellness data to the function
- Added `testAITrainingLoadAdvisor()` in `tests.gs`

**Key changes:**
- AI receives fitness metrics + wellness 7-day averages + training phase
- Returns personalized ramp rate recommendation based on recovery signals
- Includes warnings for sleep deficits, HRV trends, high fatigue
- Falls back to fixed thresholds if AI unavailable
- Returns `aiEnhanced: true/false` flag for tracking

### Feature 3: AI Recovery Assessment ✅ COMPLETE

**Implementation:**
- Added `generateAIRecoveryAssessment()` in `prompts.gs` - AI prompt using personal baselines
- Modified `createWellnessSummary()` in `wellness.gs` to call AI first, fall back to fixed thresholds
- Added `testAIRecoveryAssessment()` in `tests.gs`

**Key changes:**
- AI receives today's wellness + 7-day averages (personal baseline)
- Compares to personal patterns, not population norms
- Considers trend direction (improving vs declining)
- Returns personalized reason explaining the assessment
- Falls back to fixed thresholds if AI unavailable
- Returns `aiEnhanced: true/false` flag for tracking

### Feature 4: AI Weekly Email Summary ✅ COMPLETE

**Implementation:**
- Enhanced `generateWeeklyInsight()` in `prompts.gs` - expanded from 3-4 sentences to 5-7 sentence coaching letter
- Modified `sendWeeklySummaryEmail()` in `emails.gs` to pass load advice and upcoming placeholders
- Added "Coach's Letter" header to make AI narrative more prominent

**Key changes:**
- AI now receives `loadAdvice` (training load recommendations) for context
- AI now receives `upcomingPlaceholders` (next week's planned sessions) for preview
- Expanded prompt instructions for comprehensive coaching narrative:
  - Opens with acknowledgment of the athlete's week
  - Highlights significant metric changes
  - Connects progress to goal (Marmotte/A race)
  - Addresses concerns with reassurance
  - Previews next week with coaching intent
  - Closes with genuine encouragement
- Warm, conversational tone using "you" and "your"
- Email layout restructured with prominent "Coach's Letter" section

### Feature 5: AI Training Gap Analysis ✅ COMPLETE

**Implementation:**
- Added `generateAITrainingGapAnalysis()` in `prompts.gs` - AI prompt considering wellness, phase, and fitness
- Modified `analyzeTrainingGap()` in `utils.gs` to call AI first, fall back to rule-based logic
- Added `testAITrainingGapAnalysis()` in `tests.gs`

**Key changes:**
- AI receives gap duration + wellness context + fitness state + training phase
- Distinguishes between: planned_rest, returning_from_illness, life_interference, taper
- Returns context-aware intensity modifier and recommendations
- Includes `fitnessImpact` assessment (none/minimal/moderate)
- Falls back to rule-based thresholds if AI unavailable
- Returns `aiEnhanced: true/false` flag for tracking

### Feature 6: AI eFTP Trajectory Analysis ✅ COMPLETE

**Implementation:**
- Added `generateAIEftpTrajectoryAnalysis()` in `prompts.gs` - AI prompt predicting FTP progress
- Added trajectory section to `sendWeeklySummaryEmail()` in `emails.gs`
- Added `testAIEftpTrajectoryAnalysis()` in `tests.gs`

**Key changes:**
- AI receives current eFTP, target FTP, weeks remaining, CTL trend
- Calculates required weekly gain and assesses feasibility
- Returns `onTrack` boolean + `trajectoryStatus` (ahead/on_track/behind)
- Provides projected eFTP at goal date
- Includes specific training adjustments if behind schedule
- Shows trajectory status in weekly email fitness section

### Feature 9: AI Event-Specific Training ✅ COMPLETE

**Implementation:**
- Added `generateAIEventAnalysis()` in `prompts.gs` - AI analyzes event profile and returns tailored training strategy
- Integrated into `generateAIWeeklyPlan()` in `workouts.gs` - event analysis injected into weekly planning prompt
- Added `testAIEventSpecificTraining()` in `tests.gs`

**Key changes:**
- AI receives event name, date, type, description + athlete power profile + fitness metrics + weeks out
- Returns comprehensive analysis:
  - `eventProfile`: category, primary/secondary demands, key challenge, estimated duration
  - `trainingEmphasis`: priority workouts, secondary workouts, workouts to avoid, intensity focus
  - `peakingStrategy`: taper length/style, last hard workout timing, volume reduction curve, opener workout
  - `currentPhaseAdvice`: current phase, build vs taper, weekly focus, key workout
  - `athleteSpecificNotes`: personalized notes on profile-event match
- Weekly plan now receives event-specific guidance to tailor workout selection
- Replaces simple "pre-race day = intensity 1-2" with intelligent event-aware periodization

### Feature 12: Closed-Loop Weekly Adaptation ✅ COMPLETE

**Implementation:**
- Added `analyzeWeeklyPlanExecution()` in `workouts.gs` - compares planned vs actual workouts
- Added `generateAIPlanAdaptationInsights()` in `workouts.gs` - AI learns from discrepancies
- Integrated into `generateAIWeeklyPlan()` - adaptation insights injected into weekly planning prompt
- Added `testClosedLoopAdaptation()` in `tests.gs`

**Key changes:**
- Fetches [Weekly Plan] events and WORKOUT category events from Intervals.icu
- Matches planned sessions to actual activities by date
- Calculates adherence score: 70% completion rate + 30% TSS accuracy
- AI analyzes patterns: which workout types get skipped, swapped, or modified
- Returns adaptation recommendations for future planning
- Weekly plan prompt now includes learnings from past execution

### Feature 10: AI Cumulative Fatigue Prediction ✅ COMPLETE

**Implementation:**
- Added `generateAICumulativeFatigueAnalysis()` in `prompts.gs` - AI analyzes fatigue state
- Added `fetchFitnessTrend()` in `power.gs` - fetches 14-day CTL/ATL/TSB history
- Added `testAICumulativeFatiguePrediction()` in `tests.gs`

**Key changes:**
- AI receives current fitness (CTL, ATL, TSB, ramp rate) + 14-day trend + wellness + RPE/Feel feedback
- Classifies fatigue type: fresh, normal, functional_overreaching, non_functional_overreaching, overtraining_warning
- Distinguishes "good" fatigue (productive for adaptation) vs "bad" fatigue (warning signs)
- Predicts days to recovery (neutral and positive TSB)
- Identifies warning signs: declining HRV, elevated RHR, poor sleep, high RPE
- Returns specific recommendations: continue_normal, reduce_intensity, reduce_volume, recovery_week, complete_rest
- Includes physiological insight explaining what's happening and risk level

### Feature 20: Post-Workout AI Analysis ✅ COMPLETE

**Implementation:**
- Added `checkForCompletedWorkouts()` in `main.gs` - Hourly check with smart caching (early exit if no new activities)
- Added `analyzeCompletedWorkout()` in `main.gs` - Orchestrates analysis flow for each completed workout
- Added `generatePostWorkoutAnalysis()` in `prompts.gs` - AI prompt analyzing effectiveness, difficulty, recovery impact
- Added `sendPostWorkoutAnalysisEmail()` in `emails.gs` - Comprehensive email with analysis insights
- Added `storeWorkoutAnalysis()` in `utils.gs` - Stores analysis history for adaptive learning
- Added `getWorkoutAnalysisHistory()` in `utils.gs` - Retrieves stored analyses for adaptive context
- Added `getLastWorkoutAnalysis()` in `utils.gs` - Quick access to most recent analysis
- Added `testPostWorkoutAnalysis()` in `tests.gs` - Complete test workflow

**Key changes:**
- Hourly trigger checks for completed workouts since last analysis timestamp
- Smart caching via PropertiesService.getScriptProperties() avoids redundant API calls
- Early exit if no new activities (2-5 seconds, minimal quota usage)
- Filters out placeholders (requires TSS > 0 and duration > 5 minutes)
- AI analyzes: effectiveness (1-10), difficulty match, workout stimulus quality, recovery impact
- Returns structured JSON with performance highlights, key insights, training adjustments
- FTP calibration recommendations (increase_5w, decrease_5w, retest_recommended)
- Analysis stored in script properties (rolling 7-day window, max 14 records)
- Email sent with congratulatory message, detailed metrics, and actionable recommendations
- Cost: ~$0.05-0.10/month in Gemini API costs (only runs when real workouts completed)

**Trigger Setup:**
- Function: `checkForCompletedWorkouts`
- Type: Hour timer (every 1 hour)
- Quota usage: <0.25% of daily limit (20k URL fetch calls/day)

**Future Enhancements:**
- Integrate analysis history into `getAdaptiveTrainingContext()` for next-day workout generation
- Use difficulty match trends to calibrate AI's workout intensity predictions
- Feed FTP calibration recommendations into power profile analysis
- Compare predicted vs actual recovery time to improve future estimates

### Feature: Workout Impact Preview ✅ COMPLETE

**Implementation:**
- Added `projectFitnessMetrics()` in `power.gs` - Projects CTL/ATL/TSB using standard 42/7-day constants
- Added `fetchUpcomingPlannedTSS()` in `power.gs` - Fetches next 14 days of planned workouts with TSS values
- Added `generateWorkoutImpactPreview()` in `power.gs` - Compares with/without today's workout scenarios
- Added `generateAIWorkoutImpactPreview()` in `prompts.gs` - AI prompt for narrative explanation
- Added `createFallbackImpactPreview()` in `prompts.gs` - Rule-based fallback when AI unavailable
- Added `generateWorkoutImpactSection()` in `emails.gs` - Formats impact preview for daily email
- Added `estimateWorkoutTSS()` in `emails.gs` - Estimates TSS from workout type and duration
- Added `testWorkoutImpactPreview()` in `tests.gs` - Comprehensive test function

**Key features:**
- Projects CTL/ATL/TSB for next 14 days based on planned workouts
- Compares "with workout" vs "without workout" (rest day) scenarios
- Calculates key metrics: tomorrow's TSB delta, 2-week CTL gain, lowest TSB, days to positive TSB
- Identifies peak form windows (TSB 0-20)
- AI generates summary, narrative, key insights, form status, and recommendation
- TSS estimation based on workout type (Recovery ~0.4, Endurance ~0.55, Threshold ~0.92 TSS/min)
- Falls back to rule-based analysis if AI unavailable
- Shows 7-day projection table in email

**Email section includes:**
- AI summary of workout impact
- Today's estimated TSS
- Tomorrow's projected CTL/TSB
- 2-week CTL gain
- Key insights (e.g., "TSB drops to -15 tomorrow but recovers by Friday")
- AI coaching narrative
- 7-day projection table

### Feature: Cross-Sport Zone Equivalency ✅ COMPLETE

**Implementation:**
- Added `calculateCrossSportEquivalency()` in `power.gs` - Maps cycling power zones to running pace zones
- Added `getRunningEquivalent()` in `power.gs` - Gets running pace for a cycling zone
- Added `getCyclingEquivalent()` in `power.gs` - Gets cycling power for a running zone
- Added `generateCrossSportRecommendations()` in `power.gs` - AI analyzes cross-training strategy
- Added `generateFallbackCrossSportRecommendations()` in `power.gs` - Rule-based fallback
- Added `formatCrossSportSection()` in `power.gs` - Formats equivalency table for email
- Added translations for cross-sport UI strings (EN/NL)
- Integrated into `buildWeeklyPlanContext()` in `emails.gs`
- Added `crossSportContext` to `generateAIWeeklyPlan()` prompt in `workouts.gs`
- Added `testCrossSportEquivalency()` in `tests.gs`

**Key features:**
- Maps cycling FTP to running Critical Speed (both represent ~1hr max sustainable effort)
- Maps cycling W' (kJ) to running D' (meters) for anaerobic capacity comparison
- Calculates zone equivalencies: Recovery, Endurance, Tempo, Threshold, VO2max, Anaerobic
- AI generates personalized cross-training recommendations:
  - How cycling fitness supports running and vice versa
  - Which zones transfer best between sports
  - Recommended weekly cycling/running mix
  - Key insights and warnings
- Integrated into weekly planning AI prompt for intelligent sport mixing
- Physiological equivalence: same zone = same relative effort across sports

**Zone Mapping:**
| Zone | Cycling (% FTP) | Running (% Critical Speed) |
|------|-----------------|----------------------------|
| Recovery | < 55% | < 78% |
| Endurance | 56-75% | 78-88% |
| Tempo | 76-87% | 88-95% |
| Threshold | 95-105% | 95-100% |
| VO2max | 106-120% | 100-108% |
| Anaerobic | > 121% | > 108% |

### Feature: Personalized Zone Boundaries ✅ COMPLETE

**Implementation:**
- Added `analyzeZoneBoundaries()` in `power.gs` - Analyzes power curve ratios to determine athlete physiology
- Added `deriveZoneRecommendations()` in `power.gs` - Rule-based zone boundary adjustments
- Added `generateAIZoneRecommendations()` in `power.gs` - AI-enhanced profile explanation
- Added `determineProfileType()` in `power.gs` - Classifies athlete type (Sprinter, Diesel, Puncheur, etc.)
- Added `buildZoneContext()` in `prompts.gs` - Formats zone data for workout generation prompt
- Integrated into `main.gs` - Zone analysis attached to powerProfile
- Added `testPersonalizedZones()` in `tests.gs`

**Key features:**
- Analyzes power ratios at key durations (5s, 1min, 5min, 20min, 60min) vs FTP
- Compares to benchmarks: 5s=2.0x, 1min=1.35x, 5min=1.10x, 20min=1.05x, 60min=0.95x
- Assesses capacities: sprint, anaerobic, VO2max, aerobic durability
- Profile types: Sprinter, Diesel, Puncheur, Time-Trialist, All-Rounder, Balanced

**Zone Adjustments:**
| Capacity | Assessment | Zone Adjustment |
|----------|------------|-----------------|
| Aerobic Durability | High | Z2 upper: 75% → 78% |
| Aerobic Durability | Low | Z2 upper: 75% → 72% |
| VO2max | High | Z4/Z5 boundary: 105% → 108% |
| VO2max | Low | Z4/Z5 boundary: 105% → 102% |
| Anaerobic | High | Z5/Z6 boundary: 120% → 125% |
| Anaerobic | Low | Z5/Z6 boundary: 120% → 115% |

**Integration:**
- Zone analysis included in workout generation prompt (section 1f)
- AI uses personalized zones for interval power targets
- Profile type and capacity insights guide workout intensity selection

### Feature: Mid-Week Adaptation ✅ COMPLETE

**Implementation:**
- Added `checkMidWeekAdaptationNeeded()` in `workouts_planning.gs` - Unified check for both execution-based and fatigue-based adaptation triggers
- Added `buildMidWeekAdaptationPrompt()` in `prompts_planning.gs` - AI prompt for adaptation decisions
- Added `generateMidWeekAdaptation()` in `workouts_planning.gs` - Orchestrates adaptation and updates calendar
- Added `applyMidWeekAdaptation()` in `workouts_planning.gs` - Updates Intervals.icu placeholders
- Integrated into `main.gs` daily flow after placeholder cleanup
- Added email section to show adaptation changes
- Added `testMidWeekAdaptation()` in `test_planning.gs`

**Key features:**
- **Execution-based triggers**: Missed intensity sessions (VO2max, Threshold, SweetSpot), TSS deficit > 100, adherence < 70%
- **Fatigue-based triggers**: Low recovery + intensity planned, high fatigue (TSB < -20) + multiple intensity days
- AI analyzes situation and recommends adapted schedule for remaining week
- Reschedules missed intensity to appropriate remaining days
- Reduces/swaps intensity when recovery is low
- Placeholders updated in Intervals.icu calendar with [Adapted] tag
- Changes summarized in daily email under "Plan Adapted" section

**Constraints enforced:**
- No hard workouts the day before events
- Maximum 2 intensity days remaining in a week
- If overreaching (TSB < -30), prioritize recovery over catching up

### Feature: HRV/RHR Baseline Tracking ✅ COMPLETE

**Implementation:**
- Added baseline storage functions in `tracking.gs`:
  - `storeWellnessBaseline()` - Calculates and stores 30-day rolling averages
  - `getWellnessBaseline()` - Retrieves stored baseline
  - `calculateBaselineDeviation()` - Calculates deviation with z-score interpretation
  - `analyzeWellnessVsBaseline()` - Comprehensive deviation analysis
  - `calculateStdDev()` - Standard deviation utility
- Updated `createWellnessSummary()` in `wellness.gs` to include baseline analysis
- Updated `generateAIRecoveryAssessment()` in `prompts_analysis.gs` to accept 30-day baseline context
- Updated `main.gs` to fetch 30 days of wellness data (was 7)
- Added baseline deviation display in daily emails
- Added translations for all 5 languages
- Added `testBaselineTracking()` in `test_recovery.gs`

**Key features:**
- Calculates 30-day rolling averages for HRV and RHR
- Stores min/max ranges and standard deviation
- Z-score based interpretation:
  - |z| < 0.5 = normal
  - 0.5-1.5 = notable
  - > 1.5 = significant
- HRV interpretation: higher = better (suppressed = concerning)
- RHR interpretation: lower = better (elevated = concerning)
- Overall status: good/normal/caution/warning
- AI recovery assessment now considers 30-day baseline context
- Email shows deviation % with warning indicators (⚠️ for concerns, ✓ for good)

---

## How to Use This Document

1. Pick a feature from the backlog
2. Move it to "In Progress"
3. Implement the AI-first version
4. Update status to "Complete" with PR reference
5. Add implementation notes for future reference

---

*Last updated: 2025-12-27 (Added HRV/RHR Baseline Tracking feature)*
