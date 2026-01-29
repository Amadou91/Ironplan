// Auto-generated default exercises
import type { Exercise } from '@/types/domain';

export const DEFAULT_EXERCISES: Partial<Exercise>[] = [
  {
    "name": "Barbell Back Squat",
    "category": "Strength",
    "movementPattern": "squat",
    "metricProfile": "reps_weight",
    "equipment": [{ "kind": "barbell" }],
    "primaryMuscle": "quads",
    "secondaryMuscles": ["glutes", "hamstrings", "calves"],
    "e1rmEligible": true
  },
  {
    "name": "Dumbbell Goblet Squat",
    "category": "Strength",
    "movementPattern": "squat",
    "metricProfile": "reps_weight",
    "equipment": [{ "kind": "dumbbell" }, { "kind": "kettlebell" }],
    "orGroup": "single_implement",
    "primaryMuscle": "quads",
    "secondaryMuscles": ["glutes", "hamstrings"]
  },
  {
    "name": "Romanian Deadlift",
    "category": "Strength",
    "movementPattern": "hinge",
    "metricProfile": "reps_weight",
    "equipment": [{ "kind": "barbell" }, { "kind": "dumbbell" }],
    "orGroup": "free_weight_primary",
    "primaryMuscle": "hamstrings",
    "secondaryMuscles": ["glutes", "back"]
  },
  {
    "name": "Hip Thrusts",
    "category": "Strength",
    "movementPattern": "hinge",
    "metricProfile": "reps_weight",
    "equipment": [{ "kind": "barbell" }],
    "primaryMuscle": "glutes",
    "secondaryMuscles": ["hamstrings", "core"]
  },
  {
    "name": "Bench Press",
    "category": "Strength",
    "movementPattern": "push",
    "metricProfile": "reps_weight",
    "equipment": [{ "kind": "barbell", "requires": ["bench_press"] }],
    "primaryMuscle": "chest",
    "secondaryMuscles": ["shoulders", "triceps"],
    "e1rmEligible": true
  },
  {
    "name": "Dumbbell Bench Press",
    "category": "Strength",
    "movementPattern": "push",
    "metricProfile": "reps_weight",
    "equipment": [{ "kind": "dumbbell", "requires": ["bench_press"] }],
    "primaryMuscle": "chest",
    "secondaryMuscles": ["shoulders", "triceps"]
  },
  {
    "name": "Incline Barbell Press",
    "category": "Strength",
    "movementPattern": "push",
    "metricProfile": "reps_weight",
    "equipment": [{ "kind": "barbell", "requires": ["bench_press"] }],
    "primaryMuscle": "chest",
    "secondaryMuscles": ["shoulders", "triceps"]
  },
  {
    "name": "Decline Bench Press",
    "category": "Strength",
    "movementPattern": "push",
    "metricProfile": "reps_weight",
    "equipment": [{ "kind": "barbell", "requires": ["bench_press"] }],
    "primaryMuscle": "chest",
    "secondaryMuscles": ["shoulders", "triceps"]
  },
  {
    "name": "Chest Dip",
    "category": "Strength",
    "movementPattern": "push",
    "metricProfile": "reps_weight",
    "equipment": [{ "kind": "bodyweight" }],
    "primaryMuscle": "chest",
    "secondaryMuscles": ["triceps", "shoulders"]
  },
  {
    "name": "Cable Chest Fly",
    "category": "Strength",
    "movementPattern": "push",
    "metricProfile": "reps_weight",
    "equipment": [{ "kind": "machine", "machineType": "cable" }],
    "primaryMuscle": "chest",
    "secondaryMuscles": ["shoulders"]
  },
  {
    "name": "Pec Deck Fly",
    "category": "Strength",
    "movementPattern": "push",
    "metricProfile": "reps_weight",
    "equipment": [{ "kind": "machine" }],
    "primaryMuscle": "chest",
    "secondaryMuscles": ["shoulders"]
  },
  {
    "name": "Floor Press",
    "category": "Strength",
    "movementPattern": "push",
    "metricProfile": "reps_weight",
    "equipment": [{ "kind": "dumbbell" }, { "kind": "barbell" }],
    "orGroup": "free_weight_primary",
    "primaryMuscle": "chest",
    "secondaryMuscles": ["triceps", "shoulders"]
  },
  {
    "name": "Dumbbell Row",
    "category": "Strength",
    "movementPattern": "pull",
    "metricProfile": "reps_weight",
    "equipment": [{ "kind": "dumbbell" }],
    "primaryMuscle": "back",
    "secondaryMuscles": ["biceps", "forearms"]
  },
  {
    "name": "Overhead Press",
    "category": "Strength",
    "movementPattern": "push",
    "metricProfile": "reps_weight",
    "equipment": [{ "kind": "barbell" }, { "kind": "dumbbell" }],
    "orGroup": "free_weight_primary",
    "primaryMuscle": "shoulders",
    "secondaryMuscles": ["triceps", "core"],
    "e1rmEligible": true
  },
  {
    "name": "Walking Lunge",
    "category": "Strength",
    "movementPattern": "squat",
    "metricProfile": "reps_weight",
    "equipment": [{ "kind": "dumbbell" }, { "kind": "bodyweight" }],
    "primaryMuscle": "quads",
    "secondaryMuscles": ["glutes", "hamstrings", "calves"]
  },
  {
    "name": "Bulgarian Split Squats",
    "category": "Strength",
    "movementPattern": "squat",
    "metricProfile": "reps_weight",
    "equipment": [{ "kind": "dumbbell" }, { "kind": "bodyweight" }],
    "primaryMuscle": "quads",
    "secondaryMuscles": ["glutes", "hamstrings", "calves"]
  },
  {
    "name": "Step Ups",
    "category": "Strength",
    "movementPattern": "squat",
    "metricProfile": "reps_weight",
    "equipment": [{ "kind": "dumbbell" }, { "kind": "bodyweight" }],
    "primaryMuscle": "quads",
    "secondaryMuscles": ["glutes", "hamstrings", "calves"]
  },
  {
    "name": "Dumbbell Biceps Curl",
    "category": "Strength",
    "movementPattern": "pull",
    "metricProfile": "reps_weight",
    "equipment": [{ "kind": "dumbbell" }, { "kind": "band" }],
    "orGroup": "resistance_variable",
    "primaryMuscle": "biceps",
    "secondaryMuscles": ["forearms"]
  },
  {
    "name": "Hammer Curl",
    "category": "Strength",
    "movementPattern": "pull",
    "metricProfile": "reps_weight",
    "equipment": [{ "kind": "dumbbell" }, { "kind": "kettlebell" }],
    "orGroup": "single_implement",
    "primaryMuscle": "biceps",
    "secondaryMuscles": ["forearms"]
  },
  {
    "name": "Barbell Curl",
    "category": "Strength",
    "movementPattern": "pull",
    "metricProfile": "reps_weight",
    "equipment": [{ "kind": "barbell" }],
    "primaryMuscle": "biceps",
    "secondaryMuscles": ["forearms"]
  },
  {
    "name": "Alternating Dumbbell Curl",
    "category": "Strength",
    "movementPattern": "pull",
    "metricProfile": "reps_weight",
    "equipment": [{ "kind": "dumbbell" }],
    "primaryMuscle": "biceps",
    "secondaryMuscles": ["forearms"]
  },
  {
    "name": "Concentration Curl",
    "category": "Strength",
    "movementPattern": "pull",
    "metricProfile": "reps_weight",
    "equipment": [{ "kind": "dumbbell" }],
    "primaryMuscle": "biceps",
    "secondaryMuscles": ["forearms"]
  },
  {
    "name": "Zottman Curl",
    "category": "Strength",
    "movementPattern": "pull",
    "metricProfile": "reps_weight",
    "equipment": [{ "kind": "dumbbell" }],
    "primaryMuscle": "biceps",
    "secondaryMuscles": ["forearms"]
  },
  {
    "name": "Reverse Curl",
    "category": "Strength",
    "movementPattern": "pull",
    "metricProfile": "reps_weight",
    "equipment": [{ "kind": "barbell" }, { "kind": "dumbbell" }],
    "orGroup": "free_weight_primary",
    "primaryMuscle": "biceps",
    "secondaryMuscles": ["forearms"]
  },
  {
    "name": "Cable Biceps Curl",
    "category": "Strength",
    "movementPattern": "pull",
    "metricProfile": "reps_weight",
    "equipment": [{ "kind": "machine", "machineType": "cable" }],
    "primaryMuscle": "biceps",
    "secondaryMuscles": ["forearms"]
  },
  {
    "name": "Cable Rope Hammer Curl",
    "category": "Strength",
    "movementPattern": "pull",
    "metricProfile": "reps_weight",
    "equipment": [{ "kind": "machine", "machineType": "cable" }],
    "primaryMuscle": "biceps",
    "secondaryMuscles": ["forearms"]
  },
  {
    "name": "Band Biceps Curl",
    "category": "Strength",
    "movementPattern": "pull",
    "metricProfile": "reps_weight",
    "equipment": [{ "kind": "band" }],
    "primaryMuscle": "biceps",
    "secondaryMuscles": ["forearms"]
  },
  {
    "name": "Kettlebell Curl",
    "category": "Strength",
    "movementPattern": "pull",
    "metricProfile": "reps_weight",
    "equipment": [{ "kind": "kettlebell" }],
    "primaryMuscle": "biceps",
    "secondaryMuscles": ["forearms"]
  },
  {
    "name": "Drag Curl",
    "category": "Strength",
    "movementPattern": "pull",
    "metricProfile": "reps_weight",
    "equipment": [{ "kind": "barbell" }],
    "primaryMuscle": "biceps",
    "secondaryMuscles": ["forearms"]
  },
  {
    "name": "Overhead Triceps Extension",
    "category": "Strength",
    "movementPattern": "push",
    "metricProfile": "reps_weight",
    "equipment": [{ "kind": "dumbbell" }, { "kind": "band" }],
    "orGroup": "resistance_variable",
    "primaryMuscle": "triceps",
    "secondaryMuscles": ["shoulders"]
  },
  {
    "name": "Triceps Rope Pushdown",
    "category": "Strength",
    "movementPattern": "push",
    "metricProfile": "reps_weight",
    "equipment": [{ "kind": "machine", "machineType": "cable" }],
    "primaryMuscle": "triceps",
    "secondaryMuscles": ["shoulders"]
  },
  {
    "name": "Incline Dumbbell Press",
    "category": "Strength",
    "movementPattern": "push",
    "metricProfile": "reps_weight",
    "equipment": [{ "kind": "dumbbell", "requires": ["bench_press"] }],
    "primaryMuscle": "chest",
    "secondaryMuscles": ["shoulders", "triceps"]
  },
  {
    "name": "Lat Pulldown",
    "category": "Strength",
    "movementPattern": "pull",
    "metricProfile": "reps_weight",
    "equipment": [{ "kind": "machine", "machineType": "cable" }],
    "primaryMuscle": "back",
    "secondaryMuscles": ["biceps", "shoulders"]
  },
  {
    "name": "Resistance Band Pull-Apart",
    "category": "Strength",
    "movementPattern": "pull",
    "metricProfile": "reps_weight",
    "equipment": [{ "kind": "band" }],
    "primaryMuscle": "shoulders",
    "secondaryMuscles": ["back"]
  },
  {
    "name": "Leg Press",
    "category": "Strength",
    "movementPattern": "squat",
    "metricProfile": "reps_weight",
    "equipment": [{ "kind": "machine", "machineType": "leg_press" }],
    "primaryMuscle": "quads",
    "secondaryMuscles": ["glutes", "calves"]
  },
  {
    "name": "Kettlebell Swing",
    "category": "Strength",
    "movementPattern": "hinge",
    "metricProfile": "reps_weight",
    "equipment": [{ "kind": "kettlebell" }],
    "primaryMuscle": "glutes",
    "secondaryMuscles": ["hamstrings", "back", "core"]
  },
  {
    "name": "Plank Series",
    "category": "Strength",
    "movementPattern": "core",
    "metricProfile": "timed_strength",
    "equipment": [{ "kind": "bodyweight" }],
    "primaryMuscle": "core",
    "secondaryMuscles": ["shoulders", "glutes"]
  },
  {
    "name": "Dead Bug",
    "category": "Strength",
    "movementPattern": "core",
    "metricProfile": "reps_weight",
    "equipment": [{ "kind": "bodyweight" }],
    "primaryMuscle": "core",
    "secondaryMuscles": ["hip_flexors"]
  },
  {
    "name": "Skipping",
    "category": "Cardio",
    "movementPattern": "cardio",
    "metricProfile": "cardio_session",
    "equipment": [{ "kind": "bodyweight" }],
    "primaryMuscle": "full_body"
  },
  {
    "name": "Indoor Ride",
    "category": "Cardio",
    "movementPattern": "cardio",
    "metricProfile": "cardio_session",
    "equipment": [{ "kind": "machine", "machineType": "indoor_bicycle" }],
    "primaryMuscle": "full_body"
  },
  {
    "name": "Outdoor Ride",
    "category": "Cardio",
    "movementPattern": "cardio",
    "metricProfile": "cardio_session",
    "equipment": [{ "kind": "bodyweight" }],
    "primaryMuscle": "full_body"
  },
  {
    "name": "Stretching",
    "category": "Mobility",
    "movementPattern": "mobility",
    "metricProfile": "mobility_session",
    "equipment": [{ "kind": "bodyweight" }],
    "primaryMuscle": "full_body"
  },
  {
    "name": "Yoga / Mobility",
    "category": "Mobility",
    "movementPattern": "mobility",
    "metricProfile": "mobility_session",
    "equipment": [{ "kind": "bodyweight" }],
    "primaryMuscle": "full_body"
  }
];
