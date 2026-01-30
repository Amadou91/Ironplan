'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { primaryNavItems } from '@/components/layout/navigation'

export default function MobileNav() {
  const pathname = usePathname()
  const isActive = (path: string) =>
    pathname === path ||
    (path !== '/' && pathname.startsWith(`${path}/`)) ||
    (path === '/exercises' && pathname.startsWith('/workout/'))

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-[var(--color-border)] bg-[var(--color-surface)]/95 px-4 pb-[calc(env(safe-area-inset-bottom)_+_0.5rem)] pt-3 backdrop-blur lg:hidden">
      <div className="mx-auto flex max-w-lg items-center justify-between">
        {primaryNavItems.map((item) => {
          const Icon = item.icon
          const active = isActive(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center gap-1 text-[11px] font-semibold transition-colors ${
                active ? 'text-[var(--color-primary-strong)]' : 'text-muted'
              }`}
            >
              <span
                className={`flex h-10 w-10 items-center justify-center rounded-2xl ${
                  active
                    ? 'bg-[var(--color-primary-soft)] text-[var(--color-primary-strong)]'
                    : 'text-muted'
                }`}
              >
                <Icon className="h-5 w-5" />
              </span>
              {item.label}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
