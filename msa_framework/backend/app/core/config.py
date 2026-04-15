"""
환경 설정 관리 모듈

환경 변수 검증 기능 제공
"""
import os
from typing import Literal


def get_bool_env(name: str, default: bool = False) -> bool:
    """환경 변수를 bool로 파싱합니다."""
    raw = os.environ.get(name)
    if raw is None:
        return default
    return raw.strip().lower() in {"1", "true", "yes", "y", "on"}


def get_environment() -> Literal["development", "production", "test"]:
    """
    현재 실행 환경을 반환합니다.
    
    Returns:
        "development", "production", "test" 중 하나
    """
    env = os.environ.get("ENVIRONMENT") or os.environ.get("ENV") or os.environ.get("NODE_ENV", "development")
    env_lower = env.lower()
    if env_lower in ("production", "prod"):
        return "production"
    if env_lower in ("test", "testing"):
        return "test"
    return "development"


def get_jwt_secret() -> str | None:
    """JWT 서명용 비밀키. 미설정 시 토큰 발급/검증 비활성."""
    raw = os.environ.get("JWT_SECRET")
    return raw.strip() if raw and raw.strip() else None


def get_jwt_algorithm() -> str:
    """JWT 알고리즘 (기본 HS256)."""
    return os.environ.get("JWT_ALGORITHM", "HS256").strip() or "HS256"


def get_access_token_expire_minutes() -> int:
    """액세스 토큰 만료(분). 1~1440."""
    raw = os.environ.get("ACCESS_TOKEN_EXPIRE_MINUTES", "60")
    try:
        return max(1, min(int(raw), 24 * 60))
    except ValueError:
        return 60


def get_jwt_auth_username() -> str | None:
    """password grant용 데모 사용자명 (선택)."""
    raw = os.environ.get("JWT_AUTH_USERNAME")
    return raw.strip() if raw and raw.strip() else None


def get_jwt_auth_password() -> str | None:
    """password grant용 데모 비밀번호 (선택)."""
    raw = os.environ.get("JWT_AUTH_PASSWORD")
    return raw.strip() if raw and raw.strip() else None
