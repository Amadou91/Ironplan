import React, { useMemo, useState, memo } from 'react';
import { WorkoutSet, MetricProfile } from '@/types/domain';
import { Trash2, Check } from 'lucide-react';
import { RIR_OPTIONS, RPE_OPTIONS } from '@/constants/intensityOptions';
import type { WeightOption } from '@/lib/equipment';
import { mapRirToRpe, formatTotalWeightLabel } from '@/lib/session-metrics';
import { useSetEditor } from '@/hooks/useSetEditor';
import { cn } from '@/lib/utils';

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
  isDumbbell?: boolean;
}

const NumericInput = memo(function NumericInput({ 
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
}) {
  return (
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
});

/**
 * SetLogger component for logging individual workout sets.
 * Memoized to prevent unnecessary re-renders when parent state changes.
 */
const SetLoggerComponent: React.FC<SetLoggerProps> = ({
  set,
  weightOptions,
  onUpdate,
  onDelete,
  onToggleComplete,
  metricProfile,
  isCardio = false,
  isMobility = false,
  isTimeBased = false,
  repsLabel = 'Reps',
  isDumbbell = false
}) => {
  const [implementError, setImplementError] = useState(false);
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
    restMinutes,
    handleRestChange
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
  const totalLabelStyle = "text-[10px] font-black uppercase tracking-[0.2em] text-[var(--color-text-subtle)]";
  const totalValueStyle = "text-sm font-black text-[var(--color-text)]";
  const unitLabel = set.weightUnit ?? 'lb';
  const hasImplementCount = typeof set.implementCount === 'number' && (set.implementCount === 1 || set.implementCount === 2);
  
  // Determine the equipment kind of the currently selected weight
  const selectedEquipmentKind = useMemo(() => {
    if (typeof set.weight !== 'number' || !weightOptions) return null;
    const match = weightOptions.find(opt => opt.value === set.weight);
    return match?.equipmentKind ?? null;
  }, [set.weight, weightOptions]);
  
  // Show dumbbell toggle only when dumbbell weight is selected (not just when exercise can use dumbbells)
  const showDumbbellToggle = selectedEquipmentKind === 'dumbbell' || (isDumbbell && hasImplementCount && !selectedEquipmentKind);
  
  const effectiveLoadType = set.loadType === 'per_implement'
    ? 'per_implement'
    : (showDumbbellToggle && hasImplementCount ? 'per_implement' : 'total');
  const totalWeightLabel = useMemo(() => {
    if (typeof set.weight !== 'number' || !Number.isFinite(set.weight)) return null;
    return formatTotalWeightLabel({
      weight: set.weight,
      weightUnit: unitLabel,
      displayUnit: unitLabel,
      loadType: effectiveLoadType,
      implementCount: hasImplementCount ? set.implementCount as number : null
    });
  }, [set.weight, unitLabel, effectiveLoadType, hasImplementCount, set.implementCount]);
  const handleToggleComplete = () => {
    // Only require implement count selection when dumbbell is actually selected
    if (showDumbbellToggle && !hasImplementCount) {
      setImplementError(true);
      return;
    }
    setImplementError(false);
    onToggleComplete();
  };

  const renderCompletionControl = () => (
    <div className="flex justify-end mt-6 pt-4 border-t border-[var(--color-border)]/50">
       <button
        onClick={handleToggleComplete}
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
            <label className={labelStyle}>Intensity</label>
            <select value={set.rpe ?? ''} onChange={(e) => onUpdate('rpe', e.target.value === '' ? '' : Number(e.target.value))} className={inputClassName()} disabled={!isEditing}>
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
            <label className={labelStyle}>Intensity</label>
            <select value={set.rpe ?? ''} onChange={(e) => onUpdate('rpe', e.target.value === '' ? '' : Number(e.target.value))} className={inputClassName()} disabled={!isEditing}>
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
        {showDumbbellToggle && (
          <div className="mb-5">
            <label className={labelStyle}>Dumbbells</label>
            <div className={cn(
              "grid grid-cols-2 rounded-xl border-2 p-1 transition-all",
              implementError ? "border-[var(--color-danger)] bg-[var(--color-danger-soft)]/40" : "border-[var(--color-border-strong)] bg-[var(--color-surface-muted)]"
            )}>
              {[1, 2].map((count) => (
                <button
                  key={count}
                  type="button"
                  onClick={() => { onUpdate('implementCount', count as 1 | 2); onUpdate('loadType', 'per_implement'); setImplementError(false); }}
                  className={cn(
                    "h-10 rounded-lg text-xs font-black uppercase tracking-widest transition-all",
                    hasImplementCount && set.implementCount === count
                      ? "bg-[var(--color-primary)] text-white shadow-sm"
                      : "text-[var(--color-text-subtle)] hover:text-[var(--color-primary-strong)]"
                  )}
                  disabled={!isEditing}
                >
                  {count} DB
                </button>
              ))}
            </div>
            {implementError && (
              <p className="mt-2 text-[10px] font-bold text-center text-[var(--color-danger)] uppercase tracking-widest">Select 1 or 2</p>
            )}
          </div>
        )}
        <div className="grid gap-5 grid-cols-1 sm:grid-cols-2">
          <div className="flex flex-col">
            <label className={labelStyle}>Duration (min)</label>
            <NumericInput placeholder="0" value={durationMinutes} onChange={handleDurationChange} mode="numeric" inputClassName={inputClassName()} isEditing={isEditing} />
          </div>
          <div className="flex flex-col">
            <label className={labelStyle}>
              {effectiveLoadType === 'per_implement' ? `Weight / DB (${unitLabel})` : `Weight (${unitLabel})`}
            </label>
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
          <div className="flex flex-col">
            <label className={labelStyle}>Rest (min)</label>
            <NumericInput placeholder="0" value={restMinutes} onChange={handleRestChange} mode="numeric" inputClassName={inputClassName()} isEditing={isEditing} />
          </div>
        </div>
        <div className="mt-5 flex items-center justify-between rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-muted)]/40 px-4 py-3">
          <span className={totalLabelStyle}>Total Weight</span>
          <span className={totalValueStyle}>{totalWeightLabel ?? '—'}</span>
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
      <div className={cn("grid gap-5 grid-cols-1", showDumbbellToggle ? "sm:grid-cols-5" : "sm:grid-cols-4")}>
        {showDumbbellToggle && (
          <div className="flex flex-col">
            <label className={labelStyle}>Dumbbells</label>
            <div className={cn(
              "grid grid-cols-2 rounded-xl border-2 p-1 transition-all",
              implementError ? "border-[var(--color-danger)] bg-[var(--color-danger-soft)]/40" : "border-[var(--color-border-strong)] bg-[var(--color-surface-muted)]"
            )}>
              {[1, 2].map((count) => (
                <button
                  key={count}
                  type="button"
                  onClick={() => { onUpdate('implementCount', count as 1 | 2); onUpdate('loadType', 'per_implement'); setImplementError(false); }}
                  className={cn(
                    "h-10 rounded-lg text-xs font-black uppercase tracking-widest transition-all",
                    hasImplementCount && set.implementCount === count
                      ? "bg-[var(--color-primary)] text-white shadow-sm"
                      : "text-[var(--color-text-subtle)] hover:text-[var(--color-primary-strong)]"
                  )}
                  disabled={!isEditing}
                >
                  {count} DB
                </button>
              ))}
            </div>
            {implementError && (
              <p className="mt-2 text-[10px] font-bold text-center text-[var(--color-danger)] uppercase tracking-widest">Select 1 or 2</p>
            )}
          </div>
        )}
        <div className="flex flex-col">
          <label className={labelStyle}>
            {effectiveLoadType === 'per_implement' ? `Weight / DB (${unitLabel})` : `Weight (${unitLabel})`}
          </label>
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
        <div className="flex flex-col">
          <label className={labelStyle}>Rest (min)</label>
          <NumericInput placeholder="0" value={restMinutes} onChange={handleRestChange} mode="numeric" inputClassName={inputClassName()} isEditing={isEditing} />
        </div>
      </div>
    </div>
  );
};

// Export memoized component to prevent unnecessary re-renders
export const SetLogger = memo(SetLoggerComponent);
