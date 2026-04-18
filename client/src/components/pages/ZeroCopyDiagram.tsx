import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { cn } from '@/lib/utils'

interface PageBlockProps {
  label: string
  variant?: 'normal' | 'modified' | 'new'
}

function PageBlock({ label, variant = 'normal' }: PageBlockProps) {
  const colorClass =
    variant === 'modified'
      ? 'bg-[var(--color-warning)]/20 border-[var(--color-warning)] text-[var(--color-warning)]'
      : variant === 'new'
        ? 'bg-[var(--color-warning)]/20 border-[var(--color-warning)] text-[var(--color-warning)]'
        : 'bg-[var(--color-accent)]/15 border-[var(--color-accent)]/40 text-[var(--color-accent)]'

  return (
    <div
      className={cn(
        'flex h-9 w-9 items-center justify-center rounded border text-xs font-bold font-[var(--font-mono)]',
        colorClass
      )}
    >
      {label}
    </div>
  )
}

function StepLabel({ step, title }: { step: number; title: string }) {
  return (
    <div className="mb-2 flex items-center gap-2">
      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[var(--color-accent)]/15 text-[10px] font-bold text-[var(--color-accent)]">
        {step}
      </span>
      <span className="text-xs font-semibold text-[var(--color-text-primary)]">
        {title}
      </span>
    </div>
  )
}

function Callout({
  text,
  variant = 'info',
}: {
  text: string
  variant?: 'info' | 'accent'
}) {
  const color =
    variant === 'accent'
      ? 'border-[var(--color-accent)]/30 bg-[var(--color-accent)]/5 text-[var(--color-accent)]'
      : 'border-[var(--color-info)]/30 bg-[var(--color-info)]/5 text-[var(--color-info)]'

  return (
    <span
      className={cn(
        'inline-block rounded-md border px-2 py-0.5 text-[10px] font-medium',
        color
      )}
    >
      {text}
    </span>
  )
}

const stats = [
  { value: '0 bytes', label: 'Initial cost' },
  { value: '<1 sec', label: 'Create time' },
  { value: 'Full scale', label: 'Data access' },
  { value: 'Isolated', label: 'Writes' },
]

export function ZeroCopyDiagram() {
  const [open, setOpen] = useState(true)

  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)]">
      <button
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'flex w-full items-center justify-between px-4 py-3 text-left transition-colors',
          'hover:bg-[var(--color-bg-hover)] rounded-xl',
          'focus:outline-none focus-visible:ring-1 focus-visible:ring-[var(--color-accent)]'
        )}
      >
        <span className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
          How zero-copy branching works
        </span>
        {open ? (
          <ChevronUp className="h-3.5 w-3.5 text-[var(--color-text-muted)]" />
        ) : (
          <ChevronDown className="h-3.5 w-3.5 text-[var(--color-text-muted)]" />
        )}
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div className="space-y-5 px-4 pb-4">
              {/* Step 1 */}
              <div>
                <StepLabel step={1} title="Single Production Database" />
                <div className="flex items-center gap-1.5">
                  <PageBlock label="A" />
                  <PageBlock label="B" />
                  <PageBlock label="C" />
                  <PageBlock label="D" />
                  <PageBlock label="E" />
                </div>
                <p className="mt-1.5 text-[10px] text-[var(--color-text-muted)]">
                  Shared storage (one copy)
                </p>
              </div>

              {/* Step 2 */}
              <div>
                <StepLabel step={2} title="Create Branch (instant)" />
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className="w-12 text-right text-[10px] font-medium text-[var(--color-text-muted)]">
                      main
                    </span>
                    <div className="h-px w-3 bg-[var(--color-border)]" />
                    <div className="flex items-center gap-1.5">
                      <PageBlock label="A" />
                      <PageBlock label="B" />
                      <PageBlock label="C" />
                      <PageBlock label="D" />
                      <PageBlock label="E" />
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-12 text-right text-[10px] font-medium text-[var(--color-info)]">
                      dev
                    </span>
                    <div className="h-px w-3 bg-[var(--color-info)]/40" />
                    <div className="flex items-center gap-1.5 rounded border border-dashed border-[var(--color-info)]/30 px-1.5 py-1">
                      <span className="text-[10px] text-[var(--color-info)]">
                        points to same pages
                      </span>
                    </div>
                  </div>
                </div>
                <div className="mt-2">
                  <Callout text="Storage cost: 0 bytes" variant="info" />
                </div>
              </div>

              {/* Step 3 */}
              <div>
                <StepLabel step={3} title="Write to Branch (copy-on-write)" />
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className="w-12 text-right text-[10px] font-medium text-[var(--color-text-muted)]">
                      main
                    </span>
                    <div className="h-px w-3 bg-[var(--color-border)]" />
                    <div className="flex items-center gap-1.5">
                      <PageBlock label="A" />
                      <PageBlock label="B" />
                      <PageBlock label="C" />
                      <PageBlock label="D" />
                      <PageBlock label="E" />
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-12 text-right text-[10px] font-medium text-[var(--color-info)]">
                      dev
                    </span>
                    <div className="h-px w-3 bg-[var(--color-info)]/40" />
                    <div className="flex items-center gap-1.5">
                      <PageBlock label="A" />
                      <PageBlock label="B" />
                      <PageBlock label="C" />
                      <PageBlock label="D'" variant="modified" />
                      <PageBlock label="F" variant="new" />
                    </div>
                  </div>
                </div>

                {/* Shared vs branch-only callouts */}
                <div className="mt-3 flex gap-2">
                  <div className="flex-1 rounded-lg border border-[var(--color-accent)]/20 bg-[var(--color-accent)]/5 px-3 py-2">
                    <div className="text-[10px] font-semibold text-[var(--color-accent)]">
                      Shared (free)
                    </div>
                    <div className="mt-0.5 text-[10px] text-[var(--color-text-muted)]">
                      A, B, C — zero duplication
                    </div>
                  </div>
                  <div className="flex-1 rounded-lg border border-[var(--color-warning)]/20 bg-[var(--color-warning)]/5 px-3 py-2">
                    <div className="text-[10px] font-semibold text-[var(--color-warning)]">
                      Branch-only (tiny cost)
                    </div>
                    <div className="mt-0.5 text-[10px] text-[var(--color-text-muted)]">
                      D', F — only changed pages
                    </div>
                  </div>
                </div>
              </div>

              {/* Key stats */}
              <div className="grid grid-cols-4 gap-2">
                {stats.map((s) => (
                  <div
                    key={s.label}
                    className="rounded-lg bg-[var(--color-bg-tertiary)] px-2 py-2 text-center"
                  >
                    <div className="text-sm font-bold font-[var(--font-mono)] text-[var(--color-accent)]">
                      {s.value}
                    </div>
                    <div className="mt-0.5 text-[9px] text-[var(--color-text-muted)]">
                      {s.label}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
