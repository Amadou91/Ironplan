# Ironplan Coding Conventions

Guidelines for consistent, AI-agent-friendly code.

## File Naming

| Type | Convention | Example |
|------|------------|---------|
| Routes | `kebab-case` folders | `src/app/workout-history/` |
| Components | `PascalCase.tsx` | `ActiveSession.tsx` |
| Hooks | `useCamelCase.ts` | `useGenerationFlow.ts` |
| Libraries | `kebab-case.ts` | `session-metrics.ts` |
| Types | `*.types.ts` | `equipment.types.ts` |
| Constants | `kebab-case.ts` | `training.ts` |

## Import Conventions

**Always use absolute imports:**
```typescript
// ✅ Good
import { Button } from '@/components/ui/Button'
import { clamp } from '@/lib/math'
import type { Exercise } from '@/types/domain'

// ❌ Bad
import { Button } from '../../../components/ui/Button'
```

**Import types with `type` keyword:**
```typescript
import type { Exercise, FocusArea } from '@/types/domain'
```

## Export Conventions

**Use named exports only:**
```typescript
// ✅ Good
export function buildLoad() { }
export const DEFAULT_REST = 90

// ❌ Bad
export default function buildLoad() { }
```

## Component Patterns

**Client components must declare directive:**
```typescript
'use client'  // First line for interactive components

import { useState } from 'react'
// ...
```

**Prefer Server Components** unless you need:
- useState/useEffect
- Browser APIs
- Event handlers

## File Size Guidelines

| Type | Soft Limit | Action if Exceeded |
|------|------------|-------------------|
| Components | 250 lines | Extract sub-components |
| Hooks | 200 lines | Extract helper hooks |
| Lib files | 300 lines | Split into modules |
| Type files | 200 lines | Split by domain |

## Constants

**All training-related constants go in `src/constants/training.ts`:**
```typescript
// ✅ Good - import from constants
import { DEFAULT_REST_SECONDS } from '@/constants/training'

// ❌ Bad - local magic number
const rest = 90
```

## Type Organization

**Import from barrel file for convenience:**
```typescript
import type { Exercise, FocusArea, Goal } from '@/types/domain'
```

**Import from specific file for clarity:**
```typescript
import type { Exercise } from '@/types/exercise.types'
import type { WorkoutSession } from '@/types/session.types'
```

## Error Handling

**Database operations:**
```typescript
const { data, error } = await supabase.from('table').select()
if (error) {
  console.error('Failed to fetch:', error.message)
  return null // or throw
}
```

## Forbidden Patterns

1. **No inline `export default`** - Use named exports
2. **No relative imports** - Use `@/` aliases
3. **No magic numbers** - Define in constants
4. **No duplicate utilities** - Use shared modules
5. **No mixed concerns** - Keep UI, data, and logic separate

## Generator Module Structure

The generator uses focused modules:
```
src/lib/generator/
├── engine.ts           # Public API
├── engine-core.ts      # Core algorithm
├── utils.ts            # Barrel re-exports
├── seeded-random.ts    # RNG
├── equipment-matching.ts
├── load-building.ts
├── focus-utils.ts
├── movement-utils.ts
├── timing-utils.ts
├── session-naming.ts
├── focus-sequence.ts
└── impact-utils.ts
```

## Database Naming

Tables use `snake_case`:
- `workout_sessions`
- `session_exercises`
- `workout_sets`

TypeScript types use `PascalCase`:
- `WorkoutSession`
- `SessionExercise`
- `WorkoutSet`

## Chart Data

All chart transformations go through `src/lib/transformers/chart-data.ts`.

Date formatting uses `src/lib/date-utils.ts`:
```typescript
import { formatDate, formatChartDate, getWeekKey } from '@/lib/date-utils'
```
