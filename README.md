# Ironplan

Ironplan is a constraint-driven workout planner that builds personalized programs from time, schedule, and preference inputs. It calculates advanced training metrics like E1RM, Volume Load, and Acute:Chronic Workload Ratio (ACR) to optimize recovery and progress.

## Tech Stack

- **Framework:** Next.js 16 (App Router)
- **Language:** TypeScript
- **Database/Auth:** Supabase (PostgreSQL)
- **Styling:** Tailwind CSS 4
- **State Management:** Zustand
- **Testing:** Node.js Native Test Runner

## Getting Started

### Prerequisites

- Node.js 20+
- A Supabase project (for local development or production)

### Setup

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/your-repo/ironplan.git
    cd ironplan
    ```

2.  **Install dependencies:**
    ```bash
    npm install
    ```

3.  **Environment Variables:**
    Create a `.env.local` file with your Supabase credentials:
    ```env
    NEXT_PUBLIC_SUPABASE_URL=your-project-url
    NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
    ```

4.  **Run Development Server:**
    ```bash
    npm run dev
    ```
    Access the app at [http://localhost:3000](http://localhost:3000).

## Available Scripts

- `npm run dev`: Start development server.
- `npm run build`: Build the production application.
- `npm test`: Run the test suite.
- `npm run typecheck`: Run TypeScript compiler checks.
- `npm run lint`: Run ESLint.
- `npx tsx scripts/generate-defaults.ts`: Sync default exercise dataset from current database state.

## Project Structure

- `src/app/`: Next.js routes and layouts.
- `src/components/`: Feature-scoped React components.
- `src/lib/`: Core business logic, workout engine, and math utilities.
- `src/hooks/`: Custom React hooks for state and data fetching.
- `src/store/`: Zustand stores for global state.
- `src/types/`: TypeScript domain and database types.
- `docs/ai/`: Detailed documentation on architecture, math, and domain logic.

## Core Logic

Ironplan uses advanced formulas to track progress and readiness:
- **E1RM:** Estimated 1-Rep Max based on weight, reps, and RPE.
- **ACR:** Acute:Chronic Workload Ratio to identify overtraining (Balanced: 0.8 - 1.3).
- **Readiness:** Daily score (0-100) derived from sleep, stress, soreness, and motivation.

For more details, see `docs/ai/domain.md`.
