import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { Check } from 'lucide-react'
import { useAppStore } from '@/stores/appStore'
import { themes } from '@/lib/themes'
import { cn } from '@/lib/utils'

export function ThemeSelector() {
  const currentTheme = useAppStore((s) => s.theme)
  const setTheme = useAppStore((s) => s.setTheme)

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          className={cn(
            'flex h-8 w-8 items-center justify-center rounded-md text-sm',
            'hover:bg-[var(--color-bg-hover)] transition-colors',
            'focus:outline-none focus-visible:ring-1 focus-visible:ring-[var(--color-accent)]'
          )}
          aria-label="Select theme"
        >
          {currentTheme.icon}
        </button>
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content
          side="right"
          sideOffset={8}
          className={cn(
            'z-50 min-w-[160px] rounded-lg p-1',
            'bg-[var(--color-bg-secondary)] border border-[var(--color-border)]',
            'shadow-lg shadow-black/30',
            'animate-in fade-in-0 zoom-in-95'
          )}
        >
          {themes.map((theme) => (
            <DropdownMenu.Item
              key={theme.id}
              onSelect={() => setTheme(theme)}
              className={cn(
                'flex items-center gap-2 rounded-md px-2 py-1.5 text-xs cursor-pointer',
                'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]',
                'hover:bg-[var(--color-bg-hover)] outline-none',
                'transition-colors',
                theme.id === currentTheme.id && 'text-[var(--color-accent)]'
              )}
            >
              <span className="w-5 text-center">{theme.icon}</span>
              <span className="flex-1">{theme.name}</span>
              {theme.id === currentTheme.id && (
                <Check className="h-3 w-3 text-[var(--color-accent)]" />
              )}
            </DropdownMenu.Item>
          ))}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  )
}
