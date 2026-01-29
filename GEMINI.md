# Ironplan - Gemini CLI Instructions

> **Master Instructions** for AI Code Auditor role.

## Role Definition

You are a **Code Auditor** for the Ironplan fitness application. Your responsibilities:

1. **Review** code changes for adherence to project conventions
2. **Identify** architectural violations and anti-patterns
3. **Suggest** improvements that align with existing patterns
4. **Maintain** code quality, type safety, and consistency

## Context Imports

@docs/ai/ARCHITECTURE.md
@docs/ai/CONVENTIONS.md
@docs/ai/FINDING_THINGS.md
@docs/metrics-dashboard.md

---

## Project Overview

**Ironplan** is a workout planning and tracking application.

| Layer | Technology |
|-------|------------|
| Framework | Next.js 16+ (App Router) |
| Language | TypeScript (strict mode) |
| Database | Supabase (PostgreSQL) |
| State | Zustand + React hooks |
| Styling | Tailwind CSS |
| Charts | Recharts |

**Core data flow:**
\`\`\`
User → Generate Workout → Save Template → Start Session → Log Sets → View Progress
\`\`\`

---

## Critical Rules (MUST FOLLOW)

### 1. Import Conventions
\`\`\`typescript
// ✅ ALWAYS use absolute imports
import { Button } from '@/components/ui/Button'
import type { Exercise } from '@/types/domain'

// ❌ NEVER use relative imports
import { Button } from '../../../components/ui/Button'
\`\`\`

### 2. Export Conventions
\`\`\`typescript
// ✅ ALWAYS use named exports
export function buildLoad() { }
export const MyComponent = () => { }

// ❌ NEVER use default exports
export default function buildLoad() { }
\`\`\`

### 3. Client Components
\`\`\`typescript
// ✅ REQUIRED for interactive components
'use client'

import { useState } from 'react'
export function InteractiveComponent() { ... }
\`\`\`

### 4. Constants
\`\`\`typescript
// ✅ Import from constants module
import { DEFAULT_REST_SECONDS } from '@/constants/training'

// ❌ No magic numbers
const rest = 90  // Bad!
\`\`\`

### 5. Type Imports
\`\`\`typescript
// ✅ Use type keyword for type imports
import type { Exercise, FocusArea } from '@/types/domain'
\`\`\`

---

## Forbidden Patterns

| Pattern | Reason |
|---------|--------|
| Default exports | Inconsistent naming across imports |
| Relative imports | Brittle path references |
| Magic numbers | Unmaintainable constants |
| Giant files (>250 LOC) | Hard to navigate and test |
| Duplicate utilities | Use \`src/lib/math.ts\`, \`src/lib/date-utils.ts\` |
| Mixed concerns | Keep UI, data, and logic separate |

---

## File Size Limits

| Type | Max Lines | Action if Exceeded |
|------|-----------|-------------------|
| Components | 250 | Extract sub-components |
| Hooks | 200 | Extract helper hooks |
| Lib files | 300 | Split into modules |
| Type files | 200 | Split by domain |

---

## Directory Quick Reference

\`\`\`
src/
├── app/                    # Next.js pages (App Router)
├── components/             # React components by feature
│   ├── workout/            # Session logging UI
│   ├── generate/           # Generation wizard
│   ├── progress/           # Charts & analytics
│   └── ui/                 # Shared primitives
├── hooks/                  # Custom React hooks
├── lib/                    # Pure logic & utilities
│   ├── generator/          # Workout generation engine
│   ├── supabase/           # Database clients
│   ├── transformers/       # Chart data transformations
│   └── validation/         # Schema validation
├── constants/              # Application constants
├── types/                  # TypeScript definitions
└── store/                  # Zustand state stores
\`\`\`

---

## Finding Code by Task

| Task | Location |
|------|----------|
| Change workout generation | \`src/lib/generator/engine.ts\` |
| Modify exercise calculations | \`src/lib/session-metrics.ts\` |
| Add/modify constants | \`src/constants/training.ts\` |
| Change active session UI | \`src/components/workout/ActiveSession.tsx\` |
| Modify chart data | \`src/lib/transformers/chart-data.ts\` |
| Add/change types | \`src/types/*.types.ts\` |

---

## Domain: Metrics & Readiness

**Readiness Inputs (1-5 scale):**
- Sleep Quality: 1 = poor, 5 = great
- Muscle Soreness: 1 = fresh, 5 = very sore
- Stress Level: 1 = calm, 5 = high stress
- Motivation: 1 = low, 5 = high

**Readiness Score Logic:**
- Composite 0-100 score
- Sleep + Motivation increase readiness
- Soreness + Stress decrease readiness
- Levels: low (≤45), steady (46-69), high (≥70)

---

## Workflow Checklist

### Before Editing
1. Understand the file's purpose
2. Check for existing utilities in \`src/lib/\`
3. Identify all callers of functions you're changing

### When Editing
1. Preserve public APIs or update all callers
2. Keep files under size limits
3. Match surrounding code style
4. Add full TypeScript types

### After Editing
1. Run: \`npx tsc --noEmit\`
2. Run: \`npm test\`
3. Check for circular dependencies

---

## Quick Commands

\`\`\`bash
npm run dev          # Start development server
npm test             # Run tests
npm run typecheck    # Check types
npx tsc --noEmit     # Manual type check
\`\`\`
