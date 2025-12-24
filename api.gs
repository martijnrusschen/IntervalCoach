/**
 * IntervalCoach - API Utilities
 *
 * Centralized API handling for Intervals.icu and Gemini AI.
 */

// =========================================================
// CONFIGURATION VALIDATION
// =========================================================

/**
 * Validate that all required configuration is present
 */
function validateConfig() {
  const errors = [];

  if (!API_KEYS || typeof API_KEYS !== 'object') {
    errors.push("API_KEYS object is missing - check config.gs exists");
  } else {
    if (!API_KEYS.ICU_TOKEN || API_KEYS.ICU_TOKEN === "your-intervals-icu-api-key-here") {
      errors.push("API_KEYS.ICU_TOKEN is missing or not configured");
    }
    if (!API_KEYS.GEMINI_API_KEY || API_KEYS.GEMINI_API_KEY === "your-gemini-api-key-here") {
      errors.push("API_KEYS.GEMINI_API_KEY is missing or not configured");
    }
  }

  if (!AI_SETTINGS || typeof AI_SETTINGS !== 'object') {
    errors.push("AI_SETTINGS object is missing - check config.gs exists");
  } else {
    if (!AI_SETTINGS.GEMINI_MODEL) {
      errors.push("AI_SETTINGS.GEMINI_MODEL is missing");
    }
  }

  if (!USER_SETTINGS || typeof USER_SETTINGS !== 'object') {
    errors.push("USER_SETTINGS object is missing - check config.gs exists");
  } else {
    if (!USER_SETTINGS.EMAIL_TO || !USER_SETTINGS.EMAIL_TO.includes("@")) {
      errors.push("USER_SETTINGS.EMAIL_TO is missing or invalid");
    }
    const validLanguages = ["en", "nl", "ja", "es", "fr"];
    if (!USER_SETTINGS.LANGUAGE || !validLanguages.includes(USER_SETTINGS.LANGUAGE)) {
      errors.push("USER_SETTINGS.LANGUAGE must be one of: " + validLanguages.join(", "));
    }
    if (!USER_SETTINGS.PLACEHOLDER_RIDE) {
      errors.push("USER_SETTINGS.PLACEHOLDER_RIDE is missing");
    }
    if (!USER_SETTINGS.PLACEHOLDER_RUN) {
      errors.push("USER_SETTINGS.PLACEHOLDER_RUN is missing");
    }
    if (!USER_SETTINGS.WORKOUT_FOLDER) {
      errors.push("USER_SETTINGS.WORKOUT_FOLDER is missing");
    }
  }

  return { valid: errors.length === 0, errors: errors };
}

/**
 * Validate config and throw error if invalid
 */
function requireValidConfig() {
  const result = validateConfig();
  if (!result.valid) {
    const errorMsg = "Configuration errors:\n- " + result.errors.join("\n- ");
    Logger.log("ERROR: " + errorMsg);
    throw new Error(errorMsg);
  }
}

// =========================================================
// HTTP UTILITIES
// =========================================================

/**
 * Simple delay function for rate limiting
 */
function delay(ms) {
  Utilities.sleep(ms);
}

/**
 * Fetch URL with retry logic and rate limiting
 */
function fetchWithRetry(url, options, config) {
  const maxRetries = config?.maxRetries || SYSTEM_SETTINGS.MAX_RETRIES;
  const retryDelay = config?.retryDelay || SYSTEM_SETTINGS.RETRY_DELAY_MS;
  const apiDelay = config?.apiDelay || SYSTEM_SETTINGS.API_DELAY_MS;

  options = options || {};
  options.muteHttpExceptions = true;

  if (apiDelay > 0) {
    delay(apiDelay);
  }

  let lastError = null;
  let lastCode = 0;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = UrlFetchApp.fetch(url, options);
      const code = response.getResponseCode();
      lastCode = code;

      if (code >= 200 && code < 300) {
        return { success: true, response: response, error: null, code: code };
      }

      if (code >= 400 && code < 500 && code !== 429) {
        return { success: false, response: response, error: `HTTP ${code}: ${response.getContentText().substring(0, 200)}`, code: code };
      }

      lastError = `HTTP ${code}`;
      if (attempt < maxRetries) {
        const backoff = retryDelay * Math.pow(2, attempt - 1);
        Logger.log(`API call failed (attempt ${attempt}/${maxRetries}): ${lastError}. Retrying in ${backoff}ms...`);
        delay(backoff);
      }
    } catch (e) {
      lastError = e.toString();
      if (attempt < maxRetries) {
        const backoff = retryDelay * Math.pow(2, attempt - 1);
        Logger.log(`API call error (attempt ${attempt}/${maxRetries}): ${lastError}. Retrying in ${backoff}ms...`);
        delay(backoff);
      }
    }
  }

  Logger.log(`API call failed after ${maxRetries} attempts: ${lastError}`);
  return { success: false, response: null, error: lastError, code: lastCode };
}

// =========================================================
// INTERVALS.ICU API
// =========================================================

/**
 * Fetch from Intervals.icu API with automatic auth and retry handling
 */
function fetchIcuApi(endpoint, additionalOptions) {
  const url = "https://intervals.icu/api/v1" + endpoint;
  const options = Object.assign({}, additionalOptions || {}, {
    headers: Object.assign({}, additionalOptions?.headers || {}, {
      "Authorization": getIcuAuthHeader()
    })
  });

  const result = fetchWithRetry(url, options);

  if (result.success && result.response) {
    try {
      const data = JSON.parse(result.response.getContentText());
      return { success: true, data: data, error: null };
    } catch (e) {
      return { success: false, data: null, error: "JSON parse error: " + e.toString() };
    }
  }

  return { success: false, data: null, error: result.error };
}

// =========================================================
// GEMINI AI API
// =========================================================

/**
 * Call Gemini API for JSON response (workout generation)
 */
function callGeminiAPI(prompt) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${AI_SETTINGS.GEMINI_MODEL}:generateContent?key=${API_KEYS.GEMINI_API_KEY}`;

  const payload = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: SYSTEM_SETTINGS.GENERATION_CONFIG
  };

  const options = {
    method: "post",
    headers: { "Content-Type": "application/json" },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };

  for (let attempt = 1; attempt <= SYSTEM_SETTINGS.MAX_RETRIES; attempt++) {
    try {
      const response = UrlFetchApp.fetch(url, options);
      const code = response.getResponseCode();

      if (code === 200) {
        const jsonResponse = JSON.parse(response.getContentText());
        const contentText = jsonResponse.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!contentText) throw new Error("API returned empty content");

        let result;
        try {
          const cleanedText = contentText.replace(/^```json/gm, "").replace(/^```/gm, "").trim();
          result = JSON.parse(cleanedText);
        } catch (e) {
          throw new Error("JSON Parse Error: " + e.message);
        }

        if (!result.explanation) throw new Error("Incomplete JSON: missing explanation");

        const isRunWorkout = result.workoutDescription && !result.xml;

        if (isRunWorkout) {
          return {
            success: true,
            workoutDescription: result.workoutDescription,
            explanation: result.explanation,
            recommendationScore: result.recommendation_score || 5,
            recommendationReason: result.recommendation_reason || ""
          };
        } else {
          if (!result.xml) throw new Error("Incomplete JSON: missing xml");

          let xml = result.xml.replace(/^```xml\s*/i, "").replace(/^```\s*/i, "").replace(/```$/i, "").trim();

          const zwoValidation = validateZwoXml(xml);
          if (!zwoValidation.valid) {
            throw new Error("Invalid ZWO: " + zwoValidation.errors.join(", "));
          }

          return {
            success: true,
            xml: xml,
            explanation: result.explanation,
            recommendationScore: result.recommendation_score || 5,
            recommendationReason: result.recommendation_reason || ""
          };
        }
      }

      if (code === 503 || code === 429) {
        Logger.log(` -> Retry (${attempt}): Server busy.`);
        Utilities.sleep(SYSTEM_SETTINGS.RETRY_DELAY_MS);
        continue;
      }
      return { success: false, error: `API Error Code: ${code}` };

    } catch (e) {
      Logger.log(` -> Retry (${attempt}): ${e.toString()}`);
      if (attempt < SYSTEM_SETTINGS.MAX_RETRIES) Utilities.sleep(SYSTEM_SETTINGS.RETRY_DELAY_MS);
      else return { success: false, error: e.toString() };
    }
  }
  return { success: false, error: "Max retries exceeded" };
}

/**
 * Call Gemini API for text response (not JSON)
 */
function callGeminiAPIText(prompt) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${AI_SETTINGS.GEMINI_MODEL}:generateContent?key=${API_KEYS.GEMINI_API_KEY}`;

  const payload = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: 2048
    }
  };

  try {
    const response = UrlFetchApp.fetch(url, {
      method: "post",
      contentType: "application/json",
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    });

    const responseCode = response.getResponseCode();
    const responseText = response.getContentText();

    if (responseCode === 200) {
      const data = JSON.parse(responseText);
      if (data.candidates?.[0]?.content?.parts?.[0]) {
        return data.candidates[0].content.parts[0].text;
      } else {
        Logger.log("Gemini API: Unexpected response structure");
      }
    } else {
      Logger.log("Gemini API error " + responseCode + ": " + responseText.substring(0, 500));
    }
  } catch (e) {
    Logger.log("Error calling Gemini API for text: " + e.toString());
  }

  return null;
}

// =========================================================
// WORKOUT GENERATION WITH FEEDBACK LOOP
// =========================================================

/**
 * Generate workout with feedback loop - regenerate if score < threshold
 * @param {string} prompt - Initial prompt
 * @param {object} context - Context for regeneration (workoutType, recoveryStatus, tsb, phase, duration)
 * @param {number} maxAttempts - Maximum generation attempts (default 2)
 * @param {number} minScore - Minimum acceptable score (default 6)
 * @returns {object} Best workout result
 */
function generateWorkoutWithFeedback(prompt, context, maxAttempts, minScore) {
  maxAttempts = maxAttempts || 2;
  minScore = minScore || 6;

  let bestResult = null;
  let bestScore = 0;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const currentPrompt = attempt === 1 ? prompt : buildRegenerationPrompt(prompt, bestResult, context);
    const result = callGeminiAPI(currentPrompt);

    if (!result.success) {
      Logger.log(`Generation attempt ${attempt} failed: ${result.error}`);
      if (bestResult) return bestResult; // Return previous best if current fails
      continue;
    }

    const score = result.recommendationScore || 5;
    Logger.log(`Generation attempt ${attempt}: Score ${score}/10`);

    // Track best result
    if (score > bestScore) {
      bestResult = result;
      bestScore = score;
    }

    // Accept if meets threshold
    if (score >= minScore) {
      Logger.log(`Accepted workout with score ${score} (meets threshold ${minScore})`);
      return result;
    }

    // If not last attempt, will regenerate
    if (attempt < maxAttempts) {
      Logger.log(`Score ${score} below threshold ${minScore}, regenerating...`);
    }
  }

  // Return best we got (with warning)
  if (bestResult) {
    Logger.log(`Using best available workout (score: ${bestScore}) after ${maxAttempts} attempts`);
    return bestResult;
  }

  return { success: false, error: "All generation attempts failed" };
}

/**
 * Build regeneration prompt with feedback about why previous was low-scored
 * @param {string} originalPrompt - Original workout prompt
 * @param {object} previousResult - Previous generation result
 * @param {object} context - Context for regeneration
 * @returns {string} Enhanced prompt for regeneration
 */
function buildRegenerationPrompt(originalPrompt, previousResult, context) {
  const feedback = `

--- REGENERATION REQUEST ---
The previous workout attempt scored ${previousResult.recommendationScore}/10.
Reason given: ${previousResult.recommendationReason || 'Not specified'}

ISSUE: The workout type "${context.workoutType}" may not be optimal for current conditions.
Consider alternative intensities or structures that better match:
- Recovery status: ${context.recoveryStatus || 'Unknown'}
- TSB: ${context.tsb || 'Unknown'}
- Phase: ${context.phase || 'Unknown'}

Generate an IMPROVED workout that addresses these concerns.
If the original workout type truly isn't suitable for today, you may suggest a more appropriate alternative within the same general category (e.g., if Threshold scores low, consider Tempo or Sweet Spot instead).

IMPORTANT: Your new recommendation_score should reflect the improved suitability of this workout.
`;

  return originalPrompt + feedback;
}

// =========================================================
// ZWO VALIDATION
// =========================================================

/**
 * Validate ZWO XML structure before upload
 */
function validateZwoXml(xml) {
  const errors = [];
  const warnings = [];

  if (!xml || typeof xml !== 'string') {
    return { valid: false, errors: ["XML content is empty or not a string"], warnings: [] };
  }

  if (!xml.includes("<workout_file>")) errors.push("Missing root <workout_file> tag");
  if (!xml.includes("</workout_file>")) errors.push("Missing closing </workout_file> tag");
  if (!xml.includes("<workout>") || !xml.includes("</workout>")) errors.push("Missing <workout> section");

  if (!xml.includes("<author>")) warnings.push("Missing <author> tag");
  if (!xml.includes("<name>")) warnings.push("Missing <name> tag");

  const segmentPatterns = ["<SteadyState", "<IntervalsT", "<Warmup", "<Cooldown", "<FreeRide", "<Ramp"];
  const hasSegment = segmentPatterns.some(pattern => xml.includes(pattern));
  if (!hasSegment) {
    errors.push("No workout segments found");
  }

  const tagBalance = {
    workout_file: (xml.match(/<workout_file>/g) || []).length - (xml.match(/<\/workout_file>/g) || []).length,
    workout: (xml.match(/<workout>/g) || []).length - (xml.match(/<\/workout>/g) || []).length
  };

  if (tagBalance.workout_file !== 0) errors.push("Unbalanced <workout_file> tags");
  if (tagBalance.workout !== 0) errors.push("Unbalanced <workout> tags");

  return { valid: errors.length === 0, errors: errors, warnings: warnings };
}
