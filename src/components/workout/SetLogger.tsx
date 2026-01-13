import React, { useMemo, useState } from 'react';
import { WorkoutSet } from '@/types/domain';
import { Trash2, CheckCircle, Circle, Pencil } from 'lucide-react';

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

  const inputClassName = `w-full bg-white border border-gray-200 rounded p-1.5 text-center text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none ${
    !isEditing ? 'text-gray-400 bg-gray-50' : ''
  }`;

  return (
    <div className={`flex flex-col gap-2 mb-2 p-3 rounded-md transition-colors ${set.completed ? 'bg-green-50/50 border border-green-100' : 'bg-gray-50'}`}>
      <div className="flex items-center gap-2">
        <div className="w-8 font-bold text-gray-400 text-center">{set.setNumber}</div>
        <div className="text-[10px] text-gray-400 uppercase tracking-wider">{timeLabel}</div>
        <button
          type="button"
          onClick={() => setIsEditing((prev) => !prev)}
          className="ml-auto flex items-center gap-1 rounded-full border border-gray-200 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-gray-500 hover:text-indigo-600"
        >
          <Pencil size={12} />
          Edit
        </button>
      </div>

      <div className="grid grid-cols-4 gap-2">
        <div className="flex flex-col">
          <label className="text-[10px] text-gray-400 uppercase font-bold tracking-wider mb-0.5 text-center">lbs</label>
          <input
            type="number"
            placeholder="0"
            // Ensure value is never undefined to prevent React controlled input warnings
            value={set.weight ?? ''}
            onChange={(e) => onUpdate('weight', e.target.value === '' ? '' : Number(e.target.value))}
            className={inputClassName}
            min={0}
            readOnly={!isEditing}
          />
        </div>
        
        <div className="flex flex-col">
          <label className="text-[10px] text-gray-400 uppercase font-bold tracking-wider mb-0.5 text-center">Reps</label>
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
          <label className="text-[10px] text-gray-400 uppercase font-bold tracking-wider mb-0.5 text-center">RPE</label>
          <input
            type="number"
            placeholder="-"
            max={10}
            value={set.rpe ?? ''}
            onChange={(e) => onUpdate('rpe', e.target.value === '' ? '' : Number(e.target.value))}
            className={inputClassName}
            min={0}
            readOnly={!isEditing}
          />
        </div>

        <div className="flex flex-col">
          <label className="text-[10px] text-gray-400 uppercase font-bold tracking-wider mb-0.5 text-center">RIR</label>
          <input
            type="number"
            placeholder="-"
            max={10}
            value={set.rir ?? ''}
            onChange={(e) => onUpdate('rir', e.target.value === '' ? '' : Number(e.target.value))}
            className={inputClassName}
            min={0}
            readOnly={!isEditing}
          />
        </div>
      </div>

      <div className="flex items-center gap-2">
        <div className="flex-1">
          <label className="text-[10px] text-gray-400 uppercase font-bold tracking-wider mb-0.5 text-left">Notes</label>
          <input
            type="text"
            placeholder="Optional notes"
            value={set.notes ?? ''}
            onChange={(e) => onUpdate('notes', e.target.value)}
            className={`w-full bg-white border border-gray-200 rounded p-1.5 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none ${
              !isEditing ? 'text-gray-400 bg-gray-50' : ''
            }`}
            readOnly={!isEditing}
          />
        </div>
        <button
          onClick={onToggleComplete}
          className={`p-2 rounded-full hover:bg-gray-200 transition-colors ${set.completed ? 'text-green-500' : 'text-gray-300'}`}
        >
          {set.completed ? <CheckCircle size={20} /> : <Circle size={20} />}
        </button>

        <button
          onClick={onDelete}
          className="p-2 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors"
        >
          <Trash2 size={16} />
        </button>
      </div>
    </div>
  );
};
