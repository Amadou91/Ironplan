import type { PlanInput } from '@/types/domain'
import { hasEquipment } from './equipment'

export const isMinutesPerSessionValid = (minutes: number) => minutes >= 20 && minutes <= 120

export const isTotalMinutesPerWeekValid = (minutes?: number) =>
  minutes === undefined || (minutes >= 40 && minutes <= 480)

export const isDaysAvailableValid = (days: number[]) => days.length > 0

export const isEquipmentValid = (equipment: PlanInput['equipment']) => hasEquipment(equipment.inventory)
export const DEFAULT_PLAN_STATUS = 'DRAFT'

const isIntentValid = (intent: PlanInput['intent']) => {
  if (intent.mode === 'style') return Boolean(intent.style)
  return Boolean(intent.bodyParts && intent.bodyParts.length > 0)
}

const isWeeklyLayoutValid = (schedule: PlanInput['schedule']) => {
  if (!schedule.weeklyLayout || schedule.weeklyLayout.length === 0) return false
  const layoutDays = new Set(schedule.weeklyLayout.map((entry) => entry.sessionIndex))
  return schedule.daysAvailable.every((day) => layoutDays.has(day))
}

export const getFlowCompletion = (input: PlanInput) => {
  const goalStepComplete = Boolean(input.goals.primary) && Boolean(input.experienceLevel) && isIntentValid(input.intent)
  const durationStepComplete =
    goalStepComplete &&
    Boolean(input.intensity) &&
    isMinutesPerSessionValid(input.time.minutesPerSession) &&
    isTotalMinutesPerWeekValid(input.time.totalMinutesPerWeek) &&
    isDaysAvailableValid(input.schedule.daysAvailable) &&
    isWeeklyLayoutValid(input.schedule)
  const equipmentStepComplete = durationStepComplete && isEquipmentValid(input.equipment)
  const preferencesStepComplete = equipmentStepComplete
  const reviewStepComplete = preferencesStepComplete

  return {
    goalStepComplete,
    durationStepComplete,
    equipmentStepComplete,
    preferencesStepComplete,
    reviewStepComplete,
    isFormValid: reviewStepComplete
  }
}
