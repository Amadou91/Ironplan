import React, { useEffect, useMemo } from 'react';
import { WorkoutSet } from '@/types/domain';
import { Trash2, CheckCircle, Circle } from 'lucide-react';
import { INTENSITY_RECOMMENDATION, RIR_HELPER_TEXT, RIR_OPTIONS, RPE_OPTIONS } from '@/constants/intensityOptions';
import type { WeightOption } from '@/lib/equipment';
import { mapRirToRpe } from '@/lib/session-metrics';
import { YOGA_STYLES, YOGA_FOCUS_AREAS } from '@/constants/yogaOptions';

interface SetLoggerProps {
  set: WorkoutSet;
  weightOptions?: WeightOption[];
  onUpdate: (field: keyof WorkoutSet, value: WorkoutSet[keyof WorkoutSet]) => void;
  onDelete: () => void;
  onToggleComplete: () => void;
  isCardio?: boolean;
  isYoga?: boolean;
  repsLabel?: string;
}

export const SetLogger: React.FC<SetLoggerProps> = ({ set, weightOptions, onUpdate, onDelete, onToggleComplete, isCardio = false, isYoga = false, repsLabel = 'Reps' }) => {
  const isEditing = !set.completed;
  const timeLabel = useMemo(() => {
    if (!set.performedAt) return 'Not logged yet';
    const date = new Date(set.performedAt);
    return Number.isNaN(date.getTime()) ? 'Not logged yet' : date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }, [set.performedAt]);

  const inputClassName = `input-base input-compact text-center ${!isEditing ? 'input-muted' : ''}`;
  
  // Standard Strength/Cardio Helpers
  const rirValue = typeof set.rir === 'number' ? String(set.rir) : '';
  const rirEquivalence = RIR_OPTIONS.find((option) => option.value === set.rir)?.equivalence;
  const derivedRpe = typeof set.rir === 'number' ? mapRirToRpe(set.rir) : null;
  const derivedRpeLabel = RPE_OPTIONS.find((option) => option.value === derivedRpe)?.label ?? null;
  
  const weightChoices = useMemo(() => {
    const options = weightOptions ?? [];
    if (typeof set.weight === 'number' && Number.isFinite(set.weight)) {
      const existing = options.some((option) => option.value === set.weight);
      if (!existing) {
        const unitLabel = set.weightUnit ?? 'lb';
        return [...options, { value: set.weight, label: `${set.weight} ${unitLabel} (logged)` }];
      }
    }
    return options;
  }, [set.weight, set.weightUnit, weightOptions]);

  // Yoga Helpers
  const updateExtras = (key: string, value: string | null) => {
    const currentExtras = set.extras ?? {};
    onUpdate('extras', { ...currentExtras, [key]: value });
  };

  const yogaStyle = set.extras?.style ?? '';
  const yogaFocus = set.extras?.focus ? set.extras.focus.split(',') : [];
  const yogaNotes = set.extras?.notes ?? '';

  const toggleFocus = (focus: string) => {
    const current = new Set(yogaFocus);
    if (current.has(focus)) {
      current.delete(focus);
    } else {
      current.add(focus);
    }
    updateExtras('focus', Array.from(current).join(','));
  };

  useEffect(() => {
    if (!isEditing || isCardio || isYoga) return;
    const isEmptyWeight = set.weight === '' || set.weight === null || typeof set.weight !== 'number';
    if (isEmptyWeight && weightChoices.length > 0) {
      onUpdate('weight', weightChoices[0].value);
      onUpdate('weightUnit', weightChoices[0].unit ?? set.weightUnit ?? 'lb');
    }
  }, [isEditing, isCardio, isYoga, onUpdate, set.weight, set.weightUnit, weightChoices]);

  // YOGA UI
  if (isYoga) {
    return (
      <div className={`flex flex-col gap-3 mb-2 rounded-xl border p-4 transition-colors ${set.completed ? 'border-[var(--color-success-border)] bg-[var(--color-success-soft)]' : 'border-[var(--color-border)] bg-[var(--color-surface)]'}`}>
        <div className="flex items-center gap-2">
          <div className="w-8 text-center font-semibold text-muted">{set.setNumber}</div>
          <div className="text-[10px] uppercase tracking-wider text-subtle">{timeLabel}</div>
          <div className="ml-auto text-[10px] uppercase tracking-wider text-subtle">
            {set.completed ? 'Completed' : 'In progress'}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {/* Row 1: Duration & Intensity */}
          <div className="flex gap-4">
            <div className="flex-1 flex flex-col">
              <label className="mb-1 text-center text-[10px] font-semibold uppercase tracking-wider text-subtle">Duration (min)</label>
              <input
                type="number"
                placeholder="0"
                value={typeof set.durationSeconds === 'number' ? Math.round(set.durationSeconds / 60) : ''}
                onChange={(e) => onUpdate('durationSeconds', e.target.value === '' ? '' : Number(e.target.value) * 60)}
                className={inputClassName}
                min={0}
                readOnly={!isEditing}
              />
            </div>
            <div className="flex-1 flex flex-col">
              <label className="mb-1 text-center text-[10px] font-semibold uppercase tracking-wider text-subtle">Intensity (1-10)</label>
              <select
                value={typeof set.rpe === 'number' ? String(set.rpe) : ''}
                onChange={(event) => {
                  const nextValue = event.target.value === '' ? '' : Number(event.target.value);
                  onUpdate('rpe', nextValue);
                }}
                className={inputClassName}
                disabled={!isEditing}
              >
                <option value="">Scale 1-10</option>
                {RPE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.value} - {option.label.split('–')[0].trim()}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Row 2: Style & Focus (Optional) */}
          <div className="flex flex-col gap-2">
            <div className="flex flex-col">
               <label className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-subtle">Style (Optional)</label>
               <select
                  value={yogaStyle}
                  onChange={(e) => updateExtras('style', e.target.value)}
                  className={`${inputClassName} text-left`}
                  disabled={!isEditing}
                >
                  <option value="">Select Style</option>
                  {YOGA_STYLES.map((style) => (
                    <option key={style} value={style}>{style}</option>
                  ))}
                </select>
            </div>
          </div>
        </div>
        
        {/* Focus Multi-Select */}
        <div className="flex flex-col gap-1">
             <label className="text-[10px] font-semibold uppercase tracking-wider text-subtle">Focus (Optional)</label>
             <div className="flex flex-wrap gap-2">
               {YOGA_FOCUS_AREAS.map((focus) => {
                 const isActive = yogaFocus.includes(focus);
                 return (
                   <button
                     key={focus}
                     onClick={() => toggleFocus(focus)}
                     disabled={!isEditing}
                     className={`px-2 py-1 rounded-md text-[10px] border transition-colors ${
                       isActive 
                         ? 'bg-[var(--color-primary)] text-white border-[var(--color-primary)]' 
                         : 'bg-[var(--color-surface-muted)] text-subtle border-transparent hover:border-[var(--color-border)]'
                     }`}
                   >
                     {focus}
                   </button>
                 )
               })}
             </div>
        </div>

        {/* Notes */}
        <div className="flex flex-col">
           <label className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-subtle">Notes</label>
           <input
             type="text"
             placeholder="How did it feel?"
             value={yogaNotes}
             onChange={(e) => updateExtras('notes', e.target.value)}
             className={`${inputClassName} text-left px-2`}
             readOnly={!isEditing}
           />
        </div>

        <div className="flex items-center justify-between gap-2 mt-2">
          <button
            onClick={onToggleComplete}
            className={`rounded-full p-2 transition-colors ${set.completed ? 'text-[var(--color-success)] hover:bg-[var(--color-success-soft)]' : 'text-subtle hover:bg-[var(--color-surface-muted)]'}`}
          >
            {set.completed ? <CheckCircle size={20} /> : <Circle size={20} />}
          </button>

          <button
            onClick={onDelete}
            className="rounded-full p-2 text-subtle transition-colors hover:bg-[var(--color-danger-soft)] hover:text-[var(--color-danger)]"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>
    );
  }

  // CARDIO UI
  if (isCardio) {
    return (
      <div className={`flex flex-col gap-3 mb-2 rounded-xl border p-4 transition-colors ${set.completed ? 'border-[var(--color-success-border)] bg-[var(--color-success-soft)]' : 'border-[var(--color-border)] bg-[var(--color-surface)]'}`}>
        <div className="flex items-center gap-2">
          <div className="w-8 text-center font-semibold text-muted">{set.setNumber}</div>
          <div className="text-[10px] uppercase tracking-wider text-subtle">{timeLabel}</div>
          <div className="ml-auto text-[10px] uppercase tracking-wider text-subtle">
            {set.completed ? 'Completed' : 'In progress'}
          </div>
        </div>

        <div className="grid gap-2 sm:grid-cols-3">
          <div className="flex flex-col">
            <label className="mb-1 text-center text-[10px] font-semibold uppercase tracking-wider text-subtle">Duration (min)</label>
            <input
              type="number"
              placeholder="0"
              value={typeof set.durationSeconds === 'number' ? Math.round(set.durationSeconds / 60) : ''}
              onChange={(e) => onUpdate('durationSeconds', e.target.value === '' ? '' : Number(e.target.value) * 60)}
              className={inputClassName}
              min={0}
              readOnly={!isEditing}
            />
          </div>

          <div className="flex flex-col">
            <label className="mb-1 text-center text-[10px] font-semibold uppercase tracking-wider text-subtle">Distance (km)</label>
             <div className="flex gap-1">
              <input
                type="number"
                placeholder="0.0"
                value={set.distance ?? ''}
                onChange={(e) => onUpdate('distance', e.target.value === '' ? '' : Number(e.target.value))}
                className={inputClassName}
                min={0}
                step={0.1}
                readOnly={!isEditing}
              />
            </div>
             <div className="mt-1 text-center text-[10px] text-subtle">
               {set.distanceUnit ?? 'km'}
             </div>
          </div>

          <div className="flex flex-col">
            <label className="mb-1 text-center text-[10px] font-semibold uppercase tracking-wider text-subtle">RPE (1-10)</label>
            <select
                value={typeof set.rpe === 'number' ? String(set.rpe) : ''}
                onChange={(event) => {
                  const nextValue = event.target.value === '' ? '' : Number(event.target.value);
                  onUpdate('rpe', nextValue);
                }}
                className={inputClassName}
                disabled={!isEditing}
              >
                <option value="">Select effort</option>
                {RPE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label} ({option.value})
                  </option>
                ))}
              </select>
          </div>
        </div>
         <p className="text-[10px] text-subtle">Log your steady-state or interval effort.</p>

        <div className="flex items-center justify-between gap-2">
          <button
            onClick={onToggleComplete}
            className={`rounded-full p-2 transition-colors ${set.completed ? 'text-[var(--color-success)] hover:bg-[var(--color-success-soft)]' : 'text-subtle hover:bg-[var(--color-surface-muted)]'}`}
          >
            {set.completed ? <CheckCircle size={20} /> : <Circle size={20} />}
          </button>

          <button
            onClick={onDelete}
            className="rounded-full p-2 text-subtle transition-colors hover:bg-[var(--color-danger-soft)] hover:text-[var(--color-danger)]"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>
    );
  }

  // STANDARD UI
  return (
    <div className={`flex flex-col gap-3 mb-2 rounded-xl border p-4 transition-colors ${set.completed ? 'border-[var(--color-success-border)] bg-[var(--color-success-soft)]' : 'border-[var(--color-border)] bg-[var(--color-surface)]'}`}>
      <div className="flex items-center gap-2">
        <div className="w-8 text-center font-semibold text-muted">{set.setNumber}</div>
        <div className="text-[10px] uppercase tracking-wider text-subtle">{timeLabel}</div>
        <div className="ml-auto text-[10px] uppercase tracking-wider text-subtle">
          {set.completed ? 'Completed' : 'In progress'}
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-3">
        <div className="flex flex-col">
          <label className="mb-1 text-center text-[10px] font-semibold uppercase tracking-wider text-subtle">Weight</label>
          {weightChoices.length > 0 ? (
            <select
              value={typeof set.weight === 'number' ? String(set.weight) : ''}
              onChange={(event) => {
                const nextValue = event.target.value === '' ? '' : Number(event.target.value);
                onUpdate('weight', nextValue);
                const option = weightChoices.find((choice) => choice.value === nextValue);
                if (option?.unit) {
                  onUpdate('weightUnit', option.unit);
                }
              }}
              className={inputClassName}
              disabled={!isEditing}
            >
              <option value="">Select weight</option>
              {weightChoices.map((option) => (
                <option key={`${option.label}-${option.value}`} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          ) : (
            <input
              type="number"
              placeholder="0"
              value={set.weight ?? ''}
              onChange={(e) => onUpdate('weight', e.target.value === '' ? '' : Number(e.target.value))}
              className={inputClassName}
              min={0}
              readOnly={!isEditing}
            />
          )}
          <div className="mt-1 text-[10px] text-subtle">
            Unit: {set.weightUnit ?? 'lb'}
          </div>
        </div>

        <div className="flex flex-col">
          <label className="mb-1 text-center text-[10px] font-semibold uppercase tracking-wider text-subtle">{repsLabel}</label>
          <input
            type="number"
            placeholder={repsLabel === 'Reps' ? '0' : '--'}
            value={set.reps ?? ''}
            onChange={(e) => onUpdate('reps', e.target.value === '' ? '' : Number(e.target.value))}
            className={inputClassName}
            min={0}
            readOnly={!isEditing}
          />
        </div>

        <div className="flex flex-col">
          <label className="mb-1 text-center text-[10px] font-semibold uppercase tracking-wider text-subtle">RIR</label>
          <select
            value={rirValue}
            onChange={(event) => {
              const nextValue = event.target.value === '' ? '' : Number(event.target.value);
              onUpdate('rir', nextValue);
              onUpdate('rpe', '');
            }}
            className={inputClassName}
            disabled={!isEditing}
          >
            <option value="">Select reps left</option>
            {RIR_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <p className="mt-1 text-[10px] text-subtle">{RIR_HELPER_TEXT}</p>
          {rirEquivalence ? <p className="text-[10px] text-accent">{rirEquivalence}</p> : null}
          <p className="mt-1 text-[10px] text-muted">
            Derived RPE: {derivedRpe ?? '--'}{derivedRpeLabel ? ` · ${derivedRpeLabel}` : ''}
          </p>
        </div>
      </div>
      <p className="text-[10px] text-subtle">{INTENSITY_RECOMMENDATION}</p>

      <div className="flex items-center justify-between gap-2">
        <button
          onClick={onToggleComplete}
          className={`rounded-full p-2 transition-colors ${set.completed ? 'text-[var(--color-success)] hover:bg-[var(--color-success-soft)]' : 'text-subtle hover:bg-[var(--color-surface-muted)]'}`}
        >
          {set.completed ? <CheckCircle size={20} /> : <Circle size={20} />}
        </button>

        <button
          onClick={onDelete}
          className="rounded-full p-2 text-subtle transition-colors hover:bg-[var(--color-danger-soft)] hover:text-[var(--color-danger)]"
        >
          <Trash2 size={16} />
        </button>
      </div>
    </div>
  );
};