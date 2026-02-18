'use client'

import { useRef } from 'react'
import type { AuthUser } from '@/store/authStore'

interface ProfileHeaderProps {
  user: AuthUser | null
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
        <p className="text-sm uppercase tracking-[0.4em] text-subtle font-bold">Profile</p>
        <h1 
          className="font-display text-4xl lg:text-5xl font-extrabold text-strong mt-2 cursor-default select-none" 
          onClick={handleTitleClick}
        >
          {user?.email?.split('@')[0] || 'Your personal hub'}
        </h1>
        {user?.email && (
          <p className="text-sm text-subtle font-medium mt-1">{user.email}</p>
        )}
      </div>
      <p className="mt-3 text-lg text-muted max-w-2xl">
        Set your training defaults first (especially equipment), then keep body stats current for smarter recommendations.
      </p>
      {devToolsNotice && (
        <div className="mt-3 inline-flex items-center rounded-full bg-accent/10 px-2.5 py-0.5 text-xs font-medium text-accent">
          {devToolsNotice}
        </div>
      )}
    </div>
  )
}
