import logging
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from app.services.db import execute_query
from app.services.lakebase_api import get_workspace_client, get_project_id

router = APIRouter(prefix="/api", tags=["sync"])
logger = logging.getLogger(__name__)

ALLOWED_TABLES = {"telemetry_events", "customer_features", "model_predictions", "event_embeddings"}

# ---- Mock data for when SDK isn't available ----

MOCK_PIPELINES = [
    {
        "pipeline_id": "sync-pipe-001",
        "source_table": "appshield.telemetry_events",
        "target_table": "catalog.appshield.telemetry_events_delta",
        "mode": "snapshot",
        "state": "ACTIVE",
        "last_sync_time": "2026-04-13T08:30:00Z",
        "rows_synced": 50000,
    },
    {
        "pipeline_id": "sync-pipe-002",
        "source_table": "appshield.customer_features",
        "target_table": "catalog.appshield.customer_features_delta",
        "mode": "snapshot",
        "state": "ACTIVE",
        "last_sync_time": "2026-04-13T08:35:00Z",
        "rows_synced": 60000,
    },
    {
        "pipeline_id": "sync-pipe-003",
        "source_table": "appshield.model_predictions",
        "target_table": "catalog.appshield.model_predictions_delta",
        "mode": "snapshot",
        "state": "ACTIVE",
        "last_sync_time": "2026-04-13T08:28:00Z",
        "rows_synced": 1000,
    },
]


class CreatePipelineRequest(BaseModel):
    source_table: str
    target_table: str
    mode: str = "snapshot"


class TriggerSyncRequest(BaseModel):
    pipeline_id: str


@router.get("/sync/pipelines")
def list_pipelines():
    """List sync pipelines. Uses SDK if available, otherwise returns mock data."""
    try:
        w = get_workspace_client()
        project_id = get_project_id()
        if project_id:
            # Attempt to list sync pipelines via SDK
            try:
                pipelines = w.lakebase.list_sync_pipelines(project_id=project_id)
                result = []
                for p in pipelines:
                    result.append({
                        "pipeline_id": getattr(p, "pipeline_id", "unknown"),
                        "source_table": getattr(p, "source_table", ""),
                        "target_table": getattr(p, "target_table", ""),
                        "mode": getattr(p, "mode", "snapshot"),
                        "state": getattr(p, "state", "UNKNOWN"),
                        "last_sync_time": str(getattr(p, "last_sync_time", "")),
                        "rows_synced": getattr(p, "rows_synced", None),
                    })
                return {"pipelines": result, "source": "sdk"}
            except Exception as sdk_err:
                logger.warning("SDK sync list failed, using mock: %s", sdk_err)
    except Exception:
        pass

    return {"pipelines": MOCK_PIPELINES, "source": "mock"}


@router.post("/sync/pipeline")
def create_pipeline(body: CreatePipelineRequest):
    """Create a new sync pipeline."""
    try:
        w = get_workspace_client()
        project_id = get_project_id()
        if project_id:
            try:
                result = w.lakebase.create_sync_pipeline(
                    project_id=project_id,
                    source_table=body.source_table,
                    target_table=body.target_table,
                    mode=body.mode,
                )
                return {
                    "pipeline_id": getattr(result, "pipeline_id", "created"),
                    "state": getattr(result, "state", "CREATED"),
                    "source": "sdk",
                }
            except Exception as sdk_err:
                logger.warning("SDK create pipeline failed, simulating: %s", sdk_err)
    except Exception:
        pass

    # Simulated response
    import uuid
    return {
        "pipeline_id": f"sync-pipe-{uuid.uuid4().hex[:6]}",
        "source_table": body.source_table,
        "target_table": body.target_table,
        "mode": body.mode,
        "state": "CREATED",
        "source": "mock",
    }


@router.post("/sync/trigger")
def trigger_sync(body: TriggerSyncRequest):
    """Trigger a sync run for a pipeline."""
    try:
        w = get_workspace_client()
        project_id = get_project_id()
        if project_id:
            try:
                result = w.lakebase.trigger_sync(
                    project_id=project_id,
                    pipeline_id=body.pipeline_id,
                )
                return {
                    "pipeline_id": body.pipeline_id,
                    "run_id": getattr(result, "run_id", "triggered"),
                    "state": "RUNNING",
                    "source": "sdk",
                }
            except Exception as sdk_err:
                logger.warning("SDK trigger sync failed, simulating: %s", sdk_err)
    except Exception:
        pass

    return {
        "pipeline_id": body.pipeline_id,
        "run_id": "mock-run-001",
        "state": "RUNNING",
        "triggered_at": datetime.now(timezone.utc).isoformat(),
        "source": "mock",
    }


@router.get("/sync/status")
def sync_status():
    """Get overall sync pipeline status."""
    try:
        w = get_workspace_client()
        project_id = get_project_id()
        if project_id:
            try:
                pipelines = w.lakebase.list_sync_pipelines(project_id=project_id)
                states = {}
                for p in pipelines:
                    state = getattr(p, "state", "UNKNOWN")
                    states[state] = states.get(state, 0) + 1
                return {"status_counts": states, "source": "sdk"}
            except Exception as sdk_err:
                logger.warning("SDK sync status failed, using mock: %s", sdk_err)
    except Exception:
        pass

    return {
        "status_counts": {"ACTIVE": 3, "PAUSED": 0, "ERROR": 0},
        "total_pipelines": 3,
        "last_check": datetime.now(timezone.utc).isoformat(),
        "source": "mock",
    }


@router.get("/sync/comparison")
def sync_comparison():
    """Compare row counts: Lakebase (psycopg2) vs Delta table (mock/placeholder)."""
    try:
        comparisons = []
        for table in ["telemetry_events", "customer_features", "model_predictions"]:
            # Real count from Lakebase
            _, rows, _ = execute_query(
                f"SELECT COUNT(*) AS cnt FROM appshield.{table}"
            )
            lakebase_count = rows[0]["cnt"] if rows else 0

            # Delta count: mock/placeholder since we can't reach Databricks SQL directly
            delta_count = lakebase_count  # In a real setup, query via Databricks SQL

            comparisons.append({
                "lakebase_table": f"appshield.{table}",
                "delta_table": f"catalog.appshield.{table}_delta",
                "lakebase_row_count": lakebase_count,
                "delta_row_count": delta_count,
                "in_sync": lakebase_count == delta_count,
                "delta_source": "mock",
            })

        return {"comparisons": comparisons}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
