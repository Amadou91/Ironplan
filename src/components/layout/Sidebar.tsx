'use client';

import { useState, useEffect, useRef } from 'react';
import { useHasMounted } from '@/hooks/useHasMounted';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { ChevronLeft, ChevronRight, LogIn, LogOut, UserRound } from 'lucide-react';
import { useSupabase } from '@/hooks/useSupabase';
import { authStore, useAuthStore } from '@/store/authStore';
import { primaryNavItems, secondaryNavItems } from '@/components/layout/navigation';
import { ThemeToggle } from '@/components/layout/ThemeToggle';
import { UnitToggle } from '@/components/layout/UnitToggle';
import { isNavRouteActive } from '@/lib/navigation';

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const hydrated = useAuthStore((state) => state.hydrated);
  const clearUser = useAuthStore((state) => state.clearUser);
  const supabase = useSupabase();

  const [isCollapsed, setIsCollapsed] = useState(() => {
    if (typeof window === 'undefined') return true;
    const saved = localStorage.getItem('sidebar-collapsed');
    return saved !== null ? saved === 'true' : true;
  });
  const hasMounted = useHasMounted();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const avatarButtonRef = useRef<HTMLButtonElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    if (!dropdownOpen) return;
    const handleOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [dropdownOpen]);

  // Close dropdown on Escape, return focus to trigger
  useEffect(() => {
    if (!dropdownOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setDropdownOpen(false);
        avatarButtonRef.current?.focus();
      }
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [dropdownOpen]);

  const toggleSidebar = () => {
    const next = !isCollapsed;
    setIsCollapsed(next);
    localStorage.setItem('sidebar-collapsed', String(next));
  };

  const handleSignOut = async () => {
    setDropdownOpen(false);
    clearUser();
    authStore.persist.clearStorage();
    await supabase.auth.signOut();
    router.replace('/auth/login');
  };

  const userInitial = user?.email?.charAt(0).toUpperCase() ?? '?';

  if (!hasMounted) {
    return (
      <aside className="hidden sticky top-0 h-screen w-[72px] flex-col border-r border-[var(--color-border)] nav-surface lg:flex z-[var(--z-nav)]" />
    );
  }

  // Shared dropdown menu rendered once, positioned relative to dropdownRef
  const accountDropdown = dropdownOpen && (
    <div
      role="menu"
      aria-label="Account options"
      className={`absolute z-50 min-w-[160px] rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[var(--shadow-lg)] overflow-hidden ${
        isCollapsed ? 'left-full ml-2 bottom-0' : 'bottom-full mb-2 left-0'
      }`}
    >
      <Link
        href="/profile"
        role="menuitem"
        onClick={() => setDropdownOpen(false)}
        className="flex items-center gap-2.5 px-4 py-3 text-sm font-medium text-strong hover:bg-[var(--color-surface-muted)] transition-colors focus-visible:outline-none focus-visible:bg-[var(--color-surface-muted)]"
      >
        <UserRound className="h-4 w-4 text-muted shrink-0" aria-hidden="true" />
        Profile
      </Link>
      <div className="h-px bg-[var(--color-border)]" aria-hidden="true" />
      <button
        type="button"
        role="menuitem"
        onClick={handleSignOut}
        className="flex w-full items-center gap-2.5 px-4 py-3 text-sm font-medium text-red-600 hover:bg-red-500/10 transition-colors focus-visible:outline-none focus-visible:bg-red-500/10"
      >
        <LogOut className="h-4 w-4 shrink-0" aria-hidden="true" />
        Sign out
      </button>
    </div>
  );

  return (
    <aside
      className={`group hidden sticky top-0 h-screen flex-col nav-surface text-strong border-r border-[var(--color-border)] transition-all duration-200 ease-in-out lg:flex z-[var(--z-nav)] ${
        isCollapsed ? 'w-[72px]' : 'w-60'
      }`}
    >
      {/* Header */}
      <div className="relative flex h-16 shrink-0 items-center justify-center border-b border-[var(--color-border)] px-2">
        {isCollapsed ? (
          <Link
            href="/dashboard"
            aria-label="Ironplan dashboard"
            className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-primary-strong)] text-white shadow-md transition-transform hover:scale-105 active:scale-95"
          >
            <span className="font-display text-sm font-bold">IP</span>
          </Link>
        ) : (
          <Link href="/dashboard" className="flex flex-1 items-center gap-2 px-2 min-w-0">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-primary-strong)] text-white shadow-md">
              <span className="font-display text-sm font-bold">IP</span>
            </div>
            <div className="min-w-0">
              <p className="font-display text-base font-bold tracking-tight leading-none">Ironplan</p>
              <p className="text-[9px] text-subtle font-medium mt-0.5 uppercase tracking-wider">Training OS</p>
            </div>
          </Link>
        )}
        {/* Expand / collapse toggle — appears on sidebar hover */}
        <button
          onClick={toggleSidebar}
          aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className="absolute -right-3 top-1/2 -translate-y-1/2 z-50 flex h-6 w-6 items-center justify-center rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] shadow-sm text-subtle hover:text-strong hover:shadow-md opacity-0 group-hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] transition-all"
        >
          {isCollapsed ? <ChevronRight className="h-3 w-3" /> : <ChevronLeft className="h-3 w-3" />}
        </button>
      </div>

      {/* Navigation */}
      <div className="flex-1 overflow-y-auto py-4 px-2 scrollbar-hide">
        <nav className="space-y-1" aria-label="Primary navigation">
          {primaryNavItems.map((item) => {
            const Icon = item.icon;
            const active = isNavRouteActive(pathname, item.href);
            const navLink = (
              <Link
                href={item.href}
                aria-current={active ? 'page' : undefined}
                aria-label={isCollapsed ? item.label : undefined}
                className={`relative flex w-full items-center rounded-xl py-2.5 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] ${
                  isCollapsed ? 'justify-center px-0' : 'gap-3 px-3'
                } ${
                  active
                    ? 'bg-[var(--color-primary-soft)] text-[var(--color-primary-strong)]'
                    : 'text-muted hover:bg-[var(--color-surface-muted)] hover:text-strong'
                }`}
              >
                {active && isCollapsed && (
                  <span className="absolute left-0 h-5 w-1 rounded-r-full bg-[var(--color-primary)]" aria-hidden="true" />
                )}
                <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
                {!isCollapsed && <span className="text-sm font-semibold tracking-tight">{item.label}</span>}
              </Link>
            );
            return (
              <div key={item.href}>{navLink}</div>
            );
          })}
        </nav>

        {secondaryNavItems.length > 0 && (
          <div className="pt-4">
            {!isCollapsed && (
              <p className="px-3 pb-2 text-[10px] font-bold uppercase tracking-[0.2em] text-muted/50">Explore</p>
            )}
            <nav className="space-y-1" aria-label="Secondary navigation">
              {secondaryNavItems.map((item) => {
                const Icon = item.icon;
                const active = isNavRouteActive(pathname, item.href);
                const navLink = (
                  <Link
                    href={item.href}
                    aria-current={active ? 'page' : undefined}
                    aria-label={isCollapsed ? item.label : undefined}
                    className={`flex w-full items-center rounded-xl py-2.5 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] ${
                      isCollapsed ? 'justify-center px-0' : 'gap-3 px-3'
                    } ${
                      active
                        ? 'bg-[var(--color-primary-soft)] text-[var(--color-primary-strong)]'
                        : 'text-muted hover:bg-[var(--color-surface-muted)] hover:text-strong'
                    }`}
                  >
                    <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
                    {!isCollapsed && <span className="text-sm font-semibold tracking-tight">{item.label}</span>}
                  </Link>
                );
                return (
                  <div key={item.href}>{navLink}</div>
                );
              })}
            </nav>
          </div>
        )}
      </div>

      {/* Footer: utility toggles + account */}
      <div className="mt-auto border-t border-[var(--color-border)] py-3 px-2 space-y-2">
        <div className={`flex items-center ${isCollapsed ? 'flex-col gap-1' : 'gap-1'}`}>
          <UnitToggle compact />
          <ThemeToggle />
        </div>

        {!hydrated ? (
          <div className="h-9 w-9 mx-auto animate-pulse rounded-xl bg-[var(--color-surface-muted)]" />
        ) : user ? (
          <div ref={dropdownRef} className="relative w-full">
            {isCollapsed ? (
              <button
                ref={avatarButtonRef}
                type="button"
                onClick={() => setDropdownOpen((o) => !o)}
                aria-haspopup="menu"
                aria-expanded={dropdownOpen}
                aria-label="Account menu"
                className="flex w-full items-center justify-center rounded-xl p-2 transition-all hover:bg-[var(--color-surface-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]"
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--color-primary-soft)] text-[var(--color-primary-strong)] text-sm font-bold select-none">
                  {userInitial}
                </span>
              </button>
            ) : (
              <button
                ref={avatarButtonRef}
                type="button"
                onClick={() => setDropdownOpen((o) => !o)}
                aria-haspopup="menu"
                aria-expanded={dropdownOpen}
                aria-label="Account menu"
                className="flex w-full items-center gap-2.5 rounded-xl px-2 py-2 transition-all hover:bg-[var(--color-surface-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]"
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--color-primary-soft)] text-[var(--color-primary-strong)] text-sm font-bold select-none">
                  {userInitial}
                </span>
                <span className="min-w-0 flex-1 text-left">
                  <span className="block truncate text-sm font-semibold text-strong leading-tight">
                    {user.email?.split('@')[0] ?? 'Member'}
                  </span>
                  <span className="block truncate text-[10px] text-subtle">{user.email}</span>
                </span>
              </button>
            )}
            {accountDropdown}
          </div>
        ) : (
          <Link
            href="/auth/login"
            aria-label="Sign in"
            className={`flex w-full items-center rounded-xl py-2.5 text-sm font-bold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] ${
              isCollapsed
                ? 'justify-center px-0 text-muted hover:bg-[var(--color-surface-muted)] hover:text-strong'
                : 'gap-3 px-3 bg-[var(--color-primary)] text-white shadow-md hover:shadow-lg active:scale-[0.98]'
            }`}
          >
            <LogIn className="h-5 w-5 shrink-0" aria-hidden="true" />
            {!isCollapsed && <span>Sign In</span>}
          </Link>
        )}
      </div>
    </aside>
  );
}
