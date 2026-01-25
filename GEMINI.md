Ironplan Project Context

Core Tech Stack

Framework: Next.js 16+ (App Router)

Language: TypeScript (Strict Mode)

Database: Supabase (PostgreSQL)

State: Zustand (useWorkoutStore) + React Context (AuthProvider)

UI: Tailwind CSS (Mobile-first), Recharts, Lucide React

Coding Standards (Mandatory)

1. File Structure & Naming

Routes: src/app/[route]/page.tsx

Components: src/components/[category]/PascalCase.tsx

Utilities: src/lib/kebab-case.ts

Hooks: src/hooks/useHookName.ts

Tests: tests/*.test.js (Refer to generator.test.js as the pattern)

2. Component Architecture

Imports: ALWAYS use absolute imports (@/components/..., @/lib/...).

Exports: Use Named Exports only (e.g., export function MyComponent...).

Directives: Explicitly add 'use client' at the top of components using hooks or interactivity. Default to Server Components otherwise.

3. Supabase Data Fetching

Client: Import createClient from @/lib/supabase/client.

Pattern: Prefer fetching data in Server Components and passing it down as props.

4. UI & Visualization

Charts: All Recharts instances must be wrapped in <ResponsiveContainer width="100%" height="100%">.

Styling: Use standard Tailwind utility classes.

5. Operational Constraints

Linting: Do not run or suggest linting commands. The user manages linting and formatting manually.

Focus: Prioritize code correctness and adhering to the existing directory structure.

6. File Size & Modularity

Target Size: Maintain files around ~15-20KB to optimize for AI context ingestion.

Refactoring Strategy: If a file exceeds this soft limit, refactor by extracting logical sub-components, hooks, or utility functions. Avoid arbitrary splitting; prioritize code cohesion (keeping related logic together) while reducing file size.