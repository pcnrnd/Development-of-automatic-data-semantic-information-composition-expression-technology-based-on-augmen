from __future__ import annotations

from typing import Any

from fastapi import Depends, HTTPException, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.core.config import (
    get_access_token_expire_minutes,
    get_jwt_algorithm,
    get_jwt_secret,
)
from app.core.security import decode_access_token
from app.store.in_memory import InMemoryStore

security_bearer = HTTPBearer(auto_error=False)


def get_store(request: Request) -> InMemoryStore:
    """FastAPI request.state에 저장된 전역 in-memory store를 반환합니다."""
    return request.state.store


def _jwt_secret_or_503() -> str:
    secret = get_jwt_secret()
    if not secret:
        raise HTTPException(
            status_code=503,
            detail={
                "code": "JWT_NOT_CONFIGURED",
                "message": "JWT_SECRET 환경 변수가 설정되지 않아 토큰 기능을 사용할 수 없습니다.",
            },
        )
    return secret


def decode_bearer_token_optional(
    credentials: HTTPAuthorizationCredentials | None = Depends(security_bearer),
) -> dict[str, Any] | None:
    """
    Authorization: Bearer 가 있으면 검증해 페이로드를 반환하고,
    없거나 스킴이 다르면 None.
    """
    if credentials is None or credentials.scheme.lower() != "bearer":
        return None
    token = credentials.credentials.strip()
    if not token:
        return None
    secret = get_jwt_secret()
    if not secret:
        raise HTTPException(
            status_code=503,
            detail={
                "code": "JWT_NOT_CONFIGURED",
                "message": "JWT_SECRET 환경 변수가 설정되지 않았습니다.",
            },
        )
    try:
        return decode_access_token(token, secret, [get_jwt_algorithm()])
    except ValueError as e:
        raise HTTPException(
            status_code=401,
            detail={"code": "INVALID_TOKEN", "message": str(e)},
        ) from e


async def require_jwt_payload(
    payload: dict[str, Any] | None = Depends(decode_bearer_token_optional),
) -> dict[str, Any]:
    """유효한 Bearer JWT가 필수인 라우트용."""
    if payload is None:
        raise HTTPException(
            status_code=401,
            detail={"code": "UNAUTHORIZED", "message": "Authorization: Bearer 토큰이 필요합니다."},
        )
    return payload
