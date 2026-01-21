export const SET_TYPE_OPTIONS = [
  { value: 'working', label: 'Working', description: 'Primary working effort sets.' },
  { value: 'warmup', label: 'Warmup', description: 'Ramp up or rehearsal sets.' },
  { value: 'backoff', label: 'Backoff', description: 'Reduced load for volume.' },
  { value: 'drop', label: 'Drop', description: 'Quick weight reduction set.' },
  { value: 'amrap', label: 'AMRAP', description: 'As many reps as possible.' }
] as const

export const WEIGHT_UNIT_OPTIONS = [
  { value: 'lb', label: 'lb' },
  { value: 'kg', label: 'kg' }
] as const

export const GROUP_TYPE_OPTIONS = [
  { value: 'superset', label: 'Superset' },
  { value: 'circuit', label: 'Circuit' },
  { value: 'giant_set', label: 'Giant set' },
  { value: 'dropset', label: 'Dropset' }
] as const

export const PAIN_AREA_OPTIONS = [
  { value: 'shoulder', label: 'Shoulder' },
  { value: 'knee', label: 'Knee' },
  { value: 'back', label: 'Back' },
  { value: 'hip', label: 'Hip' },
  { value: 'elbow', label: 'Elbow' },
  { value: 'wrist', label: 'Wrist' },
  { value: 'ankle', label: 'Ankle' },
  { value: 'neck', label: 'Neck' },
  { value: 'other', label: 'Other' }
] as const

export const EXTRAS_FIELDS = [
  { key: 'assistance', label: 'Assistance or spot' },
  { key: 'band_tension', label: 'Band tension' }
] as const
