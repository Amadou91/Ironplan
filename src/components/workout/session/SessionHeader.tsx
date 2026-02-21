'use client';

import React from 'react';
import { CheckCircle2, CloudOff, Info, Loader2, RefreshCcw } from 'lucide-react';
import type { WeightUnit } from '@/types/domain';
import { formatSessionSyncLabel, getSessionCompletionPct, type SessionSyncStatus } from '@/lib/session-ui';

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
  sessionBodyWeight?: number | null;
  preferredUnit?: WeightUnit;
  syncStatus?: SessionSyncStatus | null;
  errorMessage?: string | null;
  isOnline?: boolean;
  isRetryingSync?: boolean;
  onRetrySync?: () => void | Promise<void>;
  onStartTimeClick?: () => void;
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
  isOnline = true,
  isRetryingSync = false,
  onRetrySync,
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
    return `${date.toLocaleDateString([], { month: 'short', day: 'numeric' })} at ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  };

  const completionPct = progressSummary?.totalSets
    ? getSessionCompletionPct(progressSummary)
    : 0;

  const { label: syncLabel, tone: syncTone } = formatSessionSyncLabel(syncStatus, isOnline);

  const syncToneClass = syncTone === 'warning'
    ? 'text-[var(--color-warning)]'
    : syncTone === 'danger'
      ? 'text-[var(--color-danger)]'
      : syncTone === 'primary'
        ? 'text-[var(--color-primary)]'
        : 'text-[var(--color-success)]';

  return (
    <div className="sticky top-[env(safe-area-inset-top,_0px)] z-20 surface-elevated border-b border-[var(--color-border)] p-4 backdrop-blur-md">
      <div className="flex flex-col gap-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="truncate text-xl font-semibold text-strong">{name}</h2>
            {onStartTimeClick ? (
              <button
                type="button"
                onClick={onStartTimeClick}
                className="mt-0.5 inline-flex items-center text-sm text-muted transition-colors hover:text-[var(--color-primary)]"
              >
                Started at {formatStartedAt(startedAt)}
                <span className="ml-1 text-xs text-subtle">Edit</span>
              </button>
            ) : (
              <p className="mt-0.5 text-sm text-muted">Started at {formatStartedAt(startedAt)}</p>
            )}
          </div>

          {onRetrySync && (!isOnline || syncStatus?.state === 'pending' || syncStatus?.state === 'error') ? (
            <button
              type="button"
              onClick={() => void onRetrySync()}
              disabled={!isOnline || isRetryingSync}
              className="inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-subtle)] px-2.5 text-xs font-semibold text-muted transition-colors hover:text-strong disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isRetryingSync ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCcw className="h-3.5 w-3.5" />}
              Retry
            </button>
          ) : null}
        </div>

        {(intensityLabel || minutesAvailable || typeof readinessScore === 'number') && (
          <div className="flex flex-wrap items-center gap-2 text-xs text-subtle">
            {intensityLabel && <span className="badge-neutral">Intensity: {intensityLabel}</span>}
            {minutesAvailable && <span className="badge-neutral">{minutesAvailable} min plan</span>}
            {typeof readinessScore === 'number' && <span className="badge-neutral">Readiness {readinessScore}</span>}
          </div>
        )}

        {progressSummary && (
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2 text-xs">
              <p className="font-semibold uppercase tracking-wider text-subtle">
                {progressSummary.completedSets}/{progressSummary.totalSets} sets complete
              </p>
              <p className="font-semibold text-strong">{completionPct}%</p>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-[var(--color-surface-muted)]" aria-hidden="true">
              <div
                className="h-full rounded-full bg-[var(--color-primary)] transition-all duration-500"
                style={{ width: `${completionPct}%` }}
              />
            </div>
            <div className="flex flex-wrap items-center gap-3 text-xs text-subtle">
              <span className="font-medium">
                {progressSummary.completedExercises}/{progressSummary.totalExercises} exercises started
              </span>

              {((sessionBodyWeight != null && sessionBodyWeight > 0) || onWeightClick) && (
                onWeightClick ? (
                  <button
                    type="button"
                    onClick={onWeightClick}
                    className="inline-flex items-center gap-1.5 rounded-md border border-[var(--color-border)] px-2 py-1 text-xs text-muted transition-colors hover:text-[var(--color-primary)]"
                  >
                    <span>Weight:</span>
                    <span className="font-semibold text-strong">
                      {sessionBodyWeight != null && sessionBodyWeight > 0
                        ? `${sessionBodyWeight} ${preferredUnit}`
                        : 'Add'}
                    </span>
                  </button>
                ) : (
                  <span className="font-medium">Weight: {sessionBodyWeight} {preferredUnit}</span>
                )
              )}

              {syncLabel && (
                <span className={`inline-flex items-center gap-1.5 font-semibold ${syncToneClass}`}>
                  {!isOnline ? (
                    <CloudOff className="h-3.5 w-3.5" />
                  ) : syncStatus?.state === 'synced' ? (
                    <CheckCircle2 className="h-3.5 w-3.5" />
                  ) : null}
                  {syncLabel}
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      {errorMessage && (
        <div className="alert-error mt-3 flex items-center gap-2 px-3 py-2 text-xs animate-in fade-in slide-in-from-top-1">
          <Info size={14} />
          {errorMessage}
        </div>
      )}
    </div>
  );
}
