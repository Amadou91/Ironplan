'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowRight, Dumbbell, Zap, LayoutTemplate } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { authStore, useAuthStore } from '@/store/authStore';
import { getAuthNavState } from '@/lib/authUi';

export default function Home() {
  const router = useRouter();
  const supabase = createClient();
  const user = useAuthStore((state) => state.user);
  const hydrated = useAuthStore((state) => state.hydrated);
  const clearUser = useAuthStore((state) => state.clearUser);
  const navState = getAuthNavState(user);

  const handleSignOut = async () => {
    clearUser();
    authStore.persist.clearStorage();
    await supabase.auth.signOut();
    router.push('/');
    router.refresh();
  };

  return (
    <div className="page-shell flex flex-col">
      {/* Navbar Placeholder if you aren't using a layout wrapper for it */}
      <header className="surface-header flex h-16 items-center justify-between px-6 lg:px-10">
        <div className="flex items-center gap-2 text-xl font-semibold text-strong">
          <Dumbbell className="w-6 h-6 text-accent" />
          <span>Ironplan</span>
        </div>
        <div className="flex items-center gap-4">
          {!hydrated ? (
            <span className="text-sm text-subtle">Checking session...</span>
          ) : user ? (
            <div className="flex items-center gap-3">
              <span className="text-sm text-muted">{navState.greeting}</span>
              <button
                onClick={handleSignOut}
                className="text-sm font-medium text-muted transition-colors hover:text-strong"
              >
                {navState.actionLabel}
              </button>
            </div>
          ) : (
            <Link
              href="/auth/login"
              className="text-sm font-medium text-muted transition-colors hover:text-strong"
            >
              {navState.actionLabel}
            </Link>
          )}
          <Link
            href="/generate"
            className="btn-primary text-sm"
          >
            Get Started
          </Link>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero Section */}
        <section className="section-padding text-center lg:py-24 2xl:py-28">
          <h1 className="text-4xl font-semibold tracking-tight text-strong sm:text-6xl mb-6">
            Generate your perfect <span className="text-accent">workout plan</span>
          </h1>
          <p className="mt-4 text-lg text-muted max-w-2xl mx-auto mb-10">
            Stop guessing what to do in the gym. Let Ironplan create a personalized routine tailored to your goals, equipment, and schedule.
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-4">
            <Link
              href="/generate"
              className="btn-primary text-base md:text-lg"
            >
              Begin Generator
              <ArrowRight className="ml-2 w-5 h-5" />
            </Link>
            <Link
              href={user ? '/dashboard' : '/auth/login'}
              className="btn-secondary text-base md:text-lg"
            >
              View Dashboard
            </Link>
          </div>
        </section>

        {/* Features Grid */}
        <section className="section-padding border-t border-[var(--color-border)] bg-[var(--color-surface)]">
          <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
            <div className="surface-card-muted p-6">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-[var(--color-primary-soft)]">
                <Zap className="h-6 w-6 text-accent" />
              </div>
              <h3 className="text-xl font-semibold text-strong mb-2">Instant Generation</h3>
              <p className="text-muted">
                Get a complete workout plan in seconds based on your specific needs and constraints.
              </p>
            </div>
            <div className="surface-card-muted p-6">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-[var(--color-primary-soft)]">
                <LayoutTemplate className="h-6 w-6 text-accent" />
              </div>
              <h3 className="text-xl font-semibold text-strong mb-2">Structured Plans</h3>
              <p className="text-muted">
                Follow proven progression schemes with organized sets, reps, and rest timers.
              </p>
            </div>
            <div className="surface-card-muted p-6">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-[var(--color-primary-soft)]">
                <Dumbbell className="h-6 w-6 text-accent" />
              </div>
              <h3 className="text-xl font-semibold text-strong mb-2">Exercise Library</h3>
              <p className="text-muted">
                Access a vast library of exercises with detailed instructions and proper form guides.
              </p>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
