
import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

// Try to read .env.local
const envPath = path.resolve(process.cwd(), '.env.local');
let envContent = '';
try {
  envContent = fs.readFileSync(envPath, 'utf-8');
} catch (_e) {
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

type ExerciseRow = {
  id: string;
  name: string;
  category: string;
  focus: string;
  metric_profile: string;
  equipment: any;
  primary_muscle: string;
  secondary_muscles: string[];
  e1rm_eligible: boolean;
  is_interval: boolean;
};

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

  const processed = exercises.map((ex: ExerciseRow) => {
    // Normalization Logic
    let category = 'Strength';

    // Check for Yoga
    if (
      ex.metric_profile === 'mobility_session' ||
      ex.name.toLowerCase().includes('yoga') ||
      ex.primary_muscle === 'mobility'
    ) {
      category = 'Mobility';
    } else if (
      ex.metric_profile === 'cardio_session' ||
      ex.category === 'Cardio' // if it already exists
    ) {
      category = 'Cardio';
    }

    // Clean up primary_muscle if it was 'cardio' or 'mobility'
    let primaryMuscle = ex.primary_muscle;
    if (primaryMuscle === 'cardio' || primaryMuscle === 'mobility') {
      primaryMuscle = 'full_body';
    }

    // Clean up fields
    return {
      name: ex.name,
      category, // Inferred or existing
      focus: ex.focus,
      metricProfile: ex.metric_profile,
      equipment: ex.equipment ? (typeof ex.equipment === 'string' ? JSON.parse(ex.equipment) : ex.equipment) : [],
      primaryMuscle: primaryMuscle,
      secondaryMuscles: ex.secondary_muscles || [],
      e1rmEligible: ex.e1rm_eligible || false,
      isInterval: ex.is_interval || false
    };
  });

  // Deduplicate by name
  const seen = new Set();
  const unique = processed.filter((ex: { name: string }) => {
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
