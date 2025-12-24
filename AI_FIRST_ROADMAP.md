# AI-First Roadmap

This document tracks opportunities to make IntervalCoach more AI-first by replacing rule-based logic with intelligent AI decisions.

## Completed

- [x] **Recommendation Score Feedback Loop** - Regenerates workouts when score < 6
- [x] **AI-Driven Periodization** - Replaces date-based phase calculation
- [x] **AI-Driven Workout Selection** - AI chooses optimal workout type
- [x] **AI Rest Day Assessment** - Full-context rest day decisions
- [x] **AI Weekly Planning** - Comprehensive weekly plan generation
- [x] **Simplified Fallback Logic** - Reduced rule-based fallback from 140 to 50 lines
- [x] **Fixed Intensity Bug** - "Last Workout Intensity (X days ago)" instead of misleading "Yesterday"
- [x] **Removed AI Labels** - AI-first is default, only label fallbacks
- [x] **Tests Reorganization** - Moved to dedicated tests.gs

---

## Backlog

### High Impact

| # | Feature | Current State | AI-First Opportunity | Status |
|---|---------|---------------|---------------------|--------|
| 1 | **Power Profile Analysis** | Hardcoded benchmarks (sprint=200% FTP, VO2max=120% FTP, etc.) in `power.gs:604-609` | AI interprets power curve considering event type, training history, individual physiology | Pending |
| 2 | **Training Load Advisor** | Fixed ramp rates (3-5-7-8 CTL/week) in `utils.gs:671-674` | AI recommends load based on athlete's response patterns, life stress, season context | Pending |
| 3 | **Recovery Assessment** | Fixed thresholds (Green≥67%, Red<34%) in `constants.gs` | AI uses personal baselines, HRV trends, considers cumulative load not just daily score | Pending |

### Medium Impact

| # | Feature | Current State | AI-First Opportunity | Status |
|---|---------|---------------|---------------------|--------|
| 4 | **Weekly Email Summary** | Template with fixed sections in `emails.gs` | AI writes personalized narrative summarizing week and previewing next | Pending |
| 5 | **Training Gap Analysis** | Rule-based (2-3 days = stale, 4+ = detraining) in `utils.gs:259` | AI considers context (planned rest vs unplanned, recovery scores, phase) | Pending |
| 6 | **eFTP Trajectory Analysis** | Simple current vs target comparison | AI predicts if athlete is on track, suggests adjustments to hit peak | Pending |

### Lower Impact (Easy Wins)

| # | Feature | Current State | AI-First Opportunity | Status |
|---|---------|---------------|---------------------|--------|
| 7 | **Email Subject Lines** | Fixed "[GREEN] Workout" format in `emails.gs:23-32` | AI writes engaging subject (e.g., "Build day: Sweet Spot intervals") | Pending |
| 8 | **Workout Variety Check** | Count-based (avoid repeats) | AI considers training effect and stimulus, not just type names | Pending |

---

## Implementation Notes

### Feature 1: AI Power Profile Analysis

**Current code** (`power.gs:604-642`):
```javascript
// Hardcoded benchmarks
const benchmarks = {
  peak5s: 2.0,    // Sprint ~200% of FTP
  peak1min: 1.5,  // Anaerobic ~150% of FTP
  peak5min: 1.2,  // VO2max ~120% of FTP
  peak20min: 1.05 // ~105% of FTP
};

// Fixed 10% thresholds for strength/weakness
if (ratios.peak5s > benchmarks.peak5s * 1.1) {
  strengths.push("Sprint power (5s)");
}
```

**AI-first approach**:
- Pass full power curve + event type + training history to AI
- AI identifies strengths/weaknesses relative to goal event
- AI suggests specific workouts to address limiters
- Consider athlete's age, experience, response to training

### Feature 2: AI Training Load Advisor

**Current code** (`utils.gs:671-674`):
```javascript
const SAFE_RAMP_MIN = 3;
const SAFE_RAMP_MAX = 5;
const AGGRESSIVE_RAMP_MAX = 7;
const MAX_SUSTAINABLE_RAMP = 8;
```

**AI-first approach**:
- AI analyzes how athlete has responded to past load increases
- Consider wellness trends, not just current TSB
- Factor in life stress indicators (sleep quality, HRV trends)
- Personalized ramp rate recommendations

### Feature 3: AI Recovery Assessment

**Current code** (`constants.gs` + `wellness.gs`):
```javascript
RECOVERY: {
  GREEN_THRESHOLD: 67,
  RED_THRESHOLD: 34,
  YELLOW_THRESHOLD: 50
}
```

**AI-first approach**:
- Use athlete's personal HRV baseline (not population norms)
- Consider 7-day trends, not just today's number
- Factor in training phase (expect lower recovery during build)
- Weight multiple signals (HRV + sleep + subjective feel)

---

## How to Use This Document

1. Pick a feature from the backlog
2. Move it to "In Progress"
3. Implement the AI-first version
4. Update status to "Complete" with PR reference
5. Add implementation notes for future reference

---

*Last updated: 2024-12-24*
