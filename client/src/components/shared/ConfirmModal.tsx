import { useCallback, useEffect } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { cn } from '@/lib/utils'

interface ConfirmModalProps {
  open: boolean
  onConfirm: () => void
  onCancel: () => void
  title: string
  message: string
  affectedRows?: number
  variant?: 'default' | 'danger'
}

export function ConfirmModal({
  open,
  onConfirm,
  onCancel,
  title,
  message,
  affectedRows,
  variant = 'default',
}: ConfirmModalProps) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!open) return
      if (e.key === 'Enter') {
        e.preventDefault()
        onConfirm()
      }
    },
    [open, onConfirm]
  )

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  const isDanger = variant === 'danger'

  return (
    <Dialog.Root open={open} onOpenChange={(v) => !v && onCancel()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm" />
        <Dialog.Content
          className={cn(
            'fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2',
            'w-full max-w-md rounded-xl border border-[var(--color-border)]',
            'bg-[var(--color-bg-secondary)] p-6 shadow-xl',
            'focus:outline-none'
          )}
        >
          <Dialog.Title className="text-lg font-bold text-[var(--color-text-primary)]">
            {title}
          </Dialog.Title>
          <Dialog.Description className="mt-2 text-sm text-[var(--color-text-secondary)]">
            {message}
          </Dialog.Description>

          {affectedRows != null && (
            <p className="mt-3 text-sm font-medium text-[var(--color-warning)]">
              This will affect {affectedRows.toLocaleString()} rows
            </p>
          )}

          <div className="mt-6 flex items-center justify-end gap-3">
            <button
              onClick={onCancel}
              className={cn(
                'rounded-lg px-4 py-2 text-sm font-medium transition-colors',
                'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]',
                'hover:bg-[var(--color-bg-hover)]'
              )}
            >
              Cancel
            </button>
            <button
              onClick={onConfirm}
              className={cn(
                'rounded-lg px-4 py-2 text-sm font-semibold text-white transition-colors',
                isDanger
                  ? 'bg-[var(--color-danger)] hover:bg-[var(--color-danger)]/80'
                  : 'bg-[var(--color-accent)] hover:bg-[var(--color-accent)]/80 text-[#0A0A0A]'
              )}
            >
              Confirm
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
