'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Dumbbell, LayoutDashboard, PlusCircle, LogIn, LogOut } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { authStore, useAuthStore } from '@/store/authStore';
import { getAuthNavState } from '@/lib/authUi';

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

  const isActive = (path: string) => pathname === path;
  const navState = getAuthNavState(user);

  return (
    <aside className="fixed left-0 top-0 flex h-screen w-64 flex-col border-r border-[var(--color-border)] bg-[var(--color-surface)] text-strong">
      <div className="flex items-center gap-3 border-b border-[var(--color-border)] p-6">
        <Dumbbell className="h-6 w-6 text-accent" />
        <span className="text-xl font-semibold tracking-tight">Ironplan</span>
      </div>

      <nav className="flex-1 px-4 py-6 space-y-2">
        <Link
          href="/dashboard"
          className={`flex items-center gap-3 rounded-lg px-4 py-3 transition-colors ${
            isActive('/dashboard')
              ? 'bg-[var(--color-primary-soft)] text-[var(--color-primary-strong)]'
              : 'text-muted hover:bg-[var(--color-surface-muted)] hover:text-strong'
          }`}
        >
          <LayoutDashboard className="w-5 h-5" />
          <span className="font-medium">Dashboard</span>
        </Link>

        <Link
          href="/generate"
          className={`flex items-center gap-3 rounded-lg px-4 py-3 transition-colors ${
            isActive('/generate')
              ? 'bg-[var(--color-primary-soft)] text-[var(--color-primary-strong)]'
              : 'text-muted hover:bg-[var(--color-surface-muted)] hover:text-strong'
          }`}
        >
          <PlusCircle className="w-5 h-5" />
          <span className="font-medium">Generate Plan</span>
        </Link>
        
        {/* Add more links here if needed */}
      </nav>

      <div className="border-t border-[var(--color-border)] p-4">
        {!hydrated ? (
          <div className="px-4 py-3 text-xs text-subtle">Checking session...</div>
        ) : user ? (
          <div className="space-y-2">
             <div className="px-4 py-2 text-xs font-semibold uppercase tracking-wider text-subtle">
              {navState.greeting}
            </div>
            <button
              onClick={handleSignOut}
              className="w-full rounded-lg px-4 py-3 text-left text-sm text-muted transition-colors hover:bg-[var(--color-surface-muted)] hover:text-strong"
            >
              <LogOut className="w-5 h-5" />
              <span className="font-medium">{navState.actionLabel}</span>
            </button>
          </div>
        ) : (
          <Link
            href="/auth/login"
            className={`flex items-center gap-3 rounded-lg px-4 py-3 transition-colors ${
              isActive('/auth/login')
                ? 'bg-[var(--color-primary-soft)] text-[var(--color-primary-strong)]'
                : 'text-muted hover:bg-[var(--color-surface-muted)] hover:text-strong'
            }`}
          >
            <LogIn className="w-5 h-5" />
            <span className="font-medium">{navState.actionLabel}</span>
          </Link>
        )}
      </div>
    </aside>
  );
}
