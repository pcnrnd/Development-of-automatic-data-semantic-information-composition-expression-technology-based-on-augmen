from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Literal

from pydantic import BaseModel, Field, model_validator


class ServiceCategory(str, Enum):
    DATA_COLLECTION = "Data Collection & Management"
    ANALYSIS_MODELING = "Analysis & Modeling"
    STRUCTURE_VISUALIZATION = "Structuring & Visualization"


class MicroserviceMetrics(BaseModel):
    latency: float = Field(ge=0)
    throughput: float = Field(ge=0)
    errorRate: float = Field(ge=0, le=1)


class Microservice(BaseModel):
    id: str
    name: str
    category: ServiceCategory
    description: str
    status: str = Field(pattern="^(healthy|degraded|down)$")
    metrics: MicroserviceMetrics
    # 네트워크 정보: 게이트웨이 라우팅에 필수
    host: str = Field(..., description="서비스 호스트 (IP 또는 도메인)", max_length=255)
    port: int = Field(..., description="서비스 포트 (1-65535)", ge=1, le=65535)
    protocol: str = Field(default="http", description="프로토콜 (http 또는 https)", pattern="^(http|https)$")


class InfraNode(BaseModel):
    id: str
    name: str
    type: str = Field(pattern="^(gateway|mesh|container|monitor|storage)$")
    description: str
    details: list[str]


class ApiKeyStatus(str, Enum):
    """인증Key 상태"""
    ACTIVE = "active"
    REVOKED = "revoked"


class ApiKey(BaseModel):
    """인증Key 모델"""
    id: str
    name: str
    key: str
    createdAt: str
    lastUsed: str | None = None
    status: ApiKeyStatus
    permissions: list[str]


class ExternalApiServiceStatus(str, Enum):
    """외부 API 서비스 상태"""
    ALLOWED = "allowed"
    BLOCKED = "blocked"
    LIMITED = "limited"


class ExternalApiService(BaseModel):
    """외부 API 서비스 모델"""
    id: str
    name: str
    endpoint: str
    status: ExternalApiServiceStatus
    # 제한 기준: limit(횟수) + windowSeconds(기간)
    # - status가 LIMITED일 때만 실제로 제한을 집행하는 것을 권장
    rateLimit: int | None = None
    rateLimitWindowSeconds: int | None = None
    description: str
    # 포트포워딩 설정: 외부 요청을 내부 서비스로 라우팅
    targetHost: str | None = Field(default=None, description="내부 서비스 호스트 (IP 또는 도메인)")
    targetPort: int | None = Field(default=None, description="내부 서비스 포트 (1-65535)", ge=1, le=65535)
    targetPath: str | None = Field(default=None, description="내부 서비스 경로 (선택, 기본값은 endpoint 그대로)")
    protocol: str = Field(default="http", description="프로토콜 (http 또는 https)", pattern="^(http|https)$")
    targetServiceId: str | None = Field(default=None, description="연결된 마이크로서비스 ID (선택)")


class ApiError(BaseModel):
    code: str
    message: str


class ApiResponse(BaseModel):
    """프론트에서 일관되게 처리하기 위한 표준 응답 스키마."""

    data: object | None = None
    error: ApiError | None = None
    meta: dict[str, object] | None = None


class CreateMicroserviceRequest(BaseModel):
    """마이크로서비스 등록 요청 모델"""

    name: str = Field(..., description="서비스 이름", min_length=1, max_length=100)
    category: ServiceCategory = Field(..., description="서비스 카테고리")
    description: str = Field(..., description="서비스 설명", min_length=1, max_length=500)
    status: str = Field(
        default="healthy", description="초기 상태", pattern="^(healthy|degraded|down)$"
    )
    metrics: MicroserviceMetrics | None = Field(
        default=None, description="초기 메트릭 (None이면 기본값 사용)"
    )
    # 네트워크 정보: 게이트웨이 라우팅에 필수
    host: str = Field(..., description="서비스 호스트 (IP 또는 도메인)", max_length=255)
    port: int = Field(..., description="서비스 포트 (1-65535)", ge=1, le=65535)
    protocol: str = Field(default="http", description="프로토콜 (http 또는 https)", pattern="^(http|https)$")


class UpdateMicroserviceRequest(BaseModel):
    """마이크로서비스 수정 요청 모델"""

    name: str | None = Field(None, description="서비스 이름", min_length=1, max_length=100)
    category: ServiceCategory | None = Field(None, description="서비스 카테고리")
    description: str | None = Field(None, description="서비스 설명", min_length=1, max_length=500)
    status: str | None = Field(None, description="상태", pattern="^(healthy|degraded|down)$")
    metrics: MicroserviceMetrics | None = Field(None, description="메트릭")
    # 네트워크 정보
    host: str | None = Field(None, description="서비스 호스트 (IP 또는 도메인)", max_length=255)
    port: int | None = Field(None, description="서비스 포트 (1-65535)", ge=1, le=65535)
    protocol: str | None = Field(None, description="프로토콜 (http 또는 https)", pattern="^(http|https)$")


class AuthTokenRequest(BaseModel):
    """JWT 발급 요청: api_key 또는 password grant."""

    grant_type: Literal["api_key", "password"] = Field(
        default="api_key",
        description="api_key: 활성 API Key 문자열로 교환 / password: JWT_AUTH_* 환경 변수와 매칭",
    )
    api_key: str | None = Field(default=None, description="grant_type=api_key 일 때 전체 Key 문자열")
    username: str | None = Field(default=None, description="grant_type=password 일 때 사용자명")
    password: str | None = Field(default=None, description="grant_type=password 일 때 비밀번호")

    @model_validator(mode="after")
    def _validate_grant(self) -> AuthTokenRequest:
        if self.grant_type == "api_key":
            if not self.api_key or not self.api_key.strip():
                raise ValueError("api_key grant에는 api_key 필드가 필요합니다")
        else:
            if not self.username or not self.username.strip():
                raise ValueError("password grant에는 username 필드가 필요합니다")
            if self.password is None or self.password == "":
                raise ValueError("password grant에는 password 필드가 필요합니다")
        return self


class TokenResponse(BaseModel):
    """OAuth2 유사 액세스 토큰 응답."""

    access_token: str
    token_type: str = "bearer"
    expires_in: int


class AuthMeResponse(BaseModel):
    """JWT 클레임 요약 (검증용 데모)."""

    sub: str
    typ: str
    exp: int
    iat: int
