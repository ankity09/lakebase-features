import { useNavigate, useLocation } from 'react-router-dom';
import {
  Database,
  Terminal,
  RefreshCw,
  GitBranch,
  Gauge,
  Power,
  Layers,
  Zap,
  Search,
  Activity,
  LayoutDashboard,
  ChevronLeft,
  ChevronRight,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { useAppStore } from '../../stores/appStore';

interface NavItem {
  label: string;
  path: string;
  icon: LucideIcon;
}

interface NavGroup {
  title: string;
  items: NavItem[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    title: 'DATA OPERATIONS',
    items: [
      { label: 'Overview', path: '/overview', icon: LayoutDashboard },
      { label: 'CRUD Operations', path: '/crud', icon: Database },
      { label: 'Query Editor', path: '/query', icon: Terminal },
      { label: 'Data Sync', path: '/sync', icon: RefreshCw },
    ],
  },
  {
    title: 'INFRASTRUCTURE',
    items: [
      { label: 'Branching', path: '/branching', icon: GitBranch },
      { label: 'Autoscaling', path: '/autoscaling', icon: Gauge },
      { label: 'Scale to Zero', path: '/scale-to-zero', icon: Power },
      { label: 'Read Replicas', path: '/replicas', icon: Layers },
    ],
  },
  {
    title: 'AI / ML',
    items: [
      { label: 'Feature Store', path: '/feature-store', icon: Zap },
      { label: 'pgvector Search', path: '/pgvector', icon: Search },
    ],
  },
  {
    title: 'OBSERVABILITY',
    items: [
      { label: 'Monitoring', path: '/monitoring', icon: Activity },
    ],
  },
];

export default function Sidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { sidebarCollapsed, toggleSidebar, connectionStatus } = useAppStore();

  const statusColor = {
    connected: 'bg-neon',
    disconnected: 'bg-danger',
    checking: 'bg-warning',
  }[connectionStatus];

  return (
    <aside
      className={cn(
        'fixed left-0 top-0 h-full flex flex-col bg-surface-1 border-r border-surface-3 transition-all duration-300 z-40',
        sidebarCollapsed ? 'w-[60px]' : 'w-[240px]'
      )}
    >
      {/* Brand header */}
      <div className="flex items-center gap-3 px-4 py-5 border-b border-surface-3 min-h-[64px]">
        <div className="relative flex-shrink-0">
          <div
            className={cn('w-2.5 h-2.5 rounded-full', statusColor)}
            title={`Connection: ${connectionStatus}`}
          />
          {connectionStatus === 'connected' && (
            <div className="absolute inset-0 w-2.5 h-2.5 rounded-full bg-neon animate-ping opacity-75" />
          )}
        </div>
        {!sidebarCollapsed && (
          <span className="text-sm font-semibold text-text-primary truncate tracking-tight">
            Lakebase Features
          </span>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4 space-y-6">
        {NAV_GROUPS.map((group) => (
          <div key={group.title}>
            {!sidebarCollapsed && (
              <p className="px-4 mb-1 text-[10px] font-semibold tracking-widest text-text-muted uppercase">
                {group.title}
              </p>
            )}
            <ul className="space-y-0.5">
              {group.items.map((item) => {
                const isActive = location.pathname === item.path;
                const Icon = item.icon;
                return (
                  <li key={item.path}>
                    <button
                      onClick={() => navigate(item.path)}
                      title={sidebarCollapsed ? item.label : undefined}
                      className={cn(
                        'w-full flex items-center gap-3 px-4 py-2 text-sm font-medium transition-all duration-150',
                        isActive
                          ? 'text-neon bg-neon-glow border-l-2 border-neon pl-[14px]'
                          : 'text-text-secondary hover:text-text-primary hover:bg-surface-2',
                        sidebarCollapsed && 'justify-center px-0'
                      )}
                    >
                      <Icon size={16} className="flex-shrink-0" />
                      {!sidebarCollapsed && (
                        <span className="truncate">{item.label}</span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* Collapse toggle */}
      <div className="border-t border-surface-3 p-2">
        <button
          onClick={toggleSidebar}
          className="w-full flex items-center justify-center p-2 rounded-md text-text-muted hover:text-text-primary hover:bg-surface-2 transition-colors"
          title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {sidebarCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
      </div>
    </aside>
  );
}
