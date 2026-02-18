/**
 * Generator utilities barrel file.
 * 
 * This file re-exports from focused utility modules for backwards compatibility.
 * New code should import directly from the specific module files.
 * 
 * Module structure:
 * - seeded-random.ts     - Deterministic RNG
 * - equipment-matching.ts - Equipment availability checks
 * - load-building.ts     - Weight selection and load building
 * - focus-utils.ts       - Focus area matching and constraints
 * - movement-utils.ts    - Movement pattern analysis
 * - timing-utils.ts      - Exercise duration estimation
 * - session-naming.ts    - Workout name generation
 * - focus-sequence.ts    - Session planning and distribution
 * - impact-utils.ts      - Workload impact calculations
 */

// Math utilities (use @/lib/math for new code)
export { clamp } from '@/lib/math'

// Seeded random
export { hashSeed, createSeededRandom } from '@/lib/generator/seeded-random'

// Movement utilities
export {
  normalizeExerciseKey,
  getMovementFamilyFromName,
  getMovementFamily,
  isCompoundMovement
} from '@/lib/generator/movement-utils'

// Focus utilities
export {
  getPrimaryMuscleKey,
  getPrimaryMuscleLabel,
  matchesPrimaryMuscle,
  matchesFocusArea,
  getFocusConstraint
} from '@/lib/generator/focus-utils'

// Equipment matching
export {
  hasMachine,
  isEquipmentOptionAvailable,
  isExerciseEquipmentSatisfied,
  selectEquipmentOption
} from '@/lib/generator/equipment-matching'

// Load building
export {
  pickClosestWeight,
  buildBarbellLoad,
  buildLoad
} from '@/lib/generator/load-building'

// Timing utilities
export {
  getSetupMinutes,
  getWorkSeconds,
  estimateExerciseMinutes
} from '@/lib/generator/timing-utils'

// Session naming
export {
  formatFocusLabel,
  formatGoalLabel,
  buildSessionName,
  buildPlanTitle,
  buildRationale
} from '@/lib/generator/session-naming'

// Focus sequence
export {
  buildFocusDistribution,
  goalToFocus,
  mergeFocusByPriority,
  buildFocusSequence
} from '@/lib/generator/focus-sequence'

// Impact utilities
export {
  calculateExerciseImpact,
  calculateWorkoutImpact
} from '@/lib/generator/impact-utils'
