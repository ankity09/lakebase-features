import os
import time
import logging
import psycopg2
from psycopg2 import pool
from contextlib import contextmanager

logger = logging.getLogger(__name__)
_pool: pool.ThreadedConnectionPool | None = None
_pool_failed = False


def get_pool() -> pool.ThreadedConnectionPool | None:
    global _pool, _pool_failed
    if _pool is not None:
        return _pool
    if _pool_failed:
        return None
    pghost = os.environ.get("PGHOST", "")
    if not pghost:
        logger.warning("PGHOST not set — running without Lakebase connection")
        _pool_failed = True
        return None
    try:
        conn_params = {
            "host": pghost,
            "port": int(os.environ.get("PGPORT", "5432")),
            "user": os.environ.get("PGUSER", ""),
            "database": os.environ.get("PGDATABASE", "postgres"),
            "sslmode": os.environ.get("PGSSLMODE", "require"),
        }
        # Only set password if explicitly provided (provisioned Lakebase uses SP auth without password)
        pgpassword = os.environ.get("PGPASSWORD", "")
        if pgpassword:
            conn_params["password"] = pgpassword
        _pool = pool.ThreadedConnectionPool(
            minconn=1,
            maxconn=10,
            **conn_params,
        )
        logger.info(f"Connected to Lakebase at {pghost}")
    except Exception as e:
        logger.warning(f"Failed to connect to Lakebase: {e}")
        _pool_failed = True
        return None
    return _pool


@contextmanager
def get_conn():
    p = get_pool()
    if p is None:
        raise ConnectionError("Lakebase not connected — attach the Lakebase resource in Databricks Apps settings")
    conn = p.getconn()
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        p.putconn(conn)


def execute_query(sql: str, params=None, fetch: bool = True) -> tuple[list[str], list[dict], float]:
    """Execute SQL, return (columns, rows_as_dicts, latency_ms)."""
    with get_conn() as conn:
        with conn.cursor() as cur:
            start = time.perf_counter()
            cur.execute(sql, params)
            latency_ms = (time.perf_counter() - start) * 1000
            if fetch and cur.description:
                columns = [desc[0] for desc in cur.description]
                rows = [dict(zip(columns, row)) for row in cur.fetchall()]
                return columns, rows, latency_ms
            return [], [], latency_ms


def check_health() -> dict:
    """Return connection health info."""
    with get_conn() as conn:
        with conn.cursor() as cur:
            start = time.perf_counter()
            cur.execute("SELECT version(), current_database(), current_user")
            latency = (time.perf_counter() - start) * 1000
            row = cur.fetchone()
            return {
                "status": "healthy",
                "latency_ms": round(latency, 2),
                "pg_version": row[0].split(",")[0] if row[0] else None,
                "database": row[1],
                "user": row[2],
                "host": os.environ.get("PGHOST", "unknown"),
                "port": int(os.environ.get("PGPORT", "5432")),
            }
