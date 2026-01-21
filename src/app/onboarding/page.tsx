'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { useUser } from '@/hooks/useUser'

const steps = [
  { title: 'Goals & intent', description: 'Define strength, hypertrophy, or endurance focus.' },
  { title: 'Experience level', description: 'Tune volume and intensity to your training age.' },
  { title: 'Equipment', description: 'Pick available gear so exercises match your setup.' },
  { title: 'Schedule', description: 'Set days and session duration to fit your week.' },
  { title: 'Preferences', description: 'Highlight movements you love and avoid.' },
  { title: 'Recovery', description: 'Set rest needs to keep training sustainable.' }
]

export default function OnboardingPage() {
  const router = useRouter()
  const { user, loading: userLoading } = useUser()

  if (userLoading) {
    return <div className="page-shell p-10 text-center text-muted">Loading onboarding...</div>
  }

  if (!user) {
    return (
      <div className="page-shell p-10 text-center text-muted">
        <p className="mb-4">Sign in to continue onboarding.</p>
        <Button onClick={() => router.push('/auth/login')}>Sign in</Button>
      </div>
    )
  }

  return (
    <div className="page-shell">
      <div className="w-full space-y-8 px-4 py-10 sm:px-6 lg:px-10 2xl:px-16">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-subtle">Onboarding</p>
          <h1 className="font-display text-3xl font-semibold text-strong">Personalize your training</h1>
          <p className="mt-2 text-sm text-muted">
            Answer a few quick prompts to unlock smarter workouts and adaptive guidance.
          </p>
        </div>

        <Card className="p-6">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-accent" />
            <h2 className="text-lg font-semibold text-strong">Onboarding sprint</h2>
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {steps.map((step) => (
              <div key={step.title} className="rounded-xl border border-[var(--color-border)] p-4 text-sm">
                <p className="font-semibold text-strong">{step.title}</p>
                <p className="mt-1 text-xs text-subtle">{step.description}</p>
              </div>
            ))}
          </div>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/generate">
              <Button size="sm">Start onboarding</Button>
            </Link>
            <Button variant="secondary" size="sm" onClick={() => router.push('/dashboard')}>
              Skip for now
            </Button>
          </div>
        </Card>
      </div>
    </div>
  )
}
