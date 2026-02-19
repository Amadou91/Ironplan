'use client'

import {
  useState,
  useRef,
  useEffect,
  useCallback,
  useId,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'
import { cn } from '@/lib/utils'
import { useHasMounted } from '@/hooks/useHasMounted'

type TooltipProps = {
  content: string
  children: ReactNode
  className?: string
}

type Position = { top: number; left: number; placement: 'above' | 'below'; align: 'start' | 'center' | 'end' }

function computePosition(rect: DOMRect): Position {
  const OFFSET = 8
  const tooltipHeight = 40 // estimated
  const spaceAbove = rect.top
  const placement = spaceAbove >= tooltipHeight + OFFSET ? 'above' : 'below'
  
  const viewportWidth = window.innerWidth
  const center = rect.left + rect.width / 2
  
  let align: 'start' | 'center' | 'end' = 'center'
  let left = center + window.scrollX

  // If close to left edge (e.g. within 100px), align left
  if (center < 100) {
    align = 'start'
    left = rect.left + window.scrollX
  } 
  // If close to right edge, align right
  else if (center > viewportWidth - 100) {
    align = 'end'
    left = rect.right + window.scrollX
  }

  const top =
    placement === 'above'
      ? rect.top + window.scrollY - OFFSET
      : rect.bottom + window.scrollY + OFFSET
      
  return { top, left, placement, align }
}

export function Tooltip({ content, children, className }: TooltipProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [position, setPosition] = useState<Position | null>(null)
  const triggerRef = useRef<HTMLSpanElement>(null)
  const tooltipId = useId()
  const mounted = useHasMounted()

  const updatePosition = useCallback(() => {
    if (!triggerRef.current) return
    const rect = triggerRef.current.getBoundingClientRect()
    setPosition(computePosition(rect))
  }, [])

  const open = useCallback(() => {
    updatePosition()
    setIsOpen(true)
  }, [updatePosition])

  const close = useCallback(() => {
    setIsOpen(false)
  }, [])

  // Close on scroll / resize to avoid stale positions
  useEffect(() => {
    if (!isOpen) return
    const handleScrollResize = () => setIsOpen(false)
    window.addEventListener('scroll', handleScrollResize, { passive: true, capture: true })
    window.addEventListener('resize', handleScrollResize, { passive: true })
    return () => {
      window.removeEventListener('scroll', handleScrollResize, { capture: true })
      window.removeEventListener('resize', handleScrollResize)
    }
  }, [isOpen])

  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      // On touch devices toggle; prevent ghost-click from also firing mouse events
      e.stopPropagation()
      if (isOpen) {
        close()
      } else {
        open()
      }
    },
    [isOpen, open, close]
  )

  // Close when tapping elsewhere on touch devices
  useEffect(() => {
    if (!isOpen) return
    const handleOutsideTap = (e: TouchEvent) => {
      if (triggerRef.current && !triggerRef.current.contains(e.target as Node)) {
        close()
      }
    }
    document.addEventListener('touchstart', handleOutsideTap, { passive: true })
    return () => document.removeEventListener('touchstart', handleOutsideTap)
  }, [isOpen, close])

  const tooltipEl =
    mounted && isOpen && position ? (
      createPortal(
        <span
          id={tooltipId}
          role="tooltip"
          style={{
            position: 'absolute',
            top: position.top,
            left: position.left,
            transform: `translate(${
              position.align === 'start' ? '0' : position.align === 'end' ? '-100%' : '-50%'
            }, ${position.placement === 'above' ? '-100%' : '0'})`,
            zIndex: 9999,
            pointerEvents: 'none',
          }}
          className={cn(
            'w-max max-w-xs rounded-md bg-[var(--color-text)] px-2 py-1 text-xs text-[var(--color-text-inverse)] shadow-[var(--shadow-md)]',
            'transition-opacity duration-150',
            isOpen ? 'opacity-100' : 'opacity-0'
          )}
        >
          {content}
        </span>,
        document.body
      )
    ) : null

  return (
    <span
      ref={triggerRef}
      className={cn('relative inline-flex', className)}
      onMouseEnter={open}
      onMouseLeave={close}
      onFocus={open}
      onBlur={close}
      onTouchStart={handleTouchStart}
      aria-describedby={isOpen ? tooltipId : undefined}
    >
      {children}
      {tooltipEl}
    </span>
  )
}
