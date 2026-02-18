/**
 * Centralized profile completeness validation.
 * Returns a structured list of missing required fields that affect
 * calculations, graphs, recommendations, and plan generation.
 */

export type MissingField = {
  /** Machine-readable key */
  key: string
  /** Human-readable label */
  label: string
  /** Why this field matters */
  impact: string
}

export type ProfileCompletionResult = {
  isComplete: boolean
  missingFields: MissingField[]
}

export type ProfileSnapshot = {
  weight_lb?: number | null
  height_in?: number | null
  birthdate?: string | null
  sex?: string | null
  /** equipment inventory top-level check (any configured key truthy) */
  hasEquipment?: boolean
}

const REQUIRED_FIELDS: Array<{
  key: keyof ProfileSnapshot
  label: string
  impact: string
  check: (v: ProfileSnapshot[keyof ProfileSnapshot]) => boolean
}> = [
  {
    key: 'weight_lb',
    label: 'Body weight',
    impact: 'Needed for load calculations, E1RM estimates, and tonnage tracking.',
    check: (v) => typeof v === 'number' && v > 0,
  },
  {
    key: 'height_in',
    label: 'Height',
    impact: 'Used for BMI and body composition metrics.',
    check: (v) => typeof v === 'number' && v > 0,
  },
  {
    key: 'birthdate',
    label: 'Date of birth',
    impact: 'Used for age-adjusted recovery and volume recommendations.',
    check: (v) => typeof v === 'string' && v.length > 0,
  },
  {
    key: 'sex',
    label: 'Biological sex',
    impact: 'Used for BMR calculations and strength benchmarks.',
    check: (v) => typeof v === 'string' && v.length > 0,
  },
]

const EQUIPMENT_FIELD: MissingField = {
  key: 'hasEquipment',
  label: 'Equipment',
  impact: 'Required for accurate workout generation. Set defaults in Equipment settings.',
}

export function validateProfileCompletion(profile: ProfileSnapshot): ProfileCompletionResult {
  const missingFields: MissingField[] = []

  for (const field of REQUIRED_FIELDS) {
    if (!field.check(profile[field.key])) {
      missingFields.push({ key: field.key, label: field.label, impact: field.impact })
    }
  }

  if (!profile.hasEquipment) {
    missingFields.push(EQUIPMENT_FIELD)
  }

  return {
    isComplete: missingFields.length === 0,
    missingFields,
  }
}
