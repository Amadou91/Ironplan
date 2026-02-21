'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { primaryNavItems } from '@/components/layout/navigation'
import { isNavRouteActive } from '@/lib/navigation'

type MobileNavProps = {
  /** When true the nav stays visible at all viewport widths (PWA standalone). */
  alwaysVisible?: boolean
}

export function MobileNav({ alwaysVisible }: MobileNavProps) {
  const pathname = usePathname()

  return (
    <nav
      className={`fixed bottom-0 left-0 right-0 z-[var(--z-nav)] border-t border-[var(--color-border)] bg-[color-mix(in_oklch,var(--color-surface),transparent_3%)] px-3 pb-[calc(env(safe-area-inset-bottom)_+_0.5rem)] pt-2.5 backdrop-blur-xl [transform:translateZ(0)] ${alwaysVisible ? '' : 'lg:hidden'}`}
      aria-label="Primary"
    >
      <div className="mx-auto flex max-w-lg items-center justify-between gap-1">
        {primaryNavItems.map((item) => {
          const Icon = item.icon
          const active = isNavRouteActive(pathname, item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? 'page' : undefined}
              className={`flex min-h-12 flex-1 flex-col items-center justify-center gap-1 rounded-2xl px-2 py-1 text-[11px] font-semibold transition-colors focus-visible:outline-none ${
                active ? 'text-[var(--color-primary-strong)]' : 'text-muted'
              }`}
            >
              <span
                className={`flex h-11 w-11 items-center justify-center rounded-2xl transition-transform ${
                  active
                    ? 'bg-[var(--color-primary-soft)] text-[var(--color-primary-strong)] shadow-[var(--shadow-sm)]'
                    : 'text-muted hover:bg-[var(--color-surface-muted)] active:scale-95'
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
