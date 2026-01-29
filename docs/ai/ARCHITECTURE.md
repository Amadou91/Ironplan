# Ironplan Architecture

> A workout planning and tracking application built with Next.js 16+ (App Router)

## System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         Next.js App Router                        │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐              │
│  │   /generate │  │  /workouts  │  │  /progress  │  ...         │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘              │
└─────────┼─────────────────┼─────────────────┼───────────────────┘
          │                 │                 │
          ▼                 ▼                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                         Components                                │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐              │
│  │   generate/ │  │   workout/  │  │  progress/  │              │
│  └─────────────┘  └─────────────┘  └─────────────┘              │
└─────────────────────────────────────────────────────────────────┘
          │                 │                 │
          ▼                 ▼                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                           Hooks                                   │
│  useGenerationFlow  useActiveSessionManager  useProgressMetrics  │
└─────────────────────────────────────────────────────────────────┘
          │                 │                 │
          ▼                 ▼                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                         Lib (Domain)                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐              │
│  │  generator/ │  │session-*    │  │transformers/│              │
│  └─────────────┘  └─────────────┘  └─────────────┘              │
└─────────────────────────────────────────────────────────────────┘
          │                 │                 │
          ▼                 ▼                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Supabase (PostgreSQL)                        │
│                    lib/supabase/client.ts                         │
└─────────────────────────────────────────────────────────────────┘
```

## Directory Structure

```
src/
├── app/                    # Next.js App Router pages
│   ├── generate/           # Workout generation wizard
│   ├── workouts/           # Workout templates & sessions
│   │   ├── [id]/           # Dynamic workout routes
│   │   │   ├── start/      # Start new session
│   │   │   ├── active/     # Live session tracking
│   │   │   └── summary/    # Session completion
│   │   └── active/         # Resume active session
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
│   └── ui/                 # Shared primitives (Button, Card, etc.)
│
├── hooks/                  # Custom React hooks
│   ├── useGenerationFlow   # Generation wizard state
│   ├── useActiveSessionManager # Live session state
│   ├── useDashboardData    # Dashboard aggregation
│   └── useProgressMetrics  # Analytics queries
│
├── lib/                    # Pure logic & utilities
│   ├── generator/          # Workout generation engine
│   │   ├── engine.ts       # Main entry point
│   │   ├── engine-core.ts  # Core generation logic
│   │   ├── selection-logic # Exercise picking
│   │   ├── scoring.ts      # Recommendation scoring
│   │   └── ...utils        # Focused utility modules
│   ├── supabase/           # DB client wrappers
│   ├── transformers/       # Data transformations for charts
│   ├── validation/         # Schema validation
│   ├── math.ts             # Shared math utilities
│   ├── date-utils.ts       # Date formatting utilities
│   ├── session-metrics.ts  # Set/session calculations
│   ├── training-metrics.ts # Training load analysis
│   └── equipment.ts        # Equipment presets & helpers
│
├── constants/              # Application constants
│   └── training.ts         # All training-related magic numbers
│
├── types/                  # TypeScript type definitions
│   ├── domain.ts           # Barrel file (re-exports all)
│   ├── core.types.ts       # Goals, focus, units
│   ├── equipment.types.ts  # Equipment inventory
│   ├── exercise.types.ts   # Exercise definitions
│   ├── session.types.ts    # Workout sessions
│   └── plan.types.ts       # Plans & templates
│
└── store/                  # Zustand state stores
    ├── useWorkoutStore.ts  # Active session state
    ├── uiStore.ts          # UI preferences
    └── authStore.ts        # Auth state
```

## Key Data Flows

### 1. Workout Generation
```
User Input → useGenerationFlow → generator/engine.ts → 
  → selection-logic.ts (pick exercises) 
  → scoring.ts (rank options)
  → volume-math.ts (calculate sets/reps)
→ Supabase (save template) → Navigate to /workouts/[id]/start
```

### 2. Active Session
```
Template → /workouts/[id]/start → Create Session Row → 
Navigate to /workouts/[id]/active → 
  → useActiveSessionManager (state)
  → ActiveSession component (UI)
  → SetLogger (individual sets)
→ Supabase (real-time updates) → 
Session Complete → /workouts/[id]/summary
```

### 3. Progress Analytics
```
Supabase (historical sessions) → useProgressMetrics →
transformers/chart-data.ts (aggregate) →
ProgressCharts component → Recharts visualization
```

## Database Access

All database access goes through Supabase client:

- **Client-side:** `@/lib/supabase/client`
- **Server-side:** `@/lib/supabase/server`

Key tables:
- `workout_templates` - Saved workout configurations
- `workout_sessions` - Active/completed workout instances
- `session_exercises` - Exercises within a session
- `workout_sets` - Individual sets with metrics
- `exercise_catalog` - Master exercise library
- `profiles` - User settings and preferences

## State Management

- **Zustand stores** (`src/store/`) for global state
- **React hooks** (`src/hooks/`) for feature-specific state
- **React Context** for auth (`AuthProvider`)

## Technology Stack

| Layer | Technology |
|-------|------------|
| Framework | Next.js 16+ (App Router) |
| Language | TypeScript (strict) |
| Database | Supabase (PostgreSQL) |
| State | Zustand + React Context |
| Styling | Tailwind CSS |
| Charts | Recharts |
| Icons | Lucide React |
