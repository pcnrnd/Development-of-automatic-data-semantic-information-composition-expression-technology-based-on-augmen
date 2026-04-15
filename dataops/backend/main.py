from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from config import settings
from routers import archiving, governance, monitoring, nodes, orchestration

app = FastAPI(
    title=settings.app_name,
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(monitoring.router)
app.include_router(orchestration.router)
app.include_router(archiving.router)
app.include_router(governance.router)
app.include_router(nodes.router)


@app.get("/health")
def health_check():
    return {"status": "ok", "service": settings.app_name}
