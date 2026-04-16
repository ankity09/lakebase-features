import { RefreshCw, ExternalLink } from 'lucide-react';
import { cn } from '../../lib/utils';

interface HeaderProps {
  title: string;
  docsUrl?: string;
  onRefresh?: () => void;
  isRefreshing?: boolean;
}

export default function Header({ title, docsUrl, onRefresh, isRefreshing = false }: HeaderProps) {
  return (
    <header className="flex items-center justify-between px-6 py-4 bg-surface-1 border-b border-surface-3 min-h-[64px]">
      <h1 className="text-base font-semibold text-text-primary tracking-tight">
        {title}
      </h1>
      <div className="flex items-center gap-3">
        {docsUrl && (
          <a
            href={docsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-xs text-text-muted hover:text-neon transition-colors"
          >
            <ExternalLink size={13} />
            <span>Docs</span>
          </a>
        )}
        {onRefresh && (
          <button
            onClick={onRefresh}
            disabled={isRefreshing}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs text-text-secondary hover:text-text-primary hover:bg-surface-2 border border-surface-3 hover:border-text-muted transition-all disabled:opacity-50"
          >
            <RefreshCw size={13} className={cn(isRefreshing && 'animate-spin')} />
            <span>Refresh</span>
          </button>
        )}
      </div>
    </header>
  );
}
