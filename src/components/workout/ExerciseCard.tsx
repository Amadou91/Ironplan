import { WorkoutExercise } from "@/types/domain";
import { toMuscleLabel } from "@/lib/muscle-utils";

interface ExerciseCardProps {
  exercise: WorkoutExercise;
}

export default function ExerciseCard({ exercise }: ExerciseCardProps) {
  return (
    <div className="surface-card p-4 transition-shadow hover:shadow-md">
      <div className="mb-2 flex items-start justify-between">
        <h4 className="text-lg font-semibold text-strong">{exercise.name}</h4>
        <span className="badge-accent">{exercise.primaryMuscle ? toMuscleLabel(exercise.primaryMuscle) : ''}</span>
      </div>

      <div className="space-y-1 text-sm text-muted">
        {exercise.sets && exercise.reps && (
           <p>Target: {exercise.sets} sets × {exercise.reps} reps</p>
        )}
        {exercise.secondaryMuscles && exercise.secondaryMuscles.length > 0 && (
          <p className="text-xs text-subtle">
            Also works: {exercise.secondaryMuscles.map(toMuscleLabel).join(", ")}
          </p>
        )}
      </div>
    </div>
  );
}
