# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

IntervalCoach is an AI-powered cycling and running coach built on Google Apps Script. It integrates with Intervals.icu for training data and Google Gemini AI for workout generation, producing personalized daily workouts based on fitness data, training phase, and recovery status.

## Architecture

**Platform**: Google Apps Script (serverless JavaScript runtime)
**External APIs**: Intervals.icu REST API, Google Gemini API (gemini-3-pro-preview), Whoop API (optional)
**Outputs**: Zwift .zwo files, structured run workouts, email summaries

### Data Flow

```
Intervals.icu (Calendar, Power/Pace Curves, Wellness)
    ↓
IntervalCoach (fetch data → analyze → generate via Gemini → upload)
    ↓
Intervals.icu (structured workouts) + Email → Zwift (syncs from Intervals.icu)
```

### File Structure

The codebase is organized into modular files by domain (Google Apps Script doesn't support folders, so domain prefixes are used):

**Core Files**

| File | Purpose | Key Functions |
|------|---------|---------------|
| `main.gs` | Entry points | `generateOptimalZwiftWorkoutsAutoByGemini()`, `checkForCompletedWorkouts()` |
| `constants.gs` | Configuration constants | `SYSTEM_SETTINGS`, `TRAINING_CONSTANTS`, `WORKOUT_TYPES` |
| `translations.gs` | Localization (5 languages) | `TRANSLATIONS` (en, nl, ja, es, fr) |
| `api.gs` | API utilities | `fetchIcuApi()`, `callGeminiAPI()`, `validateZwoXml()`, `getIcuAuthHeader()` |
| `config.gs` | User config (gitignored) | API keys, user settings |
| `config.sample.gs` | Config template | Copy to create config.gs |

**Wellness Domain**

| File | Purpose | Key Functions |
|------|---------|---------------|
| `wellness.gs` | Wellness/recovery data | `fetchWellnessData()`, `fetchWellnessDataEnhanced()`, `createWellnessSummary()`, `isRestDayRecommended()` |
| `whoop.gs` | Whoop API integration | `fetchWhoopWellnessData()`, `getWhoopCurrentRecovery()`, `authorizeWhoop()` |

**Power & Fitness Domain**

| File | Purpose | Key Functions |
|------|---------|---------------|
| `power.gs` | Core power curve analysis | `fetchAthleteData()`, `fetchPowerCurve()`, `analyzePowerProfile()` |
| `goals.gs` | Goal & phase management | `fetchUpcomingGoals()`, `buildGoalDescription()`, `calculateTrainingPhase()` |
| `running.gs` | Running pace/CS analysis | `fetchRunningData()`, `fetchRunningPaceCurve()` |
| `fitness.gs` | Fitness metrics & projections | `fetchFitnessMetrics()`, `fetchFitnessTrend()`, `projectFitnessMetrics()`, `generateWorkoutImpactPreview()` |
| `zones.gs` | Zone progression & cross-sport | `calculateZoneProgression()`, `getZoneRecommendations()`, `calculateCrossSportEquivalency()` |

**Training Utilities Domain**

| File | Purpose | Key Functions |
|------|---------|---------------|
| `utils.gs` | Core utilities | `formatDateISO()`, `formatDuration()`, `average()`, `sum()`, `parseGeminiJsonResponse()` |
| `events.gs` | Calendar event management | `fetchEventsForDate()`, `hasEventOnDate()`, `hasEventTomorrow()`, `deleteIntervalEvent()` |
| `tracking.gs` | Training tracking & storage | `getDaysSinceLastWorkout()`, `analyzeTrainingGap()`, `storeWorkoutAnalysis()`, `getZoneProgression()` |
| `adaptation.gs` | Adaptive training | `getAdaptiveTrainingContext()`, `fetchRecentActivityFeedback()`, `checkWeekProgress()`, `calculateTrainingLoadAdvice()` |
| `context.gs` | Centralized context builder | `gatherTrainingContext()`, `logTrainingContext()` |

**Workout Domain**

| File | Purpose | Key Functions |
|------|---------|---------------|
| `workouts.gs` | Core workout selection | `checkAvailability()`, `selectWorkoutTypes()`, `classifyActivityType()` |
| `workouts_planning.gs` | Weekly planning & adaptation | `fetchUpcomingPlaceholders()`, `generateAIWeeklyPlan()`, `analyzeWeeklyPlanExecution()` |
| `workouts_upload.gs` | Calendar upload | `uploadWorkoutToIntervals()`, `uploadRunToIntervals()` |
| `emails.gs` | Email sending | `sendSmartSummaryEmail()`, `sendRestDayEmail()`, `sendWeeklySummaryEmail()` |

**Prompts Domain**

| File | Purpose | Key Functions |
|------|---------|---------------|
| `prompts_workout.gs` | Workout generation prompts | `createPrompt()`, `createRunPrompt()`, `buildZoneContext()` |
| `prompts_analysis.gs` | Analysis prompts | `generateAIPowerProfileAnalysis()`, `generateAIRecoveryAssessment()`, `generatePostWorkoutAnalysis()` |
| `prompts_planning.gs` | Planning & coaching prompts | `generatePersonalizedCoachingNote()`, `generateAIPhaseAssessment()`, `generateAITrainingLoadAdvice()` |

**Test Files** (domain-prefixed for organization)

| File | Purpose |
|------|---------|
| `test_api.gs` | API connection tests |
| `test_training.gs` | Adaptive training & feedback tests |
| `test_recovery.gs` | Recovery assessment tests |
| `test_workout.gs` | Workout selection tests |
| `test_planning.gs` | Training proposal & impact tests |
| `test_power.gs` | Power profile analysis tests |
| `test_zones.gs` | Zone progression tests |
| `test_email.gs` | Email functionality tests |
| `test_periodization.gs` | Training phase tests |
| `test_misc.gs` | Miscellaneous utility tests |

### Key Functions

**Entry Points (in main.gs):**
- `generateOptimalZwiftWorkoutsAutoByGemini()` - Main daily workout generation
- `checkForCompletedWorkouts()` - Hourly post-workout AI analysis
- `sendWeeklySummaryEmail()` - Weekly summary and planning

**Test Functions (run in Apps Script editor):**

Tests are organized by domain in separate files (test_*.gs):
- `test_api.gs`: `testApiUtilities()`, `testWhoopApi()`, `testWhoopWellness()`
- `test_training.gs`: `testAdaptiveTraining()`, `testTrainingLoadAdvisor()`, `testAITrainingLoadAdvisor()`
- `test_recovery.gs`: `testAIRecoveryAssessment()`
- `test_workout.gs`: `testWorkoutSelection()`, `testCoachingNote()`
- `test_planning.gs`: `testTrainingProposal()`, `testWorkoutImpactPreview()`, `testMidWeekAdaptation()`
- `test_power.gs`: `testAIPowerProfileAnalysis()`
- `test_zones.gs`: `testZoneProgression()`
- `test_email.gs`: `testRestDayEmail()`
- `test_periodization.gs`: Training phase calculation tests
- `test_misc.gs`: Utility function tests

### Core Data Structures

**Power Profile**: eFTP, W', VO2max, peak powers (5s-60m), strengths/focus areas
**Running Data**: Critical Speed, D', pace zones, best efforts (400m-5k)
**Wellness**: HRV, sleep, resting HR, recovery status (green/yellow/red), trend
**Zone Progression**: Per-zone fitness levels (1-10), trends (improving/stable/declining), focus areas

## Development Workflow

This is a Google Apps Script project using clasp for deployment.

**Git Workflow:**
- For every new feature, create a branch and open a pull request before merging to main.
- Always test features in Google Apps Script before committing and pushing.
- Always update README.md when adding new features, functions, or configuration options.

**Deployment:**
```bash
# Deploy to all athletes
./deploy.sh

# Deploy to specific athlete
./deploy.sh martijn
./deploy.sh eef

# Open script in browser (safe to use directly)
clasp open

# Check clasp status (safe to use directly)
clasp status
```

**IMPORTANT: Never use `clasp push` or `clasp pull` directly!**
- Direct clasp commands bypass the config management system
- `clasp push --force` deletes remote config.gs (contains API keys)
- Always use `./deploy.sh` for all deployments

## Multi-Athlete Setup

Each athlete has their own Apps Script project with separate credentials.

**File structure:**
```
.clasp.martijn.json  # Martijn's project script ID
.clasp.eef.json      # Eef's project script ID
config.martijn.gs    # Martijn's config (gitignored)
config.eef.gs        # Eef's config (gitignored)
deploy.sh            # Deploy script that swaps configs per athlete
```

**How deploy.sh works:**
1. Swaps `.clasp.json` to target athlete's project
2. Copies athlete's `config.{name}.gs` to `config.gs`
3. Temporarily removes `config.gs` from `.claspignore`
4. Pushes code with correct config
5. Restores original state

**Adding a new athlete:**
1. Create new Apps Script project for them
2. Create `.clasp.{name}.json` with their script ID:
   ```json
   {
     "scriptId": "their-script-id-here",
     "rootDir": "."
   }
   ```
3. Create `config.{name}.gs` with their credentials (gitignored)
4. Add athlete name to deploy.sh
5. Deploy with `./deploy.sh {name}`

**Testing:**
Run test functions manually in the Apps Script editor (Run button or Ctrl+R)

**Debugging:**
Check Executions log in Apps Script editor for error details

## Configuration

Required in `config.gs`:
- `API_KEYS.ICU_TOKEN` - Intervals.icu API key
- `API_KEYS.GEMINI_API_KEY` - Google Gemini API key
- `USER_SETTINGS.EMAIL_TO` - Email address for workout summaries
- `USER_SETTINGS.LANGUAGE` - Supported: en, nl, ja, es, fr

## Important Notes

- `config.gs` is gitignored - never commit API keys
- `.claspignore` excludes `config.sample.gs` from push to avoid duplicate declarations
- Gemini API uses JSON response mode with temperature 0.3
- Training phase calculated automatically from `TARGET_DATE` setting or A/B/C races in calendar
- Placeholder activities ("Ride", "Run") in Intervals.icu calendar trigger workout generation
- Duration can be specified in placeholder name: "Ride - 90min"
- Red recovery status (Whoop < 34%) triggers rest day email instead of workout
