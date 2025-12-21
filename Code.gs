/**
 * IntervalCoach - AI Cycling Coach (Powered by Gemini & Intervals.icu)
 * 
 * This script automates daily workout generation based on your fitness data.
 * Features:
 * - Fetches activities from Intervals.icu.
 * - Analyzes fitness (CTL, TSB) and training phases (Base, Build, Peak).
 * - Generates .zwo workout files using Google Gemini (AI).
 * - Saves workouts to Google Drive (auto-sync to Zwift via Drive for Desktop).
 * - Sends a daily summary email with the recommended workout.
 * 
 * Author: [Your Name/GitHub Username]
 * License: MIT
 */

// =========================================================
// CONFIGURATION
// =========================================================
// API_KEYS and USER_SETTINGS are defined in config.gs
// Copy config.sample.gs to config.gs and add your credentials
// See README.md for setup instructions

// =========================================================
// SYSTEM SETTINGS (Advanced)
// =========================================================
// AI_SETTINGS.GEMINI_MODEL is defined in config.gs
const SYSTEM_SETTINGS = {
  TIMEZONE: Session.getScriptTimeZone(),
  MAX_RETRIES: 3,
  RETRY_DELAY_MS: 5000,

  GENERATION_CONFIG: {
    temperature: 0.3, // Slight creativity for workout variety
    maxOutputTokens: 8192,
    responseMimeType: "application/json"
  }
};

// =========================================================
// 4. LOCALIZATION (Email Content)
// =========================================================
const TRANSLATIONS = {
  en: {
    subject_prefix: "[IntervalCoach] Today's Pick: ",
    greeting: "Here is your IntervalCoach training plan for today.",
    phase_title: "Current Phase",
    weeks_to_goal: "Weeks to Goal",
    weeks_unit: "", // English usually doesn't need unit here or " weeks"
    focus: "Focus",
    goal_section: "Current Goal",
    status: "Athlete Status",
    recovery_title: "Recovery & Wellness",
    recovery_status: "Recovery Status",
    sleep: "Sleep",
    hrv: "HRV",
    resting_hr: "Resting HR",
    recommendation_title: "★ BEST RECOMMENDATION ★",
    why_title: "【Why / Reason】",
    strategy_title: "【Strategy / Explanation】",
    other_options: "Other Options",
    footer: "*Saved to Google Drive (IntervalCoach_Workouts). Please wait for sync.",
    power_profile_title: "Power Profile",
    current_eftp: "Current eFTP",
    all_time: "All-time",
    peak_powers: "Peak Powers",
    strengths: "Strengths",
    focus_areas: "Focus Areas",
    workout_details: "Workout Details",
    // Weekly summary
    weekly_subject: "[IntervalCoach] Weekly Summary",
    weekly_greeting: "Here is your weekly training summary.",
    weekly_overview: "Week Overview",
    total_activities: "Total Activities",
    total_time: "Total Time",
    total_tss: "Total TSS",
    total_distance: "Total Distance",
    rides: "Rides",
    runs: "Runs",
    weekly_fitness: "Fitness Progress",
    weekly_comparison: "vs Previous Week",
    weekly_health: "Health & Recovery",
    avg_sleep: "Avg Sleep",
    avg_hrv: "Avg HRV",
    avg_rhr: "Avg Resting HR",
    avg_recovery: "Avg Recovery",
    ramp_rate: "Ramp Rate",
    weekly_footer: "Keep up the great work!",
    // Training Load Advisor
    training_load_title: "Training Load Advice",
    target_ctl: "Target CTL",
    weekly_tss_target: "Weekly TSS Target",
    daily_tss_range: "Daily TSS Range",
    load_advice: "Advice",
    // Monthly Progress Report
    monthly_subject: "[IntervalCoach] Monthly Progress Report",
    monthly_greeting: "Here is your monthly training progress report.",
    monthly_period: "Period",
    monthly_comparison: "Month-over-Month",
    monthly_total_tss: "Total TSS",
    monthly_total_hours: "Total Time",
    monthly_fitness_trend: "Fitness Trend",
    monthly_eftp_trend: "eFTP Progression",
    monthly_volume: "Training Volume",
    monthly_avg_weekly_tss: "Avg Weekly TSS",
    monthly_avg_weekly_hours: "Avg Weekly Hours",
    monthly_total_activities: "Total Activities",
    monthly_consistency: "Consistency",
    monthly_weeks_trained: "Weeks Trained",
    monthly_footer: "Keep building towards your goals!"
  },
  ja: {
    subject_prefix: "[IntervalCoach] 本日の推奨: ",
    greeting: "お疲れ様です。IntervalCoachが分析した本日の推奨メニューです。",
    phase_title: "現在のフェーズ",
    weeks_to_goal: "目標まで",
    weeks_unit: "週", // Added unit for Japanese
    focus: "注力ポイント",
    goal_section: "【設定目標】",
    status: "コンディション",
    recovery_title: "リカバリー＆ウェルネス",
    recovery_status: "回復状態",
    sleep: "睡眠",
    hrv: "HRV",
    resting_hr: "安静時心拍",
    recommendation_title: "★ 本日の推奨メニュー ★",
    why_title: "【選定理由】",
    strategy_title: "【内容・攻略法】",
    other_options: "その他の選択肢",
    footer: "※Googleドライブ(IntervalCoach_Workouts)に保存されました。Zwiftへの同期をお待ちください。",
    // Weekly summary
    weekly_subject: "[IntervalCoach] 週間サマリー",
    weekly_greeting: "今週のトレーニングサマリーです。",
    weekly_overview: "週間概要",
    total_activities: "総アクティビティ数",
    total_time: "総時間",
    total_tss: "総TSS",
    total_distance: "総距離",
    rides: "ライド",
    runs: "ラン",
    weekly_fitness: "フィットネス推移",
    weekly_comparison: "前週比",
    weekly_health: "健康とリカバリー",
    avg_sleep: "平均睡眠",
    avg_hrv: "平均HRV",
    avg_rhr: "平均安静時心拍",
    avg_recovery: "平均リカバリー",
    ramp_rate: "ランプレート",
    weekly_footer: "今週もお疲れ様でした！",
    // Training Load Advisor
    training_load_title: "トレーニング負荷アドバイス",
    target_ctl: "目標CTL",
    weekly_tss_target: "週間TSS目標",
    daily_tss_range: "1日のTSS目安",
    load_advice: "アドバイス",
    // Monthly Progress Report
    monthly_subject: "[IntervalCoach] 月間進捗レポート",
    monthly_greeting: "月間トレーニング進捗レポートです。",
    monthly_period: "期間",
    monthly_comparison: "前月比",
    monthly_total_tss: "合計TSS",
    monthly_total_hours: "合計時間",
    monthly_fitness_trend: "フィットネス推移",
    monthly_eftp_trend: "eFTP推移",
    monthly_volume: "トレーニング量",
    monthly_avg_weekly_tss: "週平均TSS",
    monthly_avg_weekly_hours: "週平均時間",
    monthly_total_activities: "総アクティビティ数",
    monthly_consistency: "継続性",
    monthly_weeks_trained: "トレーニング週数",
    monthly_footer: "目標に向けて頑張りましょう！"
  },
  es: {
    subject_prefix: "[IntervalCoach] Selección de hoy: ",
    greeting: "Aquí tienes tu plan de entrenamiento de IntervalCoach para hoy.",
    phase_title: "Fase Actual",
    weeks_to_goal: "Semanas para el objetivo",
    weeks_unit: "",
    focus: "Enfoque",
    goal_section: "Objetivo Actual",
    status: "Estado del Atleta",
    recovery_title: "Recuperación y Bienestar",
    recovery_status: "Estado de Recuperación",
    sleep: "Sueño",
    hrv: "VFC",
    resting_hr: "FC en Reposo",
    recommendation_title: "★ MEJOR RECOMENDACIÓN ★",
    why_title: "【Razón】",
    strategy_title: "【Estrategia】",
    other_options: "Otras opciones",
    footer: "*Guardado en Google Drive. Espera la sincronización.",
    // Weekly summary
    weekly_subject: "[IntervalCoach] Resumen Semanal",
    weekly_greeting: "Aquí tienes tu resumen de entrenamiento semanal.",
    weekly_overview: "Resumen de la Semana",
    total_activities: "Actividades Totales",
    total_time: "Tiempo Total",
    total_tss: "TSS Total",
    total_distance: "Distancia Total",
    rides: "Ciclismo",
    runs: "Carrera",
    weekly_fitness: "Progreso de Forma",
    weekly_comparison: "vs Semana Anterior",
    weekly_health: "Salud y Recuperación",
    avg_sleep: "Sueño Promedio",
    avg_hrv: "VFC Promedio",
    avg_rhr: "FC Reposo Promedio",
    avg_recovery: "Recuperación Promedio",
    ramp_rate: "Tasa de Rampa",
    weekly_footer: "¡Sigue así!",
    // Training Load Advisor
    training_load_title: "Consejo de Carga",
    target_ctl: "CTL Objetivo",
    weekly_tss_target: "TSS Semanal Objetivo",
    daily_tss_range: "Rango TSS Diario",
    load_advice: "Consejo",
    // Monthly Progress Report
    monthly_subject: "[IntervalCoach] Informe Mensual",
    monthly_greeting: "Aquí está tu informe mensual de progreso.",
    monthly_period: "Período",
    monthly_comparison: "Mes a Mes",
    monthly_total_tss: "TSS Total",
    monthly_total_hours: "Tiempo Total",
    monthly_fitness_trend: "Tendencia Fitness",
    monthly_eftp_trend: "Progresión eFTP",
    monthly_volume: "Volumen de Entrenamiento",
    monthly_avg_weekly_tss: "TSS Semanal Promedio",
    monthly_avg_weekly_hours: "Horas Semanales Promedio",
    monthly_total_activities: "Total Actividades",
    monthly_consistency: "Consistencia",
    monthly_weeks_trained: "Semanas Entrenadas",
    monthly_footer: "¡Sigue construyendo hacia tus metas!"
  },
  fr: {
    subject_prefix: "[IntervalCoach] Choix du jour: ",
    greeting: "Voici votre plan d'entraînement IntervalCoach pour aujourd'hui.",
    phase_title: "Phase Actuelle",
    weeks_to_goal: "Semaines avant l'objectif",
    weeks_unit: "",
    focus: "Focus",
    goal_section: "Objectif Actuel",
    status: "Statut de l'athlète",
    recovery_title: "Récupération et Bien-être",
    recovery_status: "État de Récupération",
    sleep: "Sommeil",
    hrv: "VFC",
    resting_hr: "FC au Repos",
    recommendation_title: "★ MEILLEURE RECOMMANDATION ★",
    why_title: "【Raison】",
    strategy_title: "【Stratégie】",
    other_options: "Autres options",
    footer: "*Enregistré sur Google Drive. Veuillez attendre la synchronisation.",
    power_profile_title: "Profil de Puissance",
    current_eftp: "eFTP Actuel",
    all_time: "Record absolu",
    peak_powers: "Pics de Puissance",
    strengths: "Points Forts",
    focus_areas: "Axes d'amélioration",
    // Weekly summary
    weekly_subject: "[IntervalCoach] Résumé Hebdomadaire",
    weekly_greeting: "Voici votre résumé d'entraînement hebdomadaire.",
    weekly_overview: "Aperçu de la Semaine",
    total_activities: "Activités Totales",
    total_time: "Temps Total",
    total_tss: "TSS Total",
    total_distance: "Distance Totale",
    rides: "Vélo",
    runs: "Course",
    weekly_fitness: "Progression Forme",
    weekly_comparison: "vs Semaine Précédente",
    weekly_health: "Santé et Récupération",
    avg_sleep: "Sommeil Moyen",
    avg_hrv: "VFC Moyenne",
    avg_rhr: "FC Repos Moyenne",
    avg_recovery: "Récupération Moyenne",
    ramp_rate: "Taux de Rampe",
    weekly_footer: "Continuez comme ça!",
    // Training Load Advisor
    training_load_title: "Conseil de Charge",
    target_ctl: "CTL Cible",
    weekly_tss_target: "TSS Hebdo Cible",
    daily_tss_range: "Plage TSS Quotidien",
    load_advice: "Conseil",
    // Monthly Progress Report
    monthly_subject: "[IntervalCoach] Rapport Mensuel",
    monthly_greeting: "Voici votre rapport de progression mensuel.",
    monthly_period: "Période",
    monthly_comparison: "Mois par Mois",
    monthly_total_tss: "TSS Total",
    monthly_total_hours: "Temps Total",
    monthly_fitness_trend: "Tendance Fitness",
    monthly_eftp_trend: "Progression eFTP",
    monthly_volume: "Volume d'Entraînement",
    monthly_avg_weekly_tss: "TSS Hebdo Moyen",
    monthly_avg_weekly_hours: "Heures Hebdo Moyennes",
    monthly_total_activities: "Total Activités",
    monthly_consistency: "Régularité",
    monthly_weeks_trained: "Semaines Entraînées",
    monthly_footer: "Continuez à progresser vers vos objectifs!"
  },
  nl: {
    subject_prefix: "[IntervalCoach] Training van vandaag: ",
    greeting: "Hier is je IntervalCoach trainingsplan voor vandaag.",
    phase_title: "Huidige Fase",
    weeks_to_goal: "Weken tot doel",
    weeks_unit: "",
    focus: "Focus",
    goal_section: "Huidig Doel",
    status: "Atleet Status",
    recovery_title: "Herstel & Welzijn",
    recovery_status: "Herstelstatus",
    sleep: "Slaap",
    hrv: "HRV",
    resting_hr: "Rustpols",
    recommendation_title: "★ AANBEVOLEN WORKOUT ★",
    why_title: "【Waarom / Reden】",
    strategy_title: "【Strategie / Uitleg】",
    other_options: "Andere opties",
    footer: "*Opgeslagen in Google Drive (IntervalCoach_Workouts). Wacht op synchronisatie met Zwift.",
    power_profile_title: "Vermogensprofiel",
    current_eftp: "Huidig eFTP",
    all_time: "Alltime record",
    peak_powers: "Piekvermogens",
    strengths: "Sterke punten",
    focus_areas: "Verbeterpunten",
    workout_details: "Workout Details",
    // Weekly summary
    weekly_subject: "[IntervalCoach] Weekoverzicht",
    weekly_greeting: "Hier is je wekelijkse trainingsoverzicht.",
    weekly_overview: "Weekoverzicht",
    total_activities: "Totaal Activiteiten",
    total_time: "Totale Tijd",
    total_tss: "Totaal TSS",
    total_distance: "Totale Afstand",
    rides: "Fietsen",
    runs: "Hardlopen",
    weekly_fitness: "Fitness Voortgang",
    weekly_comparison: "vs Vorige Week",
    weekly_health: "Gezondheid & Herstel",
    avg_sleep: "Gem. Slaap",
    avg_hrv: "Gem. HRV",
    avg_rhr: "Gem. Rustpols",
    avg_recovery: "Gem. Herstel",
    ramp_rate: "Ramp Rate",
    weekly_footer: "Goed bezig, ga zo door!",
    // Training Load Advisor
    training_load_title: "Trainingsbelasting Advies",
    target_ctl: "Doel CTL",
    weekly_tss_target: "Wekelijks TSS Doel",
    daily_tss_range: "Dagelijks TSS Bereik",
    load_advice: "Advies",
    // Monthly Progress Report
    monthly_subject: "[IntervalCoach] Maandelijks Voortgangsrapport",
    monthly_greeting: "Hier is je maandelijkse voortgangsrapport.",
    monthly_period: "Periode",
    monthly_comparison: "Maand-over-Maand",
    monthly_total_tss: "Totaal TSS",
    monthly_total_hours: "Totale Tijd",
    monthly_fitness_trend: "Fitness Trend",
    monthly_eftp_trend: "eFTP Progressie",
    monthly_volume: "Trainingsvolume",
    monthly_avg_weekly_tss: "Gem. Wekelijks TSS",
    monthly_avg_weekly_hours: "Gem. Wekelijkse Uren",
    monthly_total_activities: "Totaal Activiteiten",
    monthly_consistency: "Consistentie",
    monthly_weeks_trained: "Weken Getraind",
    monthly_footer: "Blijf bouwen aan je doelen!"
  }
};

// =========================================================
// 5. GLOBAL CONSTANTS & HEADERS
// =========================================================
// Lazy-evaluated to avoid load-time dependency on config.gs
function getIcuAuthHeader() {
  return "Basic " + Utilities.base64Encode("API_KEY:" + API_KEYS.ICU_TOKEN);
}

const HEADERS_FIXED = [
  "start_date_local","name","type","moving_time","distance",
  "icu_ftp","icu_training_load","icu_ctl","icu_atl",
  "icu_intensity","icu_joules_above_ftp",
  "SS_secs_manual_fix",
  "Z1_secs","Z2_secs","Z3_secs","Z4_secs","Z5_secs","Z6_secs","Z7_secs","SS_secs_data",
  "SS_zone_secs_manual_fix",
  "HR_Z1","HR_Z2","HR_Z3","HR_Z4","HR_Z5","HR_Z6","HR_Z7",
  "power_zones","hr_zones","icu_weighted_avg_watts","icu_average_watts",
  "icu_variability_index","icu_efficiency_factor","decoupling","icu_max_wbal_depletion","trimp","CTL-ATL"
];

// =========================================================
// 6. WELLNESS DATA: Fetch from Intervals.icu (Whoop/Garmin/Oura)
// =========================================================
function fetchWellnessData(daysBack = 7, daysBackEnd = 0) {
  const today = new Date();
  const newest = new Date(today);
  newest.setDate(today.getDate() - daysBackEnd);
  const oldest = new Date(today);
  oldest.setDate(today.getDate() - daysBack);

  const newestStr = formatDateISO(newest);
  const oldestStr = formatDateISO(oldest);

  // Use date range endpoint (more reliable, returns fresh data)
  const url = "https://intervals.icu/api/v1/athlete/0/wellness?oldest=" + oldestStr + "&newest=" + newestStr;

  try {
    const response = UrlFetchApp.fetch(url, {
      headers: { "Authorization": getIcuAuthHeader() },
      muteHttpExceptions: true
    });

    if (response.getResponseCode() === 200) {
      const dataArray = JSON.parse(response.getContentText());

      // Map and sort by date descending (newest first)
      const wellnessRecords = dataArray.map(function(data) {
        // Convert sleepSecs to hours (API returns seconds)
        const sleepHours = data.sleepSecs ? data.sleepSecs / 3600 : 0;

        return {
          date: data.id,                             // Date is stored as "id"
          sleep: sleepHours,                         // Converted to hours
          sleepQuality: data.sleepQuality || null,   // 1-5 scale
          sleepScore: data.sleepScore || null,       // Whoop sleep score (0-100)
          restingHR: data.restingHR || null,         // Resting heart rate
          hrv: data.hrv || null,                     // HRV rMSSD
          hrvSDNN: data.hrvSDNN || null,             // HRV SDNN (if available)
          recovery: data.readiness || null,          // Whoop recovery score is stored as "readiness"
          spO2: data.spO2 || null,                   // Blood oxygen
          respiration: data.respiration || null,     // Breathing rate
          soreness: data.soreness || null,           // 1-5 scale
          fatigue: data.fatigue || null,             // 1-5 scale
          stress: data.stress || null,               // 1-5 scale
          mood: data.mood || null                    // 1-5 scale
        };
      });

      // Sort by date descending (newest first)
      wellnessRecords.sort(function(a, b) {
        return b.date.localeCompare(a.date);
      });

      return wellnessRecords;
    }
  } catch (e) {
    Logger.log("Failed to fetch wellness data: " + e.toString());
  }

  return [];
}

function createWellnessSummary(wellnessRecords) {
  if (!wellnessRecords || wellnessRecords.length === 0) {
    return {
      available: false,
      message: "No wellness data available"
    };
  }

  // Find the most recent record with actual wellness data (sleep/HRV/recovery)
  // Today's data might be empty if Whoop hasn't synced yet
  const latestWithData = wellnessRecords.find(r => r.sleep > 0 || r.hrv || r.recovery) || wellnessRecords[0];
  const last7Days = wellnessRecords.slice(0, 7);

  // Calculate averages for trend analysis
  const avgSleep = average(last7Days.map(w => w.sleep).filter(v => v > 0));
  const avgHRV = average(last7Days.map(w => w.hrv).filter(v => v != null));
  const avgRestingHR = average(last7Days.map(w => w.restingHR).filter(v => v != null));
  const avgRecovery = average(last7Days.map(w => w.recovery).filter(v => v != null));

  // Determine recovery status based on latest data with values
  let recoveryStatus = "Unknown";
  let intensityModifier = 1.0; // Multiplier for workout intensity

  if (latestWithData.recovery != null) {
    if (latestWithData.recovery >= 67) {
      recoveryStatus = "Green (Primed)";
      intensityModifier = 1.0; // Full intensity OK
    } else if (latestWithData.recovery >= 34) {
      recoveryStatus = "Yellow (Recovering)";
      intensityModifier = 0.85; // Reduce intensity
    } else {
      recoveryStatus = "Red (Strained)";
      intensityModifier = 0.7; // Significantly reduce
    }
  } else if (latestWithData.hrv != null && avgHRV > 0) {
    // Fallback: Use HRV trend if no recovery score
    const hrvDeviation = (latestWithData.hrv - avgHRV) / avgHRV;
    if (hrvDeviation >= 0.05) {
      recoveryStatus = "Above Baseline (Well Recovered)";
      intensityModifier = 1.0;
    } else if (hrvDeviation >= -0.1) {
      recoveryStatus = "Normal";
      intensityModifier = 0.9;
    } else {
      recoveryStatus = "Below Baseline (Fatigued)";
      intensityModifier = 0.75;
    }
  }

  // Sleep quality assessment
  let sleepStatus = "Unknown";
  if (latestWithData.sleep > 0) {
    if (latestWithData.sleep >= 7.5) sleepStatus = "Excellent";
    else if (latestWithData.sleep >= 6.5) sleepStatus = "Adequate";
    else if (latestWithData.sleep >= 5) sleepStatus = "Poor";
    else sleepStatus = "Insufficient";
  }

  return {
    available: true,
    today: {
      date: latestWithData.date,
      sleep: latestWithData.sleep,
      sleepQuality: latestWithData.sleepQuality,
      sleepScore: latestWithData.sleepScore,
      restingHR: latestWithData.restingHR,
      hrv: latestWithData.hrv,
      recovery: latestWithData.recovery,
      soreness: latestWithData.soreness,
      fatigue: latestWithData.fatigue,
      stress: latestWithData.stress,
      mood: latestWithData.mood
    },
    averages: {
      sleep: avgSleep,
      hrv: avgHRV,
      restingHR: avgRestingHR,
      recovery: avgRecovery
    },
    recoveryStatus: recoveryStatus,
    sleepStatus: sleepStatus,
    intensityModifier: intensityModifier
  };
}

// =========================================================
// 7. AVAILABILITY: Placeholder-Based Workout Generation
// =========================================================

/**
 * Check Intervals.icu calendar for workout placeholders
 * Looks for events starting with "Ride" or "Run" (e.g., "Ride - 90min" or "Run - 45min")
 * Returns: { hasPlaceholder: boolean, placeholder: object, duration: {min, max}, activityType: "Ride"|"Run" }
 */
function findIntervalCoachPlaceholder(dateStr) {
  const url = "https://intervals.icu/api/v1/athlete/0/events?oldest=" + dateStr + "&newest=" + dateStr;
  const ridePlaceholder = USER_SETTINGS.PLACEHOLDER_RIDE.toLowerCase();
  const runPlaceholder = USER_SETTINGS.PLACEHOLDER_RUN.toLowerCase();

  try {
    const response = UrlFetchApp.fetch(url, {
      headers: { "Authorization": getIcuAuthHeader() },
      muteHttpExceptions: true
    });

    if (response.getResponseCode() === 200) {
      const events = JSON.parse(response.getContentText());

      // Find placeholder event starting with "Ride", "Run", or "Hardlopen"
      const placeholder = events.find(function(e) {
        if (!e.name) return false;
        const nameLower = e.name.toLowerCase();
        return nameLower.startsWith(ridePlaceholder) ||
               nameLower.startsWith(runPlaceholder) ||
               nameLower.startsWith("hardlopen");
      });

      if (placeholder) {
        // Detect activity type from name
        const nameLower = placeholder.name.toLowerCase();
        const isRun = nameLower.startsWith(runPlaceholder) || nameLower.startsWith("hardlopen");
        const activityType = isRun ? "Run" : "Ride";

        // Parse duration with activity-specific defaults
        const duration = parseDurationFromName(placeholder.name, activityType);

        return {
          hasPlaceholder: true,
          placeholder: placeholder,
          duration: duration,
          activityType: activityType
        };
      }
    }
  } catch (e) {
    Logger.log("Error checking Intervals.icu calendar: " + e.toString());
  }

  return { hasPlaceholder: false, placeholder: null, duration: null, activityType: null };
}

/**
 * Parse duration from placeholder name
 * Supports formats: "Ride - 90min", "Run - 45min", "Ride-90", "Hardlopen - 30min"
 * Returns: { min: number, max: number } with activity-specific defaults
 */
function parseDurationFromName(name, activityType) {
  const defaultDuration = activityType === "Run"
    ? USER_SETTINGS.DEFAULT_DURATION_RUN
    : USER_SETTINGS.DEFAULT_DURATION_RIDE;

  // Match patterns like "90min", "90 min", "90m", or just "90" after separator
  const match = name.match(/[\s\-]+(\d+)\s*(min|m)?/i);

  if (match) {
    const minutes = parseInt(match[1], 10);
    // Runs: 20-60 min, Rides: 20-300 min
    const maxAllowed = activityType === "Run" ? 60 : 300;
    if (minutes >= 20 && minutes <= maxAllowed) {
      // Give +/- 10% flexibility around the specified duration
      const buffer = Math.round(minutes * 0.1);
      return {
        min: minutes - buffer,
        max: minutes + buffer
      };
    }
  }

  return defaultDuration;
}

/**
 * Determine if workout should be generated today
 * Checks for IntervalCoach placeholder in Intervals.icu calendar
 * Returns: { shouldGenerate: boolean, reason: string, duration: {min, max}, placeholder: object, activityType: string }
 */
function checkAvailability(wellness) {
  const todayStr = formatDateISO(new Date());
  const result = findIntervalCoachPlaceholder(todayStr);

  if (!result.hasPlaceholder) {
    return {
      shouldGenerate: false,
      reason: "No placeholder found for today. Add '" + USER_SETTINGS.PLACEHOLDER_RIDE + "' or '" + USER_SETTINGS.PLACEHOLDER_RUN + " - 45min' to your Intervals.icu calendar.",
      duration: null,
      placeholder: null,
      activityType: null
    };
  }

  // Found placeholder - extract info
  const placeholderName = result.placeholder.name;
  const duration = result.duration;
  const activityType = result.activityType;

  // Add recovery note if wellness data available
  let recoveryNote = "";
  if (wellness && wellness.available) {
    if (wellness.today.recovery != null && wellness.today.recovery < 34) {
      recoveryNote = " | Low recovery (" + wellness.today.recovery + "%)";
    }
  }

  return {
    shouldGenerate: true,
    reason: "Found placeholder: " + placeholderName + " (" + activityType + ")" + recoveryNote,
    duration: duration,
    placeholder: result.placeholder,
    activityType: activityType
  };
}

// =========================================================
// 8. VARIETY & REST DAY INTELLIGENCE
// =========================================================

/**
 * Classify an activity based on its zone distribution and intensity
 * Returns: { type: string, sport: "Ride"|"Run" }
 */
function classifyActivityType(activity) {
  // Determine sport type
  const sport = (activity.type === "Run" || activity.type === "VirtualRun") ? "Run" : "Ride";

  // Get zone times (in seconds) - works for both power zones and pace zones
  const zones = activity.icu_zone_times || activity.gap_zone_times || [];
  const getZoneSecs = function(zoneId) {
    const zone = zones.find(function(z) { return z.id === zoneId; });
    return zone ? zone.secs : 0;
  };

  const z1 = getZoneSecs("Z1");
  const z2 = getZoneSecs("Z2");
  const z3 = getZoneSecs("Z3");
  const z4 = getZoneSecs("Z4");
  const z5 = getZoneSecs("Z5");
  const z6 = getZoneSecs("Z6");
  const z7 = getZoneSecs("Z7");
  const ss = getZoneSecs("SS");

  const totalTime = activity.moving_time || (z1 + z2 + z3 + z4 + z5 + z6 + z7);
  if (totalTime < 600) return null; // Skip very short activities (<10 min)

  const highIntensity = z5 + z6 + z7;
  const threshold = z4 + ss;
  const endurance = z2 + z3;

  // Classify based on time in zones
  let type;
  if (highIntensity > 300) {
    type = sport === "Run" ? "Run_Intervals" : "VO2maxHighIntensity";
  } else if (threshold > 600) {
    type = sport === "Run" ? "Run_Tempo" : "FTPThreshold";
  } else if (endurance > totalTime * 0.5) {
    type = sport === "Run" ? "Run_Easy" : "EnduranceTempo";
  } else if (z1 > totalTime * 0.5) {
    type = sport === "Run" ? "Run_Recovery" : "RecoveryEasy";
  } else {
    type = sport === "Run" ? "Run_Easy" : "EnduranceTempo";
  }

  return { type: type, sport: sport };
}

/**
 * Fetch recent activities from Intervals.icu to track variety
 * Returns: { rides: [], runs: [], all: [] } with workout types from the last N days
 */
function getRecentWorkoutTypes(daysBack = 7) {
  const today = new Date();
  const oldest = new Date(today);
  oldest.setDate(today.getDate() - daysBack);

  const todayStr = formatDateISO(today);
  const oldestStr = formatDateISO(oldest);

  // Fetch actual activities (not just planned workouts)
  const activitiesUrl = "https://intervals.icu/api/v1/athlete/0/activities?oldest=" + oldestStr + "&newest=" + todayStr;

  const result = { rides: [], runs: [], all: [] };

  try {
    const response = UrlFetchApp.fetch(activitiesUrl, {
      headers: { "Authorization": getIcuAuthHeader() },
      muteHttpExceptions: true
    });

    if (response.getResponseCode() === 200) {
      const activities = JSON.parse(response.getContentText());

      // Classify each activity
      activities.forEach(function(a) {
        if (a.type === "Ride" || a.type === "VirtualRide" || a.type === "Run" || a.type === "VirtualRun") {
          const classified = classifyActivityType(a);
          if (classified) {
            result.all.push(classified.type);
            if (classified.sport === "Ride") {
              result.rides.push(classified.type);
            } else {
              result.runs.push(classified.type);
            }
          }
        }
      });
    }
  } catch (e) {
    Logger.log("Error fetching recent activities: " + e.toString());
  }

  // Also check IntervalCoach workouts from events (for planned but not yet executed)
  const eventsUrl = "https://intervals.icu/api/v1/athlete/0/events?oldest=" + oldestStr + "&newest=" + todayStr;

  try {
    const response = UrlFetchApp.fetch(eventsUrl, {
      headers: { "Authorization": getIcuAuthHeader() },
      muteHttpExceptions: true
    });

    if (response.getResponseCode() === 200) {
      const events = JSON.parse(response.getContentText());

      events.forEach(function(e) {
        if (e.name && e.name.startsWith("IntervalCoach_")) {
          const match = e.name.match(/IntervalCoach_([A-Za-z]+)_/);
          if (match) {
            const type = match[1];
            result.all.push(type);
            if (type.startsWith("Run")) {
              result.runs.push(type);
            } else {
              result.rides.push(type);
            }
          }
        }
      });
    }
  } catch (e) {
    Logger.log("Error fetching recent events: " + e.toString());
  }

  return result;
}

/**
 * Determine which workout types to generate based on variety and recovery
 * @param {object} wellness - Wellness summary
 * @param {object} recentTypes - { rides: [], runs: [], all: [] }
 * @param {string} activityType - "Ride" or "Run"
 * @returns {object} { types: [], isRestDay: boolean, reason: string }
 */
function selectWorkoutTypes(wellness, recentTypes, activityType) {
  // Base workout types based on activity
  const rideTypes = ["FTP_Threshold", "VO2max_HighIntensity", "Endurance_Tempo"];
  const runTypes = ["Run_Tempo", "Run_Intervals", "Run_Easy"];
  const allTypes = activityType === "Run" ? runTypes : rideTypes;

  // Check for rest day (Red recovery)
  if (wellness && wellness.available) {
    if (wellness.today.recovery != null && wellness.today.recovery < 34) {
      // Red recovery - rest day or easy only
      const easyTypes = activityType === "Run"
        ? ["Run_Recovery", "Run_Easy"]
        : ["Recovery_Easy", "Endurance_Tempo"];
      return {
        types: easyTypes,
        isRestDay: true,
        reason: "Low recovery (" + wellness.today.recovery + "%) - recommending easy/recovery workouts only"
      };
    }

    if (wellness.today.recovery != null && wellness.today.recovery < 50) {
      // Yellow-ish - avoid high intensity
      const moderateTypes = activityType === "Run"
        ? ["Run_Tempo", "Run_Easy"]
        : ["FTP_Threshold", "Endurance_Tempo"];
      return {
        types: moderateTypes,
        isRestDay: false,
        reason: "Moderate recovery (" + wellness.today.recovery + "%) - skipping high intensity"
      };
    }
  }

  // Type mappings for variety check
  const typeMapping = {
    "FTPThreshold": "FTP_Threshold",
    "VO2maxHighIntensity": "VO2max_HighIntensity",
    "EnduranceTempo": "Endurance_Tempo",
    "RecoveryEasy": "Recovery_Easy",
    "Run_Intervals": "Run_Intervals",
    "Run_Tempo": "Run_Tempo",
    "Run_Easy": "Run_Easy",
    "Run_Recovery": "Run_Recovery"
  };

  // Get relevant recent types based on activity
  const relevantRecent = activityType === "Run" ? recentTypes.runs : recentTypes.rides;

  // Count recent occurrences
  const typeCounts = {};
  relevantRecent.forEach(function(t) {
    const mapped = typeMapping[t] || t;
    typeCounts[mapped] = (typeCounts[mapped] || 0) + 1;
  });

  // If a type was done 2+ times in last 7 days, consider avoiding
  const typesToAvoid = [];
  let filteredTypes = allTypes.filter(function(type) {
    const count = typeCounts[type] || 0;
    if (count >= 2) {
      typesToAvoid.push(type);
      return false;
    }
    return true;
  });

  // Always keep at least 2 types
  if (filteredTypes.length < 2) {
    filteredTypes = allTypes;
  }

  const varietyNote = typesToAvoid.length > 0
    ? "Varying from recent: " + typesToAvoid.join(", ")
    : "Good variety in recent workouts";

  return {
    types: filteredTypes,
    isRestDay: false,
    reason: varietyNote
  };
}

// =========================================================
// 9. POWER CURVE ANALYSIS
// =========================================================

/**
 * Debug function to explore pace curve API response
 */
/**
 * Fetch upcoming goal events (A, B, and C priority races) from Intervals.icu
 * Returns the next A-race as primary target, B-races as secondary goals,
 * and C-races as subgoals (stepping stones toward A/B goals)
 */
function fetchUpcomingGoals() {
  const today = new Date();
  const futureDate = new Date(today);
  futureDate.setMonth(today.getMonth() + 12); // Look 12 months ahead

  const oldestStr = formatDateISO(today);
  const newestStr = formatDateISO(futureDate);

  const url = "https://intervals.icu/api/v1/athlete/0/events?oldest=" + oldestStr + "&newest=" + newestStr;

  const result = {
    available: false,
    primaryGoal: null,      // Next A-race
    secondaryGoals: [],     // B-races
    subGoals: [],           // C-races (stepping stones toward A/B goals)
    allGoals: []            // All A, B, and C races
  };

  try {
    const response = UrlFetchApp.fetch(url, {
      headers: { "Authorization": getIcuAuthHeader() },
      muteHttpExceptions: true
    });

    if (response.getResponseCode() === 200) {
      const events = JSON.parse(response.getContentText());

      // Filter for A, B, and C priority races
      const goalEvents = events.filter(function(e) {
        return e.category === 'RACE_A' || e.category === 'RACE_B' || e.category === 'RACE_C';
      });

      // Sort by date
      goalEvents.sort(function(a, b) {
        return new Date(a.start_date_local) - new Date(b.start_date_local);
      });

      if (goalEvents.length > 0) {
        result.available = true;
        result.allGoals = goalEvents.map(function(e) {
          let priority = 'C';
          if (e.category === 'RACE_A') priority = 'A';
          else if (e.category === 'RACE_B') priority = 'B';
          return {
            name: e.name,
            date: e.start_date_local.split('T')[0],
            priority: priority,
            type: e.type,
            description: e.description || ''
          };
        });

        // Find the next A-race (primary goal)
        const nextARace = goalEvents.find(function(e) { return e.category === 'RACE_A'; });
        if (nextARace) {
          result.primaryGoal = {
            name: nextARace.name,
            date: nextARace.start_date_local.split('T')[0],
            type: nextARace.type,
            description: nextARace.description || ''
          };
        } else {
          // If no A-race, use the first B-race
          const nextBRace = goalEvents[0];
          result.primaryGoal = {
            name: nextBRace.name,
            date: nextBRace.start_date_local.split('T')[0],
            type: nextBRace.type,
            description: nextBRace.description || ''
          };
        }

        // Collect B-races
        result.secondaryGoals = goalEvents
          .filter(function(e) { return e.category === 'RACE_B'; })
          .map(function(e) {
            return {
              name: e.name,
              date: e.start_date_local.split('T')[0],
              type: e.type
            };
          });

        // Collect C-races (subgoals/stepping stones)
        result.subGoals = goalEvents
          .filter(function(e) { return e.category === 'RACE_C'; })
          .map(function(e) {
            return {
              name: e.name,
              date: e.start_date_local.split('T')[0],
              type: e.type
            };
          });
      }
    }
  } catch (e) {
    Logger.log("Error fetching goals: " + e.toString());
  }

  return result;
}

/**
 * Build a dynamic goal description from fetched goals
 */
function buildGoalDescription(goals) {
  if (!goals.available || !goals.primaryGoal) {
    return USER_SETTINGS.GOAL_DESCRIPTION; // Fall back to manual setting
  }

  const primary = goals.primaryGoal;
  let description = primary.name;

  // Add date context
  const today = new Date();
  const targetDate = new Date(primary.date);
  const weeksOut = Math.ceil((targetDate - today) / (7 * 24 * 60 * 60 * 1000));

  description += " (" + primary.date + ", " + weeksOut + " weeks out)";

  // Add type
  if (primary.type) {
    description += ". Type: " + primary.type;
  }

  // Add description if available
  if (primary.description) {
    description += ". " + primary.description;
  }

  // Add secondary goals context
  if (goals.secondaryGoals && goals.secondaryGoals.length > 0) {
    const otherEvents = goals.secondaryGoals
      .filter(function(g) { return g.date !== primary.date; })
      .slice(0, 3)
      .map(function(g) { return g.name + " (" + g.date + ")"; });

    if (otherEvents.length > 0) {
      description += " Related events: " + otherEvents.join(", ");
    }
  }

  // Add C-races as stepping stones toward main goal
  if (goals.subGoals && goals.subGoals.length > 0) {
    const steppingStones = goals.subGoals
      .filter(function(g) { return g.date !== primary.date; })
      .slice(0, 3)
      .map(function(g) { return g.name + " (" + g.date + ")"; });

    if (steppingStones.length > 0) {
      description += " Stepping stones: " + steppingStones.join(", ") + ".";
    }
  }

  // Add peak form indicator
  description += ". Peak form indicator: eFTP should reach or exceed FTP.";

  return description;
}

/**
 * Test function for fetching dynamic goals
 */
function testGoals() {
  Logger.log("=== DYNAMIC GOALS TEST ===");
  const goals = fetchUpcomingGoals();

  if (goals.available) {
    Logger.log("Primary Goal (A-race):");
    Logger.log("  Name: " + goals.primaryGoal.name);
    Logger.log("  Date: " + goals.primaryGoal.date);
    Logger.log("  Type: " + goals.primaryGoal.type);

    Logger.log("Secondary Goals (B-races): " + goals.secondaryGoals.length);
    goals.secondaryGoals.forEach(function(g) {
      Logger.log("  - " + g.name + " (" + g.date + ")");
    });

    Logger.log("Subgoals (C-races): " + goals.subGoals.length);
    goals.subGoals.forEach(function(g) {
      Logger.log("  - " + g.name + " (" + g.date + ")");
    });

    Logger.log("All Goals:");
    goals.allGoals.forEach(function(g) {
      Logger.log("  [" + g.priority + "] " + g.name + " - " + g.date);
    });

    Logger.log("Generated Description:");
    Logger.log(buildGoalDescription(goals));

    // Test phase calculation
    const phaseInfo = calculateTrainingPhase(goals.primaryGoal.date);
    Logger.log("Phase: " + phaseInfo.phaseName + " (" + phaseInfo.weeksOut + " weeks out)");
    Logger.log("Focus: " + phaseInfo.focus);
  } else {
    Logger.log("No A/B/C race goals found in calendar");
    Logger.log("Falling back to manual TARGET_DATE: " + USER_SETTINGS.TARGET_DATE);
  }
}

/**
 * Debug function to explore events API for A/B race priorities
 */
function debugEvents() {
  Logger.log("=== EVENTS API DEBUG ===");

  // Fetch events for next 6 months
  const today = new Date();
  const futureDate = new Date(today);
  futureDate.setMonth(today.getMonth() + 6);

  const oldestStr = Utilities.formatDate(today, Session.getScriptTimeZone(), "yyyy-MM-dd");
  const newestStr = Utilities.formatDate(futureDate, Session.getScriptTimeZone(), "yyyy-MM-dd");

  const url = "https://intervals.icu/api/v1/athlete/0/events?oldest=" + oldestStr + "&newest=" + newestStr;

  Logger.log("Fetching events from " + oldestStr + " to " + newestStr);

  try {
    const response = UrlFetchApp.fetch(url, {
      headers: { "Authorization": getIcuAuthHeader() },
      muteHttpExceptions: true
    });

    Logger.log("Status: " + response.getResponseCode());

    if (response.getResponseCode() === 200) {
      const events = JSON.parse(response.getContentText());
      Logger.log("Total events: " + events.length);

      // Log all events with their properties
      events.forEach(function(event, index) {
        Logger.log("--- Event " + (index + 1) + " ---");
        Logger.log("Keys: " + Object.keys(event).join(", "));
        Logger.log("Name: " + event.name);
        Logger.log("Date: " + event.start_date_local);
        Logger.log("Category: " + event.category);
        Logger.log("Type: " + event.type);
        Logger.log("Priority: " + event.priority);
        Logger.log("Color: " + event.color);
        Logger.log("Load target: " + event.load_target);

        // Check for race-related fields
        if (event.race_type) Logger.log("Race type: " + event.race_type);
        if (event.indoor) Logger.log("Indoor: " + event.indoor);
      });

      // Filter for potential goal events (A or B priority, or race category)
      const goalEvents = events.filter(function(e) {
        return e.priority === 'A' || e.priority === 'B' ||
               e.category === 'RACE' || e.category === 'TARGET' ||
               (e.name && (e.name.toLowerCase().includes('race') || e.name.toLowerCase().includes('event')));
      });

      Logger.log("=== GOAL EVENTS (A/B/Race) ===");
      Logger.log("Found " + goalEvents.length + " goal events");
      goalEvents.forEach(function(e) {
        Logger.log(e.start_date_local + " | " + e.name + " | Priority: " + (e.priority || 'N/A') + " | Category: " + e.category);
      });
    }
  } catch (e) {
    Logger.log("Error: " + e.toString());
  }
}

function debugPaceCurve() {
  Logger.log("=== PACE CURVE API DEBUG ===");

  const today = new Date();
  const oldest42 = new Date(today);
  oldest42.setDate(today.getDate() - 42);
  const oldest42Str = Utilities.formatDate(oldest42, Session.getScriptTimeZone(), "yyyy-MM-dd");
  const todayStr = Utilities.formatDate(today, Session.getScriptTimeZone(), "yyyy-MM-dd");

  // Test different endpoints
  const endpoints = [
    "https://intervals.icu/api/v1/athlete/0/pace-curves?type=Run",
    "https://intervals.icu/api/v1/athlete/0/pace-curves?type=Run&oldest=" + oldest42Str + "&newest=" + todayStr,
    "https://intervals.icu/api/v1/athlete/0/pace-curves?type=Run&id=42d"
  ];

  endpoints.forEach(function(url) {
    Logger.log("--- Trying: " + url + " ---");
    try {
      const response = UrlFetchApp.fetch(url, {
        headers: { "Authorization": getIcuAuthHeader() },
        muteHttpExceptions: true
      });
      Logger.log("Status: " + response.getResponseCode());

      if (response.getResponseCode() === 200) {
        const data = JSON.parse(response.getContentText());
        Logger.log("Response keys: " + Object.keys(data).join(", "));

        if (data.list && data.list.length > 0) {
          const curve = data.list[0];
          Logger.log("Curve keys: " + Object.keys(curve).join(", "));

          // Check for pace models
          if (curve.paceModels) {
            Logger.log("paceModels: " + JSON.stringify(curve.paceModels));
          }
          if (curve.powerModels) {
            Logger.log("powerModels: " + JSON.stringify(curve.powerModels));
          }

          // Check for distances/times
          if (curve.distances) {
            Logger.log("distances (first 10): " + curve.distances.slice(0, 10).join(", "));
          }
          if (curve.secs) {
            Logger.log("secs (first 10): " + curve.secs.slice(0, 10).join(", "));
          }
        }
      } else {
        Logger.log("Error response: " + response.getContentText().substring(0, 200));
      }
    } catch (e) {
      Logger.log("Error: " + e.toString());
    }
  });

  // Also check athlete settings for run data
  Logger.log("--- Athlete Run Settings ---");
  const athleteUrl = "https://intervals.icu/api/v1/athlete/0";
  try {
    const resp = UrlFetchApp.fetch(athleteUrl, {
      headers: { "Authorization": getIcuAuthHeader() },
      muteHttpExceptions: true
    });
    const data = JSON.parse(resp.getContentText());

    if (data.sportSettings) {
      const settingsArray = Array.isArray(data.sportSettings)
        ? data.sportSettings
        : Object.values(data.sportSettings);

      const runSetting = settingsArray.find(function(s) {
        return s && s.types && s.types.includes("Run");
      });

      if (runSetting) {
        Logger.log("Run setting keys: " + Object.keys(runSetting).join(", "));
        Logger.log("threshold_pace: " + runSetting.threshold_pace + " (type: " + typeof runSetting.threshold_pace + ")");
        Logger.log("pace_zones: " + JSON.stringify(runSetting.pace_zones));

        // Check for pace model in settings
        if (runSetting.mmp_model) {
          Logger.log("mmp_model: " + JSON.stringify(runSetting.mmp_model));
        }
        if (runSetting.pace_model) {
          Logger.log("pace_model: " + JSON.stringify(runSetting.pace_model));
        }
      }
    }
  } catch (e) {
    Logger.log("Error: " + e.toString());
  }
}

/**
 * Quick test to verify running data (Critical Speed, pace curve) is being fetched
 */
function testRunningData() {
  Logger.log("=== RUNNING DATA TEST ===");
  const runningData = fetchRunningData();

  if (runningData.available) {
    Logger.log("Threshold Pace: " + (runningData.thresholdPace || 'N/A'));
    Logger.log("LTHR: " + (runningData.lthr || 'N/A') + " bpm");
    Logger.log("Max HR: " + (runningData.maxHr || 'N/A') + " bpm");

    Logger.log("--- Pace Curve Data ---");
    Logger.log("Critical Speed (42d): " + (runningData.criticalSpeed || 'N/A') + "/km");
    Logger.log("Critical Speed (m/s): " + (runningData.criticalSpeedMs || 'N/A'));
    Logger.log("D' (anaerobic): " + (runningData.dPrime ? runningData.dPrime.toFixed(1) + "m" : 'N/A'));
    Logger.log("Season Best CS: " + (runningData.seasonBestCS || 'N/A') + "/km");

    Logger.log("--- Best Efforts (42d) ---");
    if (runningData.bestEfforts) {
      Object.keys(runningData.bestEfforts).forEach(function(dist) {
        const effort = runningData.bestEfforts[dist];
        Logger.log(dist + "m: " + effort.time + " (" + effort.pace + "/km)");
      });
    }

    // Show calculated zones
    if (runningData.criticalSpeed) {
      Logger.log("--- Calculated Zones (based on CS) ---");
      Logger.log("Z1 (Recovery): " + addPace(runningData.criticalSpeed, 60) + " - " + addPace(runningData.criticalSpeed, 90) + "/km");
      Logger.log("Z2 (Endurance): " + addPace(runningData.criticalSpeed, 30) + " - " + addPace(runningData.criticalSpeed, 60) + "/km");
      Logger.log("Z3 (Tempo): " + addPace(runningData.criticalSpeed, 10) + " - " + addPace(runningData.criticalSpeed, 20) + "/km");
      Logger.log("Z4 (Threshold): " + runningData.criticalSpeed + "/km");
      Logger.log("Z5 (VO2max): " + subtractPace(runningData.criticalSpeed, 20) + " - " + subtractPace(runningData.criticalSpeed, 10) + "/km");
    }
  } else {
    Logger.log("No running data available");
  }
}

/**
 * Quick test to verify eFTP, W', and other metrics are being fetched correctly
 */
function testEftp() {
  const powerCurve = fetchPowerCurve();
  Logger.log("=== POWER PROFILE TEST ===");
  Logger.log("--- FTP Metrics ---");
  Logger.log("Current eFTP (mmp_model): " + powerCurve.currentEftp + "W");
  Logger.log("All-time eFTP (powerModels): " + powerCurve.allTimeEftp + "W");
  Logger.log("Manual FTP (set): " + powerCurve.manualFTP + "W");
  Logger.log("--- W' (Anaerobic Capacity) ---");
  Logger.log("Current W': " + (powerCurve.wPrime ? (powerCurve.wPrime/1000).toFixed(1) + "kJ" : 'N/A'));
  Logger.log("Season W': " + (powerCurve.seasonWPrime ? (powerCurve.seasonWPrime/1000).toFixed(1) + "kJ" : 'N/A'));
  Logger.log("--- pMax ---");
  Logger.log("Current pMax: " + (powerCurve.pMax || 'N/A') + "W");
  Logger.log("Season pMax: " + (powerCurve.seasonPMax || 'N/A') + "W");
  Logger.log("--- VO2max ---");
  Logger.log("VO2max (5m est): " + (powerCurve.vo2max5m ? powerCurve.vo2max5m.toFixed(1) : 'N/A'));
  Logger.log("--- Peak Powers ---");
  Logger.log("5s: " + powerCurve.peak5s + "W | 10s: " + powerCurve.peak10s + "W | 30s: " + powerCurve.peak30s + "W");
  Logger.log("1min: " + powerCurve.peak1min + "W | 2min: " + powerCurve.peak2min + "W | 5min: " + powerCurve.peak5min + "W");
  Logger.log("8min: " + powerCurve.peak8min + "W | 20min: " + powerCurve.peak20min + "W | 30min: " + powerCurve.peak30min + "W | 60min: " + powerCurve.peak60min + "W");

  // Test analyzed profile
  Logger.log("--- Analyzed Profile ---");
  const profile = analyzePowerProfile(powerCurve);
  if (profile.available) {
    Logger.log("W' Status: " + (profile.wPrimeStatus || 'N/A'));
    Logger.log("TTE Estimate: " + (profile.tteEstimate || 'N/A') + "min");
    Logger.log("Strengths: " + (profile.strengths.join(", ") || 'None'));
    Logger.log("Weaknesses: " + (profile.weaknesses.join(", ") || 'None'));
    Logger.log("Recommendations: " + (profile.recommendations.join("; ") || 'None'));
  }
  Logger.log("Manual FTP: " + powerCurve.manualFTP);
  Logger.log("Effective FTP (used for zones): " + powerCurve.ftp);
  Logger.log("Weight: " + powerCurve.weight + "kg");
  if (powerCurve.weight && powerCurve.ftp) {
    Logger.log("W/kg: " + (powerCurve.ftp / powerCurve.weight).toFixed(2));
  }

  Logger.log("=== FITNESS METRICS TEST ===");
  const fitness = fetchFitnessMetrics();
  Logger.log("CTL: " + fitness.ctl);
  Logger.log("ATL: " + fitness.atl);
  Logger.log("TSB: " + fitness.tsb);
  Logger.log("Ramp Rate: " + fitness.rampRate);
}

/**
 * Debug function to test power curve API - check for W', TTE, VO2max
 * Run this manually to see what the API returns
 */
function debugPowerCurve() {
  // Test power curve for additional metrics
  Logger.log("=== POWER CURVE METRICS DEBUG ===");

  const endpoints = [
    "https://intervals.icu/api/v1/athlete/0/power-curves?type=Ride&id=42d",
    "https://intervals.icu/api/v1/athlete/0/power-curves?type=Ride"
  ];

  endpoints.forEach(function(url) {
    Logger.log("--- " + url.split("id=")[1] || "default" + " ---");
    try {
      const resp = UrlFetchApp.fetch(url, {
        headers: { "Authorization": getIcuAuthHeader() },
        muteHttpExceptions: true
      });

      if (resp.getResponseCode() === 200) {
        const data = JSON.parse(resp.getContentText());
        if (data.list && data.list.length > 0) {
          const curve = data.list[0];
          Logger.log("Curve keys: " + Object.keys(curve).join(", "));

          // Check for W', TTE, VO2max fields
          Logger.log("w_prime: " + curve.w_prime);
          Logger.log("tte: " + curve.tte);
          Logger.log("vo2max_5m: " + curve.vo2max_5m);
          Logger.log("vo2max: " + curve.vo2max);
          Logger.log("map: " + curve.map);

          // Check powerModels for these values
          if (curve.powerModels) {
            Logger.log("powerModels: " + JSON.stringify(curve.powerModels));
          }

          // Check all fields that might contain these values
          Object.keys(curve).forEach(function(key) {
            if (key.toLowerCase().includes("vo2") ||
                key.toLowerCase().includes("tte") ||
                key.toLowerCase().includes("w_prime") ||
                key.toLowerCase().includes("wprime") ||
                key.toLowerCase().includes("map")) {
              Logger.log(key + ": " + JSON.stringify(curve[key]));
            }
          });
        }
      }
    } catch (e) {
      Logger.log("Error: " + e.toString());
    }
  });

  // Test athlete endpoint - look for FTP in all fields
  const athleteUrl = "https://intervals.icu/api/v1/athlete/0";
  try {
    const resp = UrlFetchApp.fetch(athleteUrl, {
      headers: { "Authorization": getIcuAuthHeader() },
      muteHttpExceptions: true
    });
    Logger.log("=== ATHLETE API ===");
    const data = JSON.parse(resp.getContentText());
    Logger.log("icu_weight: " + data.icu_weight);

    // Explore sportSettings (it's an array, not object)
    Logger.log("=== SPORT SETTINGS ===");
    if (data.sportSettings) {
      if (Array.isArray(data.sportSettings)) {
        Logger.log("sportSettings is array with " + data.sportSettings.length + " items");
        data.sportSettings.forEach(function(setting, idx) {
          if (setting.type === "Ride" || setting.types && setting.types.includes("Ride")) {
            Logger.log("Ride settings [" + idx + "]: " + JSON.stringify(setting));
          }
        });
        // Show first item structure
        if (data.sportSettings.length > 0) {
          Logger.log("First setting keys: " + Object.keys(data.sportSettings[0]).join(", "));
          Logger.log("First setting: " + JSON.stringify(data.sportSettings[0]));
        }
      } else {
        Logger.log("sportSettings: " + JSON.stringify(data.sportSettings));
      }
    } else {
      Logger.log("No sportSettings found");
    }
  } catch (e) {
    Logger.log("Athlete API error: " + e.toString());
  }

  // Test power curve endpoint - ALL TIME
  const curveUrl = "https://intervals.icu/api/v1/athlete/0/power-curves?type=Ride";
  Logger.log("(All-time power curve)");
  try {
    const resp = UrlFetchApp.fetch(curveUrl, {
      headers: { "Authorization": getIcuAuthHeader() },
      muteHttpExceptions: true
    });
    Logger.log("=== POWER CURVE API ===");
    if (resp.getResponseCode() === 200) {
      const data = JSON.parse(resp.getContentText());
      Logger.log("list length: " + (data.list ? data.list.length : "N/A"));
      if (data.list && data.list.length > 0) {
        const first = data.list[0];
        Logger.log("First item keys: " + Object.keys(first).join(", "));
        Logger.log("watts array length: " + (first.watts ? first.watts.length : "N/A"));
        Logger.log("secs array length: " + (first.secs ? first.secs.length : "N/A"));
        // Show secs array structure to understand indexing
        if (first.secs && first.watts) {
          Logger.log("First 10 secs values: " + first.secs.slice(0, 10).join(", "));
          Logger.log("Secs around 60: " + first.secs.slice(55, 65).join(", "));
          Logger.log("Last 5 secs values: " + first.secs.slice(-5).join(", "));

          // Find key durations by searching the array
          const findPower = function(targetSecs) {
            for (let i = 0; i < first.secs.length; i++) {
              if (first.secs[i] === targetSecs) return { index: i, watts: first.watts[i] };
            }
            // Find closest if no exact match
            for (let i = 0; i < first.secs.length; i++) {
              if (first.secs[i] > targetSecs) {
                return { index: i-1, secs: first.secs[i-1], watts: first.watts[i-1], note: "closest" };
              }
            }
            return null;
          };

          Logger.log("=== KEY DURATIONS ===");
          Logger.log("5s: " + JSON.stringify(findPower(5)));
          Logger.log("60s (1min): " + JSON.stringify(findPower(60)));
          Logger.log("300s (5min): " + JSON.stringify(findPower(300)));
          Logger.log("1200s (20min): " + JSON.stringify(findPower(1200)));
          Logger.log("3600s (60min): " + JSON.stringify(findPower(3600)));

          // Check powerModels for eFTP
          if (first.powerModels) {
            Logger.log("=== POWER MODELS ===");
            Logger.log("powerModels: " + JSON.stringify(first.powerModels));
          }
        }
      }
    }
  } catch (e) {
    Logger.log("Power curve API error: " + e.toString());
  }

  // Test 42-day rolling power curve (current fitness)
  const today = new Date();
  const oldest42 = new Date(today);
  oldest42.setDate(today.getDate() - 42);
  const oldest42Str = Utilities.formatDate(oldest42, Session.getScriptTimeZone(), "yyyy-MM-dd");
  const todayStr = Utilities.formatDate(today, Session.getScriptTimeZone(), "yyyy-MM-dd");
  const curve42Url = "https://intervals.icu/api/v1/athlete/0/power-curves?type=Ride&oldest=" + oldest42Str + "&newest=" + todayStr;

  // Try different curve IDs (42d, 90d, etc)
  Logger.log("=== POWER CURVE IDs ===");
  const curveIds = ["42d", "90d", "365d"];
  curveIds.forEach(function(curveId) {
    const url = "https://intervals.icu/api/v1/athlete/0/power-curves?type=Ride&id=" + curveId;
    try {
      const resp = UrlFetchApp.fetch(url, {
        headers: { "Authorization": getIcuAuthHeader() },
        muteHttpExceptions: true
      });
      if (resp.getResponseCode() === 200) {
        const data = JSON.parse(resp.getContentText());
        if (data.list && data.list.length > 0) {
          const first = data.list[0];
          const eftp = extractEftpFromModels(first.powerModels);
          Logger.log(curveId + ": eFTP=" + eftp + " (from " + first.start_date_local + " to " + first.end_date_local + ")");
        }
      } else {
        Logger.log(curveId + ": Status " + resp.getResponseCode());
      }
    } catch (e) {
      Logger.log(curveId + " error: " + e.toString());
    }
  });

  // Try fitness-model-events endpoint for eFTP
  const fitnessUrl = "https://intervals.icu/api/v1/athlete/0/fitness-model-events";
  try {
    const resp = UrlFetchApp.fetch(fitnessUrl, {
      headers: { "Authorization": getIcuAuthHeader() },
      muteHttpExceptions: true
    });
    Logger.log("=== FITNESS MODEL EVENTS API ===");
    Logger.log("Status: " + resp.getResponseCode());
    if (resp.getResponseCode() === 200) {
      const events = JSON.parse(resp.getContentText());
      Logger.log("Total events: " + events.length);

      // Find SET_EFTP events
      const eftpEvents = events.filter(function(e) { return e.category === "SET_EFTP"; });
      Logger.log("SET_EFTP events: " + eftpEvents.length);

      if (eftpEvents.length > 0) {
        // Show the most recent ones
        const recent = eftpEvents.slice(-3);
        recent.forEach(function(e) {
          Logger.log("eFTP event: " + JSON.stringify(e));
        });
      }
    }
  } catch (e) {
    Logger.log("Fitness model API error: " + e.toString());
  }
}

/**
 * Fetch running data (threshold pace, pace zones) from Intervals.icu
 */
function fetchRunningData() {
  const url = "https://intervals.icu/api/v1/athlete/0";

  try {
    const response = UrlFetchApp.fetch(url, {
      headers: { "Authorization": getIcuAuthHeader() },
      muteHttpExceptions: true
    });

    if (response.getResponseCode() === 200) {
      const data = JSON.parse(response.getContentText());

      // Find Run settings in sportSettings array
      if (data.sportSettings) {
        const settingsArray = Array.isArray(data.sportSettings)
          ? data.sportSettings
          : Object.values(data.sportSettings);

        const runSetting = settingsArray.find(function(s) {
          return s && s.types && s.types.includes("Run");
        });

        if (runSetting) {
          // Also fetch pace curve for Critical Speed
          const paceCurve = fetchRunningPaceCurve();

          // Convert threshold_pace from m/s to min:sec/km if it's a number
          let thresholdPaceFormatted = runSetting.threshold_pace;
          if (typeof runSetting.threshold_pace === 'number' && runSetting.threshold_pace > 0) {
            thresholdPaceFormatted = convertMsToMinKm(runSetting.threshold_pace);
          }

          // Convert pace_zones from m/s to min:sec/km
          let paceZonesFormatted = runSetting.pace_zones;
          if (runSetting.pace_zones && Array.isArray(runSetting.pace_zones)) {
            paceZonesFormatted = runSetting.pace_zones.map(function(p) {
              return typeof p === 'number' ? convertMsToMinKm(p) : p;
            });
          }

          return {
            available: true,
            thresholdPace: thresholdPaceFormatted,     // Formatted as "5:00" min/km
            thresholdPaceMs: runSetting.threshold_pace, // Raw m/s value
            paceZones: paceZonesFormatted,             // Array of formatted paces
            paceZoneNames: runSetting.pace_zone_names, // Zone names
            lthr: runSetting.lthr,                     // Lactate threshold HR
            maxHr: runSetting.max_hr,
            // Pace curve data (Critical Speed)
            criticalSpeed: paceCurve.criticalSpeed,       // Current CS in min/km
            criticalSpeedMs: paceCurve.criticalSpeedMs,   // CS in m/s
            dPrime: paceCurve.dPrime,                     // D' anaerobic capacity
            seasonBestCS: paceCurve.seasonBestCS,         // Season best CS
            bestEfforts: paceCurve.bestEfforts            // Best times at key distances
          };
        }
      }
    }
  } catch (e) {
    Logger.log("Error fetching running data: " + e.toString());
  }

  return { available: false };
}

/**
 * Fetch running pace curve from Intervals.icu
 * Returns Critical Speed (CS), D', and best efforts at key distances
 */
function fetchRunningPaceCurve() {
  const result = {
    criticalSpeed: null,
    criticalSpeedMs: null,
    dPrime: null,
    seasonBestCS: null,
    bestEfforts: {}
  };

  // Fetch current (42-day) pace curve using id parameter
  const url42 = "https://intervals.icu/api/v1/athlete/0/pace-curves?type=Run&id=42d";

  try {
    const response = UrlFetchApp.fetch(url42, {
      headers: { "Authorization": getIcuAuthHeader() },
      muteHttpExceptions: true
    });

    if (response.getResponseCode() === 200) {
      const data = JSON.parse(response.getContentText());

      if (data && data.list && data.list.length > 0) {
        const curve = data.list[0];

        // Extract Critical Speed model (API uses "CS" type with criticalSpeed/dPrime fields)
        if (curve.paceModels && curve.paceModels.length > 0) {
          const csModel = curve.paceModels.find(function(m) { return m.type === "CS"; }) || curve.paceModels[0];
          if (csModel) {
            result.criticalSpeedMs = csModel.criticalSpeed;  // m/s (field is criticalSpeed, not cs)
            result.dPrime = csModel.dPrime;                   // meters (field is dPrime, not d_prime)
            // Convert m/s to min/km
            if (csModel.criticalSpeed) {
              result.criticalSpeed = convertMsToMinKm(csModel.criticalSpeed);
            }
          }
        }

        // Extract best efforts from values array
        // values array contains [distance, time] pairs or similar structure
        if (curve.values && Array.isArray(curve.values)) {
          const keyDistances = [400, 800, 1500, 1609, 3000, 5000]; // meters

          // values might be structured as array of objects or nested arrays
          // Let's check and extract best times at key distances
          curve.values.forEach(function(v) {
            // Try to detect format - could be {distance, secs} or [distance, secs]
            let dist, totalSecs;
            if (Array.isArray(v)) {
              dist = v[0];
              totalSecs = v[1];
            } else if (v && typeof v === 'object') {
              dist = v.distance || v.d;
              totalSecs = v.secs || v.time || v.s;
            }

            if (dist && totalSecs && keyDistances.includes(dist)) {
              const mins = Math.floor(totalSecs / 60);
              const secs = Math.round(totalSecs % 60);
              const pacePerKm = (totalSecs / dist) * 1000;

              result.bestEfforts[dist] = {
                time: mins + ":" + (secs < 10 ? "0" : "") + secs,
                pace: convertMsToMinKm(dist / totalSecs)
              };
            }
          });
        }
      }
    }
  } catch (e) {
    Logger.log("Error fetching 42-day pace curve: " + e.toString());
  }

  // Fetch season/all-time pace curve for comparison
  const urlSeason = "https://intervals.icu/api/v1/athlete/0/pace-curves?type=Run";

  try {
    const response = UrlFetchApp.fetch(urlSeason, {
      headers: { "Authorization": getIcuAuthHeader() },
      muteHttpExceptions: true
    });

    if (response.getResponseCode() === 200) {
      const data = JSON.parse(response.getContentText());

      if (data && data.list && data.list.length > 0) {
        const curve = data.list[0];

        if (curve.paceModels && curve.paceModels.length > 0) {
          const csModel = curve.paceModels.find(function(m) { return m.type === "CS"; }) || curve.paceModels[0];
          if (csModel && csModel.criticalSpeed) {
            result.seasonBestCS = convertMsToMinKm(csModel.criticalSpeed);
          }
        }
      }
    }
  } catch (e) {
    Logger.log("Error fetching season pace curve: " + e.toString());
  }

  return result;
}

/**
 * Fetch athlete data including weight, FTP, and eFTP from Intervals.icu
 */
function fetchAthleteData() {
  const url = "https://intervals.icu/api/v1/athlete/0";

  try {
    const response = UrlFetchApp.fetch(url, {
      headers: { "Authorization": getIcuAuthHeader() },
      muteHttpExceptions: true
    });

    if (response.getResponseCode() === 200) {
      const data = JSON.parse(response.getContentText());

      // sportSettings may be array or object with numeric keys - find Ride settings
      let manualFtp = null;
      let eFtp = null;

      if (data.sportSettings) {
        // Convert to array if it's an object with numeric keys
        const settingsArray = Array.isArray(data.sportSettings)
          ? data.sportSettings
          : Object.values(data.sportSettings);

        const rideSetting = settingsArray.find(function(s) {
          return s && s.types && s.types.includes("Ride");
        });

        if (rideSetting) {
          manualFtp = rideSetting.ftp || null;  // Manual/set FTP (303W)
          // Current eFTP and other metrics from mmp_model (calculated daily)
          if (rideSetting.mmp_model) {
            eFtp = rideSetting.mmp_model.ftp || null;      // Rolling eFTP (269W)
          }
        }
      }

      // Extract current (rolling) metrics from mmp_model
      let currentWPrime = null;
      let currentPMax = null;
      if (data.sportSettings) {
        const settingsArray = Array.isArray(data.sportSettings)
          ? data.sportSettings
          : Object.values(data.sportSettings);
        const rideSetting = settingsArray.find(function(s) {
          return s && s.types && s.types.includes("Ride");
        });
        if (rideSetting && rideSetting.mmp_model) {
          currentWPrime = rideSetting.mmp_model.wPrime || null;  // Current W' (15120 J)
          currentPMax = rideSetting.mmp_model.pMax || null;      // Current pMax (880W)
        }
      }

      return {
        ftp: manualFtp,
        eFtp: eFtp,
        weight: data.icu_weight || data.weight || null,
        wPrime: currentWPrime,   // Current W' (anaerobic capacity in Joules)
        pMax: currentPMax        // Current max power
      };
    }
  } catch (e) {
    Logger.log("Error fetching athlete data: " + e.toString());
  }

  return { ftp: null, eFtp: null, weight: null };
}

/**
 * Extract eFTP from powerModels array
 * Uses Extended Critical Power (ECP) model as primary, falls back to others
 * @param {array} powerModels - Array of power model objects
 * @returns {number|null} FTP value
 */
function extractEftpFromModels(powerModels) {
  if (!powerModels || !Array.isArray(powerModels) || powerModels.length === 0) {
    return null;
  }

  // Priority: ECP > MORTON_3P > FFT_CURVES > MS_2P
  const modelPriority = ["ECP", "MORTON_3P", "FFT_CURVES", "MS_2P"];

  for (let i = 0; i < modelPriority.length; i++) {
    const model = powerModels.find(function(m) { return m.type === modelPriority[i]; });
    if (model && model.ftp) {
      return model.ftp;
    }
  }

  // Fallback: use first model with ftp
  const anyModel = powerModels.find(function(m) { return m.ftp; });
  return anyModel ? anyModel.ftp : null;
}

/**
 * Fetch power curve data from Intervals.icu
 * Returns power values at key durations for analysis
 */
function fetchPowerCurve() {
  // Get athlete data for weight, manual FTP, and current eFTP
  const athleteData = fetchAthleteData();

  // Get all-time power curve for peak powers
  const url = "https://intervals.icu/api/v1/athlete/0/power-curves?type=Ride";

  try {
    const response = UrlFetchApp.fetch(url, {
      headers: { "Authorization": getIcuAuthHeader() },
      muteHttpExceptions: true
    });

    if (response.getResponseCode() === 200) {
      const data = JSON.parse(response.getContentText());

      // Power curve is in data.list array
      if (data && data.list && data.list.length > 0) {
        const curve = data.list[0]; // Use first (default) time period
        const watts = curve.watts;
        const secs = curve.secs;

        if (!watts || !secs) {
          return { available: false };
        }

        // Find power at key durations by searching the secs array
        // The secs array is NOT sequential (may have gaps like 1,2,3...60,65,70...)
        const getPowerAt = function(targetSecs) {
          // Search for exact match first
          for (let i = 0; i < secs.length; i++) {
            if (secs[i] === targetSecs) {
              return watts[i];
            }
          }
          // If no exact match, find closest value <= targetSecs
          let bestIdx = 0;
          for (let i = 0; i < secs.length; i++) {
            if (secs[i] <= targetSecs) {
              bestIdx = i;
            } else {
              break; // secs is sorted, so we can stop
            }
          }
          return watts[bestIdx];
        };

        // Calculate FTP from 20-min power as fallback
        const peak20min = getPowerAt(1200);
        const curveFtp = Math.round(peak20min * 0.95);

        // Extract eFTP from powerModels for comparison
        const modelEftp = extractEftpFromModels(curve.powerModels);

        // Current eFTP from athlete settings (mmp_model) - this is the rolling daily value
        const currentEftp = athleteData.eFtp;

        // Priority: current eFTP from mmp_model > curve models > manual FTP > 20min*0.95
        const effectiveFtp = currentEftp || modelEftp || athleteData.ftp || curveFtp;

        // Extract W' and pMax from season powerModels (FFT_CURVES is most accurate)
        let seasonWPrime = null;
        let seasonPMax = null;
        if (curve.powerModels) {
          const fftModel = curve.powerModels.find(function(m) { return m.type === "FFT_CURVES"; });
          if (fftModel) {
            seasonWPrime = fftModel.wPrime;  // Season W' (17516 J)
            seasonPMax = fftModel.pMax;       // Season pMax (1190W)
          }
        }

        return {
          available: true,
          // Peak powers at key durations
          peak5s: getPowerAt(5),       // Neuromuscular
          peak10s: getPowerAt(10),     // Sprint
          peak30s: getPowerAt(30),     // Anaerobic
          peak1min: getPowerAt(60),    // Anaerobic capacity
          peak2min: getPowerAt(120),   // VO2max short
          peak5min: getPowerAt(300),   // VO2max
          peak8min: getPowerAt(480),   // VO2max long
          peak20min: peak20min,        // FTP proxy
          peak30min: getPowerAt(1800), // Sub-threshold
          peak60min: getPowerAt(3600), // Endurance
          // FTP metrics
          ftp: effectiveFtp,           // Current effective FTP (best available)
          eFTP: currentEftp || modelEftp || curveFtp, // Current eFTP (rolling daily)
          currentEftp: currentEftp,    // From mmp_model (269W - changes daily)
          allTimeEftp: modelEftp,      // From all-time power curve models
          manualFTP: athleteData.ftp,  // Manually set FTP (303W)
          curveFTP: curveFtp,          // FTP from 20min power * 0.95
          // W' (Anaerobic Work Capacity)
          wPrime: athleteData.wPrime,      // Current W' from mmp_model (15120 J)
          seasonWPrime: seasonWPrime,      // Season best W' (17516 J)
          // pMax (Max Power)
          pMax: athleteData.pMax,          // Current pMax from mmp_model (880W)
          seasonPMax: seasonPMax,          // Season best pMax (1190W)
          // Other metrics
          weight: athleteData.weight,      // For W/kg
          vo2max5m: curve.vo2max_5m        // VO2max estimate from 5-min power
        };
      }
    }
  } catch (e) {
    Logger.log("Error fetching power curve: " + e.toString());
  }

  return { available: false };
}

/**
 * Analyze power curve to identify strengths and weaknesses
 * Uses eFTP (current fitness) for analysis, not all-time peaks
 * @param {object} powerCurve - Power curve data
 * @returns {object} Analysis with strengths, weaknesses, and recommendations
 */
function analyzePowerProfile(powerCurve) {
  if (!powerCurve || !powerCurve.available) {
    return { available: false };
  }

  // Use current eFTP for analysis (rolling daily value), fallback to other sources
  const ftp = powerCurve.currentEftp || powerCurve.eFTP || powerCurve.ftp;

  // Calculate ratios (as % of current FTP)
  // Note: Peak powers are all-time, so ratios may be inflated if seasonal fitness is lower
  const ratios = {
    peak5s: powerCurve.peak5s / ftp,
    peak1min: powerCurve.peak1min / ftp,
    peak5min: powerCurve.peak5min / ftp,
    peak20min: powerCurve.peak20min / ftp
  };

  // Typical ratios for well-rounded cyclist
  const benchmarks = {
    peak5s: 2.0,    // Sprint ~200% of FTP
    peak1min: 1.5,  // Anaerobic ~150% of FTP
    peak5min: 1.2,  // VO2max ~120% of FTP
    peak20min: 1.05 // ~105% of FTP
  };

  const strengths = [];
  const weaknesses = [];
  const recommendations = [];

  // Analyze each duration
  if (ratios.peak5s > benchmarks.peak5s * 1.1) {
    strengths.push("Sprint power (5s)");
  } else if (ratios.peak5s < benchmarks.peak5s * 0.9) {
    weaknesses.push("Sprint power (5s)");
    recommendations.push("Include neuromuscular sprints");
  }

  if (ratios.peak1min > benchmarks.peak1min * 1.1) {
    strengths.push("Anaerobic capacity (1min)");
  } else if (ratios.peak1min < benchmarks.peak1min * 0.9) {
    weaknesses.push("Anaerobic capacity (1min)");
    recommendations.push("Add 1-minute max efforts");
  }

  if (ratios.peak5min > benchmarks.peak5min * 1.05) {
    strengths.push("VO2max power (5min)");
  } else if (ratios.peak5min < benchmarks.peak5min * 0.95) {
    weaknesses.push("VO2max power (5min)");
    recommendations.push("Focus on 3-5 minute intervals at 105-120% FTP");
  }

  if (ratios.peak20min > benchmarks.peak20min * 1.02) {
    strengths.push("Threshold endurance (20min)");
  } else if (ratios.peak20min < benchmarks.peak20min * 0.98) {
    weaknesses.push("Threshold endurance (20min)");
    recommendations.push("Include longer threshold intervals (2x20min)");
  }

  // For climbing events, check 5-20min power specifically
  const climbingPower = (powerCurve.peak5min + powerCurve.peak20min) / 2;
  const climbingStrength = climbingPower / ftp > 1.1 ? "Strong climber" : null;

  // Analyze W' (anaerobic capacity) trend
  let wPrimeStatus = null;
  if (powerCurve.wPrime && powerCurve.seasonWPrime) {
    const wPrimeRatio = powerCurve.wPrime / powerCurve.seasonWPrime;
    if (wPrimeRatio < 0.85) {
      wPrimeStatus = "Low (needs anaerobic work)";
      recommendations.push("Build W' with hard 30s-2min efforts");
    } else if (wPrimeRatio > 0.95) {
      wPrimeStatus = "Strong";
    } else {
      wPrimeStatus = "Moderate";
    }
  }

  // Calculate TTE estimate (time to exhaustion at FTP)
  // TTE ≈ W' / (target power - FTP), but simplified as W'/30 for typical above-FTP efforts
  let tteEstimate = null;
  if (powerCurve.wPrime && ftp) {
    // Rough TTE in minutes based on W' (higher W' = longer TTE)
    tteEstimate = Math.round(powerCurve.wPrime / 500); // Simplified formula
  }

  return {
    available: true,
    ftp: ftp,
    currentEftp: powerCurve.currentEftp,   // Pass through from power curve
    eFTP: powerCurve.eFTP,
    allTimeEftp: powerCurve.allTimeEftp,
    manualFTP: powerCurve.manualFTP,       // Target FTP (303W)
    weight: powerCurve.weight,
    // Peak powers
    peak5s: powerCurve.peak5s,
    peak10s: powerCurve.peak10s,
    peak30s: powerCurve.peak30s,
    peak1min: powerCurve.peak1min,
    peak2min: powerCurve.peak2min,
    peak5min: powerCurve.peak5min,
    peak8min: powerCurve.peak8min,
    peak20min: powerCurve.peak20min,
    peak30min: powerCurve.peak30min,
    peak60min: powerCurve.peak60min,
    // W' (Anaerobic Work Capacity)
    wPrime: powerCurve.wPrime,             // Current W' in Joules (15120 J)
    seasonWPrime: powerCurve.seasonWPrime, // Season best W' (17516 J)
    wPrimeKj: powerCurve.wPrime ? (powerCurve.wPrime / 1000).toFixed(1) : null, // In kJ for display
    wPrimeStatus: wPrimeStatus,
    // pMax (Max Power)
    pMax: powerCurve.pMax,                 // Current pMax (880W)
    seasonPMax: powerCurve.seasonPMax,     // Season best pMax (1190W)
    // VO2max & TTE
    vo2max: powerCurve.vo2max5m,           // VO2max estimate
    tteEstimate: tteEstimate,              // Estimated TTE in minutes
    // Analysis
    strengths: strengths,
    weaknesses: weaknesses,
    recommendations: recommendations,
    climbingStrength: climbingStrength,
    summary: weaknesses.length > 0
      ? "Focus areas: " + weaknesses.join(", ")
      : "Well-rounded power profile"
  };
}

// =========================================================
// 10. MAIN FUNCTION: Fetch Data
// =========================================================
function fetchAndLogActivities() {
  const sheet = SpreadsheetApp.openById(USER_SETTINGS.SPREADSHEET_ID).getSheetByName(USER_SETTINGS.SHEET_NAME);
  
  const to = new Date();
  const from = new Date();
  from.setDate(to.getDate() - 90);

  const url = `https://intervals.icu/api/v1/athlete/0/activities?oldest=${formatDateISO(from)}&newest=${formatDateISO(to)}`;

  try {
    const response = UrlFetchApp.fetch(url, { 
      headers: { "Authorization": getIcuAuthHeader() },
      muteHttpExceptions: true
    });
    
    if (response.getResponseCode() !== 200) {
      Logger.log("Error fetching activities: " + response.getContentText());
      return;
    }

    const activities = JSON.parse(response.getContentText());
    if (!activities || activities.length === 0) {
      Logger.log("No activities to write");
      return;
    }

    const rows = activities.map(a => mapActivityToRow(a));
    sheet.clear();
    sheet.getRange(1, 1, 1, HEADERS_FIXED.length).setValues([HEADERS_FIXED]);
    sheet.getRange(2, 1, rows.length, rows[0].length).setValues(rows);
    Logger.log(`${rows.length} rows added to spreadsheet.`);
  } catch (e) {
    Logger.log("Exception in fetchAndLogActivities: " + e.toString());
  }
}

// =========================================================
// 9. HELPER: Upload Workout to Intervals.icu Calendar
// =========================================================

/**
 * Upload workout to Intervals.icu, replacing existing placeholder if provided
 * @param {string} name - Workout name
 * @param {string} zwoContent - ZWO file content
 * @param {string} dateStr - Date in yyyy-MM-dd format
 * @param {object} placeholder - Optional placeholder event to replace
 */
function uploadWorkoutToIntervals(name, zwoContent, dateStr, placeholder) {
  const athleteId = "0"; // "0" works for the API key owner

  // If we have a placeholder, update it (PUT); otherwise create new (POST)
  const isUpdate = placeholder && placeholder.id;
  const url = isUpdate
    ? "https://intervals.icu/api/v1/athlete/" + athleteId + "/events/" + placeholder.id
    : "https://intervals.icu/api/v1/athlete/" + athleteId + "/events";

  const payload = {
    category: "WORKOUT",
    type: "Ride",
    name: name,
    description: "Generated by IntervalCoach AI Coach",
    start_date_local: dateStr + "T10:00:00", // Schedule for 10:00 AM
    file_contents: zwoContent,
    file_extension: "zwo"
  };

  const options = {
    method: isUpdate ? "put" : "post",
    headers: {
      "Authorization": getIcuAuthHeader(),
      "Content-Type": "application/json"
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };

  try {
    const response = UrlFetchApp.fetch(url, options);
    const code = response.getResponseCode();
    if (code === 200 || code === 201) {
      Logger.log(" -> " + (isUpdate ? "Replaced placeholder" : "Uploaded") + " to Intervals.icu: " + name);
    } else {
      Logger.log(" -> Failed to upload to Intervals.icu: " + response.getContentText());
    }
  } catch (e) {
    Logger.log(" -> Error uploading to Intervals.icu: " + e.toString());
  }
}

/**
 * Upload running workout to Intervals.icu, replacing existing placeholder if provided
 * @param {string} name - Workout name
 * @param {string} description - Workout description (text format for runs)
 * @param {string} dateStr - Date in yyyy-MM-dd format
 * @param {object} placeholder - Optional placeholder event to replace
 * @param {object} duration - Duration object { min, max } for estimated time
 */
function uploadRunToIntervals(name, description, dateStr, placeholder, duration) {
  const athleteId = "0"; // "0" works for the API key owner

  // If we have a placeholder, update it (PUT); otherwise create new (POST)
  const isUpdate = placeholder && placeholder.id;
  const url = isUpdate
    ? "https://intervals.icu/api/v1/athlete/" + athleteId + "/events/" + placeholder.id
    : "https://intervals.icu/api/v1/athlete/" + athleteId + "/events";

  // Estimate moving time from duration (use midpoint)
  const estimatedMinutes = duration ? Math.round((duration.min + duration.max) / 2) : 40;
  const movingTime = estimatedMinutes * 60; // Convert to seconds

  const payload = {
    category: "WORKOUT",
    type: "Run",
    name: name,
    description: "Generated by IntervalCoach AI Coach\n\n" + description,
    start_date_local: dateStr + "T10:00:00", // Schedule for 10:00 AM
    moving_time: movingTime
  };

  const options = {
    method: isUpdate ? "put" : "post",
    headers: {
      "Authorization": getIcuAuthHeader(),
      "Content-Type": "application/json"
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };

  try {
    const response = UrlFetchApp.fetch(url, options);
    const code = response.getResponseCode();
    if (code === 200 || code === 201) {
      Logger.log(" -> " + (isUpdate ? "Replaced placeholder" : "Uploaded") + " run to Intervals.icu: " + name);
    } else {
      Logger.log(" -> Failed to upload run to Intervals.icu: " + response.getContentText());
    }
  } catch (e) {
    Logger.log(" -> Error uploading run to Intervals.icu: " + e.toString());
  }
}

// =========================================================
// 10. MAIN FUNCTION: Generate Workouts
// =========================================================
function generateOptimalZwiftWorkoutsAutoByGemini() {
  const today = new Date();

  // Fetch Wellness Data first (needed for availability check)
  const wellnessRecords = fetchWellnessData(7);
  const wellness = createWellnessSummary(wellnessRecords);

  // Check for IntervalCoach placeholder in Intervals.icu calendar
  const availability = checkAvailability(wellness);

  if (!availability.shouldGenerate) {
    Logger.log("Skipping workout generation: " + availability.reason);
    return;
  }

  Logger.log("Availability check passed: " + availability.reason);

  const activityType = availability.activityType; // "Ride" or "Run"
  const isRun = activityType === "Run";

  const folder = getOrCreateFolder(USER_SETTINGS.WORKOUT_FOLDER);
  const sheet = SpreadsheetApp.openById(USER_SETTINGS.SPREADSHEET_ID).getSheetByName(USER_SETTINGS.SHEET_NAME);
  const data = sheet.getDataRange().getValues();
  data.shift(); // Remove header

  // Create Athlete Summary
  const summary = createAthleteSummary(data);

  // Fetch dynamic goals from calendar (A/B/C races)
  const goals = fetchUpcomingGoals();
  let targetDate = USER_SETTINGS.TARGET_DATE; // Fallback
  let goalDescription = USER_SETTINGS.GOAL_DESCRIPTION; // Fallback

  if (goals.available && goals.primaryGoal) {
    targetDate = goals.primaryGoal.date;
    goalDescription = buildGoalDescription(goals);
    Logger.log("Dynamic Goal: " + goals.primaryGoal.name + " (" + targetDate + ")");
  } else {
    Logger.log("No A/B/C races found, using manual TARGET_DATE: " + targetDate);
  }

  // Calculate Periodization Phase based on goal
  const phaseInfo = calculateTrainingPhase(targetDate);
  phaseInfo.goalDescription = goalDescription; // Attach for use in prompts

  // Fetch sport-specific data
  let powerProfile = { available: false };
  let runningData = { available: false };

  if (isRun) {
    runningData = fetchRunningData();
    if (runningData.available) {
      let runLog = "Running Data: CS=" + (runningData.criticalSpeed || 'N/A') + "/km";
      if (runningData.seasonBestCS && runningData.criticalSpeed !== runningData.seasonBestCS) {
        runLog += " (season best: " + runningData.seasonBestCS + "/km)";
      }
      runLog += " | D'=" + (runningData.dPrime ? runningData.dPrime.toFixed(0) + "m" : 'N/A');
      runLog += " | Threshold=" + (runningData.thresholdPace || 'N/A') + "/km";
      Logger.log(runLog);

      // Log best efforts
      if (runningData.bestEfforts && Object.keys(runningData.bestEfforts).length > 0) {
        const effortParts = [];
        if (runningData.bestEfforts[800]) effortParts.push("800m:" + runningData.bestEfforts[800].pace);
        if (runningData.bestEfforts[1500]) effortParts.push("1.5k:" + runningData.bestEfforts[1500].pace);
        if (runningData.bestEfforts[3000]) effortParts.push("3k:" + runningData.bestEfforts[3000].pace);
        if (effortParts.length > 0) {
          Logger.log("Best Efforts (42d): " + effortParts.join(" | "));
        }
      }
    }
  } else {
    const powerCurve = fetchPowerCurve();
    powerProfile = analyzePowerProfile(powerCurve);
  }

  Logger.log("Athlete Summary: TSB=" + summary.tsb_current.toFixed(1));
  Logger.log("Current Phase: " + phaseInfo.phaseName + " (" + phaseInfo.weeksOut + " weeks out)");

  if (!isRun && powerProfile.available) {
    let ftpLog = "Power Profile: eFTP=" + (powerProfile.currentEftp || powerProfile.eFTP || 'N/A') + "W";
    if (powerProfile.allTimeEftp && powerProfile.currentEftp && powerProfile.allTimeEftp > powerProfile.currentEftp) {
      ftpLog += " (all-time: " + powerProfile.allTimeEftp + "W)";
    }
    ftpLog += " | 5min=" + powerProfile.peak5min + "W | 1min=" + powerProfile.peak1min + "W";
    if (powerProfile.weight) {
      ftpLog += " | " + (powerProfile.ftp / powerProfile.weight).toFixed(2) + " W/kg";
    }
    Logger.log(ftpLog);

    // Log new metrics
    let physioLog = "Physio: W'=" + (powerProfile.wPrimeKj || 'N/A') + "kJ";
    if (powerProfile.seasonWPrime && powerProfile.wPrime) {
      physioLog += " (season: " + (powerProfile.seasonWPrime/1000).toFixed(1) + "kJ)";
    }
    physioLog += " | VO2max=" + (powerProfile.vo2max ? powerProfile.vo2max.toFixed(1) : 'N/A');
    physioLog += " | pMax=" + (powerProfile.pMax || 'N/A') + "W";
    if (powerProfile.wPrimeStatus) {
      physioLog += " | Status: " + powerProfile.wPrimeStatus;
    }
    Logger.log(physioLog);

    Logger.log("Power Analysis: " + powerProfile.summary);
  }
  Logger.log("Target Duration: " + availability.duration.min + "-" + availability.duration.max + " min");

  if (wellness && wellness.available) {
    Logger.log("Recovery Status: " + wellness.recoveryStatus + " | Sleep: " + wellness.today.sleep.toFixed(1) + "h (" + wellness.sleepStatus + ")");
    Logger.log("HRV: " + (wellness.today.hrv || 'N/A') + " | Resting HR: " + (wellness.today.restingHR || 'N/A'));
  } else {
    Logger.log("Wellness data: Not available");
  }

  // Get recent workout types for variety tracking
  const recentTypes = getRecentWorkoutTypes(7);
  const recentDisplay = isRun
    ? (recentTypes.runs.length > 0 ? recentTypes.runs.join(", ") : "None")
    : (recentTypes.rides.length > 0 ? recentTypes.rides.join(", ") : "None");
  Logger.log("Recent " + activityType + " types (7 days): " + recentDisplay);
  Logger.log("All recent activities: Rides=" + recentTypes.rides.length + ", Runs=" + recentTypes.runs.length);

  // Get adaptive training context (RPE/Feel feedback from recent workouts)
  const adaptiveContext = getAdaptiveTrainingContext();
  if (adaptiveContext.available) {
    Logger.log("Adaptive Training: " + adaptiveContext.adaptation.recommendation.toUpperCase() +
      " (Feel: " + (adaptiveContext.feedback.avgFeel ? adaptiveContext.feedback.avgFeel.toFixed(1) : 'N/A') + "/5" +
      ", RPE: " + (adaptiveContext.feedback.avgRpe ? adaptiveContext.feedback.avgRpe.toFixed(1) : 'N/A') + "/10" +
      ", Adjustment: " + (adaptiveContext.adaptation.intensityAdjustment > 0 ? '+' : '') + adaptiveContext.adaptation.intensityAdjustment + "%)");
  } else {
    Logger.log("Adaptive Training: Insufficient feedback data (log RPE/Feel in Intervals.icu)");
  }

  // Get cross-training context (strength, walks, swimming, etc.)
  const crossTrainingContext = getCrossTrainingContext();
  if (crossTrainingContext.available) {
    Logger.log("Cross-Training: " + crossTrainingContext.data.summary.totalActivities + " activities in last 5 days" +
      " | Impact: " + crossTrainingContext.impact.impactLevel.toUpperCase() +
      " | Intensity modifier: " + Math.round(crossTrainingContext.impact.intensityModifier * 100) + "%");
  } else {
    Logger.log("Cross-Training: No recent cross-training activities");
  }

  // Select workout types based on recovery and variety
  const typeSelection = selectWorkoutTypes(wellness, recentTypes, activityType);
  Logger.log("Type selection: " + typeSelection.reason);

  if (typeSelection.isRestDay) {
    Logger.log("*** REST DAY RECOMMENDED - generating easy workout ***");
  }

  // Select the best workout type based on phase, recovery, and variety
  const selectedType = typeSelection.types[0]; // First type is the best option
  Logger.log("Selected workout type: " + selectedType);

  const dateStr = Utilities.formatDate(today, SYSTEM_SETTINGS.TIMEZONE, "MMdd");
  const fileDateStr = Utilities.formatDate(today, SYSTEM_SETTINGS.TIMEZONE, "yyyyMMdd");

  // Generate workout with appropriate prompt
  Logger.log("Generating " + activityType + " workout: " + selectedType + "...");

  const prompt = isRun
    ? createRunPrompt(selectedType, summary, phaseInfo, dateStr, availability.duration, wellness, runningData, adaptiveContext, crossTrainingContext)
    : createPrompt(selectedType, summary, phaseInfo, dateStr, availability.duration, wellness, powerProfile, adaptiveContext, crossTrainingContext);

  const result = callGeminiAPI(prompt);

  if (!result.success) {
    Logger.log("Failed to generate workout: " + result.error);
    return;
  }

  const safeType = selectedType.replace(/[^a-zA-Z0-9]/g, "");
  const isoDateStr = formatDateISO(today);

  let workout;

  if (isRun) {
    // For runs: save description and upload as text workout to Intervals.icu
    const fileName = `IntervalCoach_${safeType}_${fileDateStr}.txt`;
    const workoutText = result.workoutDescription || result.explanation;
    const blob = Utilities.newBlob(workoutText, "text/plain", fileName);
    folder.createFile(blob);
    Logger.log(" -> Saved to Drive: " + fileName);

    workout = {
      type: selectedType,
      explanation: result.explanation,
      recommendationScore: result.recommendationScore,
      recommendationReason: result.recommendationReason,
      blob: blob,
      fileName: fileName,
      workoutDescription: workoutText
    };

    // Upload run to Intervals.icu calendar
    uploadRunToIntervals(fileName.replace('.txt', ''), result.workoutDescription || result.explanation, isoDateStr, availability.placeholder, availability.duration);
  } else {
    // For rides: save ZWO and upload
    const fileName = `IntervalCoach_${safeType}_${fileDateStr}.zwo`;
    const blob = Utilities.newBlob(result.xml, "text/xml", fileName);
    folder.createFile(blob);
    Logger.log(" -> Saved to Drive: " + fileName);

    workout = {
      type: selectedType,
      explanation: result.explanation,
      recommendationScore: result.recommendationScore,
      recommendationReason: result.recommendationReason,
      blob: blob,
      fileName: fileName,
      xml: result.xml
    };

    // Upload to Intervals.icu calendar (replaces placeholder)
    uploadWorkoutToIntervals(fileName.replace('.zwo', ''), result.xml, isoDateStr, availability.placeholder);
  }

  // Send Email
  sendSmartSummaryEmail(summary, phaseInfo, workout, wellness, isRun ? null : powerProfile);
}

// =========================================================
// 8. LOGIC: Periodization Phase Calculation
// =========================================================
function calculateTrainingPhase(targetDateStr) {
  const today = new Date();
  const target = new Date(targetDateStr);
  
  // Calculate weeks until target
  const diffTime = target.getTime() - today.getTime();
  const diffWeeks = Math.ceil(diffTime / (1000 * 60 * 60 * 24 * 7));

  let phaseName = "";
  let focus = "";

  if (diffWeeks < 0) {
    phaseName = "Transition / Off-Season";
    focus = "Recover, fun rides, cross-training.";
  } else if (diffWeeks <= 1) {
    phaseName = "Race Week / Taper";
    focus = "Sharpness, freshness, minimal fatigue. Short high intensity openers.";
  } else if (diffWeeks <= 3) {
    phaseName = "Peak / Taper";
    focus = "Reduce volume, maintain intensity. Shed fatigue (increase TSB).";
  } else if (diffWeeks <= 8) {
    phaseName = "Specialty / High Build";
    focus = "Race specificity. VO2max, Anaerobic capacity. Hard intervals.";
  } else if (diffWeeks <= 16) {
    phaseName = "Build Phase";
    focus = "FTP development (Threshold), SST. Increasing training load (CTL).";
  } else {
    phaseName = "Base Phase";
    focus = "Aerobic endurance (Z2), Tempo (Z3), SweetSpot. Building foundation.";
  }

  return {
    weeksOut: diffWeeks,
    phaseName: phaseName,
    focus: focus
  };
}

// =========================================================
// 9. HELPER: Gemini API Call
// =========================================================
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

        // Check for required fields (either xml for cycling or workoutDescription for running)
        if (!result.explanation) throw new Error("Incomplete JSON: missing explanation");

        const isRunWorkout = result.workoutDescription && !result.xml;

        if (isRunWorkout) {
          // Running workout response
          return {
            success: true,
            workoutDescription: result.workoutDescription,
            explanation: result.explanation,
            recommendationScore: result.recommendation_score || 5,
            recommendationReason: result.recommendation_reason || ""
          };
        } else {
          // Cycling workout response (ZWO)
          if (!result.xml) throw new Error("Incomplete JSON: missing xml");

          let xml = result.xml.replace(/^```xml\s*/i, "").replace(/^```\s*/i, "").replace(/```$/i, "").trim();
          if (!xml.includes("<workout_file>")) throw new Error("Invalid XML: missing root tag");

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

// =========================================================
// 12. HELPER: Prompt Construction
// =========================================================
function createPrompt(type, summary, phaseInfo, dateStr, duration, wellness, powerProfile, adaptiveContext, crossTrainingContext) {
  const langMap = { "ja": "Japanese", "en": "English", "es": "Spanish", "fr": "French", "nl": "Dutch" };
  const analysisLang = langMap[USER_SETTINGS.LANGUAGE] || "English";

  // Zwift Display Name (Clean, short name without "IntervalCoach_" prefix)
  const safeType = type.replace(/[^a-zA-Z0-9]/g,"");
  const zwiftDisplayName = safeType + "_" + dateStr;

  // Format duration string
  const durationStr = duration ? (duration.min + "-" + duration.max + " min") : "60 min (+/- 5min)";

  // Build power profile context
  let powerContext = "";
  if (powerProfile && powerProfile.available) {
    // Build FTP context string showing current vs target
    const currentEftp = powerProfile.currentEftp || powerProfile.eFTP;
    const manualFtp = powerProfile.manualFTP || 303; // Target FTP for peak form
    let ftpContext = `**Current eFTP:** ${currentEftp || 'N/A'}W`;

    // Show gap to peak form (eFTP vs manual FTP)
    if (currentEftp && manualFtp) {
      const gapToTarget = manualFtp - currentEftp;
      if (gapToTarget > 0) {
        ftpContext += ` (Target FTP: ${manualFtp}W, ${gapToTarget}W to peak form)`;
      } else {
        ftpContext += ` (AT OR ABOVE target FTP ${manualFtp}W - PEAK FORM!)`;
      }
    }

    if (powerProfile.allTimeEftp && currentEftp && powerProfile.allTimeEftp > currentEftp) {
      ftpContext += ` | All-time: ${powerProfile.allTimeEftp}W`;
    }
    if (powerProfile.weight) {
      const wpkg = (powerProfile.ftp / powerProfile.weight).toFixed(2);
      ftpContext += ` | ${wpkg} W/kg`;
    }

    // Build W' and physiological context
    let wPrimeContext = "";
    if (powerProfile.wPrime) {
      wPrimeContext = `\n- **W' (Anaerobic Capacity):** ${powerProfile.wPrimeKj}kJ`;
      if (powerProfile.seasonWPrime && powerProfile.wPrime < powerProfile.seasonWPrime) {
        const wPrimeGap = ((powerProfile.seasonWPrime - powerProfile.wPrime) / 1000).toFixed(1);
        wPrimeContext += ` (season best: ${(powerProfile.seasonWPrime/1000).toFixed(1)}kJ, ${wPrimeGap}kJ below)`;
      }
      if (powerProfile.wPrimeStatus) {
        wPrimeContext += ` - ${powerProfile.wPrimeStatus}`;
      }
    }

    let physioContext = "";
    if (powerProfile.vo2max) {
      physioContext += `\n- **VO2max (est):** ${powerProfile.vo2max.toFixed(1)} ml/kg/min`;
    }
    if (powerProfile.tteEstimate) {
      physioContext += ` | **TTE (est):** ~${powerProfile.tteEstimate}min`;
    }
    if (powerProfile.pMax) {
      physioContext += `\n- **pMax:** ${powerProfile.pMax}W`;
      if (powerProfile.seasonPMax && powerProfile.pMax < powerProfile.seasonPMax) {
        physioContext += ` (season best: ${powerProfile.seasonPMax}W)`;
      }
    }

    powerContext = `
**1c. Power Profile Analysis:**
- ${ftpContext}${wPrimeContext}${physioContext}
- **Peak Powers:** 5s=${powerProfile.peak5s}W | 30s=${powerProfile.peak30s}W | 1min=${powerProfile.peak1min}W | 2min=${powerProfile.peak2min}W | 5min=${powerProfile.peak5min}W | 8min=${powerProfile.peak8min}W | 20min=${powerProfile.peak20min}W | 60min=${powerProfile.peak60min || 'N/A'}W
- **Strengths:** ${powerProfile.strengths.length > 0 ? powerProfile.strengths.join(", ") : "Balanced profile"}
- **Weaknesses:** ${powerProfile.weaknesses.length > 0 ? powerProfile.weaknesses.join(", ") : "None identified"}
${powerProfile.recommendations.length > 0 ? `- **Training Recommendations:** ${powerProfile.recommendations.join("; ")}` : ''}
${powerProfile.climbingStrength ? `- **Note:** ${powerProfile.climbingStrength}` : ''}

**POWER PROFILE RULES:**
- Use current eFTP (${powerProfile.ftp}W) for zone calculations - this reflects current fitness.
- **W' (${powerProfile.wPrimeKj || 'N/A'}kJ)** represents anaerobic capacity. If low, include 30s-2min hard efforts to build it.
- **TTE** (time to exhaustion at FTP) indicates threshold endurance. Low TTE = prescribe longer threshold intervals.
- Peak powers are all-time bests; current capabilities may be lower due to seasonal fitness variation.
- Design intervals that target identified weaknesses when appropriate for the phase.
- For climbing goals, prioritize 5-20 minute power development.
`;
  }

  // Build wellness context string
  let wellnessContext = "";
  if (wellness && wellness.available) {
    const w = wellness.today;
    const avg = wellness.averages;

    wellnessContext = `
**1b. Recovery & Wellness Data (from Whoop/wearable):**
- **Recovery Status:** ${wellness.recoveryStatus}
- **Recommended Intensity Modifier:** ${(wellness.intensityModifier * 100).toFixed(0)}%
- **Sleep:** ${w.sleep ? w.sleep.toFixed(1) + 'h' : 'N/A'} (${wellness.sleepStatus}) | 7-day avg: ${avg.sleep ? avg.sleep.toFixed(1) + 'h' : 'N/A'}
- **HRV (rMSSD):** ${w.hrv || 'N/A'} ms | 7-day avg: ${avg.hrv ? avg.hrv.toFixed(0) : 'N/A'} ms
- **Resting HR:** ${w.restingHR || 'N/A'} bpm | 7-day avg: ${avg.restingHR ? avg.restingHR.toFixed(0) : 'N/A'} bpm
- **Whoop Recovery Score:** ${w.recovery != null ? w.recovery + '%' : 'N/A'}
${w.soreness ? `- **Soreness:** ${w.soreness}/5` : ''}
${w.fatigue ? `- **Fatigue:** ${w.fatigue}/5` : ''}
${w.stress ? `- **Stress:** ${w.stress}/5` : ''}
${w.mood ? `- **Mood:** ${w.mood}/5` : ''}

**CRITICAL RECOVERY RULES:**
- If Recovery Status is "Red (Strained)" or HRV is significantly below baseline: STRONGLY favor Endurance/Recovery workouts. VO2max/Threshold should score very low (1-3).
- If Recovery Status is "Yellow (Recovering)": Reduce interval intensity by 5-10%. Favor Tempo/SST over VO2max.
- If Recovery Status is "Green (Primed)": Full intensity is appropriate. High-intensity workouts can score higher.
- Poor sleep (<6h) should reduce recommendation scores for high-intensity work.
`;
  }

  // Build adaptive training context (RPE/Feel feedback)
  let adaptiveTrainingContext = "";
  if (adaptiveContext && adaptiveContext.available) {
    adaptiveTrainingContext = `
**1d. Adaptive Training (Athlete Feedback Analysis):**
${adaptiveContext.promptContext}
**ADAPTIVE TRAINING RULES:**
- If recommendation is EASIER: Reduce interval intensity by ${Math.abs(adaptiveContext.adaptation.intensityAdjustment)}%. Favor endurance/tempo over threshold/VO2max.
- If recommendation is HARDER: Athlete is handling load well. Can push intensity slightly higher.
- If recommendation is MAINTAIN: Current approach is appropriate. Continue as planned.
- Recent Feel scores indicate how the athlete is responding to training load. Low feel = accumulated fatigue.
- High RPE relative to workout type suggests the athlete may need more recovery.
`;
  }

  // Build cross-training context (strength, walks, swimming, etc.)
  let crossTrainingPromptContext = "";
  if (crossTrainingContext && crossTrainingContext.available) {
    crossTrainingPromptContext = crossTrainingContext.promptContext;
  }

  return `
You are an expert cycling coach using the logic of Coggan, Friel, and Seiler.
Generate a Zwift workout (.zwo) and evaluate its suitability.

**1a. Athlete Training Context:**
- **Goal:** ${phaseInfo.goalDescription || USER_SETTINGS.GOAL_DESCRIPTION}
- **Target Race:** In ${phaseInfo.weeksOut} weeks.
- **Current Phase:** "${phaseInfo.phaseName}"
- **Phase Focus:** ${phaseInfo.focus}
- **Current TSB:** ${summary.tsb_current.toFixed(1)}
- **Recent Load (Z5+):** ${summary.z5_recent_total > 1500 ? "High" : "Normal"}
${wellnessContext}${powerContext}${adaptiveTrainingContext}${crossTrainingPromptContext}
**2. Assignment: Design a "${type}" Workout**
- **Duration:** ${durationStr}. Design the workout to fit within this time window.
- **Structure:** Engaging (Pyramids, Over-Unders). NO boring steady states.
- **Intensity:** Adjust based on TSB AND Recovery Status.
  - If TSB < -20 OR Recovery is Red/Yellow, reduce intensity significantly.
  - Apply the Intensity Modifier (${wellness && wellness.available ? (wellness.intensityModifier * 100).toFixed(0) + '%' : '100%'}) to target power zones.

**3. REQUIRED ZWO FEATURES (Critical):**
- **Cadence:** You MUST specify target cadence for every interval using \`Cadence="85"\`.
- **Text Events (Messages):**
  - You MUST include motivational or instructional text messages.
  - **LANGUAGE: Messages MUST be in ENGLISH.** (Even if the user's language is different, Zwift works best with English text).
  - Nest them: \`<SteadyState ... ><TextEvent timeoffset="10" message="Keep pushing!"/></SteadyState>\`
  - **Workout Name:** The <name> tag MUST be exactly: "${zwiftDisplayName}" (Do NOT add "IntervalCoach_" prefix here).

**4. Evaluate Recommendation (1-10):**
- Logic: Based on **Current Phase**, **TSB**, AND **Recovery/Wellness Status**, is "${type}" the right choice today?
- A well-recovered athlete in Build phase doing Threshold = high score.
- A poorly-recovered athlete (Red status, low HRV) doing VO2max = very low score (1-3).
- Example: If Phase is "Base", VO2max should score low (unless maintenance). If Phase is "Peak", high volume SST should score low.

**Output Format (JSON Only):**
{
  "explanation": "Strategy explanation in **${analysisLang}**. Include how recovery status influenced the workout design.",
  "recommendation_score": (integer 1-10),
  "recommendation_reason": "Reason based on Phase(${phaseInfo.phaseName}), TSB, AND Recovery Status in **${analysisLang}**.",
  "xml": "<workout_file>...<author>IntervalCoach AI Coach</author><name>${zwiftDisplayName}</name>...valid xml...</workout_file>"
}
`;
}

// =========================================================
// 12b. HELPER: Run Prompt Construction
// =========================================================
function createRunPrompt(type, summary, phaseInfo, dateStr, duration, wellness, runningData, adaptiveContext, crossTrainingContext) {
  const langMap = { "ja": "Japanese", "en": "English", "es": "Spanish", "fr": "French", "nl": "Dutch" };
  const analysisLang = langMap[USER_SETTINGS.LANGUAGE] || "English";

  // Workout name for Intervals.icu
  const safeType = type.replace(/[^a-zA-Z0-9]/g, "");
  const workoutName = "IntervalCoach_" + safeType + "_" + dateStr;

  // Format duration string
  const durationStr = duration ? (duration.min + "-" + duration.max + " min") : "30-45 min";

  // Build running data context
  let runContext = "";
  if (runningData && runningData.available) {
    // Use Critical Speed (CS) as primary reference if available, otherwise threshold pace
    const primaryPace = runningData.criticalSpeed || runningData.thresholdPace || '5:30';
    const hasCriticalSpeed = runningData.criticalSpeed != null;

    // Build best efforts string
    let bestEffortsStr = "";
    if (runningData.bestEfforts && Object.keys(runningData.bestEfforts).length > 0) {
      const effortParts = [];
      if (runningData.bestEfforts[400]) effortParts.push("400m: " + runningData.bestEfforts[400].time + " (" + runningData.bestEfforts[400].pace + "/km)");
      if (runningData.bestEfforts[800]) effortParts.push("800m: " + runningData.bestEfforts[800].time + " (" + runningData.bestEfforts[800].pace + "/km)");
      if (runningData.bestEfforts[1500]) effortParts.push("1.5k: " + runningData.bestEfforts[1500].time + " (" + runningData.bestEfforts[1500].pace + "/km)");
      if (runningData.bestEfforts[3000]) effortParts.push("3k: " + runningData.bestEfforts[3000].time + " (" + runningData.bestEfforts[3000].pace + "/km)");
      if (runningData.bestEfforts[5000]) effortParts.push("5k: " + runningData.bestEfforts[5000].time + " (" + runningData.bestEfforts[5000].pace + "/km)");
      if (effortParts.length > 0) {
        bestEffortsStr = "\n- **Best Efforts (42 days):** " + effortParts.join(" | ");
      }
    }

    // Show gap to peak if season best is faster
    let peakGapStr = "";
    if (runningData.seasonBestCS && runningData.criticalSpeed && runningData.seasonBestCS !== runningData.criticalSpeed) {
      peakGapStr = " (Season best: " + runningData.seasonBestCS + "/km)";
    }

    runContext = `
**1c. Running Profile (Pace Curve Analysis):**
- **Critical Speed (CS):** ${runningData.criticalSpeed || 'N/A'} min/km${peakGapStr} ${hasCriticalSpeed ? '← Use this for zone calculations' : ''}
- **D' (Anaerobic Capacity):** ${runningData.dPrime ? runningData.dPrime.toFixed(0) + 'm' : 'N/A'}
- **Threshold Pace (set):** ${runningData.thresholdPace || 'N/A'} min/km
- **LTHR:** ${runningData.lthr || 'N/A'} bpm | **Max HR:** ${runningData.maxHr || 'N/A'} bpm${bestEffortsStr}

**RUNNING ZONE CALCULATIONS (based on CS ${primaryPace}/km):**
- **Z1 (Recovery):** ${primaryPace} + 1:00 to 1:30 (~${addPace(primaryPace, 60)} - ${addPace(primaryPace, 90)}/km)
- **Z2 (Endurance):** ${primaryPace} + 0:30 to 1:00 (~${addPace(primaryPace, 30)} - ${addPace(primaryPace, 60)}/km)
- **Z3 (Tempo):** ${primaryPace} + 0:10 to 0:20 (~${addPace(primaryPace, 10)} - ${addPace(primaryPace, 20)}/km)
- **Z4 (Threshold/CS):** At ${primaryPace}/km
- **Z5 (VO2max):** ${primaryPace} - 0:10 to 0:20 (~${subtractPace(primaryPace, 20)} - ${subtractPace(primaryPace, 10)}/km)
- **Z6 (Anaerobic):** ${primaryPace} - 0:30+ (~${subtractPace(primaryPace, 30)}/km or faster)

**CRITICAL NOTES:**
- Critical Speed (${primaryPace}/km) is the running equivalent of cycling FTP.
- D' (${runningData.dPrime ? runningData.dPrime.toFixed(0) + 'm' : 'N/A'}) represents anaerobic capacity - larger = better sprint/kick.
- Include warm-up (10-15 min Z1-Z2) and cool-down (5-10 min Z1).
- For intervals, specify target pace AND duration clearly.
`;
  } else {
    runContext = `
**1c. Running Profile:**
- No specific running data available. Use RPE (Rate of Perceived Exertion) for intensity guidance.
- Easy: RPE 3-4 (can hold conversation)
- Tempo: RPE 5-6 (challenging but sustainable)
- Threshold: RPE 7-8 (hard, 20-30 min sustainable)
- VO2max: RPE 9 (very hard, 3-6 min sustainable)
`;
  }

  // Build wellness context string
  let wellnessContext = "";
  if (wellness && wellness.available) {
    const w = wellness.today;
    const avg = wellness.averages;

    wellnessContext = `
**1b. Recovery & Wellness Data (from Whoop/wearable):**
- **Recovery Status:** ${wellness.recoveryStatus}
- **Recommended Intensity Modifier:** ${(wellness.intensityModifier * 100).toFixed(0)}%
- **Sleep:** ${w.sleep ? w.sleep.toFixed(1) + 'h' : 'N/A'} (${wellness.sleepStatus}) | 7-day avg: ${avg.sleep ? avg.sleep.toFixed(1) + 'h' : 'N/A'}
- **HRV (rMSSD):** ${w.hrv || 'N/A'} ms | 7-day avg: ${avg.hrv ? avg.hrv.toFixed(0) : 'N/A'} ms
- **Resting HR:** ${w.restingHR || 'N/A'} bpm | 7-day avg: ${avg.restingHR ? avg.restingHR.toFixed(0) : 'N/A'} bpm
- **Whoop Recovery Score:** ${w.recovery != null ? w.recovery + '%' : 'N/A'}
${w.soreness ? `- **Soreness:** ${w.soreness}/5` : ''}
${w.fatigue ? `- **Fatigue:** ${w.fatigue}/5` : ''}

**CRITICAL RECOVERY RULES:**
- If Recovery Status is "Red (Strained)": ONLY easy/recovery runs. No intervals.
- If Recovery Status is "Yellow (Recovering)": Reduce interval intensity. Favor tempo over VO2max.
- If Recovery Status is "Green (Primed)": Full intensity is appropriate.
- Running is higher impact than cycling - be MORE conservative with recovery.
`;
  }

  // Build adaptive training context (RPE/Feel feedback)
  let adaptiveTrainingContext = "";
  if (adaptiveContext && adaptiveContext.available) {
    adaptiveTrainingContext = `
**1d. Adaptive Training (Athlete Feedback Analysis):**
${adaptiveContext.promptContext}
**ADAPTIVE TRAINING RULES:**
- If recommendation is EASIER: Reduce intensity. Favor easy/recovery runs over intervals.
- If recommendation is HARDER: Athlete is handling load well. Can push pace slightly.
- If recommendation is MAINTAIN: Current approach is appropriate.
- Running has higher injury risk - be MORE conservative than cycling when feel is low.
`;
  }

  // Build cross-training context (strength, walks, swimming, etc.)
  let crossTrainingPromptContext = "";
  if (crossTrainingContext && crossTrainingContext.available) {
    crossTrainingPromptContext = crossTrainingContext.promptContext;
  }

  return `
You are an expert running coach using principles from Daniels, Pfitzinger, and modern training science.
Generate a running workout and evaluate its suitability.

**1a. Athlete Training Context:**
- **Goal:** ${phaseInfo.goalDescription || USER_SETTINGS.GOAL_DESCRIPTION}
- **Target Event:** In ${phaseInfo.weeksOut} weeks.
- **Current Phase:** "${phaseInfo.phaseName}"
- **Phase Focus:** ${phaseInfo.focus}
- **Current TSB (Training Stress Balance):** ${summary.tsb_current.toFixed(1)}
- **Note:** This is a RUNNING workout to complement cycling training.
${wellnessContext}${runContext}${adaptiveTrainingContext}${crossTrainingPromptContext}
**2. Assignment: Design a "${type}" Running Workout**
- **Duration:** ${durationStr}. Total workout time including warm-up and cool-down.
- **Type Guidance:**
  - Run_Easy: Recovery/easy run, mostly Z1-Z2, conversational pace
  - Run_Tempo: Sustained effort at tempo/Z3 pace, build aerobic capacity
  - Run_Intervals: High-intensity intervals (400m-1km repeats) with recovery jogs
  - Run_Recovery: Very easy, regeneration focus, never exceed Z2

**3. REQUIRED WORKOUT FORMAT:**
Provide the workout as a clear, structured description that can be followed on any watch/app.
Include:
- Warm-up phase (time and pace/effort)
- Main set (intervals with specific pace/effort and recovery)
- Cool-down phase (time and pace/effort)
- Total estimated distance (if possible)

**4. Evaluate Recommendation (1-10):**
- Consider: Current Phase, TSB, Recovery Status, and that this is cross-training for a cyclist
- Running when fatigued increases injury risk - be conservative
- In cycling Peak phase, running should be easy (maintain, don't build)
- In Base phase, running can be more structured

**Output Format (JSON Only):**
{
  "explanation": "Strategy explanation in **${analysisLang}**. Include how recovery status influenced the workout design.",
  "recommendation_score": (integer 1-10),
  "recommendation_reason": "Reason based on Phase(${phaseInfo.phaseName}), TSB, Recovery, and cross-training context in **${analysisLang}**.",
  "workoutDescription": "Structured workout description with warm-up, main set, cool-down. Use clear formatting."
}
`;
}

// =========================================================
// 13. HELPER: Send Email (Dynamic Language)
// =========================================================
function sendSmartSummaryEmail(summary, phaseInfo, workout, wellness, powerProfile) {
  const t = TRANSLATIONS[USER_SETTINGS.LANGUAGE] || TRANSLATIONS.en;

  // Add recovery indicator to subject based on status
  let recoveryTag = "";
  if (wellness && wellness.available) {
    if (wellness.recoveryStatus.includes("Green") || wellness.recoveryStatus.includes("Primed") || wellness.recoveryStatus.includes("Well Recovered")) {
      recoveryTag = "[GREEN] ";
    } else if (wellness.recoveryStatus.includes("Yellow") || wellness.recoveryStatus.includes("Normal")) {
      recoveryTag = "[YELLOW] ";
    } else if (wellness.recoveryStatus.includes("Red") || wellness.recoveryStatus.includes("Fatigued")) {
      recoveryTag = "[RED] ";
    }
  }

  const subject = t.subject_prefix + recoveryTag + workout.type + " (" + Utilities.formatDate(new Date(), SYSTEM_SETTINGS.TIMEZONE, "MM/dd") + ")";

  let body = `${t.greeting}\n\n`;

  // Phase & Goal Info
  body += `
===================================
${t.phase_title}: ${phaseInfo.phaseName}
(${t.weeks_to_goal}: ${phaseInfo.weeksOut}${t.weeks_unit})
${t.focus}: ${phaseInfo.focus}
===================================
${t.goal_section}
${phaseInfo.goalDescription || USER_SETTINGS.GOAL_DESCRIPTION}

${t.status}:
CTL: ${summary.ctl_90.toFixed(1)} / ATL: ${summary.atl ? summary.atl.toFixed(1) : 'N/A'} / TSB: ${summary.tsb_current.toFixed(1)}
`;

  // Add Power Profile Section
  if (powerProfile && powerProfile.available) {
    const currentEftp = powerProfile.currentEftp || powerProfile.eFTP;
    const wpkg = powerProfile.weight ? (powerProfile.ftp / powerProfile.weight).toFixed(2) : 'N/A';

    body += `
-----------------------------------
${t.power_profile_title || 'Power Profile'}
-----------------------------------
${t.current_eftp || 'Current eFTP'}: ${currentEftp || 'N/A'}W`;

    if (powerProfile.allTimeEftp && currentEftp && powerProfile.allTimeEftp > currentEftp) {
      body += ` (${t.all_time || 'All-time'}: ${powerProfile.allTimeEftp}W)`;
    }

    body += `
W/kg: ${wpkg}
${t.peak_powers || 'Peak Powers'}: 5s=${powerProfile.peak5s}W | 1min=${powerProfile.peak1min}W | 5min=${powerProfile.peak5min}W | 20min=${powerProfile.peak20min}W
${powerProfile.strengths && powerProfile.strengths.length > 0 ? `${t.strengths || 'Strengths'}: ${powerProfile.strengths.join(', ')}` : ''}
${powerProfile.weaknesses && powerProfile.weaknesses.length > 0 ? `${t.focus_areas || 'Focus Areas'}: ${powerProfile.weaknesses.join(', ')}` : ''}
`;
  }

  // Add Wellness/Recovery Section
  if (wellness && wellness.available) {
    const w = wellness.today;
    body += `
-----------------------------------
${t.recovery_title}
-----------------------------------
${t.recovery_status}: ${wellness.recoveryStatus}
${t.sleep}: ${w.sleep ? w.sleep.toFixed(1) + 'h' : 'N/A'} (${wellness.sleepStatus})
${t.hrv}: ${w.hrv || 'N/A'} ms (avg: ${wellness.averages.hrv ? wellness.averages.hrv.toFixed(0) : 'N/A'} ms)
${t.resting_hr}: ${w.restingHR || 'N/A'} bpm
${w.recovery != null ? `Whoop Recovery: ${w.recovery}%` : ''}
`;
  }

  body += `
-----------------------------------
${t.recommendation_title}
-----------------------------------
Workout: ${workout.type}

${t.why_title}
${workout.recommendationReason}

${t.strategy_title}
${workout.explanation}
`;

  // Add workout description for runs (the actual workout structure)
  if (workout.workoutDescription) {
    body += `
-----------------------------------
${t.workout_details || 'Workout Details'}
-----------------------------------
${workout.workoutDescription}
`;
  }

  body += `\n${t.footer}`;

  GmailApp.sendEmail(USER_SETTINGS.EMAIL_TO, subject, body, { name: "IntervalCoach", attachments: [workout.blob] });
  Logger.log("Email sent successfully.");
}

// =========================================================
// 11b. WEEKLY SUMMARY EMAIL
// =========================================================

/**
 * Send weekly training summary email
 * Aggregates the past 7 days of activities and sends a summary
 * Set up a weekly trigger (e.g., Sunday evening) to call this function
 */
function sendWeeklySummaryEmail() {
  const t = TRANSLATIONS[USER_SETTINGS.LANGUAGE] || TRANSLATIONS.en;

  // Fetch activities from the last 7 days
  const weekData = fetchWeeklyActivities(7);
  const prevWeekData = fetchWeeklyActivities(14, 7); // Previous week for comparison

  // Fetch current and previous week fitness metrics
  const fitnessMetrics = fetchFitnessMetrics();
  const prevWeekDate = new Date();
  prevWeekDate.setDate(prevWeekDate.getDate() - 7);
  const prevFitnessMetrics = fetchFitnessMetrics(prevWeekDate);

  // Fetch wellness/health data for current and previous week
  const wellnessRecords = fetchWellnessData(7);
  const wellnessSummary = createWellnessSummary(wellnessRecords);
  const prevWellnessRecords = fetchWellnessData(14, 7); // 14 days back to 7 days back
  const prevWellnessSummary = createWellnessSummary(prevWellnessRecords);

  // Fetch power profile (eFTP now comes from fitnessMetrics via wellness API)
  const powerProfile = fetchPowerCurve();

  // Fetch goals for context
  const goals = fetchUpcomingGoals();
  const phaseInfo = goals.available && goals.primaryGoal
    ? calculateTrainingPhase(goals.primaryGoal.date)
    : calculateTrainingPhase(USER_SETTINGS.TARGET_DATE);

  // Build email
  const today = new Date();
  const weekStart = new Date(today);
  weekStart.setDate(today.getDate() - 6);
  const dateRange = formatDateISO(weekStart) + " to " + formatDateISO(today);

  const subject = t.weekly_subject + " (" + Utilities.formatDate(today, SYSTEM_SETTINGS.TIMEZONE, "MM/dd") + ")";

  // Generate AI weekly insight with comparison data (eFTP now comes from fitnessMetrics)
  const aiInsight = generateWeeklyInsight(weekData, prevWeekData, fitnessMetrics, prevFitnessMetrics, wellnessSummary, prevWellnessSummary, fitnessMetrics.eftp, prevFitnessMetrics.eftp, phaseInfo, goals);

  let body = `${t.weekly_greeting}\n\n`;

  // AI-Generated Weekly Insight
  if (aiInsight) {
    body += `${aiInsight}\n\n`;
  }

  // Week Overview
  body += `===================================
${t.weekly_overview} (${dateRange})
===================================
${t.total_activities}: ${weekData.totalActivities}
  - ${t.rides}: ${weekData.rides}
  - ${t.runs}: ${weekData.runs}
${t.total_time}: ${formatDuration(weekData.totalTime)}
${t.total_tss}: ${weekData.totalTss.toFixed(0)}
${t.total_distance}: ${(weekData.totalDistance / 1000).toFixed(1)} km
`;

  // Comparison with previous week
  if (prevWeekData.totalActivities > 0) {
    const tssDiff = weekData.totalTss - prevWeekData.totalTss;
    const timeDiff = weekData.totalTime - prevWeekData.totalTime;
    const tssSign = tssDiff >= 0 ? "+" : "";
    const timeSign = timeDiff >= 0 ? "+" : "";

    body += `
-----------------------------------
${t.weekly_comparison}
-----------------------------------
TSS: ${tssSign}${tssDiff.toFixed(0)} (${prevWeekData.totalTss.toFixed(0)} → ${weekData.totalTss.toFixed(0)})
${t.total_time}: ${timeSign}${formatDuration(timeDiff)}
`;
  }

  // Fitness Progress with week-over-week comparison
  const ctlChange = formatChange(fitnessMetrics.ctl, prevFitnessMetrics.ctl, 1);
  const atlChange = formatChange(fitnessMetrics.atl, prevFitnessMetrics.atl, 1);
  const tsbChange = formatChange(fitnessMetrics.tsb, prevFitnessMetrics.tsb, 1);

  body += `
-----------------------------------
${t.weekly_fitness}
-----------------------------------
CTL (Fitness): ${fitnessMetrics.ctl.toFixed(1)}${ctlChange}
ATL (Fatigue): ${fitnessMetrics.atl.toFixed(1)}${atlChange}
TSB (Form): ${fitnessMetrics.tsb.toFixed(1)}${tsbChange}
${t.ramp_rate}: ${fitnessMetrics.rampRate ? fitnessMetrics.rampRate.toFixed(2) : 'N/A'}`;

  // Add eFTP if available with week-over-week comparison (from wellness/sportInfo)
  if (fitnessMetrics.eftp) {
    const eftpChange = formatChange(fitnessMetrics.eftp, prevFitnessMetrics.eftp, 0, 'W');
    body += `
eFTP: ${fitnessMetrics.eftp}W${eftpChange}`;
  } else if (powerProfile && powerProfile.available) {
    // Fallback to power curve if wellness doesn't have eFTP
    body += `
eFTP: ${powerProfile.currentEftp || powerProfile.ftp || 'N/A'}W`;
  }

  // Health & Recovery Section with week-over-week comparison
  if (wellnessSummary.available) {
    const prevAvg = prevWellnessSummary.available ? prevWellnessSummary.averages : {};
    const sleepChange = formatChange(wellnessSummary.averages.sleep, prevAvg.sleep, 1, 'h');
    const hrvChange = formatChange(wellnessSummary.averages.hrv, prevAvg.hrv, 0);
    const rhrChange = formatChange(wellnessSummary.averages.restingHR, prevAvg.restingHR, 0);
    const recoveryChange = formatChange(wellnessSummary.averages.recovery, prevAvg.recovery, 0, '%');

    body += `

-----------------------------------
${t.weekly_health}
-----------------------------------
${t.avg_sleep}: ${wellnessSummary.averages.sleep ? wellnessSummary.averages.sleep.toFixed(1) + 'h' : 'N/A'}${sleepChange}
${t.avg_hrv}: ${wellnessSummary.averages.hrv ? wellnessSummary.averages.hrv.toFixed(0) + ' ms' : 'N/A'}${hrvChange}
${t.avg_rhr}: ${wellnessSummary.averages.restingHR ? wellnessSummary.averages.restingHR.toFixed(0) + ' bpm' : 'N/A'}${rhrChange}
${t.avg_recovery}: ${wellnessSummary.averages.recovery ? wellnessSummary.averages.recovery.toFixed(0) + '%' : 'N/A'}${recoveryChange}`;
  }

  // Training Load Advice Section
  const loadAdvice = calculateTrainingLoadAdvice(fitnessMetrics, phaseInfo, goals);
  body += `

-----------------------------------
${t.training_load_title}
-----------------------------------
${t.target_ctl}: ${loadAdvice.currentCTL.toFixed(0)} → ${loadAdvice.targetCTL} (${loadAdvice.weeksToGoal} ${t.weeks_unit})
${t.weekly_tss_target}: ${loadAdvice.tssRange.min}-${loadAdvice.tssRange.max}
${t.daily_tss_range}: ${loadAdvice.dailyTSSRange.min}-${loadAdvice.dailyTSSRange.max}
${t.load_advice}: ${loadAdvice.loadAdvice}`;

  if (loadAdvice.warning) {
    body += `
⚠️ ${loadAdvice.warning}`;
  }

  // Phase & Goal info
  if (goals.available && goals.primaryGoal) {
    body += `
-----------------------------------
${t.phase_title}: ${phaseInfo.phaseName}
-----------------------------------
${t.goal_section}: ${goals.primaryGoal.name} (${goals.primaryGoal.date})
${t.weeks_to_goal}: ${phaseInfo.weeksOut}${t.weeks_unit}
${t.focus}: ${phaseInfo.focus}
`;
  }

  body += `\n${t.weekly_footer}`;

  GmailApp.sendEmail(USER_SETTINGS.EMAIL_TO, subject, body, { name: "IntervalCoach" });
  Logger.log("Weekly summary email sent successfully.");
}

// =========================================================
// MONTHLY PROGRESS REPORT
// =========================================================

/**
 * Fetch monthly progress data for a specific calendar month
 * @param {number} monthOffset - 0 = previous month, 1 = month before that, etc.
 * @returns {object} Monthly progress data with weekly breakdowns
 */
function fetchMonthlyProgressData(monthOffset = 0) {
  const today = new Date();

  // Calculate target month (monthOffset 0 = previous complete month)
  const targetMonth = new Date(today.getFullYear(), today.getMonth() - 1 - monthOffset, 1);
  const monthStart = new Date(targetMonth.getFullYear(), targetMonth.getMonth(), 1);
  const monthEnd = new Date(targetMonth.getFullYear(), targetMonth.getMonth() + 1, 0); // Last day of month

  const weeklyData = [];
  const numWeeks = Math.ceil((monthEnd.getDate() - monthStart.getDate() + 1) / 7);

  // Fetch data for each week in the month
  for (let w = 0; w < numWeeks; w++) {
    const weekStart = new Date(monthStart);
    weekStart.setDate(monthStart.getDate() + (w * 7));
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);

    // Don't go past end of month
    if (weekEnd > monthEnd) {
      weekEnd.setTime(monthEnd.getTime());
    }

    // Calculate days for fetchWeeklyActivities:
    // - daysInPeriod: number of days in this week (1-7)
    // - daysOffset: how many days before today the week ends
    const daysInPeriod = Math.ceil((weekEnd - weekStart) / (1000 * 60 * 60 * 24)) + 1;
    const daysOffset = Math.ceil((today - weekEnd) / (1000 * 60 * 60 * 24));
    const activities = fetchWeeklyActivities(daysInPeriod, daysOffset);

    // Fetch fitness metrics for the end of this week
    const fitnessMetrics = fetchFitnessMetrics(weekEnd);

    weeklyData.push({
      weekNumber: w + 1,
      weekEnd: formatDateISO(weekEnd),
      weekStart: formatDateISO(weekStart),
      activities: activities.totalActivities,
      rides: activities.rides,
      runs: activities.runs,
      totalTime: activities.totalTime,
      totalTss: activities.totalTss,
      totalDistance: activities.totalDistance,
      ctl: fitnessMetrics.ctl,
      atl: fitnessMetrics.atl,
      tsb: fitnessMetrics.tsb,
      eftp: fitnessMetrics.eftp
    });
  }

  // Calculate aggregates
  const totalActivities = weeklyData.reduce((sum, w) => sum + w.activities, 0);
  const totalTss = weeklyData.reduce((sum, w) => sum + w.totalTss, 0);
  const totalTime = weeklyData.reduce((sum, w) => sum + w.totalTime, 0);
  const weeksWithTraining = weeklyData.filter(w => w.activities > 0).length;

  // CTL progression (first week vs last week)
  const ctlStart = weeklyData[0].ctl;
  const ctlEnd = weeklyData[weeklyData.length - 1].ctl;
  const ctlChange = ctlEnd - ctlStart;

  // eFTP progression
  const eftpValues = weeklyData.map(w => w.eftp).filter(e => e != null);
  const eftpStart = eftpValues.length > 0 ? eftpValues[0] : null;
  const eftpEnd = eftpValues.length > 0 ? eftpValues[eftpValues.length - 1] : null;
  const eftpChange = (eftpStart && eftpEnd) ? eftpEnd - eftpStart : null;

  // Month name for display
  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
                      'July', 'August', 'September', 'October', 'November', 'December'];

  return {
    weeks: numWeeks,
    monthName: monthNames[monthStart.getMonth()],
    monthYear: monthStart.getFullYear(),
    periodStart: formatDateISO(monthStart),
    periodEnd: formatDateISO(monthEnd),
    weeklyData: weeklyData,
    totals: {
      activities: totalActivities,
      tss: totalTss,
      time: totalTime,
      avgWeeklyTss: totalTss / numWeeks,
      avgWeeklyTime: totalTime / numWeeks
    },
    fitness: {
      ctlStart: ctlStart,
      ctlEnd: ctlEnd,
      ctlChange: ctlChange,
      eftpStart: eftpStart,
      eftpEnd: eftpEnd,
      eftpChange: eftpChange
    },
    consistency: {
      weeksWithTraining: weeksWithTraining,
      consistencyPercent: Math.round((weeksWithTraining / numWeeks) * 100)
    }
  };
}

/**
 * Send monthly progress report email
 * Set up a monthly trigger (e.g., 1st of each month) to call this function
 * Compares the previous complete month with the month before that
 */
function sendMonthlyProgressEmail() {
  const t = TRANSLATIONS[USER_SETTINGS.LANGUAGE] || TRANSLATIONS.en;

  // Fetch data for previous month (offset 0) and month before that (offset 1)
  const currentMonth = fetchMonthlyProgressData(0);  // e.g., December
  const previousMonth = fetchMonthlyProgressData(1); // e.g., November

  // Fetch current goals for context
  const goals = fetchUpcomingGoals();
  const phaseInfo = goals.available && goals.primaryGoal
    ? calculateTrainingPhase(goals.primaryGoal.date)
    : calculateTrainingPhase(USER_SETTINGS.TARGET_DATE);

  // Generate AI insight for monthly trends (with comparison data)
  const aiInsight = generateMonthlyInsight(currentMonth, previousMonth, phaseInfo, goals);

  const subject = t.monthly_subject + " (" + currentMonth.monthName + " " + currentMonth.monthYear + ")";

  let body = `${t.monthly_greeting}\n\n`;

  // AI-Generated Monthly Insight
  if (aiInsight) {
    body += `${aiInsight}\n\n`;
  }

  // Period Overview
  body += `===================================
${currentMonth.monthName} ${currentMonth.monthYear}: ${currentMonth.periodStart} - ${currentMonth.periodEnd}
===================================\n`;

  // Month-over-Month Comparison Section
  const activityChange = currentMonth.totals.activities - previousMonth.totals.activities;
  const tssChange = currentMonth.totals.tss - previousMonth.totals.tss;
  const timeChange = currentMonth.totals.time - previousMonth.totals.time;
  const ctlChange = currentMonth.fitness.ctlEnd - previousMonth.fitness.ctlEnd;

  body += `
-----------------------------------
${t.monthly_comparison || 'Month-over-Month'}
-----------------------------------
${t.monthly_total_activities}: ${currentMonth.totals.activities} ${formatChange(activityChange, false)}
${t.monthly_total_tss || 'Total TSS'}: ${currentMonth.totals.tss.toFixed(0)} ${formatChange(tssChange, false)}
${t.monthly_total_hours || 'Total Time'}: ${formatDuration(currentMonth.totals.time)} ${formatChange(Math.round(timeChange / 60), false, 'min')}
CTL: ${currentMonth.fitness.ctlEnd.toFixed(1)} ${formatChange(ctlChange, true)}
`;

  // eFTP comparison
  if (currentMonth.fitness.eftpEnd && previousMonth.fitness.eftpEnd) {
    const eftpChange = currentMonth.fitness.eftpEnd - previousMonth.fitness.eftpEnd;
    body += `eFTP: ${currentMonth.fitness.eftpEnd}W ${formatChange(eftpChange, false, 'W')}
`;
  }

  // This Month's Weekly Breakdown
  body += `
-----------------------------------
${t.monthly_fitness_trend}
-----------------------------------
CTL: ${currentMonth.fitness.ctlStart.toFixed(1)} → ${currentMonth.fitness.ctlEnd.toFixed(1)}
`;

  // Weekly CTL breakdown (sparkline-like)
  body += `\n  Week:  `;
  currentMonth.weeklyData.forEach((w, i) => {
    body += `${i + 1}`.padStart(5);
  });
  body += `\n  CTL:   `;
  currentMonth.weeklyData.forEach(w => {
    body += `${w.ctl.toFixed(0)}`.padStart(5);
  });
  body += `\n`;

  // eFTP Trend within month
  if (currentMonth.fitness.eftpStart && currentMonth.fitness.eftpEnd) {
    body += `
-----------------------------------
${t.monthly_eftp_trend}
-----------------------------------
eFTP: ${currentMonth.fitness.eftpStart}W → ${currentMonth.fitness.eftpEnd}W
`;

    // Weekly eFTP breakdown
    body += `\n  Week:  `;
    currentMonth.weeklyData.forEach((w, i) => {
      body += `${i + 1}`.padStart(5);
    });
    body += `\n  eFTP:  `;
    currentMonth.weeklyData.forEach(w => {
      body += `${w.eftp || '-'}`.toString().padStart(5);
    });
    body += `\n`;
  }

  // Volume Section
  body += `
-----------------------------------
${t.monthly_volume}
-----------------------------------
${t.monthly_avg_weekly_tss}: ${currentMonth.totals.avgWeeklyTss.toFixed(0)}
${t.monthly_avg_weekly_hours}: ${formatDuration(currentMonth.totals.avgWeeklyTime)}
`;

  // Weekly TSS breakdown
  body += `\n  Week:  `;
  currentMonth.weeklyData.forEach((w, i) => {
    body += `${i + 1}`.padStart(5);
  });
  body += `\n  TSS:   `;
  currentMonth.weeklyData.forEach(w => {
    body += `${w.totalTss.toFixed(0)}`.padStart(5);
  });
  body += `\n`;

  // Consistency Section
  body += `
-----------------------------------
${t.monthly_consistency}
-----------------------------------
${t.monthly_weeks_trained}: ${currentMonth.consistency.weeksWithTraining}/${currentMonth.weeks} (${currentMonth.consistency.consistencyPercent}%)
`;

  // Goal Section
  if (goals.available && goals.primaryGoal) {
    body += `
-----------------------------------
${t.phase_title}: ${phaseInfo.phaseName}
-----------------------------------
${t.goal_section}: ${goals.primaryGoal.name} (${goals.primaryGoal.date})
${t.weeks_to_goal}: ${phaseInfo.weeksOut}${t.weeks_unit}
`;
  }

  body += `\n${t.monthly_footer}`;

  GmailApp.sendEmail(USER_SETTINGS.EMAIL_TO, subject, body, { name: "IntervalCoach" });
  Logger.log("Monthly progress report sent successfully.");
}

/**
 * Generate AI-powered monthly insight based on training trends
 */
function generateMonthlyInsight(currentMonth, previousMonth, phaseInfo, goals) {
  const language = USER_SETTINGS.LANGUAGE || 'en';

  // Calculate month-over-month changes
  const activityChange = currentMonth.totals.activities - previousMonth.totals.activities;
  const tssChange = currentMonth.totals.tss - previousMonth.totals.tss;
  const ctlChange = currentMonth.fitness.ctlEnd - previousMonth.fitness.ctlEnd;
  const eftpChange = (currentMonth.fitness.eftpEnd && previousMonth.fitness.eftpEnd)
    ? currentMonth.fitness.eftpEnd - previousMonth.fitness.eftpEnd : null;

  const prompt = `You are a friendly, expert cycling and running coach reviewing an athlete's monthly training progress for ${currentMonth.monthName} ${currentMonth.monthYear}.

THIS MONTH (${currentMonth.monthName}):
- Total Activities: ${currentMonth.totals.activities}
- Total TSS: ${currentMonth.totals.tss.toFixed(0)}
- Average Weekly TSS: ${currentMonth.totals.avgWeeklyTss.toFixed(0)}
- CTL at end of month: ${currentMonth.fitness.ctlEnd.toFixed(1)}
- eFTP: ${currentMonth.fitness.eftpEnd || 'N/A'}W
- Consistency: ${currentMonth.consistency.weeksWithTraining}/${currentMonth.weeks} weeks trained

PREVIOUS MONTH (${previousMonth.monthName}) - FOR COMPARISON:
- Total Activities: ${previousMonth.totals.activities}
- Total TSS: ${previousMonth.totals.tss.toFixed(0)}
- CTL at end of month: ${previousMonth.fitness.ctlEnd.toFixed(1)}
- eFTP: ${previousMonth.fitness.eftpEnd || 'N/A'}W

MONTH-OVER-MONTH CHANGES:
- Activities: ${activityChange >= 0 ? '+' : ''}${activityChange}
- TSS: ${tssChange >= 0 ? '+' : ''}${tssChange.toFixed(0)}
- CTL: ${ctlChange >= 0 ? '+' : ''}${ctlChange.toFixed(1)}
${eftpChange != null ? '- eFTP: ' + (eftpChange >= 0 ? '+' : '') + eftpChange + 'W' : ''}

WEEKLY BREAKDOWN THIS MONTH (TSS per week):
${currentMonth.weeklyData.map((w, i) => `Week ${i + 1}: ${w.totalTss.toFixed(0)} TSS, CTL ${w.ctl.toFixed(0)}`).join('\n')}

TRAINING PHASE: ${phaseInfo.phaseName}
GOAL: ${goals.available && goals.primaryGoal ? goals.primaryGoal.name + ' (' + goals.primaryGoal.date + ')' : 'General fitness'}
WEEKS TO GOAL: ${phaseInfo.weeksOut}

Write a personalized monthly progress summary (3-4 sentences) in ${language === 'nl' ? 'Dutch' : language === 'ja' ? 'Japanese' : language === 'es' ? 'Spanish' : language === 'fr' ? 'French' : 'English'}.

Include:
1. Overall assessment of this month compared to last month
2. Comment on fitness progression (CTL trend, eFTP changes)
3. One key observation or recommendation
4. Brief encouragement based on progress toward their goal

Keep it conversational, insightful, and motivating. Do NOT wrap your response in quotes.`;

  try {
    const response = callGeminiAPIText(prompt);
    if (response) {
      // Remove surrounding quotes if present
      let text = response.trim();
      if ((text.startsWith('"') && text.endsWith('"')) || (text.startsWith("'") && text.endsWith("'"))) {
        text = text.slice(1, -1);
      }
      return text;
    }
  } catch (e) {
    Logger.log("Error generating monthly insight: " + e.toString());
  }

  return null;
}

/**
 * Test function for monthly progress report
 */
function testMonthlyProgress() {
  Logger.log("=== MONTHLY PROGRESS TEST ===");

  // Fetch current month (previous complete month) and previous month
  const currentMonth = fetchMonthlyProgressData(0);
  const previousMonth = fetchMonthlyProgressData(1);

  Logger.log("\n=== " + currentMonth.monthName + " " + currentMonth.monthYear + " ===");
  Logger.log("Period: " + currentMonth.periodStart + " to " + currentMonth.periodEnd);

  Logger.log("\n--- Month-over-Month Comparison ---");
  Logger.log("vs " + previousMonth.monthName + " " + previousMonth.monthYear);
  const activityChange = currentMonth.totals.activities - previousMonth.totals.activities;
  const tssChange = currentMonth.totals.tss - previousMonth.totals.tss;
  const ctlChange = currentMonth.fitness.ctlEnd - previousMonth.fitness.ctlEnd;
  Logger.log("Activities: " + currentMonth.totals.activities + " (" + (activityChange >= 0 ? '+' : '') + activityChange + ")");
  Logger.log("Total TSS: " + currentMonth.totals.tss.toFixed(0) + " (" + (tssChange >= 0 ? '+' : '') + tssChange.toFixed(0) + ")");
  Logger.log("CTL: " + currentMonth.fitness.ctlEnd.toFixed(1) + " (" + (ctlChange >= 0 ? '+' : '') + ctlChange.toFixed(1) + ")");
  if (currentMonth.fitness.eftpEnd && previousMonth.fitness.eftpEnd) {
    const eftpChange = currentMonth.fitness.eftpEnd - previousMonth.fitness.eftpEnd;
    Logger.log("eFTP: " + currentMonth.fitness.eftpEnd + "W (" + (eftpChange >= 0 ? '+' : '') + eftpChange + "W)");
  }

  Logger.log("\n--- This Month's Fitness Trend ---");
  Logger.log("CTL: " + currentMonth.fitness.ctlStart.toFixed(1) + " → " + currentMonth.fitness.ctlEnd.toFixed(1));
  if (currentMonth.fitness.eftpStart) {
    Logger.log("eFTP: " + currentMonth.fitness.eftpStart + "W → " + currentMonth.fitness.eftpEnd + "W");
  }

  Logger.log("\n--- Weekly Breakdown ---");
  currentMonth.weeklyData.forEach((w, i) => {
    Logger.log("Week " + (i + 1) + ": " + w.activities + " activities, " + w.totalTss.toFixed(0) + " TSS, CTL " + w.ctl.toFixed(1) + ", eFTP " + (w.eftp || 'N/A'));
  });

  Logger.log("\n--- Totals ---");
  Logger.log("Total Activities: " + currentMonth.totals.activities);
  Logger.log("Total TSS: " + currentMonth.totals.tss.toFixed(0));
  Logger.log("Avg Weekly TSS: " + currentMonth.totals.avgWeeklyTss.toFixed(0));
  Logger.log("Avg Weekly Time: " + formatDuration(currentMonth.totals.avgWeeklyTime));

  Logger.log("\n--- Consistency ---");
  Logger.log("Weeks Trained: " + currentMonth.consistency.weeksWithTraining + "/" + currentMonth.weeks + " (" + currentMonth.consistency.consistencyPercent + "%)");
}

/**
 * Generate AI-powered weekly insight based on training data
 */
function generateWeeklyInsight(weekData, prevWeekData, fitnessMetrics, prevFitnessMetrics, wellnessSummary, prevWellnessSummary, currentEftp, prevWeekEftp, phaseInfo, goals) {
  const language = USER_SETTINGS.LANGUAGE || 'en';

  // Calculate changes
  const ctlChange = fitnessMetrics.ctl - (prevFitnessMetrics.ctl || 0);
  const tsbChange = fitnessMetrics.tsb - (prevFitnessMetrics.tsb || 0);
  const eftpChange = (currentEftp && prevWeekEftp) ? currentEftp - prevWeekEftp : null;

  const prevAvg = prevWellnessSummary && prevWellnessSummary.available ? prevWellnessSummary.averages : {};
  const currAvg = wellnessSummary && wellnessSummary.available ? wellnessSummary.averages : {};
  const sleepChange = (currAvg.sleep && prevAvg.sleep) ? currAvg.sleep - prevAvg.sleep : null;
  const hrvChange = (currAvg.hrv && prevAvg.hrv) ? currAvg.hrv - prevAvg.hrv : null;

  const prompt = `You are a friendly, expert cycling and running coach reviewing an athlete's weekly training.

ATHLETE'S WEEK DATA:
- Activities: ${weekData.totalActivities} (${weekData.rides} rides, ${weekData.runs} runs)
- Total Time: ${Math.round(weekData.totalTime / 60)} minutes
- Total TSS: ${weekData.totalTss.toFixed(0)}
- Total Distance: ${(weekData.totalDistance / 1000).toFixed(1)} km

PREVIOUS WEEK:
- Activities: ${prevWeekData.totalActivities}
- Total TSS: ${prevWeekData.totalTss.toFixed(0)}

FITNESS METRICS (current → change vs last week):
- CTL (Fitness): ${fitnessMetrics.ctl.toFixed(1)} (${ctlChange >= 0 ? '+' : ''}${ctlChange.toFixed(1)})
- ATL (Fatigue): ${fitnessMetrics.atl.toFixed(1)}
- TSB (Form): ${fitnessMetrics.tsb.toFixed(1)} (${tsbChange >= 0 ? '+' : ''}${tsbChange.toFixed(1)})
- Ramp Rate: ${fitnessMetrics.rampRate ? fitnessMetrics.rampRate.toFixed(2) : 'N/A'}
- eFTP: ${currentEftp || 'N/A'}W${eftpChange !== null ? ' (' + (eftpChange >= 0 ? '+' : '') + eftpChange + 'W)' : ''}

WELLNESS (7-day averages → change vs last week):
- Sleep: ${currAvg.sleep ? currAvg.sleep.toFixed(1) + 'h' : 'N/A'}${sleepChange !== null ? ' (' + (sleepChange >= 0 ? '+' : '') + sleepChange.toFixed(1) + 'h)' : ''}
- HRV: ${currAvg.hrv ? currAvg.hrv.toFixed(0) + ' ms' : 'N/A'}${hrvChange !== null ? ' (' + (hrvChange >= 0 ? '+' : '') + hrvChange.toFixed(0) + ')' : ''}
- Resting HR: ${currAvg.restingHR ? currAvg.restingHR.toFixed(0) + ' bpm' : 'N/A'}

TRAINING PHASE: ${phaseInfo.phaseName}
GOAL: ${goals.available && goals.primaryGoal ? goals.primaryGoal.name + ' (' + goals.primaryGoal.date + ')' : 'General fitness'}
WEEKS TO GOAL: ${phaseInfo.weeksOut}

Write a brief, personalized weekly summary (3-4 sentences max) in ${language === 'nl' ? 'Dutch' : language === 'ja' ? 'Japanese' : language === 'es' ? 'Spanish' : language === 'fr' ? 'French' : 'English'}.

Include:
1. Acknowledge their training effort this week
2. Comment on significant changes: fitness (CTL/eFTP trends), form (TSB), or recovery (HRV/sleep)
3. One actionable insight based on the data trends
4. Brief encouragement for the upcoming week based on their phase

Keep it conversational, supportive, and concise. Do not use bullet points or headers. Just write natural sentences.`;

  try {
    const response = callGeminiAPIText(prompt);
    if (response) {
      return response.trim();
    }
  } catch (e) {
    Logger.log("Error generating weekly insight: " + e.toString());
  }

  return null;
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
      if (data.candidates &&
          data.candidates[0] &&
          data.candidates[0].content &&
          data.candidates[0].content.parts &&
          data.candidates[0].content.parts[0]) {
        return data.candidates[0].content.parts[0].text;
      } else {
        Logger.log("Gemini API: Unexpected response structure: " + JSON.stringify(data).substring(0, 500));
      }
    } else {
      Logger.log("Gemini API error " + responseCode + ": " + responseText.substring(0, 500));
    }
  } catch (e) {
    Logger.log("Error calling Gemini API for text: " + e.toString());
  }

  return null;
}

/**
 * Fetch activities for a given period
 * @param {number} daysBack - How many days back to start
 * @param {number} daysOffset - Offset from today (default 0)
 * @returns {object} Aggregated activity data
 */
function fetchWeeklyActivities(daysBack, daysOffset = 0) {
  const today = new Date();
  const to = new Date(today);
  to.setDate(today.getDate() - daysOffset);
  const from = new Date(to);
  from.setDate(to.getDate() - daysBack + 1);

  const url = `https://intervals.icu/api/v1/athlete/0/activities?oldest=${formatDateISO(from)}&newest=${formatDateISO(to)}`;

  const result = {
    totalActivities: 0,
    rides: 0,
    runs: 0,
    totalTime: 0,      // in seconds
    totalTss: 0,
    totalDistance: 0,  // in meters
    activities: []
  };

  try {
    const response = UrlFetchApp.fetch(url, {
      headers: { "Authorization": getIcuAuthHeader() },
      muteHttpExceptions: true
    });

    if (response.getResponseCode() === 200) {
      const activities = JSON.parse(response.getContentText());

      activities.forEach(function(a) {
        result.totalActivities++;
        result.totalTime += a.moving_time || 0;
        result.totalTss += a.icu_training_load || 0;
        result.totalDistance += a.distance || 0;

        if (a.type === 'Ride' || a.type === 'VirtualRide') {
          result.rides++;
        } else if (a.type === 'Run' || a.type === 'VirtualRun') {
          result.runs++;
        }

        result.activities.push({
          date: a.start_date_local,
          name: a.name,
          type: a.type,
          duration: a.moving_time,
          tss: a.icu_training_load,
          distance: a.distance
        });
      });
    }
  } catch (e) {
    Logger.log("Error fetching weekly activities: " + e.toString());
  }

  return result;
}

/**
 * Format duration in seconds to human readable string
 * @param {number} seconds - Duration in seconds
 * @returns {string} Formatted duration (e.g., "5h 30m")
 */
function formatDuration(seconds) {
  if (seconds === 0) return "0m";
  const hours = Math.floor(Math.abs(seconds) / 3600);
  const minutes = Math.floor((Math.abs(seconds) % 3600) / 60);
  const sign = seconds < 0 ? "-" : "";

  if (hours > 0) {
    return `${sign}${hours}h ${minutes}m`;
  }
  return `${sign}${minutes}m`;
}

/**
 * Format a change value with sign and optional unit
 * @param {number} current - Current value
 * @param {number} previous - Previous value
 * @param {number} decimals - Number of decimal places
 * @param {string} unit - Unit to append (e.g., "h", "ms", "%")
 * @returns {string} Formatted change (e.g., "+2.1" or "↑ 2.1")
 */
function formatChange(current, previous, decimals = 1, unit = '') {
  if (previous == null || current == null) return '';
  const diff = current - previous;
  const sign = diff >= 0 ? '+' : '';
  return ` (${sign}${diff.toFixed(decimals)}${unit})`;
}

/**
 * Test function for weekly summary
 */
function testWeeklySummary() {
  Logger.log("=== WEEKLY SUMMARY TEST ===");

  const weekData = fetchWeeklyActivities(7);
  Logger.log("This Week:");
  Logger.log("  Activities: " + weekData.totalActivities);
  Logger.log("  Rides: " + weekData.rides);
  Logger.log("  Runs: " + weekData.runs);
  Logger.log("  Total Time: " + formatDuration(weekData.totalTime));
  Logger.log("  Total TSS: " + weekData.totalTss.toFixed(0));
  Logger.log("  Total Distance: " + (weekData.totalDistance / 1000).toFixed(1) + " km");

  const prevWeekData = fetchWeeklyActivities(14, 7);
  Logger.log("\nPrevious Week:");
  Logger.log("  Activities: " + prevWeekData.totalActivities);
  Logger.log("  Total TSS: " + prevWeekData.totalTss.toFixed(0));

  Logger.log("\nTo send the actual email, run sendWeeklySummaryEmail()");
}

// =========================================================
// 12. ADAPTIVE TRAINING
// =========================================================

/**
 * Fetch recent activities with RPE and Feel feedback
 * @param {number} days - Number of days to look back (default 14)
 * @returns {object} Activities with feedback data
 */
function fetchRecentActivityFeedback(days = 14) {
  const today = new Date();
  const from = new Date(today);
  from.setDate(today.getDate() - days);

  const url = `https://intervals.icu/api/v1/athlete/0/activities?oldest=${formatDateISO(from)}&newest=${formatDateISO(today)}`;

  const result = {
    activities: [],
    summary: {
      totalWithFeedback: 0,
      avgRpe: null,
      avgFeel: null,
      rpeDistribution: { easy: 0, moderate: 0, hard: 0, veryHard: 0 },
      feelDistribution: { bad: 0, poor: 0, okay: 0, good: 0, great: 0 }
    }
  };

  try {
    const response = UrlFetchApp.fetch(url, {
      headers: { "Authorization": getIcuAuthHeader() },
      muteHttpExceptions: true
    });

    if (response.getResponseCode() === 200) {
      const activities = JSON.parse(response.getContentText());

      let totalRpe = 0;
      let rpeCount = 0;
      let totalFeel = 0;
      let feelCount = 0;

      activities.forEach(function(a) {
        // Only include cycling and running activities
        if (a.type === 'Ride' || a.type === 'VirtualRide' || a.type === 'Run' || a.type === 'VirtualRun') {
          const activity = {
            date: a.start_date_local,
            name: a.name,
            type: a.type,
            duration: a.moving_time,
            tss: a.icu_training_load || 0,
            intensity: a.icu_intensity || null,
            rpe: a.icu_rpe || null,
            feel: a.feel || null
          };

          result.activities.push(activity);

          // Track RPE (1-10 scale)
          if (a.icu_rpe != null) {
            totalRpe += a.icu_rpe;
            rpeCount++;
            if (a.icu_rpe <= 4) result.summary.rpeDistribution.easy++;
            else if (a.icu_rpe <= 6) result.summary.rpeDistribution.moderate++;
            else if (a.icu_rpe <= 8) result.summary.rpeDistribution.hard++;
            else result.summary.rpeDistribution.veryHard++;
          }

          // Track Feel (1-5 scale: 1=Bad, 2=Poor, 3=Okay, 4=Good, 5=Great)
          if (a.feel != null) {
            totalFeel += a.feel;
            feelCount++;
            if (a.feel === 1) result.summary.feelDistribution.bad++;
            else if (a.feel === 2) result.summary.feelDistribution.poor++;
            else if (a.feel === 3) result.summary.feelDistribution.okay++;
            else if (a.feel === 4) result.summary.feelDistribution.good++;
            else if (a.feel === 5) result.summary.feelDistribution.great++;
          }
        }
      });

      result.summary.totalWithFeedback = Math.max(rpeCount, feelCount);
      result.summary.avgRpe = rpeCount > 0 ? totalRpe / rpeCount : null;
      result.summary.avgFeel = feelCount > 0 ? totalFeel / feelCount : null;
    }
  } catch (e) {
    Logger.log("Error fetching activity feedback: " + e.toString());
  }

  return result;
}

/**
 * Analyze recent feedback to determine training adaptation recommendation
 * @param {object} feedback - Result from fetchRecentActivityFeedback
 * @returns {object} Adaptive training recommendation
 */
function analyzeTrainingAdaptation(feedback) {
  const result = {
    recommendation: "maintain", // "easier", "maintain", "harder"
    confidenceLevel: "low",     // "low", "medium", "high"
    intensityAdjustment: 0,     // -10 to +10 (percentage adjustment)
    reasoning: [],
    feedbackQuality: "insufficient"
  };

  // Need at least 3 activities with feedback for meaningful analysis
  if (feedback.summary.totalWithFeedback < 3) {
    result.reasoning.push("Insufficient feedback data (< 3 activities with RPE/Feel)");
    return result;
  }

  result.feedbackQuality = feedback.summary.totalWithFeedback >= 7 ? "good" : "moderate";
  result.confidenceLevel = feedback.summary.totalWithFeedback >= 7 ? "high" : "medium";

  const avgRpe = feedback.summary.avgRpe;
  const avgFeel = feedback.summary.avgFeel;
  const feelDist = feedback.summary.feelDistribution;
  const rpeDist = feedback.summary.rpeDistribution;

  // Analyze Feel distribution
  const negativeFeels = feelDist.bad + feelDist.poor;
  const positiveFeels = feelDist.good + feelDist.great;
  const totalFeels = negativeFeels + feelDist.okay + positiveFeels;

  // Analyze RPE distribution
  const hardWorkouts = rpeDist.hard + rpeDist.veryHard;
  const easyWorkouts = rpeDist.easy;
  const totalRpe = easyWorkouts + rpeDist.moderate + hardWorkouts;

  // Decision logic
  let adjustmentScore = 0;

  // Factor 1: Average Feel (target: 3.5-4.0)
  if (avgFeel != null) {
    if (avgFeel < 2.5) {
      adjustmentScore -= 2;
      result.reasoning.push(`Low average feel (${avgFeel.toFixed(1)}/5) suggests overreaching`);
    } else if (avgFeel < 3.0) {
      adjustmentScore -= 1;
      result.reasoning.push(`Below-target feel (${avgFeel.toFixed(1)}/5) suggests accumulated fatigue`);
    } else if (avgFeel > 4.0) {
      adjustmentScore += 1;
      result.reasoning.push(`High feel scores (${avgFeel.toFixed(1)}/5) indicate good recovery`);
    } else {
      result.reasoning.push(`Feel scores are in target range (${avgFeel.toFixed(1)}/5)`);
    }
  }

  // Factor 2: Average RPE relative to workout intent
  if (avgRpe != null) {
    if (avgRpe > 8.0) {
      adjustmentScore -= 1;
      result.reasoning.push(`High average RPE (${avgRpe.toFixed(1)}/10) suggests workouts feel harder than intended`);
    } else if (avgRpe < 5.0) {
      adjustmentScore += 1;
      result.reasoning.push(`Low average RPE (${avgRpe.toFixed(1)}/10) suggests capacity for more intensity`);
    }
  }

  // Factor 3: Proportion of negative feels
  if (totalFeels > 0 && negativeFeels / totalFeels > 0.4) {
    adjustmentScore -= 1;
    result.reasoning.push(`High proportion of negative feels (${Math.round(negativeFeels/totalFeels*100)}%)`);
  }

  // Factor 4: Recent trend (look at last 3 activities)
  const recentActivities = feedback.activities.slice(0, 3);
  const recentWithFeel = recentActivities.filter(a => a.feel != null);
  if (recentWithFeel.length >= 2) {
    const recentAvgFeel = recentWithFeel.reduce((sum, a) => sum + a.feel, 0) / recentWithFeel.length;
    if (recentAvgFeel < 2.5) {
      adjustmentScore -= 1;
      result.reasoning.push(`Recent workouts trending negative (last ${recentWithFeel.length} avg: ${recentAvgFeel.toFixed(1)})`);
    } else if (recentAvgFeel > 4.0 && avgFeel != null && recentAvgFeel > avgFeel) {
      adjustmentScore += 0.5;
      result.reasoning.push(`Recent workouts trending positive`);
    }
  }

  // Convert score to recommendation
  if (adjustmentScore <= -2) {
    result.recommendation = "easier";
    result.intensityAdjustment = -10;
  } else if (adjustmentScore <= -1) {
    result.recommendation = "easier";
    result.intensityAdjustment = -5;
  } else if (adjustmentScore >= 2) {
    result.recommendation = "harder";
    result.intensityAdjustment = 5;
  } else if (adjustmentScore >= 1) {
    result.recommendation = "harder";
    result.intensityAdjustment = 3;
  } else {
    result.recommendation = "maintain";
    result.intensityAdjustment = 0;
  }

  return result;
}

/**
 * Get adaptive training context for workout generation
 * @returns {object} Adaptive context with recommendation and summary
 */
function getAdaptiveTrainingContext() {
  const feedback = fetchRecentActivityFeedback(14);
  const adaptation = analyzeTrainingAdaptation(feedback);

  return {
    available: feedback.summary.totalWithFeedback >= 3,
    feedback: {
      activitiesAnalyzed: feedback.activities.length,
      activitiesWithFeedback: feedback.summary.totalWithFeedback,
      avgRpe: feedback.summary.avgRpe,
      avgFeel: feedback.summary.avgFeel,
      feelDistribution: feedback.summary.feelDistribution,
      rpeDistribution: feedback.summary.rpeDistribution
    },
    adaptation: adaptation,
    // Generate a text summary for the AI prompt
    promptContext: generateAdaptivePromptContext(feedback, adaptation)
  };
}

/**
 * Generate text context for AI workout generation prompt
 */
function generateAdaptivePromptContext(feedback, adaptation) {
  if (feedback.summary.totalWithFeedback < 3) {
    return "No recent workout feedback available (RPE/Feel not logged).";
  }

  const feelMap = { 1: 'Bad', 2: 'Poor', 3: 'Okay', 4: 'Good', 5: 'Great' };
  let context = `RECENT WORKOUT FEEDBACK (last 14 days, ${feedback.summary.totalWithFeedback} workouts with data):\n`;

  if (feedback.summary.avgFeel != null) {
    context += `- Average Feel: ${feedback.summary.avgFeel.toFixed(1)}/5 (${feelMap[Math.round(feedback.summary.avgFeel)] || 'N/A'})\n`;
  }
  if (feedback.summary.avgRpe != null) {
    context += `- Average RPE: ${feedback.summary.avgRpe.toFixed(1)}/10\n`;
  }

  // Feel distribution
  const fd = feedback.summary.feelDistribution;
  context += `- Feel distribution: ${fd.great} Great, ${fd.good} Good, ${fd.okay} Okay, ${fd.poor} Poor, ${fd.bad} Bad\n`;

  // Adaptation recommendation
  context += `\nADAPTIVE RECOMMENDATION: ${adaptation.recommendation.toUpperCase()}\n`;
  context += `- Confidence: ${adaptation.confidenceLevel}\n`;
  if (adaptation.intensityAdjustment !== 0) {
    context += `- Suggested intensity adjustment: ${adaptation.intensityAdjustment > 0 ? '+' : ''}${adaptation.intensityAdjustment}%\n`;
  }
  context += `- Reasoning:\n`;
  adaptation.reasoning.forEach(r => {
    context += `  • ${r}\n`;
  });

  return context;
}

/**
 * Test function for adaptive training
 */
function testAdaptiveTraining() {
  Logger.log("=== ADAPTIVE TRAINING TEST ===");

  const feedback = fetchRecentActivityFeedback(14);

  Logger.log("\n--- Recent Activities with Feedback ---");
  Logger.log("Total activities: " + feedback.activities.length);
  Logger.log("Activities with feedback: " + feedback.summary.totalWithFeedback);

  if (feedback.summary.avgRpe != null) {
    Logger.log("Average RPE: " + feedback.summary.avgRpe.toFixed(1) + "/10");
  }
  if (feedback.summary.avgFeel != null) {
    const feelMap = { 1: 'Bad', 2: 'Poor', 3: 'Okay', 4: 'Good', 5: 'Great' };
    Logger.log("Average Feel: " + feedback.summary.avgFeel.toFixed(1) + "/5 (" + (feelMap[Math.round(feedback.summary.avgFeel)] || 'N/A') + ")");
  }

  Logger.log("\n--- Feel Distribution ---");
  const fd = feedback.summary.feelDistribution;
  Logger.log("Great (5): " + fd.great);
  Logger.log("Good (4): " + fd.good);
  Logger.log("Okay (3): " + fd.okay);
  Logger.log("Poor (2): " + fd.poor);
  Logger.log("Bad (1): " + fd.bad);

  Logger.log("\n--- RPE Distribution ---");
  const rd = feedback.summary.rpeDistribution;
  Logger.log("Easy (1-4): " + rd.easy);
  Logger.log("Moderate (5-6): " + rd.moderate);
  Logger.log("Hard (7-8): " + rd.hard);
  Logger.log("Very Hard (9-10): " + rd.veryHard);

  Logger.log("\n--- Recent Activities Detail ---");
  feedback.activities.slice(0, 5).forEach((a, i) => {
    Logger.log((i + 1) + ". " + a.date.substring(0, 10) + " - " + a.name);
    Logger.log("   Type: " + a.type + ", TSS: " + (a.tss || 'N/A'));
    Logger.log("   RPE: " + (a.rpe || 'N/A') + ", Feel: " + (a.feel || 'N/A'));
  });

  const adaptation = analyzeTrainingAdaptation(feedback);

  Logger.log("\n--- Adaptation Analysis ---");
  Logger.log("Recommendation: " + adaptation.recommendation.toUpperCase());
  Logger.log("Confidence: " + adaptation.confidenceLevel);
  Logger.log("Intensity adjustment: " + (adaptation.intensityAdjustment > 0 ? '+' : '') + adaptation.intensityAdjustment + "%");
  Logger.log("Feedback quality: " + adaptation.feedbackQuality);

  Logger.log("\nReasoning:");
  adaptation.reasoning.forEach(r => {
    Logger.log("  - " + r);
  });

  Logger.log("\n--- Prompt Context for AI ---");
  const context = getAdaptiveTrainingContext();
  Logger.log(context.promptContext);
}

// =========================================================
// 12b. CROSS-TRAINING INTEGRATION (Strength, Walks, Other Activities)
// =========================================================

/**
 * Activity type categories for cross-training impact
 */
const CROSS_TRAINING_CATEGORIES = {
  strength: {
    types: ['WeightTraining', 'Crossfit'],
    keywords: ['strength', 'weight', 'gym', 'krachttraining', 'crossfit', 'lifting'],
    impactFactor: 1.0,  // Full impact on cycling
    description: 'Strength Training'
  },
  walking: {
    types: ['Walk', 'Hike'],
    keywords: ['walk', 'wandelen', 'hike', 'hiking'],
    impactFactor: 0.3,  // Lower impact - mostly recovery
    description: 'Walking/Hiking'
  },
  swimming: {
    types: ['Swim'],
    keywords: ['swim', 'zwemmen', 'pool'],
    impactFactor: 0.5,  // Moderate - good cross-training, low leg impact
    description: 'Swimming'
  },
  yoga: {
    types: ['Yoga'],
    keywords: ['yoga', 'stretching', 'pilates'],
    impactFactor: 0.2,  // Low impact - mostly recovery
    description: 'Yoga/Stretching'
  },
  other: {
    types: ['Workout', 'Other'],
    keywords: [],
    impactFactor: 0.5,  // Default moderate impact
    description: 'Other Activity'
  }
};

/**
 * Categorize an activity by type
 */
function categorizeActivity(activity) {
  const type = activity.type || '';
  const name = (activity.name || '').toLowerCase();

  for (const [category, config] of Object.entries(CROSS_TRAINING_CATEGORIES)) {
    // Check by activity type
    if (config.types.includes(type)) {
      return { category, ...config };
    }
    // Check by name keywords
    for (const keyword of config.keywords) {
      if (name.includes(keyword)) {
        return { category, ...config };
      }
    }
  }

  return null;  // Not a cross-training activity
}

/**
 * Fetch recent cross-training activities (non-cycling, non-running)
 * @param {number} days - Number of days to look back (default 5)
 * @returns {object} Cross-training data with impact assessment
 */
function fetchRecentCrossTraining(days = 5) {
  const today = new Date();
  const from = new Date(today);
  from.setDate(today.getDate() - days);

  const url = `https://intervals.icu/api/v1/athlete/0/activities?oldest=${formatDateISO(from)}&newest=${formatDateISO(today)}`;

  const result = {
    activities: [],
    byCategory: {
      strength: [],
      walking: [],
      swimming: [],
      yoga: [],
      other: []
    },
    summary: {
      totalActivities: 0,
      totalLoad: 0,
      recentLoad: 0,  // Load from last 48h
      lastActivityDate: null,
      daysSinceLastActivity: null
    }
  };

  try {
    const response = UrlFetchApp.fetch(url, {
      headers: { "Authorization": getIcuAuthHeader() },
      muteHttpExceptions: true
    });

    if (response.getResponseCode() === 200) {
      const activities = JSON.parse(response.getContentText());

      activities.forEach(function(a) {
        // Skip cycling and running - those are handled separately
        if (a.type === 'Ride' || a.type === 'VirtualRide' ||
            a.type === 'Run' || a.type === 'VirtualRun') {
          return;
        }

        const categoryInfo = categorizeActivity(a);
        if (!categoryInfo) return;  // Unknown activity type

        const activityDate = new Date(a.start_date_local);
        const daysAgo = Math.floor((today - activityDate) / (1000 * 60 * 60 * 24));

        const baseLoad = a.icu_training_load || estimateCrossTrainingLoad(a.moving_time || a.elapsed_time || 0, categoryInfo.category);
        const weightedLoad = baseLoad * categoryInfo.impactFactor;

        const activity = {
          date: a.start_date_local,
          name: a.name,
          type: a.type,
          category: categoryInfo.category,
          categoryDescription: categoryInfo.description,
          duration: a.moving_time || a.elapsed_time || 0,
          baseLoad: baseLoad,
          weightedLoad: weightedLoad,
          impactFactor: categoryInfo.impactFactor,
          daysAgo: daysAgo,
          rpe: a.icu_rpe || null,
          feel: a.feel || null
        };

        result.activities.push(activity);
        result.byCategory[categoryInfo.category].push(activity);
        result.summary.totalActivities++;
        result.summary.totalLoad += weightedLoad;

        // Track load from last 48 hours
        if (daysAgo <= 2) {
          result.summary.recentLoad += weightedLoad;
        }

        // Track most recent activity
        if (!result.summary.lastActivityDate || activityDate > new Date(result.summary.lastActivityDate)) {
          result.summary.lastActivityDate = a.start_date_local;
          result.summary.daysSinceLastActivity = daysAgo;
        }
      });

      // Sort by date (most recent first)
      result.activities.sort((a, b) => new Date(b.date) - new Date(a.date));
    }
  } catch (e) {
    Logger.log("Error fetching cross-training: " + e.toString());
  }

  return result;
}

/**
 * Estimate training load for cross-training sessions without TSS
 * @param {number} durationSeconds - Duration in seconds
 * @param {string} category - Activity category
 * @returns {number} Estimated load
 */
function estimateCrossTrainingLoad(durationSeconds, category) {
  const minutes = durationSeconds / 60;

  // Different load estimates by activity type
  const loadPerMinute = {
    strength: 0.8,   // Higher stress per minute
    walking: 0.3,    // Low stress
    swimming: 0.6,   // Moderate
    yoga: 0.2,       // Very low
    other: 0.5       // Default moderate
  };

  return Math.round(minutes * (loadPerMinute[category] || 0.5));
}

/**
 * Analyze cross-training impact on today's workout
 * @param {object} crossTrainingData - Result from fetchRecentCrossTraining
 * @returns {object} Impact assessment
 */
function analyzeCrossTrainingImpact(crossTrainingData) {
  const result = {
    hasImpact: false,
    impactLevel: "none",  // "none", "low", "moderate", "high"
    intensityModifier: 1.0,
    reasoning: []
  };

  if (crossTrainingData.summary.totalActivities === 0) {
    return result;
  }

  const strengthSessions = crossTrainingData.byCategory.strength;
  const recentLoad = crossTrainingData.summary.recentLoad;

  // Check for recent strength training (highest impact)
  if (strengthSessions.length > 0) {
    const lastStrength = strengthSessions.sort((a, b) => new Date(b.date) - new Date(a.date))[0];

    if (lastStrength.daysAgo === 0) {
      result.hasImpact = true;
      result.impactLevel = "high";
      result.intensityModifier = 0.85;
      result.reasoning.push(`Strength training today (${lastStrength.name}) - reduce cycling intensity`);
    } else if (lastStrength.daysAgo === 1) {
      result.hasImpact = true;
      result.impactLevel = "moderate";
      result.intensityModifier = 0.90;
      result.reasoning.push(`Strength training yesterday - legs may be fatigued`);

      if (lastStrength.rpe && lastStrength.rpe >= 7) {
        result.impactLevel = "high";
        result.intensityModifier = 0.85;
        result.reasoning.push(`High RPE (${lastStrength.rpe}/10) suggests heavy session`);
      }
    } else if (lastStrength.daysAgo === 2) {
      result.hasImpact = true;
      result.impactLevel = "moderate";
      result.intensityModifier = 0.92;
      result.reasoning.push(`Strength training 2 days ago - potential DOMS`);
    } else if (lastStrength.daysAgo <= 4) {
      result.hasImpact = true;
      result.impactLevel = "low";
      result.intensityModifier = 0.97;
      result.reasoning.push(`Strength training ${lastStrength.daysAgo} days ago - minimal residual fatigue`);
    }
  }

  // Check for other cross-training activities
  const otherActivities = crossTrainingData.activities.filter(a => a.category !== 'strength');
  const recentOther = otherActivities.filter(a => a.daysAgo <= 1);

  if (recentOther.length > 0) {
    const categories = [...new Set(recentOther.map(a => a.categoryDescription))];
    result.reasoning.push(`Other recent activities: ${categories.join(', ')}`);

    // Additional fatigue from accumulated cross-training
    if (recentOther.reduce((sum, a) => sum + a.weightedLoad, 0) > 30) {
      result.intensityModifier *= 0.97;
      result.reasoning.push(`Accumulated cross-training load in last 48h`);
      if (!result.hasImpact) {
        result.hasImpact = true;
        result.impactLevel = "low";
      }
    }
  }

  // Overall accumulated load check
  if (recentLoad > 80) {
    if (result.impactLevel === "low") result.impactLevel = "moderate";
    result.intensityModifier *= 0.95;
    result.reasoning.push(`High total cross-training load (${Math.round(recentLoad)} weighted TSS) in last 48h`);
  }

  return result;
}

/**
 * Get cross-training context for workout generation
 * @returns {object} Context with cross-training data and recommendations
 */
function getCrossTrainingContext() {
  const crossTrainingData = fetchRecentCrossTraining(5);
  const impact = analyzeCrossTrainingImpact(crossTrainingData);

  return {
    available: crossTrainingData.summary.totalActivities > 0,
    data: crossTrainingData,
    impact: impact,
    promptContext: generateCrossTrainingPromptContext(crossTrainingData, impact)
  };
}

/**
 * Generate text context for AI workout generation prompt
 */
function generateCrossTrainingPromptContext(crossTrainingData, impact) {
  if (crossTrainingData.summary.totalActivities === 0) {
    return "";  // No cross-training, no context needed
  }

  let context = `\n**1e. Recent Cross-Training (non-cycling/running):**\n`;
  context += `- Activities in last 5 days: ${crossTrainingData.summary.totalActivities}\n`;

  // Group by category
  const categoryGroups = {};
  crossTrainingData.activities.forEach(a => {
    if (!categoryGroups[a.categoryDescription]) {
      categoryGroups[a.categoryDescription] = [];
    }
    categoryGroups[a.categoryDescription].push(a);
  });

  for (const [category, activities] of Object.entries(categoryGroups)) {
    const recent = activities.filter(a => a.daysAgo <= 2);
    if (recent.length > 0) {
      const daysAgoText = recent[0].daysAgo === 0 ? "today" :
                          recent[0].daysAgo === 1 ? "yesterday" :
                          `${recent[0].daysAgo} days ago`;
      context += `- ${category}: ${recent.length} session(s), most recent ${daysAgoText}\n`;
    }
  }

  if (impact.hasImpact) {
    context += `\n**CROSS-TRAINING IMPACT:** ${impact.impactLevel.toUpperCase()}\n`;
    context += `- Recommended intensity modifier: ${Math.round(impact.intensityModifier * 100)}%\n`;
    context += `- Reasoning:\n`;
    impact.reasoning.forEach(r => {
      context += `  • ${r}\n`;
    });
    context += `\n**CROSS-TRAINING RULES:**\n`;
    context += `- After strength training: reduce high-intensity leg work, favor high-cadence/low-resistance\n`;
    context += `- After long walks/hikes: legs may be tired, reduce volume if needed\n`;
    context += `- Swimming/yoga: generally complementary, minimal adjustment needed\n`;
  }

  return context;
}

/**
 * Test function for cross-training integration
 */
function testCrossTraining() {
  Logger.log("=== CROSS-TRAINING TEST ===");

  const crossTrainingData = fetchRecentCrossTraining(5);

  Logger.log("\n--- Recent Cross-Training Activities ---");
  Logger.log("Total activities (last 5 days): " + crossTrainingData.summary.totalActivities);

  if (crossTrainingData.summary.totalActivities > 0) {
    Logger.log("Total weighted load: " + Math.round(crossTrainingData.summary.totalLoad));
    Logger.log("Recent weighted load (48h): " + Math.round(crossTrainingData.summary.recentLoad));

    Logger.log("\n--- By Category ---");
    for (const [category, activities] of Object.entries(crossTrainingData.byCategory)) {
      if (activities.length > 0) {
        Logger.log(category.toUpperCase() + ": " + activities.length + " session(s)");
      }
    }

    Logger.log("\n--- Activity Details ---");
    crossTrainingData.activities.forEach((a, i) => {
      Logger.log((i + 1) + ". " + a.date.substring(0, 10) + " - " + a.name);
      Logger.log("   Category: " + a.categoryDescription + ", Duration: " + Math.round(a.duration / 60) + " min");
      Logger.log("   Base Load: " + a.baseLoad + ", Weighted: " + Math.round(a.weightedLoad) + " (factor: " + a.impactFactor + ")");
      Logger.log("   Days ago: " + a.daysAgo + ", RPE: " + (a.rpe || 'N/A') + ", Feel: " + (a.feel || 'N/A'));
    });

    const impact = analyzeCrossTrainingImpact(crossTrainingData);

    Logger.log("\n--- Impact Analysis ---");
    Logger.log("Has impact: " + impact.hasImpact);
    Logger.log("Impact level: " + impact.impactLevel.toUpperCase());
    Logger.log("Intensity modifier: " + Math.round(impact.intensityModifier * 100) + "%");

    Logger.log("\nReasoning:");
    impact.reasoning.forEach(r => {
      Logger.log("  - " + r);
    });

    Logger.log("\n--- Prompt Context for AI ---");
    const context = getCrossTrainingContext();
    Logger.log(context.promptContext);
  } else {
    Logger.log("No cross-training found in the last 5 days");
  }
}

/**
 * Debug function to see ALL activities from Intervals.icu API
 * This helps identify what activity types are available
 */
function debugAllActivities() {
  Logger.log("=== DEBUG: ALL ACTIVITIES (last 14 days) ===");

  const today = new Date();
  const from = new Date(today);
  from.setDate(today.getDate() - 14);

  const url = `https://intervals.icu/api/v1/athlete/0/activities?oldest=${formatDateISO(from)}&newest=${formatDateISO(today)}`;

  try {
    const response = UrlFetchApp.fetch(url, {
      headers: { "Authorization": getIcuAuthHeader() },
      muteHttpExceptions: true
    });

    if (response.getResponseCode() === 200) {
      const activities = JSON.parse(response.getContentText());

      Logger.log("Total activities found: " + activities.length);
      Logger.log("\n--- Activity List ---");

      activities.forEach((a, i) => {
        const date = a.start_date_local ? a.start_date_local.substring(0, 10) : 'N/A';
        // Show key fields that might contain activity info
        Logger.log((i + 1) + ". " + date);
        Logger.log("   type: '" + a.type + "' | name: '" + a.name + "'");
        Logger.log("   activity_type: '" + a.activity_type + "' | sport_type: '" + a.sport_type + "'");
        Logger.log("   icu_training_load: " + a.icu_training_load + " | moving_time: " + a.moving_time);

        // For unknown types, show all keys
        if (!a.type || a.type === 'undefined') {
          Logger.log("   ALL KEYS: " + Object.keys(a).join(", "));
        }
      });

      // Show unique types
      const uniqueTypes = [...new Set(activities.map(a => a.type))];
      Logger.log("\n--- Unique Activity Types ---");
      Logger.log(uniqueTypes.join(", "));
    } else {
      Logger.log("API Error: " + response.getResponseCode());
    }
  } catch (e) {
    Logger.log("Error: " + e.message);
  }
}

// =========================================================
// 13. DATA PROCESSING & UTILITIES
// =========================================================

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

/**
 * Debug function to test historical eFTP fetching
 */
function debugHistoricalEftp() {
  Logger.log("=== HISTORICAL eFTP DEBUG ===");

  // Test current eFTP from power curve
  const powerCurve = fetchPowerCurve();
  Logger.log("Current eFTP (from powerCurve): " + (powerCurve.currentEftp || powerCurve.ftp || 'N/A') + "W");

  // Check what the wellness endpoint returns (it might have eFTP)
  const today = new Date();
  const todayStr = formatDateISO(today);
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);
  const weekAgoStr = formatDateISO(weekAgo);

  Logger.log("\n=== WELLNESS ENDPOINT (today) ===");
  const urlToday = "https://intervals.icu/api/v1/athlete/0/wellness/" + todayStr;
  try {
    const resp = UrlFetchApp.fetch(urlToday, {
      headers: { "Authorization": getIcuAuthHeader() },
      muteHttpExceptions: true
    });
    if (resp.getResponseCode() === 200) {
      const data = JSON.parse(resp.getContentText());
      Logger.log("All fields: " + Object.keys(data).join(", "));
      Logger.log("eFTP field: " + (data.eftp || data.eFtp || data.ftp || 'not found'));
      Logger.log("sportInfo: " + JSON.stringify(data.sportInfo || 'not found'));
      // Log full response to see all available data
      Logger.log("Full response: " + JSON.stringify(data).substring(0, 1000));
    }
  } catch (e) {
    Logger.log("Error: " + e.toString());
  }

  Logger.log("\n=== WELLNESS ENDPOINT (7 days ago) ===");
  const urlWeekAgo = "https://intervals.icu/api/v1/athlete/0/wellness/" + weekAgoStr;
  try {
    const resp = UrlFetchApp.fetch(urlWeekAgo, {
      headers: { "Authorization": getIcuAuthHeader() },
      muteHttpExceptions: true
    });
    if (resp.getResponseCode() === 200) {
      const data = JSON.parse(resp.getContentText());
      Logger.log("eFTP field: " + (data.eftp || data.eFtp || data.ftp || 'not found'));
      Logger.log("Full response: " + JSON.stringify(data).substring(0, 1000));
    }
  } catch (e) {
    Logger.log("Error: " + e.toString());
  }
}

/**
 * Fetch historical eFTP value for a specific date from fitness-model-events
 * @param {Date} date - The date to get eFTP for (finds most recent SET_EFTP event before this date)
 * @returns {number|null} eFTP value or null if not available
 */
function fetchHistoricalEftp(date) {
  const targetDate = date || new Date();
  const targetDateStr = formatDateISO(targetDate);

  const url = "https://intervals.icu/api/v1/athlete/0/fitness-model-events";

  try {
    const response = UrlFetchApp.fetch(url, {
      headers: { "Authorization": getIcuAuthHeader() },
      muteHttpExceptions: true
    });

    if (response.getResponseCode() === 200) {
      const events = JSON.parse(response.getContentText());

      // Filter SET_EFTP events and find the most recent one on or before the target date
      const eftpEvents = events
        .filter(function(e) { return e.category === "SET_EFTP" && e.start_date <= targetDateStr; })
        .sort(function(a, b) { return b.start_date.localeCompare(a.start_date); });

      if (eftpEvents.length > 0) {
        // The value is stored in the event data
        return eftpEvents[0].value || null;
      }
    }
  } catch (e) {
    Logger.log("Error fetching historical eFTP: " + e.toString());
  }

  return null;
}

/**
 * Fetch current fitness metrics (CTL, ATL, TSB) from Intervals.icu
 */
function fetchFitnessMetrics(date) {
  const targetDate = date || new Date();
  const dateStr = formatDateISO(targetDate);
  const url = "https://intervals.icu/api/v1/athlete/0/wellness/" + dateStr;

  try {
    const response = UrlFetchApp.fetch(url, {
      headers: { "Authorization": getIcuAuthHeader() },
      muteHttpExceptions: true
    });

    if (response.getResponseCode() === 200) {
      const data = JSON.parse(response.getContentText());

      // Extract eFTP from sportInfo array (for Ride type)
      let eftp = null;
      if (data.sportInfo && Array.isArray(data.sportInfo)) {
        const rideInfo = data.sportInfo.find(function(s) { return s.type === "Ride"; });
        if (rideInfo && rideInfo.eftp) {
          eftp = Math.round(rideInfo.eftp);
        }
      }

      return {
        ctl: data.ctl || 0,
        atl: data.atl || 0,
        tsb: (data.ctl || 0) - (data.atl || 0),
        rampRate: data.rampRate || 0,
        eftp: eftp
      };
    }
  } catch (e) {
    Logger.log("Error fetching fitness metrics: " + e.toString());
  }

  return { ctl: 0, atl: 0, tsb: 0, rampRate: 0, eftp: null };
}

/**
 * Calculate training load recommendations based on current fitness and goals
 * @param {object} fitnessMetrics - Current CTL, ATL, TSB, rampRate
 * @param {object} phaseInfo - Training phase info (weeksOut, phaseName)
 * @param {object} goals - Goal information
 * @returns {object} Training load advice
 */
function calculateTrainingLoadAdvice(fitnessMetrics, phaseInfo, goals) {
  const currentCTL = fitnessMetrics.ctl || 0;
  const currentATL = fitnessMetrics.atl || 0;
  const currentTSB = fitnessMetrics.tsb || 0;
  const currentRampRate = fitnessMetrics.rampRate || 0;
  const weeksOut = phaseInfo.weeksOut || 12;

  // Target CTL based on current fitness and time to goal
  // Aim to peak 5-15% above current CTL for A race
  let targetCTL = currentCTL;
  let targetTSBAtRace = 0; // Slightly positive for race day

  if (weeksOut > 3) {
    // We have time to build - aim for meaningful improvement
    const maxGain = Math.min(weeksOut * 5, 40); // Max ~5 CTL/week, cap at 40 total
    targetCTL = currentCTL + Math.min(maxGain, currentCTL * 0.25); // Or 25% improvement
    targetCTL = Math.max(targetCTL, currentCTL + 10); // At least try for +10 CTL
  }

  // Calculate required weekly CTL increase
  const ctlGapToTarget = targetCTL - currentCTL;
  const buildWeeks = Math.max(weeksOut - 2, 1); // Leave 2 weeks for taper
  const requiredWeeklyIncrease = ctlGapToTarget / buildWeeks;

  // Define safe ramp rate limits
  const SAFE_RAMP_MIN = 3;
  const SAFE_RAMP_MAX = 5;
  const AGGRESSIVE_RAMP_MAX = 7;
  const MAX_SUSTAINABLE_RAMP = 8;

  // Calculate recommended weekly TSS
  // TSS per week ≈ CTL × 7 (simplified, since CTL is ~42 day average)
  let recommendedWeeklyTSS;
  let rampRateAdvice;
  let loadAdvice;
  let warning = null;

  // Phase-based adjustments
  if (phaseInfo.phaseName.includes("Taper") || phaseInfo.phaseName.includes("Race Week")) {
    // Taper: reduce volume significantly
    recommendedWeeklyTSS = Math.round(currentCTL * 7 * 0.5); // 50% reduction
    rampRateAdvice = "Reduce";
    loadAdvice = "Focus on freshness. Reduce volume by 40-50%, keep some intensity for sharpness.";
  } else if (phaseInfo.phaseName.includes("Peak")) {
    // Peak/late taper: moderate reduction
    recommendedWeeklyTSS = Math.round(currentCTL * 7 * 0.7); // 30% reduction
    rampRateAdvice = "Reduce";
    loadAdvice = "Begin tapering. Reduce volume by 20-30%, maintain intensity.";
  } else if (phaseInfo.phaseName.includes("Transition")) {
    // Off-season: easy recovery
    recommendedWeeklyTSS = Math.round(currentCTL * 7 * 0.4);
    rampRateAdvice = "Recovery";
    loadAdvice = "Off-season recovery. Keep active but prioritize rest and fun.";
  } else {
    // Building phases (Base, Build, Specialty)
    const targetWeeklyIncrease = Math.min(requiredWeeklyIncrease, SAFE_RAMP_MAX);
    const targetCTLThisWeek = currentCTL + targetWeeklyIncrease;
    recommendedWeeklyTSS = Math.round(targetCTLThisWeek * 7);

    // Determine ramp rate advice
    if (requiredWeeklyIncrease <= SAFE_RAMP_MIN) {
      rampRateAdvice = "Maintain";
      loadAdvice = "On track. Maintain current load with slight progression.";
    } else if (requiredWeeklyIncrease <= SAFE_RAMP_MAX) {
      rampRateAdvice = "Build";
      loadAdvice = "Good progression rate. Increase load steadily.";
    } else if (requiredWeeklyIncrease <= AGGRESSIVE_RAMP_MAX) {
      rampRateAdvice = "Aggressive";
      loadAdvice = "Aggressive build needed. Monitor fatigue closely.";
      warning = "High ramp rate - ensure adequate recovery.";
    } else {
      rampRateAdvice = "Caution";
      loadAdvice = "Goal may be ambitious. Consider adjusting target or extending timeline.";
      warning = "Required ramp rate exceeds safe limits. Risk of overtraining.";
    }

    // Check current fatigue state
    if (currentTSB < -25) {
      warning = "High fatigue detected (TSB: " + currentTSB.toFixed(0) + "). Consider a recovery week.";
      recommendedWeeklyTSS = Math.round(currentCTL * 7 * 0.6); // Suggest recovery
      loadAdvice = "Recovery week recommended due to accumulated fatigue.";
      rampRateAdvice = "Recover";
    } else if (currentTSB < -15) {
      loadAdvice += " Monitor fatigue - approaching limit.";
    }

    // Check if current ramp rate is already high
    if (currentRampRate > AGGRESSIVE_RAMP_MAX) {
      warning = "Current ramp rate (" + currentRampRate.toFixed(1) + ") is high. Be cautious with further increases.";
    }
  }

  // Calculate TSS range (±10%)
  const tssMin = Math.round(recommendedWeeklyTSS * 0.9);
  const tssMax = Math.round(recommendedWeeklyTSS * 1.1);

  // Estimate daily TSS (assuming 5-6 training days)
  const dailyTSSMin = Math.round(recommendedWeeklyTSS / 6);
  const dailyTSSMax = Math.round(recommendedWeeklyTSS / 5);

  return {
    currentCTL: currentCTL,
    targetCTL: Math.round(targetCTL),
    weeksToGoal: weeksOut,
    recommendedWeeklyTSS: recommendedWeeklyTSS,
    tssRange: { min: tssMin, max: tssMax },
    dailyTSSRange: { min: dailyTSSMin, max: dailyTSSMax },
    rampRateAdvice: rampRateAdvice,
    loadAdvice: loadAdvice,
    warning: warning,
    requiredWeeklyIncrease: Math.round(requiredWeeklyIncrease * 10) / 10
  };
}

/**
 * Test function for training load advisor
 */
function testTrainingLoadAdvisor() {
  Logger.log("=== TRAINING LOAD ADVISOR TEST ===");

  const fitnessMetrics = fetchFitnessMetrics();
  Logger.log("Current Fitness:");
  Logger.log("  CTL: " + fitnessMetrics.ctl.toFixed(1));
  Logger.log("  ATL: " + fitnessMetrics.atl.toFixed(1));
  Logger.log("  TSB: " + fitnessMetrics.tsb.toFixed(1));
  Logger.log("  Ramp Rate: " + (fitnessMetrics.rampRate ? fitnessMetrics.rampRate.toFixed(2) : 'N/A'));

  const goals = fetchUpcomingGoals();
  const phaseInfo = goals.available && goals.primaryGoal
    ? calculateTrainingPhase(goals.primaryGoal.date)
    : calculateTrainingPhase(USER_SETTINGS.TARGET_DATE);

  Logger.log("\nTraining Phase: " + phaseInfo.phaseName);
  Logger.log("Weeks to Goal: " + phaseInfo.weeksOut);

  const advice = calculateTrainingLoadAdvice(fitnessMetrics, phaseInfo, goals);

  Logger.log("\n=== RECOMMENDATIONS ===");
  Logger.log("Target CTL: " + advice.targetCTL);
  Logger.log("Weekly TSS Target: " + advice.recommendedWeeklyTSS + " (" + advice.tssRange.min + "-" + advice.tssRange.max + ")");
  Logger.log("Daily TSS Range: " + advice.dailyTSSRange.min + "-" + advice.dailyTSSRange.max);
  Logger.log("Ramp Rate Advice: " + advice.rampRateAdvice);
  Logger.log("Advice: " + advice.loadAdvice);
  if (advice.warning) {
    Logger.log("⚠️ Warning: " + advice.warning);
  }
}

function createAthleteSummary(data) {
  const today = new Date();
  const threeWeeksAgo = new Date();
  threeWeeksAgo.setDate(today.getDate() - 21);

  // Get CTL/ATL/TSB directly from Intervals.icu (more reliable)
  const fitness = fetchFitnessMetrics();

  const recent3Weeks = data.filter(r => new Date(r[0]) >= threeWeeksAgo)
    .map(r => HEADERS_FIXED.reduce((obj, h, i) => ({ ...obj, [h]: r[i] ?? 0 }), {}));

  const newestRow = data[0];
  const lastRowObj = newestRow ? HEADERS_FIXED.reduce((obj, h, i) => ({ ...obj, [h]: newestRow[i] ?? 0 }), {}) : null;

  // Use Intervals.icu fitness data, fallback to spreadsheet if needed
  const ctl = fitness.ctl || (lastRowObj ? lastRowObj.icu_ctl : 0) || 0;
  const atl = fitness.atl || (lastRowObj ? lastRowObj.icu_atl : 0) || 0;

  return {
    ctl_90: ctl,
    atl: atl,
    tsb_current: fitness.tsb || (ctl - atl),
    rampRate: fitness.rampRate,
    last_activity: lastRowObj ? {
      date: Utilities.formatDate(new Date(lastRowObj.start_date_local), SYSTEM_SETTINGS.TIMEZONE, "MM/dd"),
      name: lastRowObj.name,
      load: lastRowObj.icu_training_load
    } : null,
    z5_recent_total: sum(recent3Weeks.map(r => r["Z5_secs"] || 0))
  };
}

function mapActivityToRow(a) {
  const zoneIds = ["Z1","Z2","Z3","Z4","Z5","Z6","Z7","SS"];
  const powerZoneTimes = zoneIds.map(id => {
    const zone = a.icu_zone_times ? a.icu_zone_times.find(z => z.id === id) : null;
    return zone ? zone.secs : 0;
  });
  const hrZoneTimes = a.icu_hr_zone_times ? a.icu_hr_zone_times.slice(0,7) : Array(7).fill(0);
  while(hrZoneTimes.length < 7) hrZoneTimes.push(0);

  return [
    a.start_date_local, a.name, a.type, a.moving_time, a.distance, 
    a.icu_ftp, a.icu_training_load, a.icu_ctl, a.icu_atl, a.icu_intensity, 
    a.icu_joules_above_ftp, 0, ...powerZoneTimes.slice(0,7), powerZoneTimes[7], 0, 
    ...hrZoneTimes, a.icu_power_zones?.join(",") || "", a.icu_hr_zones?.join(",") || "", 
    a.icu_weighted_avg_watts || 0, a.icu_average_watts || 0, a.icu_variability_index || 0, 
    a.icu_efficiency_factor || 0, a.decoupling || 0, a.icu_max_wbal_depletion || 0, 
    a.trimp || 0, (a.icu_ctl - a.icu_atl)
  ];
}

function formatDateISO(date) { return Utilities.formatDate(date, SYSTEM_SETTINGS.TIMEZONE, "yyyy-MM-dd"); }
function average(arr) { return arr.length ? arr.reduce((a,b)=>a+b,0)/arr.length : 0; }
function sum(arr) { return arr.reduce((a,b)=>a+b,0); }
function getOrCreateFolder(name) {
  const folders = DriveApp.getFoldersByName(name);
  return folders.hasNext() ? folders.next() : DriveApp.createFolder(name);
}
