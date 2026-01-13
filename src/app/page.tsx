import Link from 'next/link';
import { ArrowRight, Dumbbell, Zap, LayoutTemplate } from 'lucide-react';

export default function Home() {
  return (
    <div className="flex flex-col min-h-screen bg-slate-50 dark:bg-slate-950">
      {/* Navbar Placeholder if you aren't using a layout wrapper for it */}
      <header className="px-6 h-16 flex items-center justify-between border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
        <div className="flex items-center gap-2 font-bold text-xl text-slate-900 dark:text-white">
          <Dumbbell className="w-6 h-6 text-blue-600" />
          <span>Ironplan</span>
        </div>
        <div className="flex items-center gap-4">
          <Link 
            href="/auth/login" 
            className="text-sm font-medium text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
          >
            Log in
          </Link>
          <Link
            href="/generate"
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
          >
            Get Started
          </Link>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero Section */}
        <section className="py-20 px-6 text-center lg:py-32">
          <h1 className="text-4xl font-extrabold tracking-tight text-slate-900 dark:text-white sm:text-6xl mb-6">
            Generate your perfect <span className="text-blue-600">workout plan</span>
          </h1>
          <p className="mt-4 text-lg text-slate-600 dark:text-slate-300 max-w-2xl mx-auto mb-10">
            Stop guessing what to do in the gym. Let Ironplan create a personalized routine tailored to your goals, equipment, and schedule.
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-4">
            <Link
              href="/generate"
              className="inline-flex items-center justify-center px-8 py-3 text-base font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors md:text-lg"
            >
              Begin Generator
              <ArrowRight className="ml-2 w-5 h-5" />
            </Link>
            <Link
              href="/auth/login"
              className="inline-flex items-center justify-center px-8 py-3 text-base font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700 dark:hover:bg-slate-700 transition-colors md:text-lg"
            >
              View Dashboard
            </Link>
          </div>
        </section>

        {/* Features Grid */}
        <section className="py-16 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800">
          <div className="max-w-6xl mx-auto px-6 grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="p-6 rounded-2xl bg-slate-50 dark:bg-slate-800">
              <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900 rounded-lg flex items-center justify-center mb-4">
                <Zap className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Instant Generation</h3>
              <p className="text-slate-600 dark:text-slate-400">
                Get a complete workout plan in seconds based on your specific needs and constraints.
              </p>
            </div>
            <div className="p-6 rounded-2xl bg-slate-50 dark:bg-slate-800">
              <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900 rounded-lg flex items-center justify-center mb-4">
                <LayoutTemplate className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Structured Plans</h3>
              <p className="text-slate-600 dark:text-slate-400">
                Follow proven progression schemes with organized sets, reps, and rest timers.
              </p>
            </div>
            <div className="p-6 rounded-2xl bg-slate-50 dark:bg-slate-800">
              <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900 rounded-lg flex items-center justify-center mb-4">
                <Dumbbell className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Exercise Library</h3>
              <p className="text-slate-600 dark:text-slate-400">
                Access a vast library of exercises with detailed instructions and proper form guides.
              </p>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}