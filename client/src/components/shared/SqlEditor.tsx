import { useCallback } from 'react'
import { cn } from '@/lib/utils'

interface SqlEditorProps {
  value: string
  onChange: (v: string) => void
  onExecute?: () => void
  placeholder?: string
  className?: string
}

export function SqlEditor({
  value,
  onChange,
  onExecute,
  placeholder = 'SELECT * FROM ...',
  className,
}: SqlEditorProps) {
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault()
        onExecute?.()
      }
    },
    [onExecute]
  )

  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={handleKeyDown}
      placeholder={placeholder}
      spellCheck={false}
      className={cn(
        'w-full min-h-[180px] resize-y rounded-xl border border-[var(--color-border)] p-4',
        'bg-[var(--color-bg-tertiary)] font-[var(--font-mono)] text-sm text-[var(--color-text-primary)]',
        'placeholder:text-[var(--color-text-muted)]',
        'focus:outline-none focus:border-[var(--color-accent)] focus:shadow-[0_0_0_3px_var(--color-accent-glow)]',
        'transition-shadow',
        className
      )}
    />
  )
}
