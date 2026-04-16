import logging
import time
import random
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from app.services.db import get_conn, execute_query
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
    """Get current autoscaling config from the real Lakebase project."""
    try:
        ep = _api("GET", f"projects/{PROJECT}/branches/{BRANCH}/endpoints/primary")
        status = ep.get("status", {})
        min_cu = status.get("autoscaling_limit_min_cu", 0)
        max_cu = status.get("autoscaling_limit_max_cu", 0)
        return {
            "min_cu": min_cu,
            "max_cu": max_cu,
            "current_cu": status.get("current_cu", min_cu),
            "memory_gib": int(max_cu) * 4,
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
        _api("PATCH", f"projects/{PROJECT}/branches/{BRANCH}/endpoints/primary", body={
            "spec": {
                "autoscaling_limit_min_cu": body.min_cu,
                "autoscaling_limit_max_cu": body.max_cu,
            },
            "update_mask": "spec.autoscaling_limit_min_cu,spec.autoscaling_limit_max_cu",
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


@router.post("/replicas/compare-query")
def compare_query(body: ReplicaQueryRequest):
    """Run the same query and measure latency. For single-endpoint setups, run twice."""
    try:
        cols1, rows1, lat1 = execute_query(body.sql)
        cols2, rows2, lat2 = execute_query(body.sql)
        return {
            "primary": {
                "latency_ms": round(lat1, 2),
                "row_count": len(rows1),
                "rows": rows1[:100],
            },
            "replica": {
                "latency_ms": round(lat2, 2),
                "row_count": len(rows2),
                "rows": rows2[:100],
            },
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
