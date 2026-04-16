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

# ---- Mock state ----

_mock_autoscaling = {"min_cu": 2, "max_cu": 16, "current_cu": 4, "memory_gib": 16}
_mock_endpoint_state = "ACTIVE"  # ACTIVE | SUSPENDED | STARTING


class AutoscalingUpdateRequest(BaseModel):
    min_cu: int
    max_cu: int


class ReplicaQueryRequest(BaseModel):
    sql: str


@router.get("/autoscaling")
def get_autoscaling():
    """Get current autoscaling config."""
    try:
        w = get_workspace_client()
        project_id = get_project_id()
        if project_id:
            try:
                config = w.lakebase.get_autoscaling(project_id=project_id)
                return {
                    "min_cu": getattr(config, "min_cu", 2),
                    "max_cu": getattr(config, "max_cu", 16),
                    "current_cu": getattr(config, "current_cu", None),
                    "memory_gib": getattr(config, "memory_gib", None),
                    "source": "sdk",
                }
            except Exception as sdk_err:
                logger.warning("SDK autoscaling get failed, using mock: %s", sdk_err)
    except Exception:
        pass

    return {**_mock_autoscaling, "source": "mock"}


@router.put("/autoscaling")
def update_autoscaling(body: AutoscalingUpdateRequest):
    """Update autoscaling config."""
    global _mock_autoscaling
    if body.min_cu < 1:
        raise HTTPException(status_code=400, detail="min_cu must be >= 1")
    if body.max_cu < body.min_cu:
        raise HTTPException(status_code=400, detail="max_cu must be >= min_cu")

    try:
        w = get_workspace_client()
        project_id = get_project_id()
        if project_id:
            try:
                w.lakebase.update_autoscaling(
                    project_id=project_id,
                    min_cu=body.min_cu,
                    max_cu=body.max_cu,
                )
                return {
                    "min_cu": body.min_cu,
                    "max_cu": body.max_cu,
                    "state": "UPDATING",
                    "source": "sdk",
                }
            except Exception as sdk_err:
                logger.warning("SDK autoscaling update failed, simulating: %s", sdk_err)
    except Exception:
        pass

    _mock_autoscaling["min_cu"] = body.min_cu
    _mock_autoscaling["max_cu"] = body.max_cu
    return {**_mock_autoscaling, "state": "UPDATED", "source": "mock"}


@router.get("/endpoint/status")
def endpoint_status():
    """Get endpoint state (active/suspended/starting)."""
    try:
        w = get_workspace_client()
        project_id = get_project_id()
        if project_id:
            try:
                status = w.lakebase.get_endpoint(project_id=project_id)
                return {
                    "state": getattr(status, "state", "UNKNOWN"),
                    "name": getattr(status, "name", "primary"),
                    "type": "r_w",
                    "compute_units": getattr(status, "compute_units", None),
                    "host": getattr(status, "host", None),
                    "source": "sdk",
                }
            except Exception as sdk_err:
                logger.warning("SDK endpoint status failed, using mock: %s", sdk_err)
    except Exception:
        pass

    return {
        "state": _mock_endpoint_state,
        "name": "appshield-primary",
        "type": "r_w",
        "compute_units": _mock_autoscaling["current_cu"],
        "host": "lakebase.example.databricks.com",
        "source": "mock",
    }


@router.post("/endpoint/suspend")
def suspend_endpoint():
    """Trigger scale-to-zero / suspend."""
    global _mock_endpoint_state
    try:
        w = get_workspace_client()
        project_id = get_project_id()
        if project_id:
            try:
                w.lakebase.suspend_endpoint(project_id=project_id)
                return {"state": "SUSPENDING", "source": "sdk"}
            except Exception as sdk_err:
                logger.warning("SDK suspend failed, simulating: %s", sdk_err)
    except Exception:
        pass

    _mock_endpoint_state = "SUSPENDED"
    return {
        "state": "SUSPENDED",
        "message": "Endpoint suspended (scale-to-zero). Resume with POST /api/endpoint/resume.",
        "source": "mock",
    }


@router.post("/endpoint/resume")
def resume_endpoint():
    """Wake up a suspended endpoint."""
    global _mock_endpoint_state
    try:
        w = get_workspace_client()
        project_id = get_project_id()
        if project_id:
            try:
                w.lakebase.resume_endpoint(project_id=project_id)
                return {"state": "STARTING", "source": "sdk"}
            except Exception as sdk_err:
                logger.warning("SDK resume failed, simulating: %s", sdk_err)
    except Exception:
        pass

    _mock_endpoint_state = "ACTIVE"
    return {
        "state": "ACTIVE",
        "message": "Endpoint resumed.",
        "source": "mock",
    }


@router.get("/replicas")
def list_replicas():
    """List all endpoints (R/W and R/O)."""
    try:
        w = get_workspace_client()
        project_id = get_project_id()
        if project_id:
            try:
                endpoints = w.lakebase.list_endpoints(project_id=project_id)
                result = []
                for ep in endpoints:
                    result.append({
                        "name": getattr(ep, "name", "unknown"),
                        "state": getattr(ep, "state", "UNKNOWN"),
                        "type": getattr(ep, "type", "r_w"),
                        "compute_units": getattr(ep, "compute_units", None),
                        "host": getattr(ep, "host", None),
                    })
                return {"endpoints": result, "source": "sdk"}
            except Exception as sdk_err:
                logger.warning("SDK list endpoints failed, using mock: %s", sdk_err)
    except Exception:
        pass

    return {
        "endpoints": [
            {
                "name": "appshield-primary",
                "state": _mock_endpoint_state,
                "type": "r_w",
                "compute_units": _mock_autoscaling["current_cu"],
                "host": "primary.lakebase.example.com",
            },
            {
                "name": "appshield-replica-1",
                "state": "ACTIVE",
                "type": "r_o",
                "compute_units": 2,
                "host": "replica-1.lakebase.example.com",
            },
        ],
        "source": "mock",
    }


@router.post("/replicas/compare-query")
def compare_query(body: ReplicaQueryRequest):
    """Run query on primary and simulate replica comparison."""
    sql = body.sql.strip()
    if not sql:
        raise HTTPException(status_code=400, detail="SQL query cannot be empty")

    try:
        # Run on primary (real connection)
        start_primary = time.perf_counter()
        columns, rows, primary_latency = execute_query(sql)
        primary_wall = (time.perf_counter() - start_primary) * 1000

        # Simulate replica query: run same query again with slight variance
        start_replica = time.perf_counter()
        _, replica_rows, replica_latency = execute_query(sql)
        replica_wall = (time.perf_counter() - start_replica) * 1000
        # Add some simulated network overhead for the replica
        replica_overhead = random.uniform(0.5, 3.0)

        return {
            "primary": {
                "name": "appshield-primary",
                "type": "r_w",
                "columns": columns,
                "row_count": len(rows),
                "latency_ms": round(primary_latency, 2),
                "wall_time_ms": round(primary_wall, 2),
            },
            "replica": {
                "name": "appshield-replica-1",
                "type": "r_o",
                "columns": columns,
                "row_count": len(replica_rows),
                "latency_ms": round(replica_latency + replica_overhead, 2),
                "wall_time_ms": round(replica_wall + replica_overhead, 2),
            },
            "rows_match": len(rows) == len(replica_rows),
            "note": "Replica query is simulated via the same connection with added latency variance.",
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
