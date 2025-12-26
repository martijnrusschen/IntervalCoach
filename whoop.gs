/**
 * IntervalCoach - Whoop API Integration
 *
 * Direct Whoop API access for real-time recovery data.
 * Provides fresher data than Intervals.icu's 8-hour polling cycle.
 *
 * Setup:
 * 1. Create app at developer.whoop.com
 * 2. Add client ID and secret to config.gs
 * 3. Run authorizeWhoop() once to complete OAuth flow
 * 4. Tokens are auto-refreshed thereafter
 */

// =========================================================
// WHOOP API CONSTANTS
// =========================================================

const WHOOP_API = {
  AUTH_URL: 'https://api.prod.whoop.com/oauth/oauth2/auth',
  TOKEN_URL: 'https://api.prod.whoop.com/oauth/oauth2/token',
  API_BASE: 'https://api.prod.whoop.com/developer/v1',
  SCOPES: 'read:cycles read:recovery read:sleep offline'
};

// =========================================================
// OAUTH TOKEN MANAGEMENT
// =========================================================

/**
 * Get Whoop configuration from config.gs
 * @returns {object|null} Whoop config or null if not configured
 */
function getWhoopConfig() {
  if (typeof WHOOP_CONFIG === 'undefined' || !WHOOP_CONFIG.CLIENT_ID || !WHOOP_CONFIG.CLIENT_SECRET) {
    return null;
  }
  return WHOOP_CONFIG;
}

/**
 * Check if Whoop integration is configured and authorized
 * @returns {boolean} True if Whoop is ready to use
 */
function isWhoopConfigured() {
  const config = getWhoopConfig();
  if (!config) return false;

  const props = PropertiesService.getScriptProperties();
  const refreshToken = props.getProperty('WHOOP_REFRESH_TOKEN');
  return !!refreshToken;
}

/**
 * Get stored Whoop tokens
 * @returns {object} Token data { accessToken, refreshToken, expiresAt }
 */
function getWhoopTokens() {
  const props = PropertiesService.getScriptProperties();
  return {
    accessToken: props.getProperty('WHOOP_ACCESS_TOKEN'),
    refreshToken: props.getProperty('WHOOP_REFRESH_TOKEN'),
    expiresAt: parseInt(props.getProperty('WHOOP_TOKEN_EXPIRES') || '0', 10)
  };
}

/**
 * Store Whoop tokens
 * @param {string} accessToken - Access token
 * @param {string} refreshToken - Refresh token
 * @param {number} expiresIn - Seconds until expiry
 */
function storeWhoopTokens(accessToken, refreshToken, expiresIn) {
  const expiresAt = Date.now() + (expiresIn * 1000) - 60000; // Subtract 1 min buffer
  const props = PropertiesService.getScriptProperties();
  props.setProperties({
    'WHOOP_ACCESS_TOKEN': accessToken,
    'WHOOP_REFRESH_TOKEN': refreshToken,
    'WHOOP_TOKEN_EXPIRES': expiresAt.toString()
  });
  Logger.log('Whoop tokens stored, expires at: ' + new Date(expiresAt).toISOString());
}

/**
 * Check if access token is expired
 * @returns {boolean} True if expired or expiring soon
 */
function isWhoopTokenExpired() {
  const tokens = getWhoopTokens();
  if (!tokens.accessToken) return true;
  return Date.now() >= tokens.expiresAt;
}

/**
 * Refresh Whoop access token using refresh token
 * @returns {string|null} New access token or null on failure
 */
function refreshWhoopToken() {
  const config = getWhoopConfig();
  if (!config) {
    Logger.log('Whoop not configured');
    return null;
  }

  const tokens = getWhoopTokens();
  if (!tokens.refreshToken) {
    Logger.log('No Whoop refresh token available. Run authorizeWhoop() first.');
    return null;
  }

  try {
    const response = UrlFetchApp.fetch(WHOOP_API.TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      payload: {
        grant_type: 'refresh_token',
        refresh_token: tokens.refreshToken,
        client_id: config.CLIENT_ID,
        client_secret: config.CLIENT_SECRET
      },
      muteHttpExceptions: true
    });

    const status = response.getResponseCode();
    if (status !== 200) {
      Logger.log('Whoop token refresh failed: ' + status + ' - ' + response.getContentText());
      return null;
    }

    const data = JSON.parse(response.getContentText());
    storeWhoopTokens(data.access_token, data.refresh_token, data.expires_in);
    Logger.log('Whoop token refreshed successfully');
    return data.access_token;
  } catch (e) {
    Logger.log('Whoop token refresh error: ' + e.toString());
    return null;
  }
}

/**
 * Get valid Whoop access token (refreshes if needed)
 * @returns {string|null} Valid access token or null
 */
function getWhoopAccessToken() {
  if (!isWhoopConfigured()) {
    return null;
  }

  if (isWhoopTokenExpired()) {
    return refreshWhoopToken();
  }

  return getWhoopTokens().accessToken;
}

// =========================================================
// OAUTH AUTHORIZATION FLOW
// =========================================================

/**
 * Generate authorization URL for initial OAuth flow
 * Run this and visit the URL to authorize the app
 * @returns {string} Authorization URL
 */
function getWhoopAuthUrl() {
  const config = getWhoopConfig();
  if (!config) {
    throw new Error('Whoop not configured. Add WHOOP_CONFIG to config.gs');
  }

  const state = Utilities.getUuid().substring(0, 16);
  PropertiesService.getScriptProperties().setProperty('WHOOP_OAUTH_STATE', state);

  const params = {
    client_id: config.CLIENT_ID,
    redirect_uri: config.REDIRECT_URI,
    response_type: 'code',
    scope: WHOOP_API.SCOPES,
    state: state
  };

  const queryString = Object.keys(params)
    .map(key => encodeURIComponent(key) + '=' + encodeURIComponent(params[key]))
    .join('&');

  return WHOOP_API.AUTH_URL + '?' + queryString;
}

/**
 * Exchange authorization code for tokens
 * Call this after completing the OAuth flow with the code from the redirect
 * @param {string} code - Authorization code from redirect URL
 * @returns {boolean} True if successful
 */
function exchangeWhoopCode(code) {
  const config = getWhoopConfig();
  if (!config) {
    Logger.log('Whoop not configured');
    return false;
  }

  try {
    const response = UrlFetchApp.fetch(WHOOP_API.TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      payload: {
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: config.REDIRECT_URI,
        client_id: config.CLIENT_ID,
        client_secret: config.CLIENT_SECRET
      },
      muteHttpExceptions: true
    });

    const status = response.getResponseCode();
    if (status !== 200) {
      Logger.log('Whoop code exchange failed: ' + status + ' - ' + response.getContentText());
      return false;
    }

    const data = JSON.parse(response.getContentText());
    storeWhoopTokens(data.access_token, data.refresh_token, data.expires_in);
    Logger.log('Whoop authorization successful!');
    return true;
  } catch (e) {
    Logger.log('Whoop code exchange error: ' + e.toString());
    return false;
  }
}

/**
 * Interactive authorization helper
 * Run this function, follow the URL, paste the code
 */
function authorizeWhoop() {
  const config = getWhoopConfig();
  if (!config) {
    Logger.log('ERROR: Whoop not configured.');
    Logger.log('Add WHOOP_CONFIG to config.gs with CLIENT_ID, CLIENT_SECRET, and REDIRECT_URI');
    return;
  }

  const tokens = getWhoopTokens();
  if (tokens.refreshToken) {
    Logger.log('Whoop is already authorized!');
    Logger.log('To re-authorize, first run: clearWhoopTokens()');
    return;
  }

  const authUrl = getWhoopAuthUrl();
  Logger.log('=== WHOOP AUTHORIZATION ===');
  Logger.log('1. Visit this URL in your browser:');
  Logger.log(authUrl);
  Logger.log('');
  Logger.log('2. Log in with your Whoop credentials');
  Logger.log('3. Authorize the app');
  Logger.log('4. Copy the "code" parameter from the redirect URL');
  Logger.log('5. Run: exchangeWhoopCode("YOUR_CODE_HERE")');
}

/**
 * Clear stored Whoop tokens (for re-authorization)
 */
function clearWhoopTokens() {
  const props = PropertiesService.getScriptProperties();
  props.deleteProperty('WHOOP_ACCESS_TOKEN');
  props.deleteProperty('WHOOP_REFRESH_TOKEN');
  props.deleteProperty('WHOOP_TOKEN_EXPIRES');
  props.deleteProperty('WHOOP_OAUTH_STATE');
  Logger.log('Whoop tokens cleared');
}

// =========================================================
// WHOOP API DATA FETCHING
// =========================================================

/**
 * Make authenticated request to Whoop API
 * @param {string} endpoint - API endpoint (without base URL)
 * @param {object} params - Query parameters
 * @returns {object} { success, data, error }
 */
function fetchWhoopApi(endpoint, params = {}) {
  const accessToken = getWhoopAccessToken();
  if (!accessToken) {
    return { success: false, error: 'No valid Whoop access token' };
  }

  const queryString = Object.keys(params).length > 0
    ? '?' + Object.keys(params).map(k => encodeURIComponent(k) + '=' + encodeURIComponent(params[k])).join('&')
    : '';

  const url = WHOOP_API.API_BASE + endpoint + queryString;

  try {
    const response = UrlFetchApp.fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': 'Bearer ' + accessToken
      },
      muteHttpExceptions: true
    });

    const status = response.getResponseCode();
    if (status === 200) {
      return { success: true, data: JSON.parse(response.getContentText()) };
    } else if (status === 404) {
      return { success: true, data: null }; // No data available (e.g., no recovery yet)
    } else {
      return { success: false, error: 'HTTP ' + status + ': ' + response.getContentText() };
    }
  } catch (e) {
    return { success: false, error: e.toString() };
  }
}

/**
 * Get current cycle from Whoop
 * @returns {object|null} Current cycle data or null
 */
function getWhoopCurrentCycle() {
  const result = fetchWhoopApi('/cycle', { limit: 1 });
  if (!result.success || !result.data) {
    Logger.log('Failed to get Whoop cycle: ' + (result.error || 'No data'));
    return null;
  }

  const records = result.data.records || [];
  return records.length > 0 ? records[0] : null;
}

/**
 * Get recovery data for a specific cycle
 * @param {number} cycleId - Cycle ID
 * @returns {object|null} Recovery data or null
 */
function getWhoopRecoveryForCycle(cycleId) {
  const result = fetchWhoopApi('/cycle/' + cycleId + '/recovery');
  if (!result.success) {
    Logger.log('Failed to get Whoop recovery: ' + result.error);
    return null;
  }
  return result.data;
}

/**
 * Get current recovery data from Whoop
 * Combines cycle + recovery API calls
 * @returns {object} { available, recovery, hrv, restingHR, spo2, skinTemp, sleepId }
 */
function getWhoopCurrentRecovery() {
  if (!isWhoopConfigured()) {
    return { available: false, reason: 'Whoop not configured' };
  }

  // Step 1: Get current cycle
  const cycle = getWhoopCurrentCycle();
  if (!cycle) {
    return { available: false, reason: 'No current cycle' };
  }

  // Step 2: Get recovery for this cycle
  const recovery = getWhoopRecoveryForCycle(cycle.id);
  if (!recovery) {
    return { available: false, reason: 'No recovery data for current cycle' };
  }

  // Check if scored
  if (recovery.score_state !== 'SCORED') {
    return {
      available: false,
      reason: 'Recovery not yet scored (state: ' + recovery.score_state + ')'
    };
  }

  const score = recovery.score || {};
  return {
    available: true,
    source: 'whoop_api',
    cycleId: cycle.id,
    sleepId: recovery.sleep_id,
    recovery: score.recovery_score,
    hrv: score.hrv_rmssd_milli,
    restingHR: score.resting_heart_rate,
    spo2: score.spo2_percentage,
    skinTemp: score.skin_temp_celsius,
    userCalibrating: score.user_calibrating,
    createdAt: recovery.created_at,
    updatedAt: recovery.updated_at
  };
}

/**
 * Get sleep data for a specific sleep ID
 * @param {string} sleepId - Sleep ID
 * @returns {object|null} Sleep data or null
 */
function getWhoopSleep(sleepId) {
  const result = fetchWhoopApi('/activity/sleep/' + sleepId);
  if (!result.success) {
    Logger.log('Failed to get Whoop sleep: ' + result.error);
    return null;
  }
  return result.data;
}

/**
 * Get current sleep data from Whoop
 * Uses the sleep ID from current recovery
 * @returns {object} { available, sleepHours, sleepScore, stages, ... }
 */
function getWhoopCurrentSleep() {
  const recovery = getWhoopCurrentRecovery();
  if (!recovery.available || !recovery.sleepId) {
    return { available: false, reason: 'No sleep ID available' };
  }

  const sleep = getWhoopSleep(recovery.sleepId);
  if (!sleep) {
    return { available: false, reason: 'Failed to fetch sleep data' };
  }

  const score = sleep.score || {};
  const stages = score.stage_summary || {};

  // Convert milliseconds to hours
  const msToHours = (ms) => ms ? (ms / 3600000) : 0;

  return {
    available: true,
    source: 'whoop_api',
    sleepId: sleep.id,
    // Duration
    totalSleepHours: msToHours(stages.total_in_bed_time_milli),
    actualSleepHours: msToHours(stages.total_sleep_time_milli),
    // Stages (in hours)
    remHours: msToHours(stages.total_rem_sleep_time_milli),
    deepHours: msToHours(stages.total_slow_wave_sleep_time_milli),
    lightHours: msToHours(stages.total_light_sleep_time_milli),
    awakeHours: msToHours(stages.total_awake_time_milli),
    // Scores
    sleepPerformance: score.sleep_performance_percentage,
    sleepConsistency: score.sleep_consistency_percentage,
    sleepEfficiency: score.sleep_efficiency_percentage,
    // Timing
    startTime: sleep.start,
    endTime: sleep.end,
    createdAt: sleep.created_at
  };
}

// =========================================================
// COMBINED WELLNESS DATA
// =========================================================

/**
 * Fetch fresh wellness data from Whoop API
 * Returns data in format compatible with existing wellness.gs
 * @returns {object} Wellness data formatted for IntervalCoach
 */
function fetchWhoopWellnessData() {
  if (!isWhoopConfigured()) {
    return { available: false, reason: 'Whoop not configured' };
  }

  const recovery = getWhoopCurrentRecovery();
  const sleep = getWhoopCurrentSleep();

  if (!recovery.available) {
    return {
      available: false,
      reason: recovery.reason || 'No Whoop recovery data'
    };
  }

  // Format to match existing wellness record structure
  return {
    available: true,
    source: 'whoop_api',
    date: formatDateISO(new Date()),
    // Recovery metrics
    recovery: recovery.recovery,
    hrv: recovery.hrv,
    restingHR: recovery.restingHR,
    spO2: recovery.spo2,
    skinTemp: recovery.skinTemp,
    // Sleep metrics
    sleep: sleep.available ? sleep.actualSleepHours : null,
    sleepScore: sleep.available ? sleep.sleepPerformance : null,
    remSleep: sleep.available ? sleep.remHours : null,
    deepSleep: sleep.available ? sleep.deepHours : null,
    sleepEfficiency: sleep.available ? sleep.sleepEfficiency : null,
    // Metadata
    cycleId: recovery.cycleId,
    sleepId: recovery.sleepId,
    updatedAt: recovery.updatedAt
  };
}

// =========================================================
// TEST FUNCTION
// =========================================================

/**
 * Test Whoop API integration
 */
function testWhoopApi() {
  Logger.log('=== WHOOP API TEST ===\n');

  // Check configuration
  const config = getWhoopConfig();
  if (!config) {
    Logger.log('❌ Whoop not configured');
    Logger.log('Add WHOOP_CONFIG to config.gs:');
    Logger.log('const WHOOP_CONFIG = {');
    Logger.log('  CLIENT_ID: "your-client-id",');
    Logger.log('  CLIENT_SECRET: "your-client-secret",');
    Logger.log('  REDIRECT_URI: "https://your-redirect-uri"');
    Logger.log('};');
    return;
  }
  Logger.log('✓ Whoop configured');
  Logger.log('  Client ID: ' + config.CLIENT_ID.substring(0, 8) + '...');

  // Check authorization
  if (!isWhoopConfigured()) {
    Logger.log('❌ Whoop not authorized');
    Logger.log('Run authorizeWhoop() to complete OAuth flow');
    return;
  }
  Logger.log('✓ Whoop authorized');

  // Check token status
  const tokens = getWhoopTokens();
  Logger.log('  Token expires: ' + new Date(tokens.expiresAt).toISOString());
  Logger.log('  Token expired: ' + isWhoopTokenExpired());

  // Test recovery data
  Logger.log('\n--- Recovery Data ---');
  const recovery = getWhoopCurrentRecovery();
  if (recovery.available) {
    Logger.log('✓ Recovery: ' + recovery.recovery + '%');
    Logger.log('  HRV: ' + recovery.hrv + ' ms');
    Logger.log('  RHR: ' + recovery.restingHR + ' bpm');
    Logger.log('  SpO2: ' + (recovery.spo2 || 'N/A') + '%');
    Logger.log('  Skin Temp: ' + (recovery.skinTemp || 'N/A') + '°C');
    Logger.log('  Updated: ' + recovery.updatedAt);
  } else {
    Logger.log('❌ Recovery not available: ' + recovery.reason);
  }

  // Test sleep data
  Logger.log('\n--- Sleep Data ---');
  const sleep = getWhoopCurrentSleep();
  if (sleep.available) {
    Logger.log('✓ Sleep Duration: ' + sleep.actualSleepHours.toFixed(1) + 'h');
    Logger.log('  REM: ' + sleep.remHours.toFixed(1) + 'h');
    Logger.log('  Deep: ' + sleep.deepHours.toFixed(1) + 'h');
    Logger.log('  Light: ' + sleep.lightHours.toFixed(1) + 'h');
    Logger.log('  Performance: ' + (sleep.sleepPerformance || 'N/A') + '%');
    Logger.log('  Efficiency: ' + (sleep.sleepEfficiency || 'N/A') + '%');
  } else {
    Logger.log('❌ Sleep not available: ' + sleep.reason);
  }

  // Test combined wellness
  Logger.log('\n--- Combined Wellness ---');
  const wellness = fetchWhoopWellnessData();
  if (wellness.available) {
    Logger.log('✓ Wellness data ready');
    Logger.log('  Recovery: ' + wellness.recovery + '%');
    Logger.log('  HRV: ' + wellness.hrv + ' ms');
    Logger.log('  Sleep: ' + (wellness.sleep ? wellness.sleep.toFixed(1) + 'h' : 'N/A'));
    Logger.log('  Source: ' + wellness.source);
  } else {
    Logger.log('❌ Wellness not available: ' + wellness.reason);
  }

  Logger.log('\n=== TEST COMPLETE ===');
}
