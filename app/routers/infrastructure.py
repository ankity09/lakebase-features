import logging
import os
import time
import random
from datetime import datetime, timezone
import psycopg2
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from app.services.db import get_conn, execute_query, _generate_lakebase_token
from app.services.lakebase_api import get_workspace_client, get_project_id

router = APIRouter(prefix="/api", tags=["infrastructure"])
logger = logging.getLogger(__name__)

PROJECT = "lakebase-features"
BRANCH = "production"


def _api(method, path, body=None):
    """Call Lakebase REST API via workspace client."""
    w = get_workspace_client()
    kwargs = {"body": body} if body else {}
    return w.api_client.do(method, f"/api/2.0/postgres/{path}", **kwargs)


class AutoscalingUpdateRequest(BaseModel):
    min_cu: float
    max_cu: float


class ReplicaQueryRequest(BaseModel):
    sql: str


# ── Autoscaling ──────────────────────────────────────────────────────

@router.get("/autoscaling")
def get_autoscaling():
    """Get current autoscaling config + detect actual CU from shared_buffers."""
    try:
        ep = _api("GET", f"projects/{PROJECT}/branches/{BRANCH}/endpoints/primary")
        status = ep.get("status", {})
        min_cu = status.get("autoscaling_limit_min_cu", 0)
        max_cu = status.get("autoscaling_limit_max_cu", 0)

        # Detect actual current CU from effective_cache_size
        # This reflects the total allocated RAM which scales with CU
        # Mapping: 0.5 CU ≈ 1 GB, 1 CU ≈ 2 GB, 2 CU ≈ 4 GB, 4 CU ≈ 8 GB, 8 CU ≈ 16 GB
        current_cu = min_cu
        try:
            _, rows, _ = execute_query(
                "SELECT setting::bigint * 8192 as cache_bytes FROM pg_settings WHERE name = 'effective_cache_size'"
            )
            if rows:
                cache_bytes = rows[0]["cache_bytes"]
                cache_gb = cache_bytes / (1024 * 1024 * 1024)
                # ~2 GB per CU
                estimated_cu = round(cache_gb / 2, 1)
                current_cu = max(min_cu, min(max_cu, estimated_cu))
        except Exception as pg_err:
            logger.warning("Could not detect current CU: %s", pg_err)

        return {
            "min_cu": min_cu,
            "max_cu": max_cu,
            "current_cu": current_cu,
            "memory_gib": round(current_cu * 4, 1),
            "source": "live",
        }
    except Exception as e:
        logger.warning("Failed to get autoscaling config: %s", e)
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/autoscaling")
def update_autoscaling(body: AutoscalingUpdateRequest):
    """Update autoscaling config on the real endpoint."""
    if body.min_cu > body.max_cu:
        raise HTTPException(status_code=400, detail="min_cu cannot exceed max_cu")
    try:
        path = f"projects/{PROJECT}/branches/{BRANCH}/endpoints/primary?update_mask=spec.autoscaling_limit_min_cu,spec.autoscaling_limit_max_cu"
        _api("PATCH", path, body={
            "spec": {
                "autoscaling_limit_min_cu": body.min_cu,
                "autoscaling_limit_max_cu": body.max_cu,
            },
        })
        return {"status": "updated", "min_cu": body.min_cu, "max_cu": body.max_cu}
    except Exception as e:
        logger.warning("Failed to update autoscaling: %s", e)
        raise HTTPException(status_code=500, detail=str(e))


# ── Scale to Zero ────────────────────────────────────────────────────

@router.get("/endpoint/status")
def get_endpoint_status():
    """Get real endpoint state."""
    try:
        ep = _api("GET", f"projects/{PROJECT}/branches/{BRANCH}/endpoints/primary")
        status = ep.get("status", {})
        state = status.get("current_state", "UNKNOWN")
        # Map Lakebase states to our UI states
        state_map = {
            "ACTIVE": "active",
            "IDLE": "active",
            "SUSPENDED": "suspended",
            "SUSPENDING": "suspended",
            "STARTING": "starting",
            "CREATING": "starting",
        }
        return {
            "name": "primary",
            "state": state_map.get(state, state.lower()),
            "raw_state": state,
            "type": status.get("endpoint_type", "ENDPOINT_TYPE_READ_WRITE"),
            "compute_units": status.get("current_cu"),
            "host": status.get("hosts", {}).get("host", ""),
        }
    except Exception as e:
        logger.warning("Failed to get endpoint status: %s", e)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/endpoint/suspend")
def suspend_endpoint():
    """Suspend the endpoint (scale to zero)."""
    try:
        _api("POST", f"projects/{PROJECT}/branches/{BRANCH}/endpoints/primary:suspend", body={})
        return {"status": "suspending"}
    except Exception as e:
        logger.warning("Suspend failed: %s", e)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/endpoint/resume")
def resume_endpoint():
    """Resume a suspended endpoint."""
    try:
        _api("POST", f"projects/{PROJECT}/branches/{BRANCH}/endpoints/primary:start", body={})
        return {"status": "starting", "timestamp": datetime.now(timezone.utc).isoformat()}
    except Exception as e:
        logger.warning("Resume failed: %s", e)
        raise HTTPException(status_code=500, detail=str(e))


# ── Read Replicas ────────────────────────────────────────────────────

@router.get("/replicas")
def list_replicas():
    """List all endpoints (R/W and R/O) on the production branch."""
    try:
        resp = _api("GET", f"projects/{PROJECT}/branches/{BRANCH}/endpoints")
        endpoints = []
        for ep in resp.get("endpoints", []):
            status = ep.get("status", {})
            spec = ep.get("spec", {})
            ep_type = status.get("endpoint_type", spec.get("endpoint_type", ""))
            endpoints.append({
                "name": ep.get("name", "").split("/")[-1],
                "state": status.get("current_state", "UNKNOWN"),
                "type": "r_w" if "READ_WRITE" in ep_type else "r_o",
                "compute_units": spec.get("autoscaling_limit_max_cu"),
                "host": status.get("hosts", {}).get("host", ""),
            })
        return {"endpoints": endpoints}
    except Exception as e:
        logger.warning("Failed to list replicas: %s", e)
        raise HTTPException(status_code=500, detail=str(e))


def _execute_on_host(host: str, sql: str) -> tuple[list[dict], float]:
    """Open a fresh psycopg2 connection to a specific host, run *sql*, return (rows, latency_ms)."""
    password = os.environ.get("PGPASSWORD", "") or _generate_lakebase_token()
    conn = psycopg2.connect(
        host=host,
        port=int(os.environ.get("PGPORT", "5432")),
        user=os.environ.get("PGUSER", ""),
        password=password,
        database=os.environ.get("PGDATABASE", "postgres"),
        sslmode=os.environ.get("PGSSLMODE", "require"),
    )
    try:
        with conn.cursor() as cur:
            start = time.perf_counter()
            cur.execute(sql)
            latency_ms = (time.perf_counter() - start) * 1000
            if cur.description:
                columns = [d[0] for d in cur.description]
                rows = [dict(zip(columns, row)) for row in cur.fetchall()]
            else:
                rows = []
        conn.commit()
        return rows, latency_ms
    finally:
        conn.close()


@router.post("/replicas/compare-query")
def compare_query(body: ReplicaQueryRequest):
    """Run the same query on primary and replica endpoints. Falls back to same connection if only one endpoint."""
    try:
        # Discover endpoints to get separate hosts
        resp = _api("GET", f"projects/{PROJECT}/branches/{BRANCH}/endpoints")
        endpoints = resp.get("endpoints", [])

        primary_host = None
        replica_host = None
        for ep in endpoints:
            status = ep.get("status", {})
            spec = ep.get("spec", {})
            ep_type = status.get("endpoint_type", spec.get("endpoint_type", ""))
            host = status.get("hosts", {}).get("host", "")
            if "READ_WRITE" in ep_type and host:
                primary_host = host
            elif "READ_ONLY" in ep_type and host:
                replica_host = host

        if primary_host and replica_host:
            # Real multi-endpoint comparison
            logger.info("Comparing query across primary (%s) and replica (%s)", primary_host, replica_host)
            rows1, lat1 = _execute_on_host(primary_host, body.sql)
            rows2, lat2 = _execute_on_host(replica_host, body.sql)
        else:
            # Fallback: run twice on default connection
            logger.info("Single endpoint — running query twice on same connection")
            _, rows1, lat1 = execute_query(body.sql)
            _, rows2, lat2 = execute_query(body.sql)

        return {
            "primary": {
                "latency_ms": round(lat1, 2),
                "row_count": len(rows1),
                "rows": rows1[:100],
                "host": primary_host or os.environ.get("PGHOST", ""),
            },
            "replica": {
                "latency_ms": round(lat2, 2),
                "row_count": len(rows2),
                "rows": rows2[:100],
                "host": replica_host or os.environ.get("PGHOST", ""),
            },
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
