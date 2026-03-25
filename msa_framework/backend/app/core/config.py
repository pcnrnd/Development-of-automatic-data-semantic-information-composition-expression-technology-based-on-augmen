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
