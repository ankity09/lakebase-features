import logging
import os
import time
import uuid
from datetime import datetime, timezone
from decimal import Decimal

import psycopg2
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.services.db import get_conn, execute_query, _generate_lakebase_token
from app.services.lakebase_api import get_workspace_client

router = APIRouter(prefix="/api", tags=["recovery"])
logger = logging.getLogger(__name__)

PROJECT = "lakebase-features"
BRANCH = "production"


def _api(method, path, body=None):
    """Call Lakebase REST API via workspace client."""
    w = get_workspace_client()
    kwargs = {"body": body} if body else {}
    return w.api_client.do(method, f"/api/2.0/postgres/{path}", **kwargs)


def _connect_to_host(host):
    """Open a fresh psycopg2 connection to a specific host."""
    password = os.environ.get("PGPASSWORD", "") or _generate_lakebase_token()
    return psycopg2.connect(
        host=host,
        port=int(os.environ.get("PGPORT", "5432")),
        user=os.environ.get("PGUSER", ""),
        password=password,
        database=os.environ.get("PGDATABASE", "postgres"),
        sslmode=os.environ.get("PGSSLMODE", "require"),
    )


class RestoreRequest(BaseModel):
    snapshot_timestamp: str


# ── Create / Reset Demo Table ───────────────────────────────────────

@router.post("/recovery/demo-table")
def create_demo_table():
    """Create or reset the recovery demo table with sample data."""
    try:
        with get_conn() as conn:
            conn.autocommit = True
            with conn.cursor() as cur:
                cur.execute("DROP TABLE IF EXISTS appshield.recovery_demo")
                cur.execute("""
                    CREATE TABLE appshield.recovery_demo (
                        id SERIAL PRIMARY KEY,
                        customer VARCHAR(64),
                        action VARCHAR(128),
                        amount DECIMAL(10,2),
                        created_at TIMESTAMPTZ DEFAULT NOW()
                    )
                """)
                cur.execute("""
                    INSERT INTO appshield.recovery_demo (customer, action, amount) VALUES
                        ('acme-corp', 'subscription_renewal', 299.99),
                        ('globex-inc', 'feature_upgrade', 149.50),
                        ('initech-systems', 'support_plan', 599.00),
                        ('widget-co', 'data_export', 49.99),
                        ('stark-industries', 'enterprise_license', 2499.00)
                """)
        return {"status": "created", "row_count": 5}
    except Exception as e:
        logger.warning("Failed to create demo table: %s", e)
        raise HTTPException(status_code=500, detail=str(e))


# ── Read Demo Table ─────────────────────────────────────────────────

@router.get("/recovery/demo-table")
def read_demo_table():
    """Read current state of the recovery demo table."""
    try:
        columns, rows, _ = execute_query(
            "SELECT * FROM appshield.recovery_demo ORDER BY id"
        )
        # Convert Decimal to float for JSON serialization
        for row in rows:
            for k, v in row.items():
                if isinstance(v, Decimal):
                    row[k] = float(v)
                elif isinstance(v, datetime):
                    row[k] = v.isoformat()
        return {
            "rows": rows,
            "row_count": len(rows),
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
    except Exception as e:
        logger.warning("Failed to read demo table: %s", e)
        raise HTTPException(status_code=500, detail=str(e))


# ── Take Snapshot ───────────────────────────────────────────────────

@router.post("/recovery/snapshot")
def take_snapshot():
    """Record the current timestamp as a snapshot (restore point)."""
    try:
        _, rows, _ = execute_query(
            "SELECT COUNT(*) as cnt FROM appshield.recovery_demo"
        )
        row_count = rows[0]["cnt"] if rows else 0
        short_id = uuid.uuid4().hex[:8]
        ts = datetime.now(timezone.utc).isoformat()
        return {
            "snapshot_id": f"snap-{short_id}",
            "timestamp": ts,
            "row_count": row_count,
        }
    except Exception as e:
        logger.warning("Failed to take snapshot: %s", e)
        raise HTTPException(status_code=500, detail=str(e))


# ── Corrupt Data ────────────────────────────────────────────────────

@router.post("/recovery/corrupt")
def corrupt_data():
    """Simulate data corruption by deleting all rows."""
    try:
        _, rows, _ = execute_query(
            "SELECT COUNT(*) as cnt FROM appshield.recovery_demo"
        )
        row_count = rows[0]["cnt"] if rows else 0
        with get_conn() as conn:
            with conn.cursor() as cur:
                cur.execute("DELETE FROM appshield.recovery_demo")
        return {"status": "corrupted", "rows_deleted": row_count}
    except Exception as e:
        logger.warning("Failed to corrupt data: %s", e)
        raise HTTPException(status_code=500, detail=str(e))


# ── Restore from Snapshot ───────────────────────────────────────────

@router.post("/recovery/restore")
def restore_from_snapshot(body: RestoreRequest):
    """Restore data from a snapshot timestamp using PITR branching."""
    start_time = time.time()
    short_id = uuid.uuid4().hex[:8]
    branch_name = f"recovery-{short_id}"

    try:
        # 1. Create a PITR branch at the snapshot timestamp
        logger.info("Creating PITR branch %s at %s", branch_name, body.snapshot_timestamp)
        _api("POST", f"projects/{PROJECT}/branches?branch_id={branch_name}", body={
            "spec": {
                "source_branch": f"projects/{PROJECT}/branches/{BRANCH}",
                "source_timestamp": body.snapshot_timestamp,
                "no_expiry": True,
            }
        })

        # 2. Wait for branch to be READY
        logger.info("Waiting for branch %s to be READY...", branch_name)
        for _ in range(15):  # max 30 seconds
            time.sleep(2)
            resp = _api("GET", f"projects/{PROJECT}/branches/{branch_name}")
            state = resp.get("status", {}).get("current_state", "")
            logger.info("Branch %s state: %s", branch_name, state)
            if state == "READY":
                break
        else:
            raise Exception(f"Branch {branch_name} did not become READY within 30 seconds")

        # 3. Create an endpoint on the branch
        ep_name = "restore-ep"
        logger.info("Creating endpoint %s on branch %s", ep_name, branch_name)
        _api("POST", f"projects/{PROJECT}/branches/{branch_name}/endpoints?endpoint_id={ep_name}", body={
            "spec": {
                "endpoint_type": "ENDPOINT_TYPE_READ_WRITE",
                "autoscaling_limit_min_cu": 0.5,
                "autoscaling_limit_max_cu": 2,
            }
        })

        # 4. Wait for endpoint to be ACTIVE
        logger.info("Waiting for endpoint %s to be ACTIVE...", ep_name)
        restore_host = None
        for _ in range(20):  # max 60 seconds
            time.sleep(3)
            ep = _api("GET", f"projects/{PROJECT}/branches/{branch_name}/endpoints/{ep_name}")
            ep_state = ep.get("status", {}).get("current_state", "")
            logger.info("Endpoint %s state: %s", ep_name, ep_state)
            if ep_state in ("ACTIVE", "IDLE"):
                restore_host = ep.get("status", {}).get("hosts", {}).get("host", "")
                break
        else:
            raise Exception(f"Endpoint {ep_name} did not become ACTIVE within 60 seconds")

        if not restore_host:
            raise Exception("Endpoint became active but no host found")

        # 5. Connect to restored branch and read the data
        logger.info("Connecting to restored branch at %s", restore_host)
        restore_conn = _connect_to_host(restore_host)
        try:
            with restore_conn.cursor() as cur:
                cur.execute("SELECT customer, action, amount FROM appshield.recovery_demo ORDER BY id")
                restored_rows = cur.fetchall()
        finally:
            restore_conn.close()

        logger.info("Read %d rows from restored branch", len(restored_rows))

        # 6. Copy rows back to production
        if restored_rows:
            with get_conn() as conn:
                with conn.cursor() as cur:
                    for row in restored_rows:
                        cur.execute(
                            "INSERT INTO appshield.recovery_demo (customer, action, amount) VALUES (%s, %s, %s)",
                            (row[0], row[1], row[2]),
                        )
            logger.info("Copied %d rows back to production", len(restored_rows))

        # 7. Cleanup: delete the recovery branch
        try:
            _api("DELETE", f"projects/{PROJECT}/branches/{branch_name}")
            logger.info("Deleted recovery branch %s", branch_name)
        except Exception as cleanup_err:
            logger.warning("Failed to cleanup branch %s: %s", branch_name, cleanup_err)

        elapsed = round(time.time() - start_time, 1)
        return {
            "status": "restored",
            "rows_recovered": len(restored_rows),
            "branch_used": branch_name,
            "elapsed_seconds": elapsed,
        }

    except HTTPException:
        raise
    except Exception as e:
        # Try to cleanup branch on failure
        try:
            _api("DELETE", f"projects/{PROJECT}/branches/{branch_name}")
        except Exception:
            pass
        logger.warning("Restore failed: %s", e)
        raise HTTPException(status_code=500, detail=str(e))


# ── Cleanup ─────────────────────────────────────────────────────────

@router.post("/recovery/cleanup")
def cleanup_recovery_branches():
    """Delete any leftover recovery branches."""
    try:
        resp = _api("GET", f"projects/{PROJECT}/branches")
        deleted = []
        for b in resp.get("branches", []):
            name = b.get("name", "").split("/")[-1]
            if name.startswith("recovery-"):
                try:
                    _api("DELETE", f"projects/{PROJECT}/branches/{name}")
                    deleted.append(name)
                    logger.info("Cleaned up recovery branch: %s", name)
                except Exception as e:
                    logger.warning("Failed to delete branch %s: %s", name, e)
        return {"status": "cleaned", "deleted": deleted, "count": len(deleted)}
    except Exception as e:
        logger.warning("Cleanup failed: %s", e)
        raise HTTPException(status_code=500, detail=str(e))
