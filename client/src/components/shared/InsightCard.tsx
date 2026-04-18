import { cn } from '@/lib/utils'

interface InsightCardProps {
  children: React.ReactNode
  className?: string
}

export function InsightCard({ children, className }: InsightCardProps) {
  return (
    <div
      className={cn(
        'rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-tertiary)] p-4',
        className
      )}
    >
      <div className="mb-2 text-sm font-bold text-[var(--color-text-primary)]">
        <span className="mr-1.5" role="img" aria-label="insight">
          {'💡'}
        </span>
        Why this matters
      </div>
      <div className="text-sm leading-relaxed text-[var(--color-text-secondary)]">
        {children}
      </div>
    </div>
  )
}
