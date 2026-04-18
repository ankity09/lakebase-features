import { cn } from '@/lib/utils'

interface StatusBadgeProps {
  status: 'active' | 'ready' | 'suspended' | 'starting' | 'error' | string
  className?: string
}

const statusColorMap: Record<string, string> = {
  active: 'text-[var(--color-accent)] bg-[var(--color-accent)]/10',
  ready: 'text-[var(--color-accent)] bg-[var(--color-accent)]/10',
  suspended: 'text-[var(--color-warning)] bg-[var(--color-warning)]/10',
  starting: 'text-[var(--color-info)] bg-[var(--color-info)]/10',
  error: 'text-[var(--color-danger)] bg-[var(--color-danger)]/10',
}

const dotColorMap: Record<string, string> = {
  active: 'bg-[var(--color-accent)]',
  ready: 'bg-[var(--color-accent)]',
  suspended: 'bg-[var(--color-warning)]',
  starting: 'bg-[var(--color-info)]',
  error: 'bg-[var(--color-danger)]',
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const pillColor = statusColorMap[status] ?? 'text-[var(--color-text-muted)] bg-[var(--color-bg-hover)]'
  const dotColor = dotColorMap[status] ?? 'bg-[var(--color-text-muted)]'

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium',
        pillColor,
        className
      )}
    >
      <span className={cn('h-2 w-2 shrink-0 rounded-full', dotColor)} />
      {status}
    </span>
  )
}
