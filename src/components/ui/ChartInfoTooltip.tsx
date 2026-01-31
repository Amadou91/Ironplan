import React from 'react'
import { Info } from 'lucide-react'

interface ChartInfoTooltipProps {
  description: string
  goal?: string
}

export function ChartInfoTooltip({ description, goal }: ChartInfoTooltipProps) {
  return (
    <div className="group relative ml-2 inline-flex items-center">
      <Info 
        className="h-4 w-4 text-subtle transition-colors hover:text-primary cursor-help" 
        aria-label="Info" 
      />
      
      <div className="pointer-events-none absolute top-full left-1/2 mt-2 w-64 -translate-x-1/2 opacity-0 transform -translate-y-1 transition-all duration-200 group-hover:pointer-events-auto group-hover:opacity-100 group-hover:translate-y-0 z-[9999]">
        <div className="relative rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-3 shadow-xl shadow-black/10 backdrop-blur-sm">
          {/* Arrow */}
          <div className="absolute -top-1 left-1/2 h-2 w-2 -translate-x-1/2 rotate-45 border-t border-l border-[var(--color-border)] bg-[var(--color-surface)]"></div>
          
          <div className="flex flex-col gap-1 relative z-10">
            <span className="text-xs font-semibold text-strong uppercase tracking-wide">About this graph</span>
            <p className="text-xs text-muted leading-relaxed">
              {description}
            </p>
            {goal && (
              <div className="mt-2 border-t border-[var(--color-border)] pt-2">
                <p className="text-[10px] font-bold uppercase tracking-wider text-accent">Goal</p>
                <p className="text-xs font-medium text-strong">{goal}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
