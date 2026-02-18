'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useSupabase } from '@/hooks/useSupabase'
import { useUser } from '@/hooks/useUser'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { clearDevData, seedDevData } from '@/lib/dev-seed'

type DeveloperToolsPanelProps = {
  onSuccess?: (msg: string) => void
  onError?: (msg: string) => void
}

type DevAction = {
  type: 'seed' | 'clear'
  title: string
  description: string
}

export function DeveloperToolsPanel({ onSuccess, onError }: DeveloperToolsPanelProps) {
  const supabase = useSupabase()
  const { user } = useUser()

  const [devActionState, setDevActionState] = useState<'idle' | 'seeding' | 'clearing'>('idle')
  const [devActionMessage, setDevActionMessage] = useState<string | null>(null)
  const [confirmDevAction, setConfirmDevAction] = useState<DevAction | null>(null)

  const executeSeedData = async () => {
    if (!user || devActionState !== 'idle') {
      onError?.('You are not allowed to use developer tools.')
      return
    }

    setDevActionState('seeding')
    setDevActionMessage(null)

    try {
      const result = await seedDevData(supabase, user.id)
      const readiness = result.readiness ? `, ${result.readiness} readiness entries` : ''

      setDevActionMessage(
        `Seeded ${result.templates} templates, ${result.sessions} sessions, ${result.exercises} exercises, ${result.sets} sets${readiness}.`
      )
      onSuccess?.('Development data seeded.')
    } catch (error) {
      console.error('Failed to seed dev data', error)
      onError?.('Unable to seed dev data.')
    } finally {
      setDevActionState('idle')
    }
  }

  const executeClearSeededData = async () => {
    if (!user || devActionState !== 'idle') {
      onError?.('You are not allowed to use developer tools.')
      return
    }

    setDevActionState('clearing')
    setDevActionMessage(null)

    try {
      const result = await clearDevData(supabase, user.id)
      const readiness = result.readiness ? `, ${result.readiness} readiness entries` : ''
      const measurements = result.measurements ? `, ${result.measurements} body measurements` : ''

      setDevActionMessage(
        `Cleared ${result.templates} templates, ${result.sessions} sessions${readiness}${measurements}.`
      )
      onSuccess?.('Seeded data cleared.')
    } catch (error) {
      console.error('Failed to clear dev data', error)
      onError?.('Unable to clear dev data.')
    } finally {
      setDevActionState('idle')
    }
  }

  const handleConfirmAction = async () => {
    if (!confirmDevAction) return

    if (confirmDevAction.type === 'seed') await executeSeedData()
    if (confirmDevAction.type === 'clear') await executeClearSeededData()

    setConfirmDevAction(null)
  }

  return (
    <Card className="p-6 border-accent/20 bg-accent/5">
      <div>
        <h2 className="text-sm font-semibold text-strong">Developer tools</h2>
        <p className="text-xs text-subtle">
          Seed temporary workout data for development and wipe it clean when you are done.
        </p>
      </div>

      {devActionMessage ? <p className="mt-3 text-xs text-accent font-medium">{devActionMessage}</p> : null}

      <div className="mt-4 flex flex-wrap gap-2">
        <Link href="/exercises">
          <Button type="button" size="sm" variant="outline">
            Exercise Catalog
          </Button>
        </Link>
        <Button
          type="button"
          size="sm"
          onClick={() => setConfirmDevAction({
            type: 'seed',
            title: 'Seed Dev Data',
            description: 'This will insert a batch of simulated workout data for your account. You can clear it later.'
          })}
          disabled={devActionState !== 'idle'}
        >
          {devActionState === 'seeding' ? 'Seeding...' : 'Seed dev data'}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => setConfirmDevAction({
            type: 'clear',
            title: 'Clear Dev Data',
            description: 'This will delete all seeded workout templates and sessions for your account. This cannot be undone.'
          })}
          disabled={devActionState !== 'idle'}
        >
          {devActionState === 'clearing' ? 'Clearing...' : 'Clear seeded data'}
        </Button>
      </div>

      <ConfirmDialog
        isOpen={Boolean(confirmDevAction)}
        onClose={() => setConfirmDevAction(null)}
        onConfirm={handleConfirmAction}
        title={confirmDevAction?.title ?? ''}
        description={confirmDevAction?.description ?? ''}
        confirmText={confirmDevAction?.type === 'seed' ? 'Seed Data' : 'Clear Data'}
        variant={confirmDevAction?.type === 'clear' ? 'danger' : 'info'}
        isLoading={devActionState !== 'idle'}
      />
    </Card>
  )
}