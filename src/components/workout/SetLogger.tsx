import React, { useMemo, useState } from 'react';
import { WorkoutSet } from '@/types/domain';
import { Trash2, CheckCircle, Circle, Pencil } from 'lucide-react';
import { INTENSITY_RECOMMENDATION, RIR_HELPER_TEXT, RIR_OPTIONS, RPE_HELPER_TEXT, RPE_OPTIONS } from '@/constants/intensityOptions';

interface SetLoggerProps {
  set: WorkoutSet;
  onUpdate: (field: keyof WorkoutSet, value: string | number | boolean) => void;
  onDelete: () => void;
  onToggleComplete: () => void;
}

export const SetLogger: React.FC<SetLoggerProps> = ({ set, onUpdate, onDelete, onToggleComplete }) => {
  const [isEditing, setIsEditing] = useState(!set.completed);
  const timeLabel = useMemo(() => {
    if (!set.performedAt) return 'Not logged yet';
    const date = new Date(set.performedAt);
    return Number.isNaN(date.getTime()) ? 'Not logged yet' : date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }, [set.performedAt]);

  const inputClassName = `input-base input-compact text-center ${!isEditing ? 'input-muted' : ''}`;
  const rpeValue = typeof set.rpe === 'number' ? String(set.rpe) : '';
  const rirValue = typeof set.rir === 'number' ? String(set.rir) : '';
  const isRpeSelected = typeof set.rpe === 'number';
  const isRirSelected = typeof set.rir === 'number';
  const rpeEquivalence = RPE_OPTIONS.find((option) => option.value === set.rpe)?.equivalence;
  const rirEquivalence = RIR_OPTIONS.find((option) => option.value === set.rir)?.equivalence;

  return (
    <div className={`flex flex-col gap-3 mb-2 rounded-xl border p-4 transition-colors ${set.completed ? 'border-[var(--color-primary-border)] bg-[var(--color-primary-soft)]' : 'border-[var(--color-border)] bg-[var(--color-surface)]'}`}>
      <div className="flex items-center gap-2">
        <div className="w-8 text-center font-semibold text-muted">{set.setNumber}</div>
        <div className="text-[10px] uppercase tracking-wider text-subtle">{timeLabel}</div>
        <button
          type="button"
          onClick={() => setIsEditing((prev) => !prev)}
          className="ml-auto flex items-center gap-1 rounded-full border border-[var(--color-border)] px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-subtle transition-colors hover:text-accent"
        >
          <Pencil size={12} />
          Edit
        </button>
      </div>

      <div className="grid grid-cols-4 gap-2">
        <div className="flex flex-col">
          <label className="mb-1 text-center text-[10px] font-semibold uppercase tracking-wider text-subtle">lbs</label>
          <input
            type="number"
            placeholder="0"
            value={set.weight ?? ''}
            onChange={(e) => onUpdate('weight', e.target.value === '' ? '' : Number(e.target.value))}
            className={inputClassName}
            min={0}
            readOnly={!isEditing}
          />
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
          <label className="mb-1 text-center text-[10px] font-semibold uppercase tracking-wider text-subtle">RPE</label>
          <select
            value={rpeValue}
            onChange={(event) => {
              const nextValue = event.target.value === '' ? '' : Number(event.target.value);
              onUpdate('rpe', nextValue);
              if (event.target.value !== '') {
                onUpdate('rir', '');
              }
            }}
            className={inputClassName}
            disabled={!isEditing || isRirSelected}
          >
            <option value="">Select effort</option>
            {RPE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label} — {option.description}
              </option>
            ))}
          </select>
          <p className="mt-1 text-[10px] text-subtle">{RPE_HELPER_TEXT}</p>
          {rpeEquivalence ? <p className="text-[10px] text-accent">{rpeEquivalence}</p> : null}
        </div>

        <div className="flex flex-col">
          <label className="mb-1 text-center text-[10px] font-semibold uppercase tracking-wider text-subtle">RIR</label>
          <select
            value={rirValue}
            onChange={(event) => {
              const nextValue = event.target.value === '' ? '' : Number(event.target.value);
              onUpdate('rir', nextValue);
              if (event.target.value !== '') {
                onUpdate('rpe', '');
              }
            }}
            className={inputClassName}
            disabled={!isEditing || isRpeSelected}
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
        </div>
      </div>
      <p className="text-[10px] text-subtle">{INTENSITY_RECOMMENDATION}</p>

      <div className="flex items-center gap-2">
        <div className="flex-1">
          <label className="mb-1 text-left text-[10px] font-semibold uppercase tracking-wider text-subtle">Notes</label>
          <input
            type="text"
            placeholder="Optional notes"
            value={set.notes ?? ''}
            onChange={(e) => onUpdate('notes', e.target.value)}
            className={`input-base input-compact ${!isEditing ? 'input-muted' : ''}`}
            readOnly={!isEditing}
          />
        </div>
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
