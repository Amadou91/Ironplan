
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

// Load env
const envPath = path.resolve(process.cwd(), '.env.local');
let envContent = '';
try {
  envContent = fs.readFileSync(envPath, 'utf-8');
} catch {
  // ignore
}

const getEnv = (key: string) => {
  const match = envContent.match(new RegExp(`${key}=(.*)`));
  return match ? match[1] : process.env[key];
};

const url = getEnv('NEXT_PUBLIC_SUPABASE_URL');
const key = getEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY');

if (!url || !key) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(url, key);

async function run() {
  console.log('Fetching exercises...');
  const { data: exercises, error } = await supabase
    .from('exercise_catalog')
    .select('*');

  if (error) {
    console.error('Error:', error);
    process.exit(1);
  }

  const updates = [];

  for (const ex of exercises) {
    let needsUpdate = false;
    let isInterval = false;
    let intervalDuration = null;
    let intervalRest = null;
    let restSeconds = ex.rest_seconds;

    // Check for "on/off" pattern in reps
    // e.g., "45 sec on/15 sec off"
    // e.g., "30s on / 30s off"
    if (typeof ex.reps === 'string' && ex.reps.match(/on.*off/i)) {
        console.log(`Found interval candidate: ${ex.name} (${ex.reps})`);
        
        const onMatch = ex.reps.match(/(\d+)\s*(sec|s|min)\s*on/i);
        const offMatch = ex.reps.match(/(\d+)\s*(sec|s|min)\s*off/i);

        if (onMatch && offMatch) {
            isInterval = true;
            
            // Parse duration
            let onVal = parseInt(onMatch[1]);
            if (onMatch[2].includes('min')) onVal *= 60;
            intervalDuration = onVal;

            // Parse rest
            let offVal = parseInt(offMatch[1]);
            if (offMatch[2].includes('min')) offVal *= 60;
            intervalRest = offVal;

            // Rule: "rest_seconds" must be hidden or derived. 
            // We set it to 0 or null to avoid conflict display, 
            // or match interval_rest if that's safer for existing logic.
            // Requirement: "Ensure rest_seconds is cleared/null... OR set equal to off-seconds"
            // Let's set it to null to avoid displaying "Rest: X" 
            restSeconds = null; 
            
            needsUpdate = true;
        }
    } else if (ex.metric_profile === 'cardio_session' && ex.sets > 1 && !ex.reps.includes('min')) {
        // Potential other interval types?
    }

    if (needsUpdate) {
        updates.push({
            id: ex.id,
            is_interval: isInterval,
            interval_duration: intervalDuration,
            interval_rest: intervalRest,
            rest_seconds: restSeconds,
            // Keep reps string for display? Or clear it? 
            // The goal is to standardize. "6 x 45s on / 15s off" is constructed from fields.
            // But existing UI might rely on 'reps' string. 
            // We should arguably KEEP 'reps' string populated for backward compatibility 
            // but rely on fields for logic. 
            // User requirement: "Display: 6 x 45s on / 15s off".
            // If I leave reps as is, it works for display.
        });
    }
  }

  console.log(`Found ${updates.length} exercises to normalize.`);

  for (const update of updates) {
      const { error } = await supabase
          .from('exercise_catalog')
          .update({
              is_interval: update.is_interval,
          })
          .eq('id', update.id);
      
      if (error) console.error(`Failed to update ${update.id}:`, error);
      else console.log(`Updated ${update.id}`);
  }
}

run();
