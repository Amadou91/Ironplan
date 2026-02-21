'use client';

import React from 'react';
import { Info } from 'lucide-react';
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
  syncStatus?: {
    state: 'pending' | 'synced' | 'error';
    pending: number;
    error: number;
  } | null;
  errorMessage?: string | null;
  /** Callback when 'Started at' label is clicked (to edit start time) */
  onStartTimeClick?: () => void;
  /** Callback when weight label is clicked (to edit body weight) */
  onWeightClick?: () => void;
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
  syncStatus,
  errorMessage,
  onStartTimeClick,
  onWeightClick,
}: SessionHeaderProps) {
  const formatStartedAt = (dateStr: string) => {
    const date = new Date(dateStr);
    const today = new Date();
    const isToday = date.toDateString() === today.toDateString();
    
    if (isToday) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' }) + 
      ' at ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const syncLabel = (() => {
    if (!syncStatus) return null
    if (syncStatus.state === 'error') return `Sync error (${syncStatus.error})`
    if (syncStatus.state === 'pending') return `Syncing (${syncStatus.pending})`
    return 'Synced'
  })()

  return (
    <div className="sticky top-[env(safe-area-inset-top,_0px)] z-20 surface-elevated p-4 backdrop-blur-md border-b border-[var(--color-border)]">
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-strong">{name}</h2>
            <div 
              className={`text-sm text-muted ${onStartTimeClick ? 'cursor-pointer hover:text-[var(--color-primary)] transition-colors' : ''}`}
              onClick={onStartTimeClick}
              role={onStartTimeClick ? 'button' : undefined}
              tabIndex={onStartTimeClick ? 0 : undefined}
              onKeyDown={onStartTimeClick ? (e) => e.key === 'Enter' && onStartTimeClick() : undefined}
            >
              Started at {formatStartedAt(startedAt)}
              {onStartTimeClick && <span className="ml-1 text-xs text-muted">(edit)</span>}
            </div>
          </div>
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
            <div className="flex items-center gap-2 uppercase tracking-wider font-bold">
              <span>
                {progressSummary.totalExercises} Exercises
              </span>
              <span>•</span>
              <span>
                {progressSummary.totalSets} Sets
              </span>
            </div>
            {((sessionBodyWeight != null && sessionBodyWeight > 0) || onWeightClick) && (
              <div 
                className={`flex items-center gap-2 border-l border-[var(--color-border)] pl-4 ${onWeightClick ? 'cursor-pointer hover:text-[var(--color-primary)] transition-colors' : ''}`}
                onClick={onWeightClick}
                role={onWeightClick ? 'button' : undefined}
                tabIndex={onWeightClick ? 0 : undefined}
                onKeyDown={onWeightClick ? (e) => e.key === 'Enter' && onWeightClick() : undefined}
              >
                <span className="font-medium text-muted">Weight:</span>
                <span className="font-semibold text-strong">
                  {sessionBodyWeight != null && sessionBodyWeight > 0 ? (
                    `${sessionBodyWeight} ${preferredUnit}`
                  ) : (
                    <span className="text-xs font-normal italic">Enter weight</span>
                  )}
                </span>
                {onWeightClick && sessionBodyWeight != null && sessionBodyWeight > 0 && (
                  <span className="text-xs text-muted">(edit)</span>
                )}
              </div>
            )}
            {syncLabel && (
              <span
                className={`badge-neutral ${
                  syncStatus?.state === 'error'
                    ? 'text-[var(--color-danger)]'
                    : syncStatus?.state === 'pending'
                      ? 'text-[var(--color-primary)]'
                      : 'text-[var(--color-success)]'
                }`}
              >
                {syncLabel}
              </span>
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
