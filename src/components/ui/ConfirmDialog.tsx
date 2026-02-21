'use client'

import React, { useEffect } from 'react'
import { AlertTriangle, X } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils'
import { useFocusTrap } from '@/hooks/useFocusTrap'

interface ConfirmDialogProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  description: string
  confirmText?: string
  cancelText?: string
  variant?: 'danger' | 'warning' | 'info'
  isLoading?: boolean
}

export function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'danger',
  isLoading = false
}: ConfirmDialogProps) {
  const dialogRef = useFocusTrap(isOpen)

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    }

    if (!isOpen) {
      document.body.style.overflow = ''
    }

    return () => {
      document.body.style.overflow = ''
    }
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !isLoading) {
        onClose()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isLoading, isOpen, onClose])

  if (!isOpen) return null

  // Backdrop click handler that avoids closing when dragging from inside the modal to outside
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      const handleMouseUp = (upEvent: MouseEvent) => {
        if (upEvent.target === e.currentTarget) {
          onClose()
        }
        document.removeEventListener('mouseup', handleMouseUp)
      }
      document.addEventListener('mouseup', handleMouseUp)
    }
  }

  const colorStyles = {
    danger: {
      iconBg: 'bg-red-100 dark:bg-red-900/30',
      iconColor: 'text-red-600 dark:text-red-400',
      confirmBtn: 'bg-red-600 hover:bg-red-700 text-white shadow-lg shadow-red-500/20'
    },
    warning: {
      iconBg: 'bg-amber-100 dark:bg-amber-900/30',
      iconColor: 'text-amber-600 dark:text-amber-400',
      confirmBtn: 'bg-amber-500 hover:bg-amber-600 text-white shadow-lg shadow-amber-500/20'
    },
    info: {
      iconBg: 'bg-blue-100 dark:bg-blue-900/30',
      iconColor: 'text-blue-600 dark:text-blue-400',
      confirmBtn: 'bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-500/20'
    }
  }

  const styles = colorStyles[variant]

  return (
    <div 
      className={cn(
        "fixed inset-0 z-[var(--z-modal)] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm transition-all duration-200"
      )}
      onMouseDown={handleMouseDown}
    >
      <div 
        ref={dialogRef}
        className={cn(
          "w-full max-w-md bg-[var(--color-surface)] rounded-[var(--radius-xl)] shadow-[var(--shadow-lg)] border border-[var(--color-border-strong)] overflow-hidden transition-all duration-200 transform scale-100 opacity-100 translate-y-0"
        )}
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        aria-describedby="confirm-dialog-description"
      >
        <div className="relative p-6 sm:p-8">
          <button 
            onClick={onClose}
              className="absolute top-4 right-4 p-2 text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-muted)] rounded-xl transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]"
              aria-label="Close dialog"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex flex-col items-center text-center gap-4">
            <div className={cn("p-4 rounded-2xl", styles.iconBg, styles.iconColor)}>
              <AlertTriangle className="w-8 h-8" />
            </div>
            
            <div className="space-y-2">
              <h2 id="confirm-dialog-title" className="text-xl font-semibold text-strong tracking-tight">{title}</h2>
              <p id="confirm-dialog-description" className="text-sm text-muted font-medium leading-relaxed">
                {description}
              </p>
            </div>
          </div>

          <div className="mt-8 flex gap-3">
            <Button 
              variant="secondary" 
              onClick={onClose}
              disabled={isLoading}
              className="flex-1 h-12 rounded-xl font-bold"
            >
              {cancelText}
            </Button>
            <Button 
              onClick={onConfirm}
              disabled={isLoading}
              className={cn("flex-1 h-12 rounded-xl font-bold uppercase tracking-wider", styles.confirmBtn)}
            >
              {isLoading ? 'Processing...' : confirmText}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
