import { create } from 'zustand';

interface AppState {
  activePage: string;
  sidebarCollapsed: boolean;
  connectionStatus: 'connected' | 'disconnected' | 'checking';
  setActivePage: (page: string) => void;
  toggleSidebar: () => void;
  setConnectionStatus: (status: AppState['connectionStatus']) => void;
}

export const useAppStore = create<AppState>((set) => ({
  activePage: 'overview',
  sidebarCollapsed: localStorage.getItem('sidebar-collapsed') === 'true',
  connectionStatus: 'checking',
  setActivePage: (page) => set({ activePage: page }),
  toggleSidebar: () =>
    set((state) => {
      const collapsed = !state.sidebarCollapsed;
      localStorage.setItem('sidebar-collapsed', String(collapsed));
      return { sidebarCollapsed: collapsed };
    }),
  setConnectionStatus: (status) => set({ connectionStatus: status }),
}));
