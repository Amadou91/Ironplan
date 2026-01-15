import type { PlanInput } from '@/types/domain'
import { hasEquipment } from './equipment'

export const isMinutesPerSessionValid = (minutes: number) => minutes >= 20 && minutes <= 120

export const isTotalMinutesPerWeekValid = (minutes?: number) =>
  minutes === undefined || (minutes >= 40 && minutes <= 480)

export const isEquipmentValid = (equipment: PlanInput['equipment']) => hasEquipment(equipment.inventory)
export const DEFAULT_PLAN_STATUS = 'DRAFT'

const isIntentValid = (intent: PlanInput['intent']) => {
  if (intent.mode === 'style') return Boolean(intent.style)
  return Boolean(intent.bodyParts && intent.bodyParts.length > 0)
}

export const getFlowCompletion = (input: PlanInput) => {
  const goalStepComplete = Boolean(input.goals.primary) && Boolean(input.experienceLevel) && isIntentValid(input.intent)
  const durationStepComplete =
    goalStepComplete &&
    Boolean(input.intensity) &&
    isMinutesPerSessionValid(input.time.minutesPerSession) &&
    isTotalMinutesPerWeekValid(input.time.totalMinutesPerWeek)
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
