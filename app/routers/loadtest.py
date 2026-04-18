import os
import logging
import time
import random
import threading
import json
from collections import deque
from datetime import datetime, timezone

import psycopg2
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.services.db import _generate_lakebase_token

router = APIRouter(prefix="/api", tags=["loadtest"])
logger = logging.getLogger(__name__)

# ── State ──────────────────────────────────────────────────────────

_state = {
    "running": False,
    "qps_target": 0,
    "total_queries": 0,
    "errors": 0,
    "start_time": None,
    "latency_history": deque(maxlen=300),
    "thread": None,
    "connections": [],
    "current_samples": [],  # latency samples for the current 3-second window
}
_lock = threading.Lock()

CUSTOMERS = [
    "acme-corp", "globex-inc", "initech-systems", "widget-co", "stark-industries",
    "waystar-royco", "umbrella-corp", "cyberdyne-tech", "weyland-corp", "oscorp-labs",
]


class StartRequest(BaseModel):
    qps: int


# ── Connection helpers ─────────────────────────────────────────────

def _create_connections(count: int = 10) -> list:
    """Create dedicated connections for load testing (not from the shared pool)."""
    password = os.environ.get("PGPASSWORD", "") or _generate_lakebase_token()
    conns = []
    for _ in range(count):
        try:
            conn = psycopg2.connect(
                host=os.environ.get("PGHOST", ""),
                port=int(os.environ.get("PGPORT", "5432")),
                user=os.environ.get("PGUSER", ""),
                password=password,
                database=os.environ.get("PGDATABASE", "postgres"),
                sslmode=os.environ.get("PGSSLMODE", "require"),
            )
            conn.autocommit = True
            conns.append(conn)
        except Exception as e:
            logger.warning(f"Failed to create loadtest connection: {e}")
    return conns


def _close_connections(conns: list):
    for conn in conns:
        try:
            conn.close()
        except:
            pass


# ── Worker thread ──────────────────────────────────────────────────

def _loadtest_worker():
    """Background thread that generates queries at the target QPS."""
    logger.info("Loadtest worker started, target QPS: %d", _state["qps_target"])

    sample_window_start = time.time()
    window_samples = []
    conn_idx = 0

    while _state["running"]:
        qps = _state["qps_target"]
        if qps <= 0:
            time.sleep(0.1)
            continue

        # Sleep to maintain target QPS (distribute evenly)
        sleep_time = 1.0 / qps

        conns = _state["connections"]
        if not conns:
            time.sleep(1)
            continue

        conn = conns[conn_idx % len(conns)]
        conn_idx += 1

        try:
            start = time.perf_counter()

            # 80% reads, 20% writes
            if random.random() < 0.8:
                customer = random.choice(CUSTOMERS)
                with conn.cursor() as cur:
                    cur.execute(
                        "SELECT COUNT(*) FROM appshield.telemetry_events WHERE customer_id = %s",
                        (customer,)
                    )
                    cur.fetchone()
            else:
                with conn.cursor() as cur:
                    cur.execute(
                        "INSERT INTO appshield.loadtest_events (event_type, payload) VALUES (%s, %s)",
                        ("loadtest", json.dumps({"ts": time.time(), "qps": qps}))
                    )

            latency_ms = (time.perf_counter() - start) * 1000
            window_samples.append(latency_ms)

            with _lock:
                _state["total_queries"] += 1

        except Exception as e:
            with _lock:
                _state["errors"] += 1
            # Try to reconnect if connection is broken
            try:
                conns[conn_idx % len(conns)] = _create_connections(1)[0] if _create_connections(1) else conn
            except:
                pass

        # Every 3 seconds: compute p50/p99 and append to history
        if time.time() - sample_window_start >= 3.0 and window_samples:
            sorted_samples = sorted(window_samples)
            p50 = sorted_samples[len(sorted_samples) // 2]
            p99_idx = min(int(len(sorted_samples) * 0.99), len(sorted_samples) - 1)
            p99 = sorted_samples[p99_idx]

            with _lock:
                _state["latency_history"].append({
                    "ts": datetime.now(timezone.utc).isoformat(),
                    "p50": round(p50, 2),
                    "p99": round(p99, 2),
                    "samples": len(window_samples),
                })

            window_samples = []
            sample_window_start = time.time()

        time.sleep(max(0, sleep_time - 0.001))  # subtract overhead

    logger.info("Loadtest worker stopped. Total queries: %d", _state["total_queries"])


# ── Endpoints ──────────────────────────────────────────────────────

@router.post("/loadtest/start")
def start_loadtest(body: StartRequest):
    """Start generating traffic at the specified QPS (max 200)."""
    qps = min(body.qps, 200)  # Cap at 200

    with _lock:
        # Stop existing if running
        if _state["running"]:
            _state["running"] = False
            if _state["thread"]:
                _state["thread"].join(timeout=5)
            _close_connections(_state["connections"])

        # Reset state
        _state["running"] = True
        _state["qps_target"] = qps
        _state["total_queries"] = 0
        _state["errors"] = 0
        _state["start_time"] = time.time()
        _state["latency_history"].clear()
        _state["connections"] = _create_connections(min(10, max(1, qps // 20 + 1)))

        if not _state["connections"]:
            _state["running"] = False
            raise HTTPException(status_code=500, detail="Failed to create database connections for loadtest")

        thread = threading.Thread(target=_loadtest_worker, daemon=True)
        _state["thread"] = thread
        thread.start()

    logger.info("Loadtest started: %d QPS, %d connections", qps, len(_state["connections"]))
    return {"status": "started", "qps": qps, "connections": len(_state["connections"])}


@router.get("/loadtest/status")
def loadtest_status():
    """Get current loadtest state."""
    with _lock:
        elapsed = time.time() - _state["start_time"] if _state["start_time"] else 0
        history = list(_state["latency_history"])
        avg_latency = 0
        if history:
            avg_latency = sum(h["p50"] for h in history) / len(history)

        return {
            "running": _state["running"],
            "qps_target": _state["qps_target"],
            "total_queries": _state["total_queries"],
            "avg_latency_ms": round(avg_latency, 2),
            "errors": _state["errors"],
            "elapsed_seconds": round(elapsed, 1),
            "latency_history": history,
        }


@router.post("/loadtest/stop")
def stop_loadtest():
    """Stop the loadtest."""
    with _lock:
        was_running = _state["running"]
        total = _state["total_queries"]
        _state["running"] = False

    # Wait for thread to finish
    if _state.get("thread"):
        _state["thread"].join(timeout=5)

    # Close dedicated connections
    _close_connections(_state.get("connections", []))

    with _lock:
        _state["connections"] = []
        _state["thread"] = None

    return {"status": "stopped", "was_running": was_running, "total_queries": total}
