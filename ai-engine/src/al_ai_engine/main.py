from fastapi import FastAPI
from fastapi.responses import RedirectResponse

from . import __version__
from .config import settings
from .routes import router

app = FastAPI(title="AL AI Engine", version=__version__)
app.include_router(router)


@app.get("/", include_in_schema=False)
def root():
    return RedirectResponse(url="/docs")


@app.get("/health")
def health() -> dict:
    return {"status": "ok", "version": __version__, "mock_mode": settings.mock_mode}