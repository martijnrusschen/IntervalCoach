/**
 * IntervalCoach Configuration (Sample)
 *
 * Copy this file to config.gs and fill in your values.
 * DO NOT commit config.gs to version control!
 *
 * In Google Apps Script:
 * 1. Create a new file called "config" (it will become config.gs)
 * 2. Copy the contents of this file
 * 3. Replace the placeholder values with your actual credentials
 */

// =========================================================
// API KEYS & AUTHENTICATION
// =========================================================
const API_KEYS = {
  // Intervals.icu API Key
  // Get it from: intervals.icu -> Settings -> Developer -> API Key
  ICU_TOKEN: "your-intervals-icu-api-key-here",

  // Google Gemini API Key
  // Get it from: aistudio.google.com -> Get API Key
  GEMINI_API_KEY: "your-gemini-api-key-here"
};

// =========================================================
// USER SETTINGS
// =========================================================
const USER_SETTINGS = {
  // Language for Email and Analysis
  // Options: "en" (English), "nl" (Dutch), "ja" (Japanese), "es" (Spanish), "fr" (French)
  LANGUAGE: "en",

  // Fallback goal (used only if no A/B races in your Intervals.icu calendar)
  // Be specific - the AI uses this to design workout structure
  GOAL_DESCRIPTION: "Build fitness for summer racing",
  TARGET_DATE: "2025-08-01",  // YYYY-MM-DD format

  // Placeholder keywords for workout generation
  // These match what you type in Intervals.icu calendar events
  PLACEHOLDER_RIDE: "Ride",   // Also works: "Ride - 90min"
  PLACEHOLDER_RUN: "Run",     // Also works: "Run - 45min", "Hardlopen"

  // Default duration range (when not specified in placeholder)
  DEFAULT_DURATION_RIDE: { min: 60, max: 90 },   // minutes
  DEFAULT_DURATION_RUN: { min: 30, max: 45 },    // minutes

  // Google Sheets logging (optional - create a sheet and copy its ID)
  // Leave empty string "" if you don't want logging
  SPREADSHEET_ID: "",
  SHEET_NAME: "training_log",

  // Google Drive folder for .zwo files
  WORKOUT_FOLDER: "IntervalCoach_Workouts",

  // Email address for daily workout summaries
  EMAIL_TO: "your-email@example.com"
};
