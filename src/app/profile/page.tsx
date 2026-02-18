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

export default function ProfilePage() {
  const router = useRouter()
  const { user, loading: userLoading } = useUser()
  
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  
  // Dev Tools State
  const devToolsKey = 'ironplan-dev-tools'
  const isDevMode = process.env.NODE_ENV !== 'production'
  
  const [devToolsEnabled, setDevToolsEnabled] = useState(() => {
    if (typeof window !== 'undefined' && isDevMode) {
      return localStorage.getItem(devToolsKey) === 'true'
    }
    return false
  })
  const [devToolsNotice, setDevToolsNotice] = useState<string | null>(null)

  const toggleDevTools = () => {
    if (!isDevMode) return
    setDevToolsEnabled((prev) => {
      const next = !prev
      localStorage.setItem(devToolsKey, String(next))
      setDevToolsNotice(next ? 'Developer tools enabled.' : 'Developer tools hidden.')
      setTimeout(() => setDevToolsNotice(null), 2000)
      return next
    })
  }

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

        <ProfileHeader 
          user={user} 
          onToggleDevTools={toggleDevTools} 
          devToolsNotice={devToolsNotice} 
        />

        {error ? <Alert variant="error">{error}</Alert> : null}
        {!error && success ? <Alert variant="success">{success}</Alert> : null}

        <section className="space-y-6">
          <h2 className="text-xl font-semibold text-strong">Training defaults</h2>
          <AppSettings 
            devToolsEnabled={devToolsEnabled} 
            onSuccess={handleSuccess} 
            onError={handleError} 
          />
        </section>

        <hr className="border-[var(--color-border)]" />

        <section className="space-y-6">
          <h2 className="text-xl font-semibold text-strong">Body metrics & history</h2>
          <PhysicalStatsForm 
            onSuccess={handleSuccess} 
            onError={handleError} 
          />
        </section>
      </div>
    </div>
  )
}