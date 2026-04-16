import os
import time
import logging
import psycopg2
from psycopg2 import pool
from contextlib import contextmanager

logger = logging.getLogger(__name__)
_pool: pool.ThreadedConnectionPool | None = None
_last_error = ""


def _generate_lakebase_token() -> str:
    """Generate an OAuth token for Lakebase using the SDK's header factory.

    This is the same approach used by the lakebase-mcp-server for provisioned instances.
    The SDK's WorkspaceClient auto-discovers credentials (SP client_id/secret in Apps runtime)
    and the header_factory produces a Bearer token that Lakebase accepts as a password.
    """
    try:
        from databricks.sdk import WorkspaceClient
        w = WorkspaceClient()
        header_factory = w.config._header_factory
        if callable(header_factory):
            result = header_factory()
            if isinstance(result, dict):
                token = result.get("Authorization", "").removeprefix("Bearer ")
                if token:
                    logger.info("Generated Lakebase OAuth token via SDK header factory")
                    return token
                else:
                    logger.warning("header_factory returned no Authorization header")
            else:
                logger.warning(f"header_factory returned non-dict: {type(result)}")
        else:
            logger.warning("header_factory is not callable")
    except Exception as e:
        logger.warning(f"SDK token generation failed: {e}")
    return ""


def get_pool() -> pool.ThreadedConnectionPool | None:
    global _pool, _last_error
    if _pool is not None:
        return _pool

    pghost = os.environ.get("PGHOST", "")
    if not pghost:
        logger.warning("PGHOST not set — running without Lakebase connection")
        return None
    try:
        pgpassword = os.environ.get("PGPASSWORD", "")

        # If no password provided, generate an OAuth token
        if not pgpassword:
            logger.info(f"No PGPASSWORD, attempting OAuth token generation. DATABRICKS_HOST={os.environ.get('DATABRICKS_HOST','')[:30]}, CLIENT_ID={os.environ.get('DATABRICKS_CLIENT_ID','')[:10]}...")
            pgpassword = _generate_lakebase_token()
            if pgpassword:
                logger.info(f"Got token ({len(pgpassword)} chars)")
            else:
                logger.warning("Failed to generate any token")

        conn_params = {
            "host": pghost,
            "port": int(os.environ.get("PGPORT", "5432")),
            "user": os.environ.get("PGUSER", ""),
            "database": os.environ.get("PGDATABASE", "postgres"),
            "sslmode": os.environ.get("PGSSLMODE", "require"),
        }
        if pgpassword:
            conn_params["password"] = pgpassword

        _pool = pool.ThreadedConnectionPool(
            minconn=1,
            maxconn=10,
            **conn_params,
        )
        logger.info(f"Connected to Lakebase at {pghost}")
    except Exception as e:
        _last_error = str(e)
        logger.warning(f"Failed to connect to Lakebase: {e}")
        return None
    return _pool


def get_last_error() -> str:
    return _last_error


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
