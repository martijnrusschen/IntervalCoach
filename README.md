# IntervalCoach

**IntervalCoach** is an automated, open-source AI cycling and running coach powered by **Google Gemini AI** and **Intervals.icu**.

It acts as your personal AI coach—analyzing your fitness data, recovery status, and goals to generate personalized workouts every day. IntervalCoach creates custom **Zwift workouts (.zwo)** for cycling and structured **running workouts** based on your current form and upcoming race goals.

## Repository Files

| File | Purpose |
|------|---------|
| `Code.gs` | Main IntervalCoach script (copy to Apps Script) |
| `config.sample.gs` | Sample configuration template (copy and rename to `config.gs`) |
| `config.gs` | Your personal config with API keys (gitignored - create locally) |

## Features

### Smart Training
- **Dynamic Goal Detection:** Automatically detects A, B, and C priority races from your Intervals.icu calendar (C races serve as stepping stones toward A/B goals)
- **Periodization:** Calculates training phase (Base → Build → Specialty → Peak → Taper) based on your next A-race
- **Recovery-Aware:** Integrates with Whoop, Garmin, Oura via Intervals.icu to adjust intensity based on HRV, sleep, and recovery scores
- **Variety Tracking:** Analyzes recent workouts to ensure training variety and prevent staleness

### Power Profile Analysis (Cycling)
- **eFTP Tracking:** Uses rolling eFTP from Intervals.icu power curve models
- **W' (Anaerobic Capacity):** Tracks current vs season best W' to identify anaerobic needs
- **VO2max Estimate:** Includes 5-minute power-based VO2max
- **Peak Powers:** Analyzes 5s, 10s, 30s, 1min, 2min, 5min, 8min, 20min, 30min, 60min powers
- **Strengths/Weaknesses:** Identifies focus areas based on power ratios

### Pace Curve Analysis (Running)
- **Critical Speed (CS):** Fetches running pace curve and calculates CS (running equivalent of FTP)
- **D' (Anaerobic Capacity):** Running anaerobic work capacity
- **Zone Calculations:** Auto-calculates running zones based on Critical Speed
- **Best Efforts:** Tracks 400m, 800m, 1.5k, 3k, 5k times

### Workout Generation
- **Cycling:** Generates Zwift .zwo files with cadence targets, text events, and engaging structures
- **Running:** Creates structured running workouts with warm-up, main set, cool-down, and pace targets
- **AI-Powered:** Uses Google Gemini to create contextually appropriate workouts
- **Multi-Language:** Supports English, Dutch, Japanese, Spanish, French

### Calendar Integration
- **Placeholder-Based:** Add `Ride` or `Run` to your Intervals.icu calendar to trigger workout generation
- **Duration Control:** Specify duration like `Ride - 90min` or `Run - 45min`
- **Auto-Replace:** Generated workouts replace placeholder events automatically

## How It Works

```
┌─────────────────────────────────────────────────────────────────┐
│                     INTERVALS.ICU                                │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐            │
│  │ Calendar │  │ Wellness│  │  Power  │  │  Pace   │            │
│  │ (A/B    │  │ (Whoop/ │  │  Curve  │  │  Curve  │            │
│  │  Races) │  │ Garmin) │  │(Cycling)│  │(Running)│            │
│  └────┬────┘  └────┬────┘  └────┬────┘  └────┬────┘            │
└───────┼────────────┼────────────┼────────────┼──────────────────┘
        │            │            │            │
        ▼            ▼            ▼            ▼
┌─────────────────────────────────────────────────────────────────┐
│               IntervalCoach (Google Apps Script)                │
│                                                                  │
│  1. Fetch dynamic goals (A/B races)                             │
│  2. Calculate training phase                                     │
│  3. Analyze recovery/wellness                                    │
│  4. Fetch power/pace curves                                      │
│  5. Select workout type based on phase + recovery + variety      │
│  6. Generate workout via Gemini AI                               │
│  7. Upload to Intervals.icu + save to Drive                     │
│  8. Send email summary                                           │
└─────────────────────────────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────────────────────────────┐
│  OUTPUT                                                          │
│  ├── Zwift .zwo file (cycling) → syncs to Zwift                 │
│  ├── Run workout → uploaded to Intervals.icu                    │
│  └── Email summary with workout details                         │
└─────────────────────────────────────────────────────────────────┘
```

## Prerequisites

1. **Google Account** (for Gemini API, Apps Script, Drive, Gmail)
2. **Intervals.icu Account** with activity history (needed for power/pace curves)
3. Optional: **Whoop/Garmin/Oura** connected to Intervals.icu for recovery data
4. Optional: **Zwift** for cycling workouts (syncs automatically via Intervals.icu)

## Quick Start

### Step 1: Get Your Intervals.icu Credentials

1. Log in to [intervals.icu](https://intervals.icu)
2. Go to **Settings** (gear icon) → **Developer**
3. Note your **Athlete ID** (shown at the top, e.g., `i12345`)
4. Click **Generate** under API Key and copy it

### Step 2: Get Gemini API Key

1. Go to [Google AI Studio](https://aistudio.google.com/)
2. Sign in with your Google account
3. Click **Get API Key** → **Create API Key**
4. Copy the generated key

### Step 3: Set Up Google Apps Script

1. Go to [Google Drive](https://drive.google.com) and create a new **Google Sheet**
2. Name it something like "IntervalCoach Coach"
3. Click **Extensions** → **Apps Script**
4. You need to create **two files** in the Apps Script editor:

**File 1: Main Code**
- Rename the default `Code.gs` to `Code` (click the three dots → Rename)
- Copy the entire contents of `Code.gs` from this repository
- Paste it into the editor

**File 2: Configuration**
- Click the **+** next to Files → **Script**
- Name it `config`
- Copy the contents of `config.sample.gs` from this repository
- Paste it into the editor

5. Click the **Save** icon (or Ctrl+S)

### Step 4: Configure Your Settings

In the `config.gs` file, update these values with your credentials:

```javascript
const API_KEYS = {
  ICU_TOKEN: "paste-your-intervals-api-key-here",
  GEMINI_API_KEY: "paste-your-gemini-api-key-here"
};

const AI_SETTINGS = {
  GEMINI_MODEL: "gemini-3-pro-preview"  // Or "gemini-2.0-flash", "gemini-1.5-pro"
};

const USER_SETTINGS = {
  LANGUAGE: "en",              // Options: "en", "nl", "ja", "es", "fr"
  EMAIL_TO: "your@email.com",  // Where to send daily workout summaries

  // Fallback goal (used only if no A/B races in your calendar)
  GOAL_DESCRIPTION: "Build fitness for racing",
  TARGET_DATE: "2025-06-01",

  // These match what you type in Intervals.icu calendar
  PLACEHOLDER_RIDE: "Ride",
  PLACEHOLDER_RUN: "Run",

  // Default workout duration range (when not specified)
  DEFAULT_DURATION_RIDE: { min: 60, max: 90 },
  DEFAULT_DURATION_RUN: { min: 30, max: 45 },

  // Optional: Google Sheet ID for activity logging (leave "" to skip)
  SPREADSHEET_ID: "",
  SHEET_NAME: "training_log",

  WORKOUT_FOLDER: "IntervalCoach_Workouts",  // Created in Google Drive
};
```

Save the script after making changes.

### Step 5: Authorize the Script

1. In Apps Script, select `testEftp` from the function dropdown (near the Run button)
2. Click **Run**
3. A popup will ask for permissions - click **Review Permissions**
4. Select your Google account
5. Click **Advanced** → **Go to IntervalCoach (unsafe)** (it's safe - this is your own script)
6. Click **Allow** to grant permissions

### Step 6: Verify Your Setup

Run these test functions to make sure everything works:

| Function | What to check |
|----------|---------------|
| `testEftp` | Should show your eFTP, W', peak powers |
| `testRunningData` | Should show threshold pace, zones (if you run) |
| `testGoals` | Should show your A/B race events |

To run a test: Select the function from the dropdown → Click **Run** → Check the **Execution log** at the bottom.

### Step 7: Set Up Your Goals in Intervals.icu

In your Intervals.icu calendar, mark your key events:

1. Click on an event (or create one)
2. Set the **Category** to:
   - **A Race** = Your primary goal event (IntervalCoach will peak you for this)
   - **B Race** = Secondary events (maintain good form)

IntervalCoach automatically detects these and adjusts your training phase.

### Step 8: Add Workout Placeholders

To request a workout, add an event to your Intervals.icu calendar:

| What you type | What IntervalCoach generates |
|---------------|---------------------|
| `Ride` | 60-90 min cycling workout |
| `Ride - 120min` | ~120 min cycling workout |
| `Run` | 30-45 min running workout |
| `Run - 45min` | ~45 min running workout |
| `Hardlopen` | Dutch for Run |

The placeholder event will be replaced with your generated workout.

### Step 9: Test Workout Generation

1. Add a `Ride` or `Run` placeholder to **today's date** in Intervals.icu
2. In Apps Script, select `generateOptimalZwiftWorkoutsAutoByGemini`
3. Click **Run**
4. Check your Intervals.icu calendar - the placeholder should be replaced with a workout
5. Check your email for the workout summary

### Step 10: Set Up Daily Automation

Once everything works, set up automatic triggers:

1. In Apps Script, click **Triggers** (clock icon in left sidebar)
2. Click **+ Add Trigger** (bottom right)
3. Create these two triggers:

**Trigger 1: Sync Activities**
- Function: `fetchAndLogActivities`
- Event source: Time-driven
- Type: Day timer
- Time: 2:00 AM - 3:00 AM

**Trigger 2: Generate Workouts**
- Function: `generateOptimalZwiftWorkoutsAutoByGemini`
- Event source: Time-driven
- Type: Day timer
- Time: 6:00 AM - 7:00 AM

**Trigger 3: Weekly Summary (Optional)**
- Function: `sendWeeklySummaryEmail`
- Event source: Time-driven
- Type: Week timer
- Day: Sunday
- Time: 8:00 PM - 9:00 PM

**Trigger 4: Monthly Progress Report (Optional)**
- Function: `sendMonthlyProgressEmail`
- Event source: Time-driven
- Type: Month timer
- Day: 1st
- Time: 9:00 AM - 10:00 AM

Click **Save** for each trigger.

## Troubleshooting

| Problem | Solution |
|---------|----------|
| "Exception: Request failed" | Check your API keys are correct |
| testEftp shows "N/A" for power | You need recent cycling activities with power data |
| testRunningData shows "N/A" | You need recent running activities |
| No workout generated | Make sure placeholder is exactly `Ride` or `Run` |
| Email not received | Check `EMAIL_TO` setting and spam folder |

## Test Functions Reference

| Function | What it tests |
|----------|---------------|
| `testGoals()` | A/B/C race detection from calendar |
| `testEftp()` | Power profile (eFTP, W', VO2max, peaks) |
| `testRunningData()` | Running data (CS, D', pace zones) |
| `testWeeklySummary()` | Weekly activity aggregation |
| `testTrainingLoadAdvisor()` | Training load recommendations |
| `testMonthlyProgress()` | 8-week progress trends (CTL, eFTP, volume) |
| `debugPowerCurve()` | Raw power curve API response |
| `debugPaceCurve()` | Raw pace curve API response |
| `debugEvents()` | Raw calendar events API response |

## Email Summary

### Daily Workout Email
IntervalCoach sends a daily email with:
- Current training phase and weeks to goal
- Recovery status (if Whoop/Garmin connected)
- Power/pace profile summary
- Recommended workout with explanation
- Workout details (for running)
- Attached .zwo file (for cycling)

### Weekly Summary Email
A weekly recap email (set up via trigger) includes:
- AI-generated personalized weekly insights
- Training totals (activities, time, TSS, distance)
- Week-over-week comparison for all metrics
- Fitness progress (CTL, ATL, TSB, eFTP, ramp rate) with changes vs previous week
- Health & recovery averages (sleep, HRV, resting HR) with changes vs previous week
- Training load advice (target CTL, weekly/daily TSS recommendations)
- Training phase and goal progress

### Monthly Progress Report
A monthly report (set up via trigger, e.g., 1st of each month) includes:
- AI-generated 8-week training assessment
- CTL progression with weekly breakdown (trend visualization)
- eFTP progression over 8 weeks
- Training volume patterns (weekly TSS breakdown)
- Consistency tracking (weeks trained percentage)
- Goal progress and training phase context

## Recovery Integration

If you have Whoop, Garmin, or Oura connected to Intervals.icu:

| Recovery Status | Intensity Adjustment |
|-----------------|---------------------|
| 🟢 Green (Primed) | Full intensity |
| 🟡 Yellow (Recovering) | Reduced intensity, favor tempo over VO2max |
| 🔴 Red (Strained) | Easy/recovery only |

## Training Phases

| Weeks Out | Phase | Focus |
|-----------|-------|-------|
| 16+ | Base | Aerobic endurance, Z2, Tempo, SweetSpot |
| 8-16 | Build | FTP development, Threshold, increasing CTL |
| 3-8 | Specialty | Race specificity, VO2max, Anaerobic |
| 1-3 | Peak/Taper | Reduce volume, maintain intensity |
| 0-1 | Race Week | Sharpness, short openers |

## Training Load Advisor

The weekly email includes personalized training load recommendations:

| Metric | Description |
|--------|-------------|
| Target CTL | Current → target fitness level based on goal date |
| Weekly TSS | Recommended TSS range for the upcoming week |
| Daily TSS | Suggested TSS per training day (assuming 5-6 days/week) |
| Load Advice | Phase-specific guidance (build, maintain, taper, recover) |

Ramp rate limits are applied to prevent overtraining:
- **Safe**: 3-5 CTL/week - sustainable progression
- **Aggressive**: 5-7 CTL/week - monitor fatigue closely
- **Maximum**: 8 CTL/week - risk of overtraining

Warnings are displayed when:
- TSB drops below -25 (high fatigue, recovery recommended)
- Current ramp rate exceeds safe limits
- Required ramp rate to meet goal is unsustainable

## Supported Languages

- English (en)
- Dutch (nl)
- Japanese (ja)
- Spanish (es)
- French (fr)

## License

MIT License
