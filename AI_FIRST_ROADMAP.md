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
| 4 | **Weekly Email Summary** | Template with fixed sections in `emails.gs` | AI writes personalized narrative summarizing week and previewing next | Pending |
| 5 | **Training Gap Analysis** | Rule-based (2-3 days = stale, 4+ = detraining) in `utils.gs:259` | AI considers context (planned rest vs unplanned, recovery scores, phase) | Pending |
| 6 | **eFTP Trajectory Analysis** | Simple current vs target comparison | AI predicts if athlete is on track, suggests adjustments to hit peak | Pending |

### Lower Impact (Easy Wins)

| # | Feature | Current State | AI-First Opportunity | Status |
|---|---------|---------------|---------------------|--------|
| 7 | **Email Subject Lines** | Fixed "[GREEN] Workout" format in `emails.gs:23-32` | AI writes engaging subject (e.g., "Build day: Sweet Spot intervals") | **Complete** |
| 8 | **Workout Variety Check** | Count-based (avoid repeats) | AI considers training effect and stimulus, not just type names | **Complete** |

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

---

## How to Use This Document

1. Pick a feature from the backlog
2. Move it to "In Progress"
3. Implement the AI-first version
4. Update status to "Complete" with PR reference
5. Add implementation notes for future reference

---

*Last updated: 2025-12-24*
