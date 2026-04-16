import logging
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from app.services.lakebase_api import get_workspace_client

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


@router.get("/branches/compare")
def compare_branches(base: str = Query(...), target: str = Query(...)):
    """Compare two branches by size and state."""
    try:
        base_data = _api("GET", f"projects/{PROJECT}/branches/{base}")
        target_data = _api("GET", f"projects/{PROJECT}/branches/{target}")

        base_status = base_data.get("status", {})
        target_status = target_data.get("status", {})

        return {
            "base_branch": base,
            "target_branch": target,
            "base_size_bytes": base_status.get("logical_size_bytes", 0),
            "target_size_bytes": target_status.get("logical_size_bytes", 0),
            "base_state": base_status.get("current_state", "UNKNOWN"),
            "target_state": target_status.get("current_state", "UNKNOWN"),
        }
    except Exception as e:
        logger.warning("Failed to compare branches: %s", e)
        raise HTTPException(status_code=500, detail=str(e))
