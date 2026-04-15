"""
API 라우터 모듈

모든 API 엔드포인트를 정의하고 입력 검증 및 에러 처리를 수행합니다.
"""
from __future__ import annotations

import logging
from typing import Any

from fastapi import APIRouter, Body, Depends, Header, HTTPException, Query
from pydantic import BaseModel, Field, field_validator

from app.core.config import (
    get_access_token_expire_minutes,
    get_jwt_algorithm,
    get_jwt_auth_password,
    get_jwt_auth_username,
    get_jwt_secret,
)
from app.core.deps import decode_bearer_token_optional, get_store, require_jwt_payload
from app.core.security import create_access_token
from app.domain.models import (
    ApiError,
    ApiKey,
    ApiResponse,
    AuthMeResponse,
    AuthTokenRequest,
    CreateMicroserviceRequest,
    ExternalApiService,
    ExternalApiServiceStatus,
    InfraNode,
    Microservice,
    TokenResponse,
    UpdateMicroserviceRequest,
)
from app.store.in_memory import InMemoryStore

logger = logging.getLogger(__name__)

router = APIRouter()


def ok(data: object, meta: dict[str, object] | None = None) -> ApiResponse:
    """성공 응답 생성"""
    return ApiResponse(data=data, error=None, meta=meta)


def err(code: str, message: str, status_code: int) -> HTTPException:
    """에러 응답 생성"""
    return HTTPException(status_code=status_code, detail=ApiError(code=code, message=message).model_dump())


@router.get("/healthz")
async def healthz() -> dict[str, str]:
    return {"status": "ok"}


@router.get("/v1/infra/nodes", response_model=ApiResponse)
async def list_infra_nodes(store: InMemoryStore = Depends(get_store)) -> ApiResponse:
    nodes: list[InfraNode] = await store.list_infra_nodes()
    return ok([n.model_dump() for n in nodes])


@router.get("/v1/microservices", response_model=ApiResponse)
async def list_microservices(store: InMemoryStore = Depends(get_store)) -> ApiResponse:
    services: list[Microservice] = await store.list_microservices()
    return ok([s.model_dump() for s in services])


@router.get("/v1/microservices/{service_id}", response_model=ApiResponse)
async def get_microservice(
    service_id: str, store: InMemoryStore = Depends(get_store)
) -> ApiResponse:
    """
    마이크로서비스 상세 조회
    
    - **service_id**: 마이크로서비스 ID
    """
    if not service_id or not service_id.strip():
        raise err("INVALID_INPUT", "service_id는 비어있을 수 없습니다", 400)

    try:
        service = await store.get_microservice(service_id.strip())
        if service is None:
            raise err("NOT_FOUND", f"microservice '{service_id}' not found", 404)
        return ok(service.model_dump())
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting microservice {service_id}: {e}", exc_info=True)
        raise err("INTERNAL_ERROR", f"서비스 조회 중 오류가 발생했습니다: {str(e)}", 500)


@router.post("/v1/microservices", response_model=ApiResponse)
async def create_microservice(
    body: CreateMicroserviceRequest = Body(...),
    store: InMemoryStore = Depends(get_store),
) -> ApiResponse:
    """
    마이크로서비스 등록
    
    - **body**: 마이크로서비스 생성 정보
    """
    name = body.name.strip()
    description = body.description.strip()

    if not name:
        raise err("INVALID_INPUT", "name은 비어있을 수 없습니다", 400)
    if not description:
        raise err("INVALID_INPUT", "description은 비어있을 수 없습니다", 400)

    try:
        created = await store.create_microservice(
            name=name,
            category=body.category,
            description=description,
            status=body.status,
            metrics=body.metrics,
            host=body.host,
            port=body.port,
            protocol=body.protocol,
        )
        logger.info(f"Microservice created: {created.id} ({created.name})")
        return ok(created.model_dump())
    except ValueError as e:
        if str(e) == "DUPLICATE_NAME":
            raise err("ALREADY_EXISTS", f"이름 '{name}'이 이미 존재합니다", 409)
        raise err("INVALID_INPUT", str(e), 400)
    except Exception as e:
        logger.error(f"Error creating microservice: {e}", exc_info=True)
        raise err("INTERNAL_ERROR", f"서비스 등록 중 오류가 발생했습니다: {str(e)}", 500)


@router.put("/v1/microservices/{service_id}", response_model=ApiResponse)
async def update_microservice(
    service_id: str,
    body: UpdateMicroserviceRequest = Body(...),
    store: InMemoryStore = Depends(get_store),
) -> ApiResponse:
    """
    마이크로서비스 수정
    
    - **service_id**: 마이크로서비스 ID
    - **body**: 수정할 정보 (부분 업데이트 지원)
    """
    if not service_id or not service_id.strip():
        raise err("INVALID_INPUT", "service_id는 비어있을 수 없습니다", 400)

    # 최소 하나의 필드는 수정되어야 함
    if (
        body.name is None
        and body.category is None
        and body.description is None
        and body.status is None
        and body.metrics is None
        and body.host is None
        and body.port is None
        and body.protocol is None
    ):
        raise err("INVALID_INPUT", "최소 하나의 필드는 수정되어야 합니다", 400)

    if body.name is not None:
        body.name = body.name.strip()
        if not body.name:
            raise err("INVALID_INPUT", "name은 비어있을 수 없습니다", 400)

    if body.description is not None:
        body.description = body.description.strip()
        if not body.description:
            raise err("INVALID_INPUT", "description은 비어있을 수 없습니다", 400)

    try:
        updated = await store.update_microservice(
            service_id.strip(),
            name=body.name,
            category=body.category,
            description=body.description,
            status=body.status,
            metrics=body.metrics,
            host=body.host,
            port=body.port,
            protocol=body.protocol,
        )
        if updated is None:
            raise err("NOT_FOUND", f"microservice '{service_id}' not found", 404)
        logger.info(f"Microservice updated: {service_id}")
        return ok(updated.model_dump())
    except ValueError as e:
        if str(e) == "DUPLICATE_NAME":
            raise err("ALREADY_EXISTS", f"이름 '{body.name}'이 이미 존재합니다", 409)
        raise err("INVALID_INPUT", str(e), 400)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating microservice {service_id}: {e}", exc_info=True)
        raise err("INTERNAL_ERROR", f"서비스 수정 중 오류가 발생했습니다: {str(e)}", 500)


@router.delete("/v1/microservices/{service_id}", response_model=ApiResponse)
async def delete_microservice(
    service_id: str, store: InMemoryStore = Depends(get_store)
) -> ApiResponse:
    """
    마이크로서비스 삭제
    
    - **service_id**: 마이크로서비스 ID
    """
    if not service_id or not service_id.strip():
        raise err("INVALID_INPUT", "service_id는 비어있을 수 없습니다", 400)

    try:
        deleted = await store.delete_microservice(service_id.strip())
        if not deleted:
            raise err("NOT_FOUND", f"microservice '{service_id}' not found", 404)
        logger.info(f"Microservice deleted: {service_id}")
        return ok({"id": service_id, "deleted": True})
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting microservice {service_id}: {e}", exc_info=True)
        raise err("INTERNAL_ERROR", f"서비스 삭제 중 오류가 발생했습니다: {str(e)}", 500)


@router.post("/v1/microservices/{service_id}/actions/degrade", response_model=ApiResponse)
async def degrade(service_id: str, store: InMemoryStore = Depends(get_store)) -> ApiResponse:
    """
    마이크로서비스 상태를 degraded로 변경
    
    - **service_id**: 마이크로서비스 ID
    """
    if not service_id or not service_id.strip():
        raise err("INVALID_INPUT", "service_id는 비어있을 수 없습니다", 400)
    
    try:
        updated = await store.set_status(service_id.strip(), "degraded")
        if updated is None:
            raise err("NOT_FOUND", f"microservice '{service_id}' not found", 404)
        logger.info(f"Microservice {service_id} degraded")
        return ok(updated.model_dump())
    except Exception as e:
        logger.error(f"Error degrading service {service_id}: {e}", exc_info=True)
        raise err("INTERNAL_ERROR", f"서비스 상태 변경 중 오류가 발생했습니다: {str(e)}", 500)


@router.post("/v1/microservices/{service_id}/actions/recover", response_model=ApiResponse)
async def recover(service_id: str, store: InMemoryStore = Depends(get_store)) -> ApiResponse:
    """
    마이크로서비스 상태를 healthy로 복구
    
    - **service_id**: 마이크로서비스 ID
    """
    if not service_id or not service_id.strip():
        raise err("INVALID_INPUT", "service_id는 비어있을 수 없습니다", 400)
    
    try:
        updated = await store.set_status(service_id.strip(), "healthy")
        if updated is None:
            raise err("NOT_FOUND", f"microservice '{service_id}' not found", 404)
        logger.info(f"Microservice {service_id} recovered")
        return ok(updated.model_dump())
    except Exception as e:
        logger.error(f"Error recovering service {service_id}: {e}", exc_info=True)
        raise err("INTERNAL_ERROR", f"서비스 상태 변경 중 오류가 발생했습니다: {str(e)}", 500)


class TrafficAdjustment(BaseModel):
    """트래픽 조정 요청 모델"""
    
    latencyDelta: float = Field(
        default=0,
        description="지연 시간 변화량 (ms)",
        ge=-1000,
        le=1000,
    )
    throughputDelta: float = Field(
        default=0,
        description="처리량 변화량 (req/s)",
        ge=-10000,
        le=10000,
    )
    errorRateDelta: float = Field(
        default=0,
        description="에러율 변화량 (0.0 ~ 1.0)",
        ge=-1.0,
        le=1.0,
    )
    
    @field_validator("errorRateDelta")
    @classmethod
    def validate_error_rate(cls, v: float) -> float:
        """에러율 검증"""
        if not -1.0 <= v <= 1.0:
            raise ValueError("errorRateDelta는 -1.0과 1.0 사이여야 합니다")
        return v


@router.post("/v1/microservices/{service_id}/actions/traffic", response_model=ApiResponse)
async def adjust_traffic(
    service_id: str,
    body: TrafficAdjustment = Body(default_factory=TrafficAdjustment),
    store: InMemoryStore = Depends(get_store),
) -> ApiResponse:
    """
    마이크로서비스 트래픽 메트릭 조정
    
    - **service_id**: 마이크로서비스 ID
    - **body**: 트래픽 조정 파라미터
    """
    if not service_id or not service_id.strip():
        raise err("INVALID_INPUT", "service_id는 비어있을 수 없습니다", 400)
    
    try:
        updated = await store.adjust_traffic(
            service_id.strip(),
            latency_delta=body.latencyDelta,
            throughput_delta=body.throughputDelta,
            error_rate_delta=body.errorRateDelta,
        )
        if updated is None:
            raise err("NOT_FOUND", f"microservice '{service_id}' not found", 404)
        logger.info(
            f"Traffic adjusted for {service_id}: "
            f"latency={body.latencyDelta}, throughput={body.throughputDelta}, errorRate={body.errorRateDelta}"
        )
        return ok(updated.model_dump())
    except ValueError as e:
        logger.warning(f"Invalid traffic adjustment for {service_id}: {e}")
        raise err("INVALID_INPUT", str(e), 400)
    except Exception as e:
        logger.error(f"Error adjusting traffic for {service_id}: {e}", exc_info=True)
        raise err("INTERNAL_ERROR", f"트래픽 조정 중 오류가 발생했습니다: {str(e)}", 500)


@router.get("/v1/observability/events", response_model=ApiResponse)
async def list_events(
    store: InMemoryStore = Depends(get_store),
    limit: int = Query(default=100, ge=1, le=1000, description="최대 반환 이벤트 수"),
) -> ApiResponse:
    """
    관찰 가능성 이벤트 목록 조회
    
    - **limit**: 최대 반환 이벤트 수 (1-1000, 기본값: 100)
    """
    try:
        events = await store.list_events(limit=limit)
        return ok(
            [{"ts_ms": e.ts_ms, "type": e.type, "payload": e.payload} for e in events],
            meta={"limit": limit, "count": len(events)},
        )
    except Exception as e:
        logger.error(f"Error listing events: {e}", exc_info=True)
        raise err("INTERNAL_ERROR", f"이벤트 목록 조회 중 오류가 발생했습니다: {str(e)}", 500)


# ========== Auth (JWT) ==========


@router.post("/v1/auth/token", response_model=ApiResponse)
async def issue_access_token(
    body: AuthTokenRequest = Body(...),
    store: InMemoryStore = Depends(get_store),
) -> ApiResponse:
    """
    액세스 JWT 발급.

    - **grant_type=api_key**: 활성 API Key 전체 문자열로 교환 (`api_key` 필드).
    - **grant_type=password**: 환경 변수 `JWT_AUTH_USERNAME` / `JWT_AUTH_PASSWORD`와 일치할 때만 허용.
    - 서버에 `JWT_SECRET`이 없으면 503.
    """
    secret = get_jwt_secret()
    if not secret:
        raise err(
            "JWT_NOT_CONFIGURED",
            "JWT_SECRET 환경 변수를 설정한 뒤 토큰을 발급할 수 있습니다.",
            503,
        )

    algo = get_jwt_algorithm()
    exp_min = get_access_token_expire_minutes()

    try:
        if body.grant_type == "api_key":
            matched = await store.find_active_api_key_by_secret(body.api_key or "")
            if matched is None:
                raise err("INVALID_CREDENTIALS", "유효한 API Key가 아닙니다", 401)
            token, expires_in = create_access_token(
                matched.id,
                "api_key",
                secret=secret,
                algorithm=algo,
                expire_minutes=exp_min,
            )
            return ok(TokenResponse(access_token=token, expires_in=expires_in).model_dump())

        demo_user = get_jwt_auth_username()
        demo_pass = get_jwt_auth_password()
        if not demo_user or not demo_pass:
            raise err(
                "PASSWORD_GRANT_DISABLED",
                "password grant는 JWT_AUTH_USERNAME 및 JWT_AUTH_PASSWORD 설정 시에만 사용할 수 있습니다",
                400,
            )
        if (body.username or "").strip() != demo_user or body.password != demo_pass:
            raise err("INVALID_CREDENTIALS", "사용자명 또는 비밀번호가 올바르지 않습니다", 401)
        token, expires_in = create_access_token(
            demo_user,
            "user",
            secret=secret,
            algorithm=algo,
            expire_minutes=exp_min,
        )
        return ok(TokenResponse(access_token=token, expires_in=expires_in).model_dump())
    except HTTPException:
        raise
    except ValueError as e:
        raise err("INVALID_INPUT", str(e), 422) from e
    except Exception as e:
        logger.error(f"Error issuing token: {e}", exc_info=True)
        raise err("INTERNAL_ERROR", f"토큰 발급 중 오류가 발생했습니다: {str(e)}", 500)


@router.get("/v1/auth/me", response_model=ApiResponse)
async def auth_me(jwt_payload: dict[str, Any] = Depends(require_jwt_payload)) -> ApiResponse:
    """Bearer JWT 검증 데모: 클레임 요약을 반환합니다."""
    try:
        return ok(
            AuthMeResponse(
                sub=str(jwt_payload.get("sub", "")),
                typ=str(jwt_payload.get("typ", "")),
                exp=int(jwt_payload.get("exp", 0)),
                iat=int(jwt_payload.get("iat", 0)),
            ).model_dump()
        )
    except Exception as e:
        logger.error(f"Error in auth/me: {e}", exc_info=True)
        raise err("INTERNAL_ERROR", f"토큰 정보 조회 중 오류가 발생했습니다: {str(e)}", 500)


# ========== Security & Access API 엔드포인트 ==========


@router.get("/v1/security/api-keys", response_model=ApiResponse)
async def list_api_keys(store: InMemoryStore = Depends(get_store)) -> ApiResponse:
    """
    인증Key 목록 조회
    
    모든 인증Key의 목록을 반환합니다.
    """
    try:
        keys: list[ApiKey] = await store.list_api_keys()
        return ok([k.model_dump() for k in keys])
    except Exception as e:
        logger.error(f"Error listing API keys: {e}", exc_info=True)
        raise err("INTERNAL_ERROR", f"인증Key 목록 조회 중 오류가 발생했습니다: {str(e)}", 500)


class CreateApiKeyRequest(BaseModel):
    """인증Key 생성 요청 모델"""
    
    name: str = Field(..., description="Key 이름", min_length=1, max_length=100)
    permissions: list[str] = Field(default=["read", "write"], description="권한 목록")


@router.post("/v1/security/api-keys", response_model=ApiResponse)
async def create_api_key(
    body: CreateApiKeyRequest = Body(...),
    store: InMemoryStore = Depends(get_store),
) -> ApiResponse:
    """
    새 인증Key 발급
    
    - **name**: Key 이름
    - **permissions**: 권한 목록 (기본값: ["read", "write"])
    """
    if not body.name or not body.name.strip():
        raise err("INVALID_INPUT", "name은 비어있을 수 없습니다", 400)
    
    try:
        new_key = await store.create_api_key(name=body.name.strip(), permissions=body.permissions)
        logger.info(f"API key created: {new_key.id} ({new_key.name})")
        return ok(new_key.model_dump())
    except Exception as e:
        logger.error(f"Error creating API key: {e}", exc_info=True)
        raise err("INTERNAL_ERROR", f"인증Key 생성 중 오류가 발생했습니다: {str(e)}", 500)


@router.delete("/v1/security/api-keys/{key_id}", response_model=ApiResponse)
async def delete_api_key(key_id: str, store: InMemoryStore = Depends(get_store)) -> ApiResponse:
    """
    인증Key 삭제 (Hard delete)
    
    - **key_id**: 인증Key ID
    """
    if not key_id or not key_id.strip():
        raise err("INVALID_INPUT", "key_id는 비어있을 수 없습니다", 400)
    
    try:
        deleted = await store.delete_api_key(key_id.strip())
        if not deleted:
            raise err("NOT_FOUND", f"API key '{key_id}' not found", 404)
        logger.info(f"API key deleted: {key_id}")
        return ok({"deleted": True, "id": key_id.strip()})
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting API key {key_id}: {e}", exc_info=True)
        raise err("INTERNAL_ERROR", f"인증Key 삭제 중 오류가 발생했습니다: {str(e)}", 500)


@router.get("/v1/security/external-services", response_model=ApiResponse)
async def list_external_services(store: InMemoryStore = Depends(get_store)) -> ApiResponse:
    """
    외부 API 서비스 목록 조회
    
    모든 외부 API 서비스의 목록을 반환합니다.
    """
    try:
        services: list[ExternalApiService] = await store.list_external_services()
        return ok([s.model_dump() for s in services])
    except Exception as e:
        logger.error(f"Error listing external services: {e}", exc_info=True)
        raise err("INTERNAL_ERROR", f"외부 API 서비스 목록 조회 중 오류가 발생했습니다: {str(e)}", 500)


class CreateExternalServiceRequest(BaseModel):
    """외부 API 서비스 등록 요청 모델"""

    name: str = Field(..., description="서비스 이름", min_length=1, max_length=100)
    endpoint: str = Field(..., description="서비스 엔드포인트(예: /api/v1/foo)", min_length=1, max_length=200)
    description: str = Field(..., description="설명", min_length=1, max_length=500)
    status: ExternalApiServiceStatus = Field(default=ExternalApiServiceStatus.ALLOWED, description="초기 상태")
    rateLimit: int | None = Field(default=None, description="허용 요청 수 (null이면 제한 해제)", ge=1)
    rateLimitWindowSeconds: int | None = Field(
        default=None, description="기간(초). 예: 60(분당), 3600(시간당)", ge=1
    )
    # 포트포워딩 설정
    targetHost: str | None = Field(default=None, description="내부 서비스 호스트 (IP 또는 도메인)", max_length=255)
    targetPort: int | None = Field(default=None, description="내부 서비스 포트 (1-65535)", ge=1, le=65535)
    targetPath: str | None = Field(default=None, description="내부 서비스 경로 (선택)", max_length=500)
    protocol: str = Field(default="http", description="프로토콜 (http 또는 https)", pattern="^(http|https)$")
    targetServiceId: str | None = Field(default=None, description="연결된 마이크로서비스 ID (선택)", max_length=100)


@router.post("/v1/security/external-services", response_model=ApiResponse)
async def create_external_service(
    body: CreateExternalServiceRequest = Body(...),
    store: InMemoryStore = Depends(get_store),
) -> ApiResponse:
    """외부 API 서비스 등록"""
    name = body.name.strip()
    endpoint = body.endpoint.strip()
    description = body.description.strip()

    if not endpoint.startswith("/"):
        raise err("INVALID_INPUT", "endpoint는 '/'로 시작해야 합니다", 400)

    if body.status == ExternalApiServiceStatus.LIMITED:
        if body.rateLimit is None or body.rateLimitWindowSeconds is None:
            raise err("INVALID_INPUT", "LIMITED 상태에서는 rateLimit/rateLimitWindowSeconds가 필수입니다", 400)

    # 포트포워딩 검증: targetHost와 targetPort는 함께 설정되어야 함
    if (body.targetHost is not None and body.targetPort is None) or (body.targetHost is None and body.targetPort is not None):
        raise err("INVALID_INPUT", "targetHost와 targetPort는 함께 설정되어야 합니다", 400)

    try:
        created = await store.create_external_service(
            name=name,
            endpoint=endpoint,
            description=description,
            status=body.status,
            rate_limit=body.rateLimit,
            rate_limit_window_seconds=body.rateLimitWindowSeconds,
            target_host=body.targetHost,
            target_port=body.targetPort,
            target_path=body.targetPath,
            protocol=body.protocol,
            target_service_id=body.targetServiceId,
        )
        logger.info(f"External service created: {created.id} ({created.name})")
        return ok(created.model_dump())
    except ValueError as e:
        if str(e) == "DUPLICATE_ENDPOINT":
            raise err("ALREADY_EXISTS", f"endpoint '{endpoint}' already exists", 409)
        raise
    except Exception as e:
        logger.error(f"Error creating external service: {e}", exc_info=True)
        raise err("INTERNAL_ERROR", f"외부 API 서비스 등록 중 오류가 발생했습니다: {str(e)}", 500)


class UpdateServiceRateLimitRequest(BaseModel):
    """외부 API 서비스 제한 기준 설정 요청 모델"""

    rateLimit: int | None = Field(default=None, description="허용 요청 수 (null이면 제한 해제)", ge=1)
    rateLimitWindowSeconds: int | None = Field(
        default=None, description="기간(초). 예: 60(분당), 3600(시간당)", ge=1
    )


@router.put("/v1/security/external-services/{service_id}/rate-limit", response_model=ApiResponse)
async def update_service_rate_limit(
    service_id: str,
    body: UpdateServiceRateLimitRequest = Body(...),
    store: InMemoryStore = Depends(get_store),
) -> ApiResponse:
    """
    외부 API 서비스 제한 기준(횟수/기간) 설정

    - **rateLimit**: 허용 요청 수 (null이면 제한 해제)
    - **rateLimitWindowSeconds**: 기간(초). 예: 60, 3600
    """
    if not service_id or not service_id.strip():
        raise err("INVALID_INPUT", "service_id는 비어있을 수 없습니다", 400)

    # 제한을 켜는 경우 windowSeconds는 필수
    if body.rateLimit is not None and body.rateLimitWindowSeconds is None:
        raise err("INVALID_INPUT", "rateLimitWindowSeconds는 rateLimit 설정 시 필수입니다", 400)

    try:
        updated = await store.update_service_rate_limit(
            service_id.strip(), body.rateLimit, body.rateLimitWindowSeconds
        )
        if updated is None:
            raise err("NOT_FOUND", f"external service '{service_id}' not found", 404)
        logger.info(
            f"External service {service_id} rate limit updated: "
            f"limit={body.rateLimit}, windowSeconds={body.rateLimitWindowSeconds}"
        )
        return ok(updated.model_dump())
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating rate limit for {service_id}: {e}", exc_info=True)
        raise err("INTERNAL_ERROR", f"제한 기준 설정 중 오류가 발생했습니다: {str(e)}", 500)


@router.delete("/v1/security/external-services/{service_id}", response_model=ApiResponse)
async def delete_external_service(service_id: str, store: InMemoryStore = Depends(get_store)) -> ApiResponse:
    """외부 API 서비스 삭제 (Hard delete)"""
    if not service_id or not service_id.strip():
        raise err("INVALID_INPUT", "service_id는 비어있을 수 없습니다", 400)

    try:
        deleted = await store.delete_external_service(service_id.strip())
        if not deleted:
            raise err("NOT_FOUND", f"external service '{service_id}' not found", 404)
        logger.info(f"External service deleted: {service_id}")
        return ok({"deleted": True, "id": service_id.strip()})
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting external service {service_id}: {e}", exc_info=True)
        raise err("INTERNAL_ERROR", f"외부 API 서비스 삭제 중 오류가 발생했습니다: {str(e)}", 500)


class UpdateServiceStatusRequest(BaseModel):
    """외부 API 서비스 상태 변경 요청 모델"""
    
    status: ExternalApiServiceStatus = Field(..., description="새로운 상태 (allowed, blocked, limited)")


@router.put("/v1/security/external-services/{service_id}/status", response_model=ApiResponse)
async def update_service_status(
    service_id: str,
    body: UpdateServiceStatusRequest = Body(...),
    store: InMemoryStore = Depends(get_store),
) -> ApiResponse:
    """
    외부 API 서비스 상태 변경
    
    - **service_id**: 외부 API 서비스 ID
    - **status**: 새로운 상태 (allowed, blocked, limited)
    """
    if not service_id or not service_id.strip():
        raise err("INVALID_INPUT", "service_id는 비어있을 수 없습니다", 400)
    
    try:
        updated = await store.update_service_status(service_id.strip(), body.status)
        if updated is None:
            raise err("NOT_FOUND", f"external service '{service_id}' not found", 404)
        logger.info(f"External service {service_id} status changed to {body.status}")
        return ok(updated.model_dump())
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating service status {service_id}: {e}", exc_info=True)
        raise err("INTERNAL_ERROR", f"서비스 상태 변경 중 오류가 발생했습니다: {str(e)}", 500)


@router.post("/v1/external-services/{service_id}/invoke", response_model=ApiResponse)
async def invoke_external_service(
    service_id: str,
    x_api_key: str | None = Header(default=None, alias="x-api-key"),
    jwt_payload: dict | None = Depends(decode_bearer_token_optional),
    store: InMemoryStore = Depends(get_store),
) -> ApiResponse:
    """
    외부 API 서비스 호출(데모) - 차단/제한 집행 확인용.

    - **Authorization: Bearer** JWT가 있으면 유효해야 하며, 제한 카운터 식별자로 `sub` 클레임을 사용합니다.
    - JWT가 없으면 기존처럼 **x-api-key** 헤더(없으면 `anonymous`)를 사용합니다.
    """
    if not service_id or not service_id.strip():
        raise err("INVALID_INPUT", "service_id는 비어있을 수 없습니다", 400)

    if jwt_payload is not None:
        api_key = f"jwt:{jwt_payload.get('sub', 'unknown')}"
    else:
        api_key = (x_api_key or "anonymous").strip() or "anonymous"

    try:
        services = await store.list_external_services()
        service = next((s for s in services if s.id == service_id.strip()), None)
        if service is None:
            raise err("NOT_FOUND", f"external service '{service_id}' not found", 404)

        if service.status == ExternalApiServiceStatus.BLOCKED:
            raise err("BLOCKED", "차단된 외부 API 서비스입니다", 403)

        if service.status == ExternalApiServiceStatus.LIMITED:
            allowed, retry_after = await store.check_rate_limit(service.id, api_key)
            if not allowed:
                raise err(
                    "RATE_LIMITED",
                    f"요청 제한 초과: {service.rateLimit}/{service.rateLimitWindowSeconds}s",
                    429,
                )

        # 데모 응답
        return ok(
            {
                "serviceId": service.id,
                "apiKey": api_key,
                "status": "ok",
            }
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error invoking external service {service_id}: {e}", exc_info=True)
        raise err("INTERNAL_ERROR", f"외부 서비스 호출 중 오류가 발생했습니다: {str(e)}", 500)
