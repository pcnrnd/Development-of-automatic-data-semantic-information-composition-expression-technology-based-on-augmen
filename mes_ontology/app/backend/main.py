"""
Manufacturing Ontology API - 진입점.
CORS, 전역 예외 처리, 라우터 등록만 수행.
"""
import logging
import os
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from neo4j.exceptions import ServiceUnavailable, AuthError, TransientError

from db.neo4j import ensure_n10s_config, load_ontology_files, close_driver
from routers import ontology, graph, manufacturing, analytics, automl

logger = logging.getLogger("mes_ontology")
logging.basicConfig(level=os.getenv("LOG_LEVEL", "INFO"))

# 운영/개발에서 노출할 traceback 여부 (기본: 비노출)
EXPOSE_TRACEBACK = os.getenv("EXPOSE_TRACEBACK", "false").lower() == "true"


@asynccontextmanager
async def lifespan(app: FastAPI):
    """앱 수명주기: 기동 시 n10s 설정·온톨로지 로드, 종료 시 드라이버 정리."""
    try:
        ensure_n10s_config()
        load_ontology_files()
    except Exception as e:
        logger.warning("Startup initialization failed: %s", e)
    yield
    close_driver()


app = FastAPI(title="Manufacturing Ontology API", version="2.0.0", lifespan=lifespan)

# CORS: 환경변수 ALLOWED_ORIGINS (콤마 구분) 우선, 없으면 개발용 기본값
_default_dev_origins = [
    "http://localhost:3000",
    "http://localhost:3001",
    "http://localhost:80",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:3001",
    "http://127.0.0.1:80",
]
_env_origins = os.getenv("ALLOWED_ORIGINS", "").strip()
ALLOWED_ORIGINS = (
    [o.strip() for o in _env_origins.split(",") if o.strip()]
    if _env_origins
    else _default_dev_origins
)
# 개발 편의를 위한 localhost regex는 ALLOWED_ORIGINS 미설정 시에만 활성화
ALLOWED_ORIGIN_REGEX = (
    None if _env_origins else r"^https?://(localhost|127\.0\.0\.1)(:\d+)?$"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_origin_regex=ALLOWED_ORIGIN_REGEX,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def healthcheck():
    """기본 헬스체크. Neo4j 가용성은 별도 readiness 엔드포인트로 분리할 수 있음."""
    return {"status": "ok"}


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """전역 예외 핸들러 - traceback은 로그로만 남기고 응답에서 제외."""
    error_type = type(exc).__name__
    logger.exception("Unhandled exception: %s", error_type)

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
    body = {
        "error": "Internal Server Error",
        "detail": "An unexpected error occurred.",
        "type": error_type,
    }
    if EXPOSE_TRACEBACK:
        import traceback as _tb
        body["traceback"] = _tb.format_exc()
    return JSONResponse(status_code=500, content=body)


app.include_router(ontology.router)
app.include_router(graph.router)
app.include_router(manufacturing.router)
app.include_router(analytics.router)
app.include_router(automl.router)
