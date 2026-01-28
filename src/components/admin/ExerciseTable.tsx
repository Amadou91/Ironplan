'use client';

import React, { useState, useMemo } from 'react';
import { Exercise, Difficulty, EquipmentKind } from '@/types/domain';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import Link from 'next/link';
import { Search, Plus, Activity, Clock, Zap, Dumbbell, MoreHorizontal, User, Settings, Box, Circle, Link as LinkIcon } from 'lucide-react';

// --- Local UI Helpers ---

const EQUIPMENT_ICONS: Record<string, React.ElementType> = {
  bodyweight: User,
  dumbbell: Dumbbell,
  kettlebell: Dumbbell,
  barbell: Dumbbell,
  machine: Settings,
  band: Zap,
  block: Box,
  bolster: Circle,
  strap: LinkIcon
};

const EquipmentMiniBadge = ({ kind, machineType }: { kind: EquipmentKind, machineType?: string }) => {
  const Icon = EQUIPMENT_ICONS[kind] || Dumbbell;
  const label = kind === 'machine' ? (machineType || 'Machine') : kind;
  
  return (
    <div className="flex items-center gap-2 py-0.5">
      <div className="p-1 bg-[var(--color-surface-muted)] rounded-md text-[var(--color-text-muted)]">
        <Icon className="w-2.5 h-2.5" />
      </div>
      <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-muted)] whitespace-nowrap">
        {label.replace(/_/g, ' ')}
      </span>
    </div>
  );
};

const DifficultyDot = ({ level }: { level?: Difficulty }) => {
  const colors: Record<Difficulty, string> = {
    beginner: 'bg-emerald-500',
    intermediate: 'bg-amber-500',
    advanced: 'bg-rose-500',
  };
  
  if (!level) return null;

  return (
    <span className="flex items-center gap-2 text-sm text-[var(--color-text-muted)] capitalize font-medium">
      <span className={`w-2.5 h-2.5 rounded-full ${colors[level]}`} />
      {level}
    </span>
  );
};

// --- Mappers ---

const METRIC_LABELS: Record<string, string> = {
  reps_weight: 'Reps/Wt',
  duration: 'Time',
  distance_duration: 'Dist/Time',
  reps_only: 'Reps',
  mobility_session: 'Yoga / Mobility',
  timed_strength: 'Timed',
  cardio_session: 'Cardio',
  strength: 'Str',
};

const DIFFICULTY_RANK: Record<Difficulty, number> = {
  beginner: 0,
  intermediate: 1,
  advanced: 2,
};

interface ExerciseTableProps {
  exercises: Exercise[];
}

const TIME_BASED_PROFILES = ['duration', 'cardio_session', 'mobility_session']

export function ExerciseTable({ exercises }: ExerciseTableProps) {
  const [search, setSearch] = useState('');

  const isTimeBased = (ex: Exercise) => TIME_BASED_PROFILES.includes(ex.metricProfile || '')
  const headerLabel = exercises.length > 0 && exercises.every(isTimeBased) ? 'Duration' : 'Volume'

  const groupedExercises = useMemo(() => {
    // 1. Filter
    const filtered = exercises.filter((ex) =>
      ex.name.toLowerCase().includes(search.toLowerCase())
    );

    // 2. Group by Muscle
    const groups: Record<string, Exercise[]> = {};
    filtered.forEach((ex) => {
      const key = ex.primaryMuscle ? ex.primaryMuscle.replace(/_/g, ' ') : 'Other';
      if (!groups[key]) groups[key] = [];
      groups[key].push(ex);
    });

    // 3. Sort Groups (Alphabetical) & Exercises (Difficulty)
    return Object.keys(groups)
      .sort()
      .map((key) => {
        return {
          category: key,
          items: groups[key].sort((a, b) => {
            const diffA = a.difficulty ? DIFFICULTY_RANK[a.difficulty] : 99;
            const diffB = b.difficulty ? DIFFICULTY_RANK[b.difficulty] : 99;
            return diffA - diffB;
          }),
        };
      });
  }, [exercises, search]);

  return (
    <div className="space-y-8">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
        <div className="relative max-w-md w-full">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-[var(--color-text-subtle)]" />
          <Input
            placeholder="Search exercises..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-11 h-12 text-base bg-[var(--color-surface)] border-[var(--color-border)] rounded-xl"
          />
        </div>
        <Link href="/workouts/new">
          <Button className="w-full sm:w-auto h-12 px-6 text-base shadow-sm bg-[var(--color-text)] text-[var(--color-bg)] hover:opacity-90 transition-opacity rounded-xl">
            <Plus className="h-5 w-5 mr-2" />
            Create New Workout
          </Button>
        </Link>
      </div>

      {/* Table Container */}
      <div className="border rounded-2xl overflow-hidden border-[var(--color-border)] bg-[var(--color-surface)] shadow-sm">
        <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-[var(--color-border)]">
                      <thead className="bg-[var(--color-surface-subtle)]">
                        <tr>
                          <th scope="col" className="px-8 py-5 text-left text-sm font-bold text-[var(--color-text-muted)] uppercase tracking-wider w-[70%]">Exercise</th>
                          <th scope="col" className="px-8 py-5 text-right text-sm font-bold text-[var(--color-text-muted)] uppercase tracking-wider w-[30%]">Details</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--color-border)]">
                        {groupedExercises.map((group) => (
                          <React.Fragment key={group.category}>
                            {/* Category Header Row */}
                            <tr className="bg-[var(--color-surface-muted)]">
                              <td colSpan={2} className="px-8 py-4 text-left">
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-bold uppercase tracking-widest text-[var(--color-text-subtle)]">
                                    {group.category}
                                  </span>
                                  <div className="h-px flex-1 bg-[var(--color-border)] ml-4 opacity-50" />
                                  <span className="text-xs font-medium text-[var(--color-text-subtle)] bg-[var(--color-surface-subtle)] px-2 py-0.5 rounded-full border border-[var(--color-border)]">
                                    {group.items.length}
                                  </span>
                                </div>
                              </td>
                            </tr>
          
                            {/* Exercise Rows */}
                            {group.items.map((exercise) => {
                              const goals = exercise.eligibleGoals || (exercise.goal ? [exercise.goal] : []);
                              const mainGoal = goals[0];
                              
                              return (
                                <tr key={exercise.id || exercise.name} className="hover:bg-[var(--color-surface-subtle)] transition-colors group">
                                  
                                  <td className="px-8 py-6">
                                    <div className="flex flex-col gap-1.5">
                                      <div className="flex items-center gap-3">
                                        <span className="text-lg font-bold text-[var(--color-text)] group-hover:text-[var(--color-primary)] transition-colors">
                                           {exercise.name}
                                        </span>
                                        {exercise.movementPattern && (
                                          <span className="text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded bg-[var(--color-surface-muted)] text-[var(--color-text-subtle)] border border-[var(--color-border)]">
                                            {exercise.movementPattern}
                                          </span>
                                        )}
                                      </div>
                                      {exercise.primaryMuscle !== 'full_body' && exercise.secondaryMuscles && exercise.secondaryMuscles.length > 0 && (
                                        <div className="flex items-center gap-2 mb-1">
                                          <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--color-text-subtle)] opacity-70">
                                            Secondary: {exercise.secondaryMuscles.map(m => m.replace(/_/g, ' ')).join(', ')}
                                          </span>
                                        </div>
                                      )}
                                      <div className="flex flex-col gap-1">
                                        {exercise.equipment?.map((e, idx) => (
                                          <EquipmentMiniBadge key={idx} kind={e.kind as EquipmentKind} machineType={e.kind === 'machine' ? e.machineType : undefined} />
                                        ))}
                                      </div>
                                    </div>
                                  </td>
          
                                  {/* Column 2: Details & Actions */}
                                  <td className="px-8 py-6 text-right align-middle">
                                    <div className="flex items-center justify-end gap-6">
                                      <div className="flex flex-col items-end gap-1">
                                        <DifficultyDot level={exercise.difficulty} />
                                        {mainGoal && (
                                          <span className="text-xs uppercase tracking-wider font-semibold text-[var(--color-text-subtle)]">
                                            {mainGoal.replace(/_/g, ' ')}
                                          </span>
                                        )}
                                      </div>
                                      
                                      <Link href={`/workouts/${exercise.id}/edit`}>
                                        <Button variant="ghost" size="sm" className="h-10 w-10 p-0 text-[var(--color-text-subtle)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-muted)] rounded-lg">
                                          <span className="sr-only">Edit</span>
                                          <MoreHorizontal className="w-5 h-5" />
                                        </Button>
                                      </Link>
                                    </div>
                                  </td>
          
                                </tr>
                              );
                            })}
                          </React.Fragment>
                        ))}
                      </tbody>
                    </table>        </div>
      </div>
    </div>
  );
}
