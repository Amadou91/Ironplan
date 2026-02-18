import { Skeleton } from '@/components/ui/Skeleton'

export default function ExercisesLoading() {
  return (
    <div className="flex flex-col gap-4 p-6">
      <Skeleton className="h-10 w-48" />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    </div>
  )
}
