'use client';

import React, { createContext, useContext, useState, useCallback, useMemo, ReactNode } from 'react';
import { CheckCircle2, XCircle, X } from 'lucide-react';

type ToastType = 'success' | 'error' | 'info';

interface Toast {
  id: string;
  message: string;
  type: ToastType;
}

interface ToastContextType {
  toast: (message: string, type?: ToastType, durationMs?: number) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback((message: string, type: ToastType = 'success', durationMs = 3200) => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, message, type }]);
    
    setTimeout(() => {
      removeToast(id);
    }, durationMs);
  }, [removeToast]);

  const regionLabel = useMemo(() => 'Notifications', [])

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div
        className="fixed bottom-4 right-4 z-[var(--z-toast)] flex max-w-sm flex-col gap-2.5 pointer-events-none sm:bottom-6 sm:right-6"
        role="region"
        aria-label={regionLabel}
        aria-live="polite"
        aria-relevant="additions text"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`
              pointer-events-auto flex items-start gap-3 rounded-[var(--radius-lg)] border px-4 py-3 shadow-[var(--shadow-md)] transition-all duration-[var(--motion-fast)] ease-[var(--ease-emphasized)]
              motion-safe:animate-in motion-safe:slide-in-from-bottom-3 motion-safe:fade-in
              ${t.type === 'success' 
                ? 'bg-[var(--color-surface)] border-[var(--color-success-border)] text-[var(--color-success-strong)]' 
                : t.type === 'info'
                  ? 'bg-[var(--color-surface)] border-[color-mix(in_oklch,var(--color-info),white_65%)] text-[var(--color-info)]'
                  : 'bg-[var(--color-surface)] border-[var(--color-danger-border)] text-[var(--color-danger)]'
              }
            `}
            role="status"
          >
            {t.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5" />
            ) : t.type === 'info' ? (
              <CheckCircle2 className="w-5 h-5" />
            ) : (
              <XCircle className="w-5 h-5" />
            )}
            <p className="flex-1 text-sm font-semibold text-[var(--color-text)] leading-5">{t.message}</p>
            <button 
              onClick={() => removeToast(t.id)}
              className="rounded-md p-1 text-[var(--color-text-subtle)] hover:bg-[var(--color-surface-muted)] hover:text-[var(--color-text)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]"
              aria-label="Dismiss notification"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}
