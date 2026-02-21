import {
  EFFORT_HIGH_THRESHOLD,
  READINESS_HIGH_THRESHOLD,
  READINESS_LOW_THRESHOLD
} from '@/constants/training'

export type CoachInsightTone = 'critical' | 'warning' | 'opportunity' | 'positive'

export type CoachInsight = {
  id: string
  tone: CoachInsightTone
  title: string
  summary: string
  action: string
  metric: string
  priority: number
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
  exerciseTrend: Array<{
    e1rm: number
    trend: number | null
    momentum: number | null
  }>
  muscleBreakdown: Array<{
    muscle: string
    relativePct: number
    imbalanceIndex: number | null
    daysPerWeek: number
  }>
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

function asPercent(value: number) {
  return `${Math.round(value)}%`
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

export function generateCoachFeedInsights(input: CoachFeedInput): CoachInsight[] {
  const byCategory = new Map<string, CandidateInsight>()
  const readinessKnown = typeof input.readinessScore === 'number'
  const effortKnown = typeof input.avgEffort === 'number'

  if (input.filteredSessionCount === 0) {
    pushByPriority(byCategory, {
      category: 'no_data',
      id: 'no-data',
      tone: 'critical',
      title: 'No sessions in current scope',
      summary: 'There is no data for the current filter combination, so trends are not actionable yet.',
      action: 'Widen date or muscle/exercise filters, or log a session for this scope.',
      metric: '0 sessions',
      priority: 100
    })
  }

  const load = input.trainingLoadSummary
  if (!load.insufficientData && !load.isInitialPhase && load.status === 'overreaching') {
    pushByPriority(byCategory, {
      category: 'load',
      id: 'overreaching-load',
      tone: 'critical',
      title: 'Load spike is above baseline',
      summary: `Acute:chronic ratio is ${load.loadRatio.toFixed(2)}, above the sustainable range.`,
      action: 'Reduce next 1-2 sessions by 20-30% volume and keep effort at or below RPE 6-7.',
      metric: `ACR ${load.loadRatio.toFixed(2)}`,
      priority: 98
    })
  } else if (!load.insufficientData && !load.isInitialPhase && load.status === 'undertraining') {
    pushByPriority(byCategory, {
      category: 'load',
      id: 'undertraining-load',
      tone: 'opportunity',
      title: 'Training stimulus is below baseline',
      summary: `Acute:chronic ratio is ${load.loadRatio.toFixed(2)}, below your productive range.`,
      action: 'Add one moderate session this week or add 2-4 hard sets to your next lift day.',
      metric: `ACR ${load.loadRatio.toFixed(2)}`,
      priority: 84
    })
  }

  if (readinessKnown && effortKnown && input.readinessScore !== null && input.avgEffort !== null) {
    if (input.readinessScore < READINESS_LOW_THRESHOLD && input.avgEffort >= EFFORT_HIGH_THRESHOLD) {
      pushByPriority(byCategory, {
        category: 'readiness_effort',
        id: 'high-effort-low-readiness',
        tone: 'warning',
        title: 'Effort is too high for current recovery',
        summary: `Readiness is ${Math.round(input.readinessScore)} while avg effort is ${input.avgEffort.toFixed(1)}/10.`,
        action: 'Keep effort under RPE 7 until readiness rebounds above 50.',
        metric: `${Math.round(input.readinessScore)} readiness`,
        priority: 93
      })
    } else if (input.readinessScore >= READINESS_HIGH_THRESHOLD && input.avgEffort < EFFORT_HIGH_THRESHOLD) {
      pushByPriority(byCategory, {
        category: 'readiness_effort',
        id: 'underpushing-high-readiness',
        tone: 'opportunity',
        title: 'Recovery is high, but intensity is conservative',
        summary: `Readiness is ${Math.round(input.readinessScore)} with avg effort ${input.avgEffort.toFixed(1)}/10.`,
        action: 'Use your next main lift to add load or finish with 1 extra hard set.',
        metric: `${Math.round(input.readinessScore)} readiness`,
        priority: 78
      })
    }
  }

  if (input.filteredSessionCount >= 3 && input.sessionsPerWeek < 2) {
    pushByPriority(byCategory, {
      category: 'consistency',
      id: 'consistency-gap',
      tone: 'warning',
      title: 'Weekly consistency is below target',
      summary: `Current cadence is ${input.sessionsPerWeek.toFixed(1)} sessions/week.`,
      action: 'Lock 2 fixed training windows this week before adding more volume.',
      metric: `${input.sessionsPerWeek.toFixed(1)} / week`,
      priority: 80
    })
  } else if (input.filteredSessionCount >= 6 && input.sessionsPerWeek >= 3) {
    pushByPriority(byCategory, {
      category: 'consistency',
      id: 'consistency-strong',
      tone: 'positive',
      title: 'Consistency supports progression',
      summary: `You are averaging ${input.sessionsPerWeek.toFixed(1)} sessions/week in this scope.`,
      action: 'Keep schedule fixed and progress load or reps gradually week-to-week.',
      metric: `${input.sessionsPerWeek.toFixed(1)} / week`,
      priority: 65
    })
  }

  const trendWithMomentum = [...input.exerciseTrend]
    .reverse()
    .find((point) => typeof point.momentum === 'number')
  if (input.exerciseTrend.length >= 4 && trendWithMomentum && typeof trendWithMomentum.momentum === 'number') {
    const latestMomentum = trendWithMomentum.momentum
    if (latestMomentum <= 0) {
      pushByPriority(byCategory, {
        category: 'strength',
        id: 'strength-stagnation',
        tone: 'warning',
        title: 'Strength momentum has flattened',
        summary: 'Recent e1RM trend is no longer climbing for the selected scope.',
        action: 'Keep volume steady for one week and add 1-2% load to top sets next week.',
        metric: `${latestMomentum.toFixed(2)} / day`,
        priority: 82
      })
    } else if (latestMomentum >= 0.15) {
      pushByPriority(byCategory, {
        category: 'strength',
        id: 'strength-rising',
        tone: 'positive',
        title: 'Strength momentum is trending up',
        summary: 'Recent e1RM trend is moving upward with positive day-over-day slope.',
        action: 'Maintain current structure and use small progressive overload increments.',
        metric: `+${latestMomentum.toFixed(2)} / day`,
        priority: 70
      })
    }
  }

  if (input.muscleBreakdown.length >= 2) {
    const overloaded = [...input.muscleBreakdown]
      .filter((entry) => (entry.imbalanceIndex ?? 100) >= 135 && entry.relativePct >= 20)
      .sort((left, right) => right.relativePct - left.relativePct)[0]

    if (overloaded) {
      pushByPriority(byCategory, {
        category: 'muscle_balance',
        id: 'muscle-overloaded',
        tone: 'warning',
        title: `${overloaded.muscle} load is dominating`,
        summary: `${overloaded.muscle} is taking ${asPercent(overloaded.relativePct)} of scoped volume.`,
        action: `Shift 2-4 hard sets from ${overloaded.muscle} to under-trained groups this week.`,
        metric: `${asPercent(overloaded.relativePct)} volume`,
        priority: 76
      })
    }

    const underloaded = [...input.muscleBreakdown]
      .filter((entry) => (entry.imbalanceIndex ?? 100) <= 75 && entry.daysPerWeek < 1.5)
      .sort((left, right) => left.relativePct - right.relativePct)[0]

    if (underloaded) {
      pushByPriority(byCategory, {
        category: 'muscle_balance',
        id: 'muscle-underloaded',
        tone: 'opportunity',
        title: `${underloaded.muscle} is under-dosed`,
        summary: `${underloaded.muscle} appears in only ${underloaded.daysPerWeek.toFixed(1)} days/week.`,
        action: `Add one focused ${underloaded.muscle.toLowerCase()} block (2-3 hard sets) in your next session.`,
        metric: `${underloaded.daysPerWeek.toFixed(1)} d/wk`,
        priority: 74
      })
    }
  }

  if (load.daysSinceLast !== null && load.daysSinceLast >= 4 && input.filteredSessionCount > 0) {
    pushByPriority(byCategory, {
      category: 'recency',
      id: 'session-gap',
      tone: 'opportunity',
      title: 'Recent training gap detected',
      summary: `Last session in this scope was ${load.daysSinceLast.toFixed(1)} days ago.`,
      action: 'Schedule a re-entry session at 80-90% of your last normal workload.',
      metric: `${load.daysSinceLast.toFixed(1)} days`,
      priority: 79
    })
  }

  const selected: CoachInsight[] = Array.from(byCategory.values())
    .sort((left, right) => {
      if (right.priority !== left.priority) return right.priority - left.priority
      return left.id.localeCompare(right.id)
    })
    .slice(0, 3)
    .map(({ category, ...insight }) => insight)

  const fallback: CoachInsight[] = [
    {
      id: 'baseline-data-quality',
      tone: 'opportunity',
      title: 'Keep data quality high',
      summary: 'Consistent set completion and RPE logging makes coach signals materially more reliable.',
      action: 'Prioritize completing set fields for reps, load, and effort.',
      metric: `${input.hardSets} hard sets`,
      priority: 40
    },
    {
      id: 'baseline-progressive-overload',
      tone: 'opportunity',
      title: 'Progress with small weekly steps',
      summary: 'Avoid large jumps; steady progression is more sustainable and easier to recover from.',
      action: 'Increase load by 1-2% or add 1 rep on your main movement next session.',
      metric: `${input.filteredSessionCount} sessions`,
      priority: 35
    },
    {
      id: 'baseline-review',
      tone: 'positive',
      title: 'Validate with drilldown before changing plan',
      summary: 'Summary insights should be verified against exercise and session-level context.',
      action: 'Open full drilldown to validate trends before making major programming changes.',
      metric: 'Drilldown ready',
      priority: 30
    }
  ]

  for (const insight of fallback) {
    if (selected.length >= 3) break
    if (selected.some((candidate) => candidate.id === insight.id)) continue
    selected.push(insight)
  }

  return selected.slice(0, 3)
}
