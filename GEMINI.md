# Ironplan Project Context & Coding Standards

## Project Overview
Ironplan is a fitness tracking application built with Next.js (App Router) and Supabase. It focuses on training metrics, workout logging, and progressive overload tracking.

## Tech Stack
- **Framework:** Next.js 15+ (App Router)
- **Language:** TypeScript (Strict mode)
- **Database/Auth:** Supabase (PostgreSQL)
- **Styling:** Tailwind CSS (Mobile-first)
- **UI Components:** Radix UI primitives, Recharts for data visualization
- **State Management:** Zustand (useWorkoutStore) + React Context (AuthProvider)

## Coding Guidelines

### 1. General Style
- Use **functional components** with named exports.
- Use **TypeScript** for all source files (.ts, .tsx).
- Use **Absolute Imports** with @/ alias (e.g., import { Button } from '@/components/ui/Button').
- **File Naming:** kebab-case for files (session-metrics.ts), PascalCase for components (ProgressPage.tsx).

### 2. Next.js & App Router
- Use src/app/ directory structure.
- Client components must start with 'use client'.
- Separate complex logic into hooks (src/hooks/) or utilities (src/lib/).

### 3. Supabase Integration
- **Client:** Always import createClient from @/lib/supabase/client.
- **Data Fetching:** Prefer fetching data in server components where possible.

### 4. Data Visualization (Recharts)
- Always wrap charts in <ResponsiveContainer width='100%' height='100%'>.
- Use the standard chart colors defined in globals or progress/page.tsx.

### 5. Testing
- Test files are located in tests/.
- Refer to tests/generator.test.js as the canonical example for testing patterns.

## Common Tasks
- **New Page:** Create under src/app/[route]/page.tsx.
- **New Component:** Create under src/components/[category]/.
- **Lint:** Run npm run lint to check for issues.
