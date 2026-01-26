'use client';

import React, { useState } from 'react';
import { Exercise } from '@/types/domain';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import Link from 'next/link';
import { Search, Plus } from 'lucide-react';

interface ExerciseTableProps {
  exercises: Exercise[];
}

const FocusBadge = ({ focus }: { focus: string }) => {
  const colors: Record<string, string> = {
    upper: 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300 border-blue-200 dark:border-blue-500/30',
    lower: 'bg-orange-100 text-orange-700 dark:bg-orange-500/20 dark:text-orange-300 border-orange-200 dark:border-orange-500/30',
    core: 'bg-purple-100 text-purple-700 dark:bg-purple-500/20 dark:text-purple-300 border-purple-200 dark:border-purple-500/30',
    cardio: 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300 border-red-200 dark:border-red-500/30',
    mobility: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300 border-emerald-200 dark:border-emerald-500/30',
    full_body: 'bg-slate-100 text-slate-700 dark:bg-slate-700/40 dark:text-slate-300 border-slate-200 dark:border-slate-600',
  };
  const colorClass = colors[focus] || colors.full_body;
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${colorClass}`}>
      {focus.replace('_', ' ').toUpperCase()}
    </span>
  );
};

export function ExerciseTable({ exercises }: ExerciseTableProps) {
  const [search, setSearch] = useState('');

  const filteredExercises = exercises.filter((ex) =>
    ex.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="relative max-w-sm w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--color-text-muted)]" />
          <Input
            placeholder="Search exercises..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-[var(--color-surface)] border-[var(--color-border)]"
          />
        </div>
        <Link href="/admin/workouts/new">
          <Button className="w-full sm:w-auto shadow-sm">
            <Plus className="h-4 w-4 mr-2" />
            Create New Workout
          </Button>
        </Link>
      </div>

      <div className="border rounded-xl overflow-hidden border-[var(--color-border)] bg-[var(--color-surface)] shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-[var(--color-border)]">
            <thead className="bg-[var(--color-surface-muted)]">
              <tr>
                <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider w-[25%]">Identity</th>
                <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider w-[20%]">Logic</th>
                <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider w-[20%]">Equipment</th>
                <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider w-[20%]">Prescription</th>
                <th scope="col" className="px-6 py-4 text-right text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider w-[15%]">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border)]">
              {filteredExercises.map((exercise) => (
                <tr key={exercise.id || exercise.name} className="hover:bg-[var(--color-surface-subtle)] transition-colors group">
                  {/* Identity: Name, Muscle, Metric Profile */}
                  <td className="px-6 py-4 align-top">
                    <div className="flex flex-col gap-1">
                      <span className="text-sm font-bold text-[var(--color-text)]">{exercise.name}</span>
                      <span className="text-xs text-[var(--color-text-muted)] uppercase tracking-wide">{exercise.primaryMuscle?.replace(/_/g, ' ')}</span>
                      <span className="inline-flex w-fit items-center px-2 py-0.5 rounded text-[10px] font-medium bg-[var(--color-surface-muted)] text-[var(--color-text-subtle)] border border-[var(--color-border)]">
                        {exercise.metricProfile?.replace(/_/g, ' ')}
                      </span>
                    </div>
                  </td>

                  {/* Logic: Focus, Goal, Difficulty */}
                  <td className="px-6 py-4 align-top">
                    <div className="flex flex-col gap-2 items-start">
                      <FocusBadge focus={exercise.focus} />
                      <div className="text-xs text-[var(--color-text-muted)] flex flex-col gap-0.5">
                        <span className="capitalize">Goal: <strong className="font-medium text-[var(--color-text)]">{exercise.goal?.replace(/_/g, ' ')}</strong></span>
                        <span className="capitalize">Lvl: <strong className="font-medium text-[var(--color-text)]">{exercise.difficulty}</strong></span>
                      </div>
                    </div>
                  </td>

                  {/* Equipment */}
                  <td className="px-6 py-4 align-top">
                    <div className="flex flex-wrap gap-1">
                      {exercise.equipment && exercise.equipment.length > 0 ? (
                        exercise.equipment.map((eq, idx) => (
                          <span key={idx} className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-[var(--color-surface-subtle)] text-[var(--color-text-muted)] border border-[var(--color-border)] capitalize">
                            {eq.kind === 'machine' && eq.machineType ? eq.machineType.replace(/_/g, ' ') : eq.kind}
                          </span>
                        ))
                      ) : (
                        <span className="text-xs text-[var(--color-text-subtle)] italic">None specified</span>
                      )}
                    </div>
                  </td>

                  {/* Prescription */}
                  <td className="px-6 py-4 align-top">
                    <div className="flex flex-col gap-1 text-sm text-[var(--color-text-muted)]">
                      <div className="flex items-baseline gap-1.5">
                        <span className="font-bold text-[var(--color-text)]">{exercise.sets}</span>
                        <span className="text-xs">sets</span>
                        <span className="text-[var(--color-border-strong)]">×</span>
                        <span className="font-bold text-[var(--color-text)]">{exercise.reps}</span>
                        <span className="text-xs">reps</span>
                      </div>
                      <div className="flex items-center gap-2 text-xs">
                         <span className="bg-[var(--color-surface-muted)] px-1.5 py-0.5 rounded border border-[var(--color-border)]">RPE {exercise.rpe}</span>
                         <span className="bg-[var(--color-surface-muted)] px-1.5 py-0.5 rounded border border-[var(--color-border)]">{exercise.restSeconds}s rest</span>
                      </div>
                    </div>
                  </td>

                  {/* Actions */}
                  <td className="px-6 py-4 align-top text-right">
                    <Link href={`/admin/workouts/${exercise.id}/edit`}>
                      <Button variant="ghost" size="sm" className="h-8 text-[var(--color-text-muted)] hover:text-[var(--color-text)]">
                        Edit
                      </Button>
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
