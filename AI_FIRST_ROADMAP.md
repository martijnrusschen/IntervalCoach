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

---

## Backlog

All pending features, ordered by impact. Pick from the top for maximum value.

| Priority | Feature | Description | Source |
|----------|---------|-------------|--------|
| 🔴 **HIGH** | **TrainNow-style Quick Picker** | On-demand workout selection without full generation | TrainerRoad |
| 🔴 **HIGH** | **Race Outcome Prediction** | AI predicts race performance given current fitness, compares to goal time | AI-First |
| 🔴 **HIGH** | **On-Demand Training App** | Web/iOS app for real-time workout generation with instant AI coaching | Platform |
| 🟡 **MEDIUM** | **Multi-Week Forward View** | Extend weekly plan to 2-4 week visibility | TrainerRoad AI |
| 🟡 **MEDIUM** | **Zone Progression Levels** | Track fitness per power zone (not just overall CTL/FTP) | TrainerRoad |
| 🟡 **MEDIUM** | **Enhanced Workout Feel Prediction** | Predict how workout will feel beyond simple 1-5 difficulty | TrainerRoad AI |
| 🟡 **MEDIUM** | **Visual Analytics Dashboard** | Charts, trends, progress visualization | Both |
| 🟡 **MEDIUM** | **Workout Template Library** | Curated workout database (like JOIN's 400+ workouts) | JOIN |
| 🟡 **MEDIUM** | **Personalized Zone Boundaries** | AI adjusts zones based on lactate patterns, HRV response, time-at-power | AI-First |
| 🟡 **MEDIUM** | **Cross-Sport Zone Equivalency** | AI calculates equivalent efforts: cycling FTP ↔ running threshold | AI-First |
| 🟡 **MEDIUM** | **Easier Setup** | Setup wizard, better documentation, env validation | Infrastructure |
| 🟡 **MEDIUM** | **Whoop API Fallback** | Add Whoop API as alternative/supplementary data source | Infrastructure |
| 🟢 **LOW** | **Training Outcome Simulation** | Simulate multiple workout options before deciding | TrainerRoad AI |
| 🟢 **LOW** | **Workout Difficulty Ratings** | Granular difficulty levels beyond intensity 1-5 | TrainerRoad |
| 🟢 **LOW** | **Multi-year Plan Builder** | Long-term periodization (2+ years) | TrainerRoad |
| 🟢 **LOW** | **Code Cleanup** | Refactor, remove dead code, improve structure | Infrastructure |
| 🟢 **LOW** | **Remove Repetitive Code** | DRY refactoring, shared utilities | Infrastructure |

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
| Progression Levels | ✓ Per-zone fitness tracking | ✗ Overall CTL/FTP only | **Add zone progression** |
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

---

## How to Use This Document

1. Pick a feature from the backlog
2. Move it to "In Progress"
3. Implement the AI-first version
4. Update status to "Complete" with PR reference
5. Add implementation notes for future reference

---

*Last updated: 2025-12-25 (Added Workout Impact Preview feature)*
