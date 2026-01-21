import React, { useEffect, useMemo, useState } from 'react';
import { WorkoutSet } from '@/types/domain';
import { Trash2, CheckCircle, Circle } from 'lucide-react';
import { INTENSITY_RECOMMENDATION, RIR_HELPER_TEXT, RIR_OPTIONS, RPE_OPTIONS } from '@/constants/intensityOptions';
import { PAIN_AREA_OPTIONS, SET_TYPE_OPTIONS } from '@/constants/setOptions';
import type { WeightOption } from '@/lib/equipment';
import { mapRirToRpe } from '@/lib/session-metrics';

interface SetLoggerProps {
  set: WorkoutSet;
  weightOptions?: WeightOption[];
  onUpdate: (field: keyof WorkoutSet, value: WorkoutSet[keyof WorkoutSet]) => void;
  onDelete: () => void;
  onToggleComplete: () => void;
}

export const SetLogger: React.FC<SetLoggerProps> = ({ set, weightOptions, onUpdate, onDelete, onToggleComplete }) => {
  const isEditing = !set.completed;
  const [showDetails, setShowDetails] = useState(false);
  const timeLabel = useMemo(() => {
    if (!set.performedAt) return 'Not logged yet';
    const date = new Date(set.performedAt);
    return Number.isNaN(date.getTime()) ? 'Not logged yet' : date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }, [set.performedAt]);

  const inputClassName = `input-base input-compact text-center ${!isEditing ? 'input-muted' : ''}`;
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
  }, [set.weight, weightOptions]);

  useEffect(() => {
    if (!isEditing) return;
    const isEmptyWeight = set.weight === '' || set.weight === null || typeof set.weight !== 'number';
    if (isEmptyWeight && weightChoices.length > 0) {
      onUpdate('weight', weightChoices[0].value);
      onUpdate('weightUnit', weightChoices[0].unit ?? set.weightUnit ?? 'lb');
    }
  }, [isEditing, onUpdate, set.weight, set.weightUnit, weightChoices]);

  return (
    <div className={`flex flex-col gap-3 mb-2 rounded-xl border p-4 transition-colors ${set.completed ? 'border-[var(--color-primary-border)] bg-[var(--color-primary-soft)]' : 'border-[var(--color-border)] bg-[var(--color-surface)]'}`}>
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
          <label className="mb-1 text-center text-[10px] font-semibold uppercase tracking-wider text-subtle">Reps</label>
          <input
            type="number"
            placeholder="0"
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

      {showDetails && (
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="flex flex-col">
            <label className="mb-1 text-center text-[10px] font-semibold uppercase tracking-wider text-subtle">Set type</label>
            <select
              value={set.setType ?? 'working'}
              onChange={(event) => onUpdate('setType', event.target.value as WorkoutSet['setType'])}
              className={inputClassName}
              disabled={!isEditing}
            >
              {SET_TYPE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col">
            <label className="mb-1 text-center text-[10px] font-semibold uppercase tracking-wider text-subtle">Rest (sec)</label>
            <input
              type="number"
              min={0}
              placeholder="0"
              value={set.restSecondsActual ?? ''}
              onChange={(event) => onUpdate('restSecondsActual', event.target.value === '' ? '' : Number(event.target.value))}
              className={inputClassName}
              readOnly={!isEditing}
            />
          </div>
          <div className="flex items-center justify-center gap-2 pt-5 text-[10px] text-subtle">
            <input
              type="checkbox"
              checked={Boolean(set.failure)}
              onChange={(event) => onUpdate('failure', event.target.checked)}
              className="h-4 w-4 rounded border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-primary)]"
              disabled={!isEditing}
            />
            <span>Reached failure</span>
          </div>
          <div className="flex flex-col sm:col-span-2">
            <label className="mb-1 text-center text-[10px] font-semibold uppercase tracking-wider text-subtle">Pain (0-10)</label>
            <input
              type="number"
              min={0}
              max={10}
              placeholder="0"
              value={set.painScore ?? ''}
              onChange={(event) => onUpdate('painScore', event.target.value === '' ? '' : Number(event.target.value))}
              className={inputClassName}
              readOnly={!isEditing}
            />
          </div>
          <div className="flex flex-col">
            <label className="mb-1 text-center text-[10px] font-semibold uppercase tracking-wider text-subtle">Pain area</label>
            <select
              value={set.painArea ?? ''}
              onChange={(event) => onUpdate('painArea', event.target.value)}
              className={inputClassName}
              disabled={!isEditing}
            >
              <option value="">None</option>
              {PAIN_AREA_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => setShowDetails((prev) => !prev)}
          className="text-[10px] font-semibold uppercase tracking-wider text-subtle"
        >
          {showDetails ? 'Hide details' : 'More details'}
        </button>
        <button
          onClick={onToggleComplete}
          className={`rounded-full p-2 transition-colors ${set.completed ? 'text-[var(--color-primary-strong)] hover:bg-[var(--color-primary-soft)]' : 'text-subtle hover:bg-[var(--color-surface-muted)]'}`}
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
