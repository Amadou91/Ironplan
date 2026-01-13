import React from 'react';
import { WorkoutSet } from '@/types/domain';
import { Trash2, CheckCircle, Circle } from 'lucide-react';

interface SetLoggerProps {
  set: WorkoutSet;
  onUpdate: (field: keyof WorkoutSet, value: string | number | boolean) => void;
  onDelete: () => void;
  onToggleComplete: () => void;
}

export const SetLogger: React.FC<SetLoggerProps> = ({ set, onUpdate, onDelete, onToggleComplete }) => {
  return (
    <div className={`flex items-center gap-2 mb-2 p-2 rounded-md transition-colors ${set.completed ? 'bg-green-50/50 border border-green-100' : 'bg-gray-50'}`}>
      <div className="w-8 font-bold text-gray-400 text-center">{set.setNumber}</div>
      
      <div className="flex-1 grid grid-cols-3 gap-2">
        <div className="flex flex-col">
          <label className="text-[10px] text-gray-400 uppercase font-bold tracking-wider mb-0.5 text-center">lbs</label>
          <input
            type="number"
            placeholder="0"
            // Ensure value is never undefined to prevent React controlled input warnings
            value={set.weight ?? ''}
            onChange={(e) => onUpdate('weight', Number(e.target.value))}
            className="w-full bg-white border border-gray-200 rounded p-1.5 text-center text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
          />
        </div>
        
        <div className="flex flex-col">
          <label className="text-[10px] text-gray-400 uppercase font-bold tracking-wider mb-0.5 text-center">Reps</label>
          <input
            type="number"
            placeholder="0"
            value={set.reps ?? ''}
            onChange={(e) => onUpdate('reps', Number(e.target.value))}
            className="w-full bg-white border border-gray-200 rounded p-1.5 text-center text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
          />
        </div>

        <div className="flex flex-col">
          <label className="text-[10px] text-gray-400 uppercase font-bold tracking-wider mb-0.5 text-center">RPE</label>
          <input
            type="number"
            placeholder="-"
            max={10}
            value={set.rpe ?? ''}
            onChange={(e) => onUpdate('rpe', Number(e.target.value))}
            className="w-full bg-white border border-gray-200 rounded p-1.5 text-center text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
          />
        </div>
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
  );
};