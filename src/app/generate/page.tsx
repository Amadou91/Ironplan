'use client'

import { useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { useUser } from '@/hooks/useUser'
import { ArrowRight, Loader2, Wand2, X } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { formatWeightList, bandLabels, machineLabels } from '@/lib/equipment'
import { getFlowCompletion, isEquipmentValid } from '@/lib/generationFlow'
import { EquipmentSelector, cardioMachineOptions, strengthMachineOptions } from '@/components/generate/EquipmentSelector'
import { MuscleGroupSelector } from '@/components/generate/MuscleGroupSelector'
import { TemplateHistory } from '@/components/generate/TemplateHistory'
import { GenerationSummary } from '@/components/generate/GenerationSummary'
import { useGenerationFlow } from '@/hooks/useGenerationFlow'

export default function GeneratePage() {
  const router = useRouter()
  const { loading: userLoading } = useUser()
  const {
    formData,
    loading,
    errors,
    saveError,
    saveSummary,
    lastSavedTemplate,
    historyError,
    historyEntries,
    deletingHistoryIds,
    startSessionError,
    startingSessionKey,
    updateFormData,
    handleFocusChange,
    updatePrimaryStyle,
    handleHistoryLoad,
    handleHistoryDelete,
    handleStartSession,
    generatePlanHandler
  } = useGenerationFlow()

  const flowState = useMemo(() => getFlowCompletion(formData), [formData])

  const invalidEquipment = !isEquipmentValid(formData.equipment)
  const isCardioStyle = formData.intent.bodyParts?.[0] === 'cardio'
  const isMobilityStyle = formData.intent.bodyParts?.[0] === 'mobility'
  const inventory = formData.equipment.inventory

  const equipmentSummary = (
    isCardioStyle || isMobilityStyle
      ? [
          inventory.bodyweight ? 'Bodyweight' : null,
          ...(isCardioStyle ? cardioMachineOptions : [])
            .filter((machine) => inventory.machines[machine])
            .map((machine) => machineLabels[machine])
        ]
      : [
          inventory.bodyweight ? 'Bodyweight' : null,
          inventory.dumbbells.length > 0 ? `Dumbbells (${formatWeightList(inventory.dumbbells)} lb)` : null,
          inventory.kettlebells.length > 0 ? `Kettlebells (${formatWeightList(inventory.kettlebells)} lb)` : null,
          inventory.bands.length > 0 ? `Bands (${inventory.bands.map((band) => bandLabels[band]).join(', ')})` : null,
          inventory.barbell.available
            ? `Barbell${inventory.barbell.plates.length ? ` + Plates (${formatWeightList(inventory.barbell.plates)} lb)` : ''}`
            : null,
          strengthMachineOptions
            .filter((machine) => inventory.machines[machine])
            .map((machine) => machineLabels[machine])
            .join(', ') || null
        ]
  ).filter(Boolean) as string[]

  const statusContent = () => {
    if (loading) {
      return (
        <div className="flex items-center gap-2 text-sm text-accent">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          Saving your workout template...
        </div>
      )
    }

    if (saveError) {
      return <div className="text-sm text-[var(--color-danger)]">{saveError}</div>
    }

    if (saveSummary) {
      return (
        <div className="space-y-3 text-sm text-muted">
          {saveSummary.title && <div className="alert-success px-3 py-2">Saved template: {saveSummary.title}</div>}
          {startSessionError && <div className="text-[var(--color-danger)]">{startSessionError}</div>}
        </div>
      )
    }

    if (errors.length > 0) {
      return (
        <div className="text-sm text-[var(--color-danger)]">
          Review the items below and resolve them before saving your template.
        </div>
      )
    }

    if (!flowState.isFormValid) {
      return <div className="text-sm text-muted">Complete the required steps to unlock generation.</div>
    }

    return <div className="text-sm text-muted">Everything looks good. Save your template when ready.</div>
  }

  if (userLoading) return <div className="page-shell p-8 text-center text-muted">Loading...</div>

  return (
    <div className="page-shell">
      <div className="mb-8 px-4 pt-8 sm:px-6 lg:px-10 2xl:px-16">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="flex items-center text-3xl font-semibold text-strong">
              <Wand2 className="mr-3 h-8 w-8 text-accent" />
              Generate Workout Plan
            </h1>
            <p className="mt-2 text-muted">
              Answer each step to create a template that matches your training style, schedule, and preferences.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button type="button" variant="ghost" onClick={() => router.push('/dashboard')}>
              <X className="h-4 w-4" /> Close
            </Button>
          </div>
        </div>
      </div>

      <div className="px-4 pb-10 sm:px-6 lg:px-10 2xl:px-16">
        <Card className="p-6">
          <div className="space-y-10">
            <section className="space-y-4" id="step-intent">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-subtle">Step 1</p>
                <h2 className="text-xl font-semibold text-strong">Choose your workout focus</h2>
                <p className="text-sm text-muted">Pick a muscle group, or select Yoga / Mobility or Cardio.</p>
              </div>

              <MuscleGroupSelector
                selectedFocus={formData.intent.bodyParts?.[0]}
                onFocusChange={handleFocusChange}
              />
            </section>

            <section className="space-y-6">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-subtle">Step 2</p>
                <h2 className="text-xl font-semibold text-strong">Equipment & constraints</h2>
                <p className="text-sm text-muted">Tell us what you have and any important preferences.</p>
              </div>

              <EquipmentSelector
                equipment={formData.equipment}
                isCardioStyle={isCardioStyle}
                isMobilityStyle={isMobilityStyle}
                onUpdateEquipment={(updater) =>
                  updateFormData((prev) => ({
                    ...prev,
                    equipment: updater(prev.equipment)
                  }))
                }
              />

              {invalidEquipment && <p className="text-xs text-[var(--color-danger)]">Choose at least one equipment option.</p>}
            </section>

            <section className="space-y-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-subtle">Step 3</p>
                <h2 className="text-xl font-semibold text-strong">Review & generate</h2>
                <p className="text-sm text-muted">Confirm the highlights before we save your template.</p>
              </div>

              <GenerationSummary
                formData={formData}
                isCardioStyle={isCardioStyle}
                isMobilityStyle={isMobilityStyle}
                equipmentSummary={equipmentSummary}
              />

              <div className="surface-card-subtle p-4" aria-live="polite">
                {statusContent()}
                {errors.length > 0 && (
                  <ul className="mt-3 list-disc space-y-1 pl-5 text-xs text-[var(--color-danger)]">
                    {errors.map((error) => (
                      <li key={error}>{error}</li>
                    ))}
                  </ul>
                )}
              </div>

              <Button
                onClick={async () => {
                  await generatePlanHandler()
                }}
                disabled={loading || !flowState.isFormValid}
                className="w-full py-5 text-base"
                aria-label="Generate Workout Plan"
              >
                {loading ? (
                  <span className="flex items-center justify-center">
                    <Loader2 className="animate-spin mr-2 h-5 w-5" /> Generating...
                  </span>
                ) : (
                  <>
                    <Wand2 className="w-5 h-5 mr-2" />
                    Generate Plan
                  </>
                )}
              </Button>
            </section>
          </div>
        </Card>

        <TemplateHistory
          historyEntries={historyEntries}
          onLoadHistory={handleHistoryLoad}
          onDeleteHistory={handleHistoryDelete}
          onStartSession={handleStartSession}
          startingSessionKey={startingSessionKey}
          historyError={historyError}
          startSessionError={startSessionError}
          deletingHistoryIds={deletingHistoryIds}
        />

        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-xs text-subtle">Done here? Head back to your workouts or jump into your latest template.</div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="ghost" onClick={() => router.push('/dashboard')}>
              Back to workouts <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
            <Button
              type="button"
              onClick={() => {
                if (!lastSavedTemplate) return
                handleStartSession({ templateId: lastSavedTemplate.templateId, sessionKey: 'latest-start' })
              }}
              disabled={!lastSavedTemplate || startingSessionKey === 'latest-start'}
            >
              {startingSessionKey === 'latest-start' ? 'Starting...' : 'Start latest session'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}