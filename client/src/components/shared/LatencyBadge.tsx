import { cn } from '@/lib/utils'
import { formatMs } from '@/lib/utils'

interface LatencyBadgeProps {
  ms: number
  className?: string
}

export function LatencyBadge({ ms, className }: LatencyBadgeProps) {
  const color =
    ms < 10
      ? 'text-[var(--color-accent)] bg-[var(--color-accent)]/10'
      : ms <= 100
        ? 'text-[var(--color-warning)] bg-[var(--color-warning)]/10'
        : 'text-[var(--color-danger)] bg-[var(--color-danger)]/10'

  return (
    <span
      className={cn(
        'inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold font-[var(--font-mono)]',
        color,
        className
      )}
    >
      {formatMs(ms)}
    </span>
  )
}
