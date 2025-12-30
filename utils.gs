/**
 * IntervalCoach - Core Utility Functions
 *
 * Base helper functions for formatting, calculations, and common operations.
 * Related modules: events.gs, tracking.gs, adaptation.gs, context.gs
 */

// =========================================================
// FORMATTING UTILITIES
// =========================================================

/**
 * Format a Date object as ISO date string (yyyy-MM-dd)
 * @param {Date} date - Date to format
 * @returns {string} Formatted date string
 */
function formatDateISO(date) {
  return Utilities.formatDate(date, SYSTEM_SETTINGS.TIMEZONE, "yyyy-MM-dd");
}

/**
 * Convert Intervals.icu feel value to label
 * Intervals.icu scale: 1=Strong (best), 2=Good, 3=Normal, 4=Poor, 5=Weak (worst)
 * @param {number} feelValue - Feel value from Intervals.icu (1-5)
 * @returns {string} Human readable label
 */
function getFeelLabel(feelValue, lang) {
  lang = lang || USER_SETTINGS.LANGUAGE || 'en';
  const feelLabels = lang === 'nl'
    ? { 1: 'sterk', 2: 'goed', 3: 'normaal', 4: 'matig', 5: 'zwak' }
    : { 1: 'strong', 2: 'good', 3: 'normal', 4: 'poor', 5: 'weak' };
  return feelLabels[Math.round(feelValue)] || String(feelValue);
}

/**
 * Check if feel value indicates good recovery (Strong or Good)
 * @param {number} feelValue - Feel value from Intervals.icu (1-5)
 * @returns {boolean} True if feeling good
 */
function isGoodFeel(feelValue) {
  return feelValue != null && feelValue <= 2;
}

/**
 * Check if feel value indicates poor recovery (Poor or Weak)
 * @param {number} feelValue - Feel value from Intervals.icu (1-5)
 * @returns {boolean} True if feeling poor
 */
function isPoorFeel(feelValue) {
  return feelValue != null && feelValue >= 4;
}

/**
 * Format duration in seconds to human readable string
 * @param {number} seconds - Duration in seconds
 * @param {boolean} showSign - Whether to show +/- sign for differences
 * @returns {string} Formatted duration (e.g., "1h 23m" or "+45m")
 */
function formatDuration(seconds, showSign) {
  if (seconds == null) return "0m";

  const sign = showSign ? (seconds >= 0 ? "+" : "-") : "";
  const absSeconds = Math.abs(seconds);

  if (absSeconds < 60) return sign + "0m";

  const hours = Math.floor(absSeconds / 3600);
  const minutes = Math.floor((absSeconds % 3600) / 60);

  if (hours > 0) {
    return sign + hours + "h " + minutes + "m";
  }
  return sign + minutes + "m";
}

/**
 * Format a number change with + or - prefix
 * Supports two calling patterns:
 *   formatChange(changeValue, decimals) - formats pre-calculated change
 *   formatChange(current, previous, decimals, unit) - calculates and formats change
 * @param {number} currentOrChange - Current value or pre-calculated change
 * @param {number} prevOrDecimals - Previous value or decimals
 * @param {number} decimals - Number of decimal places (default 1)
 * @param {string} unit - Optional unit suffix (e.g., 'W', '%', 'h')
 * @returns {string} Formatted change (e.g., "+5.2" or "-3.1W")
 */
function formatChange(currentOrChange, prevOrDecimals, decimals, unit) {
  // Detect calling pattern: if 3rd arg exists, it's (current, prev, decimals, unit)
  if (decimals !== undefined) {
    // Pattern: formatChange(current, previous, decimals, unit)
    const current = currentOrChange;
    const previous = prevOrDecimals;
    if (current == null || previous == null) return '';
    const change = current - previous;
    const dec = typeof decimals === 'number' ? decimals : 1;
    const sign = change >= 0 ? "+" : "";
    const suffix = unit ? unit : '';
    return ` (${sign}${change.toFixed(dec)}${suffix})`;
  } else {
    // Pattern: formatChange(changeValue, decimals)
    const value = currentOrChange;
    if (value == null) return '';
    const dec = typeof prevOrDecimals === 'number' && prevOrDecimals !== false ? prevOrDecimals : 1;
    const sign = value >= 0 ? "+" : "";
    return sign + value.toFixed(dec);
  }
}

/**
 * Convert m/s to min:sec/km pace format
 * @param {number} ms - Speed in meters per second
 * @returns {string} Pace in "M:SS" format (e.g., "5:00")
 */
function convertMsToMinKm(ms) {
  if (!ms || ms <= 0) return 'N/A';
  const secsPerKm = 1000 / ms;
  const mins = Math.floor(secsPerKm / 60);
  const secs = Math.round(secsPerKm % 60);
  return mins + ":" + (secs < 10 ? "0" : "") + secs;
}

/**
 * Add seconds to a pace string (e.g., "5:30" + 30 = "6:00")
 * @param {string} paceStr - Pace in "M:SS" format
 * @param {number} secsToAdd - Seconds to add
 * @returns {string} New pace in "M:SS" format
 */
function addPace(paceStr, secsToAdd) {
  if (!paceStr || typeof paceStr !== 'string') return 'N/A';
  const parts = paceStr.split(':');
  if (parts.length !== 2) return paceStr;

  const mins = parseInt(parts[0], 10);
  const secs = parseInt(parts[1], 10);
  const totalSecs = mins * 60 + secs + secsToAdd;

  const newMins = Math.floor(totalSecs / 60);
  const newSecs = totalSecs % 60;
  return newMins + ":" + (newSecs < 10 ? "0" : "") + newSecs;
}

/**
 * Subtract seconds from a pace string (e.g., "5:30" - 30 = "5:00")
 * @param {string} paceStr - Pace in "M:SS" format
 * @param {number} secsToSubtract - Seconds to subtract
 * @returns {string} New pace in "M:SS" format
 */
function subtractPace(paceStr, secsToSubtract) {
  if (!paceStr || typeof paceStr !== 'string') return 'N/A';
  const parts = paceStr.split(':');
  if (parts.length !== 2) return paceStr;

  const mins = parseInt(parts[0], 10);
  const secs = parseInt(parts[1], 10);
  const totalSecs = Math.max(0, mins * 60 + secs - secsToSubtract);

  const newMins = Math.floor(totalSecs / 60);
  const newSecs = totalSecs % 60;
  return newMins + ":" + (newSecs < 10 ? "0" : "") + newSecs;
}

// =========================================================
// ARRAY & MATH UTILITIES
// =========================================================

/**
 * Calculate average of an array of numbers
 * @param {number[]} arr - Array of numbers
 * @returns {number} Average value (0 if empty)
 */
function average(arr) {
  return arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
}

/**
 * Calculate sum of an array of numbers
 * @param {number[]} arr - Array of numbers
 * @returns {number} Sum value
 */
function sum(arr) {
  return arr.reduce((a, b) => a + b, 0);
}

// =========================================================
// API DELAY UTILITY
// =========================================================

/**
 * Simple delay function for rate limiting
 * @param {number} ms - Milliseconds to delay
 */
function delay(ms) {
  Utilities.sleep(ms);
}

// =========================================================
// GEMINI API UTILITIES
// =========================================================

/**
 * Parse Gemini API response, cleaning markdown code blocks
 * @param {string} response - Raw response text from Gemini API
 * @returns {object|null} Parsed JSON object or null if parsing fails
 */
function parseGeminiJsonResponse(response) {
  if (!response || typeof response !== 'string') {
    return null;
  }

  try {
    let cleaned = response.trim();
    // Remove markdown code block wrappers
    cleaned = cleaned.replace(/^```json\n?/g, '').replace(/^```\n?/g, '').replace(/```$/g, '').trim();
    return JSON.parse(cleaned);
  } catch (e) {
    Logger.log("Error parsing Gemini JSON response: " + e.toString());
    return null;
  }
}

// =========================================================
// LOCALIZATION UTILITIES
// =========================================================

/**
 * Get translations for current language setting
 * Falls back to English if language not found
 * @returns {object} Translation object for current language
 */
function getTranslations() {
  return TRANSLATIONS[USER_SETTINGS.LANGUAGE] || TRANSLATIONS.en;
}

// =========================================================
// WORKOUT NAMING
// =========================================================

/**
 * Generate workout name for Intervals.icu/Strava/Zwift
 * Format: "IntervalCoach {WorkoutType}" e.g., "IntervalCoach Sweet Spot"
 * @param {string} workoutType - The workout type (e.g., "Sweet Spot", "VO2max")
 * @returns {string} Formatted workout name
 */
function generateWorkoutName(workoutType) {
  return `IntervalCoach ${workoutType}`;
}

/**
 * Check if a workout name is an IntervalCoach generated workout
 * @param {string} name - Workout name to check
 * @returns {boolean} True if it's an IntervalCoach workout
 */
function isIntervalCoachWorkout(name) {
  return name?.startsWith('IntervalCoach');
}

// =========================================================
// ACTIVITY TYPE UTILITIES
// =========================================================

/**
 * Check if activity is a cycling workout
 * @param {object} activity - Activity object with type property
 * @returns {boolean} True if cycling activity
 */
function isCyclingActivity(activity) {
  return activity && (activity.type === 'Ride' || activity.type === 'VirtualRide');
}

/**
 * Check if activity is a running workout
 * @param {object} activity - Activity object with type property
 * @returns {boolean} True if running activity
 */
function isRunningActivity(activity) {
  return activity && (activity.type === 'Run' || activity.type === 'VirtualRun');
}

/**
 * Check if activity is a relevant sport activity (cycling or running)
 * @param {object} activity - Activity object with type property
 * @returns {boolean} True if cycling or running activity
 */
function isSportActivity(activity) {
  return isCyclingActivity(activity) || isRunningActivity(activity);
}

// =========================================================
// DATE RANGE UTILITIES
// =========================================================

/**
 * Get date range for API queries
 * @param {number} daysBack - How many days back from reference date
 * @param {number} daysOffset - Days offset from today (default 0, positive = past)
 * @returns {object} Object with oldest and newest date strings (yyyy-MM-dd)
 */
function getDateRange(daysBack, daysOffset) {
  daysOffset = daysOffset || 0;
  const today = new Date();
  const newest = new Date(today);
  newest.setDate(today.getDate() - daysOffset);
  const oldest = new Date(newest);
  oldest.setDate(newest.getDate() - daysBack + 1);

  return {
    oldest: formatDateISO(oldest),
    newest: formatDateISO(newest)
  };
}

/**
 * Get a single date offset from today
 * @param {number} daysOffset - Days offset from today (positive = future, negative = past)
 * @returns {string} Date string in yyyy-MM-dd format
 */
function getDateOffset(daysOffset) {
  const date = new Date();
  date.setDate(date.getDate() + daysOffset);
  return formatDateISO(date);
}
