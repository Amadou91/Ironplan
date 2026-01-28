'use client';

import React, { useState } from 'react';
import { Exercise, Goal, Difficulty, MetricProfile, MuscleGroup, ExerciseCategory } from '@/types/domain';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Label } from '@/components/ui/Label';
import { Button } from '@/components/ui/Button';
import { Checkbox } from '@/components/ui/Checkbox';
import { RPE_OPTIONS } from '@/constants/intensityOptions';
import { validateExercise } from '@/lib/validation/exercise-validation';

interface WorkoutEditorProps {
  initialData?: Partial<Exercise>;
  onSubmit: (data: Exercise) => void;
  isLoading?: boolean;
}

const CATEGORIES: { value: ExerciseCategory; label: string }[] = [
  { value: 'Strength', label: 'Strength' },
  { value: 'Cardio', label: 'Cardio' },
  { value: 'Mobility', label: 'Yoga / Mobility' },
];

const DIFFICULTIES: { value: Difficulty; label: string }[] = [
  { value: 'beginner', label: 'Beginner' },
  { value: 'intermediate', label: 'Intermediate' },
  { value: 'advanced', label: 'Advanced' },
];

const METRIC_PROFILES: { value: MetricProfile; label: string }[] = [
  { value: 'reps_weight', label: 'Reps & Weight' },
  { value: 'timed_strength', label: 'Duration / Isometric' },
  { value: 'cardio_session', label: 'Cardio Session' },
  { value: 'mobility_session', label: 'Mobility / Yoga' },
];

const MUSCLE_GROUPS: MuscleGroup[] = [
  'chest', 'back', 'shoulders', 'biceps', 'triceps', 'forearms', 'core', 
  'glutes', 'quads', 'hamstrings', 'calves', 'hip_flexors', 'adductors', 'abductors', 
  'full_body', 'upper_body', 'lower_body'
];

const DEFAULT_EXERCISE: Partial<Exercise> = {
  name: '',
  category: 'Strength',
  metricProfile: 'reps_weight',
  equipment: [{ kind: 'bodyweight' }],
  primaryMuscle: 'full_body',
};

// --- Helper Components ---

function SegmentedControl<T extends string>({ 
  options, 
  value, 
  onChange 
}: { 
  options: { value: T; label: string }[]; 
  value: T; 
  onChange: (value: T) => void; 
}) {
  return (
    <div className="flex p-1 bg-[var(--color-surface-muted)] rounded-lg">
      {options.map((option) => {
        const isSelected = value === option.value;
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className={`flex-1 py-1.5 px-3 text-sm font-medium rounded-md transition-all ${
              isSelected
                ? 'bg-[var(--color-surface)] text-[var(--color-text)] shadow-sm ring-1 ring-[var(--color-border)]'
                : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

function MultiSelectChips<T extends string>({
  options,
  selected,
  onChange
}: {
  options: { value: T; label: string }[];
  selected: T[];
  onChange: (value: T[]) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((option) => {
        const isSelected = selected.includes(option.value);
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => {
              if (isSelected) {
                onChange(selected.filter((v) => v !== option.value));
              } else {
                onChange([...selected, option.value]);
              }
            }}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
              isSelected
                ? 'bg-[var(--color-text)] text-[var(--color-bg)] border-[var(--color-text)]'
                : 'bg-[var(--color-surface)] text-[var(--color-text-muted)] border-[var(--color-border)] hover:bg-[var(--color-surface-muted)]'
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

// --- Main Component ---

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
    const validationErrors = validateExercise(formData);
    
    if (validationErrors.length > 0) {
      alert(`Please fix the following errors:\n\n${validationErrors.join('\n')}`);
      return;
    }
    onSubmit(formData as Exercise);
  };

  const filteredMetricProfiles = METRIC_PROFILES.filter(p => {
    if (formData.category === 'Strength') return ['reps_weight', 'timed_strength'].includes(p.value);
    if (formData.category === 'Cardio') return p.value === 'cardio_session';
    if (formData.category === 'Mobility') return p.value === 'mobility_session';
    return true;
  });

  const handleCategoryChange = (cat: ExerciseCategory) => {
    const updates: Partial<Exercise> = { category: cat };
    if (cat === 'Strength') {
      updates.metricProfile = 'reps_weight';
    } else if (cat === 'Cardio') {
      updates.metricProfile = 'cardio_session';
      updates.primaryMuscle = 'full_body';
    } else if (cat === 'Mobility') {
      updates.metricProfile = 'mobility_session';
      updates.primaryMuscle = 'full_body';
    }
    setFormData(prev => ({ ...prev, ...updates }));
  };

  return (
    <form onSubmit={handleSubmit} className="relative flex flex-col gap-8 bg-[var(--color-surface)] rounded-xl shadow-sm border border-[var(--color-border)] overflow-hidden">
      
      <div className="p-8 space-y-8 pb-24">
        
        {/* Section 1: Identity */}
        <section className="space-y-6">
          <div className="flex items-center gap-2 pb-2 border-b border-[var(--color-border)]">
            <h3 className="text-sm font-bold uppercase tracking-wider text-[var(--color-text-subtle)]">Identity</h3>
          </div>
          
          <div className="grid gap-6 md:grid-cols-2">
            <div className="col-span-2 space-y-1.5">
              <Label htmlFor="name">Exercise Name</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => handleChange('name', e.target.value)}
                placeholder="e.g. Barbell Squat"
                className="text-lg font-semibold"
              />
            </div>
            
            <div className="space-y-1.5">
              <Label>Category</Label>
              <SegmentedControl
                options={CATEGORIES}
                value={formData.category || 'Strength'}
                onChange={handleCategoryChange}
              />
            </div>

            <div className="space-y-1.5">
              <Label>Tracking Type</Label>
              <SegmentedControl
                options={filteredMetricProfiles}
                value={formData.metricProfile || 'reps_weight'}
                onChange={(mp) => handleChange('metricProfile', mp)}
              />
            </div>
          </div>
        </section>

        {/* Section 2: Filters & Requirements */}
        <section className="space-y-6">
           <div className="flex items-center gap-2 pb-2 border-b border-[var(--color-border)]">
            <h3 className="text-sm font-bold uppercase tracking-wider text-[var(--color-text-subtle)]">Filters & Requirements</h3>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            {formData.category === 'Strength' && (
              <div className="space-y-1.5">
                <Label htmlFor="primaryMuscle">Target Muscle</Label>
                <Select
                  id="primaryMuscle"
                  value={formData.primaryMuscle as string}
                  onChange={(e) => handleChange('primaryMuscle', e.target.value)}
                >
                  {MUSCLE_GROUPS.map((m) => (
                    <option key={m} value={m}>{m.replace('_', ' ').toUpperCase()}</option>
                  ))}
                </Select>
              </div>
            )}

            <div className="flex items-center gap-2 pt-6">
              <Checkbox 
                checked={formData.isInterval || false} 
                onCheckedChange={(c) => handleChange('isInterval', c === true)} 
              />
              <div className="grid gap-1.5 leading-none">
                <Label>Interval Mode</Label>
                <p className="text-xs text-muted">Flags this exercise as interval-based (on/off).</p>
              </div>
            </div>

            {formData.category !== 'Mobility' && (
              <div className="flex items-center gap-2 pt-6">
                <Checkbox 
                  checked={formData.e1rmEligible || false} 
                  onCheckedChange={(c) => handleChange('e1rmEligible', c === true)} 
                />
                <div className="grid gap-1.5 leading-none">
                  <Label>E1RM Eligible</Label>
                  <p className="text-xs text-muted">Supports 1-rep max estimation.</p>
                </div>
              </div>
            )}
          </div>
        </section>

      </div>

      {/* Sticky Footer */}
      <div className="sticky bottom-0 left-0 right-0 p-4 bg-[var(--color-surface)]/80 backdrop-blur-md border-t border-[var(--color-border)] flex justify-between items-center z-20">
        <Button type="button" variant="ghost" onClick={() => window.history.back()}>
          Cancel
        </Button>
        <Button type="submit" disabled={isLoading} className="bg-[var(--color-text)] text-[var(--color-bg)] hover:opacity-90 transition-opacity">
          {isLoading ? 'Saving...' : 'Save Exercise'}
        </Button>
      </div>
    </form>
  );
}
