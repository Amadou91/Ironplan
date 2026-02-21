import { Button } from '@/components/ui/Button'
import Link from 'next/link'
import { Compass } from 'lucide-react'
import { AppState } from '@/components/ui/AppState'

export default function NotFound() {
  return (
    <div className="page-shell">
      <div className="mx-auto flex min-h-[70dvh] w-full max-w-3xl items-center px-4">
        <AppState
          icon={<Compass className="h-6 w-6" aria-hidden="true" />}
          title="Page not found"
          description="That link no longer points to an active page. Return to your dashboard to continue training."
          actions={
            <Link href="/dashboard">
              <Button>Go to dashboard</Button>
            </Link>
          }
        />
      </div>
    </div>
  )
}
