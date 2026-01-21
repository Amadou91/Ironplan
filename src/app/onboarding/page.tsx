'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import { useUser } from '@/hooks/useUser'

export default function OnboardingPage() {
  const router = useRouter()
  const { user, loading: userLoading } = useUser()

  useEffect(() => {
    if (!user || userLoading) return
    router.replace('/profile')
  }, [router, user, userLoading])

  if (userLoading) {
    return <div className="page-shell p-10 text-center text-muted">Loading profile...</div>
  }

  if (!user) {
    return (
      <div className="page-shell p-10 text-center text-muted">
        <p className="mb-4">Sign in to manage your profile.</p>
        <Button onClick={() => router.push('/auth/login')}>Sign in</Button>
      </div>
    )
  }

  return <div className="page-shell p-10 text-center text-muted">Redirecting to profile...</div>
}
