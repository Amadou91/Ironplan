'use client'

import { useEffect, useState } from 'react'
import { ArrowRight, Brain, Zap, Battery, CalendarClock, Layers, X, Dumbbell } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { toMuscleLabel } from '@/lib/muscle-utils'
import type { WorkoutSuggestion } from '@/lib/suggestion-logic'

interface SuggestionModalProps {
  isOpen: boolean
  onClose: () => void
  suggestion: WorkoutSuggestion | null
  onConfirm: (suggestion: WorkoutSuggestion) => void
  onCustomize: () => void
}

export function SuggestionModal({ 
  isOpen, 
  onClose, 
  suggestion, 
  onConfirm,
  onCustomize
}: SuggestionModalProps) {
  const [show, setShow] = useState(isOpen)

  useEffect(() => {
    setShow(isOpen)
  }, [isOpen])

  if (!show || !suggestion) return null

  const Icon = suggestion.intensity === 'low' ? Battery : suggestion.intensity === 'high' ? Zap : Layers

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="w-full max-w-md bg-[var(--color-surface)] rounded-3xl shadow-2xl border border-[var(--color-border-strong)] overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative p-6 border-b border-[var(--color-border)] bg-[var(--color-surface-subtle)] flex-shrink-0">
          <button 
            onClick={onClose}
            className="absolute top-4 right-4 p-2 text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-muted)] rounded-xl transition-all"
          >
            <X className="w-5 h-5" />
          </button>
          
          <div className="flex items-center gap-4">
            <div className="p-3 bg-[var(--color-primary-soft)] text-[var(--color-primary)] rounded-2xl shadow-sm">
              <Brain className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-black text-strong uppercase tracking-tight">AI Suggestion</h2>
              <p className="text-sm text-muted font-medium">Based on your recovery & history</p>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-6">
          <div className="space-y-4">
             <div>
                <h3 className="text-2xl font-black text-strong mb-2 capitalize">
                  {suggestion.focus.map(f => toMuscleLabel(f)).join(' & ')}
                </h3>
                <div className="flex flex-wrap gap-2">
                   <div className="flex items-center gap-1.5 text-xs font-bold text-[var(--color-primary-strong)] bg-[var(--color-primary-soft)] px-2.5 py-1 rounded-lg uppercase tracking-wide">
                      <Icon className="h-3.5 w-3.5" />
                      <span className="capitalize">{suggestion.intensity} Intensity</span>
                   </div>
                   <div className="flex items-center gap-1.5 text-xs font-bold text-subtle bg-[var(--color-surface-muted)] px-2.5 py-1 rounded-lg uppercase tracking-wide">
                      <span className="capitalize">{suggestion.type === 'active_recovery' ? 'Recovery' : 'Workout'}</span>
                   </div>
                </div>
             </div>
             
             <div className="space-y-3">
                {suggestion.reasoning.map((reason, i) => (
                  <div key={i} className="flex items-start gap-3 text-sm text-subtle bg-[var(--color-surface-subtle)] p-3 rounded-xl border border-[var(--color-border)]">
                    <CalendarClock className="h-4 w-4 mt-0.5 shrink-0 text-[var(--color-primary)]" />
                    <span>{reason}</span>
                  </div>
                ))}
             </div>
          </div>
        </div>

        <div className="p-6 bg-[var(--color-surface-subtle)] border-t border-[var(--color-border)] flex flex-col gap-3">
          <Button 
            size="lg"
            onClick={() => onConfirm(suggestion)}
            className="w-full h-14 rounded-xl font-black uppercase tracking-wider shadow-lg shadow-[var(--color-primary-soft)] text-lg"
          >
            Accept & Configure <ArrowRight className="ml-2 h-5 w-5" />
          </Button>
          <Button 
            variant="ghost" 
            size="lg"
            onClick={onCustomize}
            className="w-full h-12 rounded-xl font-bold text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
          >
            I'll build my own
          </Button>
        </div>
      </div>
    </div>
  )
}
