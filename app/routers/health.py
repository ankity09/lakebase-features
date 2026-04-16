import os
from fastapi import APIRouter, HTTPException
from app.services.db import check_health, execute_query

router = APIRouter(prefix="/api", tags=["health"])


@router.get("/health")
def health():
    try:
        info = check_health()
        info["project_id"] = os.environ.get("LAKEBASE_PROJECT_ID", "unknown")
        return info
    except Exception as e:
        raise HTTPException(status_code=503, detail=str(e))


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
