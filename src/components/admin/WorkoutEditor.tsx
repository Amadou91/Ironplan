'use client';

import React, { useState } from 'react';
import { Exercise, FocusArea, Goal, Difficulty, MetricProfile, MuscleGroup, EquipmentOption } from '@/types/domain';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Label } from '@/components/ui/Label';
import { Button } from '@/components/ui/Button';
import { RPE_OPTIONS } from '@/constants/intensityOptions';

interface WorkoutEditorProps {
  initialData?: Partial<Exercise>;
  onSubmit: (data: Exercise) => void;
  isLoading?: boolean;
}

const FOCUS_AREAS: FocusArea[] = ['upper', 'lower', 'full_body', 'core', 'cardio', 'mobility', 'arms', 'legs', 'biceps', 'triceps', 'chest', 'back'];
const GOALS: Goal[] = ['strength', 'hypertrophy', 'endurance', 'cardio', 'general_fitness'];
const DIFFICULTIES: Difficulty[] = ['beginner', 'intermediate', 'advanced'];
const METRIC_PROFILES: MetricProfile[] = ['strength', 'timed_strength', 'yoga_session', 'cardio_session', 'mobility_session'];
const MUSCLE_GROUPS: MuscleGroup[] = [
  'chest', 'back', 'shoulders', 'biceps', 'triceps', 'forearms', 'core', 
  'glutes', 'quads', 'hamstrings', 'calves', 'hip_flexors', 'adductors', 'abductors', 
  'full_body', 'upper_body', 'lower_body', 
  'cardio', 'yoga'
];
const EQUIPMENT_KINDS = ['bodyweight', 'dumbbell', 'kettlebell', 'band', 'barbell', 'machine'];

const DEFAULT_EXERCISE: Partial<Exercise> = {
  name: '',
  focus: 'full_body',
  metricProfile: 'strength',
  sets: 3,
  reps: 10,
  rpe: 8,
  equipment: [],
  difficulty: 'beginner',
  goal: 'general_fitness',
  durationMinutes: 30,
  restSeconds: 60,
  primaryMuscle: 'full_body',
  instructions: [],
  videoUrl: '',
};

export function WorkoutEditor({ initialData, onSubmit, isLoading = false }: WorkoutEditorProps) {
  const [formData, setFormData] = useState<Partial<Exercise>>({
    ...DEFAULT_EXERCISE,
    ...initialData,
  });

  const handleChange = <K extends keyof Exercise>(field: K, value: Exercise[K]) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Basic validation
    if (!formData.name || !formData.focus || !formData.metricProfile) {
      alert('Please fill in Name, Focus, and Metric Profile.');
      return;
    }
    onSubmit(formData as Exercise);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-8 bg-white p-8 rounded-xl shadow-sm border border-slate-100 dark:bg-slate-900 dark:border-slate-800">
      
      {/* Section 1: Core Identity */}
      <section>
        <div className="mb-4 pb-2 border-b border-slate-100 dark:border-slate-800">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Core Identity</h3>
          <p className="text-sm text-slate-500">Essential details defining the exercise.</p>
        </div>
        <div className="grid gap-6 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="name">Exercise Name</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => handleChange('name', e.target.value)}
              placeholder="e.g. Barbell Squat"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="metricProfile">Metric Profile</Label>
            <Select
              id="metricProfile"
              value={formData.metricProfile}
              onChange={(e) => handleChange('metricProfile', e.target.value)}
            >
              {METRIC_PROFILES.map((p) => (
                <option key={p} value={p}>
                  {p.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                </option>
              ))}
            </Select>
            <p className="text-xs text-slate-500">Determines how volume and intensity are tracked.</p>
          </div>
        </div>
      </section>

      {/* Section 2: Logic Filters */}
      <section>
        <div className="mb-4 pb-2 border-b border-slate-100 dark:border-slate-800">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Logic Filters</h3>
          <p className="text-sm text-slate-500">
            Parameters controlling availability and selection logic.
          </p>
        </div>
        <div className="grid gap-6 md:grid-cols-4">
          <div className="space-y-2">
            <Label htmlFor="focus">Focus Area (Category)</Label>
            <Select
              id="focus"
              value={formData.focus}
              onChange={(e) => handleChange('focus', e.target.value)}
            >
              <optgroup label="Body Part Splits">
                {FOCUS_AREAS.filter(f => !['cardio', 'mobility'].includes(f)).map((f) => (
                  <option key={f} value={f}>{f.replace('_', ' ').toUpperCase()}</option>
                ))}
              </optgroup>
              <optgroup label="Specialty">
                <option value="cardio">CARDIO</option>
                <option value="mobility">MOBILITY</option>
              </optgroup>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="primaryMuscle">Target Muscle / System</Label>
            <Select
              id="primaryMuscle"
              value={formData.primaryMuscle as string}
              onChange={(e) => handleChange('primaryMuscle', e.target.value)}
            >
              <optgroup label="Muscle Groups">
                {MUSCLE_GROUPS.filter(m => !['cardio', 'yoga'].includes(m)).map((m) => (
                  <option key={m} value={m}>{m.replace('_', ' ').toUpperCase()}</option>
                ))}
              </optgroup>
              <optgroup label="Systems">
                <option value="cardio">CARDIO</option>
                <option value="yoga">YOGA / FLOW</option>
              </optgroup>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="goal">Primary Goal</Label>
            <Select
              id="goal"
              value={formData.goal}
              onChange={(e) => handleChange('goal', e.target.value)}
            >
              {GOALS.map((g) => (
                <option key={g} value={g}>{g.replace('_', ' ').toUpperCase()}</option>
              ))}
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="difficulty">Difficulty</Label>
            <Select
              id="difficulty"
              value={formData.difficulty}
              onChange={(e) => handleChange('difficulty', e.target.value)}
            >
              {DIFFICULTIES.map((d) => (
                <option key={d} value={d}>{d.toUpperCase()}</option>
              ))}
            </Select>
          </div>
          
          {/* Equipment Selection merged into Logic Filters */}
          <div className="col-span-full mt-4">
            <Label className="mb-2 block">Required Equipment</Label>
            <div className="flex flex-wrap gap-2">
              {EQUIPMENT_KINDS.map((kind) => {
                const isSelected = formData.equipment?.some((eq) => eq.kind === kind);
                return (
                  <button
                    key={kind}
                    type="button"
                    onClick={() => {
                      const current = formData.equipment || [];
                      let next;
                      if (isSelected) {
                        next = current.filter((eq) => eq.kind !== kind);
                      } else {
                        next = [...current, { kind } as EquipmentOption];
                      }
                      handleChange('equipment', next);
                    }}
                    className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                      isSelected
                        ? 'bg-slate-900 text-white border-slate-900 dark:bg-white dark:text-slate-900'
                        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700'
                    }`}
                  >
                    {kind}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* Section 3: Prescription */}
      <section>
        <div className="mb-4 pb-2 border-b border-slate-100 dark:border-slate-800">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Prescription</h3>
          <p className="text-sm text-slate-500">Baseline programming values.</p>
        </div>
        <div className="grid gap-6 md:grid-cols-4">
          <div className="space-y-2">
            <Label htmlFor="sets">Sets</Label>
            <Input
              id="sets"
              type="number"
              value={formData.sets}
              onChange={(e) => handleChange('sets', parseInt(e.target.value) || 0)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="reps">Reps / Duration</Label>
            <Input
              id="reps"
              value={formData.reps}
              onChange={(e) => handleChange('reps', e.target.value)}
              placeholder="e.g. 8-12 or 30 sec"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="rpe">Target RPE</Label>
            <Select
              id="rpe"
              value={formData.rpe}
              onChange={(e) => handleChange('rpe', parseFloat(e.target.value))}
            >
              {RPE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="restSeconds">Rest (Seconds)</Label>
            <Input
              id="restSeconds"
              type="number"
              value={formData.restSeconds}
              onChange={(e) => handleChange('restSeconds', parseInt(e.target.value) || 0)}
            />
          </div>
        </div>
      </section>

      <div className="flex justify-end gap-3 pt-6 border-t border-slate-100 dark:border-slate-800">
        <Button type="button" variant="outline" onClick={() => window.history.back()}>
          Cancel
        </Button>
        <Button type="submit" disabled={isLoading}>
          {isLoading ? 'Saving...' : 'Save Exercise'}
        </Button>
      </div>
    </form>
  );
}