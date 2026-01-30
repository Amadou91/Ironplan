'use client';

import React, { useEffect, useState } from 'react';
import { Clock, X, Info } from 'lucide-react';
import type { WeightUnit } from '@/types/domain';

interface SessionHeaderProps {
  name: string;
  startedAt: string;
  intensityLabel?: string | null;
  minutesAvailable?: number;
  readinessScore?: number;
  progressSummary?: {
    completedSets: number;
    totalSets: number;
    completedExercises: number;
    totalExercises: number;
  } | null;
  /** Session body weight (read-only, set from readiness check) */
  sessionBodyWeight?: number | null;
  preferredUnit?: WeightUnit;
  onCancel?: () => void;
  errorMessage?: string | null;
  /** When set, show a static duration instead of live timer (for logging past workouts) */
  fixedDurationMinutes?: number | null;
}

export function SessionHeader({
  name,
  startedAt,
  intensityLabel,
  minutesAvailable,
  readinessScore,
  progressSummary,
  sessionBodyWeight,
  preferredUnit = 'lb',
  onCancel,
  errorMessage,
  fixedDurationMinutes,
}: SessionHeaderProps) {
  const [duration, setDuration] = useState<string>('00:00');

  useEffect(() => {
    // Skip live timer if using fixed duration (logging past workout)
    if (typeof fixedDurationMinutes === 'number') {
      const hrs = Math.floor(fixedDurationMinutes / 60);
      const mins = fixedDurationMinutes % 60;
      if (hrs > 0) {
        setDuration(`${hrs}:${mins.toString().padStart(2, '0')}:00`);
      } else {
        setDuration(`${mins.toString().padStart(2, '0')}:00`);
      }
      return;
    }
    
    const start = new Date(startedAt).getTime();
    const interval = setInterval(() => {
      const now = Date.now();
      const diff = Math.max(0, now - start);
      const hrs = Math.floor(diff / 3600000);
      const mins = Math.floor((diff % 3600000) / 60000);
      const secs = Math.floor((diff % 60000) / 1000);
      
      if (hrs > 0) {
        setDuration(`${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`);
      } else {
        setDuration(`${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [startedAt, fixedDurationMinutes]);

  return (
    <div className="sticky top-0 z-20 surface-elevated p-4 backdrop-blur-md border-b border-[var(--color-border)]">
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-strong">{name}</h2>
            <div className="flex items-center gap-3 text-sm text-muted">
              <div className="flex items-center gap-1">
                <Clock size={14} className="text-accent" />
                <span className="font-mono font-medium text-accent">{duration}</span>
              </div>
              <span className="text-xs">Started at {new Date(startedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
            </div>
          </div>
          {onCancel && (
            <button
              onClick={onCancel}
              className="p-2 rounded-full hover:bg-[var(--color-surface-muted)] text-subtle transition-colors"
              title="Cancel Session"
            >
              <X size={20} />
            </button>
          )}
        </div>

        {(intensityLabel || minutesAvailable) && (
          <div className="flex flex-wrap items-center gap-2 text-xs text-subtle">
            {intensityLabel && <span className="badge-neutral">Intensity: {intensityLabel}</span>}
            {minutesAvailable && (
              <span className="badge-neutral">{minutesAvailable} min plan</span>
            )}
            {typeof readinessScore === 'number' && (
              <span className="badge-neutral">Readiness {readinessScore}</span>
            )}
          </div>
        )}

        {progressSummary && (
          <div className="flex flex-wrap items-center gap-4 text-xs text-subtle">
            <div className="flex items-center gap-2">
              <span>
                {progressSummary.completedSets}/{progressSummary.totalSets} sets
              </span>
              <span>•</span>
              <span>
                {progressSummary.completedExercises}/{progressSummary.totalExercises} exercises
              </span>
            </div>
            {sessionBodyWeight != null && sessionBodyWeight > 0 && (
              <div className="flex items-center gap-2 border-l border-[var(--color-border)] pl-4">
                <span className="font-medium text-muted">Weight:</span>
                <span className="font-semibold text-strong">
                  {sessionBodyWeight} {preferredUnit}
                </span>
              </div>
            )}
          </div>
        )}
      </div>

      {errorMessage && (
        <div className="mt-3 alert-error px-3 py-2 text-xs flex items-center gap-2 animate-in fade-in slide-in-from-top-1">
          <Info size={14} />
          {errorMessage}
        </div>
      )}
    </div>
  );
}
