"""
Manufacturing Ontology API - 진입점.
CORS, 전역 예외 처리, 라우터 등록만 수행.
"""
import traceback
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from neo4j.exceptions import ServiceUnavailable, AuthError, TransientError

from db.neo4j import ensure_n10s_config, load_ontology_files
from routers import ontology, graph, manufacturing, analytics, automl

app = FastAPI(title="Manufacturing Ontology API", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3001", "http://localhost:80", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """전역 예외 핸들러 - 명확한 에러 메시지 반환."""
    error_detail = str(exc)
    error_type = type(exc).__name__
    import logging
    logging.error(f"Exception: {error_type}: {error_detail}")
    logging.error(traceback.format_exc())
    print(f"ERROR: {error_type}: {error_detail}")
    print(traceback.format_exc())

    if isinstance(exc, ServiceUnavailable):
        return JSONResponse(
            status_code=503,
            content={
                "error": "Neo4j service unavailable",
                "detail": "Neo4j database is not available. Please check the connection.",
                "type": error_type,
            },
        )
    if isinstance(exc, AuthError):
        return JSONResponse(
            status_code=401,
            content={
                "error": "Neo4j authentication failed",
                "detail": "Invalid credentials for Neo4j database.",
                "type": error_type,
            },
        )
    if isinstance(exc, TransientError):
        return JSONResponse(
            status_code=503,
            content={
                "error": "Neo4j transient error",
                "detail": "Temporary error occurred. Please try again later.",
                "type": error_type,
            },
        )
    return JSONResponse(
        status_code=500,
        content={
            "error": "Internal Server Error",
            "detail": error_detail,
            "type": error_type,
            "traceback": traceback.format_exc(),
        },
    )


@app.on_event("startup")
def startup():
    """앱 기동 시 n10s 설정 및 온톨로지 파일 로드."""
    ensure_n10s_config()
    load_ontology_files()


app.include_router(ontology.router)
app.include_router(graph.router)
app.include_router(manufacturing.router)
app.include_router(analytics.router)
app.include_router(automl.router)
