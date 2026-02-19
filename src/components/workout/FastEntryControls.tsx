'use client'

import React, { useRef, useState } from 'react'
import { Minus, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { RIR_OPTIONS } from '@/constants/intensityOptions'

// Common styles
const BTN_BASE = 'flex min-h-12 min-w-12 items-center justify-center rounded-md transition-all active:scale-95 disabled:pointer-events-none disabled:opacity-50'
const INPUT_BASE = "h-full w-full bg-transparent text-center font-bold font-mono text-lg text-[var(--color-text)] outline-none placeholder:text-[var(--color-text-muted)] disabled:opacity-50"
const CONTROL_CONTAINER = 'flex h-12 items-center overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-sm focus-within:border-[var(--color-primary)] focus-within:ring-2 focus-within:ring-[var(--color-primary)]/20'

// --- Fast Reps Input ---

interface FastRepsInputProps {
  value: number | string | null
  onChange: (val: string) => void
  disabled?: boolean
  className?: string
  placeholder?: string
}

export function FastRepsInput({ value, onChange, disabled, className, placeholder = '0' }: FastRepsInputProps) {
  const inputRef = useRef<HTMLInputElement>(null)

  const handleAdjust = (delta: number) => {
    if (disabled) return
    const current = typeof value === 'number' ? value : Number(value) || 0
    const next = Math.max(0, current + delta)
    onChange(String(next))
  }

  return (
    <div className={cn(CONTROL_CONTAINER, 'w-32', className)}>
      <button
        type="button"
        onClick={() => handleAdjust(-1)}
        disabled={disabled || (Number(value) || 0) <= 0}
        className={cn(BTN_BASE, 'h-full w-11 text-[var(--color-text-subtle)] hover:bg-[var(--color-surface-muted)] hover:text-[var(--color-danger)]')}
        tabIndex={-1}
        aria-label="Decrease reps"
      >
        <Minus size={14} strokeWidth={3} />
      </button>

      <div className="flex-1 h-full relative border-x border-[var(--color-border)]/50">
        <input
          ref={inputRef}
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value)}
          onFocus={(e) => e.target.select()}
          enterKeyHint="next"
          autoComplete="off"
          placeholder={placeholder}
          disabled={disabled}
          className={cn(INPUT_BASE, "text-sm")}
        />
      </div>

      <button
        type="button"
        onClick={() => handleAdjust(1)}
        disabled={disabled}
        className={cn(BTN_BASE, 'h-full w-11 text-[var(--color-text-subtle)] hover:bg-[var(--color-surface-muted)] hover:text-[var(--color-success)]')}
        tabIndex={-1}
        aria-label="Increase reps"
      >
        <Plus size={14} strokeWidth={3} />
      </button>
    </div>
  )
}

// --- Fast RIR Input ---

interface FastRirInputProps {
  value: number | string | null
  onChange: (val: number) => void
  disabled?: boolean
  className?: string
}

export function FastRirInput({ value, onChange, disabled, className }: FastRirInputProps) {
  const options = RIR_OPTIONS.map(o => o.value) // [0, 1, 2, 3, 4]

  return (
    <div className={cn('flex h-11 w-full overflow-hidden rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] shadow-sm', className)}>
      {options.map((opt) => {
        const isSelected = value != null && value !== '' && Number(value) === opt
        const label = opt === 4 ? '4+' : String(opt)
        
        return (
          <button
            key={opt}
            type="button"
            onClick={() => !disabled && onChange(opt)}
            disabled={disabled}
            className={cn(
              "flex-1 text-xs font-semibold transition-colors first:border-l-0 border-l border-[var(--color-border)]/50",
              isSelected 
                ? "bg-[var(--color-primary)] text-white" 
                : "text-[var(--color-text-subtle)] hover:bg-[var(--color-surface-muted)] hover:text-[var(--color-text)]",
              disabled && "opacity-50 cursor-not-allowed"
            )}
          >
            {label}
          </button>
        )
      })}
    </div>
  )
}

// --- Fast Rest Input ---

interface FastRestInputProps {
  value: number | string | null // Value in minutes (can be float, e.g. 1.5 for 1m 30s)
  onChange: (val: string) => void // Updates with stringified minutes
  disabled?: boolean
  className?: string
}

export function FastRestInput({ value, onChange, disabled, className }: FastRestInputProps) {
  const [displayValue, setDisplayValue] = useState('')
  const [isFocused, setIsFocused] = useState(false)

  // Format minutes to m:ss or standard number
  const formatTime = (mins: number | string | null) => {
    if (mins === null || mins === '' || isNaN(Number(mins))) return ''
    const totalSeconds = Math.round(Number(mins) * 60)
    const m = Math.floor(totalSeconds / 60)
    const s = totalSeconds % 60
    return `${m}:${s.toString().padStart(2, '0')}`
  }

  const handleAdjust = (deltaMinutes: number) => {
    if (disabled) return
    const current = Number(value) || 0
    // Adjust by delta, round to nearest 15s (0.25m) to avoid floating point drift
    let next = current + deltaMinutes
    if (next < 0) next = 0
    // Round to 2 decimals
    next = Math.round(next * 100) / 100
    onChange(String(next))
  }

  const handleBlur = () => {
    setIsFocused(false)
    // Parse user input
    let parsed = 0
    const clean = displayValue.trim()
    
    if (clean.includes(':')) {
      // Parse m:ss
      const parts = clean.split(':')
      const m = parseInt(parts[0] || '0', 10)
      const s = parseInt(parts[1] || '0', 10)
      parsed = m + s / 60
    } else if (/^\d+s$/i.test(clean)) {
      // Parse seconds shorthand (e.g., 90s)
      parsed = parseInt(clean.slice(0, -1), 10) / 60
    } else if (/^\d+(\.\d+)?m$/i.test(clean)) {
      // Parse minutes shorthand (e.g., 1.5m)
      parsed = parseFloat(clean.slice(0, -1))
    } else if (/^\d+$/.test(clean) && Number(clean) >= 15) {
      // Heuristic: integer >= 15 likely entered as seconds during workouts
      parsed = Number(clean) / 60
    } else {
      // Parse raw number (treat as minutes if < 10, else seconds? Standard is minutes based on hook)
      // Actually current app treats input as minutes.
      // But user might type "90" meaning seconds?
      // Let's stick to standard behavior: Input is minutes.
      parsed = parseFloat(clean)
    }

    if (!isNaN(parsed) && parsed >= 0) {
      onChange(String(parsed))
    } else if (clean === '') {
      onChange('')
    } else {
      // Revert if invalid
      setDisplayValue(formatTime(value))
    }
  }

  return (
    <div className={cn(CONTROL_CONTAINER, 'w-32', className)}>
      <button
        type="button"
        onClick={() => handleAdjust(-0.25)} // -15s
        disabled={disabled || (Number(value) || 0) <= 0}
        className={cn(BTN_BASE, 'h-full w-11 text-[var(--color-text-subtle)] hover:bg-[var(--color-surface-muted)] hover:text-[var(--color-danger)]')}
        tabIndex={-1}
        aria-label="Decrease rest"
      >
        <Minus size={14} strokeWidth={3} />
      </button>

      <div className="flex-1 h-full relative border-x border-[var(--color-border)]/50 bg-[var(--color-surface-muted)]/10">
        <input
          type="text"
          inputMode="decimal"
          value={isFocused ? displayValue : (value ? formatTime(value) : '')}
          onChange={(e) => setDisplayValue(e.target.value)}
          onFocus={() => { setIsFocused(true); setDisplayValue(String(value ?? '')) }}
          onBlur={handleBlur}
          enterKeyHint="done"
          autoComplete="off"
          placeholder="0:00"
          disabled={disabled}
          className={cn(INPUT_BASE, "text-sm tracking-tight")}
        />
      </div>

      <button
        type="button"
        onClick={() => handleAdjust(0.25)} // +15s
        disabled={disabled}
        className={cn(BTN_BASE, 'h-full w-11 text-[var(--color-text-subtle)] hover:bg-[var(--color-surface-muted)] hover:text-[var(--color-success)]')}
        tabIndex={-1}
        aria-label="Increase rest"
      >
        <Plus size={14} strokeWidth={3} />
      </button>
    </div>
  )
}
