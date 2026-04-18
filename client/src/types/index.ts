export interface HealthResponse {
  status: string
  latency_ms: number
  host: string
  port: number
  database: string
  user: string
  pg_version: string | null
  project_id: string | null
}

export interface QueryResponse {
  columns: string[]
  rows: Record<string, any>[]
  row_count: number
  latency_ms: number
}

export interface FeatureLookupResponse {
  customer_id: string
  features: Record<string, any>
  history?: Record<string, any>[]
  latency_ms: number
  source: string
}

export interface BranchInfo {
  name: string
  state: string
  parent_branch: string | null
  created_at: string | null
  is_default: boolean
  is_protected: boolean
  logical_size_bytes: number
}

export interface BranchCompareResponse {
  base_branch: string
  target_branch: string
  summary: {
    tables_added: number
    tables_removed: number
    columns_changed: number
    indexes_added: number
    indexes_removed: number
  }
  tables_added: { name: string; row_count: number }[]
  tables_removed: { name: string; row_count: number }[]
  column_diffs: {
    table: string
    columns_added: { name: string; data_type: string; is_nullable: string }[]
    columns_removed: { name: string; data_type: string }[]
  }[]
  indexes_added: { name: string; definition: string }[]
  indexes_removed: { name: string; definition: string }[]
  row_counts: { base: Record<string, number>; target: Record<string, number> }
}

export interface TableInfo {
  table_name: string
  table_schema: string
  row_count: number
  column_count: number
}

export interface ColumnInfo {
  name: string
  data_type: string
  is_nullable: boolean
  default_value: string | null
}

export interface PreviewResponse {
  affected_rows: number
  confirmation_token: string
}

export interface EndpointStatus {
  name: string
  state: string
  raw_state?: string
  type: string
  compute_units: number | null
  host: string | null
}
