'use client'

import { useEffect, useRef } from 'react'

/**
 * Traps focus within a dialog element and restores focus on close.
 * Returns a ref to attach to the dialog container.
 */
export function useFocusTrap(isOpen: boolean) {
  const dialogRef = useRef<HTMLDivElement>(null)
  const previousFocusRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (!isOpen) return

    // Save the currently focused element for restoration
    previousFocusRef.current = document.activeElement as HTMLElement | null

    // Focus the first focusable element in the dialog
    const timer = requestAnimationFrame(() => {
      const focusable = getFocusableElements(dialogRef.current)
      if (focusable.length > 0) {
        focusable[0].focus()
      } else {
        dialogRef.current?.focus()
      }
    })

    return () => cancelAnimationFrame(timer)
  }, [isOpen])

  // Restore focus when dialog closes
  useEffect(() => {
    if (isOpen) return

    if (previousFocusRef.current && typeof previousFocusRef.current.focus === 'function') {
      previousFocusRef.current.focus()
      previousFocusRef.current = null
    }
  }, [isOpen])

  // Trap Tab key within dialog
  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return

      const focusable = getFocusableElements(dialogRef.current)
      if (focusable.length === 0) return

      const first = focusable[0]
      const last = focusable[focusable.length - 1]

      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault()
          last.focus()
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault()
          first.focus()
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen])

  return dialogRef
}

function getFocusableElements(container: HTMLElement | null): HTMLElement[] {
  if (!container) return []
  const selector = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
  return Array.from(container.querySelectorAll<HTMLElement>(selector))
}
