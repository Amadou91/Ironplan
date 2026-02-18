import { Skeleton } from '@/components/ui/Skeleton'

export default function SessionsLoading() {
  return (
    <div className="flex flex-col gap-4 p-6">
      <Skeleton className="h-10 w-48" />
      <div className="flex flex-col gap-3">
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-20 w-full" />
      </div>
    </div>
  )
}
