import { useEffect, useSyncExternalStore } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { cn } from '@/lib/utils'

type ToastVariant = 'success' | 'error' | 'warning' | 'info'

interface Toast {
  id: number
  message: string
  variant: ToastVariant
}

/* ─── Module-level store ─── */
let toasts: Toast[] = []
let nextId = 0
const listeners = new Set<() => void>()

function emit() {
  listeners.forEach((l) => l())
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

function getSnapshot() {
  return toasts
}

export function addToast(message: string, variant: ToastVariant = 'info') {
  const id = nextId++
  toasts = [...toasts, { id, message, variant }]
  emit()

  setTimeout(() => {
    toasts = toasts.filter((t) => t.id !== id)
    emit()
  }, 4000)
}

function removeToast(id: number) {
  toasts = toasts.filter((t) => t.id !== id)
  emit()
}

/* ─── Variant styles ─── */
const variantStyles: Record<ToastVariant, string> = {
  success: 'border-l-[3px] border-l-[var(--color-accent)]',
  error: 'border-l-[3px] border-l-[var(--color-danger)]',
  warning: 'border-l-[3px] border-l-[var(--color-warning)]',
  info: 'border-l-[3px] border-l-[var(--color-info)]',
}

const variantDot: Record<ToastVariant, string> = {
  success: 'bg-[var(--color-accent)]',
  error: 'bg-[var(--color-danger)]',
  warning: 'bg-[var(--color-warning)]',
  info: 'bg-[var(--color-info)]',
}

/* ─── Component ─── */
export function ToastContainer() {
  const items = useSyncExternalStore(subscribe, getSnapshot)

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      toasts = []
      emit()
    }
  }, [])

  return (
    <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none">
      <AnimatePresence mode="popLayout">
        {items.map((toast) => (
          <motion.div
            key={toast.id}
            initial={{ opacity: 0, y: 16, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className={cn(
              'pointer-events-auto flex items-center gap-2 rounded-lg px-4 py-3 shadow-lg',
              'border border-[var(--color-border)] bg-[var(--color-bg-secondary)]',
              'min-w-[260px] max-w-[380px]',
              variantStyles[toast.variant]
            )}
          >
            <span className={cn('h-2 w-2 shrink-0 rounded-full', variantDot[toast.variant])} />
            <span className="text-sm text-[var(--color-text-primary)] flex-1">
              {toast.message}
            </span>
            <button
              onClick={() => removeToast(toast.id)}
              className="shrink-0 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors text-sm leading-none"
              aria-label="Dismiss"
            >
              {'×'}
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}
