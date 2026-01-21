import React, { useMemo, useState } from 'react';
import { WorkoutSet } from '@/types/domain';
import { Trash2, CheckCircle, Circle, Pencil, ChevronDown } from 'lucide-react';
import { INTENSITY_RECOMMENDATION, RIR_HELPER_TEXT, RIR_OPTIONS, RPE_HELPER_TEXT, RPE_OPTIONS } from '@/constants/intensityOptions';
import { EXTRAS_FIELDS, GROUP_TYPE_OPTIONS, PAIN_AREA_OPTIONS, SET_TYPE_OPTIONS, WEIGHT_UNIT_OPTIONS } from '@/constants/setOptions';

interface SetLoggerProps {
  set: WorkoutSet;
  onUpdate: (field: keyof WorkoutSet, value: WorkoutSet[keyof WorkoutSet]) => void;
  onDelete: () => void;
  onToggleComplete: () => void;
}

export const SetLogger: React.FC<SetLoggerProps> = ({ set, onUpdate, onDelete, onToggleComplete }) => {
  const [isEditing, setIsEditing] = useState(!set.completed);
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);
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
  const setTypeValue = set.setType ?? 'working';
  const weightUnitValue = set.weightUnit ?? 'lb';
  const showEffortInline = setTypeValue === 'working';
  const painScoreValue = typeof set.painScore === 'number' ? set.painScore : 0;
  const extras = set.extras ?? {};

  const renderEffortInputs = (compact?: boolean) => (
    <div className={`grid gap-2 ${compact ? 'grid-cols-1' : 'grid-cols-2'}`}>
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
              {option.label} - {option.description}
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
  );

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

      <div className={`grid gap-2 ${showEffortInline ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-2 sm:grid-cols-3'}`}>
        <div className="flex flex-col">
          <label className="mb-1 text-center text-[10px] font-semibold uppercase tracking-wider text-subtle">Set type</label>
          <select
            value={setTypeValue}
            onChange={(event) => onUpdate('setType', event.target.value)}
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
          <label className="mb-1 text-center text-[10px] font-semibold uppercase tracking-wider text-subtle">Weight</label>
          <div className="flex gap-2">
            <input
              type="number"
              placeholder="0"
              value={set.weight ?? ''}
              onChange={(e) => onUpdate('weight', e.target.value === '' ? '' : Number(e.target.value))}
              className={inputClassName}
              min={0}
              readOnly={!isEditing}
            />
            <select
              value={weightUnitValue}
              onChange={(event) => onUpdate('weightUnit', event.target.value)}
              className={inputClassName}
              disabled={!isEditing}
            >
              {WEIGHT_UNIT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
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

        {showEffortInline && renderEffortInputs(true)}
      </div>
      {showEffortInline ? (
        <p className="text-[10px] text-subtle">{INTENSITY_RECOMMENDATION}</p>
      ) : (
        <p className="text-[10px] text-subtle">Effort inputs are hidden for warmup or accessory sets. Use Advanced to add RPE or RIR.</p>
      )}

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

      <div className="rounded-lg border border-dashed border-[var(--color-border)]">
        <button
          type="button"
          onClick={() => setIsAdvancedOpen((prev) => !prev)}
          className="flex w-full items-center justify-between px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-subtle"
        >
          Advanced
          <ChevronDown size={14} className={`transition-transform ${isAdvancedOpen ? 'rotate-180' : ''}`} />
        </button>
        {isAdvancedOpen && (
          <div className="space-y-3 border-t border-[var(--color-border)] px-3 pb-3 pt-3">
            {!showEffortInline && renderEffortInputs(false)}

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <div className="flex flex-col">
                <label className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-subtle">Rest seconds</label>
                <input
                  type="number"
                  min={0}
                  value={set.restSecondsActual ?? ''}
                  onChange={(event) => onUpdate('restSecondsActual', event.target.value === '' ? '' : Number(event.target.value))}
                  className={inputClassName}
                  readOnly={!isEditing}
                />
              </div>
              <div className="flex items-center gap-2 pt-5 text-xs text-muted">
                <input
                  type="checkbox"
                  checked={Boolean(set.failure)}
                  onChange={(event) => onUpdate('failure', event.target.checked)}
                  className="h-4 w-4 rounded border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-primary)]"
                  disabled={!isEditing}
                />
                <span>Reached failure</span>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <div className="flex flex-col">
                <label className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-subtle">Tempo</label>
                <input
                  type="text"
                  value={set.tempo ?? ''}
                  onChange={(event) => onUpdate('tempo', event.target.value)}
                  className={inputClassName}
                  readOnly={!isEditing}
                />
              </div>
              <div className="flex flex-col">
                <label className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-subtle">ROM cue</label>
                <input
                  type="text"
                  value={set.romCue ?? ''}
                  onChange={(event) => onUpdate('romCue', event.target.value)}
                  className={inputClassName}
                  readOnly={!isEditing}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <div className="flex flex-col">
                <label className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-subtle">Pain score</label>
                <input
                  type="range"
                  min={0}
                  max={10}
                  value={painScoreValue}
                  onChange={(event) => onUpdate('painScore', Number(event.target.value))}
                  disabled={!isEditing}
                />
                <div className="text-[10px] text-subtle">Score: {painScoreValue}</div>
              </div>
              <div className="flex flex-col">
                <label className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-subtle">Pain area</label>
                <select
                  value={typeof set.painArea === 'string' ? set.painArea : ''}
                  onChange={(event) => onUpdate('painArea', event.target.value)}
                  className={inputClassName}
                  disabled={!isEditing || painScoreValue === 0}
                >
                  <option value="">Select area</option>
                  {PAIN_AREA_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <div className="flex flex-col">
                <label className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-subtle">Group type</label>
                <select
                  value={typeof set.groupType === 'string' ? set.groupType : ''}
                  onChange={(event) => onUpdate('groupType', event.target.value)}
                  className={inputClassName}
                  disabled={!isEditing}
                >
                  <option value="">None</option>
                  {GROUP_TYPE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col">
                <label className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-subtle">Group ID</label>
                <input
                  type="text"
                  value={typeof set.groupId === 'string' ? set.groupId : ''}
                  onChange={(event) => onUpdate('groupId', event.target.value)}
                  className={inputClassName}
                  readOnly={!isEditing}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {EXTRAS_FIELDS.map((field) => (
                <div key={field.key} className="flex flex-col">
                  <label className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-subtle">{field.label}</label>
                  <input
                    type="text"
                    value={extras[field.key] ?? ''}
                    onChange={(event) => onUpdate('extras', { ...extras, [field.key]: event.target.value })}
                    className={inputClassName}
                    readOnly={!isEditing}
                  />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
