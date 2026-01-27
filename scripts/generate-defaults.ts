
import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

// Try to read .env.local
const envPath = path.resolve(process.cwd(), '.env.local');
let envContent = '';
try {
  envContent = fs.readFileSync(envPath, 'utf-8');
} catch (e) {
  // ignore
}

const getEnv = (key: string) => {
  const match = envContent.match(new RegExp(`${key}=(.*)`));
  return match ? match[1] : process.env[key];
};

const url = getEnv('NEXT_PUBLIC_SUPABASE_URL');
const key = getEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY');

if (!url || !key) {
  console.error('Error: NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are required.');
  console.error('Ensure .env.local exists or variables are set.');
  process.exit(1);
}

const supabase = createClient(url, key);

async function run() {
  console.log('Fetching exercises...');
  const { data: exercises, error } = await supabase
    .from('exercise_catalog')
    .select('*');

  if (error) {
    console.error('Error fetching exercises:', error);
    process.exit(1);
  }

  console.log(`Fetched ${exercises.length} exercises.`);

  const processed = exercises.map((ex: any) => {
    // Normalization Logic
    let category = 'Strength';
    let goal = ex.goal;

    // Check for Yoga
    if (
      ex.metric_profile === 'yoga_session' ||
      ex.name.toLowerCase().includes('yoga') ||
      ex.primary_muscle === 'mobility' // if that exists
    ) {
      category = 'Yoga';
      goal = 'mobility';
    }
    // Check for Cardio
    else if (
      ex.metric_profile === 'cardio_session' ||
      ex.focus === 'cardio' ||
      ex.category === 'Cardio' // if it already exists
    ) {
      category = 'Cardio';
      goal = 'cardio';
    }

    // Clean up fields
    return {
      name: ex.name,
      category, // Inferred or existing
      focus: ex.focus,
      metricProfile: ex.metric_profile,
      sets: ex.sets || 3,
      reps: ex.reps || 10,
      rpe: ex.rpe || 7,
      equipment: ex.equipment ? (typeof ex.equipment === 'string' ? JSON.parse(ex.equipment) : ex.equipment) : [],
      difficulty: ex.difficulty || 'beginner',
      eligibleGoals: ex.eligible_goals || (goal ? [goal] : []),
      goal: goal,
      durationMinutes: ex.duration_minutes || 0,
      restSeconds: ex.rest_seconds || 60,
      primaryMuscle: ex.primary_muscle,
      secondaryMuscles: ex.secondary_muscles || [],
      instructions: ex.instructions || [],
      videoUrl: ex.video_url || ''
    };
  });

  // Deduplicate by name
  const seen = new Set();
  const unique = processed.filter((ex: any) => {
    if (seen.has(ex.name)) return false;
    seen.add(ex.name);
    return true;
  });

  console.log(`Deduped to ${unique.length} exercises.`);

  const fileContent = `// Auto-generated default exercises
import type { Exercise } from '@/types/domain';

export const DEFAULT_EXERCISES: Partial<Exercise>[] = ${JSON.stringify(unique, null, 2)};
`;

  const outputPath = path.resolve(process.cwd(), 'src/lib/data/defaultExercises.ts');
  fs.writeFileSync(outputPath, fileContent);
  console.log(`Wrote to ${outputPath}`);
}

run();
