import asyncio
import logging
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.responses import RedirectResponse

from . import __version__
from .config import settings
from .routes import router

logger = logging.getLogger("al_ai_engine.main")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Start the Firestore sync poller when AI_SYNC_ENABLED=true."""
    poller = None
    if os.getenv("AI_SYNC_ENABLED", "false").lower() == "true":
        try:
            from .firestore_sync import init_firestore, poll_loop

            db = init_firestore()
            interval = float(os.getenv("AI_POLL_INTERVAL_SECONDS", "10"))
            poller = asyncio.create_task(poll_loop(db, interval))
            logger.info("Firestore sync enabled (polling every %ss)", interval)
        except Exception:
            logger.exception("Firestore sync failed to start; running REST-only")
    yield
    if poller is not None:
        poller.cancel()
        try:
            await poller
        except asyncio.CancelledError:
            pass


app = FastAPI(title="AL AI Engine", version=__version__, lifespan=lifespan)
app.include_router(router)


@app.get("/", include_in_schema=False)
def root():
    return RedirectResponse(url="/docs")


@app.get("/health")
def health() -> dict:
    return {"status": "ok", "version": __version__, "mock_mode": settings.mock_mode}