'use client'

import React, { useEffect, useRef } from 'react'

interface EditFieldModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  label: string
  value: string
  onChange: (value: string) => void
  inputType?: string
  inputMode?: 'text' | 'decimal' | 'numeric'
  min?: number
  step?: number
}

/**
 * Generic modal for editing a single field value (body weight, start time, etc).
 * Includes ARIA dialog semantics, focus trap, and Escape key handling.
 */
export function EditFieldModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  label,
  value,
  onChange,
  inputType = 'text',
  inputMode = 'text',
  min,
  step
}: EditFieldModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const previousFocusRef = useRef<HTMLElement | null>(null)

  // Store the previously focused element and focus the input
  useEffect(() => {
    if (isOpen) {
      previousFocusRef.current = document.activeElement as HTMLElement
      // Small delay to let the modal render
      requestAnimationFrame(() => inputRef.current?.focus())
    }
    return () => {
      if (!isOpen && previousFocusRef.current) {
        previousFocusRef.current.focus()
        previousFocusRef.current = null
      }
    }
  }, [isOpen])

  // Escape key handler
  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  // Focus trap
  useEffect(() => {
    if (!isOpen || !dialogRef.current) return
    const dialog = dialogRef.current
    const handleTab = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return
      const focusable = dialog.querySelectorAll<HTMLElement>(
        'input, button, [tabindex]:not([tabindex="-1"])'
      )
      if (focusable.length === 0) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }
    window.addEventListener('keydown', handleTab)
    return () => window.removeEventListener('keydown', handleTab)
  }, [isOpen])

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

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onMouseDown={handleMouseDown}
      role="presentation"
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-field-title"
        className="bg-[var(--color-surface)] rounded-2xl p-6 shadow-xl border border-[var(--color-border)] w-80"
      >
        <h3 id="edit-field-title" className="text-lg font-semibold text-strong mb-4">{title}</h3>
        <div className="mb-4">
          <label className="text-sm text-muted mb-2 block">{label}</label>
          <input
            ref={inputRef}
            type={inputType}
            inputMode={inputMode}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="input-base w-full"
            min={min}
            step={step}
          />
        </div>
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 rounded-lg border border-[var(--color-border)] text-muted hover:bg-[var(--color-surface-muted)] transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 px-4 py-2 rounded-lg bg-[var(--color-primary)] text-white font-medium hover:bg-[var(--color-primary-strong)] transition-colors"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  )
}
