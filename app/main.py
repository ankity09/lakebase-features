import os
from pathlib import Path
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from app.services.db import get_pool
from app.services.seed import seed_if_needed


@asynccontextmanager
async def lifespan(app: FastAPI):
    get_pool()
    seed_if_needed()
    yield
    p = get_pool()
    if p:
        p.closeall()


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

# Serve vanilla frontend from app/frontend/
frontend_dir = Path(__file__).parent / "frontend"
if frontend_dir.exists():
    app.mount("/", StaticFiles(directory=str(frontend_dir), html=True), name="static")
