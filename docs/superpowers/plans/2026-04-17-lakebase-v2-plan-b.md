# Lakebase Features v2 — Plan B: Recovery + AI Memory + Autoscaling

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the remaining 3 story pages (Recovery, AI Memory, Autoscaling) plus their 2 new backend routers (memory.py, loadtest.py) and seed data additions.

**Architecture:** Plan A delivered the React shell + 3 pages. Plan B adds 3 more pages + 2 new FastAPI routers. The existing v1 recovery router is reused. Memory router needs FMAPI integration. Loadtest router spawns background threads.

**Tech Stack:** Same as Plan A (React 18, TypeScript, Vite, Tailwind, Framer Motion, Recharts) + FMAPI for LLM/embeddings, threading for loadtest

**Spec:** `docs/superpowers/specs/2026-04-17-lakebase-features-v2-design.md`

**Working directory:** `/Users/ankit.yadav/Desktop/Databricks/lakebase-features/`

**Note:** Do NOT run npm install. All dependencies are already installed.

---

## Task 1: Seed Data — agent_memories + loadtest_events tables

**Files:**
- Modify: `app/services/seed.py`

- [ ] **Step 1: Add agent_memories table and seed data to seed.py**

At the end of `seed_if_needed()` (after the existing branch/endpoint creation), add:

```python
# Create agent_memories table for AI Memory page
logger.info("Creating agent_memories table...")
cur.execute("""
    CREATE TABLE IF NOT EXISTS appshield.agent_memories (
        id SERIAL PRIMARY KEY,
        content TEXT NOT NULL,
        memory_type VARCHAR(32),
        equipment_tag VARCHAR(64),
        importance FLOAT DEFAULT 0.5,
        embedding vector(384),
        access_count INT DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT NOW()
    )
""")
cur.execute("""
    CREATE INDEX IF NOT EXISTS idx_memories_hnsw
    ON appshield.agent_memories USING hnsw (embedding vector_cosine_ops)
""")
```

Insert 20 pre-seeded memories with random 384-dim normalized vectors (same pattern as event_embeddings). Content should be realistic maintenance knowledge:
- 5 failure_mode entries (hydraulic press leaks, CNC overheating, conveyor belt misalignment, etc.)
- 4 part_preference entries (specific seal brands, bearing types, etc.)
- 4 procedure entries (step-by-step repair instructions)
- 4 machine_quirk entries (equipment-specific behaviors)
- 3 vendor_info entries (supplier details, lead times)

Also create the loadtest scratch table:
```python
cur.execute("""
    CREATE TABLE IF NOT EXISTS appshield.loadtest_events (
        id SERIAL PRIMARY KEY,
        event_type VARCHAR(32),
        payload JSONB,
        created_at TIMESTAMPTZ DEFAULT NOW()
    )
""")
```

- [ ] **Step 2: Verify seed runs without error**

Test by checking if tables exist (won't re-seed since appshield schema already exists, but the table creation uses IF NOT EXISTS):
```bash
# The tables will be created on next app restart, or we can call the seed manually
```

- [ ] **Step 3: Commit**

```bash
git add app/services/seed.py
git commit -m "feat(v2): add agent_memories and loadtest_events tables to seed"
```

---

## Task 2: Memory Router — AI Memory Backend

**Files:**
- Create: `app/routers/memory.py`
- Modify: `app/main.py` (register router)

- [ ] **Step 1: Create `app/routers/memory.py`**

This router powers the AI Memory chat page. Read `app/routers/pgvector.py` for the `_embed_via_fmapi()` pattern.

Endpoints:

**POST /api/memory/chat** — Accept `{ message: str, history: list[dict] }`:
1. Embed the user message via FMAPI BGE-small (reuse pattern from pgvector.py)
2. Retrieve top 5 memories: `SELECT content, memory_type, equipment_tag, importance, 1 - (embedding <=> %s::vector) AS similarity FROM appshield.agent_memories ORDER BY embedding <=> %s::vector LIMIT 5`
3. Build system prompt with MaintBot persona + inject recalled memories
4. Call FMAPI chat endpoint (`FMAPI_CHAT_ENDPOINT` env var, default `databricks-claude-sonnet-4v`):
   ```python
   import httpx
   resp = httpx.post(
       f"{os.environ.get('DATABRICKS_HOST', '')}/serving-endpoints/{chat_endpoint}/invocations",
       headers={"Authorization": f"Bearer {_get_token()}"},
       json={"messages": [{"role": "system", "content": system_prompt}] + history + [{"role": "user", "content": message}]},
       timeout=30,
   )
   ```
   Use the SDK header factory for the token (same as db.py's `_generate_lakebase_token()`).
5. Extract new memories from the response (second LLM call with extraction prompt — wrap in try/except, non-blocking)
6. For each extracted memory: embed via FMAPI, insert into agent_memories
7. Return `{ response: str, recalled_memories: list, new_memories_stored: int }`

If FMAPI is unavailable, return a demo response: "I'm MaintBot, but my LLM backend isn't configured. Set FMAPI_CHAT_ENDPOINT in app.yaml to enable real conversations. Meanwhile, here's what I know from my memory..." + list the recalled memories.

**GET /api/memory/memories** — Return all memories: `SELECT id, content, memory_type, equipment_tag, importance, access_count, created_at FROM appshield.agent_memories ORDER BY created_at DESC`

**DELETE /api/memory/memories** — GDPR delete: `DELETE FROM appshield.agent_memories`. Return `{ deleted: count }`.

**GET /api/memory/export** — GDPR export: same as GET memories but returns as a downloadable JSON file with `Content-Disposition: attachment`.

- [ ] **Step 2: Register in main.py**

Add after the recovery router:
```python
from app.routers import memory; app.include_router(memory.router)
```

- [ ] **Step 3: Commit**

```bash
git add app/routers/memory.py app/main.py
git commit -m "feat(v2): add AI Memory router with FMAPI chat + pgvector memory recall"
```

---

## Task 3: Loadtest Router — Autoscaling Backend

**Files:**
- Create: `app/routers/loadtest.py`
- Modify: `app/main.py` (register router)

- [ ] **Step 1: Create `app/routers/loadtest.py`**

This router generates database traffic for the autoscaling demo.

Key design:
- Uses its **own dedicated psycopg2 connections** (not the shared pool from db.py)
- Creates 10 connections on start using `_generate_lakebase_token()` from db.py
- Background thread distributes queries round-robin across connections
- Ring buffer (collections.deque, maxlen=300) stores latency samples
- Thread-safe via threading.Lock on the state dict

State:
```python
_loadtest_state = {
    "running": False,
    "qps_target": 0,
    "total_queries": 0,
    "errors": 0,
    "start_time": None,
    "latency_history": deque(maxlen=300),  # list of {ts, p50, p99}
    "thread": None,
    "connections": [],
}
_lock = threading.Lock()
```

**POST /api/loadtest/start** — Accept `{ qps: int }` (capped at 200):
1. If already running, stop the existing thread first
2. Create 10 dedicated psycopg2 connections
3. Start a background thread that:
   - Runs in a loop, sleeping to maintain the target QPS
   - Each iteration: pick a random connection, run a query
   - Query mix: 80% `SELECT COUNT(*) FROM appshield.telemetry_events WHERE customer_id = %s` with random customer, 20% `INSERT INTO appshield.loadtest_events (event_type, payload) VALUES ('loadtest', '{"ts": ...}')`
   - Measure latency per query, append to a samples list
   - Every 3 seconds: compute p50/p99 from samples, append to latency_history ring buffer, clear samples
4. Return `{ status: "started", qps: N }`

**GET /api/loadtest/status** — Return current state:
```python
{
    "running": bool,
    "qps_target": int,
    "total_queries": int,
    "avg_latency_ms": float,
    "errors": int,
    "elapsed_seconds": float,
    "latency_history": list  # last 300 {ts, p50, p99} entries
}
```

**POST /api/loadtest/stop** — Stop the thread, close dedicated connections, reset state. Return `{ status: "stopped", total_queries: N }`.

- [ ] **Step 2: Register in main.py**

```python
from app.routers import loadtest; app.include_router(loadtest.router)
```

- [ ] **Step 3: Commit**

```bash
git add app/routers/loadtest.py app/main.py
git commit -m "feat(v2): add loadtest router with background traffic generator for autoscaling demo"
```

---

## Task 4: Recovery Page (React)

**Files:**
- Create: `client/src/components/pages/Recovery.tsx`
- Modify: `client/src/App.tsx` (add route)

- [ ] **Step 1: Create Recovery page**

Read existing shared components before building. Uses SplitLayout.

**Left panel:**
- StoryHeader: label "RECOVERY", title "Undo Anything, Instantly", subtitle "Point-in-time recovery to any second in the last 7 days"
- **Timeline visualization** (Framer Motion):
  - Horizontal bar (width 100%) representing 7 days
  - A green pin marker at the snapshot position (positioned proportionally)
  - A red marker at the disaster position
  - On restore: Framer Motion animates the bar "rewinding" — red section shrinks back to the pin
  - Implement as a div with relative positioning, pin/marker as absolute-positioned children
- BeforeAfter: before "Nightly backup restore — lose 4-24 hours, 2-4 hour downtime", after "Lakebase PITR — restore to any second, zero data loss, seconds not hours"

**Right panel:**
- **4-step guided flow** with step indicators (numbered circles, active one glows):
  1. **Verify** — show model_predictions row count from `GET /api/recovery/demo-table`. Button: "Verify Table"
  2. **Snapshot** — button: "Take Snapshot". Calls `POST /api/recovery/snapshot`. On success: green pin drops on timeline.
  3. **Corrupt** — button: "Delete All Data" (danger variant). Calls `POST /api/recovery/corrupt`. Table display goes red/empty.
  4. **Restore** — button: "Restore to Snapshot". Calls `POST /api/recovery/restore` with snapshot timestamp. Shows loading state ("Creating PITR branch..."). On success: timeline rewinds, data reappears.
- **Results card** (shown after restore): rows recovered, elapsed seconds, PITR branch used, method
- **Reset Demo** button to start over

State: `step` (1-5), `snapshot` (timestamp + row count), `tableData` (rows from demo table)

- [ ] **Step 2: Update App.tsx**

Replace Recovery placeholder route with `<Recovery />`.

- [ ] **Step 3: Verify build, DO NOT commit** (will commit with other pages)

---

## Task 5: AI Memory Page (React)

**Files:**
- Create: `client/src/components/pages/AiMemory.tsx`
- Modify: `client/src/App.tsx` (add route)

- [ ] **Step 1: Create AI Memory page**

Uses SplitLayout.

**Left panel:**
- StoryHeader: label "AI MEMORY", title "Your Agent Remembers Everything", subtitle "Persistent conversational memory powered by Lakebase + pgvector"
- ArchitectureDiagram: horizontal layout, 4 nodes:
  - User (👤) → Agent (🤖) → Lakebase (⚡, highlighted) → pgvector (🔍, sublabel "Semantic Recall")
  - activeNode set to "lakebase" when memories are recalled
- Memory type cards: 5 small cards in a grid showing the memory types with icons:
  - 🔧 failure_mode, 🔩 part_preference, 📋 procedure, ⚙️ machine_quirk, 📦 vendor_info
- InsightCard: "It's just a Postgres table with pgvector. Your agent's memory is a SQL query."
- **"Show SQL" toggle**: when toggled on, shows the actual SQL in a code block:
  ```sql
  SELECT content, memory_type, 1 - (embedding <=> query_vec) AS similarity
  FROM appshield.agent_memories
  ORDER BY embedding <=> query_vec LIMIT 5
  ```

**Right panel — split into chat (left) and memory panel (right):**
- Use a nested flex layout within the right panel: chat area (flex: 2) + memory sidebar (flex: 1, border-left)

**Chat area:**
- Scrollable message list (auto-scroll to bottom on new message)
- Message bubbles: user messages right-aligned (accent bg), bot messages left-aligned (bg-tertiary)
- Bot messages show "Recalled N memories" badge below the response
- Input at bottom: text input + Send button
- On send: POST `/api/memory/chat` with `{ message, history }`. Show typing indicator while waiting.
- If API fails: show a demo response explaining FMAPI isn't configured

**Memory sidebar:**
- Header: "Memories" + count badge
- List of memory cards, each showing: content (truncated), memory_type badge (StatusBadge), similarity score (if from a recall)
- Two tabs: "Recalled" (memories from last chat response) and "All" (from `GET /api/memory/memories`)
- GDPR buttons at bottom: "Export" (calls GET /api/memory/export, downloads JSON), "Delete All" (ConfirmModal → DELETE /api/memory/memories)

State: `messages` (chat history), `recalledMemories`, `allMemories`, `showSql` (boolean)

- [ ] **Step 2: Update App.tsx**

Replace AI Memory placeholder with `<AiMemory />`.

- [ ] **Step 3: Verify build, DO NOT commit**

---

## Task 6: Autoscaling Page (React)

**Files:**
- Create: `client/src/components/pages/Autoscaling.tsx`
- Modify: `client/src/App.tsx` (add route)

- [ ] **Step 1: Create Autoscaling page**

Uses SplitLayout.

**Left panel:**
- StoryHeader: label "AUTOSCALING", title "Watch It Scale Under Load", subtitle "Zero downtime, automatic compute adjustment"
- BeforeAfter: before "Manual resize — 5-15 min downtime, DBA pages, queries fail", after "Lakebase auto-scale — zero downtime, queries stay at <10ms"
- **Cost ticker card** (bg-tertiary, rounded-xl, p-4):
  - "Estimated Cost" label
  - Large $/hr value: `currentCU * 0.111` formatted to 2 decimals
  - Updates when CU changes
- **Key stat card** (shown during/after load test):
  - "Traffic spiked {baseQps}→{peakQps}. Latency stayed under {maxLatency}ms. Zero downtime."
  - Only visible when loadtest has run

**Right panel:**
- **Traffic Generator** card (bg-tertiary, rounded-xl, p-4):
  - Row of 5 buttons: Idle (0) / Light (10) / Medium (50) / Heavy (100) / Spike (200)
  - Active button: accent bg. Others: bg-hover.
  - On click: POST `/api/loadtest/start` with `{ qps: N }` (or POST `/api/loadtest/stop` for Idle)
  - Below buttons: progress bar showing current qps + "Running for Xs" timer
  - Below that: total queries counter + error count

- **CU Chart** (Recharts LineChart):
  - X axis: time (last 5 min)
  - Y axis: compute units
  - Line: accent color
  - Polls `GET /api/autoscaling` every 3 seconds, appends data point to chart
  - Shows min/max CU labels

- **Latency Chart** (Recharts LineChart):
  - X axis: time (matching CU chart)
  - Y axis: latency (ms)
  - Two lines: p50 (accent) and p99 (warning)
  - Data from `GET /api/loadtest/status` → `latency_history`
  - Polls every 3 seconds (same interval as CU chart)

- **Stop** button (danger variant, only when running)

State: `loadtestRunning`, `targetQps`, `cuHistory` (array of {time, cu}), `latencyHistory` (from API), `totalQueries`, `errors`, `elapsedSeconds`. Use `useInterval` for 3s polling when running.

- [ ] **Step 2: Update App.tsx**

Replace Autoscaling placeholder with `<Autoscaling />`.

- [ ] **Step 3: Verify build, DO NOT commit**

---

## Task 7: Build + Deploy

**Files:**
- Modify: `client/src/App.tsx` (all 3 routes should be updated by Tasks 4-6)

- [ ] **Step 1: Verify all routes in App.tsx**

Should have 6 real page components + no placeholders:
```tsx
import { Recovery } from '@/components/pages/Recovery'
import { AiMemory } from '@/components/pages/AiMemory'
import { Autoscaling } from '@/components/pages/Autoscaling'
```

- [ ] **Step 2: Build**

```bash
cd /Users/ankit.yadav/Desktop/Databricks/lakebase-features/client
npx vite build
```

- [ ] **Step 3: Commit everything**

```bash
cd /Users/ankit.yadav/Desktop/Databricks/lakebase-features
git add -A
git commit -m "feat(v2): add Recovery, AI Memory, Autoscaling pages + memory/loadtest backends"
```

- [ ] **Step 4: Deploy**

```bash
databricks sync . /Workspace/Users/ankit.yadav@databricks.com/lakebase-features-app --watch=false --profile stable-trvrmk
databricks apps deploy lakebase-features --source-code-path /Workspace/Users/ankit.yadav@databricks.com/lakebase-features-app --profile stable-trvrmk
```

- [ ] **Step 5: Verify**

Open https://lakebase-features-7474645545773789.aws.databricksapps.com and test all 6 pages.
