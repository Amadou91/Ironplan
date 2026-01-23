'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { LogIn, LogOut } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { authStore, useAuthStore } from '@/store/authStore';
import { getAuthNavState } from '@/lib/authUi';
import { primaryNavItems, secondaryNavItems } from '@/components/layout/navigation';
import { ThemeToggle } from '@/components/layout/ThemeToggle';

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const hydrated = useAuthStore((state) => state.hydrated);
  const clearUser = useAuthStore((state) => state.clearUser);
  const supabase = createClient();

  const handleSignOut = async () => {
    clearUser();
    authStore.persist.clearStorage();
    await supabase.auth.signOut();
    router.push('/auth/login');
    router.refresh();
  };

  const isActive = (path: string) =>
    pathname === path ||
    (path !== '/' && pathname.startsWith(`${path}/`)) ||
    (path === '/workouts' && pathname.startsWith('/workout/'));
  const navState = getAuthNavState(user);

  return (
    <aside className="hidden h-screen w-72 flex-col border-r border-[var(--color-border)] bg-[var(--color-surface)] text-strong lg:flex">
      <div className="flex items-center justify-between border-b border-[var(--color-border)] px-6 py-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[var(--color-primary-soft)] text-[var(--color-primary-strong)] shadow-[var(--shadow-sm)]">
            <span className="font-display text-lg font-semibold">IP</span>
          </div>
          <div>
            <div className="font-display text-xl font-semibold tracking-tight">Ironplan</div>
            <p className="text-xs text-subtle">Coach-led training OS</p>
          </div>
        </div>
        <ThemeToggle />
      </div>

      <div className="flex-1 space-y-6 px-4 py-6">
        <nav className="space-y-2">
          {primaryNavItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`group flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold transition-colors ${
                  active
                    ? 'bg-[var(--color-primary-soft)] text-[var(--color-primary-strong)] shadow-[var(--shadow-sm)]'
                    : 'text-muted hover:bg-[var(--color-surface-muted)] hover:text-strong'
                }`}
              >
                <Icon className="h-5 w-5" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="space-y-2 border-t border-[var(--color-border)] pt-4">
          {secondaryNavItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`group flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold transition-colors ${
                  active
                    ? 'bg-[var(--color-primary-soft)] text-[var(--color-primary-strong)] shadow-[var(--shadow-sm)]'
                    : 'text-muted hover:bg-[var(--color-surface-muted)] hover:text-strong'
                }`}
              >
                <Icon className="h-5 w-5" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </div>
      </div>

      <div className="border-t border-[var(--color-border)] p-4">
        {!hydrated ? (
          <div className="px-4 py-3 text-xs text-subtle">Checking session...</div>
        ) : user ? (
          <div className="space-y-2">
            <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-subtle)] px-4 py-3 text-xs text-subtle">
              <div className="text-[10px] uppercase tracking-[0.2em] text-subtle">Signed in</div>
              <div className="mt-1 text-sm font-semibold text-strong">{user.email ?? 'Member'}</div>
            </div>
            <button
              onClick={handleSignOut}
              className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-sm font-semibold text-muted transition-colors hover:bg-[var(--color-surface-muted)] hover:text-strong"
            >
              <LogOut className="h-4 w-4" />
              <span>{navState.actionLabel}</span>
            </button>
          </div>
        ) : (
          <Link
            href="/auth/login"
            className={`flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold transition-colors ${
              isActive('/auth/login')
                ? 'bg-[var(--color-primary-soft)] text-[var(--color-primary-strong)]'
                : 'text-muted hover:bg-[var(--color-surface-muted)] hover:text-strong'
            }`}
          >
            <LogIn className="h-4 w-4" />
            <span>{navState.actionLabel}</span>
          </Link>
        )}
      </div>
    </aside>
  );
}
