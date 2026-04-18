import os
from pathlib import Path
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from app.services.db import get_pool
from app.services.seed import seed_if_needed


import logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

@asynccontextmanager
async def lifespan(app: FastAPI):
    pool = get_pool()
    if pool is not None:
        logger.info("Lakebase connected — running seed check")
        try:
            seed_if_needed()
        except Exception as e:
            logger.warning(f"Seed failed (will retry on next request): {e}")
    else:
        logger.warning("Starting without Lakebase — attach the resource in App settings, then restart")
    yield
    pool = get_pool()
    if pool:
        pool.closeall()


app = FastAPI(title="Lakebase Features", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

from app.routers import health
app.include_router(health.router)
from app.routers import crud; app.include_router(crud.router)
from app.routers import query; app.include_router(query.router)
from app.routers import sync; app.include_router(sync.router)
from app.routers import branching; app.include_router(branching.router)
from app.routers import infrastructure; app.include_router(infrastructure.router)
from app.routers import feature_store; app.include_router(feature_store.router)
from app.routers import pgvector; app.include_router(pgvector.router)
from app.routers import monitoring; app.include_router(monitoring.router)
from app.routers import recovery; app.include_router(recovery.router)
from app.routers import memory; app.include_router(memory.router)
from app.routers import loadtest; app.include_router(loadtest.router)

# v1 vanilla fallback at /v1/
v1_dir = Path(__file__).parent / "frontend" / "v1"
if v1_dir.exists():
    app.mount("/v1", StaticFiles(directory=str(v1_dir), html=True), name="v1")

# v2 React SPA — serve static assets + catch-all for client-side routing
static_dir = Path(__file__).parent / "static"
if not static_dir.exists():
    static_dir = Path(__file__).parent.parent / "client" / "build"

if static_dir.exists():
    # Mount static assets (JS, CSS, images)
    app.mount("/assets", StaticFiles(directory=str(static_dir / "assets")), name="assets")

    # Catch-all: serve index.html for any non-API route (React Router handles client-side)
    from fastapi.responses import FileResponse

    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        # If it's a real file (like favicon.ico), serve it
        file_path = static_dir / full_path
        if file_path.is_file():
            return FileResponse(file_path)
        # Otherwise serve index.html for React Router
        return FileResponse(static_dir / "index.html")
