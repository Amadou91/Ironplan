/**
 * Training-related constants used across the application.
 * Centralizes magic numbers for maintainability and consistency.
 */

// Time constants
export const MS_PER_SECOND = 1_000
export const MS_PER_MINUTE = 60_000
export const MS_PER_HOUR = 3_600_000
export const MS_PER_DAY = 86_400_000

// Training load windows (in days)
export const CHRONIC_LOAD_WINDOW_DAYS = 28
export const ACUTE_LOAD_WINDOW_DAYS = 7
export const RECENT_ACTIVITY_WINDOW_DAYS = 14

// Session timing defaults
export const DEFAULT_REST_SECONDS = 90
export const ESTIMATED_SET_TIME_SECONDS = 45
export const SECONDS_PER_REP = 3

// Default user metrics
export const DEFAULT_USER_WEIGHT_LB = 170
export const DEFAULT_BODYWEIGHT_FACTOR = 0.7

// Virtual weight multipliers for bodyweight exercises
export const VIRTUAL_WEIGHT_MULTIPLIERS = {
  push: 0.66,   // Push-ups, dips, etc.
  pull: 0.90,   // Pull-ups, chin-ups, etc.
  default: 0.70 // Generic bodyweight exercises
} as const

// Pagination limits
export const SESSION_PAGE_SIZE = 50
export const DASHBOARD_SESSION_LIMIT = 24
export const DASHBOARD_TEMPLATE_LIMIT = 12
export const SESSION_HISTORY_LIMIT = 3

// E1RM calculation thresholds
export const E1RM_MAX_REPS = 12
export const E1RM_MIN_RPE = 6
export const E1RM_MAX_RIR = 4
export const E1RM_DIVISOR = 30

// Hard set threshold
export const HARD_SET_RPE_THRESHOLD = 8

// Rep ranges for goal classification
export const REP_RANGES = {
  strength: { min: 1, max: 6 },
  hypertrophy: { min: 6, max: 12 },
  endurance: { min: 12, max: 30 }
} as const

// RPE/RIR bounds
export const RPE_MIN = 0
export const RPE_MAX = 10
export const RIR_MIN = 0
export const RIR_MAX = 6

// Recommendation scoring weights
export const RECOMMENDATION_WEIGHTS = {
  balanceMultiplier: 4,
  recoveryMultiplier: 3,
  loadDivisor: 4,
  maxLoadPenalty: 20,
  firstTimeBoost: 8,
  maxRecoveryDays: 14,
  idealFocusCount: 6,
  intensityHigh: 3,
  intensityLow: 1,
  intensityMod: 2,
  overreachingHighPenalty: -6,
  overreachingLowBoost: 4,
  undertrainingHighBoost: 4,
  undertrainingLowPenalty: -2
} as const

// Chart display thresholds
export const CHART_DAILY_THRESHOLD_DAYS = 14

// Readiness survey bounds
export const READINESS_MIN = 1
export const READINESS_MAX = 5

// Volume targets per muscle group (weekly sets)
export const WEEKLY_VOLUME_TARGETS: Record<string, number> = {
  chest: 12,
  back: 12,
  shoulders: 10,
  biceps: 8,
  triceps: 8,
  quads: 12,
  hamstrings: 10,
  glutes: 12,
  calves: 8,
  core: 10,
  forearms: 6,
  default: 10
}

// Exercise category inference thresholds
export const HYPERTROPHY_REP_THRESHOLD = 12
