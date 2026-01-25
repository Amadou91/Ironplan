'use client'

import type { PlanInput } from '@/types/domain'

interface GenerationSummaryProps {
  formData: PlanInput
  isCardioStyle: boolean
  isYogaStyle: boolean
  equipmentSummary: string[]
}

export function GenerationSummary({
  formData,
  isCardioStyle,
  isYogaStyle,
  equipmentSummary
}: GenerationSummaryProps) {
  return (
    <div className="surface-card-subtle p-4">
      <h3 className="mb-3 text-sm font-semibold text-strong">Selection summary</h3>
      <dl className="grid gap-3 text-sm md:grid-cols-2">
        <div>
          <dt className="text-subtle">Muscle focus</dt>
          <dd className="text-strong capitalize">
            {isYogaStyle ? 'Yoga' : isCardioStyle ? 'Cardio' : formData.intent.bodyParts?.[0]?.replace('_', ' ') ?? 'Not set'}
          </dd>
        </div>
        {!isYogaStyle && !isCardioStyle && (
          <div>
            <dt className="text-subtle">Training style</dt>
            <dd className="text-strong capitalize">{(formData.intent.style ?? formData.goals.primary).replace('_', ' ')}</dd>
          </div>
        )}
        <div>
          <dt className="text-subtle">Equipment</dt>
          <dd className="text-strong">{equipmentSummary.length ? equipmentSummary.join(', ') : 'Not set'}</dd>
        </div>
      </dl>
    </div>
  )
}
