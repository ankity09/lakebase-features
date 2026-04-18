import time
import random
from fastapi import APIRouter, HTTPException, Query
from app.services.db import execute_query

router = APIRouter(prefix="/api", tags=["feature_store"])

# All allowed schema.table combos for feature tables
ALLOWED_FEATURE_TABLES = {
    ("appshield", "customer_features"),
    ("supply_chain", "shipment_features"),
    ("agriculture", "crop_features"),
    ("manufacturing", "equipment_features"),
}

# Entity ID column for each schema
ENTITY_ID_COLUMNS = {
    "appshield": "customer_id",
    "supply_chain": "shipment_id",
    "agriculture": "farm_id",
    "manufacturing": "equipment_id",
}


def _validate_feature_table(schema: str, table: str) -> tuple[str, str]:
    """Validate and return (fully_qualified_table, entity_id_column)."""
    if (schema, table) not in ALLOWED_FEATURE_TABLES:
        raise HTTPException(
            status_code=400,
            detail=f"Feature table '{schema}.{table}' not allowed. Must be one of: {sorted(f'{s}.{t}' for s, t in ALLOWED_FEATURE_TABLES)}",
        )
    entity_col = ENTITY_ID_COLUMNS.get(schema, "customer_id")
    return f"{schema}.{table}", entity_col


@router.get("/features/table")
def browse_features(
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=500),
    customer_id: str | None = Query(None),
    schema: str = Query("appshield"),
    table: str = Query("customer_features"),
):
    """Paginated browse of a feature table. Accepts schema/table to support all themes."""
    try:
        fq_table, entity_col = _validate_feature_table(schema, table)

        conditions = []
        params: list = []
        if customer_id:
            conditions.append(f"{entity_col} = %s")
            params.append(customer_id)

        where_clause = " AND ".join(conditions) if conditions else "TRUE"

        # Total count
        count_sql = f"SELECT COUNT(*) AS total FROM {fq_table} WHERE {where_clause}"
        _, count_rows, _ = execute_query(count_sql, params or None)
        total = count_rows[0]["total"] if count_rows else 0

        # Paginated query
        offset = (page - 1) * page_size
        data_sql = (
            f"SELECT * FROM {fq_table} WHERE {where_clause} "
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
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/features/{entity_id}")
def get_features(
    entity_id: str,
    schema: str = Query("appshield"),
    table: str = Query("customer_features"),
):
    """Get latest features for an entity from Lakebase. Returns real latency."""
    try:
        fq_table, entity_col = _validate_feature_table(schema, table)

        sql = f"""
            SELECT * FROM {fq_table}
            WHERE {entity_col} = %s
            ORDER BY time_bucket DESC
            LIMIT 10
        """
        columns, rows, latency = execute_query(sql, (entity_id,))
        if not rows:
            raise HTTPException(status_code=404, detail=f"No features found for '{entity_id}' in {fq_table}")

        # Extract the latest row as the primary feature set
        latest = rows[0]

        return {
            "customer_id": entity_id,
            "features": latest,
            "history": rows,
            "latency_ms": round(latency, 2),
            "source": "lakebase",
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/features/{entity_id}/batch")
def get_features_batch(
    entity_id: str,
    schema: str = Query("appshield"),
    table: str = Query("customer_features"),
):
    """Simulate a batch/Delta lookup with higher latency (200-500ms added)."""
    try:
        fq_table, entity_col = _validate_feature_table(schema, table)

        # Simulate Delta table query overhead
        simulated_delay_ms = random.uniform(200, 500)
        time.sleep(simulated_delay_ms / 1000)

        sql = f"""
            SELECT * FROM {fq_table}
            WHERE {entity_col} = %s
            ORDER BY time_bucket DESC
            LIMIT 10
        """
        columns, rows, db_latency = execute_query(sql, (entity_id,))
        if not rows:
            raise HTTPException(status_code=404, detail=f"No features found for '{entity_id}' in {fq_table}")

        latest = rows[0]
        total_latency = db_latency + simulated_delay_ms

        return {
            "customer_id": entity_id,
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
