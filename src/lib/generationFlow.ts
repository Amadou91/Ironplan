import type { PlanInput } from '@/types/domain'

export const isMinutesPerSessionValid = (minutes: number) => minutes >= 20 && minutes <= 120

export const isTotalMinutesPerWeekValid = (minutes?: number) =>
  minutes === undefined || (minutes >= 40 && minutes <= 480)

export const isDaysAvailableValid = (days: number[]) => days.length > 0

export const isEquipmentValid = (equipment: PlanInput['equipment']) => equipment.length > 0

export const getFlowCompletion = (input: PlanInput) => {
  const goalStepComplete = Boolean(input.goals.primary) && Boolean(input.experienceLevel)
  const durationStepComplete =
    goalStepComplete &&
    Boolean(input.intensity) &&
    isMinutesPerSessionValid(input.time.minutesPerSession) &&
    isTotalMinutesPerWeekValid(input.time.totalMinutesPerWeek) &&
    isDaysAvailableValid(input.schedule.daysAvailable)
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
