# lakebase-features — Project CLAUDE.md

## Project Purpose
Interactive Lakebase feature showcase app using an **AppShield Analytics** scenario — a fictitious cybersecurity SaaS company that uses Databricks Lakebase (Postgres-compatible) as its operational database. The demo highlights Lakebase capabilities: branching, zero-ETL sync to Delta Lake, high-throughput OLTP, and point-in-time recovery.

## Tech Stack
- **Frontend**: React 18 + TypeScript + Vite + Tailwind CSS 3.x
- **UI Components**: shadcn/ui + Radix UI primitives
- **Animations**: Framer Motion
- **Charts**: Recharts + D3.js for custom viz
- **Backend**: FastAPI (Python 3.11+)
- **Database**: Lakebase (Postgres-compatible) via psycopg2
- **Deployment**: Databricks Apps via DABs (`databricks.yml`)

## Design Language
- **Theme**: Neon-on-dark — feels like a security operations center
- **Background**: `#0A0A0A` (near-black) to `#222328` (dark charcoal)
- **Primary accent**: `#00E599` (Databricks neon green)
- **Secondary accent**: `#FF6B35` (alert orange for anomaly indicators)
- **Tertiary accent**: `#8B5CF6` (violet for AI/ML features)
- **Surface**: `#111115` cards, `#1A1A1F` panels
- **Border**: `#2A2A32` subtle dividers
- **Text**: `#F5F5F7` primary, `#9CA3AF` secondary/muted

## Typography
- **UI text**: Plus Jakarta Sans (300, 400, 500, 600, 700)
- **Code / data values / metrics**: Space Mono (400, 700)
- **Headlines**: Plus Jakarta Sans 700 with tight letter-spacing

## Architecture
```
FastAPI backend  →  /api/*   (all API routes)
React frontend   →  /        (mounted from client/build/)
```

Standard mounting pattern in `app/main.py`:
```python
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

app = FastAPI()
api_app = FastAPI()
app.mount("/api", api_app)
app.mount("/", StaticFiles(directory="client/build", html=True), name="static")
```

## Project Structure
```
lakebase-features/
├── CLAUDE.md
├── app.yaml                   # Databricks Apps launch config
├── databricks.yml             # DABs bundle
├── requirements.txt
├── app/
│   ├── main.py                # FastAPI entry point
│   ├── routers/               # API route modules (one per feature)
│   ├── services/              # Business logic, DB helpers
│   └── models/                # Pydantic request/response models
├── client/                    # React frontend (Vite)
│   ├── package.json
│   ├── vite.config.ts
│   ├── tailwind.config.ts
│   └── src/
│       ├── App.tsx
│       ├── main.tsx
│       ├── components/
│       ├── hooks/
│       ├── lib/
│       ├── stores/
│       └── types/
└── tests/
```

## Build Commands
```bash
# Frontend
cd client && npm install
cd client && npm run dev          # Vite dev server (port 5173, proxies /api → 8000)
cd client && npm run build        # Output to client/build/
cd client && npx tsc --noEmit    # TypeScript check

# Backend
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000

# Deploy
databricks bundle deploy --target dev
```

## Lakebase Connection
All connection parameters are injected via environment variables defined in `app.yaml`:

| Env Var | Purpose |
|---------|---------|
| `PGHOST` | Lakebase host (from project credentials) |
| `PGPORT` | Default 5432 |
| `PGUSER` | Service principal or user token |
| `PGPASSWORD` | Databricks PAT or OAuth token |
| `PGDATABASE` | Target database (`appshield`) |
| `LAKEBASE_PROJECT_ID` | Lakebase project UUID |

Use `psycopg2.connect()` with these env vars. Never hard-code credentials.

## Frontend API Client
```typescript
// src/lib/api.ts
import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.DEV ? 'http://localhost:8000/api' : '/api',
});

export default api;
```

## Coding Conventions
- Functional components only, TypeScript strict mode
- Zustand for global state (not Redux, not Context for app state)
- Tailwind classes only — no inline styles, no CSS modules
- Every component has a TypeScript props interface
- Use `cn()` from `@/lib/utils` for conditional class merging
- API route modules named after Lakebase features (e.g., `routers/branching.py`, `routers/sync.py`)

## Lakebase Features to Showcase
1. **Branching** — Create/switch/merge database branches for safe schema migrations
2. **Zero-ETL Sync** — Automatic sync from Lakebase (Postgres) to Delta Lake tables
3. **High-Throughput OLTP** — Live write/read benchmarks showing Lakebase vs. vanilla Postgres
4. **Point-in-Time Recovery** — Restore DB state to any timestamp
5. **AI Query Assistant** — Natural language to SQL over Lakebase using FMAPI

## Quality Checklist
1. `cd client && npx tsc --noEmit` — zero TypeScript errors
2. `cd client && npm run build` — clean production build
3. Visual: dark neon aesthetic, no white backgrounds, no default browser styles
4. All Lakebase credentials loaded from env vars only
5. API errors surface gracefully in UI (toast notifications, not console.log)
