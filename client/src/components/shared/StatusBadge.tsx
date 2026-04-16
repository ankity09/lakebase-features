import { cn } from '../../lib/utils';

type StatusType = 'active' | 'suspended' | 'starting' | 'error' | 'info';

interface StatusBadgeProps {
  status: StatusType;
  label?: string;
  className?: string;
}

const STATUS_CONFIG: Record<StatusType, { dot: string; text: string; bg: string; label: string }> = {
  active: {
    dot: 'bg-neon',
    text: 'text-neon',
    bg: 'bg-neon-glow',
    label: 'Active',
  },
  suspended: {
    dot: 'bg-warning',
    text: 'text-warning',
    bg: 'bg-warning/10',
    label: 'Suspended',
  },
  starting: {
    dot: 'bg-info',
    text: 'text-info',
    bg: 'bg-info/10',
    label: 'Starting',
  },
  error: {
    dot: 'bg-danger',
    text: 'text-danger',
    bg: 'bg-danger/10',
    label: 'Error',
  },
  info: {
    dot: 'bg-info',
    text: 'text-info',
    bg: 'bg-info/10',
    label: 'Info',
  },
};

export default function StatusBadge({ status, label, className }: StatusBadgeProps) {
  const config = STATUS_CONFIG[status];
  const displayLabel = label ?? config.label;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium',
        config.bg,
        config.text,
        className
      )}
    >
      <span className={cn('w-1.5 h-1.5 rounded-full flex-shrink-0', config.dot)} />
      {displayLabel}
    </span>
  );
}
