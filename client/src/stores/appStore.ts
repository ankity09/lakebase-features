import { create } from 'zustand'
import { themes, type ThemeConfig } from '@/lib/themes'

interface AppState {
  theme: ThemeConfig
  darkMode: boolean
  connectionStatus: 'connected' | 'disconnected' | 'checking'
  setTheme: (theme: ThemeConfig) => void
  toggleDarkMode: () => void
  setConnectionStatus: (s: AppState['connectionStatus']) => void
}

const savedThemeId = localStorage.getItem('theme') || 'cybersecurity'
const savedTheme = themes.find(t => t.id === savedThemeId) || themes[0]

export const useAppStore = create<AppState>((set) => ({
  theme: savedTheme,
  darkMode: localStorage.getItem('darkMode') !== 'false',
  connectionStatus: 'checking',
  setTheme: (theme) => {
    localStorage.setItem('theme', theme.id)
    set({ theme })
  },
  toggleDarkMode: () =>
    set((state) => {
      const next = !state.darkMode
      localStorage.setItem('darkMode', String(next))
      document.documentElement.setAttribute('data-theme', next ? 'dark' : 'light')
      return { darkMode: next }
    }),
  setConnectionStatus: (connectionStatus) => set({ connectionStatus }),
}))
