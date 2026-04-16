import type { Config } from 'tailwindcss'

export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        neon: '#00E599',
        'neon-glow': 'rgba(0, 229, 153, 0.15)',
        'surface-0': '#0A0A0A',
        'surface-1': '#131418',
        'surface-2': '#1A1B20',
        'surface-3': '#222328',
        'text-primary': '#F0F0F0',
        'text-secondary': '#A0A0A8',
        'text-muted': '#6B6B73',
        danger: '#EF4444',
        warning: '#F59E0B',
        info: '#06B6D4',
      },
      fontFamily: {
        sans: ['Plus Jakarta Sans', 'system-ui', 'sans-serif'],
        mono: ['Space Mono', 'monospace'],
      },
      borderRadius: {
        card: '12px',
      },
    },
  },
  plugins: [],
} satisfies Config
