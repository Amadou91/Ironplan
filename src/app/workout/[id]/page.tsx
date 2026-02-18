'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { Activity } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { SessionSetupModal } from '@/components/dashboard/SessionSetupModal'
import { createClient } from '@/lib/supabase/client'
import { toMuscleLabel } from '@/lib/muscle-utils'
import { buildTemplateDisplayName } from '@/lib/workout-naming'
import { useUser } from '@/hooks/useUser'
import { useWorkoutStore } from '@/store/useWorkoutStore'
import type { FocusArea, PlanInput } from '@/types/domain'

type WorkoutTemplate = {
  id: string
  title: string
  description: string | null
  focus: FocusArea
  style: PlanInput['goals']['primary']
  experience_level: PlanInput['experienceLevel']
  intensity: PlanInput['intensity']
  template_inputs: PlanInput | null
  created_at: string
}

export default function WorkoutDetailPage() {
  const params = useParams()
  const searchParams = useSearchParams()
  const router = useRouter()
  const supabase = createClient()
  const { user } = useUser()
  const activeSession = useWorkoutStore((state) => state.activeSession)
  const [template, setTemplate] = useState<WorkoutTemplate | null>(null)
  const [loading, setLoading] = useState(true)
  const [isSetupModalOpen, setIsSetupModalOpen] = useState(() => searchParams.get('start') === '1')

  useEffect(() => {
    const fetchTemplate = async () => {
      const { data, error } = await supabase
        .from('workout_templates')
        .select(`
          id, user_id, title, description, focus, style, 
          experience_level, intensity, equipment, preferences, 
          template_inputs, created_at
        `)
        .eq('id', params.id)
        .single()

      if (error) {
        console.error('Error fetching template:', error)
      } else {
        setTemplate(data)
      }
      setLoading(false)
    }

    if (params.id) fetchTemplate()
  }, [params.id, supabase])

  const equipmentSummary = useMemo(() => {
    const inventory = template?.template_inputs?.equipment?.inventory
    if (!inventory) return []
    const labels: string[] = []
    if (inventory.bodyweight) labels.push('Bodyweight')
    if (inventory.benchPress) labels.push('Bench Press')
    if (inventory.dumbbells?.length) labels.push(`Dumbbells (${inventory.dumbbells.join(', ')} lb)`)
    if (inventory.kettlebells?.length) labels.push(`Kettlebells (${inventory.kettlebells.join(', ')} lb)`)
    if (inventory.bands?.length) labels.push(`Bands (${inventory.bands.join(', ')})`)
    if (inventory.barbell?.available) labels.push('Barbell')
    const machines = inventory.machines
      ? Object.entries(inventory.machines)
          .filter(([, available]) => available)
          .map(([machine]) => machine.replace('_', ' '))
      : []
    if (machines.length) labels.push(`Machines (${machines.join(', ')})`)
    return labels
  }, [template])

  const isCurrentSessionActive = activeSession?.templateId === template?.id
  const activeSessionLink = activeSession?.templateId
    ? `/exercises/${activeSession.templateId}/active?sessionId=${activeSession.id}&from=template`
    : activeSession?.id
      ? `/exercises/active?sessionId=${activeSession.id}&from=template`
      : '/dashboard'

  if (loading) return <div className="page-shell p-10 text-center text-muted">Loading template...</div>
  if (!template) return <div className="page-shell p-10 text-center text-muted">Template not found.</div>

  const displayTitle = buildTemplateDisplayName({
    focus: template.focus,
    fallback: template.title
  })

  return (
    <div className="page-shell">
      <div className="w-full px-4 py-8 sm:px-6 lg:px-10 2xl:px-16">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
              <Link href="/dashboard" className="transition-colors hover:text-strong">
                Workouts
              </Link>
              <span>/</span>
              <span className="text-subtle">{displayTitle}</span>
            </div>
            <h1 className="font-display text-3xl font-semibold text-strong">{displayTitle}</h1>
            {template.description && <p className="text-sm text-muted">{template.description}</p>}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {user ? (
              <Button size="sm" onClick={() => setIsSetupModalOpen(true)}>
                Start session
              </Button>
            ) : (
              <Button size="sm" onClick={() => router.push('/auth/login')}>
                Sign in to start
              </Button>
            )}
          </div>
        </div>

        {isCurrentSessionActive && (
          <Card className="mb-6 p-6 border-[var(--color-primary-border)] bg-[var(--color-primary-soft)]">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-[var(--color-primary-strong)]">Session in progress</p>
                <p className="text-xs text-subtle">Resume where you left off.</p>
              </div>
              <Link href={activeSessionLink}>
                <Button variant="secondary" size="sm">Resume session</Button>
              </Link>
            </div>
          </Card>
        )}

        <div className="space-y-6">
          <Card className="p-6">
            <div className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-accent" />
              <h2 className="text-lg font-semibold text-strong">Template overview</h2>
            </div>
            <p className="mt-2 text-sm text-muted">
              Use this session when you want a focused, repeatable workout with smart adjustments.
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg border border-[var(--color-border)] p-3 text-sm">
                <p className="text-xs text-subtle">Focus</p>
                <p className="font-semibold text-strong">{toMuscleLabel(template.focus)}</p>
              </div>
              <div className="rounded-lg border border-[var(--color-border)] p-3 text-sm">
                <p className="text-xs text-subtle">Style</p>
                <p className="font-semibold text-strong">{template.style.replace('_', ' ')}</p>
              </div>
            </div>
            {equipmentSummary.length > 0 && (
              <div className="mt-4">
                <p className="text-xs text-subtle">Equipment</p>
                <p className="text-sm text-muted">{equipmentSummary.join(' · ')}</p>
              </div>
            )}
          </Card>
        </div>
      </div>

      {template && user && (
        <SessionSetupModal
          isOpen={isSetupModalOpen}
          onClose={() => setIsSetupModalOpen(false)}
          templateId={template.id}
          templateTitle={displayTitle}
          templateFocus={template.focus}
          templateStyle={template.style}
          templateIntensity={template.intensity}
          templateInputs={template.template_inputs}
          templateExperienceLevel={template.experience_level}
        />
      )}
    </div>
  )
}
