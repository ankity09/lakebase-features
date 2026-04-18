# Lakebase Features v2 — Product Vision

## What This App Is

A visual, story-driven showcase app that demonstrates Lakebase features through real-world scenarios. It's not a tool — it's a guided experience that helps customers understand WHY each feature matters, not just WHAT it does.

## Design Principles

1. **Show, don't tell** — Every feature is demonstrated through a guided scenario with animated visuals, not a wall of text with buttons
2. **Before/after** — Each scenario shows the "old way" (painful) vs the "Lakebase way" (elegant)
3. **Real data, real APIs** — Everything hits a live Lakebase instance. No mocks.
4. **The customer does it** — Semi-guided: the story frames the context, the customer makes the key actions. They feel ownership of the experience.
5. **One app, multiple industries** — Theme selector swaps the data scenario (cybersecurity, supply chain, agriculture, manufacturing) while keeping the same feature pages

## Target Audience

- SAs demoing to customers live (primary)
- Customers exploring independently after the demo (secondary)
- Both technical and business stakeholders in the room

## Core Message

"Lakebase is Postgres with superpowers. Replace 3 separate tools (managed Postgres + feature store + vector DB) with one service that's integrated into your data platform."

## Top Objection to Address

"Why not just use Aurora/RDS?" — The app should make it viscerally obvious through the branching, scale-to-zero, and platform integration stories that this isn't commodity Postgres.

---

## Feature Pages (5 stories)

### 1. Feature Store — "From Raw Data to Real-Time ML in 10ms"

**The story:** A customer opens their analytics dashboard. In the background, the system needs to classify their application in real-time. Follow the data journey from raw telemetry → feature computation → online store → model prediction → customer sees the result.

**Visual:** Animated architecture diagram that lights up step-by-step as the user clicks through:
```
[Raw Telemetry] → glow → [Feature Computation] → glow → [Delta Table (offline)]
                                                              ↓ sync animation
                                                    [Lakebase (online)] → glow → [Model] → [Dashboard]
```

**Interactive moments:**
- Pick a customer ID → watch the feature lookup happen in real-time with latency badge
- Side-by-side: Delta lookup (slow, yellow glow) vs Lakebase lookup (fast, green glow)
- Show the actual feature values that the model consumed

**Key stat to show:** "7ms vs 500ms — that's the difference between a responsive app and a frustrated user"

### 2. Branching — "Git for Your Database"

**The story:** You're a data engineer. Your PM just asked for a new threat detection feature. You need to add columns to the telemetry table, create a new threat_indicators table, and test that the ML pipeline still works — all without touching production.

**Visual:** Git-style branch tree that grows as the user takes actions:
```
main ─────────────────────────── (production, untouched)
  └── dev ── [add columns] ── [add table] ── [test model] ── merge? 
  └── staging ── [add indexes] ── [benchmark]
```

**Interactive moments:**
- Step 1: "Create a branch" → branch appears on the tree (show: 0 bytes, <1 sec)
- Step 2: "Add threat_score column" → diff view shows the change (green +)
- Step 3: "Compare with production" → side-by-side schema diff
- Step 4: "Delete the branch" → tree prunes, show: no orphaned data

**Zero-copy visualization:** The page-level diagram from the current app (shared pages A, B, C → modified D' on branch). Show this inline when "0 bytes copied" is highlighted.

**Key stat:** "0 bytes to branch a 50K-row database. <1 second. Full production data for testing."

### 3. CRUD + Query Editor — "Sub-10ms Postgres, Fully Managed"

**The story:** You need a database for your application backend. With traditional managed Postgres, you'd provision an instance, configure connections, set up monitoring, manage backups. With Lakebase, you write SQL.

**Visual:** Split-screen comparison:
- Left: "The Old Way" — terminal showing 15 steps (provision RDS, configure security groups, set up parameter groups, create user, grant permissions...)
- Right: "The Lakebase Way" — 3 steps (create project, write SQL, done) with each step checking off as the user clicks

**Interactive moments:**
- SQL editor with pre-loaded queries (templates)
- Run a query → latency badge shows <10ms
- EXPLAIN ANALYZE with visual query plan
- Insert/Update/Delete with live row counts updating

**Key stat:** "Full Postgres SQL engine — transactions, indexes, CTEs, triggers. Not a limited API."

### 4. Recovery — "Undo Anything, Instantly"

**The story:** It's 2am. Someone ran DELETE FROM orders without a WHERE clause. With traditional Postgres, you'd restore from last night's backup and lose a full day of data. With Lakebase, you restore to any second in the last 7 days.

**Visual:** Timeline slider showing the last 7 days. A red "disaster" marker shows where the DELETE happened. The user drags the slider to just before the disaster — the data comes back.

**Interactive moments (guided, 4 steps):**
- Step 1: Show the table with data (1,000 ML predictions)
- Step 2: "Take a snapshot" → a pin drops on the timeline
- Step 3: "Simulate disaster" → DELETE all rows, table goes red/empty, dramatic visual
- Step 4: "Restore" → timeline rewinds to the pin, data flows back in, show elapsed time

**Key stat:** "Restored 1,000 rows in X seconds. Traditional backup restore: 2-4 hours."

### 5. AI Memory — "Your Agent Remembers Everything"

**The story:** You're building an AI agent for equipment maintenance. A technician asks about a hydraulic press that's been failing. The agent should remember past conversations about that press — what was tried, what worked, which parts were ordered.

**Visual:** Chat interface on the left, memory panel on the right. As the conversation progresses, memories light up showing what the agent recalled and what new knowledge it stored.

**Interactive moments:**
- Type a question about equipment → agent responds with context from past conversations
- Memory panel shows: recalled memories (with similarity scores), new memories being stored
- Show the SQL: "This is just a pgvector query against Lakebase — your agent's memory is a Postgres table"
- GDPR panel: "View my data", "Delete my data", "Export my data"

**Key stat:** "Persistent memory across sessions. <10ms recall. Standard Postgres — no separate vector database."

---

## Theme System

A selector in the sidebar lets you switch between industry scenarios. Each theme changes:
- Data labels (customer_id → farm_id → shipment_id)
- Table names (telemetry_events → crop_sensors → shipment_tracking)
- Sample data (cybersecurity events → agricultural metrics → logistics data)
- Feature names (HSTS_present → soil_moisture_critical → temperature_excursion)
- Color accent (optional: green for default, amber for agriculture, blue for supply chain)

The feature pages and stories stay the same — only the nouns change.

**Themes:**
1. **Cybersecurity** (default) — AppShield, telemetry, threat detection
2. **Supply Chain** — Shipment tracking, cold chain monitoring, route optimization
3. **Agriculture** — Crop sensors, yield prediction, precision farming
4. **Manufacturing** — Equipment telemetry, predictive maintenance, quality control

### 6. Autoscaling — "Watch It Scale Under Load"

**The story:** Your app just got featured on Hacker News. Traffic spikes 10x in minutes. With traditional Postgres, you'd scramble to manually resize the instance (downtime, pages to the DBA). With Lakebase, compute scales automatically while queries keep running.

**Visual:** A live dashboard with three panels — traffic generator controls at top, then a side-by-side of Compute Units (live) and Query Latency (live) as Recharts line charts updating in real-time.

Traffic generator has preset buttons:
- Idle (0 qps)
- Light (10 qps)
- Medium (50 qps)
- Heavy (200 qps)
- Spike (500 qps)

Plus a progress bar showing active queries/sec and a running timer.

**Interactive flow:**
1. Start on "Idle" — CU chart shows the current baseline (e.g., 4 CU)
2. Click "Medium: 50 qps" — backend starts firing 50 queries/sec against the real Lakebase instance
3. Watch the CU chart climb as autoscaling kicks in (polls `/api/autoscaling` every 3 seconds)
4. Latency chart shows queries staying fast despite the load
5. Click "Spike: 500 qps" — CU approaches max, latency stays bounded
6. Click "Idle" — watch CU gradually scale back down
7. A "cost ticker" shows estimated $/hr at current CU throughout

**The key visual:** The CU line going UP while the latency line stays FLAT. That's the autoscaling story — Lakebase absorbs the traffic without degrading performance.

**Before/after comparison card:**
- "Traditional Postgres: manual resize → 5-15 min downtime → queries fail during resize"
- "Lakebase: automatic scale → 0 downtime → queries keep running at <10ms"

**Backend:**
- `POST /api/loadtest/start` — spawns a background thread running N queries/sec (mix of SELECTs on telemetry_events and INSERTs into a scratch table appshield.loadtest_events)
- `GET /api/loadtest/status` — returns current qps, total queries run, avg latency, errors, elapsed time
- `POST /api/loadtest/stop` — kills the background thread
- The autoscaling chart reads from the existing `GET /api/autoscaling` endpoint (polls every 3s to show CU changes)

**Key stat:** "Traffic spiked 10x. Latency stayed under 15ms. Zero downtime. Zero manual intervention."

---

## Tech Stack (v2)

- **Frontend:** React 18 + TypeScript + Vite + Tailwind CSS 4
- **UI:** Radix UI primitives + custom components (no shadcn — too generic for this)
- **Animations:** Framer Motion (architecture diagrams, data flow, timeline)
- **Charts:** Recharts (latency comparisons, metrics)
- **State:** Zustand
- **Icons:** Lucide React
- **Backend:** FastAPI (existing routers, enhanced)
- **Database:** Lakebase Autoscaling (existing)

## Design Language

Same Neon-on-dark from v1, but elevated:
- More whitespace between sections
- Larger typography for story headings
- Animated transitions between steps (Framer Motion page transitions)
- Glass morphism for the "architecture diagram" overlays
- Gradient borders on active/highlighted elements
- Typography: Plus Jakarta Sans (UI) + Space Mono (data/code)

---

## What We're NOT Building

- Not a full database admin tool (that's the MCP server)
- Not a tutorial/documentation site
- Not an industry-specific app (it's a Lakebase showcase that uses industry scenarios)
- No auth/multi-tenancy
- No Data Sync page (removed — was mock, not compelling)
- No Scale to Zero page (removed — can't demo without disconnecting the app)
- No Read Replicas page (removed — only 1 endpoint, not visually interesting)
- No Monitoring as a standalone page (metrics live inside Autoscaling and Overview)
