'use client';

import React, { useState } from 'react';
import { Exercise, Goal, Difficulty, MetricProfile, MuscleGroup, EquipmentOption, ExerciseCategory } from '@/types/domain';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Label } from '@/components/ui/Label';
import { Button } from '@/components/ui/Button';
import { RPE_OPTIONS } from '@/constants/intensityOptions';
import { Info } from 'lucide-react';

interface WorkoutEditorProps {
  initialData?: Partial<Exercise>;
  onSubmit: (data: Exercise) => void;
  isLoading?: boolean;
}

const CATEGORIES: { value: ExerciseCategory; label: string }[] = [
  { value: 'Strength', label: 'Strength' },
  { value: 'Cardio', label: 'Cardio' },
  { value: 'Yoga', label: 'Yoga' },
];

const DIFFICULTIES: { value: Difficulty; label: string }[] = [
  { value: 'beginner', label: 'Beginner' },
  { value: 'intermediate', label: 'Intermediate' },
  { value: 'advanced', label: 'Advanced' },
];

const METRIC_PROFILES: { value: MetricProfile; label: string }[] = [
  { value: 'reps_weight', label: 'Reps & Weight' },
  { value: 'duration', label: 'Duration' },
  { value: 'distance_duration', label: 'Distance & Duration' },
  { value: 'reps_only', label: 'Reps Only' },
];

const MUSCLE_GROUPS: MuscleGroup[] = [
  'chest', 'back', 'shoulders', 'biceps', 'triceps', 'forearms', 'core', 
  'glutes', 'quads', 'hamstrings', 'calves', 'hip_flexors', 'adductors', 'abductors', 
  'full_body', 'upper_body', 'lower_body'
];

const EQUIPMENT_KINDS = [
  { value: 'bodyweight', label: 'Bodyweight' },
  { value: 'dumbbell', label: 'Dumbbell' },
  { value: 'kettlebell', label: 'Kettlebell' },
  { value: 'band', label: 'Band' },
  { value: 'barbell', label: 'Barbell' },
  { value: 'machine', label: 'Machine' },
];

const GOALS: { value: Goal; label: string }[] = [
  { value: 'strength', label: 'Strength' },
  { value: 'hypertrophy', label: 'Hypertrophy' },
  { value: 'endurance', label: 'Endurance' },
];

const DEFAULT_EXERCISE: Partial<Exercise> = {
  name: '',
  category: 'Strength',
  metricProfile: 'reps_weight',
  sets: 3,
  reps: 10,
  rpe: 8,
  equipment: [],
  difficulty: 'beginner',
  eligibleGoals: ['strength', 'hypertrophy'],
  durationMinutes: 30,
  restSeconds: 60,
  primaryMuscle: 'full_body',
  instructions: [],
  videoUrl: '',
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
    <div className="flex p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
      {options.map((option) => {
        const isSelected = value === option.value;
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className={`flex-1 py-1.5 px-3 text-sm font-medium rounded-md transition-all ${
              isSelected
                ? 'bg-white dark:bg-slate-600 text-slate-900 dark:text-white shadow-sm ring-1 ring-slate-200 dark:ring-slate-500'
                : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
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
                ? 'bg-slate-900 text-white border-slate-900 dark:bg-white dark:text-slate-900 dark:border-white'
                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50 dark:bg-slate-900 dark:text-slate-400 dark:border-slate-800 dark:hover:bg-slate-800'
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
    if (!formData.name || !formData.category || !formData.metricProfile) {
      alert('Please fill in Name, Category, and Metric Profile.');
      return;
    }
    onSubmit(formData as Exercise);
  };

  const filteredMetricProfiles = METRIC_PROFILES.filter(p => {
    if (formData.category === 'Strength') return ['reps_weight', 'reps_only'].includes(p.value);
    if (formData.category === 'Cardio') return ['distance_duration', 'duration'].includes(p.value);
    if (formData.category === 'Yoga') return ['duration'].includes(p.value);
    return true;
  });

  return (
    <form onSubmit={handleSubmit} className="relative flex flex-col gap-8 bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-100 dark:border-slate-800 overflow-hidden">
      
      <div className="p-8 space-y-8 pb-24"> {/* Added padding bottom to account for sticky footer */}
        
        {/* Section 1: Identity */}
        <section className="space-y-6">
          <div className="flex items-center gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Identity</h3>
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
                onChange={(cat) => {
                  const updates: Partial<Exercise> = { category: cat };
                  if (cat === 'Strength') {
                    updates.metricProfile = 'reps_weight';
                    updates.eligibleGoals = ['strength', 'hypertrophy'];
                  } else if (cat === 'Cardio') {
                    updates.metricProfile = 'distance_duration';
                    updates.eligibleGoals = ['endurance'];
                                  } else {
                                    updates.metricProfile = 'duration';
                                    updates.eligibleGoals = [];
                                    updates.primaryMuscle = 'full_body';
                                  }                  setFormData(prev => ({ ...prev, ...updates }));
                }}
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

        {/* Section 2: Tracking and Filters */}
        <section className="space-y-6">
           <div className="flex items-center gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Filters & Requirements</h3>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Difficulty</Label>
              <SegmentedControl
                options={DIFFICULTIES}
                value={formData.difficulty || 'beginner'}
                onChange={(d) => handleChange('difficulty', d)}
              />
            </div>

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

            {formData.category === 'Strength' && (
              <div className="col-span-2 space-y-2">
                <Label className="flex items-center gap-2">
                  Eligible Styles
                  <div className="group relative">
                    <Info className="w-3.5 h-3.5 text-slate-400 cursor-help" />
                    <span className="invisible group-hover:visible absolute left-1/2 -translate-x-1/2 bottom-full mb-1 px-2 py-1 text-xs text-white bg-slate-800 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
                      Uncheck only if strictly incompatible
                    </span>
                  </div>
                </Label>
                <MultiSelectChips
                  options={GOALS}
                  selected={formData.eligibleGoals || []}
                  onChange={(goals) => handleChange('eligibleGoals', goals)}
                />
              </div>
            )}

            <div className="col-span-2 space-y-2">
              <Label>Required Equipment</Label>
              <MultiSelectChips
                options={EQUIPMENT_KINDS}
                selected={formData.equipment?.map(e => e.kind) || []}
                onChange={(kinds) => {
                  const newEquipment = kinds.map(k => ({ kind: k } as EquipmentOption));
                  handleChange('equipment', newEquipment);
                }}
              />
            </div>
          </div>
        </section>

        {/* Section 3: Default Prescription */}
        <section className="space-y-6">
           <div className="flex items-center gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Default Prescription</h3>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="sets">Sets</Label>
              <Input
                id="sets"
                type="number"
                value={formData.sets}
                onChange={(e) => handleChange('sets', parseInt(e.target.value) || 0)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="reps">Reps / Duration</Label>
              <Input
                id="reps"
                value={formData.reps}
                onChange={(e) => handleChange('reps', e.target.value)}
                placeholder="e.g. 8-12"
              />
            </div>
            <div className="space-y-1.5">
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
            <div className="space-y-1.5">
              <Label htmlFor="restSeconds">Rest (Sec)</Label>
              <Input
                id="restSeconds"
                type="number"
                value={formData.restSeconds}
                onChange={(e) => handleChange('restSeconds', parseInt(e.target.value) || 0)}
              />
            </div>
          </div>
        </section>

      </div>

      {/* Sticky Footer */}
      <div className="sticky bottom-0 left-0 right-0 p-4 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-t border-slate-100 dark:border-slate-800 flex justify-between items-center z-20">
        <Button type="button" variant="ghost" onClick={() => window.history.back()}>
          Cancel
        </Button>
        <Button type="submit" disabled={isLoading}>
          {isLoading ? 'Saving...' : 'Save Exercise'}
        </Button>
      </div>
    </form>
  );
}
