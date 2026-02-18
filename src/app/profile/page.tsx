'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useUser } from '@/hooks/useUser'
import { Button } from '@/components/ui/Button'
import { PageHeader } from '@/components/ui/PageHeader'
import { Alert } from '@/components/ui/Alert'
import { EmptyState } from '@/components/ui/EmptyState'
import { Skeleton } from '@/components/ui/Skeleton'
import { ProfileHeader } from '@/components/profile/ProfileHeader'
import { PhysicalStatsForm } from '@/components/profile/PhysicalStatsForm'
import { AppSettings } from '@/components/profile/AppSettings'
import { EquipmentSettingsForm } from '@/components/profile/EquipmentSettingsForm'
import { DeveloperToolsPanel } from '@/components/profile/DeveloperToolsPanel'
import { isDeveloperToolsUser } from '@/lib/developer-access'

export default function ProfilePage() {
  const router = useRouter()
  const { user, loading: userLoading } = useUser()
  
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [activeSection, setActiveSection] = useState<'defaults' | 'equipment' | 'metrics'>('defaults')
  
  const devToolsEnabled = isDeveloperToolsUser(user?.email)

  const handleSuccess = (msg: string) => {
    setSuccess(msg)
    setError(null)
    setTimeout(() => setSuccess(null), 3000)
  }

  const handleError = (msg: string) => {
    setError(msg)
    setSuccess(null)
    setTimeout(() => setError(null), 5000)
  }

  if (userLoading) {
    return (
      <div className="page-shell page-stack">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-72 w-full" />
      </div>
    )
  }

  if (!user) {
    return (
      <div className="page-shell page-stack">
        <EmptyState
          title="Sign in to manage your profile"
          description="Access your physical stats, app preferences, and training metrics settings."
          action={<Button onClick={() => router.push('/auth/login')}>Sign in</Button>}
        />
      </div>
    )
  }

  return (
    <div className="page-shell">
      <div className="page-stack">
        <PageHeader
          eyebrow="Account"
          title="Profile & Settings"
          description="Keep your training profile current and tune your app experience."
        />

        <ProfileHeader user={user} />

        <div className="sm:hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-subtle)] p-1">
          <div className="grid grid-cols-3 gap-1">
            <Button
              type="button"
              size="sm"
              variant={activeSection === 'defaults' ? 'primary' : 'ghost'}
              onClick={() => setActiveSection('defaults')}
              className="h-10 text-xs font-bold uppercase tracking-[0.06em]"
            >
              Preferences
            </Button>
            <Button
              type="button"
              size="sm"
              variant={activeSection === 'equipment' ? 'primary' : 'ghost'}
              onClick={() => setActiveSection('equipment')}
              className="h-10 text-xs font-bold uppercase tracking-[0.06em]"
            >
              Equipment
            </Button>
            <Button
              type="button"
              size="sm"
              variant={activeSection === 'metrics' ? 'primary' : 'ghost'}
              onClick={() => setActiveSection('metrics')}
              className="h-10 text-xs font-bold uppercase tracking-[0.06em]"
            >
              Body Metrics
            </Button>
          </div>
        </div>

        {error ? <Alert variant="error">{error}</Alert> : null}
        {!error && success ? <Alert variant="success">{success}</Alert> : null}

        <section className={`space-y-6 ${activeSection !== 'defaults' ? 'hidden sm:block' : ''}`}>
          <h2 className="text-xl font-semibold text-strong">Training defaults</h2>
          <AppSettings 
            onSuccess={handleSuccess} 
            onError={handleError} 
          />
        </section>

        <hr className={`border-[var(--color-border)] ${activeSection === 'metrics' ? 'hidden sm:block' : ''}`} />

        <section className={`space-y-6 ${activeSection !== 'equipment' ? 'hidden sm:block' : ''}`}>
          <h2 className="text-xl font-semibold text-strong">Workout equipment</h2>
          <EquipmentSettingsForm
            onSuccess={handleSuccess}
            onError={handleError}
          />
        </section>

        <hr className={`border-[var(--color-border)] ${activeSection !== 'metrics' ? 'hidden sm:block' : ''}`} />

        <section className={`space-y-6 ${activeSection !== 'metrics' ? 'hidden sm:block' : ''}`}>
          <h2 className="text-xl font-semibold text-strong">Body metrics & history</h2>
          <PhysicalStatsForm 
            onSuccess={handleSuccess} 
            onError={handleError} 
          />
        </section>

        {devToolsEnabled ? (
          <>
            <hr className="border-[var(--color-border)]" />
            <section className="space-y-6">
              <h2 className="text-xl font-semibold text-strong">Developer tools</h2>
              <DeveloperToolsPanel onSuccess={handleSuccess} onError={handleError} />
            </section>
          </>
        ) : null}
      </div>
    </div>
  )
}