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

# Use model_predictions table — it was created during seed and has stable data
TABLE = "appshield.model_predictions"


def _api(method, path, body=None):
    w = get_workspace_client()
    kwargs = {"body": body} if body else {}
    return w.api_client.do(method, f"/api/2.0/postgres/{path}", **kwargs)


def _connect_to_host(host):
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


# ── Read Table State ───────────────────────────────────────────────

@router.get("/recovery/demo-table")
def read_demo_table():
    """Read current state of model_predictions table."""
    try:
        _, rows, lat = execute_query(
            f"SELECT prediction_id, customer_id, predicted_at, app_classification, confidence FROM {TABLE} ORDER BY predicted_at DESC LIMIT 20"
        )
        _, count_rows, _ = execute_query(f"SELECT COUNT(*) as cnt FROM {TABLE}")
        total = count_rows[0]["cnt"] if count_rows else 0
        for row in rows:
            for k, v in row.items():
                if isinstance(v, Decimal):
                    row[k] = float(v)
                elif isinstance(v, datetime):
                    row[k] = v.isoformat()
                elif hasattr(v, 'isoformat'):
                    row[k] = str(v)
        return {"rows": rows, "row_count": total, "showing": len(rows), "timestamp": datetime.now(timezone.utc).isoformat()}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── Setup (no-op for model_predictions — already exists) ──────────

@router.post("/recovery/demo-table")
def setup_demo_table():
    """Verify model_predictions table exists and return row count."""
    try:
        _, rows, _ = execute_query(f"SELECT COUNT(*) as cnt FROM {TABLE}")
        count = rows[0]["cnt"] if rows else 0
        return {"status": "ready", "row_count": count, "table": TABLE}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── Take Snapshot ──────────────────────────────────────────────────

@router.post("/recovery/snapshot")
def take_snapshot():
    """Record the current timestamp as a restore point."""
    try:
        _, ts_rows, _ = execute_query("SELECT NOW() as ts")
        _, count_rows, _ = execute_query(f"SELECT COUNT(*) as cnt FROM {TABLE}")
        row_count = count_rows[0]["cnt"] if count_rows else 0
        db_ts = str(ts_rows[0]["ts"]) if ts_rows else datetime.now(timezone.utc).isoformat()
        logger.info("Snapshot: %s, rows: %d", db_ts, row_count)
        return {
            "snapshot_id": f"snap-{uuid.uuid4().hex[:8]}",
            "timestamp": db_ts,
            "row_count": row_count,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── Corrupt Data ───────────────────────────────────────────────────

@router.post("/recovery/corrupt")
def corrupt_data():
    """Simulate data corruption by deleting rows from model_predictions."""
    try:
        _, before, _ = execute_query(f"SELECT COUNT(*) as cnt FROM {TABLE}")
        before_count = before[0]["cnt"] if before else 0
        with get_conn() as conn:
            with conn.cursor() as cur:
                cur.execute(f"DELETE FROM {TABLE}")
        _, after, _ = execute_query(f"SELECT COUNT(*) as cnt FROM {TABLE}")
        after_count = after[0]["cnt"] if after else 0
        logger.info("Corrupted: deleted %d rows, %d remaining", before_count - after_count, after_count)
        return {"status": "corrupted", "rows_deleted": before_count, "rows_remaining": after_count}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── Restore from Snapshot ──────────────────────────────────────────

@router.post("/recovery/restore")
def restore_from_snapshot(body: RestoreRequest):
    """Restore model_predictions from a PITR branch."""
    start_time = time.time()
    branch_name = f"recovery-{uuid.uuid4().hex[:8]}"

    try:
        # Normalize timestamp
        raw_ts = body.snapshot_timestamp.strip()
        if " " in raw_ts and "T" not in raw_ts:
            raw_ts = raw_ts.replace(" ", "T")
        if "." in raw_ts:
            raw_ts = raw_ts.split(".")[0]
        if "+" in raw_ts:
            raw_ts = raw_ts.split("+")[0]
        if not raw_ts.endswith("Z"):
            raw_ts = raw_ts + "Z"

        logger.info("Creating PITR branch %s at %s", branch_name, raw_ts)
        _api("POST", f"projects/{PROJECT}/branches?branch_id={branch_name}", body={
            "spec": {
                "source_branch": f"projects/{PROJECT}/branches/{BRANCH}",
                "source_timestamp": raw_ts,
                "no_expiry": True,
            }
        })

        # Wait for READY
        for _ in range(15):
            time.sleep(2)
            resp = _api("GET", f"projects/{PROJECT}/branches/{branch_name}")
            if resp.get("status", {}).get("current_state") == "READY":
                break

        # Find endpoint
        restore_host = None
        for _ in range(20):
            time.sleep(3)
            try:
                eps = _api("GET", f"projects/{PROJECT}/branches/{branch_name}/endpoints")
                for ep in eps.get("endpoints", []):
                    st = ep.get("status", {})
                    if st.get("current_state") in ("ACTIVE", "IDLE") and st.get("hosts", {}).get("host"):
                        restore_host = st["hosts"]["host"]
                        break
                if restore_host:
                    break
            except:
                pass

        if not restore_host:
            raise Exception("No active endpoint on recovery branch")

        # Read from restored branch
        time.sleep(3)
        logger.info("Reading from restored branch at %s", restore_host)
        restore_conn = _connect_to_host(restore_host)
        try:
            with restore_conn.cursor() as cur:
                cur.execute(f"SELECT COUNT(*) FROM {TABLE}")
                count = cur.fetchone()[0]
                logger.info("Rows on restored branch: %d", count)

                cur.execute(f"SELECT customer_id, predicted_at, app_classification, confidence, features_used FROM {TABLE}")
                restored_rows = cur.fetchall()
        finally:
            restore_conn.close()

        # Copy back to production
        if restored_rows:
            with get_conn() as conn:
                with conn.cursor() as cur:
                    for r in restored_rows:
                        cur.execute(
                            f"INSERT INTO {TABLE} (customer_id, predicted_at, app_classification, confidence, features_used) VALUES (%s, %s, %s, %s, %s)",
                            (r[0], r[1], r[2], r[3], r[4]),
                        )
            logger.info("Restored %d rows to production", len(restored_rows))

        # Cleanup
        try:
            _api("DELETE", f"projects/{PROJECT}/branches/{branch_name}")
        except:
            pass

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
        try:
            _api("DELETE", f"projects/{PROJECT}/branches/{branch_name}")
        except:
            pass
        raise HTTPException(status_code=500, detail=str(e))


# ── Cleanup ────────────────────────────────────────────────────────

@router.post("/recovery/cleanup")
def cleanup_recovery_branches():
    try:
        resp = _api("GET", f"projects/{PROJECT}/branches")
        deleted = []
        for b in resp.get("branches", []):
            name = b.get("name", "").split("/")[-1]
            if name.startswith("recovery-"):
                try:
                    _api("DELETE", f"projects/{PROJECT}/branches/{name}")
                    deleted.append(name)
                except:
                    pass
        return {"status": "cleaned", "deleted": deleted}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
