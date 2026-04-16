import { create } from 'zustand';
import { AnimatePresence, motion } from 'framer-motion';
import { X, CheckCircle, AlertCircle, AlertTriangle, Info } from 'lucide-react';
import { cn } from '../../lib/utils';

type ToastVariant = 'success' | 'error' | 'warning' | 'info';

interface ToastItem {
  id: string;
  message: string;
  variant: ToastVariant;
}

interface ToastState {
  toasts: ToastItem[];
  addToast: (message: string, variant?: ToastVariant) => void;
  removeToast: (id: string) => void;
}

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  addToast: (message, variant = 'info') => {
    const id = Math.random().toString(36).slice(2);
    set((state) => ({ toasts: [...state.toasts, { id, message, variant }] }));
    setTimeout(() => {
      set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }));
    }, 4000);
  },
  removeToast: (id) =>
    set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),
}));

export function toast(message: string, variant: ToastVariant = 'info') {
  useToastStore.getState().addToast(message, variant);
}

const VARIANT_CONFIG: Record<ToastVariant, { icon: typeof CheckCircle; color: string; bg: string }> = {
  success: { icon: CheckCircle, color: 'text-neon', bg: 'border-neon/30' },
  error: { icon: AlertCircle, color: 'text-danger', bg: 'border-danger/30' },
  warning: { icon: AlertTriangle, color: 'text-warning', bg: 'border-warning/30' },
  info: { icon: Info, color: 'text-info', bg: 'border-info/30' },
};

export default function ToastContainer() {
  const { toasts, removeToast } = useToastStore();

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2 pointer-events-none">
      <AnimatePresence mode="popLayout">
        {toasts.map((t) => {
          const config = VARIANT_CONFIG[t.variant];
          const Icon = config.icon;
          return (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.15 } }}
              className={cn(
                'pointer-events-auto flex items-start gap-3 px-4 py-3 rounded-card',
                'bg-surface-1 border shadow-xl max-w-sm',
                config.bg
              )}
            >
              <Icon size={16} className={cn('flex-shrink-0 mt-0.5', config.color)} />
              <p className="text-sm text-text-primary flex-1">{t.message}</p>
              <button
                onClick={() => removeToast(t.id)}
                className="text-text-muted hover:text-text-primary transition-colors flex-shrink-0"
              >
                <X size={14} />
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
