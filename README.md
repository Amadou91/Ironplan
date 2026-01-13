Ironplan is a constraint-driven workout planner that builds personalized programs from time, schedule, and preference inputs.

## What Ironplan Generates

Ironplan produces a weekly schedule with exercises, duration estimates, and rationale strings that explain why each day looks the way it does.

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

## Supabase Setup

### Required environment variables

This app requires Supabase client credentials at build/runtime:

- `NEXT_PUBLIC_SUPABASE_URL` (Supabase project URL)
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` (public anon key)

Optional server-only variables (only if you add server-side admin tasks or custom JWT verification):

- `SUPABASE_SERVICE_ROLE_KEY` (server-only, never expose to the client)
- `SUPABASE_JWT_SECRET` (only if you verify tokens manually)

Copy `.env.example` to `.env.local` and fill in values.

### Supabase project creation

1. Create or select a Supabase project at https://app.supabase.com.
2. In **Project Settings → API**, copy:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **anon public key** → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **service_role key** → `SUPABASE_SERVICE_ROLE_KEY` (server-only)
3. In **Authentication → URL Configuration**, add redirect URLs:
   - Local: `http://localhost:3000/auth/callback`
   - Production: `https://your-domain.com/auth/callback`

### Database schema & RLS

The initial schema and RLS policies live in `supabase/migrations/20240201000000_init.sql`.
Ensure RLS stays enabled for `public.workouts`, and avoid exposing tables without policies.

## Local Development (preferred)

This repo is configured for Supabase CLI + local Docker stack.

1. Install the Supabase CLI: https://supabase.com/docs/guides/cli
2. Start Supabase locally:

```bash
npm run supabase:start
```

3. In another terminal, copy env values from `supabase status` into `.env.local`:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
4. Apply migrations (first time or after schema changes):

```bash
npm run supabase:migrate
```

5. Run the app:

```bash
npm run dev
```

To reset local data:

```bash
npm run supabase:reset
```

Stop the local stack:

```bash
npm run supabase:stop
```

## CI / GitHub Actions

The CI workflow runs lint, tests, and build using placeholder Supabase values so no secrets
are required. If you add server-side Supabase admin usage, configure GitHub Actions secrets
and inject them in the workflow.

To add secrets in GitHub:

1. Repo → **Settings → Secrets and variables → Actions**.
2. Add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` if you want real
   integration tests.
3. Add `SUPABASE_SERVICE_ROLE_KEY` only if you have server-only workflows that need it.

Secret scanning runs via Gitleaks in CI; do not commit `.env*` files.

## Deployment

### Provider-agnostic steps

1. Set the environment variables in your deploy platform:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY` (server-only, optional)
2. Configure Supabase auth redirect URLs to include the deployed domain:
   - `https://your-domain.com/auth/callback`
3. Run migrations:
   - Use Supabase CLI: `supabase db push` (from CI or a deploy hook)
   - Or run SQL from `supabase/migrations/20240201000000_init.sql`

### Common platforms

- **Vercel**: Project → Settings → Environment Variables.
- **Netlify**: Site settings → Build & deploy → Environment.
- **Render/Fly**: Service → Environment settings.

Ensure only `NEXT_PUBLIC_*` variables are exposed to the browser.

## Troubleshooting

- **Missing env vars**: The app throws a clear error pointing to `.env.example`.
- **Auth redirect errors**: Ensure Supabase redirect URLs include your local and production
  callback URLs.
- **RLS issues**: Verify policies exist and `auth.uid()` matches `workouts.user_id`.

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
