---
name: Ironplan
description: Workout planning and tracking application
version: 1.0.0
framework: Next.js 16+ (App Router)
language: TypeScript (strict mode)
database: Supabase (PostgreSQL)
state: Zustand
styling: Tailwind CSS
charts: Recharts
---

# Ironplan - Claude Code Instructions

## Project Summary

Ironplan is a fitness application for planning and tracking workouts. Users can generate personalized workouts, log sets during active sessions, and view progress analytics.

**Core flow:** Generate → Save Template → Start Session → Log Sets → View Progress

---

## Style Guide

Based on `docs/ai/CONVENTIONS.md`.

### File Naming

| Type | Convention | Example |
|------|------------|---------|
| Routes | `kebab-case` folders | `src/app/workout-history/` |
| Components | `PascalCase.tsx` | `ActiveSession.tsx` |
| Hooks | `useCamelCase.ts` | `useGenerationFlow.ts` |
| Libraries | `kebab-case.ts` | `session-metrics.ts` |
| Types | `*.types.ts` | `equipment.types.ts` |

### Import Rules

```typescript
// ✅ Always absolute imports
import { Button } from '@/components/ui/Button'
import type { Exercise } from '@/types/domain'

// ✅ Type keyword for type-only imports
import type { FocusArea, Goal } from '@/types/core.types'

// ❌ Never relative imports
import { Button } from '../../../components/ui/Button'
```

### Export Rules

```typescript
// ✅ Named exports only
export function buildLoad() { }
export const MyComponent = () => { }

// ❌ No default exports
export default function buildLoad() { }
```

### Client Components

```typescript
// First line for interactive components
'use client'

import { useState } from 'react'
export function InteractiveComponent() { /* ... */ }
```

### File Size Limits

| Type | Max Lines |
|------|-----------|
| Components | 250 |
| Hooks | 200 |
| Lib files | 300 |
| Type files | 200 |

### Constants

All training constants live in `src/constants/training.ts`:

```typescript
// ✅ Good
import { DEFAULT_REST_SECONDS } from '@/constants/training'

// ❌ Bad - magic number
const rest = 90
```

### Forbidden Patterns

1. No default exports
2. No relative imports
3. No magic numbers
4. No duplicate utilities (use `src/lib/math.ts`, `src/lib/date-utils.ts`)
5. No mixed concerns (separate UI, data, logic)

---

## Architecture Context

Based on `docs/ai/ARCHITECTURE.md` and `docs/metrics-dashboard.md`.

### System Layers

```
Next.js App Router (pages)
        ↓
Components (feature-organized)
        ↓
Hooks (data fetching, state)
        ↓
Lib (pure logic, utilities)
        ↓
Supabase (PostgreSQL)
```

### Directory Structure

```
src/
├── app/                    # Next.js App Router pages
│   ├── generate/           # Workout generation wizard
│   ├── workouts/           # Session management
│   ├── progress/           # Analytics
│   └── dashboard/          # Home
├── components/             # By feature
│   ├── workout/            # Session logging
│   ├── generate/           # Generation wizard
│   ├── progress/           # Charts
│   └── ui/                 # Shared primitives
├── hooks/                  # Custom hooks
├── lib/                    # Pure logic
│   ├── generator/          # Workout generation engine
│   ├── supabase/           # DB clients
│   ├── transformers/       # Chart data
│   └── validation/         # Schemas
├── constants/              # App constants
├── types/                  # TypeScript types
└── store/                  # Zustand stores
```

### Key Modules

**Generator Engine** (`src/lib/generator/`):
- `engine.ts` - Entry point: `buildWorkoutTemplate()`
- `engine-core.ts` - Core: `generateSessionExercises()`
- `selection-logic.ts` - Exercise filtering
- `scoring.ts` - Exercise ranking
- `volume-math.ts` - Sets/reps calculations

**Metrics** (`src/lib/`):
- `session-metrics.ts` - E1RM, tonnage, intensity
- `training-metrics.ts` - Load analysis, readiness
- `workout-metrics.ts` - Workload scoring

**Types** (`src/types/`):
- `domain.ts` - Barrel file (import from here)
- `core.types.ts` - Goals, focus, intensity
- `equipment.types.ts` - Equipment definitions
- `exercise.types.ts` - Exercise, prescription
- `session.types.ts` - Session, sets

### Database Tables

| Table | Purpose |
|-------|---------|
| `workout_templates` | Saved workout configurations |
| `workout_sessions` | Active/completed sessions |
| `session_exercises` | Exercises in a session |
| `workout_sets` | Individual sets with metrics |
| `exercise_catalog` | Master exercise library |
| `profiles` | User settings |

### Readiness System

Stored in `public.session_readiness`:

| Metric | Scale | Effect on Score |
|--------|-------|-----------------|
| Sleep Quality | 1-5 | Increases |
| Muscle Soreness | 1-5 | Decreases |
| Stress Level | 1-5 | Decreases |
| Motivation | 1-5 | Increases |

**Score Levels:** low (≤45), steady (46-69), high (≥70)

---

## Quick Commands

```bash
npm run dev          # Development server
npm test             # Run tests
npm run typecheck    # Type check
```

---

## Navigation Reference

| Task | Location |
|------|----------|
| Workout generation | `src/lib/generator/engine.ts` |
| Exercise calculations | `src/lib/session-metrics.ts` |
| Constants | `src/constants/training.ts` |
| Active session UI | `src/components/workout/ActiveSession.tsx` |
| Chart data | `src/lib/transformers/chart-data.ts` |
| Types | `src/types/*.types.ts` |

For detailed navigation: `docs/ai/FINDING_THINGS.md`
