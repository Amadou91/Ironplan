import React from 'react';
import { WorkoutSet, MetricProfile } from '@/types/domain';
import { Trash2, Check } from 'lucide-react';
import { INTENSITY_RECOMMENDATION, RIR_HELPER_TEXT, RIR_OPTIONS, RPE_OPTIONS } from '@/constants/intensityOptions';
import type { WeightOption } from '@/lib/equipment';
import { mapRirToRpe } from '@/lib/session-metrics';
import { useSetEditor } from '@/hooks/useSetEditor';

interface SetLoggerProps {
  set: WorkoutSet;
  weightOptions?: WeightOption[];
  onUpdate: (field: keyof WorkoutSet, value: WorkoutSet[keyof WorkoutSet]) => void;
  onDelete: () => void;
  onToggleComplete: () => void;
  metricProfile?: MetricProfile;
  isCardio?: boolean;
  isYoga?: boolean;
  isTimeBased?: boolean;
  repsLabel?: string;
}

const NumericInput = ({ 
  value, 
  onChange, 
  placeholder, 
  mode = "decimal" as const,
  inputClassName,
  isEditing
}: { 
  value: string | number; 
  onChange: (val: string) => void; 
  placeholder: string;
  hasError?: boolean;
  mode?: "decimal" | "numeric";
  inputClassName: string;
  isEditing: boolean;
}) => (
  <input
    type="text"
    inputMode={mode}
    placeholder={placeholder}
    value={value ?? ''}
    onChange={(e) => onChange(e.target.value)}
    className={inputClassName}
    disabled={!isEditing}
    readOnly={!isEditing}
  />
);

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
  const {
    isEditing,
    effectiveProfile,
    timeLabel,
    weightError,
    repsError,
    validateAndUpdate,
    updateExtra,
    getExtra,
    weightChoices,
    durationMinutes,
    handleDurationChange,
    rirValue
  } = useSetEditor({
    set,
    metricProfile,
    weightOptions,
    isCardio,
    isYoga,
    isTimeBased,
    onUpdate
  });

  const inputClassName = (hasError?: boolean) => `input-base input-compact text-center ${!isEditing ? 'input-muted' : ''} ${hasError ? 'border-[var(--color-danger)] ring-1 ring-[var(--color-danger)]' : ''}`;

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

  if (effectiveProfile === 'yoga_session') {
    return (
      <div className={`flex flex-col mb-2 rounded-xl border p-4 transition-colors ${set.completed ? 'border-[var(--color-success-border)] bg-[var(--color-success-soft)]' : 'border-[var(--color-border)] bg-[var(--color-surface)]'}`}>
        {renderHeader()}
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col">
            <label className="mb-1 text-center text-[10px] font-semibold uppercase tracking-wider text-subtle">Duration (min)</label>
            <NumericInput placeholder="0" value={durationMinutes} onChange={handleDurationChange} mode="numeric" inputClassName={inputClassName()} isEditing={isEditing} />
          </div>
          <div className="flex flex-col">
            <label className="mb-1 text-center text-[10px] font-semibold uppercase tracking-wider text-subtle">Effort (1-10)</label>
            <select value={rirValue} onChange={(e) => onUpdate('rpe', e.target.value === '' ? '' : Number(e.target.value))} className={inputClassName()} disabled={!isEditing}>
              <option value="">Select effort</option>
              {Array.from({ length: 10 }, (_, i) => i + 1).map((val) => (
                <option key={val} value={val}>{val}</option>
              ))}
            </select>
          </div>
           <div className="flex flex-col">
             <label className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-subtle">Category</label>
             <select value={(getExtra('style') as string) ?? ''} onChange={(e) => updateExtra('style', e.target.value)} className={inputClassName()} disabled={!isEditing}>
                <option value="">Select style</option>
                <option value="Flow">Flow</option>
                <option value="Power">Power</option>
                <option value="Restorative">Restorative</option>
                <option value="Yin">Yin</option>
                <option value="Mobility">Mobility</option>
                <option value="Breathwork">Breathwork</option>
             </select>
           </div>
           <div className="flex flex-col">
             <label className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-subtle">Focus (Optional)</label>
             <input type="text" placeholder="e.g. Hips" value={(getExtra('focus') as string) ?? ''} onChange={(e) => updateExtra('focus', e.target.value)} className={`${inputClassName()} text-left px-2`} disabled={!isEditing} readOnly={!isEditing} />
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
            <NumericInput placeholder="0" value={durationMinutes} onChange={handleDurationChange} mode="numeric" inputClassName={inputClassName()} isEditing={isEditing} />
          </div>
          <div className="flex flex-col">
            <label className="mb-1 text-center text-[10px] font-semibold uppercase tracking-wider text-subtle">Effort (1-10)</label>
            <select value={rirValue} onChange={(e) => onUpdate('rpe', e.target.value === '' ? '' : Number(e.target.value))} className={inputClassName()} disabled={!isEditing}>
              <option value="">Select effort</option>
              {Array.from({ length: 10 }, (_, i) => i + 1).map((val) => (
                <option key={val} value={val}>{val}</option>
              ))}
            </select>
          </div>
          <div className="flex flex-col">
            <label className="mb-1 text-center text-[10px] font-semibold uppercase tracking-wider text-subtle">Distance (km)</label>
             <NumericInput placeholder="0.0" value={(getExtra('distance_km') as string) ?? set.distance ?? ''} onChange={(val) => { validateAndUpdate('distance', val); const num = val === '' ? null : Number(val); if (!isNaN(num as number)) updateExtra('distance_km', num); }} inputClassName={inputClassName()} isEditing={isEditing} />
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
            <NumericInput placeholder="0" value={durationMinutes} onChange={handleDurationChange} mode="numeric" inputClassName={inputClassName()} isEditing={isEditing} />
          </div>
           <div className="flex flex-col">
            <label className="mb-1 text-center text-[10px] font-semibold uppercase tracking-wider text-subtle">Effort (1-10)</label>
            <select value={rirValue} onChange={(e) => onUpdate('rpe', e.target.value === '' ? '' : Number(e.target.value))} className={inputClassName()} disabled={!isEditing}>
              <option value="">Select effort</option>
              {Array.from({ length: 10 }, (_, i) => i + 1).map((val) => (
                <option key={val} value={val}>{val}</option>
              ))}
            </select>
          </div>
           <div className="flex flex-col col-span-2">
             <label className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-subtle">Target Area (Optional)</label>
             <input type="text" placeholder="e.g. Hips" value={(getExtra('target_area') as string) ?? ''} onChange={(e) => updateExtra('target_area', e.target.value)} className={`${inputClassName()} text-left px-2`} disabled={!isEditing} readOnly={!isEditing} />
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
            <NumericInput placeholder="0" value={durationMinutes} onChange={handleDurationChange} mode="numeric" inputClassName={inputClassName()} isEditing={isEditing} />
          </div>
          <div className="flex flex-col">
            <label className="mb-1 text-center text-[10px] font-semibold uppercase tracking-wider text-subtle">Weight</label>
            {weightChoices.length > 0 ? (
              <select value={typeof set.weight === 'number' ? String(set.weight) : ''} onChange={(e) => { const v = e.target.value === '' ? '' : Number(e.target.value); onUpdate('weight', v); const opt = weightChoices.find(c => c.value === v); if (opt?.unit) onUpdate('weightUnit', opt.unit); }} className={inputClassName()} disabled={!isEditing}>
                <option value="">Select weight</option>
                {weightChoices.map(opt => <option key={`${opt.label}-${opt.value}`} value={opt.value}>{opt.label}</option>)}
              </select>
            ) : (
              <NumericInput placeholder="0" value={set.weight ?? ''} onChange={(val) => validateAndUpdate('weight', val)} hasError={weightError} inputClassName={inputClassName(weightError)} isEditing={isEditing} />
            )}
            <div className="mt-1 text-center text-[10px] text-subtle">{set.weightUnit ?? 'lb'}</div>
          </div>
          <div className="flex flex-col">
            <label className="mb-1 text-center text-[10px] font-semibold uppercase tracking-wider text-subtle">Intensity (RPE)</label>
            <select value={typeof set.rpe === 'number' ? String(set.rpe) : ''} onChange={(e) => onUpdate('rpe', e.target.value === '' ? '' : Number(e.target.value))} className={inputClassName()} disabled={!isEditing}>
              <option value="">Select effort</option>
              {RPE_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label} ({opt.value})</option>)}
            </select>
          </div>
          <div className="flex flex-col">
            <label className="mb-1 text-center text-[10px] font-semibold uppercase tracking-wider text-subtle">Reserve</label>
            <select value={typeof set.rir === 'number' ? String(set.rir) : ''} onChange={(e) => onUpdate('rir', e.target.value === '' ? '' : Number(e.target.value))} className={inputClassName()} disabled={!isEditing}>
              <option value="">Select reserve</option>
              {RIR_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
            </select>
          </div>
        </div>
        {renderCompletionControl()}
      </div>
    );
  }

  const derivedRpe = typeof set.rir === 'number' ? mapRirToRpe(set.rir) : null;
  const derivedRpeLabel = RPE_OPTIONS.find((opt) => opt.value === derivedRpe)?.label ?? null;

  return (
    <div className={`flex flex-col mb-2 rounded-xl border p-4 transition-colors ${set.completed ? 'border-[var(--color-success-border)] bg-[var(--color-success-soft)]' : 'border-[var(--color-border)] bg-[var(--color-surface)]'}`}>
      {renderHeader()}
      <div className="grid gap-2 sm:grid-cols-3">
        <div className="flex flex-col">
          <label className="mb-1 text-center text-[10px] font-semibold uppercase tracking-wider text-subtle">Weight</label>
          {weightChoices.length > 0 ? (
            <select value={typeof set.weight === 'number' ? String(set.weight) : ''} onChange={(e) => { const v = e.target.value === '' ? '' : Number(e.target.value); onUpdate('weight', v); const opt = weightChoices.find(c => c.value === v); if (opt?.unit) onUpdate('weightUnit', opt.unit); }} className={inputClassName()} disabled={!isEditing}>
              <option value="">Select weight</option>
              {weightChoices.map(opt => <option key={`${opt.label}-${opt.value}`} value={opt.value}>{opt.label}</option>)}
            </select>
          ) : (
            <NumericInput placeholder="0" value={set.weight ?? ''} onChange={(v) => validateAndUpdate('weight', v)} hasError={weightError} inputClassName={inputClassName(weightError)} isEditing={isEditing} />
          )}
          <div className="mt-1 text-[10px] text-subtle">Unit: {set.weightUnit ?? 'lb'}</div>
        </div>
        <div className="flex flex-col">
          <label className="mb-1 text-center text-[10px] font-semibold uppercase tracking-wider text-subtle">{repsLabel}</label>
          <NumericInput placeholder={repsLabel === 'Reps' ? '0' : '--'} value={set.reps ?? ''} onChange={(v) => validateAndUpdate('reps', v)} hasError={repsError} mode={repsLabel === 'Reps' ? 'numeric' : 'decimal'} inputClassName={inputClassName(repsError)} isEditing={isEditing} />
        </div>
        <div className="flex flex-col">
          <label className="mb-1 text-center text-[10px] font-semibold uppercase tracking-wider text-subtle">RIR</label>
          <select value={typeof set.rir === 'number' ? String(set.rir) : ''} onChange={(e) => { onUpdate('rir', e.target.value === '' ? '' : Number(e.target.value)); onUpdate('rpe', ''); }} className={inputClassName()} disabled={!isEditing}>
            <option value="">Select reps left</option>
            {RIR_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
          </select>
          <p className="mt-1 text-[10px] text-subtle">{RIR_HELPER_TEXT}</p>
          <p className="mt-1 text-[10px] text-muted">Derived RPE: {derivedRpe ?? '--'}{derivedRpeLabel ? ` · ${derivedRpeLabel}` : ''}</p>
        </div>
      </div>
      <p className="text-[10px] text-subtle">{INTENSITY_RECOMMENDATION}</p>
      {renderCompletionControl()}
    </div>
  );
};