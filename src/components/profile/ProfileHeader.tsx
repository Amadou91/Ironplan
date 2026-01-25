'use client'

import { useRef } from 'react'
import type { User } from '@supabase/supabase-js'

interface ProfileHeaderProps {
  user: User | null
  onToggleDevTools: () => void
  devToolsNotice: string | null
}

export function ProfileHeader({ user, onToggleDevTools, devToolsNotice }: ProfileHeaderProps) {
  const titleClickTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)
  const titleClickCount = useRef(0)
  const isDevMode = process.env.NODE_ENV !== 'production'

  const handleTitleClick = () => {
    if (!isDevMode) return
    titleClickCount.current += 1
    if (titleClickTimeout.current) {
      clearTimeout(titleClickTimeout.current)
    }
    titleClickTimeout.current = setTimeout(() => {
      titleClickCount.current = 0
    }, 1200)
    if (titleClickCount.current >= 5) {
      titleClickCount.current = 0
      onToggleDevTools()
    }
  }

  return (
    <div>
      <div className="flex flex-col gap-1">
        <p className="text-xs uppercase tracking-[0.3em] text-subtle">Profile</p>
        <h1 
          className="font-display text-3xl font-semibold text-strong cursor-default select-none" 
          onClick={handleTitleClick}
        >
          {user?.email?.split('@')[0] || 'Your personal hub'}
        </h1>
        {user?.email && (
          <p className="text-sm text-subtle font-medium">{user.email}</p>
        )}
      </div>
      <p className="mt-4 text-sm text-muted max-w-2xl">
        Keep your body stats and preferences current for smarter recommendations.
      </p>
      {devToolsNotice && (
        <div className="mt-3 inline-flex items-center rounded-full bg-accent/10 px-2.5 py-0.5 text-xs font-medium text-accent">
          {devToolsNotice}
        </div>
      )}
    </div>
  )
}
