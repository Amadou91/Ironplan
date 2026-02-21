'use client'

import type { AuthUser } from '@/store/authStore'
import { Card } from '@/components/ui/Card'

interface ProfileHeaderProps {
  user: AuthUser | null
}

export function ProfileHeader({ user }: ProfileHeaderProps) {
  return (
    <Card className="glass-panel border-[var(--color-border)] p-6">
      <div className="flex flex-col gap-1">
        <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-subtle">Account</p>
        <h2 className="font-display text-2xl font-semibold tracking-tight text-strong sm:text-3xl">
          {user?.email?.split('@')[0] || 'Your personal hub'}
        </h2>
        {user?.email && (
          <p className="mt-1 text-sm font-medium text-subtle">{user.email}</p>
        )}
      </div>
    </Card>
  )
}
