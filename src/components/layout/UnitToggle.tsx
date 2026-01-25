'use client'

import * as React from 'react'
import { Scale } from 'lucide-react'
import { useUIStore } from '@/store/uiStore'

export function UnitToggle() {
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
      className="p-2 rounded-xl hover:bg-[var(--color-surface-muted)] transition-colors flex items-center justify-center text-muted hover:text-strong"
      aria-label="Toggle unit"
      title={`Switch to ${displayUnit === 'lb' ? 'Kilograms' : 'Pounds'}`}
    >
      <div className="relative h-5 w-5 flex items-center justify-center">
        <Scale className="h-5 w-5 opacity-20" />
        <span className="absolute inset-0 flex items-center justify-center text-[9px] font-bold leading-none uppercase">
          {displayUnit}
        </span>
      </div>
    </button>
  )
}
