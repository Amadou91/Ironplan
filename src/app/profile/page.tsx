'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useUser } from '@/hooks/useUser'
import { Button } from '@/components/ui/Button'
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
    if (typeof window === 'undefined' || !isDevMode) return false
    return localStorage.getItem(devToolsKey) === 'true'
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
      <div className="page-shell flex items-center justify-center p-10">
        <p className="text-sm text-subtle animate-pulse">Loading profile...</p>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="page-shell flex flex-col items-center justify-center p-10 text-center">
        <p className="mb-6 text-muted">Sign in to manage your profile and training metrics.</p>
        <Button onClick={() => router.push('/auth/login')}>Sign in</Button>
      </div>
    )
  }

  return (
    <div className="page-shell">
      <div className="w-full space-y-12 px-4 py-10 sm:px-6 lg:px-10 2xl:px-16">
        <ProfileHeader 
          user={user} 
          onToggleDevTools={toggleDevTools} 
          devToolsNotice={devToolsNotice} 
        />

        {(error || success) && (
          <div
            className={`rounded-xl border p-4 text-sm font-medium transition-all ${
              error
                ? 'alert-error shadow-sm'
                : 'alert-success shadow-sm'
            }`}
          >
            {error ?? success}
          </div>
        )}

        <section className="space-y-6">
          <PhysicalStatsForm 
            onSuccess={handleSuccess} 
            onError={handleError} 
          />
        </section>

        <hr className="border-[var(--color-border)]" />

        <section className="space-y-6">
          <h2 className="text-xl font-semibold text-strong">App Settings</h2>
          <AppSettings 
            devToolsEnabled={devToolsEnabled} 
            onSuccess={handleSuccess} 
            onError={handleError} 
          />
        </section>
      </div>
    </div>
  )
}