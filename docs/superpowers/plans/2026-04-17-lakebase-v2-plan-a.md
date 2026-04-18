# Lakebase Features v2 — Plan A: Foundation + First 3 Pages

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the Lakebase Features app as a React SPA with icon rail, split-view storytelling layout, theme system, dark/light mode, and the 3 most-demoed pages (Feature Store, Branching, CRUD & Query).

**Architecture:** React 18 + TypeScript + Vite frontend in `client/`. FastAPI backend unchanged (existing v1 routers). Icon rail (50px) + split layout (visual left, interactive right). 4 swappable industry themes. CSS variable-based dark/light mode.

**Tech Stack:** React 18, TypeScript (strict), Vite 6, Tailwind CSS 4, Radix UI, Framer Motion, Recharts, Zustand, Axios, Lucide React, highlight.js

**Spec:** `docs/superpowers/specs/2026-04-17-lakebase-features-v2-design.md`

**Working directory:** `/Users/ankit.yadav/Desktop/Databricks/lakebase-features/`

**Note:** npm is already installed at `client/node_modules/` with all dependencies. Do NOT run npm install — it takes 30+ minutes through the Databricks proxy.

---

## Task 1: Vite + React + Tailwind Scaffold

**Files:**
- Rewrite: `client/tsconfig.json` (replace v1 project-references with flat config; delete orphaned `tsconfig.node.json`)
- Rewrite: `client/vite.config.ts` (v2 config with Tailwind plugin + proxy)
- Rewrite: `client/index.html` (v2 entry with dark/light theme init)
- Rewrite: `client/src/main.tsx`
- Rewrite: `client/src/index.css` (v2 Tailwind + CSS variables)
- Rewrite: `client/src/App.tsx`
- Note: `client/package.json` already has correct build script (`vite build` → `client/build/`)

- [ ] **Step 1: Create Vite config**

```typescript
// client/vite.config.ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

import path from 'path'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  build: {
    outDir: 'build',
  },
  server: {
    proxy: {
      '/api': 'http://localhost:8000',
    },
  },
})
```

- [ ] **Step 2: Create TypeScript configs**

`tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "jsx": "react-jsx",
    "strict": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "noEmit": true,
    "isolatedModules": true,
    "skipLibCheck": true,
    "baseUrl": ".",
    "paths": { "@/*": ["src/*"] }
  },
  "include": ["src"]
}
```

- [ ] **Step 3: Create index.html entry point**

```html
<!DOCTYPE html>
<html lang="en" data-theme="dark">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Lakebase Features</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&family=Space+Mono:wght@400;700&display=swap" rel="stylesheet">
</head>
<body>
  <div id="root"></div>
  <script>
    // Initialize theme before React renders to prevent flash
    document.documentElement.setAttribute('data-theme',
      localStorage.getItem('darkMode') === 'false' ? 'light' : 'dark'
    );
  </script>
  <script type="module" src="/src/main.tsx"></script>
</body>
</html>
```

- [ ] **Step 4: Create index.css with Tailwind + CSS variables for dark/light mode**

```css
@import "tailwindcss";

@theme {
  /* Dark mode tokens (default) */
  --color-bg-primary: #0A0A0A;
  --color-bg-secondary: #111418;
  --color-bg-tertiary: #1A1B20;
  --color-bg-hover: #222328;
  --color-border: #2A2A32;
  --color-text-primary: #F0F0F0;
  --color-text-secondary: #A0A0A8;
  --color-text-muted: #6B6B73;
  --color-accent: #00E599;
  --color-accent-glow: rgba(0, 229, 153, 0.15);
  --color-danger: #EF4444;
  --color-warning: #F59E0B;
  --color-info: #06B6D4;
  --font-sans: 'Plus Jakarta Sans', system-ui, sans-serif;
  --font-mono: 'Space Mono', monospace;
}

body {
  background: var(--color-bg-primary);
  color: var(--color-text-primary);
  font-family: var(--font-sans);
  -webkit-font-smoothing: antialiased;
  margin: 0;
}

/* Light mode overrides */
[data-theme="light"] {
  --color-bg-primary: #FFFFFF;
  --color-bg-secondary: #F7F8FA;
  --color-bg-tertiary: #F0F1F3;
  --color-bg-hover: #E8E9EC;
  --color-border: #D1D5DB;
  --color-text-primary: #111827;
  --color-text-secondary: #6B7280;
  --color-text-muted: #9CA3AF;
  --color-accent: #059669;
  --color-accent-glow: rgba(5, 150, 105, 0.12);
  --color-danger: #DC2626;
  --color-warning: #D97706;
  --color-info: #0891B2;
}

/* Scrollbar */
::-webkit-scrollbar { width: 6px; height: 6px; }
::-webkit-scrollbar-track { background: var(--color-bg-secondary); }
::-webkit-scrollbar-thumb { background: var(--color-bg-hover); border-radius: 3px; }

/* Skeleton shimmer */
@keyframes shimmer {
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}
.skeleton {
  background: linear-gradient(90deg, var(--color-bg-tertiary) 25%, var(--color-bg-hover) 50%, var(--color-bg-tertiary) 75%);
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
  border-radius: 6px;
}
```

- [ ] **Step 5: Create main.tsx and minimal App.tsx**

```tsx
// client/src/main.tsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
```

```tsx
// client/src/App.tsx
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'

export default function App() {
  return (
    <BrowserRouter>
      <div style={{ display: 'flex', minHeight: '100vh' }}>
        <div style={{ width: 50, background: 'var(--color-bg-secondary)', borderRight: '1px solid var(--color-border)' }}>
          {/* Icon Rail placeholder */}
        </div>
        <div style={{ flex: 1, padding: 24 }}>
          <Routes>
            <Route path="/" element={<Navigate to="/feature-store" />} />
            <Route path="/feature-store" element={<div>Feature Store</div>} />
            <Route path="/branching" element={<div>Branching</div>} />
            <Route path="/crud" element={<div>CRUD & Query</div>} />
          </Routes>
        </div>
      </div>
    </BrowserRouter>
  )
}
```

- [ ] **Step 6: Verify build**

```bash
cd /Users/ankit.yadav/Desktop/Databricks/lakebase-features/client
npx vite build
ls build/
```
Expected: `build/index.html` + `build/assets/`

- [ ] **Step 7: Commit**

```bash
cd /Users/ankit.yadav/Desktop/Databricks/lakebase-features
git add client/
git commit -m "feat(v2): scaffold React + Vite + Tailwind with dark/light CSS variables"
```

---

## Task 2: Zustand Store, Types, API Client, Utils, Themes

**Files:**
- Create: `client/src/stores/appStore.ts`
- Create: `client/src/types/index.ts`
- Create: `client/src/lib/api.ts`
- Create: `client/src/lib/utils.ts`
- Create: `client/src/lib/themes.ts`
- Create: `client/src/hooks/useApi.ts`
- Create: `client/src/hooks/useInterval.ts`

- [ ] **Step 1: Create themes (must be created before the store imports it)**

Create `client/src/lib/themes.ts` with the `ThemeConfig` interface, `QueryTemplate` interface, and the 4 theme definitions (cybersecurity, supply-chain, agriculture, manufacturing) as shown in Step 2 below. This file must exist before appStore.ts is created.

- [ ] **Step 2: Create Zustand store**

```typescript
// client/src/stores/appStore.ts
import { create } from 'zustand'
import { themes, type ThemeConfig } from '../lib/themes'

interface AppState {
  theme: ThemeConfig
  darkMode: boolean
  connectionStatus: 'connected' | 'disconnected' | 'checking'
  setTheme: (theme: ThemeConfig) => void
  toggleDarkMode: () => void
  setConnectionStatus: (s: AppState['connectionStatus']) => void
}

export const useAppStore = create<AppState>((set) => ({
  theme: themes[0], // cybersecurity default
  darkMode: localStorage.getItem('darkMode') !== 'false', // default dark
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
```

- [ ] **Step 3: Themes file (full content)**

The themes file created in Step 1 should contain this full implementation:

```typescript
// client/src/lib/themes.ts
export interface QueryTemplate {
  name: string
  description: string
  sql: string
}

export interface ThemeConfig {
  id: string
  name: string
  icon: string
  entityName: string
  entityIdLabel: string
  tableName: string
  featureTableName: string
  sampleEntities: string[]
  featureLabels: Record<string, string>
  sampleQueries: QueryTemplate[]
}

export const themes: ThemeConfig[] = [
  {
    id: 'cybersecurity',
    name: 'Cybersecurity',
    icon: '🛡️',
    entityName: 'customer',
    entityIdLabel: 'Customer ID',
    tableName: 'telemetry_events',
    featureTableName: 'customer_features',
    sampleEntities: ['acme-corp', 'globex-inc', 'initech-systems', 'stark-industries', 'widget-co'],
    featureLabels: {
      hsts_present: 'HSTS Enabled',
      unique_ips_5min: 'Unique IPs (5m)',
      request_count_5min: 'Request Count (5m)',
      avg_payload_bytes: 'Avg Payload',
      cookie_diversity_score: 'Cookie Diversity',
      geo_diversity_score: 'Geo Diversity',
    },
    sampleQueries: [
      { name: 'Top customers by volume', description: 'Most active customers', sql: 'SELECT customer_id, COUNT(*) as request_count FROM appshield.telemetry_events GROUP BY customer_id ORDER BY request_count DESC LIMIT 10' },
      { name: 'HSTS adoption rate', description: 'Percentage of requests with HSTS', sql: 'SELECT ROUND(100.0 * SUM(CASE WHEN hsts_present THEN 1 ELSE 0 END) / COUNT(*), 1) as hsts_pct FROM appshield.telemetry_events' },
      { name: 'Error rate by region', description: 'HTTP 4xx/5xx by region', sql: "SELECT region, COUNT(*) as total, SUM(CASE WHEN response_code >= 400 THEN 1 ELSE 0 END) as errors FROM appshield.telemetry_events GROUP BY region ORDER BY errors DESC" },
    ],
  },
  {
    id: 'supply-chain',
    name: 'Supply Chain',
    icon: '🚛',
    entityName: 'shipment',
    entityIdLabel: 'Shipment ID',
    tableName: 'telemetry_events',
    featureTableName: 'customer_features',
    sampleEntities: ['SHIP-4521', 'SHIP-8834', 'SHIP-2291', 'SHIP-6677', 'SHIP-1105'],
    featureLabels: {
      hsts_present: 'Cold Chain OK',
      unique_ips_5min: 'Route Deviations (5m)',
      request_count_5min: 'Sensor Readings (5m)',
      avg_payload_bytes: 'Avg Payload (kg)',
      cookie_diversity_score: 'Carrier Score',
      geo_diversity_score: 'Route Diversity',
    },
    sampleQueries: [
      { name: 'Active shipments', description: 'Most active shipments by sensor volume', sql: 'SELECT customer_id as shipment_id, COUNT(*) as readings FROM appshield.telemetry_events GROUP BY customer_id ORDER BY readings DESC LIMIT 10' },
      { name: 'Temperature excursions', description: 'Cold chain violations', sql: "SELECT customer_id as shipment_id, COUNT(*) as excursions FROM appshield.telemetry_events WHERE response_code >= 400 GROUP BY customer_id ORDER BY excursions DESC LIMIT 10" },
    ],
  },
  {
    id: 'agriculture',
    name: 'Agriculture',
    icon: '🌾',
    entityName: 'farm',
    entityIdLabel: 'Farm ID',
    tableName: 'telemetry_events',
    featureTableName: 'customer_features',
    sampleEntities: ['farm-midwest-07', 'farm-central-12', 'farm-pacific-03', 'farm-south-21', 'farm-plains-09'],
    featureLabels: {
      hsts_present: 'Irrigation Active',
      unique_ips_5min: 'Sensor Nodes (5m)',
      request_count_5min: 'Readings (5m)',
      avg_payload_bytes: 'Soil Moisture',
      cookie_diversity_score: 'Crop Health Index',
      geo_diversity_score: 'Field Coverage',
    },
    sampleQueries: [
      { name: 'Active farms', description: 'Farms by sensor activity', sql: 'SELECT customer_id as farm_id, COUNT(*) as readings FROM appshield.telemetry_events GROUP BY customer_id ORDER BY readings DESC LIMIT 10' },
    ],
  },
  {
    id: 'manufacturing',
    name: 'Manufacturing',
    icon: '🏭',
    entityName: 'equipment',
    entityIdLabel: 'Equipment ID',
    tableName: 'telemetry_events',
    featureTableName: 'customer_features',
    sampleEntities: ['HP-L4-001', 'CNC-M2-014', 'ROB-A7-003', 'CONV-B1-008', 'WELD-C3-012'],
    featureLabels: {
      hsts_present: 'Safety Check OK',
      unique_ips_5min: 'Alert Count (5m)',
      request_count_5min: 'Sensor Events (5m)',
      avg_payload_bytes: 'Vibration Index',
      cookie_diversity_score: 'Uptime Score',
      geo_diversity_score: 'Line Coverage',
    },
    sampleQueries: [
      { name: 'Equipment by alerts', description: 'Most active equipment', sql: 'SELECT customer_id as equipment_id, COUNT(*) as events FROM appshield.telemetry_events GROUP BY customer_id ORDER BY events DESC LIMIT 10' },
    ],
  },
]
```

- [ ] **Step 4: Create API client, utils, types, hooks**

`client/src/lib/api.ts` — Axios instance with baseURL from env, error interceptor with console.error.

`client/src/lib/utils.ts` — `cn()` (clsx + twMerge), `formatMs()`, `formatBytes()`.

`client/src/types/index.ts` — TypeScript interfaces matching backend Pydantic models: HealthResponse, OverviewStats, QueryResponse, FeatureLookupResponse, BranchInfo, BranchCompareResponse, TableInfo, ColumnInfo, etc. Reuse the same interfaces from v1 types.

`client/src/hooks/useApi.ts` — Generic fetch hook returning `{ data, loading, error, refetch }`.

`client/src/hooks/useInterval.ts` — Polling hook with start/stop.

- [ ] **Step 5: Commit**

```bash
git add client/src/
git commit -m "feat(v2): add Zustand store, 4 themes, API client, types, hooks"
```

---

## Task 3: Icon Rail + Split Layout + Theme/Dark Mode

**Files:**
- Create: `client/src/components/shell/IconRail.tsx`
- Create: `client/src/components/shell/SplitLayout.tsx`
- Create: `client/src/components/shell/ThemeSelector.tsx`
- Modify: `client/src/App.tsx`

- [ ] **Step 1: Create IconRail**

50px fixed left rail with:
- "LB" logo text at top (accent color)
- 6 NavLink icons using Lucide React (Zap, GitBranch, Database, RotateCcw, Brain, TrendingUp)
- Active state: `bg-accent-glow` + left border accent
- Hover: Radix Tooltip with page name
- Bottom section: ThemeSelector dropdown + dark/light toggle (Sun/Moon icon) + connection status dot
- Uses `useLocation()` for active state detection
- Add `useInterval` hook polling `/api/health` every 30s. On success: `setConnectionStatus('connected')`. On error: `setConnectionStatus('disconnected')`.

**Note on v1 files:** Old v1 component files under `client/src/components/features/`, `layout/`, and `shared/` from the earlier npm attempt remain in the tree. Leave them — they don't affect the v2 build and will be cleaned up when v2 is stable.

- [ ] **Step 2: Create ThemeSelector**

Radix DropdownMenu triggered by the current theme icon. Lists 4 themes. Clicking one calls `appStore.setTheme()`.

- [ ] **Step 3: Create SplitLayout**

```tsx
interface SplitLayoutProps {
  left: React.ReactNode
  right: React.ReactNode
}
```

Flexbox container: left panel (flex: 1, border-right, overflow-y: auto, padding: 24px) + right panel (flex: 1, overflow-y: auto, padding: 24px). On screens < 1024px: flex-direction: column.

- [ ] **Step 4: Update App.tsx**

Wrap routes in the shell: IconRail on left, route content on right. Each route renders inside SplitLayout. Add placeholder components for the 3 pages.

- [ ] **Step 5: Verify dev server**

```bash
cd client && npx vite
# Open http://localhost:5173
# Should see icon rail with 6 icons, clicking navigates between placeholder pages
# Theme selector changes theme name in console
# Dark/light toggle swaps colors
```

- [ ] **Step 6: Commit**

```bash
git add client/src/
git commit -m "feat(v2): add IconRail, SplitLayout, ThemeSelector, dark/light toggle"
```

---

## Task 4: Shared Components

**Files:**
- Create: `client/src/components/shared/StoryHeader.tsx`
- Create: `client/src/components/shared/BeforeAfter.tsx`
- Create: `client/src/components/shared/InsightCard.tsx`
- Create: `client/src/components/shared/LatencyBadge.tsx`
- Create: `client/src/components/shared/DataTable.tsx`
- Create: `client/src/components/shared/StatusBadge.tsx`
- Create: `client/src/components/shared/SqlEditor.tsx`
- Create: `client/src/components/shared/ConfirmModal.tsx`
- Create: `client/src/components/shared/Skeleton.tsx`
- Create: `client/src/components/shared/Toast.tsx`

- [ ] **Step 1: Create StoryHeader**

Props: `title: string`, `subtitle: string`, `label?: string`. Renders: uppercase accent label, large title (24px/700), subtitle (13px, text-secondary).

- [ ] **Step 2: Create BeforeAfter**

Props: `before: { title, stat, description }`, `after: { title, stat, description }`. Renders two side-by-side cards: left with danger border + red stat, right with accent border + green stat.

- [ ] **Step 3: Create InsightCard**

Props: `children: React.ReactNode`. Card with lightbulb emoji prefix, bg-tertiary background, subtle border.

- [ ] **Step 4: Create LatencyBadge**

Props: `ms: number`. Green badge if <10ms, yellow if 10-100ms, red if >100ms. Shows formatted value via `formatMs()`.

- [ ] **Step 5: Create DataTable**

Props: `columns: string[]`, `rows: Record<string, any>[]`, `loading?: boolean`, `maxRows?: number`. Renders a styled HTML table with sticky header, row hover, monospace data cells. Shows Skeleton when loading.

- [ ] **Step 6: Create remaining shared components**

`StatusBadge` — colored pill (active/suspended/starting/error).
`SqlEditor` — textarea with monospace font, Ctrl+Enter handler, highlight.js for SQL.
`ConfirmModal` — Radix Dialog with confirm/cancel, danger variant.
`Skeleton` — div with `.skeleton` CSS class.
`Toast` — Zustand-based toast system with Framer Motion AnimatePresence.

- [ ] **Step 7: Commit**

```bash
git add client/src/components/shared/
git commit -m "feat(v2): add all shared components (StoryHeader, BeforeAfter, DataTable, etc.)"
```

---

## Task 5: Feature Store Page

**Files:**
- Create: `client/src/components/pages/FeatureStore.tsx`
- Create: `client/src/components/shared/ArchitectureDiagram.tsx` (reusable — used by Feature Store and later by AI Memory in Plan B)

- [ ] **Step 1: Create shared ArchitectureDiagram**

Reusable Framer Motion animated node-and-arrow diagram component:

```tsx
interface DiagramNode {
  id: string
  icon: string
  label: string
  sublabel?: string
  highlighted?: boolean  // accent border + glow
}

interface ArchitectureDiagramProps {
  nodes: DiagramNode[]
  activeNode?: string  // which node is glowing
  layout?: 'horizontal' | 'two-row'  // two-row for Feature Store (pipeline + serving)
}
```

Framer Motion animated architecture diagram:
- 7 nodes: Telemetry → Compute → Delta Table → [auto-sync] → Lakebase → ML Model → Customer Dashboard
- Each node is a styled div with icon + label
- Arrows between nodes using CSS/SVG
- Accepts `activeNode?: string` prop — when set, that node and its incoming arrow glow green
- Lakebase node always has accent border

- [ ] **Step 2: Create FeatureStore page**

Uses SplitLayout:

**Left panel:**
- StoryHeader: title from theme config
- FeatureStoreDiagram (activeNode updates when user interacts on right)
- BeforeAfter: ~500ms (old) vs ~7ms (Lakebase)
- InsightCard: "Same features, same data..."

**Right panel:**
- **Online Lookup card:** entity ID input (label from theme), Lookup button, results grid with LatencyBadge. Calls `GET /api/features/{id}`.
- **Latency Comparison card:** two horizontal bars (Recharts BarChart) — Lakebase vs Delta. Shows Nx faster. Calls `GET /api/features/{id}/batch` for Delta latency.
- **Feature Table card:** DataTable with pagination. Calls `GET /api/features/table`.

When lookup succeeds: set `activeNode="lakebase"` on the diagram to trigger the glow animation.

- [ ] **Step 3: Add route to App.tsx**

Replace placeholder with `<FeatureStore />`.

- [ ] **Step 4: Verify**

```bash
cd client && npx vite
# Open http://localhost:5173/feature-store
# Should see split layout with architecture diagram on left, interactive panel on right
# Lookup should hit the real API (if backend is running on :8000)
```

- [ ] **Step 5: Commit**

```bash
git add client/src/
git commit -m "feat(v2): add Feature Store page with animated architecture diagram and live lookups"
```

---

## Task 6: Branching Page

**Files:**
- Create: `client/src/components/pages/Branching.tsx`
- Create: `client/src/components/diagrams/BranchTree.tsx`
- Create: `client/src/components/diagrams/ZeroCopyDiagram.tsx`
- Create: `client/src/components/branching/BranchDiff.tsx`

- [ ] **Step 1: Create BranchTree**

Framer Motion animated SVG showing git-style branch lines:
- Accepts `branches: BranchInfo[]` prop
- Renders `main` as horizontal line, other branches as diagonal offshoots
- Each branch has a colored node + label + state badge
- AnimatePresence for branches appearing/disappearing

- [ ] **Step 2: Create ZeroCopyDiagram**

The 3-step page visualization from v1 ported to React + Framer Motion:
- Step 1: Single production with pages A,B,C,D,E (all green)
- Step 2: Two branches, same pages (blue arrow, "0 bytes" callout)
- Step 3: Modified D' and new F on dev branch (amber highlight)
- KPI cards: 0 bytes, <1 sec, Full scale, Isolated

- [ ] **Step 3: Create BranchDiff**

Accepts `diff: BranchCompareResponse` prop. Renders:
- Summary badges (tables added/removed, columns changed, indexes)
- Tables Added section (green cards)
- Column Changes section (amber, +/- per column)
- Indexes section (cyan, monospace SQL definitions)
- Row counts comparison table

- [ ] **Step 4: Create Branching page**

Uses SplitLayout:

**Left:**
- StoryHeader
- BranchTree (updates when branches change)
- ZeroCopyDiagram (collapsible section)
- BeforeAfter: clone (hours, 2x storage) vs branch (instant, 0 bytes)

**Right:**
- Branch list with StatusBadge per branch
- Create Branch: inline form → `POST /api/branches`
- Compare: two dropdowns → `GET /api/branches/compare?base=X&target=Y` → BranchDiff
- Delete: ConfirmModal → `DELETE /api/branches/{name}?confirm=true`

- [ ] **Step 5: Add route, verify, commit**

```bash
git add client/src/
git commit -m "feat(v2): add Branching page with branch tree, zero-copy diagram, and schema diff"
```

---

## Task 7: CRUD & Query Page

**Files:**
- Create: `client/src/components/pages/CrudQuery.tsx`
- Create: `client/src/components/diagrams/ComparisonSteps.tsx`

- [ ] **Step 1: Create ComparisonSteps**

Animated split-screen comparison (Framer Motion staggered reveal):
- Left column "The Old Way": 12 greyed-out steps with step numbers, each fades in with stagger delay
- Right column "Lakebase": 3 steps with green checkmarks, animate in faster
- Visual punchline: right column finishes before left column is halfway done

Steps for "Old Way": Provision instance → Configure security groups → Set parameter groups → Create IAM role → Configure backups → Set up monitoring → Create database → Create user → Grant permissions → Configure connection pooling → Create tables → Test connectivity

Steps for "Lakebase": Create project → Write SQL → Done ✓

- [ ] **Step 2: Create CrudQuery page**

Uses SplitLayout:

**Left:**
- StoryHeader
- ComparisonSteps
- InsightCard: "Full Postgres SQL engine — transactions, indexes, CTEs, triggers. Not a limited API."

**Right:**
- **SQL Editor card:** SqlEditor component + Execute button (Ctrl+Enter) + Explain toggle
- **Templates dropdown:** populated from active theme's `sampleQueries`
- **Results card:** DataTable with LatencyBadge + row count
- **Quick Actions tabs** (Radix Tabs): Read / Insert / Update / Delete
  - Read: table selector + filter inputs → `POST /api/tables/{table}/query`
  - Insert: dynamic form from schema → `POST /api/tables/{table}/insert`
  - Update/Delete: WHERE builder + ConfirmModal

- [ ] **Step 3: Add route, verify, commit**

```bash
git add client/src/
git commit -m "feat(v2): add CRUD & Query page with comparison steps and live SQL editor"
```

---

## Task 8: Update main.py + Build + Deploy

**Files:**
- Modify: `app/main.py` — mount `client/build/` at `/`, move v1 to `/v1/`
- Move: `app/frontend/index.html` → `app/frontend/v1/index.html`

- [ ] **Step 1: Move v1 frontend**

```bash
mkdir -p app/frontend/v1
mv app/frontend/index.html app/frontend/v1/index.html
```

- [ ] **Step 2: Update main.py**

Change the static mount to serve from `client/build/`:
```python
# v2 React SPA
build_dir = Path(__file__).parent.parent / "client" / "build"
if build_dir.exists():
    app.mount("/", StaticFiles(directory=str(build_dir), html=True), name="static")
```

Add v1 fallback:
```python
# v1 fallback
v1_dir = Path(__file__).parent / "frontend" / "v1"
if v1_dir.exists():
    app.mount("/v1", StaticFiles(directory=str(v1_dir), html=True), name="v1")
```

- [ ] **Step 3: Build React frontend**

```bash
cd client
npx vite build
ls build/
```

- [ ] **Step 4: Test locally**

```bash
# In one terminal:
cd /Users/ankit.yadav/Desktop/Databricks/lakebase-features
PGHOST=... uvicorn app.main:app --reload --port 8000

# Open http://localhost:8000 — should see v2 React app
# Open http://localhost:8000/v1/ — should see v1 vanilla app (fallback)
```

- [ ] **Step 5: Deploy**

```bash
databricks sync . /Workspace/Users/ankit.yadav@databricks.com/lakebase-features-app --watch=false --profile stable-trvrmk
databricks apps deploy lakebase-features --source-code-path /Workspace/Users/ankit.yadav@databricks.com/lakebase-features-app --profile stable-trvrmk
```

- [ ] **Step 6: Verify live app**

Open https://lakebase-features-7474645545773789.aws.databricksapps.com — v2 React app.
Open https://lakebase-features-7474645545773789.aws.databricksapps.com/v1/ — v1 fallback.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat(v2): build React frontend, update main.py mount, deploy"
```
