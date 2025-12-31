/**
 * IntervalCoach - Event Utilities
 *
 * Intervals.icu event management and checking.
 */

// =========================================================
// INTERVALS.ICU EVENT UTILITIES
// =========================================================

/**
 * Delete an event from Intervals.icu calendar
 * @param {object} event - Event object with id property
 * @returns {boolean} True if deleted successfully
 */
function deleteIntervalEvent(event) {
  if (!event?.id) {
    Logger.log("No event ID provided for deletion");
    return false;
  }

  const athleteId = "0"; // 0 = current athlete
  const url = "https://intervals.icu/api/v1/athlete/" + athleteId + "/events/" + event.id;

  const options = {
    method: "delete",
    headers: { "Authorization": getIcuAuthHeader() },
    muteHttpExceptions: true
  };

  try {
    const response = UrlFetchApp.fetch(url, options);
    const code = response.getResponseCode();
    if (code === 200 || code === 204) {
      Logger.log(" -> Deleted placeholder event from Intervals.icu");
      return true;
    } else {
      Logger.log(" -> Failed to delete event: " + response.getContentText());
      return false;
    }
  } catch (e) {
    Logger.log(" -> Error deleting event: " + e.toString());
    return false;
  }
}

// =========================================================
// EVENT CHECKING UTILITIES
// =========================================================

// In-memory cache for events (cleared each script execution)
const _eventCache = {};

/**
 * Fetch all events for a specific date (with caching)
 * @param {string} dateStr - Date in yyyy-MM-dd format
 * @returns {object} { success, events: [...], raceEvent, workoutEvents, placeholders }
 */
function fetchEventsForDate(dateStr) {
  // Return cached result if available
  if (_eventCache[dateStr]) {
    return _eventCache[dateStr];
  }

  const endpoint = "/athlete/0/events?oldest=" + dateStr + "&newest=" + dateStr;
  const result = fetchIcuApi(endpoint);

  const response = {
    success: result.success,
    events: [],
    raceEvent: null,      // First A/B/C event found
    workoutEvents: [],    // WORKOUT category events
    placeholders: [],     // Simple placeholders (Ride/Run)
    notes: []             // NOTE category events (athlete feedback)
  };

  if (!result.success || !Array.isArray(result.data)) {
    _eventCache[dateStr] = response;
    return response;
  }

  response.events = result.data;

  // Categorize events
  const ridePlaceholder = (USER_SETTINGS.PLACEHOLDER_RIDE || 'ride').toLowerCase();
  const runPlaceholder = (USER_SETTINGS.PLACEHOLDER_RUN || 'run').toLowerCase();

  for (const e of result.data) {
    // Check for race events (A/B/C priority)
    if (!response.raceEvent && (e.category === "RACE_A" || e.category === "RACE_B" || e.category === "RACE_C")) {
      response.raceEvent = {
        category: e.category.replace("RACE_", ""),
        name: e.name || null,
        description: e.description || null,
        type: e.type || null,
        id: e.id || null
      };
    }

    // Check for workout events
    if (e.category === "WORKOUT") {
      response.workoutEvents.push({
        name: e.name || null,
        description: e.description || null,
        type: e.type || null,
        id: e.id || null,
        filename: e.filename || null,
        moving_time: e.moving_time || null
      });
    }

    // Check for note events (athlete feedback)
    if (e.category === "NOTE") {
      response.notes.push({
        name: e.name || null,
        description: e.description || null,
        id: e.id || null
      });
    }

    // Check for placeholders (Ride/Run without specific workout)
    if (e.name) {
      const nameLower = e.name.toLowerCase();
      if (nameLower.startsWith(ridePlaceholder) || nameLower.startsWith(runPlaceholder) || nameLower.startsWith("hardlopen")) {
        response.placeholders.push({
          name: e.name,
          description: e.description || null,
          type: nameLower.startsWith(runPlaceholder) || nameLower.startsWith("hardlopen") ? "Run" : "Ride",
          id: e.id || null
        });
      }
    }
  }

  // Cache and return
  _eventCache[dateStr] = response;
  return response;
}

/**
 * Check if there's a race event on a specific date offset from today
 * Uses cached event data to avoid duplicate API calls
 * @param {number} daysOffset - Days from today (0 = today, 1 = tomorrow, -1 = yesterday)
 * @returns {object} Object with hasEvent boolean, category (A, B, C, or null), eventName, eventDescription
 */
function hasEventOnDate(daysOffset) {
  const dateStr = getDateOffset(daysOffset);
  const eventData = fetchEventsForDate(dateStr);

  if (!eventData.success || !eventData.raceEvent) {
    return { hasEvent: false, category: null, eventName: null, eventDescription: null };
  }

  return {
    hasEvent: true,
    category: eventData.raceEvent.category,
    eventName: eventData.raceEvent.name,
    eventDescription: eventData.raceEvent.description
  };
}

/**
 * Clear the event cache (useful for testing or long-running scripts)
 */
function clearEventCache() {
  for (const key in _eventCache) {
    delete _eventCache[key];
  }
}

/**
 * Check if there's a race event tomorrow
 * @returns {object} { hasEvent, category, eventName, eventDescription }
 */
function hasEventTomorrow() {
  return hasEventOnDate(1);
}

/**
 * Check if there was a race event yesterday
 * @returns {object} { hadEvent, category, eventName, eventDescription }
 */
function hasEventYesterday() {
  const result = hasEventOnDate(-1);
  return {
    hadEvent: result.hasEvent,
    category: result.category,
    eventName: result.eventName,
    eventDescription: result.eventDescription
  };
}

/**
 * Check if there's a race event in N days
 * @param {number} days - Number of days from today
 * @returns {object} { hasEvent, category, eventName, eventDescription }
 */
function hasEventInDays(days) {
  return hasEventOnDate(days);
}

// =========================================================
// HOLIDAY DETECTION
// =========================================================

/**
 * Fetch upcoming holidays from Intervals.icu calendar
 * @param {number} weeksAhead - How many weeks to look ahead (default 12)
 * @returns {object} { available, holidays: [...], nextHoliday }
 */
function fetchUpcomingHolidays(weeksAhead) {
  weeksAhead = weeksAhead || 12;

  const today = new Date();
  const future = new Date(today);
  future.setDate(future.getDate() + (weeksAhead * 7));

  const oldest = formatDateISO(today);
  const newest = formatDateISO(future);

  const result = fetchIcuApi(`/athlete/0/events?oldest=${oldest}&newest=${newest}`);

  if (!result.success || !Array.isArray(result.data)) {
    return { available: false, holidays: [], nextHoliday: null };
  }

  // Filter for HOLIDAY category events
  const holidays = result.data
    .filter(e => e.category === 'HOLIDAY')
    .map(e => {
      const startDate = e.start_date_local?.substring(0, 10);
      const endDate = e.end_date_local?.substring(0, 10);

      // Calculate days until holiday starts
      const start = new Date(startDate);
      const daysUntil = Math.floor((start - today) / (1000 * 60 * 60 * 24));

      // Calculate duration in days
      const end = endDate ? new Date(endDate) : start;
      const durationDays = Math.floor((end - start) / (1000 * 60 * 60 * 24)) + 1;

      // Calculate which week the holiday falls in (1 = this week, 2 = next week, etc.)
      const weekNumber = Math.floor(daysUntil / 7) + 1;

      return {
        id: e.id,
        name: e.name || 'Holiday',
        startDate: startDate,
        endDate: endDate,
        daysUntil: daysUntil,
        durationDays: durationDays,
        weekNumber: weekNumber,
        // Check if any races fall during this holiday
        hasConflictingRace: false // Will be set below
      };
    })
    .sort((a, b) => a.daysUntil - b.daysUntil);

  // Check for conflicting races during each holiday
  for (const holiday of holidays) {
    const racesInPeriod = result.data.filter(e => {
      if (!e.category?.startsWith('RACE_')) return false;
      const raceDate = e.start_date_local?.substring(0, 10);
      return raceDate >= holiday.startDate && raceDate <= holiday.endDate;
    });

    if (racesInPeriod.length > 0) {
      holiday.hasConflictingRace = true;
      holiday.conflictingRaces = racesInPeriod.map(r => ({
        category: r.category.replace('RACE_', ''),
        name: r.name,
        date: r.start_date_local?.substring(0, 10)
      }));
    }
  }

  return {
    available: holidays.length > 0,
    holidays: holidays,
    nextHoliday: holidays.length > 0 ? holidays[0] : null
  };
}

/**
 * Check if a specific week contains a holiday
 * @param {string} weekStartDate - Start date of the week (yyyy-MM-dd)
 * @param {object} holidayData - Output from fetchUpcomingHolidays()
 * @returns {object|null} Holiday info if week contains holiday, null otherwise
 */
function getHolidayForWeek(weekStartDate, holidayData) {
  if (!holidayData?.available || !holidayData.holidays) return null;

  const weekStart = new Date(weekStartDate);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);

  const weekStartStr = formatDateISO(weekStart);
  const weekEndStr = formatDateISO(weekEnd);

  for (const holiday of holidayData.holidays) {
    // Check if holiday overlaps with this week
    const holidayStart = holiday.startDate;
    const holidayEnd = holiday.endDate || holiday.startDate;

    // Overlap check: holiday starts before week ends AND holiday ends after week starts
    if (holidayStart <= weekEndStr && holidayEnd >= weekStartStr) {
      return holiday;
    }
  }

  return null;
}

// =========================================================
// SICK/INJURED DETECTION
// =========================================================

/**
 * Check if athlete is currently sick or injured
 * Looks for SICK or INJURED events that overlap with today
 * @returns {object} { isSick, isInjured, status, event }
 */
function checkSickOrInjured() {
  const today = formatDateISO(new Date());

  // Fetch events for a range (sick/injured events can span multiple days)
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);
  const weekAhead = new Date();
  weekAhead.setDate(weekAhead.getDate() + 7);

  const result = fetchIcuApi(`/athlete/0/events?oldest=${formatDateISO(weekAgo)}&newest=${formatDateISO(weekAhead)}`);

  if (!result.success || !Array.isArray(result.data)) {
    return { isSick: false, isInjured: false, status: 'healthy', event: null };
  }

  // Find SICK or INJURED events that overlap with today
  for (const e of result.data) {
    if (e.category !== 'SICK' && e.category !== 'INJURED') continue;

    const startDate = e.start_date_local?.substring(0, 10);
    const endDate = e.end_date_local?.substring(0, 10) || startDate;

    // Check if today falls within the event period
    if (today >= startDate && today <= endDate) {
      const daysRemaining = Math.ceil((new Date(endDate) - new Date(today)) / (1000 * 60 * 60 * 24));
      const daysSinceStart = Math.ceil((new Date(today) - new Date(startDate)) / (1000 * 60 * 60 * 24));

      return {
        isSick: e.category === 'SICK',
        isInjured: e.category === 'INJURED',
        status: e.category.toLowerCase(),
        event: {
          id: e.id,
          name: e.name || e.category,
          description: e.description || null,
          startDate: startDate,
          endDate: endDate,
          daysRemaining: daysRemaining,
          daysSinceStart: daysSinceStart
        }
      };
    }
  }

  return { isSick: false, isInjured: false, status: 'healthy', event: null };
}

/**
 * Check if athlete was recently sick or injured (for return-to-training context)
 * @param {number} daysBack - How many days to look back (default 14)
 * @returns {object} { wasRecent, events: [...], mostRecent }
 */
function checkRecentSickOrInjured(daysBack) {
  daysBack = daysBack || 14;

  const today = new Date();
  const pastDate = new Date(today);
  pastDate.setDate(pastDate.getDate() - daysBack);

  const result = fetchIcuApi(`/athlete/0/events?oldest=${formatDateISO(pastDate)}&newest=${formatDateISO(today)}`);

  if (!result.success || !Array.isArray(result.data)) {
    return { wasRecent: false, events: [], mostRecent: null };
  }

  const events = result.data
    .filter(e => e.category === 'SICK' || e.category === 'INJURED')
    .map(e => {
      const startDate = e.start_date_local?.substring(0, 10);
      const endDate = e.end_date_local?.substring(0, 10) || startDate;
      const endDateObj = new Date(endDate);
      const daysSinceEnd = Math.ceil((today - endDateObj) / (1000 * 60 * 60 * 24));
      const durationDays = Math.ceil((endDateObj - new Date(startDate)) / (1000 * 60 * 60 * 24)) + 1;

      return {
        type: e.category.toLowerCase(),
        name: e.name || e.category,
        description: e.description || null,
        startDate: startDate,
        endDate: endDate,
        durationDays: durationDays,
        daysSinceEnd: daysSinceEnd,
        // Recovery multiplier: longer illness = longer recovery needed
        recoveryMultiplier: durationDays <= 2 ? 1.0 : durationDays <= 5 ? 1.5 : 2.0
      };
    })
    .filter(e => e.daysSinceEnd > 0) // Only past events, not current
    .sort((a, b) => a.daysSinceEnd - b.daysSinceEnd);

  return {
    wasRecent: events.length > 0,
    events: events,
    mostRecent: events.length > 0 ? events[0] : null
  };
}

/**
 * Get return-to-training recommendations based on sick/injured status
 * @param {object} sickStatus - Output from checkSickOrInjured() or checkRecentSickOrInjured()
 * @returns {object} { shouldTrain, recommendation, tssMultiplier, maxIntensity }
 */
function getReturnToTrainingAdvice(sickStatus) {
  // Currently sick/injured - no training
  if (sickStatus.isSick || sickStatus.isInjured) {
    return {
      shouldTrain: false,
      recommendation: sickStatus.isSick
        ? 'Rest and recover. No training while sick.'
        : 'Recovery period. Follow medical advice for injury.',
      tssMultiplier: 0,
      maxIntensity: 'none',
      daysUntilNormal: sickStatus.event?.daysRemaining || 0
    };
  }

  // Recently sick/injured - gradual return
  if (sickStatus.wasRecent && sickStatus.mostRecent) {
    const recent = sickStatus.mostRecent;
    const daysSince = recent.daysSinceEnd;
    const severity = recent.durationDays;

    // Return-to-training protocol based on illness duration and days since recovery
    if (daysSince <= 2) {
      return {
        shouldTrain: true,
        recommendation: `Day ${daysSince} post-${recent.type}. Easy zone 1-2 only, max 30-45 min.`,
        tssMultiplier: 0.3,
        maxIntensity: 'Z2',
        phase: 'initial'
      };
    } else if (daysSince <= 5) {
      return {
        shouldTrain: true,
        recommendation: `Day ${daysSince} post-${recent.type}. Endurance only, monitor how you feel.`,
        tssMultiplier: 0.5,
        maxIntensity: 'Z3',
        phase: 'building'
      };
    } else if (daysSince <= 7 && severity > 3) {
      return {
        shouldTrain: true,
        recommendation: `Day ${daysSince} post-${recent.type} (${severity} days). Moderate intensity OK if feeling good.`,
        tssMultiplier: 0.7,
        maxIntensity: 'Z4',
        phase: 'moderate'
      };
    }
    // Beyond 7 days or short illness - back to normal
  }

  // Healthy - normal training
  return {
    shouldTrain: true,
    recommendation: null,
    tssMultiplier: 1.0,
    maxIntensity: 'any',
    phase: 'normal'
  };
}
