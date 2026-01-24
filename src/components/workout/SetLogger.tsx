import React, { useEffect, useMemo } from 'react';
import { WorkoutSet, MetricProfile } from '@/types/domain';
import { Trash2, Check, Circle } from 'lucide-react';
import { INTENSITY_RECOMMENDATION, RIR_HELPER_TEXT, RIR_OPTIONS, RPE_OPTIONS } from '@/constants/intensityOptions';
import type { WeightOption } from '@/lib/equipment';
import { mapRirToRpe } from '@/lib/session-metrics';

interface SetLoggerProps {
  set: WorkoutSet;
  weightOptions?: WeightOption[];
  onUpdate: (field: keyof WorkoutSet, value: WorkoutSet[keyof WorkoutSet]) => void;
  onDelete: () => void;
  onToggleComplete: () => void;
  metricProfile?: MetricProfile;
  // Legacy/Fallback props
  isCardio?: boolean;
  isYoga?: boolean;
  isTimeBased?: boolean;
  repsLabel?: string;
}

export const SetLogger: React.FC<SetLoggerProps> = ({ 
  set, 
  weightOptions, 
  onUpdate, 
  onDelete, 
  onToggleComplete, 
  metricProfile,
  isCardio = false, 
  isYoga = false, 
  isTimeBased = false, 
  repsLabel = 'Reps' 
}) => {
  const isEditing = !set.completed;
  
  // Resolve effective profile
  const effectiveProfile = useMemo(() => {
    if (metricProfile) return metricProfile;
    // Fallback logic for legacy props if metricProfile isn't set yet (e.g. during migration if data not reloaded)
    if (isYoga) return 'yoga_session';
    if (isCardio) return 'cardio_session';
    if (isTimeBased) return 'timed_strength';
    return 'strength';
  }, [metricProfile, isYoga, isCardio, isTimeBased]);

  const timeLabel = useMemo(() => {
    if (!set.performedAt) return 'Not logged yet';
    const date = new Date(set.performedAt);
    return Number.isNaN(date.getTime()) ? 'Not logged yet' : date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }, [set.performedAt]);

  const inputClassName = `input-base input-compact text-center ${!isEditing ? 'input-muted' : ''}`;
  
  // Helpers
  const updateExtra = (key: string, value: unknown) => {
    const currentExtras = (set.extraMetrics as Record<string, unknown>) ?? {};
    onUpdate('extraMetrics', { ...currentExtras, [key]: value });
  };

  const getExtra = (key: string) => {
    const extras = (set.extraMetrics as Record<string, unknown>) ?? {};
    return extras[key];
  };

  const rirValue = typeof set.rir === 'number' ? String(set.rir) : '';
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

  // Duration Logic (Seconds -> Minutes)
  const durationMinutes = useMemo(() => {
    if (typeof set.durationSeconds === 'number') return Math.round(set.durationSeconds / 60);
    // Fallback for migration if seconds stored in reps
    if ((effectiveProfile === 'timed_strength' || effectiveProfile === 'cardio_session' || effectiveProfile === 'yoga_session' || effectiveProfile === 'mobility_session') && typeof set.reps === 'number') {
      return Math.round(set.reps / 60);
    }
    return '';
  }, [set.durationSeconds, set.reps, effectiveProfile]);

  const handleDurationChange = (val: string) => {
    onUpdate('durationSeconds', val === '' ? '' : Number(val) * 60);
  };

  // Completion Control (Bottom Right)
  const renderCompletionControl = () => (
    <div className="flex justify-end mt-4">
       <button
        onClick={onToggleComplete}
        className={`flex items-center gap-2 px-4 py-2 rounded-full font-medium transition-all ${
          set.completed 
            ? 'bg-[var(--color-success)] text-white shadow-sm hover:bg-[var(--color-success-strong)]' 
            : 'bg-[var(--color-surface-muted)] text-subtle border border-[var(--color-border)] hover:border-[var(--color-primary)] hover:text-strong'
        }`}
        style={{ minHeight: '44px', minWidth: '140px', justifyContent: 'center' }}
      >
        {set.completed ? (
          <>
            <Check size={18} strokeWidth={3} />
            <span>Completed</span>
          </>
        ) : (
          <span>Mark Complete</span>
        )}
      </button>
    </div>
  );

  const renderHeader = () => (
     <div className="flex items-center gap-2 mb-3">
        <div className="w-8 text-center font-semibold text-muted">{set.setNumber}</div>
        <div className="text-[10px] uppercase tracking-wider text-subtle">{timeLabel}</div>
        <div className="ml-auto">
           <button
            onClick={onDelete}
            className="p-2 text-subtle transition-colors hover:text-[var(--color-danger)]"
            title="Delete set"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>
  );

  // --- PROFILE RENDERERS ---

  if (effectiveProfile === 'yoga_session') {
    return (
      <div className={`flex flex-col mb-2 rounded-xl border p-4 transition-colors ${set.completed ? 'border-[var(--color-success-border)] bg-[var(--color-success-soft)]' : 'border-[var(--color-border)] bg-[var(--color-surface)]'}`}>
        {renderHeader()}
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col">
            <label className="mb-1 text-center text-[10px] font-semibold uppercase tracking-wider text-subtle">Duration (min)</label>
            <input
              type="number"
              placeholder="0"
              value={durationMinutes}
              onChange={(e) => handleDurationChange(e.target.value)}
              className={inputClassName}
              min={0}
              readOnly={!isEditing}
            />
          </div>
          <div className="flex flex-col">
            <label className="mb-1 text-center text-[10px] font-semibold uppercase tracking-wider text-subtle">Effort (1-10)</label>
            <select
              value={rirValue}
              onChange={(e) => onUpdate('rir', e.target.value === '' ? '' : Number(e.target.value))}
              className={inputClassName}
              disabled={!isEditing}
            >
              <option value="">Select effort</option>
              {Array.from({ length: 10 }, (_, i) => i + 1).map((val) => (
                <option key={val} value={val}>{val}</option>
              ))}
            </select>
          </div>
           {/* Extras */}
           <div className="flex flex-col">
             <label className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-subtle">Style (Optional)</label>
             <input
                type="text"
                placeholder="e.g. Vinyasa"
                value={(getExtra('style') as string) ?? ''}
                onChange={(e) => updateExtra('style', e.target.value)}
                className={`${inputClassName} text-left px-2`}
                readOnly={!isEditing}
             />
           </div>
           <div className="flex flex-col">
             <label className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-subtle">Focus (Optional)</label>
             <input
                type="text"
                placeholder="e.g. Hips"
                value={(getExtra('focus') as string) ?? ''}
                onChange={(e) => updateExtra('focus', e.target.value)}
                className={`${inputClassName} text-left px-2`}
                readOnly={!isEditing}
             />
           </div>
        </div>
        {renderCompletionControl()}
      </div>
    );
  }

  if (effectiveProfile === 'cardio_session') {
    return (
      <div className={`flex flex-col mb-2 rounded-xl border p-4 transition-colors ${set.completed ? 'border-[var(--color-success-border)] bg-[var(--color-success-soft)]' : 'border-[var(--color-border)] bg-[var(--color-surface)]'}`}>
        {renderHeader()}
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="flex flex-col">
            <label className="mb-1 text-center text-[10px] font-semibold uppercase tracking-wider text-subtle">Duration (min)</label>
            <input
              type="number"
              placeholder="0"
              value={durationMinutes}
              onChange={(e) => handleDurationChange(e.target.value)}
              className={inputClassName}
              min={0}
              readOnly={!isEditing}
            />
          </div>
          <div className="flex flex-col">
            <label className="mb-1 text-center text-[10px] font-semibold uppercase tracking-wider text-subtle">Effort (1-10)</label>
            <select
              value={rirValue}
              onChange={(e) => onUpdate('rir', e.target.value === '' ? '' : Number(e.target.value))}
              className={inputClassName}
              disabled={!isEditing}
            >
              <option value="">Select effort</option>
              {Array.from({ length: 10 }, (_, i) => i + 1).map((val) => (
                <option key={val} value={val}>{val}</option>
              ))}
            </select>
          </div>
          <div className="flex flex-col">
            <label className="mb-1 text-center text-[10px] font-semibold uppercase tracking-wider text-subtle">Distance (km)</label>
             <input
                type="number"
                placeholder="0.0"
                value={(getExtra('distance_km') as string) ?? set.distance ?? ''}
                onChange={(e) => {
                   const val = e.target.value === '' ? '' : Number(e.target.value);
                   updateExtra('distance_km', val);
                   // Sync to legacy distance col
                   onUpdate('distance', val === '' ? null : val);
                }}
                className={inputClassName}
                min={0}
                step={0.1}
                readOnly={!isEditing}
              />
          </div>
        </div>
        {renderCompletionControl()}
      </div>
    );
  }

  if (effectiveProfile === 'mobility_session') {
    return (
      <div className={`flex flex-col mb-2 rounded-xl border p-4 transition-colors ${set.completed ? 'border-[var(--color-success-border)] bg-[var(--color-success-soft)]' : 'border-[var(--color-border)] bg-[var(--color-surface)]'}`}>
        {renderHeader()}
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col">
            <label className="mb-1 text-center text-[10px] font-semibold uppercase tracking-wider text-subtle">Duration (min)</label>
            <input
              type="number"
              placeholder="0"
              value={durationMinutes}
              onChange={(e) => handleDurationChange(e.target.value)}
              className={inputClassName}
              min={0}
              readOnly={!isEditing}
            />
          </div>
           <div className="flex flex-col">
            <label className="mb-1 text-center text-[10px] font-semibold uppercase tracking-wider text-subtle">Difficulty (1-10)</label>
            <select
              value={(getExtra('difficulty') as string) ?? ''}
              onChange={(e) => updateExtra('difficulty', e.target.value === '' ? '' : Number(e.target.value))}
              className={inputClassName}
              disabled={!isEditing}
            >
              <option value="">Select</option>
              {Array.from({ length: 10 }, (_, i) => i + 1).map((val) => (
                <option key={val} value={val}>{val}</option>
              ))}
            </select>
          </div>
           <div className="flex flex-col col-span-2">
             <label className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-subtle">Target Area (Optional)</label>
             <input
                type="text"
                placeholder="e.g. Hips"
                value={(getExtra('target_area') as string) ?? ''}
                onChange={(e) => updateExtra('target_area', e.target.value)}
                className={`${inputClassName} text-left px-2`}
                readOnly={!isEditing}
             />
           </div>
        </div>
        {renderCompletionControl()}
      </div>
    );
  }

  if (effectiveProfile === 'timed_strength') {
    return (
      <div className={`flex flex-col mb-2 rounded-xl border p-4 transition-colors ${set.completed ? 'border-[var(--color-success-border)] bg-[var(--color-success-soft)]' : 'border-[var(--color-border)] bg-[var(--color-surface)]'}`}>
        {renderHeader()}
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col">
            <label className="mb-1 text-center text-[10px] font-semibold uppercase tracking-wider text-subtle">Duration (min)</label>
            <input
              type="number"
              placeholder="0"
              value={durationMinutes}
              onChange={(e) => handleDurationChange(e.target.value)}
              className={inputClassName}
              min={0}
              readOnly={!isEditing}
            />
          </div>

            <div className="flex-1 flex flex-col">
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
               <div className="mt-1 text-center text-[10px] text-subtle">
                 {set.weightUnit ?? 'lb'}
               </div>
            </div>
            <div className="flex flex-col">
              <label className="mb-1 text-center text-[10px] font-semibold uppercase tracking-wider text-subtle">Intensity (RPE)</label>
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
            <div className="flex flex-col">
              <label className="mb-1 text-center text-[10px] font-semibold uppercase tracking-wider text-subtle">Reserve</label>
              <select
                value={rirValue}
                onChange={(event) => {
                  const nextValue = event.target.value === '' ? '' : Number(event.target.value);
                  onUpdate('rir', nextValue);
                }}
                className={inputClassName}
                disabled={!isEditing}
              >
                <option value="">Select reserve</option>
                {RIR_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
        </div>
        {renderCompletionControl()}
      </div>
    );
  }

  // STANDARD STRENGTH UI
  const rirEquivalence = RIR_OPTIONS.find((option) => option.value === set.rir)?.equivalence;
  const derivedRpe = typeof set.rir === 'number' ? mapRirToRpe(set.rir) : null;
  const derivedRpeLabel = RPE_OPTIONS.find((option) => option.value === derivedRpe)?.label ?? null;

  return (
    <div className={`flex flex-col mb-2 rounded-xl border p-4 transition-colors ${set.completed ? 'border-[var(--color-success-border)] bg-[var(--color-success-soft)]' : 'border-[var(--color-border)] bg-[var(--color-surface)]'}`}>
      {renderHeader()}
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
      {renderCompletionControl()}
    </div>
  );
};
