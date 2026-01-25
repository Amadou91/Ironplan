# Ironplan Project Context & AI Guidelines

## 🛠 Core Tech Stack
- **Framework:** Next.js 16+ (App Router)
- **Language:** TypeScript (Strict Mode)
- **Database:** Supabase (PostgreSQL)
- **State:** Zustand (`useWorkoutStore`) + React Context (`AuthProvider`)
- **UI:** Tailwind CSS (Mobile-first), Recharts, Lucide React

## 📏 Coding Standards

### 1. File Structure & Naming
- **Routes:** `src/app/[route]/page.tsx`
- **Components:** `src/components/[category]/PascalCase.tsx`
- **Utilities:** `src/lib/kebab-case.ts`
- **Hooks:** `src/hooks/useHookName.ts`
- **Tests:** `tests/*.test.js` (Refer to `generator.test.js` pattern)

### 2. Component Architecture
- **Imports:** ALWAYS use absolute imports (e.g., `@/components/...`, `@/lib/...`).
- **Exports:** Use **Named Exports** only.
- **Directives:** Explicitly add `'use client'` for interactive components. Default to Server Components.

### 3. Data & State
- **Supabase:** Use `createClient` from `@/lib/supabase/client`. Prefer fetching in Server Components and passing via props.
- **Charts:** Wrap all Recharts in `<ResponsiveContainer width="100%" height="100%">`.

### 4. File Size & Refactoring
- **Soft Limit:** Target **~15-20KB** per file.
- **Strategy:** If a file exceeds this, extract logical sub-components, hooks, or utilities. Maintain code cohesion; do not split arbitrarily.

## 🚫 Constraints & Preferences
- **No NPM Building:** Do not suggest or run `npm build`, `npm install`, or linting scripts. The user manages environment/formatting manually.
- **Focus:** Prioritize code correctness and adherence to the directory structure over environment setup instructions.