import logging
from fastapi import APIRouter, HTTPException
from app.services.db import execute_query, get_conn

router = APIRouter(prefix="/api", tags=["monitoring"])
logger = logging.getLogger(__name__)


@router.get("/monitoring/metrics")
def get_metrics():
    """Query pg_stat_database for TPS, connections, cache hit rate, database size."""
    try:
        # TPS: transactions committed + rolled back from pg_stat_database
        _, tps_rows, _ = execute_query(
            "SELECT xact_commit + xact_rollback AS total_transactions, "
            "       blks_hit, blks_read "
            "FROM pg_stat_database WHERE datname = current_database()"
        )
        tps_data = tps_rows[0] if tps_rows else {}
        total_txns = tps_data.get("total_transactions", 0)
        blks_hit = tps_data.get("blks_hit", 0)
        blks_read = tps_data.get("blks_read", 0)

        # Cache hit rate
        total_blocks = blks_hit + blks_read
        cache_hit_rate = (blks_hit / total_blocks * 100) if total_blocks > 0 else 0.0

        # Active connections
        _, conn_rows, _ = execute_query(
            "SELECT COUNT(*) AS active FROM pg_stat_activity WHERE state = 'active'"
        )
        active_conns = conn_rows[0]["active"] if conn_rows else 0

        # Database size
        _, size_rows, _ = execute_query(
            "SELECT pg_database_size(current_database()) / (1024 * 1024) AS size_mb"
        )
        size_mb = size_rows[0]["size_mb"] if size_rows else 0

        # Total connections (all states)
        _, total_conn_rows, _ = execute_query(
            "SELECT COUNT(*) AS total FROM pg_stat_activity"
        )
        total_conns = total_conn_rows[0]["total"] if total_conn_rows else 0

        return {
            "tps": total_txns,
            "active_connections": active_conns,
            "total_connections": total_conns,
            "cache_hit_rate": round(cache_hit_rate, 2),
            "storage_used_mb": round(float(size_mb), 2),
            "blocks_hit": blks_hit,
            "blocks_read": blks_read,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/monitoring/slow-queries")
def slow_queries():
    """Query pg_stat_statements for slow queries. Falls back gracefully if extension not installed."""
    try:
        # Check if pg_stat_statements extension exists
        _, ext_rows, _ = execute_query(
            "SELECT 1 FROM pg_extension WHERE extname = 'pg_stat_statements'"
        )
        if not ext_rows:
            return {
                "queries": [],
                "note": "pg_stat_statements extension is not installed. "
                        "Enable it with: CREATE EXTENSION pg_stat_statements;",
            }

        # Query top slow queries
        sql = """
            SELECT
                query,
                calls,
                mean_exec_time AS mean_exec_time_ms,
                total_exec_time AS total_exec_time_ms,
                rows,
                shared_blks_hit,
                shared_blks_read
            FROM pg_stat_statements
            ORDER BY mean_exec_time DESC
            LIMIT 20
        """
        _, rows, latency = execute_query(sql)
        return {
            "queries": rows,
            "count": len(rows),
            "latency_ms": round(latency, 2),
        }
    except Exception as e:
        # pg_stat_statements may have different column names across versions
        logger.warning("pg_stat_statements query failed: %s", e)
        return {
            "queries": [],
            "note": f"Could not query pg_stat_statements: {str(e)}",
        }
