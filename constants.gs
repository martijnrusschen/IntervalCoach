/**
 * IntervalCoach - Constants & Configuration
 *
 * System settings, training constants, and workout type definitions.
 */

// =========================================================
// SYSTEM SETTINGS (Advanced)
// =========================================================
const SYSTEM_SETTINGS = {
  TIMEZONE: Session.getScriptTimeZone(),
  MAX_RETRIES: 3,
  RETRY_DELAY_MS: 5000,
  API_DELAY_MS: 100, // Delay between API calls to avoid rate limiting

  GENERATION_CONFIG: {
    temperature: 0.3, // Slight creativity for workout variety
    maxOutputTokens: 8192,
    responseMimeType: "application/json"
  }
};

// =========================================================
// TRAINING CONSTANTS
// =========================================================
const TRAINING_CONSTANTS = {
  // Recovery zones (Whoop-style: 0-100 scale)
  RECOVERY: {
    RED_THRESHOLD: 34,      // Below this = strained, rest day
    YELLOW_THRESHOLD: 50,   // Below this = recovering, reduced intensity
    GREEN_THRESHOLD: 66     // Above this = primed, full intensity
  },

  // Intensity modifiers based on recovery
  INTENSITY: {
    RED_MODIFIER: 0.75,     // Strained: 75% intensity
    YELLOW_MODIFIER: 0.85,  // Recovering: 85% intensity
    GREEN_MODIFIER: 1.0     // Primed: full intensity
  },

  // HRV deviation threshold (5% deviation from baseline is significant)
  HRV_DEVIATION_THRESHOLD: 0.05,

  // Power calculation factors
  POWER: {
    FTP_FROM_20MIN: 0.95,   // FTP = 20min power * 0.95
    W_PRIME_LOW: 0.85,      // W' ratio below this = weak anaerobic
    W_PRIME_HIGH: 0.95      // W' ratio above this = strong anaerobic
  },

  // Lookback periods (days)
  LOOKBACK: {
    WELLNESS_DEFAULT: 7,
    ACTIVITIES_DEFAULT: 90,
    RECENT_WORKOUTS: 7,
    THREE_WEEKS: 21
  },

  // Training phase thresholds (weeks out from race)
  PHASE: {
    BASE_START: 16,         // 16+ weeks = Base phase
    BUILD_START: 8,         // 8-16 weeks = Build phase
    SPECIALTY_START: 3,     // 3-8 weeks = Specialty phase
    TAPER_START: 1          // 1-3 weeks = Taper phase
  },

  // Training load limits
  LOAD: {
    SAFE_RAMP_RATE: 5,      // CTL/week - sustainable
    AGGRESSIVE_RAMP_RATE: 7, // CTL/week - monitor closely
    MAX_RAMP_RATE: 8,       // CTL/week - risk of overtraining
    TSB_WARNING: -25        // TSB below this = high fatigue
  }
};

// =========================================================
// WORKOUT TYPE CATALOG
// =========================================================
// Comprehensive workout types with metadata for smart selection
// intensity: 1=recovery, 2=easy, 3=moderate, 4=hard, 5=very hard
// phases: which training phases this workout is suitable for
// tsbRange: recommended TSB range [min, max] for this workout

const WORKOUT_TYPES = {
  // ===== CYCLING WORKOUTS =====
  ride: {
    // Recovery & Easy
    Recovery_Easy: {
      intensity: 1,
      zones: "Z1",
      stimulus: "recovery",  // Training effect category for variety tracking
      description: "Very easy spinning, active recovery",
      phases: ["Base", "Build", "Specialty", "Taper", "Race Week"],
      tsbRange: [-50, 50],
      minRecovery: 0
    },
    Endurance_Z2: {
      intensity: 2,
      zones: "Z2",
      stimulus: "aerobic",
      description: "Steady aerobic endurance, fat burning",
      phases: ["Base", "Build", "Specialty", "Taper"],
      tsbRange: [-30, 50],
      minRecovery: 20
    },
    Endurance_Tempo: {
      intensity: 3,
      zones: "Z2-Z3",
      stimulus: "tempo",
      description: "Endurance with tempo blocks",
      phases: ["Base", "Build"],
      tsbRange: [-20, 40],
      minRecovery: 34
    },
    // Moderate intensity
    SweetSpot: {
      intensity: 3,
      zones: "88-94% FTP",
      stimulus: "subthreshold",  // Similar to Tempo_Sustained
      description: "Efficient threshold development",
      phases: ["Base", "Build"],
      tsbRange: [-15, 30],
      minRecovery: 40
    },
    Tempo_Sustained: {
      intensity: 3,
      zones: "Z3",
      stimulus: "subthreshold",  // Similar to SweetSpot
      description: "Sustained tempo effort",
      phases: ["Base", "Build"],
      tsbRange: [-15, 30],
      minRecovery: 40
    },
    // Hard intensity
    FTP_Threshold: {
      intensity: 4,
      zones: "Z4 (95-105% FTP)",
      stimulus: "threshold",
      description: "Threshold intervals, FTP development",
      phases: ["Build", "Specialty"],
      tsbRange: [-10, 25],
      minRecovery: 50
    },
    Over_Unders: {
      intensity: 4,
      zones: "Z4 +/- 5%",
      stimulus: "threshold",  // Similar to FTP_Threshold
      description: "Threshold tolerance, lactate clearing",
      phases: ["Build", "Specialty"],
      tsbRange: [-10, 25],
      minRecovery: 50
    },
    // Very hard intensity
    VO2max_Intervals: {
      intensity: 5,
      zones: "Z5 (105-120% FTP)",
      stimulus: "vo2max",
      description: "3-5 min hard intervals, VO2max development",
      phases: ["Specialty", "Build"],
      tsbRange: [0, 20],
      minRecovery: 60
    },
    Anaerobic_Sprints: {
      intensity: 5,
      zones: "Z6-Z7",
      stimulus: "anaerobic",
      description: "Short max efforts, neuromuscular power",
      phases: ["Specialty", "Race Week"],
      tsbRange: [5, 30],
      minRecovery: 60
    }
  },

  // ===== RUNNING WORKOUTS =====
  run: {
    // Recovery & Easy
    Run_Recovery: {
      intensity: 1,
      zones: "Z1",
      stimulus: "recovery",
      description: "Very easy jog, regeneration",
      phases: ["Base", "Build", "Specialty", "Taper", "Race Week"],
      tsbRange: [-50, 50],
      minRecovery: 0
    },
    Run_Easy: {
      intensity: 2,
      zones: "Z1-Z2",
      stimulus: "aerobic",
      description: "Easy run, conversational pace",
      phases: ["Base", "Build", "Specialty", "Taper"],
      tsbRange: [-30, 50],
      minRecovery: 20
    },
    Run_Long: {
      intensity: 2,
      zones: "Z2",
      stimulus: "aerobic",  // Similar to Run_Easy
      description: "Extended easy run, aerobic endurance",
      phases: ["Base", "Build"],
      tsbRange: [-20, 40],
      minRecovery: 34
    },
    // Moderate intensity
    Run_Tempo: {
      intensity: 3,
      zones: "Z3",
      stimulus: "tempo",
      description: "Sustained tempo effort",
      phases: ["Base", "Build", "Specialty"],
      tsbRange: [-15, 30],
      minRecovery: 40
    },
    Run_Fartlek: {
      intensity: 3,
      zones: "Mixed",
      stimulus: "mixed",  // Unique - varied stimulus
      description: "Playful speed variations",
      phases: ["Base", "Build", "Specialty"],
      tsbRange: [-15, 30],
      minRecovery: 40
    },
    // Hard intensity
    Run_Threshold: {
      intensity: 4,
      zones: "Z4",
      stimulus: "threshold",
      description: "Lactate threshold pace intervals",
      phases: ["Build", "Specialty"],
      tsbRange: [-10, 25],
      minRecovery: 50
    },
    // Very hard intensity
    Run_Intervals: {
      intensity: 5,
      zones: "Z5",
      stimulus: "vo2max",
      description: "VO2max repeats, 400m-1km efforts",
      phases: ["Specialty", "Build"],
      tsbRange: [0, 20],
      minRecovery: 60
    },
    Run_Strides: {
      intensity: 4,
      zones: "Z5 (short)",
      stimulus: "neuromuscular",  // Short, form-focused
      description: "Short accelerations after easy run",
      phases: ["Base", "Build", "Specialty", "Taper"],
      tsbRange: [-20, 40],
      minRecovery: 34
    }
  }
};

// =========================================================
// GLOBAL CONSTANTS & HEADERS
// =========================================================
// Lazy-evaluated to avoid load-time dependency on config.gs
function getIcuAuthHeader() {
  return "Basic " + Utilities.base64Encode("API_KEY:" + API_KEYS.ICU_TOKEN);
}

