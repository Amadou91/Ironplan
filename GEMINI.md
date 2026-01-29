# Ironplan AI Agent Instructions

> **Purpose:** Help AI agents (Gemini, Claude, Codex, etc.) understand and safely modify this codebase.

## Quick Start

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Run tests
npm test

# Type check
npx tsc --noEmit
```

## 🏗️ Architecture Overview

Ironplan is a **workout planning and tracking app** built with:

| Layer | Technology |
|-------|------------|
| Framework | Next.js 16+ (App Router) |
| Language | TypeScript (strict mode) |
| Database | Supabase (PostgreSQL) |
| State | Zustand + React hooks |
| Styling | Tailwind CSS |
| Charts | Recharts |

**Key data flow:**
```
User → Generate Workout → Save Template → Start Session → Log Sets → View Progress
```

For detailed architecture, see: `docs/ai/ARCHITECTURE.md`

---

## 📁 Directory Structure

```
src/
├── app/                    # Next.js pages (App Router)
├── components/             # React components by feature
├── hooks/                  # Custom React hooks
├── lib/                    # Pure logic & utilities
│   ├── generator/          # Workout generation engine
│   ├── supabase/           # Database clients
│   ├── transformers/       # Chart data transformations
│   └── validation/         # Schema validation
├── constants/              # Application constants
├── types/                  # TypeScript definitions
└── store/                  # Zustand state stores
```

---

## 🔍 Finding Code

| Task | Location |
|------|----------|
| Change workout generation | `src/lib/generator/engine.ts`, `engine-core.ts` |
| Modify exercise calculations | `src/lib/session-metrics.ts` |
| Add/modify constants | `src/constants/training.ts` |
| Change active session UI | `src/components/workout/ActiveSession.tsx` |
| Modify chart data | `src/lib/transformers/chart-data.ts` |
| Add/change types | `src/types/*.types.ts` |

For comprehensive navigation, see: `docs/ai/FINDING_THINGS.md`

---

## ✅ Coding Standards (MUST FOLLOW)

### 1. Imports
```typescript
// ✅ ALWAYS use absolute imports
import { Button } from '@/components/ui/Button'
import type { Exercise } from '@/types/domain'

// ❌ NEVER use relative imports
import { Button } from '../../../components/ui/Button'
```

### 2. Exports
```typescript
// ✅ ALWAYS use named exports
export function buildLoad() { }
export const MyComponent = () => { }

// ❌ NEVER use default exports
export default function buildLoad() { }
```

### 3. Client Components
```typescript
// ✅ REQUIRED for interactive components
'use client'

import { useState } from 'react'
export function InteractiveComponent() { ... }
```

### 4. Constants
```typescript
// ✅ Import from constants module
import { DEFAULT_REST_SECONDS } from '@/constants/training'

// ❌ No magic numbers
const rest = 90  // Bad!
```

### 5. Types
```typescript
// ✅ Import from domain barrel
import type { Exercise, FocusArea } from '@/types/domain'

// ✅ Or from specific type file
import type { Exercise } from '@/types/exercise.types'
```

For all conventions, see: `docs/ai/CONVENTIONS.md`

---

## 🚫 Forbidden Patterns

1. **No `npm build`, `npm install`** - User manages environment
2. **No default exports** - Use named exports only
3. **No relative imports** - Use `@/` path aliases
4. **No magic numbers** - Define in `src/constants/`
5. **No duplicate utilities** - Use shared modules in `src/lib/`
6. **No giant files** - Split files >250 lines

---

## 🔧 Making Changes

### Before You Edit

1. **Understand the file's purpose** - Read the module's JSDoc comments
2. **Check for existing utilities** - Don't duplicate code in:
   - `src/lib/math.ts` - Math utilities
   - `src/lib/date-utils.ts` - Date formatting
   - `src/constants/training.ts` - Training constants
3. **Identify callers** - Search for imports of the function you're changing

### When Editing

1. **Preserve public APIs** - Update all callers if changing signatures
2. **Keep files small** - Extract to new module if adding significant code
3. **Use existing patterns** - Match the style of surrounding code
4. **Add types** - All new code must be fully typed

### After You Edit

1. **Run type check** - `npx tsc --noEmit`
2. **Run tests** - `npm test`
3. **Check imports** - Ensure no circular dependencies

---

## 📊 Key Modules Reference

### Generator Engine (`src/lib/generator/`)
```
engine.ts           → buildWorkoutTemplate() - Main entry point
engine-core.ts      → generateSessionExercises() - Core algorithm
selection-logic.ts  → selectExercises() - Exercise filtering
scoring.ts          → scoreExercise() - Ranking exercises
volume-math.ts      → calculateSets() - Set/rep calculations
```

### Metrics Calculations
```
session-metrics.ts  → E1RM, tonnage, intensity per set
training-metrics.ts → Load ratio, readiness, recovery
workout-metrics.ts  → Session workload scoring
```

### Types Structure
```
domain.ts           → Barrel file (import types from here)
core.types.ts       → Goal, FocusArea, Intensity, etc.
equipment.types.ts  → EquipmentInventory, EquipmentOption
exercise.types.ts   → Exercise, ExercisePrescription
session.types.ts    → WorkoutSession, WorkoutSet
plan.types.ts       → PlanInput, WorkoutTemplate
```

### Shared Utilities
```
math.ts             → clamp(), weightedAverage(), isValidNumber()
date-utils.ts       → formatDate(), getWeekKey(), formatChartDate()
units.ts            → convertWeight(), toKg(), toLbs()
```

---

## 🗄️ Database Access

```typescript
// Client-side
import { createClient } from '@/lib/supabase/client'
const supabase = createClient()

// Server-side (in page.tsx)
import { createClient } from '@/lib/supabase/server'
const supabase = await createClient()
```

**Key Tables:**
- `workout_templates` - Saved workout configurations
- `workout_sessions` - Active/completed sessions
- `session_exercises` - Exercises in a session
- `workout_sets` - Individual logged sets
- `exercise_catalog` - Master exercise library
- `profiles` - User settings

---

## 📏 File Size Guidelines

| Type | Target Size | Split Strategy |
|------|-------------|----------------|
| Components | <250 lines | Extract sub-components to `/session/`, `/modals/` |
| Hooks | <200 lines | Extract helper hooks or utility functions |
| Lib files | <300 lines | Create focused modules with barrel exports |
| Type files | <200 lines | Split by domain (equipment, session, etc.) |

---

## 🧪 Testing

```bash
# Run all tests
npm test

# Run specific test
npm test -- tests/generator.test.js
```

Test files are in `tests/` directory. Tests use Jest.

---

## 🚀 Quick Reference

### Add a new training constant
1. Add to `src/constants/training.ts`
2. Import where needed: `import { MY_CONSTANT } from '@/constants/training'`

### Add a new utility function
1. Find appropriate module in `src/lib/`
2. If module >300 lines, create new file
3. Export from module, update barrel file if applicable

### Add a new type
1. Add to appropriate `src/types/*.types.ts` file
2. Re-export from `src/types/domain.ts` barrel

### Add a new component
1. Create in `src/components/[feature]/ComponentName.tsx`
2. Use named export, add `'use client'` if interactive
3. Import UI primitives from `@/components/ui/`

---

## 📖 Additional Documentation

- `docs/ai/ARCHITECTURE.md` - System architecture and data flows
- `docs/ai/FINDING_THINGS.md` - Feature-to-code mapping
- `docs/ai/CONVENTIONS.md` - Detailed coding conventions
- `docs/metrics-dashboard.md` - Progress metrics documentation
