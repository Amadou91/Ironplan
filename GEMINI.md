# Ironplan Project Context & Coding Standards

## 1. Project Overview
Ironplan is a fitness tracking application built with Next.js (App Router) and Supabase.

## 2. Tech Stack (Strict)
- **Framework:** Next.js 15+ (App Router)
- **Language:** TypeScript (Strict mode)
- **Database:** Supabase (PostgreSQL)
- **State:** Zustand (useWorkoutStore)
- **UI:** Tailwind CSS + Radix UI + Recharts

## 3. Behavioral Rules (Token Saving)
- **Be Concise:** Do not explain the code unless asked. Just show the diff.
- **Lazy Context:** Do not read full directories. Read only the specific files mentioned.
- **No Fluff:** Do not generate tests, logs, or comments unless explicitly requested.
- **Minimal Changes:** modify only what is necessary to solve the prompt.

## 4. Coding Patterns
- **Imports:** Use absolute imports with @/ (e.g., '@/lib/utils').
- **Components:** Functional components, named exports.
- **Testing:** Refer to tests/generator.test.js as the example (do not read others).

