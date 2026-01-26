'use client';

import React, { useState } from 'react';
import { Exercise, Difficulty } from '@/types/domain';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import Link from 'next/link';
import { Search, Plus, Activity, Clock, Layers, Repeat, Zap } from 'lucide-react';

// --- Local UI Helpers ---

type BadgeVariant = 'neutral' | 'brand' | 'success' | 'warning' | 'danger' | 'info' | 'purple' | 'outline';

const Badge = ({ 
  children, 
  variant = 'neutral', 
  className, 
  icon: Icon 
}: { 
  children: React.ReactNode; 
  variant?: BadgeVariant; 
  className?: string;
  icon?: React.ElementType;
}) => {
  const variants: Record<BadgeVariant, string> = {
    neutral: 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
    brand: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800',
    success: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800',
    warning: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800',
    danger: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-900/30 dark:text-rose-300 dark:border-rose-800',
    info: 'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-900/30 dark:text-sky-300 dark:border-sky-800',
    purple: 'bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-900/30 dark:text-violet-300 dark:border-violet-800',
    outline: 'bg-transparent text-slate-600 border-slate-200 dark:text-slate-400 dark:border-slate-700',
  };

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium border uppercase tracking-wide ${variants[variant]} ${className}`}>
      {Icon && <Icon className="w-3 h-3 mr-1 opacity-70" />}
      {children}
    </span>
  );
};

// --- Mappers ---

const METRIC_LABELS: Record<string, string> = {
  reps_weight: 'Reps/Wt',
  duration: 'Time',
  distance_duration: 'Dist/Time',
  reps_only: 'Reps',
  yoga_session: 'Yoga',
  mobility_session: 'Mobility',
  timed_strength: 'Timed',
  cardio_session: 'Cardio',
  strength: 'Str',
};

const DIFFICULTY_COLORS: Record<Difficulty, BadgeVariant> = {
  beginner: 'success',
  intermediate: 'warning',
  advanced: 'danger',
};

const GOAL_COLORS: Record<string, BadgeVariant> = {
  strength: 'brand',
  hypertrophy: 'purple',
  endurance: 'info',
  cardio: 'danger',
  general_fitness: 'success',
  mobility: 'warning',
};

interface ExerciseTableProps {
  exercises: Exercise[];
}

export function ExerciseTable({ exercises }: ExerciseTableProps) {
  const [search, setSearch] = useState('');

  const filteredExercises = exercises.filter((ex) =>
    ex.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="relative max-w-sm w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Search exercises..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800"
          />
        </div>
        <Link href="/admin/workouts/new">
          <Button className="w-full sm:w-auto shadow-sm bg-slate-900 text-white hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200">
            <Plus className="h-4 w-4 mr-2" />
            Create New Workout
          </Button>
        </Link>
      </div>

      {/* Table Container */}
      <div className="border rounded-xl overflow-hidden border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-100 dark:divide-slate-800">
            <thead className="bg-slate-50 dark:bg-slate-900/50">
              <tr>
                <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider w-[30%]">Exercise</th>
                <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider w-[25%]">Focus & Level</th>
                <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider w-[35%]">Prescription</th>
                <th scope="col" className="px-6 py-4 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider w-[10%]"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredExercises.map((exercise) => {
                const metricLabel = exercise.metricProfile ? METRIC_LABELS[exercise.metricProfile] || 'Other' : null;
                const goals = exercise.eligibleGoals || (exercise.goal ? [exercise.goal] : []);
                
                return (
                  <tr key={exercise.id || exercise.name} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group">
                    
                    {/* Column 1: Identity */}
                    <td className="px-6 py-4 align-top">
                      <div className="flex flex-col gap-2">
                        <div className="flex items-center gap-2">
                           <span className="text-sm font-bold text-slate-900 dark:text-slate-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                             {exercise.name}
                           </span>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {exercise.primaryMuscle && (
                            <Badge variant="neutral" icon={Activity}>
                              {exercise.primaryMuscle.replace(/_/g, ' ')}
                            </Badge>
                          )}
                          {exercise.equipment?.map((eq, i) => (
                             <Badge key={i} variant="outline" className="border-slate-200 text-slate-500 bg-white dark:bg-slate-900">
                               {eq.kind === 'machine' ? (eq.machineType?.replace(/_/g, ' ') || 'Machine') : eq.kind}
                             </Badge>
                          ))}
                        </div>
                      </div>
                    </td>

                    {/* Column 2: Context */}
                    <td className="px-6 py-4 align-top">
                      <div className="flex flex-col items-start gap-2">
                         <div className="flex flex-wrap gap-1">
                           {goals.slice(0, 2).map((g) => (
                             <Badge key={g} variant={GOAL_COLORS[g] || 'neutral'}>
                               {g.replace(/_/g, ' ')}
                             </Badge>
                           ))}
                           {goals.length > 2 && (
                             <Badge variant="outline">+{goals.length - 2}</Badge>
                           )}
                         </div>
                         <div className="flex items-center gap-1.5">
                            {exercise.difficulty && (
                              <Badge variant={DIFFICULTY_COLORS[exercise.difficulty] || 'neutral'}>
                                {exercise.difficulty}
                              </Badge>
                            )}
                            {metricLabel && (
                              <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wide ml-1">
                                • {metricLabel}
                              </span>
                            )}
                         </div>
                      </div>
                    </td>

                    {/* Column 3: Protocol */}
                    <td className="px-6 py-4 align-top">
                      <div className="flex flex-wrap items-center gap-2">
                        {/* Sets & Reps Group */}
                        <div className="flex items-center bg-slate-100 dark:bg-slate-800 rounded-md p-1 border border-slate-200 dark:border-slate-700">
                          <div className="flex items-center px-2 py-0.5 border-r border-slate-200 dark:border-slate-700">
                            <Layers className="w-3 h-3 text-slate-400 mr-1.5" />
                            <span className="text-xs font-bold text-slate-700 dark:text-slate-300">{exercise.sets}</span>
                            <span className="text-[10px] text-slate-500 ml-1">SETS</span>
                          </div>
                          <div className="flex items-center px-2 py-0.5">
                            <Repeat className="w-3 h-3 text-slate-400 mr-1.5" />
                            <span className="text-xs font-bold text-slate-700 dark:text-slate-300">{exercise.reps}</span>
                            <span className="text-[10px] text-slate-500 ml-1">REPS</span>
                          </div>
                        </div>

                        {/* Intensity & Rest Group */}
                        <div className="flex items-center gap-2">
                           <Badge variant="outline" className="bg-white dark:bg-slate-900" icon={Zap}>
                             RPE {exercise.rpe}
                           </Badge>
                           <Badge variant="outline" className="bg-white dark:bg-slate-900" icon={Clock}>
                             {exercise.restSeconds}s
                           </Badge>
                        </div>
                      </div>
                    </td>

                    {/* Column 4: Actions */}
                    <td className="px-6 py-4 align-top text-right">
                      <Link href={`/admin/workouts/${exercise.id}/edit`}>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-slate-400 hover:text-slate-900 dark:hover:text-white">
                          <span className="sr-only">Edit</span>
                          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-pencil"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg>
                        </Button>
                      </Link>
                    </td>

                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
