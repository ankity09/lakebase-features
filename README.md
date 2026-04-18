# Lakebase Features

Interactive showcase app for [Databricks Lakebase](https://docs.databricks.com/aws/en/oltp/) — a fully managed, serverless Postgres with branching, autoscaling, and lakehouse integration.

Built as a Databricks App with React + FastAPI, connected to a live Lakebase instance. Every interaction hits real APIs against real data.

**Live demo:** [lakebase-features-7474645545773789.aws.databricksapps.com](https://lakebase-features-7474645545773789.aws.databricksapps.com)

> **Note:** This is a demo app built to showcase Lakebase features in an interactive, visual way. For production use, Databricks provides a full-featured [Lakebase UI](https://docs.databricks.com/aws/en/oltp/projects/) with built-in branch management, monitoring, permissions, and point-in-time restore.

---

## Features

Six story-driven pages, each demonstrating a Lakebase capability through a guided before/after narrative with live data:

| Page | What It Shows | Key Demo Moment |
|------|--------------|-----------------|
| **Feature Store** | Sub-10ms ML feature serving via Lakebase vs batch Delta lookups | Side-by-side latency comparison: 7ms (Lakebase) vs 500ms (Delta) |
| **Branching** | Zero-copy database branches for safe schema migrations | Create a branch, compare schemas, see the diff — all instant |
| **CRUD & Query** | Full Postgres SQL engine with sub-10ms latency | "15 steps with RDS" vs "3 steps with Lakebase" animated comparison |
| **Recovery** | Point-in-time restore to any second in the last 7 days | Delete all data, restore from a timestamp, watch it come back |
| **AI Memory** | Persistent agent memory with pgvector semantic recall | Chat with MaintBot, see memories recalled and stored in real-time |
| **Autoscaling** | Dynamic compute scaling under load | Generate traffic, watch latency stay flat while connections spike |

### Additional capabilities

- **4 industry themes** — switch between Cybersecurity, Supply Chain, Agriculture, and Manufacturing. Each theme has its own schema, tables, and realistic seed data.
- **Dark / Light mode** — toggle in the icon rail
- **Real Lakebase instance** — all queries hit a live Lakebase Autoscaling project with millions of rows

## Architecture

```
React 18 + TypeScript + Vite       FastAPI (Python)           Lakebase Autoscaling
┌─────────────────────────┐   ┌──────────────────────┐   ┌─────────────────────────┐
│  Icon Rail (50px)       │   │  /api/health         │   │  appshield schema       │
│  SplitLayout            │──>│  /api/features/*     │──>│    5M telemetry events   │
│    Left: Visual Story   │   │  /api/branches/*     │   │    600K features         │
│    Right: Interactive   │   │  /api/query/*        │   │  supply_chain schema     │
│  Theme Selector         │   │  /api/recovery/*     │   │  agriculture schema      │
│  Dark/Light Toggle      │   │  /api/memory/*       │   │  manufacturing schema    │
│                         │   │  /api/loadtest/*     │   │    500K rows each        │
└─────────────────────────┘   └──────────────────────┘   └─────────────────────────┘
         client/build/               app/                    Lakebase (Postgres)
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, TypeScript, Vite 6, Tailwind CSS 4, Framer Motion, Recharts, Radix UI, Zustand |
| Backend | FastAPI, psycopg2, databricks-sdk, httpx |
| Database | Lakebase Autoscaling (Postgres 16), pgvector 0.8.0 |
| LLM | Databricks FMAPI (Claude Sonnet 4.6 for chat, BGE-large for embeddings) |
| Deployment | Databricks Apps |

## Project Structure

```
lakebase-features/
├── app/
│   ├── main.py                    # FastAPI entry, SPA catch-all
│   ├── static/                    # React build output (served at /)
│   ├── routers/
│   │   ├── health.py              # Health check + overview stats
│   │   ├── feature_store.py       # Feature lookups (online + batch)
│   │   ├── branching.py           # Branch CRUD, compare, PITR setup
│   │   ├── crud.py                # Table operations (read/insert/update/delete)
│   │   ├── query.py               # SQL execution, EXPLAIN, templates
│   │   ├── recovery.py            # Snapshot + PITR restore workflow
│   │   ├── memory.py              # AI Memory chat (FMAPI + pgvector)
│   │   ├── loadtest.py            # Traffic generator for autoscaling demo
│   │   ├── infrastructure.py      # Autoscaling config, scale-to-zero, replicas
│   │   ├── pgvector.py            # Vector similarity search
│   │   ├── monitoring.py          # TPS, connections, cache metrics
│   │   └── sync.py                # Data sync (architecture reference)
│   ├── services/
│   │   ├── db.py                  # Connection pool, OAuth token generation
│   │   ├── lakebase_api.py        # Databricks SDK WorkspaceClient singleton
│   │   └── seed.py                # Schema creation + sample data generation
│   └── models/
│       └── schemas.py             # Pydantic request/response models
├── client/
│   ├── src/
│   │   ├── App.tsx                # Router + shell
│   │   ├── components/
│   │   │   ├── shell/             # IconRail, SplitLayout, ThemeSelector
│   │   │   ├── shared/            # StoryHeader, BeforeAfter, ArchitectureDiagram, etc.
│   │   │   └── pages/             # FeatureStore, Branching, CrudQuery, Recovery, AiMemory, Autoscaling
│   │   ├── stores/appStore.ts     # Zustand (theme, dark mode, connection status)
│   │   ├── lib/themes.ts          # 4 industry theme configs
│   │   └── hooks/                 # useApi, useInterval
│   └── build/                     # Vite production build
├── scripts/
│   ├── bulk_seed.py               # Seed 5M+ rows via COPY
│   └── seed_industry_data.py      # Seed industry-specific schemas
├── app.yaml                       # Databricks Apps config
├── databricks.yml                 # DABs bundle
└── requirements.txt
```

## Setup

### Prerequisites

- A Databricks workspace with Lakebase enabled
- Databricks CLI v0.262+ (v0.285+ for `postgres` commands)
- Python 3.11+
- Node.js 18+ (only for frontend development)

### 1. Create a Lakebase instance

```bash
databricks database create-database-instance --json '{
  "name": "lakebase-features",
  "capacity": "CU_1"
}' --profile YOUR_PROFILE
```

### 2. Deploy the app

```bash
# Clone
git clone https://github.com/ankity09/lakebase-features.git
cd lakebase-features

# Deploy via DABs
databricks bundle deploy --target dev --profile YOUR_PROFILE

# Or sync + deploy directly
databricks sync . /Workspace/Users/YOUR_EMAIL/lakebase-features-app \
  --watch=false --profile YOUR_PROFILE
databricks apps deploy lakebase-features \
  --source-code-path /Workspace/Users/YOUR_EMAIL/lakebase-features-app \
  --profile YOUR_PROFILE
```

### 3. Attach Lakebase resource

```bash
databricks apps update lakebase-features --json '{
  "resources": [{
    "name": "lakebase_db",
    "database": {
      "instance_name": "lakebase-features",
      "database_name": "databricks_postgres",
      "permission": "CAN_CONNECT_AND_CREATE"
    }
  }]
}' --profile YOUR_PROFILE
```

### 4. Grant SP permissions

The app's service principal needs:
- **Can Manage** on the Lakebase project (for branch creation, autoscaling config)
- **Postgres role + security label** on each branch endpoint (for SQL access)

```bash
# Grant Can Manage via API
databricks api patch /api/2.0/permissions/database-projects/lakebase-features \
  --json '{"access_control_list":[{
    "service_principal_name":"YOUR_APP_SP_UUID",
    "permission_level":"CAN_MANAGE"
  }]}' --profile YOUR_PROFILE
```

For Postgres role setup, see the app's `/api/debug/env` endpoint to find the SP UUID, then run:

```sql
SECURITY LABEL FOR databricks_auth ON ROLE "SP_UUID"
  IS 'id=SCIM_ID,type=service_principal';
GRANT ALL ON SCHEMA appshield TO "SP_UUID";
GRANT ALL ON ALL TABLES IN SCHEMA appshield TO "SP_UUID";
```

### 5. Seed data (optional, for large dataset)

The app auto-seeds 50K rows on first startup. For the full 5M row dataset (needed for autoscaling demo):

```bash
pip install psycopg2-binary databricks-sdk
python scripts/bulk_seed.py --profile YOUR_PROFILE --telemetry-rows 5000000
python scripts/seed_industry_data.py --profile YOUR_PROFILE
```

## Local Development

```bash
# Backend
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000

# Frontend (separate terminal)
cd client
npm install --legacy-peer-deps  # First time only
npm run dev                      # Vite dev server on :5173, proxies /api to :8000
```

## Lakebase Documentation

- [Lakebase overview](https://docs.databricks.com/aws/en/oltp/)
- [Lakebase Autoscaling](https://docs.databricks.com/aws/en/oltp/projects/about)
- [Branches](https://docs.databricks.com/aws/en/oltp/projects/branches)
- [Point-in-time restore](https://docs.databricks.com/aws/en/oltp/projects/point-in-time-restore)
- [Autoscaling](https://docs.databricks.com/aws/en/oltp/projects/autoscaling)
- [Scale to zero](https://docs.databricks.com/aws/en/oltp/projects/scale-to-zero)
- [Lakehouse Sync](https://docs.databricks.com/aws/en/oltp/projects/lakehouse-sync)
- [Pricing](https://docs.databricks.com/aws/en/oltp/projects/pricing)
- [API guide](https://docs.databricks.com/aws/en/oltp/projects/api-usage)
- [Get started tutorial](https://docs.databricks.com/aws/en/oltp/projects/get-started)

## License

Internal use only. Databricks Field Engineering.
