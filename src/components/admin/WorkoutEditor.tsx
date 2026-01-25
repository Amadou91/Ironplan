'use client';

import React, { useState, useEffect } from 'react';
import { Exercise, FocusArea, Goal, Difficulty, MetricProfile, MuscleGroup, EquipmentOption } from '@/types/domain';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Label } from '@/components/ui/Label';
import { Button } from '@/components/ui/Button';
import { Textarea } from '@/components/ui/Textarea';
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
const MUSCLE_GROUPS: MuscleGroup[] = ['chest', 'back', 'shoulders', 'biceps', 'triceps', 'forearms', 'core', 'glutes', 'quads', 'hamstrings', 'calves', 'hip_flexors', 'adductors', 'abductors', 'full_body', 'cardio', 'yoga', 'lower_body', 'upper_body'];
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

  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (initialData) {
      setFormData((prev) => ({ ...prev, ...initialData }));
    }
  }, [initialData]);

  const handleChange = (field: keyof Exercise, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  const handleEquipmentChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
      const kind = e.target.value;
      if (!kind) return;
      
      // Simple toggle for now: if exists, remove, else add
      // Actually, Exercise expects EquipmentOption[]
      // We'll just append to the list for this prototype
      const newOption: EquipmentOption = { kind: kind as any };
      const current = formData.equipment || [];
      const exists = current.find(eq => eq.kind === kind);
      
      let nextEquipment;
      if (exists) {
          nextEquipment = current.filter(eq => eq.kind !== kind);
      } else {
          nextEquipment = [...current, newOption];
      }
      handleChange('equipment', nextEquipment);
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (!formData.name) newErrors.name = 'Name is required';
    if (!formData.focus) newErrors.focus = 'Focus area is required';
    if (!formData.metricProfile) newErrors.metricProfile = 'Metric profile is required';
    if (formData.sets === undefined || formData.sets < 0) newErrors.sets = 'Sets must be valid';
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validate()) {
      onSubmit(formData as Exercise);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 bg-white p-6 rounded-xl shadow-sm border border-slate-100 dark:bg-slate-900 dark:border-slate-800">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="name">Exercise Name</Label>
          <Input
            id="name"
            value={formData.name}
            onChange={(e) => handleChange('name', e.target.value)}
            placeholder="e.g. Bench Press"
          />
          {errors.name && <p className="text-red-500 text-xs">{errors.name}</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="metricProfile">Metric Profile (Required)</Label>
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
          {errors.metricProfile && <p className="text-red-500 text-xs">{errors.metricProfile}</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="focus">Focus Area</Label>
          <Select
            id="focus"
            value={formData.focus}
            onChange={(e) => handleChange('focus', e.target.value)}
          >
            {FOCUS_AREAS.map((f) => (
              <option key={f} value={f}>{f.replace('_', ' ').toUpperCase()}</option>
            ))}
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="goal">Goal</Label>
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

        <div className="space-y-2">
          <Label htmlFor="primaryMuscle">Primary Muscle</Label>
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
      </div>

      <div className="grid gap-4 md:grid-cols-4">
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
          <Label htmlFor="reps">Reps</Label>
          <Input
            id="reps"
            value={formData.reps}
            onChange={(e) => handleChange('reps', e.target.value)}
            placeholder="e.g. 10 or 8-12"
          />
        </div>
        <div className="space-y-2">
            <Label htmlFor="rpe">RPE Target</Label>
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
          <Label htmlFor="restSeconds">Rest (sec)</Label>
          <Input
            id="restSeconds"
            type="number"
            value={formData.restSeconds}
            onChange={(e) => handleChange('restSeconds', parseInt(e.target.value) || 0)}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label>Equipment (Select multiple)</Label>
        <div className="flex gap-2 flex-wrap">
            {EQUIPMENT_KINDS.map(kind => {
                const isSelected = formData.equipment?.some(eq => eq.kind === kind);
                return (
                    <button
                        key={kind}
                        type="button"
                        onClick={() => {
                            const current = formData.equipment || [];
                            let next;
                            if (isSelected) {
                                next = current.filter(eq => eq.kind !== kind);
                            } else {
                                next = [...current, { kind } as EquipmentOption];
                            }
                            handleChange('equipment', next);
                        }}
                        className={`px-3 py-1 rounded-full text-xs font-medium border ${ 
                            isSelected 
                            ? 'bg-[var(--color-primary)] text-white border-[var(--color-primary)]' 
                            : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                        }`}
                    >
                        {kind}
                    </button>
                )
            })}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="instructions">Instructions (One per line)</Label>
        <Textarea
          id="instructions"
          value={formData.instructions?.join('\n')}
          onChange={(e) => handleChange('instructions', e.target.value.split('\n'))}
          rows={4}
          placeholder="Step 1...&#10;Step 2..."
        />
      </div>

      <div className="flex justify-end gap-2 pt-4">
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
