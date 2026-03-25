"""
FastAPI 애플리케이션 메인 모듈

에러 처리, 미들웨어, 라우터 설정을 포함합니다.
"""
from __future__ import annotations

import logging
import traceback
from typing import Any

from fastapi import FastAPI, HTTPException, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from pydantic import ValidationError

from app.api.routes import router
from app.core.config import get_environment
from app.domain.models import ApiError
from app.store.in_memory import InMemoryStore

# 로거 설정
logger = logging.getLogger(__name__)


def create_app() -> FastAPI:
    """FastAPI 애플리케이션 생성"""
    app = FastAPI(
        title="Industrial Data Nexus API",
        version="0.1.0",
        description="Industrial Data Platform API for microservices observability",
    )

    store = InMemoryStore()

    # 의존성 주입(간단): store 파라미터로 받는 라우트에 제공
    @app.middleware("http")
    async def inject_store(request: Request, call_next):
        request.state.store = store
        return await call_next(request)

    # 요청 검증 에러 핸들러
    @app.exception_handler(RequestValidationError)
    async def validation_exception_handler(request: Request, exc: RequestValidationError) -> JSONResponse:
        """Pydantic 검증 에러 처리"""
        errors = exc.errors()
        error_messages = []
        for error in errors:
            loc = " -> ".join(str(l) for l in error.get("loc", []))
            msg = error.get("msg", "Validation error")
            error_messages.append(f"{loc}: {msg}")

        error_message = "; ".join(error_messages)
        logger.warning(f"Validation error: {error_message}")

        return JSONResponse(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            content={
                "data": None,
                "error": {
                    "code": "VALIDATION_ERROR",
                    "message": f"입력 검증 실패: {error_message}",
                },
                "meta": None,
            },
        )

    # HTTPException 핸들러
    @app.exception_handler(HTTPException)
    async def http_exception_handler(request: Request, exc: HTTPException) -> JSONResponse:
        """HTTP 예외 처리"""
        # ApiError 형식인 경우
        if isinstance(exc.detail, dict) and "code" in exc.detail and "message" in exc.detail:
            logger.info(
                f"HTTP {exc.status_code}: {exc.detail.get('code')} - {exc.detail.get('message')}",
                extra={"path": request.url.path, "method": request.method},
            )
            return JSONResponse(
                status_code=exc.status_code,
                content={"data": None, "error": exc.detail, "meta": None},
            )

        # 일반 HTTPException
        logger.warning(
            f"HTTP {exc.status_code}: {exc.detail}",
            extra={"path": request.url.path, "method": request.method},
        )
        return JSONResponse(
            status_code=exc.status_code,
            content={
                "data": None,
                "error": {"code": "HTTP_ERROR", "message": str(exc.detail)},
                "meta": None,
            },
        )

    # 처리되지 않은 예외 핸들러
    @app.exception_handler(Exception)
    async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
        """처리되지 않은 예외 처리"""
        env = get_environment()
        error_trace = traceback.format_exc()

        # 프로덕션 환경에서는 상세한 에러 정보를 숨김
        if env == "production":
            error_message = "내부 서버 오류가 발생했습니다. 관리자에게 문의하세요."
        else:
            error_message = f"{type(exc).__name__}: {str(exc)}"

        logger.error(
            f"Unhandled exception: {type(exc).__name__}: {str(exc)}",
            exc_info=True,
            extra={"path": request.url.path, "method": request.method},
        )

        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={
                "data": None,
                "error": {"code": "INTERNAL_ERROR", "message": error_message},
                "meta": None,
            },
        )

    app.include_router(router)
    return app


app = create_app()

