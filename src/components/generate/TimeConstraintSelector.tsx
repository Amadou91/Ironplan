'use client'

interface TimeConstraintSelectorProps {
  value: number
  onChange: (value: number) => void
}

export function TimeConstraintSelector({ value, onChange }: TimeConstraintSelectorProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-strong">Workout Duration</label>
        <span className="text-sm font-semibold text-accent">{value} min</span>
      </div>
      <input
        type="range"
        min="15"
        max="120"
        step="5"
        value={value}
        onChange={(e) => onChange(parseInt(e.target.value))}
        className="w-full h-2 bg-[var(--color-border)] rounded-lg appearance-none cursor-pointer accent-accent"
      />
      <div className="flex justify-between text-xs text-muted">
        <span>15 min</span>
        <span>120 min</span>
      </div>
    </div>
  )
}
