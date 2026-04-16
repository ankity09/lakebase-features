import { type ReactNode, useState, useEffect } from 'react';
import * as Collapsible from '@radix-ui/react-collapsible';
import { ChevronDown, HelpCircle } from 'lucide-react';
import { cn } from '../../lib/utils';

interface ExplainerCardProps {
  pageKey: string;
  title?: string;
  children: ReactNode;
}

export default function ExplainerCard({ pageKey, title = 'What is this?', children }: ExplainerCardProps) {
  const storageKey = `explainer-${pageKey}`;
  const [open, setOpen] = useState(() => {
    const stored = localStorage.getItem(storageKey);
    return stored === null ? true : stored === 'true';
  });

  useEffect(() => {
    localStorage.setItem(storageKey, String(open));
  }, [open, storageKey]);

  return (
    <Collapsible.Root open={open} onOpenChange={setOpen}>
      <div className="rounded-card bg-surface-2 border border-surface-3">
        <Collapsible.Trigger asChild>
          <button className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-surface-3 transition-colors rounded-card">
            <div className="flex items-center gap-2">
              <HelpCircle size={14} className="text-neon flex-shrink-0" />
              <span className="text-sm font-medium text-text-secondary">{title}</span>
            </div>
            <ChevronDown
              size={14}
              className={cn(
                'text-text-muted transition-transform duration-200',
                open && 'rotate-180'
              )}
            />
          </button>
        </Collapsible.Trigger>
        <Collapsible.Content>
          <div className="px-4 pb-4 pt-1 text-sm text-text-secondary leading-relaxed border-t border-surface-3">
            {children}
          </div>
        </Collapsible.Content>
      </div>
    </Collapsible.Root>
  );
}
