import { cn } from '@/lib/utils'

interface PanelData {
  title: string
  stat: string
  description: string
}

interface BeforeAfterProps {
  before: PanelData
  after: PanelData
  className?: string
}

function Panel({
  data,
  variant,
}: {
  data: PanelData
  variant: 'before' | 'after'
}) {
  const isDanger = variant === 'before'

  return (
    <div
      className={cn(
        'flex-1 rounded-xl border border-[var(--color-border)] p-4',
        isDanger
          ? 'border-l-[3px] border-l-[var(--color-danger)] bg-[var(--color-danger)]/5'
          : 'border-l-[3px] border-l-[var(--color-accent)] bg-[var(--color-accent)]/5'
      )}
    >
      <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
        {data.title}
      </span>
      <div
        className={cn(
          'mt-1 text-[22px] font-bold font-[var(--font-mono)]',
          isDanger ? 'text-[var(--color-danger)]' : 'text-[var(--color-accent)]'
        )}
      >
        {data.stat}
      </div>
      <p className="mt-1 text-[9px] leading-relaxed text-[var(--color-text-secondary)]">
        {data.description}
      </p>
    </div>
  )
}

export function BeforeAfter({ before, after, className }: BeforeAfterProps) {
  return (
    <div className={cn('flex gap-3', className)}>
      <Panel data={before} variant="before" />
      <Panel data={after} variant="after" />
    </div>
  )
}
