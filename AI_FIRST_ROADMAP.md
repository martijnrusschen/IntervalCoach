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

---

## Backlog

### High Impact

| # | Feature | Current State | AI-First Opportunity | Status |
|---|---------|---------------|---------------------|--------|
| 1 | **Power Profile Analysis** | Hardcoded benchmarks (sprint=200% FTP, VO2max=120% FTP, etc.) in `power.gs:604-609` | AI interprets power curve considering event type, training history, individual physiology | **Complete** |
| 2 | **Training Load Advisor** | Fixed ramp rates (3-5-7-8 CTL/week) in `utils.gs:671-674` | AI recommends load based on athlete's response patterns, life stress, season context | **Complete** |
| 3 | **Recovery Assessment** | Fixed thresholds (Green≥67%, Red<34%) in `constants.gs` | AI uses personal baselines, HRV trends, considers cumulative load not just daily score | **Complete** |

### Medium Impact

| # | Feature | Current State | AI-First Opportunity | Status |
|---|---------|---------------|---------------------|--------|
| 4 | **Weekly Email Summary** | Template with fixed sections in `emails.gs` | AI writes personalized narrative summarizing week and previewing next | **Complete** |
| 5 | **Training Gap Analysis** | Rule-based (2-3 days = stale, 4+ = detraining) in `utils.gs:259` | AI considers context (planned rest vs unplanned, recovery scores, phase) | **Complete** |
| 6 | **eFTP Trajectory Analysis** | Simple current vs target comparison | AI predicts if athlete is on track, suggests adjustments to hit peak | **Complete** |

### Lower Impact (Easy Wins)

| # | Feature | Current State | AI-First Opportunity | Status |
|---|---------|---------------|---------------------|--------|
| 7 | **Email Subject Lines** | Fixed "[GREEN] Workout" format in `emails.gs:23-32` | AI writes engaging subject (e.g., "Build day: Sweet Spot intervals") | **Complete** |
| 8 | **Workout Variety Check** | Count-based (avoid repeats) | AI considers training effect and stimulus, not just type names | **Complete** |

---

## Phase 2: Advanced AI Features

### High Impact

| # | Feature | Current State | AI-First Opportunity | Status |
|---|---------|---------------|---------------------|--------|
| 9 | **Event-Specific Training** | Simple pre-race intensity rules in `workouts.gs` | AI analyzes race profile (distance, terrain, demands) → custom training emphasis and peaking strategy | **Complete** |
| 10 | **Cumulative Fatigue Prediction** | 14-day averaging in `utils.gs:489-591` | AI models fatigue trajectory, distinguishes "good" vs "bad" fatigue, predicts recovery timeline | Pending |
| 11 | **Race Outcome Prediction** | None | AI predicts race performance/placement given current fitness, compares to goal time | Pending |
| 12 | **Closed-Loop Weekly Adaptation** | Static AI weekly plan | AI learns from actual vs planned execution, adapts future plans based on outcomes | **Complete** |

### Medium Impact

| # | Feature | Current State | AI-First Opportunity | Status |
|---|---------|---------------|---------------------|--------|
| 13 | **Personalized Zone Boundaries** | Fixed offsets from CS/FTP in `prompts.gs:245-260` | AI adjusts zones based on athlete's lactate patterns, HRV response, time-at-power distributions | Pending |
| 14 | **Cross-Sport Zone Equivalency** | Separate cycling/running zones | AI calculates equivalent efforts across sports (cycling FTP ↔ running threshold) | Pending |

---

## Phase 3: Platform Expansion

| # | Feature | Current State | AI-First Opportunity | Status |
|---|---------|---------------|---------------------|--------|
| 15 | **On-Demand Training App** | Email/cron-based generation only | Web app or iOS app for real-time workout generation with instant AI coaching | Pending |

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

---

## How to Use This Document

1. Pick a feature from the backlog
2. Move it to "In Progress"
3. Implement the AI-first version
4. Update status to "Complete" with PR reference
5. Add implementation notes for future reference

---

*Last updated: 2025-12-25*
