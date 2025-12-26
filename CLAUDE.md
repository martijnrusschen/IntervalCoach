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
Google Drive (.zwo files) + Intervals.icu (workout upload) + Email
```

### File Structure

The codebase is organized into modular files by domain:

| File | Purpose | Key Functions |
|------|---------|---------------|
| `main.gs` | Entry points & tests | `generateOptimalZwiftWorkoutsAutoByGemini()`, `fetchAndLogActivities()`, test functions |
| `constants.gs` | Configuration constants | `SYSTEM_SETTINGS`, `TRAINING_CONSTANTS`, `WORKOUT_TYPES`, `HEADERS_FIXED` |
| `translations.gs` | Localization (5 languages) | `TRANSLATIONS` (en, nl, ja, es, fr) |
| `api.gs` | API utilities | `fetchIcuApi()`, `callGeminiAPI()`, `validateZwoXml()`, `getIcuAuthHeader()` |
| `wellness.gs` | Wellness/recovery data | `fetchWellnessData()`, `fetchWellnessDataEnhanced()`, `createWellnessSummary()`, `isRestDayRecommended()` |
| `whoop.gs` | Whoop API integration | `fetchWhoopWellnessData()`, `getWhoopCurrentRecovery()`, `authorizeWhoop()` |
| `workouts.gs` | Workout selection logic | `checkAvailability()`, `selectWorkoutTypes()`, `uploadWorkoutToIntervals()` |
| `power.gs` | Power/pace analysis | `fetchPowerCurve()`, `analyzePowerProfile()`, `fetchRunningData()`, `fetchFitnessMetrics()`, `projectFitnessMetrics()`, `generateWorkoutImpactPreview()`, `calculateZoneProgression()`, `getZoneRecommendations()` |
| `prompts.gs` | AI prompt construction | `createPrompt()`, `createRunPrompt()`, `generatePersonalizedCoachingNote()` |
| `emails.gs` | Email sending | `sendSmartSummaryEmail()`, `sendRestDayEmail()`, `sendWeeklySummaryEmail()` |
| `utils.gs` | Helper functions | `formatDateISO()`, `average()`, `sum()`, `getAdaptiveTrainingContext()`, `getZoneProgression()`, `storeZoneProgression()` |
| `config.gs` | User config (gitignored) | API keys, user settings |
| `config.sample.gs` | Config template | Copy to create config.gs |

### Key Functions

**Entry Points (in main.gs):**
- `generateOptimalZwiftWorkoutsAutoByGemini()` - Main daily workout generation
- `fetchAndLogActivities()` - Activity sync to Google Sheets

**Test Functions (run in Apps Script editor):**
- `testApiUtilities()` - Verify API connections
- `testAdaptiveTraining()` - Test RPE/Feel feedback analysis
- `testTrainingLoadAdvisor()` - Test training load recommendations
- `testAITrainingLoadAdvisor()` - Test AI training load with wellness context
- `testAIRecoveryAssessment()` - Test AI recovery using personal baselines
- `testWorkoutSelection()` - Test workout type selection logic
- `testAIPowerProfileAnalysis()` - Test AI power profile analysis with goal context
- `testCoachingNote()` - Test AI coaching note generation
- `testRestDayEmail()` - Test rest day email functionality
- `testTrainingProposal()` - Test weekly training proposal
- `testWorkoutImpactPreview()` - Test workout impact preview with 2-week projections
- `testZoneProgression()` - Test zone progression levels and AI recommendations
- `testWhoopApi()` - Test direct Whoop API connection (in whoop.gs)
- `testWhoopWellness()` - Test Whoop-enhanced wellness data fetching

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

**Deployment with clasp:**
```bash
# Push local changes to Google Apps Script
clasp push

# Pull remote changes (if edited in web UI)
clasp pull

# Open the script in browser
clasp open
```

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
