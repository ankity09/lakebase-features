import os
from databricks.sdk import WorkspaceClient

_client: WorkspaceClient | None = None


def get_workspace_client() -> WorkspaceClient:
    global _client
    if _client is None:
        host = os.environ.get("DATABRICKS_HOST", "")
        token = os.environ.get("DATABRICKS_TOKEN", "")
        if host and token:
            _client = WorkspaceClient(host=host, token=token)
        else:
            # In Databricks Apps, SDK auto-discovers credentials
            _client = WorkspaceClient()
    return _client


def get_project_id() -> str:
    return os.environ.get("LAKEBASE_PROJECT_ID", "")
