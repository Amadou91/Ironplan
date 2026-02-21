import { Skeleton } from '@/components/ui/Skeleton'

export default function SessionsLoading() {
  return (
    <div className="page-shell">
      <div className="page-stack">
        <Skeleton className="h-8 w-40" />
        <div className="flex flex-col gap-3">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      </div>
    </div>
  )
}
