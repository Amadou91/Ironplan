# Ironplan Codebase Map

> **Navigator** for the Ironplan codebase. Use this to locate features and understand the physical layout.

## Directory Structure

```
src/
├── app/                    # Next.js App Router (Routes = Folders)
│   ├── generate/           # Workout generation wizard
│   ├── workouts/           # Workout templates & sessions
│   ├── progress/           # Analytics & history
│   ├── profile/            # User settings
│   └── dashboard/          # Home dashboard
│
├── components/             # React Components (Feature-scoped)
│   ├── workout/            # Active session & logging
│   ├── generate/           # Generation wizard UI
│   ├── progress/           # Charts & visualizations
│   ├── profile/            # Settings forms
│   └── ui/                 # Shared primitives (Button, Card, etc.)
│
├── hooks/                  # React Hooks
│   ├── useGenerationFlow   # Wizard state machine
│   ├── useActiveSession    # Live workout state
│   └── useProgressMetrics  # Analytics data fetching
│
├── lib/                    # Business Logic & Utilities
│   ├── generator/          # WORKOUT ENGINE (The brain)
│   ├── session-metrics.ts  # Math: Volume, Intensity, E1RM
│   ├── training-metrics.ts # Math: Readiness, Load Ratio
│   ├── transformers/       # Data prep for Recharts
│   └── supabase/           # Database clients
│
├── constants/              # Magic Numbers & Config
│   └── training.ts         # ALL training constants
│
└── types/                  # TypeScript Definitions
    ├── domain.ts           # Main entry point (Barrel)
    └── *.types.ts          # Specific domain types
```

## Feature Locations

| Feature | Logic (`src/lib`) | UI (`src/components`) | State (`src/hooks` / `store`) |
|---------|-------------------|-----------------------|-------------------------------|
| **Generation** | `generator/engine.ts` | `generate/*` | `useGenerationFlow.ts` |
| **Active Session** | `session-metrics.ts` | `workout/ActiveSession.tsx` | `useActiveSessionManager.ts` |
| **Analytics** | `transformers/chart-data.ts` | `progress/ProgressCharts.tsx` | `useProgressMetrics.ts` |
| **Readiness** | `training-metrics.ts` | `dashboard/ReadinessCard.tsx` | `useDashboardData.ts` |

## Key Libraries

- **Calculations:** `src/lib/session-metrics.ts` (E1RM, Volume)
- **Math:** `src/lib/math.ts` (clamp, averages)
- **Dates:** `src/lib/date-utils.ts` (Formatting)
- **Validation:** `src/lib/validation/schemas.ts` (Zod)

## Database Tables

| Table | Purpose |
|-------|---------|
| `workout_templates` | Saved plans |
| `workout_sessions` | Execution history |
| `workout_sets` | The actual data (reps/weight) |
| `session_readiness` | Daily readiness scores |
| `profiles` | User settings |
