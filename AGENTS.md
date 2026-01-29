# Ironplan - AI Agent Instructions

Standard instructions for LLM-based coding agents.

---

## Project Goal

**Ironplan** is a workout planning and tracking application that enables users to:

1. **Generate** personalized workout plans based on goals, equipment, and preferences
2. **Track** active workout sessions with set-by-set logging
3. **Analyze** progress through charts and metrics dashboards
4. **Manage** exercise catalogs and equipment inventories

---

## Tech Stack

| Layer | Technology | Notes |
|-------|------------|-------|
| Framework | Next.js 16+ | App Router (not Pages) |
| Language | TypeScript | Strict mode enabled |
| Database | Supabase | PostgreSQL with Row Level Security |
| State | Zustand | Client-side state management |
| Styling | Tailwind CSS | Utility-first CSS |
| Charts | Recharts | React charting library |
| Validation | Zod | Schema validation |

### Development Commands

```bash
npm run dev          # Start development server (localhost:3000)
npm test             # Run Jest tests
npm run typecheck    # TypeScript type checking
npx tsc --noEmit     # Manual type verification
```

---

## Key Conventions

### Import/Export Rules

```typescript
// ✅ REQUIRED: Absolute imports
import { Button } from '@/components/ui/Button'
import { clamp } from '@/lib/math'
import type { Exercise } from '@/types/domain'

// ✅ REQUIRED: Named exports only
export function buildLoad() { }
export const MyComponent = () => { }

// ❌ FORBIDDEN: Relative imports
import { Button } from '../../../components/ui/Button'

// ❌ FORBIDDEN: Default exports
export default function buildLoad() { }
```

### File Naming Conventions

| Type | Pattern | Example |
|------|---------|---------|
| Routes | kebab-case folders | `src/app/workout-history/` |
| Components | PascalCase.tsx | `ActiveSession.tsx` |
| Hooks | useCamelCase.ts | `useGenerationFlow.ts` |
| Libraries | kebab-case.ts | `session-metrics.ts` |
| Types | *.types.ts | `equipment.types.ts` |
| Constants | kebab-case.ts | `training.ts` |

### Client Components

```typescript
// First line must be 'use client' for interactive components
'use client'

import { useState } from 'react'

export function InteractiveComponent() {
  const [state, setState] = useState(false)
  // ...
}
```

### Constants

All training-related constants must be in `src/constants/training.ts`:

```typescript
// ✅ Good
import { DEFAULT_REST_SECONDS } from '@/constants/training'

// ❌ Bad - magic number
const rest = 90
```

### File Size Limits

| Type | Maximum | Action if Exceeded |
|------|---------|-------------------|
| Components | 250 lines | Extract sub-components |
| Hooks | 200 lines | Extract helper hooks |
| Lib files | 300 lines | Split into modules |
| Type files | 200 lines | Split by domain |

---

## Architecture Overview

### System Layers

```
┌─────────────────────────────────────────────────────┐
│              Next.js App Router                      │
│         src/app/{route}/page.tsx                     │
└─────────────────────┬───────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────┐
│              Components                              │
│         src/components/{feature}/                    │
└─────────────────────┬───────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────┐
│              Hooks                                   │
│         src/hooks/use*.ts                            │
└─────────────────────┬───────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────┐
│              Lib (Pure Logic)                        │
│         src/lib/*.ts, src/lib/{module}/              │
└─────────────────────┬───────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────┐
│              Supabase (PostgreSQL)                   │
│         src/lib/supabase/client.ts                   │
└─────────────────────────────────────────────────────┘
```

### Directory Structure

```
src/
├── app/                    # Next.js App Router pages
│   ├── generate/           # Workout generation wizard
│   ├── workouts/           # Workout templates & sessions
│   │   ├── [id]/           # Dynamic routes
│   │   │   ├── start/      # Start new session
│   │   │   ├── active/     # Live session tracking
│   │   │   └── summary/    # Session completion
│   ├── progress/           # Analytics & history
│   ├── profile/            # User settings
│   └── dashboard/          # Home dashboard
│
├── components/             # React components by feature
│   ├── workout/            # Session logging UI
│   ├── generate/           # Generation wizard UI
│   ├── progress/           # Charts & analytics
│   ├── profile/            # Settings forms
│   ├── admin/              # Exercise catalog management
│   ├── layout/             # App shell (sidebar, nav)
│   └── ui/                 # Shared primitives (Button, Card)
│
├── hooks/                  # Custom React hooks
│   ├── useGenerationFlow   # Generation wizard state
│   ├── useActiveSessionManager # Live session state
│   ├── useDashboardData    # Dashboard aggregation
│   └── useProgressMetrics  # Analytics queries
│
├── lib/                    # Pure logic & utilities
│   ├── generator/          # Workout generation engine
│   │   ├── engine.ts       # Entry: buildWorkoutTemplate()
│   │   ├── engine-core.ts  # Core: generateSessionExercises()
│   │   ├── selection-logic.ts # Exercise filtering
│   │   ├── scoring.ts      # Exercise ranking
│   │   └── volume-math.ts  # Sets/reps calculations
│   ├── supabase/           # Database clients
│   ├── transformers/       # Chart data transformations
│   ├── validation/         # Schema validation (Zod)
│   ├── math.ts             # clamp, weightedAverage
│   ├── date-utils.ts       # formatDate, getWeekKey
│   ├── session-metrics.ts  # E1RM, tonnage, intensity
│   └── training-metrics.ts # Load analysis, readiness
│
├── constants/              # Application constants
│   └── training.ts         # All training constants
│
├── types/                  # TypeScript definitions
│   ├── domain.ts           # Barrel file (import from here)
│   ├── core.types.ts       # Goals, focus, intensity
│   ├── equipment.types.ts  # Equipment definitions
│   ├── exercise.types.ts   # Exercise, prescription
│   ├── session.types.ts    # Session, sets
│   └── plan.types.ts       # Plans, templates
│
└── store/                  # Zustand state stores
    ├── useWorkoutStore.ts  # Active session state
    ├── uiStore.ts          # UI preferences
    └── authStore.ts        # Auth state
```

### Database Tables

| Table | Purpose |
|-------|---------|
| `workout_templates` | Saved workout configurations |
| `workout_sessions` | Active/completed workout instances |
| `session_exercises` | Exercises within a session |
| `workout_sets` | Individual sets with metrics |
| `exercise_catalog` | Master exercise library |
| `profiles` | User settings and preferences |
| `session_readiness` | Readiness metrics per session |

### Database Access Pattern

```typescript
// Client-side
import { createClient } from '@/lib/supabase/client'
const supabase = createClient()
const { data, error } = await supabase.from('table').select()

// Server-side (in page.tsx)
import { createClient } from '@/lib/supabase/server'
const supabase = await createClient()
```

---

## Navigation Quick Reference

| Task | Primary Files |
|------|---------------|
| Change workout generation | `src/lib/generator/engine.ts`, `engine-core.ts` |
| Modify exercise calculations | `src/lib/session-metrics.ts` |
| Add/modify constants | `src/constants/training.ts` |
| Change active session UI | `src/components/workout/ActiveSession.tsx` |
| Modify chart visualizations | `src/components/progress/*.tsx` |
| Change chart data transforms | `src/lib/transformers/chart-data.ts` |
| Add/change types | `src/types/*.types.ts` |
| Modify user profile | `src/components/profile/*.tsx` |

---

## Workflow

### Before Editing

1. Understand the file's purpose (read JSDoc comments)
2. Check for existing utilities in `src/lib/math.ts`, `src/lib/date-utils.ts`
3. Identify all callers of functions you're modifying

### When Editing

1. Preserve public APIs or update all callers
2. Keep files under size limits
3. Match surrounding code style
4. Add full TypeScript types

### After Editing

1. Run: `npx tsc --noEmit` (type check)
2. Run: `npm test` (test suite)
3. Check for circular dependencies
