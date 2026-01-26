'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { LogIn, LogOut, ChevronLeft, ChevronRight, UserRound } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { authStore, useAuthStore } from '@/store/authStore';
import { primaryNavItems, secondaryNavItems } from '@/components/layout/navigation';
import { ThemeToggle } from '@/components/layout/ThemeToggle';
import { UnitToggle } from '@/components/layout/UnitToggle';

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const hydrated = useAuthStore((state) => state.hydrated);
  const clearUser = useAuthStore((state) => state.clearUser);
  const supabase = createClient();
  
  const [isCollapsed, setIsCollapsed] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('sidebar-collapsed') === 'true';
    }
    return false;
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

  return (
    <aside className={`group hidden sticky top-0 h-screen flex-col border-r border-[var(--color-border)] bg-[var(--color-surface)] text-strong transition-all duration-300 ease-in-out lg:flex z-40 ${isCollapsed ? 'w-20' : 'w-72'}`}>
      {/* Header section */}
      <div className={`flex h-20 shrink-0 items-center border-b border-[var(--color-border)] px-4 ${isCollapsed ? 'justify-center' : 'justify-between'}`}>
        <Link href="/dashboard" className={`flex items-center gap-3 transition-all duration-300 ${isCollapsed ? 'w-0 opacity-0 overflow-hidden' : 'w-auto opacity-100'}`}>
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-primary-strong)] text-white shadow-md">
            <span className="font-display text-lg font-bold">IP</span>
          </div>
          <div className="flex flex-col">
            <span className="font-display text-lg font-bold tracking-tight leading-none">Ironplan</span>
            <span className="text-[10px] text-subtle font-medium mt-1 uppercase tracking-wider">Training OS</span>
          </div>
        </Link>
        
        {isCollapsed && (
          <Link href="/dashboard" className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-primary-strong)] text-white shadow-md transition-transform hover:scale-105 active:scale-95">
            <span className="font-display text-lg font-bold">IP</span>
          </Link>
        )}

        <div className="flex items-center gap-1">
          {!isCollapsed && (
            <>
              <UnitToggle />
              <ThemeToggle />
            </>
          )}
          <button
            onClick={toggleSidebar}
            className={`flex h-8 w-8 items-center justify-center rounded-lg text-subtle transition-all hover:bg-[var(--color-surface-muted)] hover:text-strong ${isCollapsed ? 'absolute -right-4 top-6 z-50 bg-[var(--color-surface)] border border-[var(--color-border)] shadow-sm opacity-0 group-hover:opacity-100 hover:scale-110' : ''}`}
            title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* Main Navigation */}
      <div className="flex-1 space-y-8 overflow-y-auto px-3 py-8 scrollbar-hide">
        <div className="space-y-1">
          {!isCollapsed && (
            <div className="px-4 mb-3">
              <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted/50">Core</span>
            </div>
          )}
          <nav className="space-y-1">
            {primaryNavItems.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`group relative flex items-center rounded-xl py-2.5 transition-all duration-200 ${
                    isCollapsed ? 'justify-center px-0' : 'gap-3 px-4'
                  } ${
                    active
                      ? 'bg-[var(--color-primary-soft)] text-[var(--color-primary-strong)] shadow-sm'
                      : 'text-muted hover:bg-[var(--color-surface-muted)] hover:text-strong'
                  }`}
                  title={isCollapsed ? item.label : ''}
                >
                  <Icon className="h-5 w-5 transition-transform group-hover:scale-110" />
                  {!isCollapsed && <span className="font-semibold tracking-tight">{item.label}</span>}
                  {active && !isCollapsed && (
                    <div className="absolute right-3 h-1.5 w-1.5 rounded-full bg-[var(--color-primary)]" />
                  )}
                  {isCollapsed && active && (
                    <div className="absolute left-0 h-6 w-1 rounded-r-full bg-[var(--color-primary)]" />
                  )}
                </Link>
              );
            })}
          </nav>
        </div>

        {secondaryNavItems.length > 0 && (
          <div className="space-y-1">
            {!isCollapsed && (
              <div className="px-4 mb-3">
                <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted/50">Explore</span>
              </div>
            )}
            <nav className="space-y-1">
              {secondaryNavItems.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`group relative flex items-center rounded-xl py-2.5 transition-all duration-200 ${
                      isCollapsed ? 'justify-center px-0' : 'gap-3 px-4'
                    } ${
                      active
                        ? 'bg-[var(--color-primary-soft)] text-[var(--color-primary-strong)] shadow-sm'
                        : 'text-muted hover:bg-[var(--color-surface-muted)] hover:text-strong'
                    }`}
                    title={isCollapsed ? item.label : ''}
                  >
                    <Icon className="h-5 w-5 transition-transform group-hover:scale-110" />
                    {!isCollapsed && <span className="font-semibold tracking-tight">{item.label}</span>}
                  </Link>
                );
              })}
            </nav>
          </div>
        )}
      </div>

      {/* Footer / Account section */}
      <div className="mt-auto border-t border-[var(--color-border)] p-4 space-y-4 bg-[var(--color-surface-subtle)]/50">
        {!hydrated ? (
          <div className="h-12 w-full animate-pulse rounded-xl bg-[var(--color-surface-muted)]" />
        ) : user ? (
          <div className="space-y-3">
            {!isCollapsed && (
              <div className="flex items-center gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3 shadow-sm transition-all hover:shadow-md">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[var(--color-surface-muted)] text-muted transition-colors hover:text-strong">
                  <UserRound className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-strong tracking-tight">{user.email?.split('@')[0] ?? 'Member'}</p>
                  <p className="text-[10px] font-bold text-subtle uppercase tracking-widest mt-0.5">Free Member</p>
                </div>
              </div>
            )}
            
            <div className={`flex items-center gap-2 ${isCollapsed ? 'flex-col' : 'justify-between'}`}>
              <button
                onClick={handleSignOut}
                className={`flex items-center justify-center rounded-xl p-2 text-muted transition-all hover:bg-red-500/10 hover:text-red-600 ${isCollapsed ? 'w-10 h-10' : 'flex-1 gap-2 text-xs font-bold uppercase tracking-widest'}`}
                title="Sign out"
              >
                <LogOut className="h-4 w-4" />
                {!isCollapsed && <span>Sign Out</span>}
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <Link
              href="/auth/login"
              className={`flex items-center rounded-xl py-3 text-sm font-bold transition-all ${
                isCollapsed ? 'justify-center px-0' : 'gap-3 px-4 bg-[var(--color-primary)] text-white shadow-md hover:shadow-lg active:scale-[0.98]'
              }`}
              title="Sign in"
            >
              <LogIn className="h-5 w-5" />
              {!isCollapsed && <span>Sign In</span>}
            </Link>
          </div>
        )}
      </div>
    </aside>
  );
}
