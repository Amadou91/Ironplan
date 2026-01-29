/**
 * Exercise form constants
 * Used by ExerciseForm and its sub-components
 */

import type { 
  EquipmentKind, 
  MachineType, 
  EquipmentOrGroup 
} from '@/types/domain'

export const EQUIPMENT_KINDS: { label: string; value: EquipmentKind }[] = [
  { label: 'Bodyweight', value: 'bodyweight' },
  { label: 'Barbell', value: 'barbell' },
  { label: 'Bench Press', value: 'bench_press' },
  { label: 'Dumbbell', value: 'dumbbell' },
  { label: 'Kettlebell', value: 'kettlebell' },
  { label: 'Band', value: 'band' },
  { label: 'Machine', value: 'machine' },
  { label: 'Block', value: 'block' },
  { label: 'Bolster', value: 'bolster' },
  { label: 'Strap', value: 'strap' }
]

export const MACHINE_TYPES: { label: string; value: MachineType }[] = [
  { label: 'Cable', value: 'cable' },
  { label: 'Leg Press', value: 'leg_press' },
  { label: 'Treadmill', value: 'treadmill' },
  { label: 'Rower', value: 'rower' },
  { label: 'Indoor Bicycle', value: 'indoor_bicycle' },
  { label: 'Outdoor Bicycle', value: 'outdoor_bicycle' }
]

export const OR_GROUPS: { label: string; value: EquipmentOrGroup; description: string }[] = [
  { label: 'Free Weight Primary', value: 'free_weight_primary', description: 'Barbell OR Dumbbells' },
  { label: 'Single Implement', value: 'single_implement', description: 'Kettlebell OR Dumbbell (ballistic/unilateral)' },
  { label: 'Pull-up Infrastructure', value: 'pull_up_infrastructure', description: 'Pull-up Bar OR Rings' },
  { label: 'Treadmill/Outdoor', value: 'treadmill_outdoor', description: 'Treadmill OR Outdoor Running' },
  { label: 'Stationary/Spin', value: 'stationary_spin', description: 'Stationary Bike OR Spin Bike' },
  { label: 'Rowing Machines', value: 'rowing_machines', description: 'Row Erg OR Ski Erg' },
  { label: 'Resistance Variable', value: 'resistance_variable', description: 'Resistance Bands OR Cables' }
]

export const MOVEMENT_PATTERNS: { label: string; value: string }[] = [
  { label: 'Push', value: 'push' },
  { label: 'Pull', value: 'pull' },
  { label: 'Squat', value: 'squat' },
  { label: 'Hinge', value: 'hinge' },
  { label: 'Carry', value: 'carry' },
  { label: 'Core', value: 'core' }
]

/** Mapping of movement patterns to their associated muscle groups */
export const MOVEMENT_PATTERN_MUSCLES: Record<string, string[]> = {
  push: ['chest', 'shoulders', 'triceps'],
  pull: ['back', 'biceps', 'forearms'],
  squat: ['quads', 'glutes', 'adductors', 'calves'],
  hinge: ['hamstrings', 'glutes', 'back'],
  carry: ['forearms', 'core', 'shoulders', 'full_body'],
  core: ['core'],
  cardio: ['full_body'],
  mobility: ['full_body']
}

export type ExerciseType = 'Strength' | 'Yoga' | 'Cardio'
