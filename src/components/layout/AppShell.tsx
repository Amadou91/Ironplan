'use client'

import { type ReactNode } from 'react'
import { usePathname } from 'next/navigation'
import Sidebar from '@/components/layout/Sidebar'
import MobileNav from '@/components/layout/MobileNav'
import { ThemeToggle } from '@/components/layout/ThemeToggle'

type AppShellProps = {
  children: ReactNode
}

const HIDDEN_SHELL_PREFIXES = ['/auth']

export default function AppShell({ children }: AppShellProps) {
  const pathname = usePathname()
  const hideForFocusMode = pathname.startsWith('/workouts/') && pathname.includes('/active')
  const showShell =
    pathname !== '/' &&
    !hideForFocusMode &&
    !HIDDEN_SHELL_PREFIXES.some((prefix) => pathname.startsWith(prefix))

  if (!showShell) {
    return <div className="min-h-screen">{children}</div>
  }

  return (
    <div className="min-h-screen lg:flex">
      <Sidebar />
      <div className="min-h-screen flex-1 min-w-0">
        <header className="flex h-16 items-center justify-between border-b border-[var(--color-border)] bg-[var(--color-surface)] px-4 lg:hidden">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[var(--color-primary-soft)] text-[var(--color-primary-strong)]">
              <span className="font-display text-sm font-semibold">IP</span>
            </div>
            <span className="font-display font-semibold tracking-tight">Ironplan</span>
          </div>
          <ThemeToggle />
        </header>
        <main className="min-h-screen pb-28 lg:pb-10">{children}</main>
        <MobileNav />
      </div>
    </div>
  )
}
