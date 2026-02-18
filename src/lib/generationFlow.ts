import type { PlanInput } from '@/types/domain'
import { hasEquipment } from '@/lib/equipment'

export const isEquipmentValid = (equipment: PlanInput['equipment']) => hasEquipment(equipment.inventory)

const isIntentValid = (intent?: PlanInput['intent']) => {
  if (!intent) return true
  if (intent.mode === 'style') return Boolean(intent.style)
  return Boolean(intent.bodyParts && intent.bodyParts.length > 0)
}

export const getFlowCompletion = (input: Partial<PlanInput>) => {
  const goalStepComplete = Boolean(input.goals?.primary) && Boolean(input.experienceLevel) && isIntentValid(input.intent)
  const intensityStepComplete = goalStepComplete && Boolean(input.intensity)
  const equipmentStepComplete = intensityStepComplete && Boolean(input.equipment) && isEquipmentValid(input.equipment!)
  const preferencesStepComplete = equipmentStepComplete
  const daysAvailable = input.schedule?.daysAvailable ?? []
  const minutesPerSession = input.time?.minutesPerSession ?? 0
  const totalMinutesPerWeek = input.time?.totalMinutesPerWeek
  const minutesInRange = minutesPerSession >= 20 && minutesPerSession <= 120
  const totalMinutesInRange =
    totalMinutesPerWeek === undefined || (totalMinutesPerWeek >= 40 && totalMinutesPerWeek <= 300)
  const durationStepComplete = preferencesStepComplete && daysAvailable.length > 0 && minutesInRange && totalMinutesInRange
  const reviewStepComplete = durationStepComplete

  return {
    goalStepComplete,
    intensityStepComplete,
    equipmentStepComplete,
    preferencesStepComplete,
    durationStepComplete,
    reviewStepComplete,
    isFormValid: reviewStepComplete
  }
}
