# Ironplan

Ironplan is a constraint-driven workout planner that builds personalized programs from time, schedule, and preference inputs.

## What Ironplan Generates

Ironplan produces a weekly schedule with exercises, duration estimates, and rationale strings that explain why each day looks the way it does.

## Maintenance

### Generating Default Exercises
To update the default exercise dataset (used for the Admin "Reset to Defaults" feature), run the following script. This reads from the current database state, applies normalization rules (e.g., locking Yoga to Mobility goal), and writes to `src/lib/data/defaultExercises.ts`.

```bash
# Ensure .env.local has NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY
npx tsx scripts/generate-defaults.ts
```

### Resetting Workouts
In the Admin Dashboard (`/admin`), use the "Reset to Defaults" button to wipe the `exercise_catalog` table and restore it from the generated `src/lib/data/defaultExercises.ts` file. This is useful for syncing environments or restoring after bad edits.

## Configuration Inputs

The generator accepts a structured input object with defaults for every field:

### Core Inputs

- **Primary goal**: `strength`, `hypertrophy`, `endurance`, `general_fitness`
- **Experience level**: `beginner`, `intermediate`, `advanced`
- **Intensity**: `low`, `moderate`, `high`
- **Available time**:
  - `minutesPerSession` (20-120)
  - `totalMinutesPerWeek` (optional)
- **Schedule**:
  - `daysAvailable` (0-6 for Sun-Sat)
  - `timeWindows` (`morning`, `afternoon`, `evening`)
  - `minRestDays` (0-2)
- **Equipment**: `gym`, `dumbbells`, `bodyweight`, `bands`, `kettlebell`

### Advanced Preferences

- **Secondary goal** + **priority** (`primary`, `balanced`, `secondary`)
- **Focus areas**: `upper`, `lower`, `full_body`, `core`, `cardio`, `mobility`
- **Disliked activities**: free-form strings used for filtering
- **Accessibility constraints**: `low-impact`, `joint-friendly`, `no-floor-work`
- **Rest preference**: `balanced`, `high_recovery`, `minimal_rest`

## Example Input

```json
{
  "goals": { "primary": "endurance", "secondary": "strength", "priority": "balanced" },
  "experienceLevel": "intermediate",
  "intensity": "moderate",
  "equipment": ["bodyweight", "bands"],
  "time": { "minutesPerSession": 40, "totalMinutesPerWeek": 160 },
  "schedule": { "daysAvailable": [1, 3, 5, 6], "timeWindows": ["morning"], "minRestDays": 1 },
  "preferences": {
    "focusAreas": ["cardio", "core"],
    "dislikedActivities": ["running"],
    "accessibilityConstraints": ["low-impact"],
    "restPreference": "balanced"
  }
}
```

## Extending Constraints

1. Add new constraint fields to `src/types/domain.ts`.
2. Update validation in `src/lib/generator.ts`.
3. Add selection controls in `src/app/generate/page.tsx`.
4. Adjust exercise filtering or schedule-building logic in the generator.

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

Run generator tests with the Node test runner:

```bash
node --test tests/generator.test.js
```

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
