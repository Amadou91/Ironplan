# Ironplan - Copilot Instructions

**Fitness app**: Next.js 16+ App Router, TypeScript (strict), Supabase, Zustand, Tailwind, Recharts.

## Critical Rules

### Always Do

1. **Absolute imports**: `import { X } from '@/components/...'`
2. **Named exports**: `export function X() {}`
3. **Type keyword**: `import type { X } from '@/types/domain'`
4. **Client directive**: First line `'use client'` for interactive components
5. **Constants module**: Import from `@/constants/training`

### Never Do

1. **No relative imports**: `../../../` is forbidden
2. **No default exports**: `export default` is forbidden
3. **No magic numbers**: Define in `src/constants/`
4. **No files >250 LOC**: Split into sub-components/modules

## Key Locations

| Task | File |
|------|------|
| Workout generation | `src/lib/generator/engine.ts` |
| Exercise calcs | `src/lib/session-metrics.ts` |
| Constants | `src/constants/training.ts` |
| Session UI | `src/components/workout/ActiveSession.tsx` |
| Charts | `src/lib/transformers/chart-data.ts` |
| Types | `src/types/domain.ts` (barrel) |
| Math utils | `src/lib/math.ts` |
| Date utils | `src/lib/date-utils.ts` |

## Type Structure

```
src/types/
├── domain.ts          # Import from here
├── core.types.ts      # Goals, focus, intensity
├── exercise.types.ts  # Exercise definitions
├── session.types.ts   # Sessions, sets
└── equipment.types.ts # Equipment
```

## Generator Structure

```
src/lib/generator/
├── engine.ts          # buildWorkoutTemplate()
├── engine-core.ts     # generateSessionExercises()
├── selection-logic.ts # selectExercises()
├── scoring.ts         # scoreExercise()
└── volume-math.ts     # calculateSets()
```

## Supabase Access

```typescript
// Client-side
import { createClient } from '@/lib/supabase/client'

// Server-side
import { createClient } from '@/lib/supabase/server'
```

## Before Committing

```bash
npx tsc --noEmit  # Type check
npm test          # Run tests
```
