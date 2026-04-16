import logging
import os
import psycopg2
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from app.services.lakebase_api import get_workspace_client
from app.services.db import _generate_lakebase_token

router = APIRouter(prefix="/api", tags=["branching"])
logger = logging.getLogger(__name__)

PROJECT = "lakebase-features"


def _api(method, path, body=None):
    w = get_workspace_client()
    kwargs = {"body": body} if body else {}
    return w.api_client.do(method, f"/api/2.0/postgres/{path}", **kwargs)


class CreateBranchRequest(BaseModel):
    name: str
    parent_branch: str = "production"


@router.get("/branches")
def list_branches():
    """List all branches on the project."""
    try:
        resp = _api("GET", f"projects/{PROJECT}/branches")
        branches = []
        for b in resp.get("branches", []):
            status = b.get("status", {})
            branches.append({
                "name": status.get("branch_id", b.get("name", "").split("/")[-1]),
                "state": status.get("current_state", "UNKNOWN"),
                "parent_branch": b.get("parent", "").split("/")[-1] if "/" in b.get("parent", "") else None,
                "created_at": b.get("create_time"),
                "is_default": status.get("default", False),
                "is_protected": status.get("is_protected", False),
                "logical_size_bytes": status.get("logical_size_bytes", 0),
            })
        return {"branches": branches}
    except Exception as e:
        logger.warning("Failed to list branches: %s", e)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/branches")
def create_branch(body: CreateBranchRequest):
    """Create a new branch from a parent."""
    try:
        resp = _api("POST", f"projects/{PROJECT}/branches?branch_id={body.name}", body={
            "spec": {
                "source_branch": f"projects/{PROJECT}/branches/{body.parent_branch}",
                "no_expiry": True,
            }
        })
        return {"status": "created", "name": body.name, "branch": resp}
    except Exception as e:
        logger.warning("Failed to create branch: %s", e)
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/branches/{name}")
def delete_branch(name: str, confirm: bool = Query(False)):
    """Delete a branch (cannot delete production/main)."""
    if name in ("production", "main"):
        raise HTTPException(status_code=400, detail="Cannot delete the production branch")
    if not confirm:
        raise HTTPException(status_code=400, detail="Set confirm=true to delete this branch")
    try:
        _api("DELETE", f"projects/{PROJECT}/branches/{name}")
        return {"status": "deleted", "name": name}
    except Exception as e:
        logger.warning("Failed to delete branch: %s", e)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/branches/setup-demo")
def setup_branch_demo():
    """One-time setup: apply schema changes to dev and staging branches for demo.
    Runs as the app SP which owns the tables."""

    def _get_branch_host(branch_name):
        resp = _api("GET", f"projects/{PROJECT}/branches/{branch_name}/endpoints")
        eps = resp.get("endpoints", [])
        if eps:
            return eps[0].get("status", {}).get("hosts", {}).get("host", "")
        return ""

    def _run_on_branch(host, sqls):
        password = os.environ.get("PGPASSWORD", "") or _generate_lakebase_token()
        conn = psycopg2.connect(
            host=host, port=int(os.environ.get("PGPORT", "5432")),
            user=os.environ.get("PGUSER", ""),
            password=password,
            database=os.environ.get("PGDATABASE", "postgres"),
            sslmode=os.environ.get("PGSSLMODE", "require"),
        )
        results = []
        try:
            conn.autocommit = True
            with conn.cursor() as cur:
                for sql in sqls:
                    try:
                        cur.execute(sql)
                        results.append({"sql": sql[:80], "status": "ok"})
                    except Exception as e:
                        results.append({"sql": sql[:80], "status": f"error: {e}"})
        finally:
            conn.close()
        return results

    output = {}
    try:
        # DEV branch: new columns + threat_indicators table
        dev_host = _get_branch_host("dev")
        if dev_host:
            dev_sqls = [
                "ALTER TABLE appshield.telemetry_events ADD COLUMN IF NOT EXISTS threat_score FLOAT",
                "ALTER TABLE appshield.telemetry_events ADD COLUMN IF NOT EXISTS geo_country VARCHAR(64)",
                "ALTER TABLE appshield.telemetry_events ADD COLUMN IF NOT EXISTS device_fingerprint VARCHAR(128)",
                "ALTER TABLE appshield.customer_features ADD COLUMN IF NOT EXISTS threat_level VARCHAR(20)",
                "ALTER TABLE appshield.customer_features ADD COLUMN IF NOT EXISTS anomaly_score FLOAT",
                """CREATE TABLE IF NOT EXISTS appshield.threat_indicators (
                    indicator_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    indicator_type VARCHAR(32) NOT NULL,
                    indicator_value TEXT NOT NULL,
                    severity VARCHAR(16) DEFAULT 'medium',
                    first_seen TIMESTAMPTZ DEFAULT NOW(),
                    last_seen TIMESTAMPTZ DEFAULT NOW(),
                    hit_count INT DEFAULT 0,
                    source VARCHAR(64),
                    is_active BOOLEAN DEFAULT true
                )""",
                """INSERT INTO appshield.threat_indicators (indicator_type, indicator_value, severity, source, hit_count)
                SELECT * FROM (VALUES
                    ('ip_blocklist', '203.0.113.0/24', 'critical', 'Threat Intel Feed', 1547),
                    ('domain_suspicious', 'malware-c2.example.com', 'critical', 'Internal SOC', 89),
                    ('user_agent_bot', 'BadBot/1.0', 'high', 'WAF Rules', 3201),
                    ('geo_anomaly', 'Country: NK', 'high', 'GeoIP Database', 12),
                    ('ssl_expired', 'cert-sha256:abc123...', 'medium', 'Certificate Monitor', 5),
                    ('rate_limit_exceeded', 'customer:widget-inc', 'medium', 'Rate Limiter', 2890),
                    ('cookie_injection', 'pattern:<script>', 'critical', 'WAF Rules', 445),
                    ('path_traversal', '../../../etc/passwd', 'critical', 'WAF Rules', 67)
                ) AS v(a,b,c,d,e)
                WHERE NOT EXISTS (SELECT 1 FROM appshield.threat_indicators LIMIT 1)""",
            ]
            output["dev"] = _run_on_branch(dev_host, dev_sqls)
        else:
            output["dev"] = "no endpoint"

        # STAGING branch: indexes + daily summary table
        staging_host = _get_branch_host("staging")
        if staging_host:
            staging_sqls = [
                "CREATE INDEX IF NOT EXISTS idx_telemetry_customer_time ON appshield.telemetry_events(customer_id, event_time DESC)",
                "CREATE INDEX IF NOT EXISTS idx_telemetry_region_code ON appshield.telemetry_events(region, response_code)",
                "CREATE INDEX IF NOT EXISTS idx_features_time ON appshield.customer_features(time_bucket DESC)",
                """CREATE TABLE IF NOT EXISTS appshield.customer_daily_summary (
                    customer_id VARCHAR(64),
                    summary_date DATE,
                    total_requests INT,
                    unique_ips INT,
                    avg_payload_bytes FLOAT,
                    error_rate FLOAT,
                    PRIMARY KEY (customer_id, summary_date)
                )""",
                """INSERT INTO appshield.customer_daily_summary (customer_id, summary_date, total_requests, unique_ips, avg_payload_bytes, error_rate)
                SELECT customer_id, event_time::date, COUNT(*), COUNT(DISTINCT source_ip),
                    AVG(payload_size_bytes), AVG(CASE WHEN response_code >= 400 THEN 1.0 ELSE 0.0 END)
                FROM appshield.telemetry_events
                GROUP BY customer_id, event_time::date
                ON CONFLICT DO NOTHING""",
            ]
            output["staging"] = _run_on_branch(staging_host, staging_sqls)
        else:
            output["staging"] = "no endpoint"

        return {"status": "done", "results": output}
    except Exception as e:
        logger.warning("Branch demo setup failed: %s", e)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/branches/compare")
def compare_branches(base: str = Query(...), target: str = Query(...)):
    """Deep schema diff between two branches — tables, columns, indexes."""

    def _get_branch_host(branch_name):
        resp = _api("GET", f"projects/{PROJECT}/branches/{branch_name}/endpoints")
        eps = resp.get("endpoints", [])
        if eps:
            return eps[0].get("status", {}).get("hosts", {}).get("host", "")
        return ""

    def _query_branch(host, sql):
        password = os.environ.get("PGPASSWORD", "") or _generate_lakebase_token()
        conn = psycopg2.connect(
            host=host, port=int(os.environ.get("PGPORT", "5432")),
            user=os.environ.get("PGUSER", ""),
            password=password,
            database=os.environ.get("PGDATABASE", "postgres"),
            sslmode=os.environ.get("PGSSLMODE", "require"),
        )
        try:
            with conn.cursor() as cur:
                cur.execute(sql)
                if cur.description:
                    cols = [d[0] for d in cur.description]
                    return [dict(zip(cols, row)) for row in cur.fetchall()]
                return []
        finally:
            conn.close()

    try:
        base_host = _get_branch_host(base)
        target_host = _get_branch_host(target)

        if not base_host or not target_host:
            raise HTTPException(status_code=400, detail=f"Could not find endpoints for branches: base={base_host}, target={target_host}")

        # Get tables
        tables_sql = """
            SELECT table_name FROM information_schema.tables
            WHERE table_schema = 'appshield' AND table_type = 'BASE TABLE'
            ORDER BY table_name
        """
        base_tables = {r["table_name"] for r in _query_branch(base_host, tables_sql)}
        target_tables = {r["table_name"] for r in _query_branch(target_host, tables_sql)}

        # Get columns per table (for tables in both branches)
        columns_sql = """
            SELECT table_name, column_name, data_type, is_nullable, ordinal_position
            FROM information_schema.columns
            WHERE table_schema = 'appshield'
            ORDER BY table_name, ordinal_position
        """
        base_cols = _query_branch(base_host, columns_sql)
        target_cols = _query_branch(target_host, columns_sql)

        # Get indexes
        indexes_sql = """
            SELECT indexname, tablename, indexdef
            FROM pg_indexes WHERE schemaname = 'appshield'
            ORDER BY tablename, indexname
        """
        base_indexes = _query_branch(base_host, indexes_sql)
        target_indexes = _query_branch(target_host, indexes_sql)

        # Get row counts per table
        def _get_row_counts(host, tables):
            counts = {}
            for t in tables:
                try:
                    rows = _query_branch(host, f"SELECT COUNT(*) as cnt FROM appshield.{t}")
                    counts[t] = rows[0]["cnt"] if rows else 0
                except Exception:
                    counts[t] = -1
            return counts

        base_row_counts = _get_row_counts(base_host, base_tables)
        target_row_counts = _get_row_counts(target_host, target_tables)

        # Build column maps: {table_name: {col_name: {type, nullable}}}
        def _col_map(cols_list):
            m = {}
            for c in cols_list:
                t = c["table_name"]
                if t not in m:
                    m[t] = {}
                m[t][c["column_name"]] = {"data_type": c["data_type"], "is_nullable": c["is_nullable"]}
            return m

        base_col_map = _col_map(base_cols)
        target_col_map = _col_map(target_cols)

        # Build index maps: {index_name: indexdef}
        base_idx_map = {i["indexname"]: i["indexdef"] for i in base_indexes}
        target_idx_map = {i["indexname"]: i["indexdef"] for i in target_indexes}

        # Compute diffs
        tables_added = sorted(target_tables - base_tables)
        tables_removed = sorted(base_tables - target_tables)

        column_diffs = []
        for table in sorted(base_tables & target_tables):
            base_c = set(base_col_map.get(table, {}).keys())
            target_c = set(target_col_map.get(table, {}).keys())
            added = sorted(target_c - base_c)
            removed = sorted(base_c - target_c)
            if added or removed:
                column_diffs.append({
                    "table": table,
                    "columns_added": [{"name": c, **target_col_map[table][c]} for c in added],
                    "columns_removed": [{"name": c, **base_col_map[table][c]} for c in removed],
                })

        indexes_added = sorted(set(target_idx_map.keys()) - set(base_idx_map.keys()))
        indexes_removed = sorted(set(base_idx_map.keys()) - set(target_idx_map.keys()))

        return {
            "base_branch": base,
            "target_branch": target,
            "summary": {
                "tables_added": len(tables_added),
                "tables_removed": len(tables_removed),
                "columns_changed": len(column_diffs),
                "indexes_added": len(indexes_added),
                "indexes_removed": len(indexes_removed),
            },
            "tables_added": [{"name": t, "row_count": target_row_counts.get(t, 0)} for t in tables_added],
            "tables_removed": [{"name": t, "row_count": base_row_counts.get(t, 0)} for t in tables_removed],
            "column_diffs": column_diffs,
            "indexes_added": [{"name": n, "definition": target_idx_map[n]} for n in indexes_added],
            "indexes_removed": [{"name": n, "definition": base_idx_map[n]} for n in indexes_removed],
            "row_counts": {
                "base": base_row_counts,
                "target": target_row_counts,
            },
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.warning("Failed to compare branches: %s", e)
        raise HTTPException(status_code=500, detail=str(e))
