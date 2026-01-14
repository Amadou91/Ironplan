export type IntensityOption = {
  value: number
  label: string
  description: string
  equivalence?: string
}

export const RPE_OPTIONS: IntensityOption[] = [
  {
    value: 10,
    label: 'Max Effort – Absolute Failure',
    description: 'Could not complete another rep.',
    equivalence: '≈ RIR 0'
  },
  {
    value: 9.5,
    label: 'Very Hard – Maybe a Partial Rep Left',
    description: 'No full reps left, but close.',
    equivalence: '≈ RIR 0–1'
  },
  {
    value: 9,
    label: 'Heavy – 1 Rep Left',
    description: 'Last rep was a grind; one more possible.',
    equivalence: '≈ RIR 1'
  },
  {
    value: 8,
    label: 'Challenging – 2 Reps Left',
    description: 'Hard but controlled.',
    equivalence: '≈ RIR 2'
  },
  {
    value: 7,
    label: 'Moderate – 3 Reps Left',
    description: 'Working weight, not close to failure.',
    equivalence: '≈ RIR 3'
  },
  {
    value: 5.5,
    label: 'Light – Warm-Up / Moving Fast',
    description: 'Easy, explosive, not fatiguing.',
    equivalence: '≈ RIR 4+'
  }
]

export const RIR_OPTIONS: IntensityOption[] = [
  {
    value: 0,
    label: '0 Reps Left – Failure',
    description: '',
    equivalence: '≈ Max effort'
  },
  {
    value: 1,
    label: '1 Rep Left',
    description: '',
    equivalence: '≈ Heavy effort'
  },
  {
    value: 2,
    label: '2 Reps Left',
    description: '',
    equivalence: '≈ Challenging effort'
  },
  {
    value: 3,
    label: '3 Reps Left',
    description: '',
    equivalence: '≈ Moderate effort'
  },
  {
    value: 4,
    label: '4+ Reps Left – Too Easy for a Working Set',
    description: '',
    equivalence: '≈ Light effort'
  }
]

export const RPE_HELPER_TEXT = 'Choose the option that best describes how hard the set felt.'
export const RIR_HELPER_TEXT = 'How many more reps could you have done with good form?'
export const INTENSITY_RECOMMENDATION = 'Most users log working sets as Heavy (1–2 reps left).'
