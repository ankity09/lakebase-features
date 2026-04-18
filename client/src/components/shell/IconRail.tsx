import { useEffect } from 'react'
import { NavLink } from 'react-router-dom'
import * as Tooltip from '@radix-ui/react-tooltip'
import {
  Zap,
  GitBranch,
  Database,
  RotateCcw,
  Brain,
  TrendingUp,
  Sun,
  Moon,
} from 'lucide-react'
import { useAppStore } from '@/stores/appStore'
import { useInterval } from '@/hooks/useInterval'
import api from '@/lib/api'
import { cn } from '@/lib/utils'
import { ThemeSelector } from '@/components/shell/ThemeSelector'

interface NavItem {
  to: string
  label: string
  icon: React.ComponentType<{ className?: string }>
}

const navItems: NavItem[] = [
  { to: '/feature-store', label: 'Feature Store', icon: Zap },
  { to: '/branching', label: 'Branching', icon: GitBranch },
  { to: '/crud', label: 'CRUD & Query', icon: Database },
  { to: '/recovery', label: 'Recovery', icon: RotateCcw },
  { to: '/ai-memory', label: 'AI Memory', icon: Brain },
  { to: '/autoscaling', label: 'Autoscaling', icon: TrendingUp },
]

function checkHealth(
  setConnectionStatus: (s: 'connected' | 'disconnected' | 'checking') => void
) {
  api
    .get('/health')
    .then(() => setConnectionStatus('connected'))
    .catch(() => setConnectionStatus('disconnected'))
}

export function IconRail() {
  const darkMode = useAppStore((s) => s.darkMode)
  const toggleDarkMode = useAppStore((s) => s.toggleDarkMode)
  const connectionStatus = useAppStore((s) => s.connectionStatus)
  const setConnectionStatus = useAppStore((s) => s.setConnectionStatus)

  useEffect(() => {
    checkHealth(setConnectionStatus)
  }, [setConnectionStatus])

  useInterval(() => {
    checkHealth(setConnectionStatus)
  }, 30_000)

  return (
    <Tooltip.Provider delayDuration={200}>
      <nav
        className={cn(
          'w-[50px] shrink-0 flex flex-col items-center py-4 gap-3',
          'bg-[var(--color-bg-secondary)] border-r border-[var(--color-border)]'
        )}
      >
        {/* Logo */}
        <span className="text-sm font-bold tracking-tight text-[var(--color-accent)] select-none mb-1">
          LB
        </span>

        {/* Nav icons */}
        {navItems.map(({ to, label, icon: Icon }) => (
          <Tooltip.Root key={to}>
            <Tooltip.Trigger asChild>
              <NavLink
                to={to}
                className={({ isActive }) =>
                  cn(
                    'flex h-8 w-8 items-center justify-center rounded-md transition-colors',
                    'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]',
                    'hover:bg-[var(--color-bg-hover)]',
                    isActive && [
                      'bg-[var(--color-accent-glow)] text-[var(--color-accent)]',
                      'border-l-2 border-[var(--color-accent)]',
                    ]
                  )
                }
              >
                <Icon className="h-4 w-4" />
              </NavLink>
            </Tooltip.Trigger>
            <Tooltip.Portal>
              <Tooltip.Content
                side="right"
                sideOffset={8}
                className={cn(
                  'z-50 rounded-md px-2.5 py-1 text-xs font-medium',
                  'bg-[var(--color-bg-tertiary)] text-[var(--color-text-primary)]',
                  'border border-[var(--color-border)]',
                  'shadow-md shadow-black/20'
                )}
              >
                {label}
              </Tooltip.Content>
            </Tooltip.Portal>
          </Tooltip.Root>
        ))}

        {/* Bottom section */}
        <div className="mt-auto flex flex-col items-center gap-3">
          {/* Theme selector */}
          <ThemeSelector />

          {/* Dark/light toggle */}
          <Tooltip.Root>
            <Tooltip.Trigger asChild>
              <button
                onClick={toggleDarkMode}
                className={cn(
                  'flex h-8 w-8 items-center justify-center rounded-md transition-colors',
                  'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]',
                  'hover:bg-[var(--color-bg-hover)]',
                  'focus:outline-none focus-visible:ring-1 focus-visible:ring-[var(--color-accent)]'
                )}
                aria-label={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
              >
                {darkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </button>
            </Tooltip.Trigger>
            <Tooltip.Portal>
              <Tooltip.Content
                side="right"
                sideOffset={8}
                className={cn(
                  'z-50 rounded-md px-2.5 py-1 text-xs font-medium',
                  'bg-[var(--color-bg-tertiary)] text-[var(--color-text-primary)]',
                  'border border-[var(--color-border)]',
                  'shadow-md shadow-black/20'
                )}
              >
                {darkMode ? 'Light mode' : 'Dark mode'}
              </Tooltip.Content>
            </Tooltip.Portal>
          </Tooltip.Root>

          {/* Connection status dot */}
          <Tooltip.Root>
            <Tooltip.Trigger asChild>
              <div
                className={cn(
                  'h-2.5 w-2.5 rounded-full transition-colors',
                  connectionStatus === 'connected' && 'bg-emerald-500',
                  connectionStatus === 'disconnected' && 'bg-red-500',
                  connectionStatus === 'checking' && 'bg-amber-500 animate-pulse'
                )}
                role="status"
                aria-label={`Connection: ${connectionStatus}`}
              />
            </Tooltip.Trigger>
            <Tooltip.Portal>
              <Tooltip.Content
                side="right"
                sideOffset={8}
                className={cn(
                  'z-50 rounded-md px-2.5 py-1 text-xs font-medium',
                  'bg-[var(--color-bg-tertiary)] text-[var(--color-text-primary)]',
                  'border border-[var(--color-border)]',
                  'shadow-md shadow-black/20'
                )}
              >
                {connectionStatus === 'connected' && 'Connected to Lakebase'}
                {connectionStatus === 'disconnected' && 'Disconnected'}
                {connectionStatus === 'checking' && 'Checking connection...'}
              </Tooltip.Content>
            </Tooltip.Portal>
          </Tooltip.Root>
        </div>
      </nav>
    </Tooltip.Provider>
  )
}
