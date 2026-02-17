import type { HTMLAttributes, TableHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

export function TableContainer({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('overflow-x-auto rounded-[var(--radius-lg)] border border-[var(--color-border)]', className)} {...props} />
}

export function Table({ className, ...props }: TableHTMLAttributes<HTMLTableElement>) {
  return <table className={cn('min-w-full border-collapse text-left text-sm', className)} {...props} />
}

export function TableHead({ className, ...props }: HTMLAttributes<HTMLTableSectionElement>) {
  return <thead className={cn('bg-[var(--color-surface-muted)] text-subtle', className)} {...props} />
}

export function TableBody({ className, ...props }: HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody className={cn('bg-[var(--color-surface)]', className)} {...props} />
}

export function TableRow({ className, ...props }: HTMLAttributes<HTMLTableRowElement>) {
  return <tr className={cn('border-b border-[var(--color-border)] last:border-b-0', className)} {...props} />
}

export function TableHeaderCell({ className, ...props }: HTMLAttributes<HTMLTableCellElement>) {
  return <th className={cn('px-4 py-3 text-xs font-semibold uppercase tracking-wide', className)} {...props} />
}

export function TableCell({ className, ...props }: HTMLAttributes<HTMLTableCellElement>) {
  return <td className={cn('px-4 py-3 text-sm text-strong', className)} {...props} />
}
