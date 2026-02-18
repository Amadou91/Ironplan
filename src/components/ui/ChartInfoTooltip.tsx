'use client'

import { useState, useRef, useEffect, useCallback, useId } from 'react'
import { createPortal } from 'react-dom'
import { Info } from 'lucide-react'

interface ChartInfoTooltipProps {
  description: string
  goal?: string
}

export function ChartInfoTooltip({ description, goal }: ChartInfoTooltipProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [pos, setPos] = useState({ top: 0, left: 0 })
  const triggerRef = useRef<HTMLButtonElement>(null)
  const tooltipId = useId()

  useEffect(() => {
    setMounted(true)
  }, [])

  const updatePos = useCallback(() => {
    if (!triggerRef.current) return
    const rect = triggerRef.current.getBoundingClientRect()
    setPos({
      top: rect.bottom + window.scrollY + 8,
      left: rect.left + window.scrollX + rect.width / 2,
    })
  }, [])

  const open = useCallback(() => {
    updatePos()
    setIsOpen(true)
  }, [updatePos])

  const close = useCallback(() => setIsOpen(false), [])

  // Close on scroll/resize
  useEffect(() => {
    if (!isOpen) return
    const handle = () => setIsOpen(false)
    window.addEventListener('scroll', handle, { passive: true, capture: true })
    window.addEventListener('resize', handle, { passive: true })
    return () => {
      window.removeEventListener('scroll', handle, { capture: true })
      window.removeEventListener('resize', handle)
    }
  }, [isOpen])

  // Close on outside tap
  useEffect(() => {
    if (!isOpen) return
    const handle = (e: TouchEvent | MouseEvent) => {
      if (triggerRef.current && !triggerRef.current.contains(e.target as Node)) {
        close()
      }
    }
    document.addEventListener('touchstart', handle as EventListener, { passive: true })
    document.addEventListener('mousedown', handle as EventListener)
    return () => {
      document.removeEventListener('touchstart', handle as EventListener)
      document.removeEventListener('mousedown', handle as EventListener)
    }
  }, [isOpen, close])

  const tooltipEl =
    mounted && isOpen ? (
      createPortal(
        <div
          id={tooltipId}
          role="tooltip"
          style={{
            position: 'absolute',
            top: pos.top,
            left: pos.left,
            transform: 'translateX(-50%)',
            zIndex: 9999,
            pointerEvents: 'none',
          }}
          className="w-64 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-3 shadow-xl shadow-black/10 backdrop-blur-sm"
        >
          {/* Arrow */}
          <div
            style={{ position: 'absolute', top: -5, left: '50%', transform: 'translateX(-50%) rotate(45deg)', width: 8, height: 8 }}
            className="border-t border-l border-[var(--color-border)] bg-[var(--color-surface)]"
          />
          <div className="relative z-10 flex flex-col gap-1">
            <span className="text-xs font-semibold text-strong uppercase tracking-wide">About this graph</span>
            <p className="text-xs text-muted leading-relaxed">{description}</p>
            {goal && (
              <div className="mt-2 border-t border-[var(--color-border)] pt-2">
                <p className="text-[10px] font-bold uppercase tracking-wider text-accent">Goal</p>
                <p className="text-xs font-medium text-strong">{goal}</p>
              </div>
            )}
          </div>
        </div>,
        document.body
      )
    ) : null

  return (
    <span className="relative ml-2 inline-flex items-center">
      <button
        ref={triggerRef}
        type="button"
        aria-label="More info"
        aria-describedby={isOpen ? tooltipId : undefined}
        onMouseEnter={open}
        onMouseLeave={close}
        onFocus={open}
        onBlur={close}
        onTouchStart={(e) => {
          e.stopPropagation()
          isOpen ? close() : open()
        }}
        className="inline-flex items-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] rounded-sm"
      >
        <Info className="h-4 w-4 text-subtle transition-colors hover:text-primary cursor-help" aria-hidden="true" />
      </button>
      {tooltipEl}
    </span>
  )
}
