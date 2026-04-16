import time
from fastapi import APIRouter, HTTPException
from app.services.db import get_conn, execute_query
from app.models.schemas import QueryRequest, QueryResponse

router = APIRouter(prefix="/api", tags=["query"])

QUERY_TEMPLATES = [
    {
        "name": "Top 10 customers by request volume",
        "sql": (
            "SELECT customer_id, COUNT(*) as request_count "
            "FROM appshield.telemetry_events "
            "GROUP BY customer_id ORDER BY request_count DESC LIMIT 10"
        ),
        "description": "Shows which customers generate the most telemetry events.",
    },
    {
        "name": "Events with HSTS enabled (last 24h)",
        "sql": (
            "SELECT * FROM appshield.telemetry_events "
            "WHERE hsts_present = true AND event_time > NOW() - INTERVAL '24 hours' LIMIT 100"
        ),
        "description": "Recent events where HSTS security header was present.",
    },
    {
        "name": "Average payload size by region",
        "sql": (
            "SELECT region, AVG(payload_size_bytes) as avg_payload "
            "FROM appshield.telemetry_events "
            "GROUP BY region ORDER BY avg_payload DESC"
        ),
        "description": "Compare average request payload sizes across regions.",
    },
    {
        "name": "Application classification distribution",
        "sql": (
            "SELECT app_classification, COUNT(*) as count, AVG(confidence) as avg_confidence "
            "FROM appshield.model_predictions "
            "GROUP BY app_classification ORDER BY count DESC"
        ),
        "description": "Distribution of ML model predictions across application types.",
    },
    {
        "name": "Feature store: latest features for customer",
        "sql": (
            "SELECT * FROM appshield.customer_features "
            "WHERE customer_id = 'acme-corp' ORDER BY time_bucket DESC LIMIT 10"
        ),
        "description": "Latest feature vectors for a specific customer from the feature store.",
    },
]

ROW_LIMIT = 1000


@router.post("/query/execute")
def execute_sql(body: QueryRequest):
    """Execute arbitrary SQL, limited to 1000 rows."""
    sql = body.sql.strip()
    if not sql:
        raise HTTPException(status_code=400, detail="SQL query cannot be empty")
    try:
        # Wrap with LIMIT if not already present (safety net)
        sql_lower = sql.lower().rstrip(";")
        if "limit" not in sql_lower:
            sql_exec = f"SELECT * FROM ({sql_lower}) AS _q LIMIT {ROW_LIMIT}"
        else:
            sql_exec = sql

        columns, rows, latency = execute_query(sql_exec)
        return QueryResponse(
            columns=columns,
            rows=rows,
            row_count=len(rows),
            latency_ms=round(latency, 2),
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/query/explain")
def explain_query(body: QueryRequest):
    """Run EXPLAIN (ANALYZE, FORMAT JSON) inside a rolled-back transaction."""
    sql = body.sql.strip()
    if not sql:
        raise HTTPException(status_code=400, detail="SQL query cannot be empty")
    try:
        explain_sql = f"EXPLAIN (ANALYZE, FORMAT JSON) {sql}"
        with get_conn() as conn:
            with conn.cursor() as cur:
                start = time.perf_counter()
                cur.execute(explain_sql)
                latency_ms = (time.perf_counter() - start) * 1000
                result = cur.fetchone()
            conn.rollback()  # Roll back so ANALYZE doesn't persist side effects

        plan = result[0] if result else []
        return {
            "plan": plan,
            "latency_ms": round(latency_ms, 2),
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/query/templates")
def get_templates():
    """Return hardcoded AppShield query templates."""
    return {"templates": QUERY_TEMPLATES}
