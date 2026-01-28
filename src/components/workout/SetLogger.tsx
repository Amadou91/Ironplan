import React from 'react';
import { WorkoutSet, MetricProfile } from '@/types/domain';
import { Trash2, Check } from 'lucide-react';
import { RIR_OPTIONS, RPE_OPTIONS } from '@/constants/intensityOptions';
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
  isMobility?: boolean;
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
  isMobility = false,
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
    isMobility,
    isTimeBased,
    onUpdate
  });

  const inputClassName = (hasError?: boolean) => cn(
    "input-base h-12 text-lg font-bold transition-all duration-200",
    "bg-[var(--color-surface)] border-2 border-[var(--color-border-strong)]",
    "focus:border-[var(--color-primary)] focus:ring-4 focus:ring-[var(--color-primary-soft)]",
    !isEditing && "opacity-60 grayscale-[0.5] cursor-not-allowed bg-[var(--color-surface-muted)] border-transparent",
    hasError && "border-[var(--color-danger)] ring-2 ring-[var(--color-danger-soft)]"
  );

  const labelStyle = "mb-1.5 text-[10px] font-black uppercase tracking-[0.1em] text-[var(--color-text-subtle)] text-center";

  const renderCompletionControl = () => (
    <div className="flex justify-end mt-6 pt-4 border-t border-[var(--color-border)]/50">
       <button
        onClick={onToggleComplete}
        className={cn(
          "flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold transition-all duration-300",
          set.completed 
            ? "bg-[var(--color-success)] text-white shadow-lg shadow-[var(--color-success-soft)] scale-[0.98]" 
            : "bg-[var(--color-surface)] text-[var(--color-text-muted)] border-2 border-[var(--color-border-strong)] hover:border-[var(--color-primary)] hover:text-[var(--color-primary-strong)] active:scale-[0.97]"
        )}
        style={{ minHeight: '48px', minWidth: '160px', justifyContent: 'center' }}
      >
        {set.completed ? (
          <>
            <Check size={20} strokeWidth={4} />
            <span className="uppercase tracking-tight text-sm">Log Entry</span>
          </>
        ) : (
          <span className="uppercase tracking-tight text-sm text-[var(--color-text)]">Mark Complete</span>
        )}
      </button>
    </div>
  );

  const renderHeader = () => (
     <div className="flex items-center gap-3 mb-5">
        <div className="w-10 h-10 flex items-center justify-center rounded-xl bg-[var(--color-surface-muted)] font-black text-[var(--color-text)] border border-[var(--color-border)] shadow-inner">
          {set.setNumber}
        </div>
        <div className="flex flex-col">
          <span className="text-[10px] font-black uppercase tracking-[0.15em] text-[var(--color-text-subtle)]">Entry Time</span>
          <span className="text-xs font-bold text-[var(--color-text-muted)]">{timeLabel}</span>
        </div>
        <div className="ml-auto">
           <button
            onClick={onDelete}
            className="p-2.5 rounded-lg text-[var(--color-text-subtle)] transition-all hover:bg-[var(--color-danger-soft)] hover:text-[var(--color-danger)] active:scale-90"
            title="Delete set"
          >
            <Trash2 size={18} />
          </button>
        </div>
      </div>
  );

  if (effectiveProfile === 'mobility_session') {
    return (
      <div className={cn(
        "flex flex-col mb-4 rounded-2xl border-2 p-5 transition-all duration-300",
        set.completed ? "border-[var(--color-success-border)] bg-[var(--color-success-soft)]/30" : "border-[var(--color-border)] bg-[var(--color-surface)] shadow-sm"
      )}>
        {renderHeader()}
        <div className="grid gap-5 grid-cols-1 sm:grid-cols-3">
          <div className="flex flex-col">
            <label className={labelStyle}>Duration (min)</label>
            <NumericInput placeholder="0" value={durationMinutes} onChange={handleDurationChange} mode="numeric" inputClassName={inputClassName()} isEditing={isEditing} />
          </div>
          <div className="flex flex-col">
            <label className={labelStyle}>Effort (1-10)</label>
            <select value={rirValue} onChange={(e) => onUpdate('rpe', e.target.value === '' ? '' : Number(e.target.value))} className={inputClassName()} disabled={!isEditing}>
              <option value="">--</option>
              {Array.from({ length: 10 }, (_, i) => i + 1).map((val) => (
                <option key={val} value={val}>{val}</option>
              ))}
            </select>
          </div>
           <div className="flex flex-col">
             <label className={labelStyle}>Category</label>
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
        </div>
        {renderCompletionControl()}
      </div>
    );
  }

  if (effectiveProfile === 'cardio_session') {
    return (
      <div className={cn(
        "flex flex-col mb-4 rounded-2xl border-2 p-5 transition-all duration-300",
        set.completed ? "border-[var(--color-success-border)] bg-[var(--color-success-soft)]/30" : "border-[var(--color-border)] bg-[var(--color-surface)] shadow-sm"
      )}>
        {renderHeader()}
        <div className="grid gap-5 grid-cols-1 sm:grid-cols-3">
          <div className="flex flex-col">
            <label className={labelStyle}>Duration (min)</label>
            <NumericInput placeholder="0" value={durationMinutes} onChange={handleDurationChange} mode="numeric" inputClassName={inputClassName()} isEditing={isEditing} />
          </div>
          <div className="flex flex-col">
            <label className={labelStyle}>Effort (1-10)</label>
            <select value={rirValue} onChange={(e) => onUpdate('rpe', e.target.value === '' ? '' : Number(e.target.value))} className={inputClassName()} disabled={!isEditing}>
              <option value="">--</option>
              {Array.from({ length: 10 }, (_, i) => i + 1).map((val) => (
                <option key={val} value={val}>{val}</option>
              ))}
            </select>
          </div>
          <div className="flex flex-col">
            <label className={labelStyle}>Distance (km)</label>
             <NumericInput placeholder="0.0" value={(getExtra('distance_km') as string) ?? set.distance ?? ''} onChange={(val) => { validateAndUpdate('distance', val); const num = val === '' ? null : Number(val); if (!isNaN(num as number)) updateExtra('distance_km', num); }} inputClassName={inputClassName()} isEditing={isEditing} />
          </div>
        </div>
        {renderCompletionControl()}
      </div>
    );
  }

  if (effectiveProfile === 'timed_strength') {
    return (
      <div className={cn(
        "flex flex-col mb-4 rounded-2xl border-2 p-5 transition-all duration-300",
        set.completed ? "border-[var(--color-success-border)] bg-[var(--color-success-soft)]/30" : "border-[var(--color-border)] bg-[var(--color-surface)] shadow-sm"
      )}>
        {renderHeader()}
        <div className="grid gap-5 grid-cols-1 sm:grid-cols-2">
          <div className="flex flex-col">
            <label className={labelStyle}>Duration (min)</label>
            <NumericInput placeholder="0" value={durationMinutes} onChange={handleDurationChange} mode="numeric" inputClassName={inputClassName()} isEditing={isEditing} />
          </div>
          <div className="flex flex-col">
            <label className={labelStyle}>Weight ({set.weightUnit ?? 'lb'})</label>
            {weightChoices.length > 0 ? (
              <select value={typeof set.weight === 'number' ? String(set.weight) : ''} onChange={(e) => { const v = e.target.value === '' ? '' : Number(e.target.value); onUpdate('weight', v); const opt = weightChoices.find(c => c.value === v); if (opt?.unit) onUpdate('weightUnit', opt.unit); }} className={inputClassName()} disabled={!isEditing}>
                <option value="">Select weight</option>
                {weightChoices.map(opt => <option key={`${opt.label}-${opt.value}`} value={opt.value}>{opt.label}</option>)}
              </select>
            ) : (
              <NumericInput placeholder="0" value={set.weight ?? ''} onChange={(val) => validateAndUpdate('weight', val)} hasError={weightError} inputClassName={inputClassName(weightError)} isEditing={isEditing} />
            )}
          </div>
          <div className="flex flex-col">
            <label className={labelStyle}>Intensity (RPE)</label>
            <select value={typeof set.rpe === 'number' ? String(set.rpe) : ''} onChange={(e) => onUpdate('rpe', e.target.value === '' ? '' : Number(e.target.value))} className={inputClassName()} disabled={!isEditing}>
              <option value="">--</option>
              {RPE_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label} ({opt.value})</option>)}
            </select>
          </div>
          <div className="flex flex-col">
            <label className={labelStyle}>Reserve (RIR)</label>
            <select value={typeof set.rir === 'number' ? String(set.rir) : ''} onChange={(e) => onUpdate('rir', e.target.value === '' ? '' : Number(e.target.value))} className={inputClassName()} disabled={!isEditing}>
              <option value="">--</option>
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
    <div className={cn(
      "flex flex-col mb-4 rounded-2xl border-2 p-5 transition-all duration-300",
      set.completed ? "border-[var(--color-success-border)] bg-[var(--color-success-soft)]/30" : "border-[var(--color-border)] bg-[var(--color-surface)] shadow-sm"
    )}>
      {renderHeader()}
      <div className="grid gap-5 grid-cols-1 sm:grid-cols-3">
        <div className="flex flex-col">
          <label className={labelStyle}>Weight ({set.weightUnit ?? 'lb'})</label>
          {weightChoices.length > 0 ? (
            <select value={typeof set.weight === 'number' ? String(set.weight) : ''} onChange={(e) => { const v = e.target.value === '' ? '' : Number(e.target.value); onUpdate('weight', v); const opt = weightChoices.find(c => c.value === v); if (opt?.unit) onUpdate('weightUnit', opt.unit); }} className={inputClassName()} disabled={!isEditing}>
              <option value="">--</option>
              {weightChoices.map(opt => <option key={`${opt.label}-${opt.value}`} value={opt.value}>{opt.label}</option>)}
            </select>
          ) : (
            <NumericInput placeholder="0" value={set.weight ?? ''} onChange={(v) => validateAndUpdate('weight', v)} hasError={weightError} inputClassName={inputClassName(weightError)} isEditing={isEditing} />
          )}
        </div>
        <div className="flex flex-col">
          <label className={labelStyle}>{repsLabel}</label>
          <NumericInput placeholder={repsLabel === 'Reps' ? '0' : '--'} value={set.reps ?? ''} onChange={(v) => validateAndUpdate('reps', v)} hasError={repsError} mode={repsLabel === 'Reps' ? 'numeric' : 'decimal'} inputClassName={inputClassName(repsError)} isEditing={isEditing} />
        </div>
        <div className="flex flex-col">
          <label className={labelStyle}>Reserve (RIR)</label>
          <select value={typeof set.rir === 'number' ? String(set.rir) : ''} onChange={(e) => { onUpdate('rir', e.target.value === '' ? '' : Number(e.target.value)); onUpdate('rpe', ''); }} className={inputClassName()} disabled={!isEditing}>
            <option value="">--</option>
            {RIR_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
          </select>
          {derivedRpe && <p className="mt-2 text-[10px] font-bold text-center text-[var(--color-text-subtle)] uppercase tracking-tighter italic">RPE {derivedRpe}{derivedRpeLabel ? ` · ${derivedRpeLabel}` : ''}</p>}
        </div>
      </div>
      {renderCompletionControl()}
    </div>
  );
};