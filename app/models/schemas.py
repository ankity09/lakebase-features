from pydantic import BaseModel, Field
from typing import Any
import uuid


class HealthResponse(BaseModel):
    status: str
    latency_ms: float
    host: str
    port: int
    database: str
    user: str
    pg_version: str | None = None
    project_id: str | None = None


class OverviewStats(BaseModel):
    instance_status: str
    storage_used_mb: float
    active_connections: int
    avg_query_latency_ms: float
    pg_version: str | None = None


class TableInfo(BaseModel):
    name: str
    schema_name: str = "appshield"
    row_count: int
    column_count: int


class ColumnInfo(BaseModel):
    name: str
    data_type: str
    is_nullable: bool
    default_value: str | None = None
    constraints: list[str] = Field(default_factory=list)


class QueryRequest(BaseModel):
    sql: str


class QueryResponse(BaseModel):
    columns: list[str]
    rows: list[dict[str, Any]]
    row_count: int
    latency_ms: float


class FilteredQueryRequest(BaseModel):
    filters: dict[str, Any] = Field(default_factory=dict)
    sort_by: str | None = None
    sort_order: str = "ASC"
    page: int = 1
    page_size: int = 50


class InsertRequest(BaseModel):
    records: list[dict[str, Any]]


class UpdateRequest(BaseModel):
    set_values: dict[str, Any]
    where: dict[str, Any]
    preview: bool = False
    confirmation_token: str | None = None


class DeleteRequest(BaseModel):
    where: dict[str, Any]
    preview: bool = False
    confirmation_token: str | None = None


class PreviewResponse(BaseModel):
    affected_rows: int
    confirmation_token: str = Field(default_factory=lambda: str(uuid.uuid4()))


class ErrorResponse(BaseModel):
    error: str
    detail: str | None = None
    status_code: int


class BranchInfo(BaseModel):
    name: str
    state: str
    parent_branch: str | None = None
    created_at: str | None = None
    endpoint_host: str | None = None


class BranchCompareResponse(BaseModel):
    base_branch: str
    target_branch: str
    table_diffs: list[dict[str, Any]]


class AutoscalingConfig(BaseModel):
    min_cu: int
    max_cu: int
    current_cu: int | None = None
    memory_gib: int | None = None


class EndpointStatus(BaseModel):
    name: str
    state: str
    type: str  # "r_w" or "r_o"
    compute_units: int | None = None
    host: str | None = None


class SyncPipelineInfo(BaseModel):
    pipeline_id: str
    source_table: str
    target_table: str
    mode: str
    state: str
    last_sync_time: str | None = None
    rows_synced: int | None = None


class SyncComparison(BaseModel):
    delta_row_count: int
    lakebase_row_count: int
    delta_table: str
    lakebase_table: str


class FeatureLookupResponse(BaseModel):
    customer_id: str
    features: dict[str, Any]
    latency_ms: float
    source: str  # "lakebase" or "delta"


class VectorSearchRequest(BaseModel):
    query: str
    top_n: int = 10


class VectorSearchResult(BaseModel):
    event_summary: str
    category: str
    distance: float
    score: float


class MonitoringMetrics(BaseModel):
    tps: float
    active_connections: int
    cache_hit_rate: float
    storage_used_mb: float
    cpu_percent: float | None = None


class SlowQuery(BaseModel):
    query: str
    calls: int
    mean_exec_time_ms: float
    total_exec_time_ms: float
