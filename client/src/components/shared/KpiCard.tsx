import { type LucideIcon } from 'lucide-react';
import { cn } from '../../lib/utils';

interface KpiCardProps {
  label: string;
  value: string | number;
  icon?: LucideIcon;
  className?: string;
}

export default function KpiCard({ label, value, icon: Icon, className }: KpiCardProps) {
  return (
    <div
      className={cn(
        'rounded-card bg-surface-2 border border-surface-3 p-4 relative transition-all duration-150 hover:border-l-2 hover:border-neon group',
        className
      )}
    >
      {Icon && (
        <div className="absolute top-4 right-4">
          <Icon size={16} className="text-text-muted group-hover:text-neon transition-colors" />
        </div>
      )}
      <p className="text-xs font-medium text-text-secondary mb-1 uppercase tracking-wide">{label}</p>
      <p className="text-2xl font-bold text-text-primary font-mono">{value}</p>
    </div>
  );
}
