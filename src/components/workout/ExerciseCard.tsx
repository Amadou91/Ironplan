import { WorkoutExercise } from "@/types/domain";

interface ExerciseCardProps {
  exercise: WorkoutExercise;
}

export default function ExerciseCard({ exercise }: ExerciseCardProps) {
  return (
    <div className="border border-gray-200 rounded-lg p-4 bg-white shadow-sm hover:shadow-md transition-shadow">
      <div className="flex justify-between items-start mb-2">
        <h4 className="font-semibold text-lg text-gray-900">{exercise.name}</h4>
        <span className="text-xs bg-indigo-50 text-indigo-700 px-2 py-1 rounded-full font-medium">
          {exercise.primaryMuscle}
        </span>
      </div>
      
      <div className="text-sm text-gray-600 space-y-1">
        {exercise.sets && exercise.reps && (
           <p>Target: {exercise.sets} sets × {exercise.reps} reps</p>
        )}
        {exercise.secondaryMuscles && exercise.secondaryMuscles.length > 0 && (
          <p className="text-xs text-gray-400">
            Also works: {exercise.secondaryMuscles.join(", ")}
          </p>
        )}
      </div>
    </div>
  );
}