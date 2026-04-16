import os
import time
import psycopg2
from psycopg2 import pool
from contextlib import contextmanager

_pool: pool.ThreadedConnectionPool | None = None


def get_pool() -> pool.ThreadedConnectionPool:
    global _pool
    if _pool is None:
        _pool = pool.ThreadedConnectionPool(
            minconn=2,
            maxconn=10,
            host=os.environ["PGHOST"],
            port=int(os.environ.get("PGPORT", "5432")),
            user=os.environ["PGUSER"],
            password=os.environ["PGPASSWORD"],
            database=os.environ.get("PGDATABASE", "appshield"),
        )
    return _pool


@contextmanager
def get_conn():
    p = get_pool()
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
