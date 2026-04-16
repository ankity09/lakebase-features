import os
import math
import random
import httpx
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from app.services.db import execute_query

router = APIRouter(prefix="/api", tags=["pgvector"])

VECTOR_DIM = 384


class VectorSearchRequest(BaseModel):
    query: str
    top_n: int = 10


def _normalize(vec: list[float]) -> list[float]:
    """L2-normalize a vector."""
    magnitude = math.sqrt(sum(x * x for x in vec))
    if magnitude == 0:
        return vec
    return [x / magnitude for x in vec]


def _random_embedding() -> list[float]:
    """Generate a random 384-dim normalized vector as a fallback."""
    raw = [random.gauss(0, 1) for _ in range(VECTOR_DIM)]
    return _normalize(raw)


def _embed_via_fmapi(query: str) -> list[float]:
    """
    Call Databricks Foundation Model API to get a 384-dim embedding.
    Raises an exception if FMAPI is unavailable or misconfigured.
    """
    host = os.environ.get("DATABRICKS_HOST", "").rstrip("/")
    token = os.environ.get("DATABRICKS_TOKEN", "")
    endpoint = os.environ.get("FMAPI_ENDPOINT", "")

    if not host or not token or not endpoint:
        raise ValueError("DATABRICKS_HOST, DATABRICKS_TOKEN, or FMAPI_ENDPOINT not set")

    url = f"{host}/serving-endpoints/{endpoint}/invocations"
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
    }
    payload = {"input": [query]}

    with httpx.Client(timeout=10.0) as client:
        resp = client.post(url, json=payload, headers=headers)
        resp.raise_for_status()

    data = resp.json()
    # Standard OpenAI-compatible response: data.data[0].embedding
    embedding = data["data"][0]["embedding"]
    if len(embedding) != VECTOR_DIM:
        raise ValueError(
            f"Expected {VECTOR_DIM}-dim embedding, got {len(embedding)}"
        )
    return embedding


@router.post("/vector/search")
def vector_search(body: VectorSearchRequest):
    """
    Semantic similarity search over appshield.event_embeddings.
    Embeds the query via FMAPI; falls back to a random normalized vector
    if FMAPI is unavailable.
    """
    embedding_source = "fmapi"
    try:
        embedding = _embed_via_fmapi(body.query)
    except Exception as fmapi_err:
        embedding = _random_embedding()
        embedding_source = f"random_fallback (reason: {fmapi_err})"

    # Format as Postgres vector literal: '[0.1,0.2,...]'
    vec_literal = "[" + ",".join(str(round(v, 8)) for v in embedding) + "]"

    sql = """
        SELECT event_summary, category, embedding <=> %s::vector AS distance
        FROM appshield.event_embeddings
        ORDER BY embedding <=> %s::vector
        LIMIT %s
    """
    try:
        columns, rows, latency_ms = execute_query(sql, (vec_literal, vec_literal, body.top_n))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Vector search failed: {e}")

    results = [
        {
            "event_summary": row["event_summary"],
            "category": row["category"],
            "distance": float(row["distance"]) if row["distance"] is not None else None,
            "score": round(1 - float(row["distance"]), 6)
            if row["distance"] is not None
            else None,
        }
        for row in rows
    ]

    return {
        "query": body.query,
        "top_n": body.top_n,
        "results": results,
        "embedding_source": embedding_source,
        "latency_ms": round(latency_ms, 2),
    }


@router.get("/vector/stats")
def vector_stats():
    """
    Return pgvector extension metadata and embedding table statistics.
    Returns a descriptive error if the pgvector extension is not installed.
    """
    try:
        # Total embedding count
        _, count_rows, count_latency = execute_query(
            "SELECT COUNT(*) AS total FROM appshield.event_embeddings"
        )
        total_embeddings = count_rows[0]["total"] if count_rows else 0

        # Extension version
        _, ext_rows, _ = execute_query(
            "SELECT extversion FROM pg_available_extensions WHERE name = 'vector'"
        )
        pgvector_version = ext_rows[0]["extversion"] if ext_rows else None

        if pgvector_version is None:
            return {
                "error": "pgvector extension is not installed on this Postgres instance.",
                "total_embeddings": None,
                "pgvector_version": None,
                "hnsw_index_exists": False,
            }

        # HNSW index check
        _, idx_rows, _ = execute_query(
            """
            SELECT indexname
            FROM pg_indexes
            WHERE schemaname = 'appshield'
              AND tablename = 'event_embeddings'
              AND indexdef ILIKE '%hnsw%'
            LIMIT 1
            """
        )
        hnsw_index_exists = len(idx_rows) > 0
        hnsw_index_name = idx_rows[0]["indexname"] if hnsw_index_exists else None

        return {
            "total_embeddings": total_embeddings,
            "pgvector_version": pgvector_version,
            "hnsw_index_exists": hnsw_index_exists,
            "hnsw_index_name": hnsw_index_name,
            "latency_ms": round(count_latency, 2),
        }

    except Exception as e:
        error_msg = str(e)
        if "pgvector" in error_msg.lower() or "extension" in error_msg.lower():
            return {
                "error": f"pgvector extension not available: {error_msg}",
                "total_embeddings": None,
                "pgvector_version": None,
                "hnsw_index_exists": False,
            }
        raise HTTPException(status_code=500, detail=error_msg)
