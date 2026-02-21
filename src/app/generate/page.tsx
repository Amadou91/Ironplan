'use client'

import { useState } from 'react'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import { useRouter } from 'next/navigation'
import { ArrowRight, Sparkles, Wrench } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { PageHeader } from '@/components/ui/PageHeader'

const SessionSetupModal = dynamic(
  () => import('@/components/dashboard/SessionSetupModal').then((mod) => mod.SessionSetupModal),
  { ssr: false }
)

export default function GeneratePage() {
  const router = useRouter()
  const [isQuickStartOpen, setIsQuickStartOpen] = useState(false)

  return (
    <div className="page-shell">
      <div className="page-stack">
        <PageHeader
          eyebrow="Session start"
          title="Template generation has been removed"
          description="Start sessions by choosing focus areas at runtime. Equipment defaults now live in your profile."
          actions={
            <Button type="button" variant="ghost" onClick={() => router.push('/dashboard')}>
              Back to dashboard
            </Button>
          }
        />

        <Card className="p-6 md:p-8">
          <div className="space-y-6">
            <div className="space-y-2">
              <h2 className="text-lg font-semibold text-strong">What changed</h2>
              <ul className="list-disc space-y-1 pl-5 text-sm text-muted">
                <li>Choose one or more body-part focus areas when you start a session.</li>
                <li>No template creation or template management is required.</li>
                <li>Equipment preferences are saved in your profile and reused automatically.</li>
              </ul>
            </div>

            <div className="flex flex-wrap gap-3">
              <Button type="button" onClick={() => setIsQuickStartOpen(true)}>
                <Sparkles className="mr-2 h-4 w-4" /> Begin Workout
              </Button>
              <Link href="/profile">
                <Button type="button" variant="secondary">
                  <Wrench className="mr-2 h-4 w-4" /> Update equipment preferences
                </Button>
              </Link>
              <Link href="/dashboard">
                <Button type="button" variant="ghost">
                  Dashboard <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            </div>
          </div>
        </Card>
      </div>

      <SessionSetupModal
        isOpen={isQuickStartOpen}
        onClose={() => setIsQuickStartOpen(false)}
        templateTitle="Begin Workout"
        templateStyle="hypertrophy"
        initialFocusAreas={['chest']}
      />
    </div>
  )
}
