'use client'

import { type ReactNode } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { UserRound } from 'lucide-react'
import Sidebar from '@/components/layout/Sidebar'
import MobileNav from '@/components/layout/MobileNav'
import { ThemeToggle } from '@/components/layout/ThemeToggle'

type AppShellProps = {
  children: ReactNode
}

const HIDDEN_SHELL_PREFIXES = ['/auth']

export default function AppShell({ children }: AppShellProps) {
  const pathname = usePathname()
  const hideForFocusMode = pathname.startsWith('/exercises/') && pathname.includes('/active')
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
      <div className="min-h-screen flex-1 min-w-0 bg-transparent">
        <header className="sticky top-[env(safe-area-inset-top,_0px)] z-[var(--z-nav)] flex h-16 items-center justify-between border-b border-[var(--color-border)] bg-[color-mix(in_oklch,var(--color-surface),transparent_8%)] px-4 backdrop-blur lg:hidden">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[var(--color-primary-soft)] text-[var(--color-primary-strong)]">
              <span className="font-display text-sm font-semibold">IP</span>
            </div>
            <span className="font-display font-semibold tracking-tight" aria-label="Ironplan">Ironplan</span>
          </div>
          <div className="flex items-center gap-1">
            <ThemeToggle />
            <Link
              href="/profile"
              aria-label="Profile"
              className="flex h-9 w-9 items-center justify-center rounded-xl text-muted transition-colors hover:bg-[var(--color-surface-muted)] hover:text-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]"
            >
              <UserRound className="h-5 w-5" />
            </Link>
          </div>
        </header>
        <main className="min-h-screen pb-28 lg:pb-10">
          <div className="app-container py-6 lg:py-8">
            {children}
          </div>
        </main>
        <MobileNav />
      </div>
    </div>
  )
}
