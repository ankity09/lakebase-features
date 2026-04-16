import { type KeyboardEvent } from 'react';
import { cn } from '../../lib/utils';

interface SqlEditorProps {
  value: string;
  onChange: (value: string) => void;
  onExecute?: () => void;
  placeholder?: string;
  className?: string;
  readOnly?: boolean;
}

export default function SqlEditor({
  value,
  onChange,
  onExecute,
  placeholder = 'SELECT * FROM ...',
  className,
  readOnly = false,
}: SqlEditorProps) {
  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      onExecute?.();
    }
  };

  return (
    <div className={cn('relative', className)}>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        readOnly={readOnly}
        spellCheck={false}
        style={{ fontFamily: "'Space Mono', monospace" }}
        className={cn(
          'w-full min-h-[200px] resize-y text-sm bg-surface-2 text-text-primary',
          'border border-surface-3 rounded-card p-4',
          'placeholder:text-text-muted',
          'focus:outline-none focus:border-neon focus:ring-1 focus:ring-neon/30',
          'transition-colors duration-150',
          readOnly && 'opacity-70 cursor-not-allowed'
        )}
      />
      {onExecute && (
        <div className="absolute bottom-3 right-3">
          <span className="text-xs text-text-muted">
            <kbd className="px-1 py-0.5 bg-surface-3 rounded font-mono text-[10px]">Ctrl</kbd>
            {' + '}
            <kbd className="px-1 py-0.5 bg-surface-3 rounded font-mono text-[10px]">Enter</kbd>
          </span>
        </div>
      )}
    </div>
  );
}
