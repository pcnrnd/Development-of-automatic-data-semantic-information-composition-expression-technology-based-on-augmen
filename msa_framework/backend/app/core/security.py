"""
JWT 생성·검증 유틸 (HS256 등 대칭키).

환경 변수 JWT_SECRET 이 없으면 발급 라우트에서 거부합니다.
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any

import jwt


def create_access_token(
    subject: str,
    token_type: str,
    *,
    secret: str,
    algorithm: str,
    expire_minutes: int,
) -> tuple[str, int]:
    """
    액세스 JWT를 생성합니다.

    Returns:
        (token 문자열, expires_in 초)
    """
    now = datetime.now(timezone.utc)
    exp = now + timedelta(minutes=expire_minutes)
    payload: dict[str, Any] = {
        "sub": subject,
        "typ": token_type,
        "iat": int(now.timestamp()),
        "exp": int(exp.timestamp()),
    }
    encoded = jwt.encode(payload, secret, algorithm=algorithm)
    if isinstance(encoded, bytes):
        encoded = encoded.decode("utf-8")
    expires_in = int((exp - now).total_seconds())
    return encoded, expires_in


def decode_access_token(token: str, secret: str, algorithms: list[str]) -> dict[str, Any]:
    """
    JWT를 검증하고 페이로드를 반환합니다.

    Raises:
        ValueError: 서명·만료·형식 오류
    """
    try:
        return jwt.decode(token, secret, algorithms=algorithms)
    except jwt.PyJWTError as e:
        raise ValueError(str(e)) from e
