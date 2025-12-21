# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

IntervalCoach is an AI-powered cycling and running coach built on Google Apps Script. It integrates with Intervals.icu for training data and Google Gemini AI for workout generation, producing personalized daily workouts based on fitness data, training phase, and recovery status.

## Architecture

**Platform**: Google Apps Script (serverless JavaScript runtime)
**External APIs**: Intervals.icu REST API, Google Gemini API (gemini-3-pro-preview)
**Outputs**: Zwift .zwo files, structured run workouts, email summaries

### Data Flow

```
Intervals.icu (Calendar, Power/Pace Curves, Wellness)
    ↓
Code.gs (fetch data → analyze → generate via Gemini → upload)
    ↓
Google Drive (.zwo files) + Intervals.icu (workout upload) + Email
```

### File Structure

- `Code.gs` - Main application (2,848 lines): data fetching, analysis, workout generation, email
- `config.sample.gs` - Configuration template with API keys and user settings
- `config.gs` - User-specific config (gitignored, created from sample)

### Key Functions

**Entry Points:**
- `generateOptimalZwiftWorkoutsAutoByGemini()` - Main daily workout generation (line 1978)
- `fetchAndLogActivities()` - Activity sync to Google Sheets

**Test Functions (run in Apps Script editor):**
- `testEftp()` - Verify cycling power data
- `testRunningData()` - Verify running pace data
- `testGoals()` - Verify A/B race detection
- `debugEvents()`, `debugPowerCurve()`, `debugPaceCurve()` - API debugging

### Core Data Structures

**Power Profile**: eFTP, W', VO2max, peak powers (5s-60m), strengths/focus areas
**Running Data**: Critical Speed, D', pace zones, best efforts (400m-5k)
**Wellness**: HRV, sleep, resting HR, recovery status (green/yellow/red), trend

## Development Workflow

This is a Google Apps Script project - no traditional build system, package.json, or CLI commands.

**Git Workflow:**
For every new feature, create a branch and open a pull request before merging to main.

**Deployment:**
1. Open Google Sheet → Extensions → Apps Script
2. Copy `Code.gs` content into the Code file
3. Create `config.gs` from `config.sample.gs` with your API keys
4. Save and run test functions to verify setup
5. Set up triggers in the Triggers panel for automation

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
- Gemini API uses JSON response mode with temperature 0.3
- Training phase calculated automatically from `TARGET_DATE` setting
- Placeholder activities ("Ride", "Run") in Intervals.icu calendar trigger workout generation
- Duration can be specified in placeholder name: "Ride - 90min"
