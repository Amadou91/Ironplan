'use client'

import { useState, useRef, useEffect, useCallback, useId } from 'react'
import { createPortal } from 'react-dom'
import { Info } from 'lucide-react'
import { useHasMounted } from '@/hooks/useHasMounted'

interface ChartInfoTooltipProps {
  description: string
  goal?: string
}

export function ChartInfoTooltip({ description, goal }: ChartInfoTooltipProps) {
  const [isOpen, setIsOpen] = useState(false)
  const mounted = useHasMounted()
  const [pos, setPos] = useState({ top: 0, left: 0, arrowLeft: 0 })
  const triggerRef = useRef<HTMLButtonElement>(null)
  const tooltipId = useId()

  const updatePos = useCallback(() => {
    if (!triggerRef.current) return
    const rect = triggerRef.current.getBoundingClientRect()
    const TOOLTIP_WIDTH = 256 // w-64
    const MARGIN = 16
    const viewportWidth = window.innerWidth
    
    // Default: Center on trigger
    const triggerCenter = rect.left + rect.width / 2
    let left = triggerCenter - TOOLTIP_WIDTH / 2

    // Clamp to viewport
    if (left < MARGIN) left = MARGIN
    if (left + TOOLTIP_WIDTH > viewportWidth - MARGIN) {
      left = viewportWidth - MARGIN - TOOLTIP_WIDTH
    }

    // Arrow always points to trigger center, relative to tooltip
    const arrowLeft = triggerCenter - left

    setPos({
      top: rect.bottom + window.scrollY + 8,
      left: left + window.scrollX,
      arrowLeft
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
            zIndex: 9999,
          }}
          className="w-64 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-3 shadow-xl shadow-black/10 backdrop-blur-sm"
        >
          {/* Arrow */}
          <div
            style={{ 
              position: 'absolute', 
              top: -5, 
              left: pos.arrowLeft, 
              transform: 'translateX(-50%) rotate(45deg)', 
              width: 8, 
              height: 8 
            }}
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
          if (isOpen) { close() } else { open() }
        }}
        className="inline-flex items-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] rounded-sm"
      >
        <Info className="h-4 w-4 text-subtle transition-colors hover:text-primary cursor-help" aria-hidden="true" />
      </button>
      {tooltipEl}
    </span>
  )
}
