import { cn } from '@/lib/utils'

type SkeletonProps = {
  className?: string
}

export function Skeleton({ className }: SkeletonProps) {
  return (
    <div
      className={cn('animate-pulse rounded-[var(--radius-md)] bg-[var(--color-surface-muted)]', className)}
      aria-hidden="true"
    />
  )
}
