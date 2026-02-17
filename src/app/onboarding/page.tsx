'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { Skeleton } from '@/components/ui/Skeleton'
import { useUser } from '@/hooks/useUser'

export default function OnboardingPage() {
  const router = useRouter()
  const { user, loading: userLoading } = useUser()

  useEffect(() => {
    if (!user || userLoading) return
    router.replace('/profile')
  }, [router, user, userLoading])

  if (userLoading) {
    return (
      <div className="page-shell page-stack">
        <Skeleton className="h-24 w-full" />
      </div>
    )
  }

  if (!user) {
    return (
      <div className="page-shell page-stack">
        <EmptyState
          title="Sign in to continue"
          description="Your onboarding and profile setup are available after authentication."
          action={<Button onClick={() => router.push('/auth/login')}>Sign in</Button>}
        />
      </div>
    )
  }

  return <div className="page-shell p-10 text-center text-muted">Redirecting to profile...</div>
}
