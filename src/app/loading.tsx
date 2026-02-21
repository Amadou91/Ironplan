import { Skeleton } from '@/components/ui/Skeleton'

export default function Loading() {
  return (
    <div className="page-shell">
      <div className="page-stack">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-44 w-full" />
        <Skeleton className="h-44 w-full" />
      </div>
    </div>
  )
}
