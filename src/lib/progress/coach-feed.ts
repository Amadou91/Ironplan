import {
  EFFORT_HIGH_THRESHOLD,
  READINESS_HIGH_THRESHOLD,
  READINESS_LOW_THRESHOLD
} from '@/constants/training'

export type CoachInsightTone = 'critical' | 'warning' | 'opportunity' | 'positive'
export type CoachInsightConfidence = 'high' | 'medium' | 'low'

export type CoachInsight = {
  id: string
  tone: CoachInsightTone
  title: string
  summary: string
  whyNow: string
  nextStep: string
  metric: string
  confidence: CoachInsightConfidence
  timeHorizonLabel: string
  validUntil: string | null
}

export type CoachFeedInput = {
  filteredSessionCount: number
  sessionsPerWeek: number
  readinessScore: number | null
  avgEffort: number | null
  hardSets: number
  trainingLoadSummary: {
    status: 'undertraining' | 'balanced' | 'overreaching'
    loadRatio: number
    insufficientData: boolean
    isInitialPhase: boolean
    daysSinceLast: number | null
  }
  timeHorizonLabel: string
}

export type FilterScopeInput = {
  startDate: string
  endDate: string
  selectedMuscle: string
  selectedExercise: string
}

export type FilterScopeSummary = {
  isFiltered: boolean
  parts: [string, string, string]
  label: string
}

export type ActionScopeInput = {
  selectedMuscle: string
  selectedExercise: string
  timeHorizonLabel: string
}

export type ActionScopeSummary = {
  parts: [string, string, string]
  label: string
}

const MUSCLE_LABELS: Record<string, string> = {
  all: 'All muscles',
  chest: 'Chest',
  back: 'Back',
  shoulders: 'Shoulders',
  legs: 'Legs',
  arms: 'Arms',
  core: 'Core',
  cardio: 'Cardio',
  mobility: 'Yoga/Mobility'
}

type CandidateInsight = CoachInsight & {
  category: string
  priority: number
}

function toTitleCase(value: string) {
  if (!value) return value
  return value
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

function buildDateScopeLabel(startDate: string, endDate: string) {
  if (!startDate && !endDate) return 'All time'
  if (startDate && endDate && startDate === endDate) return startDate
  if (startDate && endDate) return `${startDate} to ${endDate}`
  if (startDate) return `Since ${startDate}`
  return `Until ${endDate}`
}

function buildMuscleScopeLabel(selectedMuscle: string) {
  return MUSCLE_LABELS[selectedMuscle] ?? toTitleCase(selectedMuscle)
}

function buildExerciseScopeLabel(selectedExercise: string) {
  return selectedExercise === 'all' ? 'All exercises' : selectedExercise
}

function pushByPriority(
  categories: Map<string, CandidateInsight>,
  candidate: CandidateInsight
) {
  const existing = categories.get(candidate.category)
  if (!existing || candidate.priority > existing.priority) {
    categories.set(candidate.category, candidate)
  }
}

export function buildFilterScopeSummary(input: FilterScopeInput): FilterScopeSummary {
  const dateScope = buildDateScopeLabel(input.startDate, input.endDate)
  const muscleScope = buildMuscleScopeLabel(input.selectedMuscle)
  const exerciseScope = buildExerciseScopeLabel(input.selectedExercise)
  const isFiltered =
    Boolean(input.startDate || input.endDate)
    || input.selectedMuscle !== 'all'
    || input.selectedExercise !== 'all'

  return {
    isFiltered,
    parts: [dateScope, muscleScope, exerciseScope],
    label: `${dateScope} • ${muscleScope} • ${exerciseScope}`
  }
}

export function buildActionScopeSummary(input: ActionScopeInput): ActionScopeSummary {
  const muscleScope = buildMuscleScopeLabel(input.selectedMuscle)
  const exerciseScope = buildExerciseScopeLabel(input.selectedExercise)

  return {
    parts: [input.timeHorizonLabel, muscleScope, exerciseScope],
    label: `${input.timeHorizonLabel} • ${muscleScope} • ${exerciseScope}`
  }
}

export function generateCoachFeedInsights(input: CoachFeedInput): CoachInsight[] {
  if (input.filteredSessionCount === 0) {
    return [{
      id: 'insufficient-data',
      tone: 'warning',
      title: 'Not enough recent data for targeted coaching',
      summary: 'No completed sessions were found in the action horizon, so specific adjustments are not reliable yet.',
      whyNow: `Actions are based on ${input.timeHorizonLabel.toLowerCase()}.`,
      nextStep: 'Log one full session with reps, load, and effort so the next recommendation is specific.',
      metric: '0 sessions',
      confidence: 'low',
      timeHorizonLabel: input.timeHorizonLabel,
      validUntil: null
    }]
  }

  const byCategory = new Map<string, CandidateInsight>()
  const readinessKnown = typeof input.readinessScore === 'number'
  const effortKnown = typeof input.avgEffort === 'number'
  const load = input.trainingLoadSummary

  if (!load.insufficientData && !load.isInitialPhase && load.status === 'overreaching') {
    pushByPriority(byCategory, {
      category: 'load-risk',
      id: 'overreaching-load',
      tone: 'critical',
      title: 'Load is above sustainable range',
      summary: `Acute:chronic ratio is ${load.loadRatio.toFixed(2)}, indicating a short-term spike.`,
      whyNow: 'Continuing at this rate raises fatigue and injury risk in the next few sessions.',
      nextStep: 'Reduce your next 1-2 sessions by 20-30% volume and cap top sets at RPE 7.',
      metric: `ACR ${load.loadRatio.toFixed(2)}`,
      confidence: 'high',
      timeHorizonLabel: input.timeHorizonLabel,
      validUntil: null,
      priority: 98
    })
  } else if (!load.insufficientData && !load.isInitialPhase && load.status === 'undertraining') {
    pushByPriority(byCategory, {
      category: 'load-risk',
      id: 'undertraining-load',
      tone: 'opportunity',
      title: 'Training stimulus is below productive range',
      summary: `Acute:chronic ratio is ${load.loadRatio.toFixed(2)}, below your normal loading band.`,
      whyNow: 'Low stimulus can stall adaptation even if effort feels manageable day-to-day.',
      nextStep: 'Add one moderate session this week or add 2-4 hard sets to your next primary lift day.',
      metric: `ACR ${load.loadRatio.toFixed(2)}`,
      confidence: 'medium',
      timeHorizonLabel: input.timeHorizonLabel,
      validUntil: null,
      priority: 86
    })
  }

  if (readinessKnown && effortKnown && input.readinessScore !== null && input.avgEffort !== null) {
    if (input.readinessScore < READINESS_LOW_THRESHOLD && input.avgEffort >= EFFORT_HIGH_THRESHOLD) {
      pushByPriority(byCategory, {
        category: 'recovery-mismatch',
        id: 'high-effort-low-readiness',
        tone: 'warning',
        title: 'Effort is too high for current recovery',
        summary: `Readiness is ${Math.round(input.readinessScore)} while average effort is ${input.avgEffort.toFixed(1)}/10.`,
        whyNow: 'Pushing hard when recovery is low usually reduces output and increases accumulated fatigue.',
        nextStep: 'Keep next-session top sets at RPE 6-7, then reassess readiness before reloading.',
        metric: `${Math.round(input.readinessScore)} readiness`,
        confidence: 'medium',
        timeHorizonLabel: input.timeHorizonLabel,
        validUntil: null,
        priority: 92
      })
    }

    if (input.readinessScore >= READINESS_HIGH_THRESHOLD && input.avgEffort < EFFORT_HIGH_THRESHOLD) {
      pushByPriority(byCategory, {
        category: 'recovery-mismatch',
        id: 'underpushing-high-readiness',
        tone: 'opportunity',
        title: 'Recovery is high but intensity is conservative',
        summary: `Readiness is ${Math.round(input.readinessScore)} with average effort ${input.avgEffort.toFixed(1)}/10.`,
        whyNow: 'You currently have recovery headroom to progress load or hard-set exposure safely.',
        nextStep: 'Add 1 top-set load jump (1-2%) or 1 extra hard set on your next main movement.',
        metric: `${Math.round(input.readinessScore)} readiness`,
        confidence: 'medium',
        timeHorizonLabel: input.timeHorizonLabel,
        validUntil: null,
        priority: 78
      })
    }
  }

  if (input.filteredSessionCount >= 3 && input.sessionsPerWeek < 2) {
    pushByPriority(byCategory, {
      category: 'consistency-gap',
      id: 'consistency-gap',
      tone: 'warning',
      title: 'Weekly consistency is below progression target',
      summary: `Current cadence is ${input.sessionsPerWeek.toFixed(1)} sessions/week in this horizon.`,
      whyNow: 'Progressive overload is less reliable when session timing is inconsistent week-to-week.',
      nextStep: 'Lock two fixed training windows for the next 7 days before adding more volume.',
      metric: `${input.sessionsPerWeek.toFixed(1)} / week`,
      confidence: 'high',
      timeHorizonLabel: input.timeHorizonLabel,
      validUntil: null,
      priority: 84
    })
  }

  if (load.daysSinceLast !== null && load.daysSinceLast >= 4) {
    pushByPriority(byCategory, {
      category: 'session-gap',
      id: 'session-gap',
      tone: 'opportunity',
      title: 'Recent training gap detected',
      summary: `Last session in this horizon was ${load.daysSinceLast.toFixed(1)} days ago.`,
      whyNow: 'A long gap can make the next full-intensity session feel disproportionately difficult.',
      nextStep: 'Run a re-entry session at 80-90% of your last normal workload, then ramp on session two.',
      metric: `${load.daysSinceLast.toFixed(1)} days`,
      confidence: 'high',
      timeHorizonLabel: input.timeHorizonLabel,
      validUntil: null,
      priority: 82
    })
  }

  const selected: CoachInsight[] = Array.from(byCategory.values())
    .sort((left, right) => {
      if (right.priority !== left.priority) return right.priority - left.priority
      return left.id.localeCompare(right.id)
    })
    .slice(0, 2)
    .map((insight) => {
      const { category, priority, ...rest } = insight
      void category
      void priority
      return rest
    })

  if (selected.length > 0) {
    return selected
  }

  return [{
    id: 'stable-on-track',
    tone: 'positive',
    title: 'No immediate correction needed',
    summary: 'Recent sessions are tracking inside a stable range for load, effort, and frequency.',
    whyNow: 'There is no high-urgency mismatch to correct before your next session.',
    nextStep: 'Maintain your current plan and make only small overload steps (1-2% load or +1 rep).',
    metric: `${input.hardSets} hard sets`,
    confidence: 'high',
    timeHorizonLabel: input.timeHorizonLabel,
    validUntil: null
  }]
}
