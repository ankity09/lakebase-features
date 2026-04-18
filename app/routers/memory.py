import os
import logging
import json
import time
import httpx
from fastapi import APIRouter, HTTPException
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from app.services.db import get_conn, execute_query, _generate_lakebase_token

router = APIRouter(prefix="/api", tags=["memory"])
logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Pydantic models
# ---------------------------------------------------------------------------

class ChatRequest(BaseModel):
    message: str
    history: list[dict] = []


# ---------------------------------------------------------------------------
# Embedding helper
# ---------------------------------------------------------------------------

def _embed_text(text: str) -> list[float]:
    """Embed text via FMAPI BGE-small. Falls back to random vector."""
    try:
        host = os.environ.get("DATABRICKS_HOST", "")
        endpoint = os.environ.get("FMAPI_ENDPOINT", "databricks-bge-small-en")
        if not host:
            from databricks.sdk import WorkspaceClient
            w = WorkspaceClient()
            host = w.config.host

        # Ensure host has https://
        if host and not host.startswith("http"):
            host = f"https://{host}"

        token = _generate_lakebase_token()

        resp = httpx.post(
            f"{host}/serving-endpoints/{endpoint}/invocations",
            headers={"Authorization": f"Bearer {token}"},
            json={"input": [text]},
            timeout=15,
        )
        if resp.status_code == 200:
            data = resp.json()
            # Handle various FMAPI response formats
            if "data" in data and len(data["data"]) > 0:
                return data["data"][0].get("embedding", data["data"][0].get("values", []))
            elif "predictions" in data:
                return data["predictions"][0] if data["predictions"] else []
    except Exception as e:
        logger.warning(f"FMAPI embedding failed: {e}")

    # Fallback: random normalized vector
    import random
    vec = [random.gauss(0, 1) for _ in range(384)]
    norm = sum(x * x for x in vec) ** 0.5
    return [x / norm for x in vec]


# ---------------------------------------------------------------------------
# Chat helper
# ---------------------------------------------------------------------------

def _chat_llm(messages: list[dict]) -> str:
    """Call FMAPI chat endpoint. Falls back to empty string."""
    try:
        host = os.environ.get("DATABRICKS_HOST", "")
        endpoint = os.environ.get("FMAPI_CHAT_ENDPOINT", "databricks-claude-sonnet-4v")
        if not host:
            from databricks.sdk import WorkspaceClient
            w = WorkspaceClient()
            host = w.config.host
        if host and not host.startswith("http"):
            host = f"https://{host}"

        token = _generate_lakebase_token()

        resp = httpx.post(
            f"{host}/serving-endpoints/{endpoint}/invocations",
            headers={"Authorization": f"Bearer {token}"},
            json={"messages": messages, "max_tokens": 1024},
            timeout=30,
        )
        if resp.status_code == 200:
            data = resp.json()
            if "choices" in data and len(data["choices"]) > 0:
                return data["choices"][0].get("message", {}).get("content", "")
    except Exception as e:
        logger.warning(f"FMAPI chat failed: {e}")
    return ""


# ---------------------------------------------------------------------------
# System prompt
# ---------------------------------------------------------------------------

SYSTEM_PROMPT = """You are MaintBot, an AI maintenance assistant for industrial equipment. You help technicians diagnose issues, recall past repairs, and suggest solutions.

When you recall a memory from your knowledge base, cite it clearly (e.g., "[From memory: ...]").
When you learn something new from the conversation, acknowledge it.

Be concise, practical, and safety-conscious. If you're unsure about a repair procedure, recommend consulting the equipment manual or a senior technician.

{memories_section}"""


# ---------------------------------------------------------------------------
# Memory table bootstrap
# ---------------------------------------------------------------------------

def _ensure_memory_table():
    """Create the maintenance_memories table if it does not exist."""
    try:
        execute_query(
            """
            CREATE TABLE IF NOT EXISTS maintenance_memories (
                id          SERIAL PRIMARY KEY,
                content     TEXT        NOT NULL,
                category    TEXT        DEFAULT 'general',
                equipment   TEXT        DEFAULT '',
                embedding   vector(384),
                created_at  TIMESTAMPTZ DEFAULT NOW()
            )
            """,
            fetch=False,
        )
    except Exception as e:
        logger.warning(f"Could not ensure maintenance_memories table: {e}")


# ---------------------------------------------------------------------------
# Memory retrieval helper
# ---------------------------------------------------------------------------

def _recall_memories(embedding: list[float], top_n: int = 5) -> list[dict]:
    """Retrieve top-N memories ordered by cosine similarity."""
    _ensure_memory_table()
    vec_literal = "[" + ",".join(str(round(v, 8)) for v in embedding) + "]"
    try:
        _, rows, _ = execute_query(
            """
            SELECT id, content, category, equipment,
                   1 - (embedding <=> %s::vector) AS relevance
            FROM maintenance_memories
            ORDER BY embedding <=> %s::vector
            LIMIT %s
            """,
            (vec_literal, vec_literal, top_n),
        )
        return rows
    except Exception as e:
        logger.warning(f"Memory recall failed: {e}")
        return []


# ---------------------------------------------------------------------------
# Memory storage helper
# ---------------------------------------------------------------------------

def _store_memory(content: str, category: str = "general", equipment: str = "") -> int | None:
    """Embed and persist a new memory. Returns the new row id."""
    _ensure_memory_table()
    embedding = _embed_text(content)
    vec_literal = "[" + ",".join(str(round(v, 8)) for v in embedding) + "]"
    try:
        _, rows, _ = execute_query(
            """
            INSERT INTO maintenance_memories (content, category, equipment, embedding)
            VALUES (%s, %s, %s, %s::vector)
            RETURNING id
            """,
            (content, category, equipment, vec_literal),
        )
        return rows[0]["id"] if rows else None
    except Exception as e:
        logger.warning(f"Memory store failed: {e}")
        return None


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.post("/memory/chat")
def memory_chat(body: ChatRequest):
    """
    Chat with MaintBot. Embeds the user message, recalls relevant memories
    via pgvector, injects them into the system prompt, calls the LLM, and
    optionally extracts new memories from the exchange.
    """
    # 1. Embed user message
    embedding = _embed_text(body.message)

    # 2. Retrieve top-5 memories
    recalled = _recall_memories(embedding, top_n=5)

    # 3. Format memories into system prompt
    if recalled:
        memory_lines = []
        for i, mem in enumerate(recalled, start=1):
            relevance = float(mem.get("relevance") or 0)
            category = mem.get("category", "general")
            equipment = mem.get("equipment", "")
            eq_tag = f" [{equipment}]" if equipment else ""
            memory_lines.append(
                f"{i}. [{category}]{eq_tag} {mem['content'][:200]} "
                f"(relevance: {relevance:.2f})"
            )
        memories_section = "## Your Maintenance Knowledge\n" + "\n".join(memory_lines)
    else:
        memories_section = "## Your Maintenance Knowledge\n(No relevant memories found yet.)"

    system_content = SYSTEM_PROMPT.format(memories_section=memories_section)

    # 4. Build messages: system + history + current user message
    messages = [{"role": "system", "content": system_content}]
    for turn in body.history:
        if turn.get("role") in ("user", "assistant") and turn.get("content"):
            messages.append({"role": turn["role"], "content": turn["content"]})
    messages.append({"role": "user", "content": body.message})

    # 5. Call LLM
    assistant_reply = _chat_llm(messages)

    # 6. Demo fallback when LLM unavailable
    if not assistant_reply:
        if recalled:
            formatted = "\n".join(
                f"- {m['content'][:150]}" for m in recalled
            )
            assistant_reply = (
                "I'm MaintBot, your maintenance assistant. My LLM backend isn't currently "
                "configured, but I can still access my memory bank. Based on your question, "
                "here are the most relevant maintenance records I found:\n\n" + formatted
            )
        else:
            assistant_reply = (
                "I'm MaintBot, your maintenance assistant. My LLM backend isn't currently "
                "configured and no relevant memories were found. Once the FMAPI endpoint is "
                "set up and maintenance records are stored, I'll be able to help diagnose "
                "equipment issues."
            )

    # 7. Extract new memories (best-effort — never let this block the response)
    new_memories_count = 0
    try:
        extraction_prompt = [
            {
                "role": "system",
                "content": (
                    "You are a knowledge extractor. Given a maintenance conversation, "
                    "identify any NEW factual information about equipment failures, repairs, "
                    "or procedures. Return a JSON array of objects with keys: "
                    "'content' (string), 'category' (one of: failure_mode, procedure, "
                    "observation, part_number), 'equipment' (equipment ID or empty string). "
                    "Return [] if nothing new was learned. Return only valid JSON."
                ),
            },
            {
                "role": "user",
                "content": (
                    f"User said: {body.message}\n\n"
                    f"Assistant replied: {assistant_reply}\n\n"
                    "What new maintenance facts were established in this exchange?"
                ),
            },
        ]
        raw = _chat_llm(extraction_prompt)
        if raw:
            # Strip markdown code fences if present
            cleaned = raw.strip()
            if cleaned.startswith("```"):
                cleaned = cleaned.split("```")[1]
                if cleaned.startswith("json"):
                    cleaned = cleaned[4:]
            new_facts = json.loads(cleaned.strip())
            if isinstance(new_facts, list):
                for fact in new_facts:
                    if isinstance(fact, dict) and fact.get("content"):
                        _store_memory(
                            content=fact["content"],
                            category=fact.get("category", "general"),
                            equipment=fact.get("equipment", ""),
                        )
                        new_memories_count += 1
    except Exception as e:
        logger.warning(f"Memory extraction skipped: {e}")

    return {
        "reply": assistant_reply,
        "recalled_memories": [
            {
                "content": m["content"],
                "category": m.get("category", "general"),
                "equipment": m.get("equipment", ""),
                "relevance": round(float(m.get("relevance") or 0), 4),
            }
            for m in recalled
        ],
        "new_memories_stored": new_memories_count,
    }


@router.get("/memory/memories")
def list_memories():
    """Return all stored memories ordered by created_at DESC."""
    _ensure_memory_table()
    try:
        _, rows, latency_ms = execute_query(
            """
            SELECT id, content, category, equipment, created_at
            FROM maintenance_memories
            ORDER BY created_at DESC
            """
        )
        return {
            "memories": [
                {
                    "id": r["id"],
                    "content": r["content"],
                    "category": r.get("category", "general"),
                    "equipment": r.get("equipment", ""),
                    "created_at": r["created_at"].isoformat() if r.get("created_at") else None,
                }
                for r in rows
            ],
            "total": len(rows),
            "latency_ms": round(latency_ms, 2),
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to list memories: {e}")


@router.delete("/memory/memories")
def delete_all_memories():
    """Delete all stored memories. Returns the count of deleted rows."""
    _ensure_memory_table()
    try:
        _, _, latency_ms = execute_query(
            "DELETE FROM maintenance_memories",
            fetch=False,
        )
        return {"deleted": True, "latency_ms": round(latency_ms, 2)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete memories: {e}")


@router.get("/memory/export")
def export_memories():
    """Export all memories as a downloadable JSON file."""
    _ensure_memory_table()
    try:
        _, rows, _ = execute_query(
            """
            SELECT id, content, category, equipment, created_at
            FROM maintenance_memories
            ORDER BY created_at DESC
            """
        )
        payload = [
            {
                "id": r["id"],
                "content": r["content"],
                "category": r.get("category", "general"),
                "equipment": r.get("equipment", ""),
                "created_at": r["created_at"].isoformat() if r.get("created_at") else None,
            }
            for r in rows
        ]
        return JSONResponse(
            content=payload,
            headers={
                "Content-Disposition": "attachment; filename=maintenance_memories.json"
            },
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to export memories: {e}")
