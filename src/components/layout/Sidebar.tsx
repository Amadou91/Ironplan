'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { LogIn, LogOut, ChevronLeft, ChevronRight } from 'lucide-react';
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
  
  const [isCollapsed, setIsCollapsed] = useState(() => {
    if (typeof window === 'undefined') return false;
    const saved = localStorage.getItem('sidebar-collapsed');
    return saved !== null ? saved === 'true' : false;
  });

  const toggleSidebar = () => {
    const nextState = !isCollapsed;
    setIsCollapsed(nextState);
    localStorage.setItem('sidebar-collapsed', String(nextState));
  };

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
    <aside className={`hidden h-screen flex-col border-r border-[var(--color-border)] bg-[var(--color-surface)] text-strong transition-all duration-300 lg:flex ${isCollapsed ? 'w-20' : 'w-72'}`}>
      <div className={`flex items-center border-b border-[var(--color-border)] px-4 py-6 ${isCollapsed ? 'flex-col gap-4 justify-center' : 'justify-between'}`}>
        <div className={`flex items-center gap-3 ${isCollapsed ? 'hidden' : 'flex'}`}>
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[var(--color-primary-soft)] text-[var(--color-primary-strong)] shadow-[var(--shadow-sm)]">
            <span className="font-display text-lg font-semibold">IP</span>
          </div>
          <div>
            <div className="font-display text-xl font-semibold tracking-tight">Ironplan</div>
            <p className="text-xs text-subtle">Coach-led training OS</p>
          </div>
        </div>
        
        {isCollapsed && (
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[var(--color-primary-soft)] text-[var(--color-primary-strong)] shadow-[var(--shadow-sm)]">
            <span className="font-display text-lg font-semibold">IP</span>
          </div>
        )}

        <div className={`flex items-center ${isCollapsed ? 'flex-col gap-2' : 'gap-1'}`}>
          {!isCollapsed && <ThemeToggle />}
          <button
            onClick={toggleSidebar}
            className="flex h-9 w-9 items-center justify-center rounded-xl text-subtle transition-colors hover:bg-[var(--color-surface-muted)] hover:text-strong"
            title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {isCollapsed ? <ChevronRight className="h-5 w-5" /> : <ChevronLeft className="h-5 w-5" />}
          </button>
        </div>
      </div>

      <div className="flex-1 space-y-6 overflow-y-auto px-3 py-6 scrollbar-hide">
        <nav className="space-y-1.5">
          {primaryNavItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`group relative flex items-center rounded-xl p-3 text-sm font-semibold transition-all duration-200 ${
                  isCollapsed ? 'justify-center' : 'gap-3 px-4'
                } ${
                  active
                    ? 'bg-[var(--color-primary-soft)] text-[var(--color-primary-strong)] shadow-[var(--shadow-sm)]'
                    : 'text-muted hover:bg-[var(--color-surface-muted)] hover:text-strong'
                }`}
                title={isCollapsed ? item.label : ''}
              >
                <Icon className={`${isCollapsed ? 'h-6 w-6' : 'h-5 w-5'}`} />
                {!isCollapsed && <span>{item.label}</span>}
                {isCollapsed && active && (
                  <div className="absolute left-0 h-6 w-1 rounded-r-full bg-[var(--color-primary)]" />
                )}
              </Link>
            );
          })}
        </nav>

        <div className="space-y-1.5 border-t border-[var(--color-border)] pt-4">
          {secondaryNavItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`group relative flex items-center rounded-xl p-3 text-sm font-semibold transition-all duration-200 ${
                  isCollapsed ? 'justify-center' : 'gap-3 px-4'
                } ${
                  active
                    ? 'bg-[var(--color-primary-soft)] text-[var(--color-primary-strong)] shadow-[var(--shadow-sm)]'
                    : 'text-muted hover:bg-[var(--color-surface-muted)] hover:text-strong'
                }`}
                title={isCollapsed ? item.label : ''}
              >
                <Icon className={`${isCollapsed ? 'h-6 w-6' : 'h-5 w-5'}`} />
                {!isCollapsed && <span>{item.label}</span>}
                {isCollapsed && active && (
                  <div className="absolute left-0 h-6 w-1 rounded-r-full bg-[var(--color-primary)]" />
                )}
              </Link>
            );
          })}
        </div>
      </div>

      <div className="mt-auto border-t border-[var(--color-border)] p-3">
        {!hydrated ? (
          <div className={`px-4 py-3 text-xs text-subtle ${isCollapsed ? 'hidden' : 'block'}`}>Checking...</div>
        ) : user ? (
          <div className="space-y-1.5">
            {!isCollapsed && (
              <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-subtle)] px-4 py-3 text-xs text-subtle mb-2">
                <div className="text-[10px] uppercase tracking-[0.2em] text-subtle font-bold">Signed in</div>
                <div className="mt-1 text-sm font-semibold text-strong truncate">{user.email ?? 'Member'}</div>
              </div>
            )}
            
            <button
              onClick={handleSignOut}
              className={`flex w-full items-center rounded-xl p-3 text-left text-sm font-semibold text-muted transition-colors hover:bg-[var(--color-surface-muted)] hover:text-strong ${isCollapsed ? 'justify-center' : 'gap-3 px-4'}`}
              title={isCollapsed ? 'Sign out' : ''}
            >
              <LogOut className={`${isCollapsed ? 'h-6 w-6' : 'h-4 w-4'}`} />
              {!isCollapsed && <span>{navState.actionLabel}</span>}
            </button>
          </div>
        ) : (
          <Link
            href="/auth/login"
            className={`flex items-center rounded-xl p-3 text-sm font-semibold transition-colors ${
              isCollapsed ? 'justify-center' : 'gap-3 px-4'
            } ${
              isActive('/auth/login')
                ? 'bg-[var(--color-primary-soft)] text-[var(--color-primary-strong)]'
                : 'text-muted hover:bg-[var(--color-surface-muted)] hover:text-strong'
            }`}
            title={isCollapsed ? 'Sign in' : ''}
          >
            <LogIn className={`${isCollapsed ? 'h-6 w-6' : 'h-4 w-4'}`} />
            {!isCollapsed && <span>{navState.actionLabel}</span>}
          </Link>
        )}
      </div>
    </aside>
  );
}
