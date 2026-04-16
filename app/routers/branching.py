import logging
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from app.services.db import execute_query
from app.services.lakebase_api import get_workspace_client, get_project_id

router = APIRouter(prefix="/api", tags=["branching"])
logger = logging.getLogger(__name__)

ALLOWED_TABLES = {"telemetry_events", "customer_features", "model_predictions", "event_embeddings"}

# ---- Mock data ----

MOCK_BRANCHES = [
    {
        "name": "main",
        "state": "ACTIVE",
        "parent_branch": None,
        "created_at": "2026-04-01T00:00:00Z",
        "endpoint_host": "main.lakebase.example.com",
    },
    {
        "name": "feature/schema-v2",
        "state": "ACTIVE",
        "parent_branch": "main",
        "created_at": "2026-04-10T14:30:00Z",
        "endpoint_host": "feature-schema-v2.lakebase.example.com",
    },
    {
        "name": "staging",
        "state": "ACTIVE",
        "parent_branch": "main",
        "created_at": "2026-04-05T09:00:00Z",
        "endpoint_host": "staging.lakebase.example.com",
    },
]


class CreateBranchRequest(BaseModel):
    name: str
    parent_branch: str = "main"


@router.get("/branches")
def list_branches():
    """List database branches. Graceful fallback to mock data."""
    try:
        w = get_workspace_client()
        project_id = get_project_id()
        if project_id:
            try:
                branches = w.lakebase.list_branches(project_id=project_id)
                result = []
                for b in branches:
                    result.append({
                        "name": getattr(b, "name", "unknown"),
                        "state": getattr(b, "state", "UNKNOWN"),
                        "parent_branch": getattr(b, "parent_branch", None),
                        "created_at": str(getattr(b, "created_at", "")),
                        "endpoint_host": getattr(b, "endpoint_host", None),
                    })
                return {"branches": result, "source": "sdk"}
            except Exception as sdk_err:
                logger.warning("SDK branch list failed, using mock: %s", sdk_err)
    except Exception:
        pass

    return {"branches": MOCK_BRANCHES, "source": "mock"}


@router.post("/branches")
def create_branch(body: CreateBranchRequest):
    """Create a new database branch."""
    if not body.name.strip():
        raise HTTPException(status_code=400, detail="Branch name cannot be empty")

    try:
        w = get_workspace_client()
        project_id = get_project_id()
        if project_id:
            try:
                result = w.lakebase.create_branch(
                    project_id=project_id,
                    name=body.name,
                    parent_branch=body.parent_branch,
                )
                return {
                    "name": getattr(result, "name", body.name),
                    "state": getattr(result, "state", "CREATING"),
                    "parent_branch": body.parent_branch,
                    "source": "sdk",
                }
            except Exception as sdk_err:
                logger.warning("SDK create branch failed, simulating: %s", sdk_err)
    except Exception:
        pass

    return {
        "name": body.name,
        "state": "CREATING",
        "parent_branch": body.parent_branch,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "source": "mock",
    }


@router.delete("/branches/{name}")
def delete_branch(name: str, confirm: bool = Query(False)):
    """Delete a database branch. Cannot delete 'main'."""
    if name == "main":
        raise HTTPException(status_code=400, detail="Cannot delete the 'main' branch")
    if not confirm:
        raise HTTPException(
            status_code=400,
            detail="Must pass ?confirm=true to delete a branch",
        )

    try:
        w = get_workspace_client()
        project_id = get_project_id()
        if project_id:
            try:
                w.lakebase.delete_branch(project_id=project_id, name=name)
                return {"deleted": name, "source": "sdk"}
            except Exception as sdk_err:
                logger.warning("SDK delete branch failed, simulating: %s", sdk_err)
    except Exception:
        pass

    return {"deleted": name, "source": "mock"}


@router.get("/branches/compare")
def compare_branches(
    base: str = Query("main", description="Base branch name"),
    target: str = Query(..., description="Target branch name"),
):
    """Compare schema and row counts between two branches."""
    if base == target:
        raise HTTPException(status_code=400, detail="Base and target branches must be different")

    # Attempt to get real data from the current connection (which is the 'main' branch)
    try:
        table_diffs = []
        for table in sorted(ALLOWED_TABLES):
            # Get column info from current connection
            _, base_cols, _ = execute_query(
                "SELECT column_name, data_type FROM information_schema.columns "
                "WHERE table_schema = 'appshield' AND table_name = %s ORDER BY ordinal_position",
                (table,),
            )

            # Get row count from current connection
            _, base_count, _ = execute_query(
                f"SELECT COUNT(*) AS cnt FROM appshield.{table}"
            )
            base_rows = base_count[0]["cnt"] if base_count else 0

            # For the target branch, simulate differences since we can't
            # connect to a separate branch endpoint in this demo context
            import random
            target_rows = base_rows + random.randint(-100, 500)
            if target_rows < 0:
                target_rows = 0

            # Simulate potential schema diff on the target branch
            target_cols = list(base_cols)  # Copy
            schema_changes = []
            if table == "telemetry_events" and target != "main":
                schema_changes.append({
                    "type": "column_added",
                    "column": "threat_score",
                    "data_type": "double precision",
                    "branch": target,
                })

            table_diffs.append({
                "table": table,
                "base_row_count": base_rows,
                "target_row_count": target_rows,
                "row_diff": target_rows - base_rows,
                "base_column_count": len(base_cols),
                "target_column_count": len(base_cols) + len(schema_changes),
                "schema_changes": schema_changes,
            })

        return {
            "base_branch": base,
            "target_branch": target,
            "table_diffs": table_diffs,
            "source": "hybrid",
            "note": "Base branch data is live; target branch diffs are simulated for demo.",
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
