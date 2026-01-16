import type { PlanInput } from '@/types/domain'
import { hasEquipment } from './equipment'

export const isEquipmentValid = (equipment: PlanInput['equipment']) => hasEquipment(equipment.inventory)

const isIntentValid = (intent: PlanInput['intent']) => {
  if (intent.mode === 'style') return Boolean(intent.style)
  return Boolean(intent.bodyParts && intent.bodyParts.length > 0)
}

export const getFlowCompletion = (input: PlanInput) => {
  const goalStepComplete = Boolean(input.goals.primary) && Boolean(input.experienceLevel) && isIntentValid(input.intent)
  const intensityStepComplete = goalStepComplete && Boolean(input.intensity)
  const equipmentStepComplete = intensityStepComplete && isEquipmentValid(input.equipment)
  const preferencesStepComplete = equipmentStepComplete
  const reviewStepComplete = preferencesStepComplete

  return {
    goalStepComplete,
    intensityStepComplete,
    equipmentStepComplete,
    preferencesStepComplete,
    reviewStepComplete,
    isFormValid: reviewStepComplete
  }
}
