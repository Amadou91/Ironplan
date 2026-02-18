import { Button } from '@/components/ui/Button'
import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 p-6 text-center">
      <h2 className="text-xl font-bold text-[var(--color-text)]">Page Not Found</h2>
      <p className="text-sm text-[var(--color-text-muted)]">
        The page you&apos;re looking for doesn&apos;t exist.
      </p>
      <Link href="/dashboard">
        <Button>Go to Dashboard</Button>
      </Link>
    </div>
  )
}
