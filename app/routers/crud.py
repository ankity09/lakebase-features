import uuid
from fastapi import APIRouter, HTTPException
from app.services.db import get_conn, execute_query
from app.models.schemas import (
    FilteredQueryRequest,
    InsertRequest,
    UpdateRequest,
    DeleteRequest,
    PreviewResponse,
)

router = APIRouter(prefix="/api", tags=["crud"])

ALLOWED_TABLES = {"telemetry_events", "customer_features", "model_predictions", "event_embeddings"}

# In-memory store for confirmation tokens (maps token -> {table, operation, where, set_values})
_pending_confirmations: dict[str, dict] = {}


def _validate_table(table: str) -> str:
    if table not in ALLOWED_TABLES:
        raise HTTPException(status_code=400, detail=f"Table '{table}' not allowed. Must be one of: {sorted(ALLOWED_TABLES)}")
    return f"appshield.{table}"


def _validate_identifier(name: str) -> str:
    """Basic SQL identifier validation — alphanumeric + underscore only."""
    if not all(c.isalnum() or c == "_" for c in name):
        raise HTTPException(status_code=400, detail=f"Invalid identifier: {name}")
    return name


@router.get("/tables")
def list_tables():
    """List tables in appshield schema with row counts."""
    try:
        sql = """
            SELECT
                t.table_name,
                t.table_schema,
                COALESCE(s.n_live_tup, 0) AS row_count,
                (SELECT COUNT(*) FROM information_schema.columns c
                 WHERE c.table_schema = t.table_schema AND c.table_name = t.table_name) AS column_count
            FROM information_schema.tables t
            LEFT JOIN pg_stat_user_tables s
                ON s.schemaname = t.table_schema AND s.relname = t.table_name
            WHERE t.table_schema = 'appshield'
              AND t.table_type = 'BASE TABLE'
            ORDER BY t.table_name
        """
        _, rows, latency = execute_query(sql)
        return {"tables": rows, "latency_ms": round(latency, 2)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/tables/{table}/schema")
def table_schema(table: str):
    """Column info from information_schema.columns."""
    _validate_table(table)
    try:
        sql = """
            SELECT
                column_name AS name,
                data_type,
                is_nullable = 'YES' AS is_nullable,
                column_default AS default_value
            FROM information_schema.columns
            WHERE table_schema = 'appshield' AND table_name = %s
            ORDER BY ordinal_position
        """
        _, rows, latency = execute_query(sql, (table,))
        return {"table": table, "columns": rows, "latency_ms": round(latency, 2)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/tables/{table}/query")
def filtered_query(table: str, body: FilteredQueryRequest):
    """Filtered read with pagination and sorting."""
    fq_table = _validate_table(table)
    try:
        conditions = []
        params: list = []
        for col, val in body.filters.items():
            col_safe = _validate_identifier(col)
            conditions.append(f"{col_safe} = %s")
            params.append(val)

        where_clause = " AND ".join(conditions) if conditions else "TRUE"

        # Count total matching rows
        count_sql = f"SELECT COUNT(*) AS total FROM {fq_table} WHERE {where_clause}"
        _, count_rows, _ = execute_query(count_sql, params or None)
        total = count_rows[0]["total"] if count_rows else 0

        # Build main query
        sql = f"SELECT * FROM {fq_table} WHERE {where_clause}"

        if body.sort_by:
            sort_col = _validate_identifier(body.sort_by)
            sort_dir = "DESC" if body.sort_order.upper() == "DESC" else "ASC"
            sql += f" ORDER BY {sort_col} {sort_dir}"

        offset = (body.page - 1) * body.page_size
        sql += " LIMIT %s OFFSET %s"
        params.extend([body.page_size, offset])

        columns, rows, latency = execute_query(sql, params)
        return {
            "table": table,
            "columns": columns,
            "rows": rows,
            "total": total,
            "page": body.page,
            "page_size": body.page_size,
            "latency_ms": round(latency, 2),
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/tables/{table}/insert")
def insert_records(table: str, body: InsertRequest):
    """Insert records into table."""
    fq_table = _validate_table(table)
    if not body.records:
        raise HTTPException(status_code=400, detail="No records provided")
    try:
        inserted = 0
        with get_conn() as conn:
            with conn.cursor() as cur:
                for record in body.records:
                    cols = [_validate_identifier(k) for k in record.keys()]
                    placeholders = ", ".join(["%s"] * len(cols))
                    col_names = ", ".join(cols)
                    sql = f"INSERT INTO {fq_table} ({col_names}) VALUES ({placeholders})"
                    cur.execute(sql, list(record.values()))
                    inserted += 1
        return {"inserted": inserted, "table": table}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/tables/{table}/update")
def update_records(table: str, body: UpdateRequest):
    """Two-phase update: preview with rollback, then confirm with token."""
    fq_table = _validate_table(table)
    if not body.set_values:
        raise HTTPException(status_code=400, detail="No set_values provided")
    if not body.where:
        raise HTTPException(status_code=400, detail="No where conditions provided")

    try:
        set_parts = []
        params: list = []
        for col, val in body.set_values.items():
            set_parts.append(f"{_validate_identifier(col)} = %s")
            params.append(val)

        where_parts = []
        for col, val in body.where.items():
            where_parts.append(f"{_validate_identifier(col)} = %s")
            params.append(val)

        set_clause = ", ".join(set_parts)
        where_clause = " AND ".join(where_parts)
        sql = f"UPDATE {fq_table} SET {set_clause} WHERE {where_clause}"

        if body.preview and not body.confirmation_token:
            # Preview mode: run in rolled-back transaction
            with get_conn() as conn:
                with conn.cursor() as cur:
                    cur.execute(sql, params)
                    affected = cur.rowcount
                conn.rollback()  # Undo the changes

            token = str(uuid.uuid4())
            _pending_confirmations[token] = {
                "table": table,
                "operation": "update",
                "sql": sql,
                "params": params,
            }
            return PreviewResponse(affected_rows=affected, confirmation_token=token)

        if body.confirmation_token:
            pending = _pending_confirmations.pop(body.confirmation_token, None)
            if not pending:
                raise HTTPException(status_code=400, detail="Invalid or expired confirmation token")
            with get_conn() as conn:
                with conn.cursor() as cur:
                    cur.execute(pending["sql"], pending["params"])
                    affected = cur.rowcount
            return {"updated": affected, "table": table}

        # Direct execution (no preview, no token)
        with get_conn() as conn:
            with conn.cursor() as cur:
                cur.execute(sql, params)
                affected = cur.rowcount
        return {"updated": affected, "table": table}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/tables/{table}/delete")
def delete_records(table: str, body: DeleteRequest):
    """Two-phase delete: preview with rollback, then confirm with token."""
    fq_table = _validate_table(table)
    if not body.where:
        raise HTTPException(status_code=400, detail="No where conditions provided")

    try:
        where_parts = []
        params: list = []
        for col, val in body.where.items():
            where_parts.append(f"{_validate_identifier(col)} = %s")
            params.append(val)

        where_clause = " AND ".join(where_parts)
        sql = f"DELETE FROM {fq_table} WHERE {where_clause}"

        if body.preview and not body.confirmation_token:
            with get_conn() as conn:
                with conn.cursor() as cur:
                    cur.execute(sql, params)
                    affected = cur.rowcount
                conn.rollback()

            token = str(uuid.uuid4())
            _pending_confirmations[token] = {
                "table": table,
                "operation": "delete",
                "sql": sql,
                "params": params,
            }
            return PreviewResponse(affected_rows=affected, confirmation_token=token)

        if body.confirmation_token:
            pending = _pending_confirmations.pop(body.confirmation_token, None)
            if not pending:
                raise HTTPException(status_code=400, detail="Invalid or expired confirmation token")
            with get_conn() as conn:
                with conn.cursor() as cur:
                    cur.execute(pending["sql"], pending["params"])
                    affected = cur.rowcount
            return {"deleted": affected, "table": table}

        # Direct execution
        with get_conn() as conn:
            with conn.cursor() as cur:
                cur.execute(sql, params)
                affected = cur.rowcount
        return {"deleted": affected, "table": table}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
