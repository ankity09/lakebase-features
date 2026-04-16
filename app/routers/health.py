import os
from fastapi import APIRouter, HTTPException
from app.services.db import check_health, execute_query, get_last_error

router = APIRouter(prefix="/api", tags=["health"])


@router.get("/health")
def health():
    try:
        info = check_health()
        info["project_id"] = os.environ.get("LAKEBASE_PROJECT_ID", "unknown")
        return info
    except Exception as e:
        error_msg = str(e)
        last_db_error = get_last_error()
        if last_db_error:
            error_msg = f"{error_msg} | DB error: {last_db_error}"
        raise HTTPException(status_code=503, detail=error_msg)

@router.get("/debug/env")
def debug_env():
    """Debug: show PG-related env vars (values masked)."""
    pg_vars = {}
    for key in sorted(os.environ.keys()):
        if any(k in key.upper() for k in ["PG", "LAKEBASE", "DATABASE", "POSTGRES"]):
            val = os.environ[key]
            # Mask passwords
            if "PASS" in key.upper() or "TOKEN" in key.upper() or "SECRET" in key.upper():
                pg_vars[key] = f"{val[:8]}..." if len(val) > 8 else "***"
            else:
                pg_vars[key] = val
    # Also show ALL env vars (names only, no values) for debugging
    all_env_keys = sorted(os.environ.keys())
    return {"env_vars": pg_vars, "pghost_set": bool(os.environ.get("PGHOST", "")), "all_env_keys": all_env_keys}


@router.get("/overview/stats")
def overview_stats():
    try:
        health_info = check_health()
        _, conns, _ = execute_query(
            "SELECT count(*) as cnt FROM pg_stat_activity WHERE state = 'active'"
        )
        _, size, _ = execute_query(
            "SELECT pg_database_size(current_database()) / (1024*1024) as size_mb"
        )
        return {
            "instance_status": health_info["status"],
            "storage_used_mb": size[0]["size_mb"] if size else 0,
            "active_connections": conns[0]["cnt"] if conns else 0,
            "avg_query_latency_ms": health_info["latency_ms"],
            "pg_version": health_info["pg_version"],
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
