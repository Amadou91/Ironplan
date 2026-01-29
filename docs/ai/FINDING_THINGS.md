# Finding Things in Ironplan

Quick reference for locating code by feature or task.

## Common Changes

### "I need to change how workouts are generated"
```
src/lib/generator/
├── engine.ts           # Entry point - buildWorkoutTemplate()
├── engine-core.ts      # Core logic - generates exercises for a session
├── selection-logic.ts  # Exercise picking and filtering
├── scoring.ts          # Recommendation ranking
├── volume-math.ts      # Sets/reps calculations
└── constants.ts        # Generation parameters
```

### "I need to modify exercise calculations"
```
src/lib/session-metrics.ts    # E1RM, tonnage, intensity
src/lib/training-metrics.ts   # Load analysis, readiness
src/lib/workout-metrics.ts    # Workload scoring
```

### "I need to add/modify a constant"
```
src/constants/training.ts     # ALL training constants here
```

### "I need to change the active session UI"
```
src/components/workout/
├── ActiveSession.tsx         # Main session component
├── SetLogger.tsx             # Individual set logging
├── session/                  # Sub-components
└── modals/                   # Add/swap exercise dialogs
```

### "I need to change chart visualizations"
```
src/components/progress/
├── ProgressCharts.tsx        # Main charts container
├── WeeklyVolumeChart.tsx     # Volume chart
├── MuscleSplitChart.tsx      # Muscle distribution
└── MetricCards.tsx           # Summary cards

src/lib/transformers/chart-data.ts  # Data transformations
```

### "I need to modify user profile/settings"
```
src/components/profile/
├── PhysicalStatsForm.tsx     # Body metrics
├── AppSettings.tsx           # App preferences
└── WeightHistorySection.tsx  # Weight log
```

### "I need to change types"
```
src/types/
├── domain.ts          # Barrel file (import from here)
├── core.types.ts      # Basic types (goals, focus, units)
├── equipment.types.ts # Equipment definitions
├── exercise.types.ts  # Exercise & prescription types
├── session.types.ts   # Session & set types
└── plan.types.ts      # Plan & template types
```

## Feature Locations

| Feature | Location |
|---------|----------|
| Dashboard | `src/app/dashboard/`, `src/hooks/useDashboardData.ts` |
| Generation | `src/app/generate/`, `src/hooks/useGenerationFlow.ts`, `src/lib/generator/` |
| Active Session | `src/app/workouts/[id]/active/`, `src/hooks/useActiveSessionManager.ts` |
| Progress | `src/app/progress/`, `src/hooks/useProgressMetrics.ts` |
| Exercise Catalog | `src/components/admin/`, `src/lib/data/defaultExercises.ts` |
| Equipment | `src/lib/equipment.ts`, `src/lib/equipment-groups.ts` |

## Database Queries

Database interactions are typically in:
- **Hooks** (`src/hooks/`) - For React components
- **Lib files** (`src/lib/`) - For pure functions that take a supabase client

Key patterns:
```typescript
// Client-side query
import { createClient } from '@/lib/supabase/client'
const supabase = createClient()
const { data, error } = await supabase.from('table').select()

// Server-side query (in page.tsx)
import { createClient } from '@/lib/supabase/server'
const supabase = await createClient()
```

## Utility Modules

| Utility | Location | Purpose |
|---------|----------|---------|
| Math | `src/lib/math.ts` | clamp, weightedAverage |
| Dates | `src/lib/date-utils.ts` | formatDate, getWeekKey |
| Units | `src/lib/units.ts` | Weight/distance conversions |
| Muscles | `src/lib/muscle-utils.ts` | Muscle group mapping |
| Validation | `src/lib/validation/schemas.ts` | Input validation |

## Testing

```
tests/
├── generator.test.js          # Generation engine tests
├── session-metrics.test.js    # Calculation tests
├── workout-store.test.js      # State management tests
└── ...
```

Run tests: `npm test`
