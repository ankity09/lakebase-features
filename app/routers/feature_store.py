import time
import random
from fastapi import APIRouter, HTTPException, Query
from app.services.db import execute_query

router = APIRouter(prefix="/api", tags=["feature_store"])

ALLOWED_TABLES = {"telemetry_events", "customer_features", "model_predictions", "event_embeddings"}


@router.get("/features/table")
def browse_features(
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=500),
    customer_id: str | None = Query(None),
):
    """Paginated browse of the customer_features table."""
    try:
        conditions = []
        params: list = []
        if customer_id:
            conditions.append("customer_id = %s")
            params.append(customer_id)

        where_clause = " AND ".join(conditions) if conditions else "TRUE"

        # Total count
        count_sql = f"SELECT COUNT(*) AS total FROM appshield.customer_features WHERE {where_clause}"
        _, count_rows, _ = execute_query(count_sql, params or None)
        total = count_rows[0]["total"] if count_rows else 0

        # Paginated query
        offset = (page - 1) * page_size
        data_sql = (
            f"SELECT * FROM appshield.customer_features WHERE {where_clause} "
            f"ORDER BY time_bucket DESC LIMIT %s OFFSET %s"
        )
        data_params = params + [page_size, offset]
        columns, rows, latency = execute_query(data_sql, data_params)

        return {
            "columns": columns,
            "rows": rows,
            "total": total,
            "page": page,
            "page_size": page_size,
            "total_pages": (total + page_size - 1) // page_size if page_size > 0 else 0,
            "latency_ms": round(latency, 2),
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/features/{customer_id}")
def get_features(customer_id: str):
    """Get latest features for a customer from Lakebase. Returns real latency."""
    try:
        sql = """
            SELECT * FROM appshield.customer_features
            WHERE customer_id = %s
            ORDER BY time_bucket DESC
            LIMIT 10
        """
        columns, rows, latency = execute_query(sql, (customer_id,))
        if not rows:
            raise HTTPException(status_code=404, detail=f"No features found for customer '{customer_id}'")

        # Extract the latest row as the primary feature set
        latest = rows[0]

        return {
            "customer_id": customer_id,
            "features": latest,
            "history": rows,
            "latency_ms": round(latency, 2),
            "source": "lakebase",
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/features/{customer_id}/batch")
def get_features_batch(customer_id: str):
    """Simulate a batch/Delta lookup with higher latency (200-500ms added)."""
    try:
        # Simulate Delta table query overhead
        simulated_delay_ms = random.uniform(200, 500)
        time.sleep(simulated_delay_ms / 1000)

        sql = """
            SELECT * FROM appshield.customer_features
            WHERE customer_id = %s
            ORDER BY time_bucket DESC
            LIMIT 10
        """
        columns, rows, db_latency = execute_query(sql, (customer_id,))
        if not rows:
            raise HTTPException(status_code=404, detail=f"No features found for customer '{customer_id}'")

        latest = rows[0]
        total_latency = db_latency + simulated_delay_ms

        return {
            "customer_id": customer_id,
            "features": latest,
            "history": rows,
            "latency_ms": round(total_latency, 2),
            "db_latency_ms": round(db_latency, 2),
            "overhead_ms": round(simulated_delay_ms, 2),
            "source": "delta",
            "note": "Simulated Delta table lookup with added ETL/network overhead.",
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
