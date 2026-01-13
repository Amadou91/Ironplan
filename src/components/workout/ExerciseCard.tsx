import { WorkoutExercise } from "@/types/domain";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

interface ExerciseCardProps {
    data: WorkoutExercise;
    onSwap?: () => void;
}

export function ExerciseCard({ data, onSwap }: ExerciseCardProps) {
    return (
        <Card className="flex flex-col md:flex-row items-start md:items-center justify-between p-4 hover:border-indigo-500 transition-colors group">
            <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                    <h4 className="font-bold text-lg text-slate-900 dark:text-white">
                        {data.exercise.name}
                    </h4>
                    {data.exercise.difficulty === 'advanced' && (
                        <span className="text-[10px] px-1.5 py-0.5 bg-red-100 text-red-700 rounded font-bold uppercase">Adv</span>
                    )}
                </div>
                <p className="text-sm text-slate-500 capitalize">
                    {data.exercise.primary_muscle} • {data.exercise.movement_pattern.replace('_', ' ')}
                </p>
            </div>
            
            <div className="flex items-center gap-6 mt-4 md:mt-0 w-full md:w-auto justify-between md:justify-end">
                <div className="text-center min-w-[3rem]">
                    <div className="text-indigo-600 font-bold text-xl">{data.sets}</div>
                    <div className="text-[10px] uppercase text-slate-400 font-bold">Sets</div>
                </div>
                <div className="text-center min-w-[3rem]">
                    <div className="font-bold text-xl text-slate-700 dark:text-slate-300">{data.reps}</div>
                    <div className="text-[10px] uppercase text-slate-400 font-bold">Reps</div>
                </div>
                <div className="text-center min-w-[3rem]">
                    <div className="font-bold text-xl text-slate-700 dark:text-slate-300">{data.rest_sec}s</div>
                    <div className="text-[10px] uppercase text-slate-400 font-bold">Rest</div>
                </div>
                
                {onSwap && (
                    <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={onSwap}
                        className="hidden group-hover:flex"
                    >
                        Swap
                    </Button>
                )}
            </div>
        </Card>
    );
}