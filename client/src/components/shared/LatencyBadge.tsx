import { cn, formatMs } from '../../lib/utils';

interface LatencyBadgeProps {
  ms: number;
  className?: string;
}

export default function LatencyBadge({ ms, className }: LatencyBadgeProps) {
  const colorClass =
    ms < 10 ? 'text-neon bg-neon-glow' :
    ms < 100 ? 'text-warning bg-warning/10' :
    'text-danger bg-danger/10';

  return (
    <span
      className={cn(
        'inline-flex items-center px-2 py-0.5 rounded text-xs font-mono font-medium',
        colorClass,
        className
      )}
    >
      {formatMs(ms)}
    </span>
  );
}
