'use client'

import React, { useEffect, useState } from 'react'
import { AlertTriangle, X } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils'

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
  const [isVisible, setIsVisible] = useState(false)

  if (isOpen && !isVisible) {
    setIsVisible(true)
  }

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      const timer = setTimeout(() => setIsVisible(false), 200)
      document.body.style.overflow = ''
      return () => clearTimeout(timer)
    }
  }, [isOpen])

  if (!isVisible && !isOpen) return null

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose()
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
        "fixed inset-0 z-[100] flex items-center justify-center p-4 transition-all duration-200",
        isOpen ? "bg-black/60 backdrop-blur-sm opacity-100" : "bg-black/0 backdrop-blur-none opacity-0 pointer-events-none"
      )}
      onClick={handleBackdropClick}
    >
      <div 
        className={cn(
          "w-full max-w-md bg-[var(--color-surface)] rounded-3xl shadow-2xl border border-[var(--color-border-strong)] overflow-hidden transition-all duration-200 transform",
          isOpen ? "scale-100 opacity-100 translate-y-0" : "scale-95 opacity-0 translate-y-4"
        )}
      >
        <div className="relative p-6 sm:p-8">
          <button 
            onClick={onClose}
            className="absolute top-4 right-4 p-2 text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-muted)] rounded-xl transition-all"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex flex-col items-center text-center gap-4">
            <div className={cn("p-4 rounded-2xl", styles.iconBg, styles.iconColor)}>
              <AlertTriangle className="w-8 h-8" />
            </div>
            
            <div className="space-y-2">
              <h2 className="text-xl font-black text-strong tracking-tight">{title}</h2>
              <p className="text-sm text-muted font-medium leading-relaxed">
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
