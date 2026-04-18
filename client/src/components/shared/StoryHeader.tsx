import { cn } from '@/lib/utils'

interface StoryHeaderProps {
  label?: string
  title: string
  subtitle: string
  className?: string
}

export function StoryHeader({ label, title, subtitle, className }: StoryHeaderProps) {
  return (
    <div className={cn('select-none', className)}>
      {label && (
        <span className="text-xs font-semibold tracking-widest uppercase text-[var(--color-accent)]">
          {label}
        </span>
      )}
      <h2
        className={cn(
          'text-2xl font-bold text-[var(--color-text-primary)]',
          label && 'mt-1'
        )}
      >
        {title}
      </h2>
      <p className="mt-0.5 text-sm text-[var(--color-text-secondary)]">
        {subtitle}
      </p>
    </div>
  )
}
