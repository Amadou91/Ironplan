'use client'

import { type ReactNode } from 'react'
import { usePathname } from 'next/navigation'
import Sidebar from '@/components/layout/Sidebar'
import MobileNav from '@/components/layout/MobileNav'

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
        <main className="min-h-screen pb-28 lg:pb-10">{children}</main>
        <MobileNav />
      </div>
    </div>
  )
}
