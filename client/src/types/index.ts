export interface HealthResponse {
  status: string;
  latency_ms: number;
  host: string;
  port: number;
  database: string;
  user: string;
  pg_version: string | null;
  project_id: string | null;
}

export interface OverviewStats {
  instance_status: string;
  storage_used_mb: number;
  active_connections: number;
  avg_query_latency_ms: number;
  pg_version: string | null;
}

export interface TableInfo {
  name: string;
  schema_name: string;
  row_count: number;
  column_count: number;
}

export interface ColumnInfo {
  name: string;
  data_type: string;
  is_nullable: boolean;
  default_value: string | null;
  constraints: string[];
}

export interface QueryResponse {
  columns: string[];
  rows: Record<string, unknown>[];
  row_count: number;
  latency_ms: number;
}

export interface PreviewResponse {
  affected_rows: number;
  confirmation_token: string;
}

export interface EndpointStatus {
  name: string;
  state: string;
  type: string;
  compute_units: number | null;
  host: string | null;
}

export interface FeatureLookupResponse {
  customer_id: string;
  features: Record<string, unknown>;
  latency_ms: number;
  source: string;
}

export interface VectorSearchResult {
  event_summary: string;
  category: string;
  distance: number;
  score: number;
}

export interface MonitoringMetrics {
  tps: number;
  active_connections: number;
  cache_hit_rate: number;
  storage_used_mb: number;
}

export interface SlowQuery {
  query: string;
  calls: number;
  mean_exec_time_ms: number;
  total_exec_time_ms: number;
}
