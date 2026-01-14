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
    <div className={`flex flex-col gap-3 mb-2 p-4 rounded-xl border transition-colors ${set.completed ? 'border-emerald-500/20 bg-emerald-500/10' : 'border-slate-800 bg-slate-950/60'}`}>
      <div className="flex items-center gap-2">
        <div className="w-8 font-semibold text-slate-400 text-center">{set.setNumber}</div>
        <div className="text-[10px] text-slate-500 uppercase tracking-wider">{timeLabel}</div>
        <button
          type="button"
          onClick={() => setIsEditing((prev) => !prev)}
          className="ml-auto flex items-center gap-1 rounded-full border border-slate-700 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400 hover:text-indigo-300"
        >
          <Pencil size={12} />
          Edit
        </button>
      </div>

      <div className="grid grid-cols-4 gap-2">
        <div className="flex flex-col">
          <label className="text-[10px] text-slate-500 uppercase font-semibold tracking-wider mb-1 text-center">lbs</label>
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
          <label className="text-[10px] text-slate-500 uppercase font-semibold tracking-wider mb-1 text-center">Reps</label>
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
          <label className="text-[10px] text-slate-500 uppercase font-semibold tracking-wider mb-1 text-center">RPE</label>
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
          <p className="mt-1 text-[10px] text-slate-500">{RPE_HELPER_TEXT}</p>
          {rpeEquivalence ? <p className="text-[10px] text-indigo-300/80">{rpeEquivalence}</p> : null}
        </div>

        <div className="flex flex-col">
          <label className="text-[10px] text-slate-500 uppercase font-semibold tracking-wider mb-1 text-center">RIR</label>
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
          <p className="mt-1 text-[10px] text-slate-500">{RIR_HELPER_TEXT}</p>
          {rirEquivalence ? <p className="text-[10px] text-indigo-300/80">{rirEquivalence}</p> : null}
        </div>
      </div>
      <p className="text-[10px] text-slate-500">{INTENSITY_RECOMMENDATION}</p>

      <div className="flex items-center gap-2">
        <div className="flex-1">
          <label className="text-[10px] text-slate-500 uppercase font-semibold tracking-wider mb-1 text-left">Notes</label>
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
          className={`p-2 rounded-full transition-colors ${set.completed ? 'text-emerald-400 hover:bg-emerald-500/10' : 'text-slate-500 hover:bg-slate-800'}`}
        >
          {set.completed ? <CheckCircle size={20} /> : <Circle size={20} />}
        </button>

        <button
          onClick={onDelete}
          className="p-2 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-full transition-colors"
        >
          <Trash2 size={16} />
        </button>
      </div>
    </div>
  );
};
