import { type KeyboardEvent } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { AlertTriangle, X } from 'lucide-react';
import { cn } from '../../lib/utils';

interface ConfirmModalProps {
  open: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  title: string;
  message: string;
  affectedRows?: number;
  variant?: 'default' | 'danger';
}

export default function ConfirmModal({
  open,
  onConfirm,
  onCancel,
  title,
  message,
  affectedRows,
  variant = 'default',
}: ConfirmModalProps) {
  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      onConfirm();
    }
  };

  return (
    <Dialog.Root open={open} onOpenChange={(o) => !o && onCancel()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50" />
        <Dialog.Content
          onKeyDown={handleKeyDown}
          className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-md"
        >
          <div className="bg-surface-1 border border-surface-3 rounded-card p-6 shadow-xl">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                {variant === 'danger' && (
                  <div className="w-9 h-9 rounded-full bg-danger/10 flex items-center justify-center flex-shrink-0">
                    <AlertTriangle size={18} className="text-danger" />
                  </div>
                )}
                <Dialog.Title className="text-base font-semibold text-text-primary">
                  {title}
                </Dialog.Title>
              </div>
              <button
                onClick={onCancel}
                className="text-text-muted hover:text-text-primary transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            <Dialog.Description className="text-sm text-text-secondary mb-4">
              {message}
            </Dialog.Description>

            {affectedRows !== undefined && (
              <div className="mb-4 px-3 py-2 bg-surface-2 border border-surface-3 rounded-md">
                <p className="text-xs text-text-muted">
                  Affected rows:{' '}
                  <span className="font-mono font-bold text-text-primary">{affectedRows.toLocaleString()}</span>
                </p>
              </div>
            )}

            <p className="text-xs text-text-muted mb-4">
              Press <kbd className="px-1.5 py-0.5 bg-surface-3 rounded text-text-secondary font-mono">Enter</kbd> to confirm,{' '}
              <kbd className="px-1.5 py-0.5 bg-surface-3 rounded text-text-secondary font-mono">Esc</kbd> to cancel.
            </p>

            <div className="flex gap-3 justify-end">
              <button
                onClick={onCancel}
                className="px-4 py-2 text-sm text-text-secondary hover:text-text-primary bg-surface-2 hover:bg-surface-3 border border-surface-3 rounded-md transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={onConfirm}
                className={cn(
                  'px-4 py-2 text-sm font-medium rounded-md transition-colors',
                  variant === 'danger'
                    ? 'bg-danger hover:bg-danger/80 text-white'
                    : 'bg-neon hover:bg-neon/80 text-surface-0'
                )}
              >
                Confirm
              </button>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
