'use client'

import * as React from 'react'
import { Scale } from 'lucide-react'
import { useUIStore } from '@/store/uiStore'

interface UnitToggleProps {
  compact?: boolean
}

export function UnitToggle({ compact = false }: UnitToggleProps) {
  const { displayUnit, toggleDisplayUnit } = useUIStore()
  const [mounted, setMounted] = React.useState(false)

  // Avoid hydration mismatch by only rendering after mount
  React.useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return (
      <button type="button" className="p-2 rounded-xl hover:bg-[var(--color-surface-muted)] transition-colors" aria-label="Toggle unit">
        <div className="w-5 h-5" />
      </button>
    )
  }

  return (
    <button
      type="button"
      onClick={toggleDisplayUnit}
      className={`rounded-xl hover:bg-[var(--color-surface-muted)] transition-colors flex items-center justify-center text-muted hover:text-strong ${
        compact ? 'p-1.5 h-8 w-8' : 'p-2'
      }`}
      aria-label="Toggle unit"
      title={`Switch to ${displayUnit === 'lb' ? 'Kilograms' : 'Pounds'}`}
    >
      <div className={`relative flex items-center justify-center ${compact ? 'h-4 w-4' : 'h-5 w-5'}`}>
        <Scale className={`opacity-20 ${compact ? 'h-4 w-4' : 'h-5 w-5'}`} />
        <span className={`absolute inset-0 flex items-center justify-center font-bold leading-none uppercase ${
          compact ? 'text-[8px]' : 'text-[9px]'
        }`}>
          {displayUnit}
        </span>
      </div>
    </button>
  )
}
