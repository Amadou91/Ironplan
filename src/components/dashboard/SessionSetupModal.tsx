'use client'

import React, { useState } from 'react'
import { Clock, Dumbbell, Scale, X, Play } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import type { Goal } from '@/types/domain'

interface SessionSetupModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: (data: { minutes: number; style: Goal; bodyWeight?: number }) => void
  initialCategory?: string
}

const TRAINING_STYLES: { label: string; value: Goal }[] = [
  { label: 'Strength', value: 'strength' },
  { label: 'Hypertrophy', value: 'hypertrophy' },
  { label: 'Endurance', value: 'endurance' },
  { label: 'Mobility', value: 'range_of_motion' }
]

export function SessionSetupModal({ isOpen, onClose, onConfirm, initialCategory }: SessionSetupModalProps) {
  const [minutes, setMinutes] = useState(45)
  const [style, setStyle] = useState<Goal>('hypertrophy')
  const [bodyWeight, setBodyWeight] = useState<string>('')

  if (!isOpen) return null

  const handleConfirm = () => {
    onConfirm({
      minutes,
      style,
      bodyWeight: bodyWeight ? parseFloat(bodyWeight) : undefined
    })
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="w-full max-w-lg bg-[var(--color-surface)] rounded-3xl shadow-2xl border border-[var(--color-border-strong)] overflow-hidden animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative p-8 border-b border-[var(--color-border)] bg-[var(--color-surface-subtle)]">
          <button 
            onClick={onClose}
            className="absolute top-6 right-6 p-2 text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-muted)] rounded-xl transition-all"
          >
            <X className="w-5 h-5" />
          </button>
          
          <div className="flex items-center gap-4">
            <div className="p-3 bg-[var(--color-primary-soft)] text-[var(--color-primary)] rounded-2xl shadow-sm">
              <Dumbbell className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-2xl font-black text-strong uppercase tracking-tight">Configure Session</h2>
              <p className="text-sm text-muted font-medium">Ready for {initialCategory || 'your workout'}?</p>
            </div>
          </div>
        </div>

        <div className="p-8 space-y-8">
          {/* Time Selection */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label className="flex items-center gap-2 text-[var(--color-text-subtle)] uppercase text-[11px] font-black tracking-widest">
                <Clock className="w-4 h-4" /> Time Available
              </Label>
              <span className="text-lg font-black text-[var(--color-primary)]">{minutes} min</span>
            </div>
            <input 
              type="range" 
              min={20} 
              max={120} 
              step={5} 
              value={minutes} 
              onChange={(e) => setMinutes(Number(e.target.value))}
              className="w-full h-2 bg-[var(--color-surface-muted)] rounded-lg appearance-none cursor-pointer accent-[var(--color-primary)]"
            />
            <div className="flex justify-between gap-2">
              {[30, 45, 60, 90].map((v) => (
                <button
                  key={v}
                  onClick={() => setMinutes(v)}
                  className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all border-2 ${
                    minutes === v 
                      ? 'bg-[var(--color-primary-soft)] border-[var(--color-primary-border)] text-[var(--color-primary-strong)]' 
                      : 'bg-transparent border-[var(--color-border)] text-[var(--color-text-muted)] hover:bg-[var(--color-surface-muted)]'
                  }`}
                >
                  {v}m
                </button>
              ))}
            </div>
          </div>

          {/* Training Style */}
          <div className="space-y-4">
            <Label className="flex items-center gap-2 text-[var(--color-text-subtle)] uppercase text-[11px] font-black tracking-widest">
              <Dumbbell className="w-4 h-4" /> Training Style
            </Label>
            <div className="grid grid-cols-2 gap-3">
              {TRAINING_STYLES.map((s) => (
                <button
                  key={s.value}
                  onClick={() => setStyle(s.value)}
                  className={`py-4 px-5 rounded-2xl text-sm font-bold transition-all border-2 text-left flex flex-col gap-1 ${
                    style === s.value 
                      ? 'bg-[var(--color-primary-soft)] border-[var(--color-primary-border)] text-[var(--color-primary-strong)] shadow-sm' 
                      : 'bg-transparent border-[var(--color-border)] text-[var(--color-text-muted)] hover:bg-[var(--color-surface-muted)]'
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* Body Weight */}
          <div className="space-y-4">
            <Label className="flex items-center gap-2 text-[var(--color-text-subtle)] uppercase text-[11px] font-black tracking-widest">
              <Scale className="w-4 h-4" /> Current Weight (Optional)
            </Label>
            <div className="relative">
              <Input 
                type="number" 
                placeholder="e.g. 185" 
                value={bodyWeight}
                onChange={(e) => setBodyWeight(e.target.value)}
                className="pl-5 pr-12 h-14 font-bold text-lg rounded-2xl"
              />
              <span className="absolute right-5 top-1/2 -translate-y-1/2 text-sm font-bold text-[var(--color-text-muted)]">lb</span>
            </div>
          </div>
        </div>

        <div className="p-8 bg-[var(--color-surface-subtle)] border-t border-[var(--color-border)] flex gap-4">
          <Button 
            variant="ghost" 
            onClick={onClose}
            className="flex-1 h-14 rounded-2xl font-bold text-[var(--color-text-muted)]"
          >
            Cancel
          </Button>
          <Button 
            onClick={handleConfirm}
            className="flex-[2] h-14 rounded-2xl font-black uppercase tracking-wider shadow-xl shadow-[var(--color-primary-soft)]"
          >
            <Play className="w-5 h-5 mr-2 fill-current" />
            Start Session
          </Button>
        </div>
      </div>
    </div>
  )
}
