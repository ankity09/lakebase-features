# Lakebase Features v2 — Design Spec

**Date:** 2026-04-17
**Author:** Ankit Yadav
**Status:** Draft

## Overview

A visual, story-driven React app that demonstrates 6 Lakebase features through guided real-world scenarios. Each page tells a before/after story with animated diagrams on the left and live interactive demos on the right. Backed by a real Lakebase instance. Swappable industry themes. Light/dark mode.

### Goals

1. Replace the v1 vanilla app with a React rebuild focused on storytelling over tooling
2. Make each feature's value immediately obvious through visual before/after comparisons
3. Support 4 industry themes from a single codebase (cybersecurity, supply chain, agriculture, manufacturing)
4. Serve both SA-driven demos and customer self-exploration

### Non-Goals

- Not a database admin tool (the MCP server handles that)
- No auth/multi-tenancy
- No Data Sync, Scale to Zero, Read Replicas, or standalone Monitoring pages (cut from v1)

## Architecture

```
React 18 + TypeScript + Vite (client/)
  |  /api/*
FastAPI (app/main.py) — existing routers from v1, enhanced
  |  psycopg2 + Lakebase REST API
Lakebase Autoscaling (existing instance)
```

The v1 backend routers remain largely intact. The frontend is a complete rewrite. `app/frontend/index.html` (v1) is replaced by `client/build/` (v2 React build).

### Deployment

- Same workspace: `fevm-serverless-stable-trvrmk`
- Same app name: `lakebase-features`
- Same Lakebase instance: `lakebase-features`
- v1 vanilla frontend stays available at `/v1/` (move `index.html` to `app/frontend/v1/`) as a fallback during migration

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + TypeScript (strict) |
| Bundler | Vite 6 |
| Styling | Tailwind CSS 4 with CSS variables for theming |
| UI primitives | Radix UI (Dialog, Tabs, Collapsible, Tooltip, Dropdown) |
| Animations | Framer Motion (architecture diagrams, data flow, page transitions) |
| Charts | Recharts (latency bars, autoscaling CU/latency live charts) |
| State | Zustand (theme, dark/light mode, connection status, page state) |
| Icons | Lucide React |
| HTTP | Axios via centralized `api.ts` |
| Code highlighting | highlight.js (SQL in Query Editor) |
| Backend | FastAPI (existing v1 routers) |
| Database | Lakebase via psycopg2 + REST API via databricks-sdk |

## Design Language

### Dark Mode (default)

| Token | Value | Usage |
|-------|-------|-------|
| `bg-primary` | #0A0A0A | Page background |
| `bg-secondary` | #111418 | Card backgrounds, diagram containers |
| `bg-tertiary` | #1A1B20 | Interactive panels, inputs |
| `bg-hover` | #222328 | Hover states, table rows |
| `border` | #2A2A32 | Subtle dividers |
| `text-primary` | #F0F0F0 | Headings, primary content |
| `text-secondary` | #A0A0A8 | Descriptions |
| `text-muted` | #6B6B73 | Placeholders, labels |
| `accent` | #00E599 | Primary accent (neon green) |
| `danger` | #EF4444 | "Old way", errors, destructive |
| `warning` | #F59E0B | Caution, Delta/batch latency |
| `info` | #06B6D4 | Informational |

### Light Mode

| Token | Value | Usage |
|-------|-------|-------|
| `bg-primary` | #FFFFFF | Page background |
| `bg-secondary` | #F7F8FA | Card backgrounds |
| `bg-tertiary` | #F0F1F3 | Interactive panels |
| `bg-hover` | #E8E9EC | Hover states |
| `border` | #D1D5DB | Dividers |
| `text-primary` | #111827 | Headings |
| `text-secondary` | #6B7280 | Descriptions |
| `text-muted` | #9CA3AF | Placeholders |
| `accent` | #059669 | Slightly darker green for light bg contrast |
| `danger` | #DC2626 | Errors |
| `warning` | #D97706 | Caution |
| `info` | #0891B2 | Informational |

Implementation: CSS variables on `:root` toggled via `data-theme="light"` on `<html>`. Persisted to localStorage.

### Typography

- **UI text:** Plus Jakarta Sans (400, 500, 600, 700)
- **Code / data / metrics:** Space Mono (400, 700)
- Story headers: 24px/700, section headers: 14px/600, body: 13px/400

### Conventions

- Card border-radius: 12px
- Loading states: skeleton shimmer (no spinners)
- Transitions: 200-300ms ease via Framer Motion
- No inline styles — Tailwind only
- Functional components only
- All components have TypeScript props interfaces

## App Shell

### Icon Rail (50px fixed left)

```
┌──────┐
│  LB  │  ← Logo
├──────┤
│  ⚡  │  Feature Store (active: neon glow)
│  🌿  │  Branching
│  💾  │  CRUD & Query
│  🔄  │  Recovery
│  🧠  │  AI Memory
│  📈  │  Autoscaling
├──────┤
│  🎨  │  Theme selector (dropdown on click)
│  ◐   │  Light/dark toggle
│  ●   │  Connection status dot
└──────┘
```

- Active page: icon has `accent` background glow + left border
- Hover: tooltip with page name (Radix Tooltip)
- Theme selector: Radix Dropdown with 4 options
- Light/dark toggle: moon/sun icon, instant swap
- Connection dot: green (connected), red (disconnected), polls `/api/health` every 30s

### Split Layout (every page)

```
┌──────┬──────────────────────┬──────────────────────┐
│ Rail │   LEFT: Visual Story │  RIGHT: Interactive  │
│ 50px │   flex: 1            │  flex: 1             │
│      │   padding: 24px      │  padding: 24px       │
│      │   border-right: 1px  │                      │
│      │   overflow-y: auto   │  overflow-y: auto    │
└──────┴──────────────────────┴──────────────────────┘
```

Left and right panels scroll independently. On screens < 1024px, stack vertically (left on top, right below).

## Theme System

A theme is a `ThemeConfig` object:

```typescript
interface ThemeConfig {
  id: string;                    // "cybersecurity" | "supply-chain" | "agriculture" | "manufacturing"
  name: string;                  // "Cybersecurity"
  icon: string;                  // "🛡️"
  entityName: string;            // "customer" | "shipment" | "farm" | "equipment"
  entityIdLabel: string;         // "Customer ID" | "Shipment ID" | "Farm ID" | "Equipment ID"
  tableName: string;             // "telemetry_events" | "shipment_tracking" | "crop_sensors" | "equipment_telemetry"
  featureTableName: string;      // "customer_features" | "shipment_features" | "crop_features" | "equipment_features"
  sampleEntities: string[];      // ["acme-corp", "globex-inc", ...] | ["SHIP-4521", "SHIP-8834", ...]
  featureLabels: Record<string, string>;  // Maps DB column names to display labels per theme
  sampleQueries: QueryTemplate[];
  accentColor?: string;          // Optional per-theme accent override
}
```

```typescript
interface QueryTemplate {
  name: string;        // "Top customers by request volume"
  description: string; // "Find the most active customers"
  sql: string;         // "SELECT customer_id, COUNT(*) ..."
}
```

All themes share the same Lakebase tables and data (the seed data uses the cybersecurity scenario). The theme only changes **labels and display names** — not the actual data. This means one seed, one database, works for all themes. Query templates are defined per-theme in `themes.ts` on the frontend — the backend's `GET /api/query/templates` is NOT used in v2 (templates are client-side).

Stored in Zustand, persisted to localStorage. Default: cybersecurity.

## Pages

### Page 1: Feature Store — "From Raw Data to Real-Time ML in 10ms"

**Left panel:**
- `StoryHeader`: "Feature Store" / "From Raw Data to Real-Time ML in 10ms"
- `ArchitectureDiagram`: Animated node graph (Framer Motion)
  - Nodes: Telemetry → Compute (5-min) → Delta Table (Offline) → [auto-sync] → Lakebase (Online) → ML Model → Customer Dashboard
  - Nodes glow green sequentially when user clicks "Lookup" on the right
  - Lakebase node is highlighted with accent border
- `BeforeAfter`:
  - Red: "Without Lakebase — ~500ms. Query Delta at request time. User sees spinner."
  - Green: "With Lakebase — ~7ms. Pre-synced. Instant lookup. 70x faster."
- `InsightCard`: "Same features, same data. Delta for training, Lakebase for serving. Platform syncs automatically."

**Right panel:**
- **Online Lookup** card: entity ID input (theme-aware label) + Lookup button → feature grid with latency badge
- **Latency Comparison** card: horizontal bar chart — Lakebase (green, tiny bar) vs Delta (amber, full bar) + "70x faster" callout
- **Feature Table** card: paginated data table, theme-aware column headers

**API endpoints (existing):** `GET /api/features/{id}`, `GET /api/features/{id}/batch`, `GET /api/features/table`

### Page 2: Branching — "Git for Your Database"

**Left panel:**
- `StoryHeader`: "Branching" / "Git for Your Database"
- `BranchTree`: Animated SVG branch visualization (Framer Motion)
  - Renders `main` → `dev`, `main` → `staging` with commit-style nodes
  - Grows when user creates a branch, prunes when they delete one
  - Nodes on dev branch show: "+3 columns", "+1 table"
  - Nodes on staging show: "+3 indexes", "+1 table"
- `ZeroCopyDiagram`: The page-level visualization (shared pages A,B,C → modified D' on branch) — 3-step walkthrough from v1
- `BeforeAfter`:
  - Red: "Clone entire database — hours, 2x storage, immediately stale"
  - Green: "Zero-copy branch — instant, 0 bytes, production-scale data"

**Right panel:**
- **Branches** card: list of branches with state badges, size, created date
- **Create Branch** button → inline form (name + parent selector)
- **Compare** button → select two branches → schema diff (green/amber/red cards from v1)
- **Delete** button with confirmation (disabled for production)

**API endpoints (existing):** `GET /api/branches`, `POST /api/branches`, `DELETE /api/branches/{name}`, `GET /api/branches/compare`, `POST /api/branches/setup-demo`

### Page 3: CRUD & Query — "Sub-10ms Postgres, Fully Managed"

**Left panel:**
- `StoryHeader`: "CRUD & Query" / "Sub-10ms Postgres, Fully Managed"
- `ComparisonSteps`: Animated split-screen
  - Left column "The Old Way": 15 greyed-out steps (provision RDS, configure security groups, set up parameter groups, create user, grant permissions, configure backups, set up monitoring, create tables, test connectivity...)
  - Right column "Lakebase": 3 steps with green checkmarks (Create project, Write SQL, Done)
  - Steps animate in with stagger on page load
- `InsightCard`: "Full Postgres SQL engine — transactions, indexes, CTEs, triggers, stored procedures. Not a limited API."

**Right panel:**
- **SQL Editor** card: textarea with highlight.js, Ctrl+Enter shortcut
- **Templates** dropdown: theme-aware pre-built queries
- **Execute** + **Explain** buttons
- **Results** table with latency badge and row count
- **Quick Actions** tabs: Read / Insert / Update / Delete (simplified from v1 CRUD page)

**API endpoints (existing):** `POST /api/query/execute`, `POST /api/query/explain`, `GET /api/query/templates`, `GET /api/tables`, `POST /api/tables/{table}/query`, etc.

### Page 4: Recovery — "Undo Anything, Instantly"

**Left panel:**
- `StoryHeader`: "Recovery" / "Undo Anything, Instantly"
- `Timeline`: Horizontal timeline bar showing 7 days
  - A green pin for the snapshot point
  - A red marker for the disaster point
  - Animated rewind when restore happens (timeline scrubs back to pin)
- `BeforeAfter`:
  - Red: "Nightly backup restore — lose 4-24 hours of data, 2-4 hour downtime"
  - Green: "Lakebase PITR — restore to any second, zero data loss, seconds not hours"

**Right panel:**
- **4-step guided flow** (same as v1 but refined):
  1. Verify data → show `model_predictions` row count
  2. Take snapshot → pin drops on timeline
  3. Simulate disaster → DELETE, table goes red/empty
  4. Restore → timeline rewinds, data flows back
- **Results** card: rows recovered, elapsed seconds, PITR branch used

**API endpoints (existing):** `GET /api/recovery/demo-table`, `POST /api/recovery/snapshot`, `POST /api/recovery/corrupt`, `POST /api/recovery/restore`

### Page 5: AI Memory — "Your Agent Remembers Everything"

**Left panel:**
- `StoryHeader`: "AI Memory" / "Your Agent Remembers Everything"
- `ArchitectureDiagram`: User → Agent → Lakebase (memories table) → pgvector (semantic recall)
- Memory type cards: `failure_mode`, `part_preference`, `procedure`, `machine_quirk`, `vendor_info`
- `InsightCard`: "It's just a Postgres table with pgvector. Your agent's memory is a SQL query."
- "Show SQL" toggle: reveals the actual `SELECT ... ORDER BY embedding <=> query_vec` query

**Right panel:**
- **Chat interface** (scrollable messages, input at bottom)
  - Maintenance bot persona: answers questions about equipment
  - Responses streamed from FMAPI (Claude Sonnet via Databricks)
  - Each response shows which memories were recalled
- **Memory panel** (collapsible right sidebar within the right panel):
  - Recalled memories with type badges + similarity scores
  - New memories stored during conversation
  - Total memory count
- **GDPR controls**: View All / Delete / Export buttons

**New API endpoints needed:**
- `POST /api/memory/chat` — send message, get response with recalled memories
- `GET /api/memory/memories` — list all stored memories
- `DELETE /api/memory/memories` — GDPR delete
- `GET /api/memory/export` — GDPR export as JSON

**New backend:** `app/routers/memory.py`

**LLM Integration Details:**
- Serving endpoint: `databricks-claude-sonnet` (via FMAPI). Env var: `FMAPI_CHAT_ENDPOINT` (defaults to `databricks-claude-sonnet-4v`).
- System prompt: maintenance bot persona — "You are MaintBot, an AI maintenance assistant for industrial equipment. You help technicians diagnose issues, recall past repairs, and suggest solutions. When you recall a memory, cite it. When you learn something new, note it."
- Memory injection: Retrieved memories are appended to the system prompt as a "## Your Maintenance Knowledge" section, formatted as numbered items with type badges and similarity scores.
- Memory extraction: After each assistant response, the router calls a second LLM call with the prompt "Extract any new maintenance knowledge from this conversation turn. Return JSON array of {content, memory_type, equipment_tag, importance}." If the LLM returns valid JSON, each item is embedded and stored.
- Embedding: Reuses `_embed_via_fmapi()` pattern from `app/routers/pgvector.py` — same `FMAPI_ENDPOINT` env var for BGE-small embeddings.
- Memory recall: `SELECT content, memory_type, equipment_tag, importance, 1 - (embedding <=> query_vec) AS similarity FROM appshield.agent_memories ORDER BY embedding <=> query_vec LIMIT 5` — returns top 5 most relevant memories.

**Chat flow per request:**
1. Embed the user message via FMAPI (384-dim)
2. Retrieve top 5 memories via pgvector cosine similarity
3. Inject memories into system prompt
4. Call FMAPI chat endpoint with system prompt + conversation history
5. Extract new memories from the response (async, non-blocking)
6. Return `{ response, recalled_memories, new_memories_stored }`

### Page 6: Autoscaling — "Watch It Scale Under Load"

**Left panel:**
- `StoryHeader`: "Autoscaling" / "Watch It Scale Under Load"
- `BeforeAfter`:
  - Red: "Manual resize — 5-15 min downtime, DBA pages, queries fail"
  - Green: "Lakebase auto-scale — zero downtime, queries stay at <10ms"
- **Cost ticker**: estimated $/hr at current CU level (updates live)
- **Key stat card** (updates during load test): "Traffic spiked Nx. Latency stayed under Yms. Zero downtime."

**Right panel:**
- **Traffic Generator** controls: Idle / Light (10 qps) / Medium (50 qps) / Heavy (200 qps) / Spike (500 qps) buttons
- **Progress bar**: active queries/sec + running timer
- **CU Chart** (Recharts line): compute units over time, polls `/api/autoscaling` every 3s
- **Latency Chart** (Recharts line): p50/p99 query latency from load test results
- **Stop** button

**New API endpoints needed:**
- `POST /api/loadtest/start` — `{ qps: number }` — spawns background thread running N queries/sec against Lakebase
- `GET /api/loadtest/status` — returns `{ running, qps, total_queries, avg_latency_ms, errors, elapsed_seconds, latency_history: [{ts, p50, p99}] }`
- `POST /api/loadtest/stop` — kills background thread

**New backend:** `app/routers/loadtest.py`
- Uses `threading.Thread` with its **own dedicated psycopg2 connections** (not from the shared pool) — creates 10 connections on start, distributes queries round-robin
- Shutdown hook registered via FastAPI lifespan to clean up thread + connections
- Max QPS capped at 200 (not 500) to avoid overwhelming a small Lakebase instance during demo. Button labels: Idle / Light (10) / Medium (50) / Heavy (100) / Spike (200)
- Query mix: 80% `SELECT COUNT(*) FROM appshield.telemetry_events WHERE customer_id = $1` (lightweight reads), 20% `INSERT INTO appshield.loadtest_events` (writes)
- Collects latency samples in a ring buffer (last 300 data points) for the chart

## Frontend File Structure

```
client/src/
├── App.tsx                        # Router + Shell
├── main.tsx                       # Entry point
├── index.css                      # Tailwind + CSS variables (dark/light)
├── lib/
│   ├── api.ts                     # Axios instance
│   ├── utils.ts                   # cn(), formatMs(), formatBytes()
│   └── themes.ts                  # ThemeConfig definitions for 4 themes
├── stores/
│   ├── appStore.ts                # Theme, darkMode, connectionStatus
│   └── loadtestStore.ts           # Autoscaling page load test state
├── types/
│   └── index.ts                   # All TypeScript interfaces
├── hooks/
│   ├── useApi.ts                  # Generic fetch hook
│   └── useInterval.ts             # Polling hook
├── components/
│   ├── shell/
│   │   ├── IconRail.tsx           # Left navigation rail
│   │   ├── SplitLayout.tsx        # Left/right panel wrapper
│   │   └── ThemeSelector.tsx      # Theme dropdown
│   ├── shared/
│   │   ├── StoryHeader.tsx        # Page title + subtitle
│   │   ├── ArchitectureDiagram.tsx # Animated node graph (Framer Motion)
│   │   ├── BeforeAfter.tsx        # Red/green comparison card
│   │   ├── InsightCard.tsx        # Lightbulb callout
│   │   ├── LatencyBadge.tsx       # Color-coded ms display
│   │   ├── DataTable.tsx          # Themed data table
│   │   ├── SqlEditor.tsx          # Textarea with highlighting
│   │   ├── ConfirmModal.tsx       # Radix Dialog for destructive actions
│   │   ├── StatusBadge.tsx        # State pills
│   │   ├── Skeleton.tsx           # Shimmer loading
│   │   └── Toast.tsx              # Notification toasts
│   └── pages/
│       ├── FeatureStore.tsx
│       ├── Branching.tsx
│       ├── CrudQuery.tsx
│       ├── Recovery.tsx
│       ├── AiMemory.tsx
│       └── Autoscaling.tsx
└── assets/                        # Static assets if any
```

## Backend Changes (v1 → v2)

### New Routers

| File | Endpoints | Purpose |
|------|-----------|---------|
| `app/routers/memory.py` | `POST /api/memory/chat`, `GET /api/memory/memories`, `DELETE /api/memory/memories`, `GET /api/memory/export` | AI Memory chatbot with FMAPI + pgvector |
| `app/routers/loadtest.py` | `POST /api/loadtest/start`, `GET /api/loadtest/status`, `POST /api/loadtest/stop` | Traffic generator for autoscaling demo |

### Modified Routers

| File | Change |
|------|--------|
| `app/main.py` | Mount `client/build/` instead of `app/frontend/`, register new routers |
| `app/services/seed.py` | Add `appshield.agent_memories` table + `appshield.loadtest_events` scratch table |

### Unchanged Routers

All existing routers (health, crud, query, sync, branching, infrastructure, feature_store, pgvector, monitoring, recovery) remain as-is.

## Seed Data Additions

```sql
-- AI Memory table
CREATE TABLE IF NOT EXISTS appshield.agent_memories (
    id SERIAL PRIMARY KEY,
    content TEXT NOT NULL,
    memory_type VARCHAR(32),
    equipment_tag VARCHAR(64),
    importance FLOAT DEFAULT 0.5,
    embedding vector(384),
    access_count INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_memories_hnsw
    ON appshield.agent_memories USING hnsw (embedding vector_cosine_ops);

-- Pre-seed 20 memories with random 384-dim normalized vectors (same as event_embeddings pattern)
-- Embeddings are placeholder random vectors. On first chat interaction, if FMAPI is available,
-- the router backfills real embeddings lazily. The embedding column is NOT NULL but the random
-- vectors ensure pgvector queries don't fail — they just return less relevant results until
-- real embeddings replace them.
-- Seed script generates these using the same _random_embedding() function used for event_embeddings.

-- Loadtest scratch table
CREATE TABLE IF NOT EXISTS appshield.loadtest_events (
    id SERIAL PRIMARY KEY,
    event_type VARCHAR(32),
    payload JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

## Migration: main.py Changes

```python
# v2 main.py mounting (replaces v1 vanilla frontend)
from app.routers import memory, loadtest
app.include_router(memory.router)
app.include_router(loadtest.router)

# v2 React SPA
build_dir = Path(__file__).parent.parent / "client" / "build"
if build_dir.exists():
    app.mount("/", StaticFiles(directory=str(build_dir), html=True), name="static")

# v1 fallback (optional, for transition period)
v1_dir = Path(__file__).parent / "frontend" / "v1"
if v1_dir.exists():
    app.mount("/v1", StaticFiles(directory=str(v1_dir), html=True), name="v1")
```

## Zustand Store (v2)

The v2 store replaces the v1 store entirely:

```typescript
interface AppState {
  theme: ThemeConfig;          // Active industry theme
  darkMode: boolean;           // Light/dark toggle
  connectionStatus: 'connected' | 'disconnected' | 'checking';
  setTheme: (theme: ThemeConfig) => void;
  toggleDarkMode: () => void;
  setConnectionStatus: (s: AppState['connectionStatus']) => void;
}
```

v1 fields `activePage` and `sidebarCollapsed` are removed — routing is handled by React Router, and the icon rail is always 50px (not collapsible).

## Quality Checklist

1. `cd client && npx tsc --noEmit` — zero TypeScript errors
2. `cd client && npm run build` — clean production build
3. All pages render in both dark and light mode
4. All pages adapt labels when theme is switched
5. Architecture diagrams animate on interaction
6. No white backgrounds in dark mode, no dark backgrounds in light mode
7. Responsive: stack vertically below 1024px
8. Loading states use skeleton shimmer
