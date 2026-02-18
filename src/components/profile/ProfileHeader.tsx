'use client'

import type { AuthUser } from '@/store/authStore'

interface ProfileHeaderProps {
  user: AuthUser | null
}

export function ProfileHeader({ user }: ProfileHeaderProps) {
  return (
    <div>
      <div className="flex flex-col gap-1">
        <p className="text-sm uppercase tracking-[0.4em] text-subtle font-bold">Profile</p>
        <h1 className="font-display text-4xl lg:text-5xl font-extrabold text-strong mt-2">
          {user?.email?.split('@')[0] || 'Your personal hub'}
        </h1>
        {user?.email && (
          <p className="text-sm text-subtle font-medium mt-1">{user.email}</p>
        )}
      </div>
      <p className="mt-3 text-lg text-muted max-w-2xl">
        Set your training defaults first (especially equipment), then keep body stats current for smarter recommendations.
      </p>
    </div>
  )
}
