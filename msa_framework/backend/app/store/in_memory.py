from __future__ import annotations

import asyncio
import secrets
import time
from dataclasses import dataclass
from datetime import datetime
from typing import Any

from app.core.config import get_bool_env, get_environment
from app.domain.models import (
    ApiKey,
    ApiKeyStatus,
    ExternalApiService,
    ExternalApiServiceStatus,
    InfraNode,
    Microservice,
    MicroserviceMetrics,
    ServiceCategory,
)


@dataclass(frozen=True)
class Event:
    ts_ms: int
    type: str
    payload: dict[str, Any]


def _now_ms() -> int:
    return int(time.time() * 1000)


def _generate_api_key() -> str:
    """인증Key 생성 (sk_ 접두사 + 랜덤 문자열)"""
    random_part = secrets.token_urlsafe(32).replace("-", "").replace("_", "")[:28]
    return f"sk_{random_part}"


def _should_seed_demo_data() -> bool:
    """데모(시드) 데이터 주입 여부 결정.

    - ENVIRONMENT가 production이면 기본값 False
    - 그 외 환경이면 기본값 True
    - 환경 변수 SEED_DEMO_DATA로 강제 가능
    """
    env = get_environment()
    default = env != "production"
    return get_bool_env("SEED_DEMO_DATA", default)


class InMemoryStore:
    """데모용 상태 저장소(프로세스 메모리)."""

    def __init__(self) -> None:
        seed_demo_data = _should_seed_demo_data()
        self._lock = asyncio.Lock()
        self._infra_nodes: list[InfraNode] = _seed_infra_nodes() if seed_demo_data else []
        self._microservices: dict[str, Microservice] = (
            {m.id: m for m in _seed_microservices()} if seed_demo_data else {}
        )
        self._events: list[Event] = []
        self._api_keys: dict[str, ApiKey] = {k.id: k for k in _seed_api_keys()} if seed_demo_data else {}
        self._external_services: dict[str, ExternalApiService] = (
            {s.id: s for s in _seed_external_services()} if seed_demo_data else {}
        )
        # Rate limit 카운터 (Fixed window): (service_id, api_key, window_start_ms) -> count
        self._rate_counters: dict[tuple[str, str, int], int] = {}

    async def list_infra_nodes(self) -> list[InfraNode]:
        async with self._lock:
            return list(self._infra_nodes)

    async def list_microservices(self) -> list[Microservice]:
        async with self._lock:
            return list(self._microservices.values())

    async def get_microservice(self, service_id: str) -> Microservice | None:
        async with self._lock:
            return self._microservices.get(service_id)

    async def set_status(self, service_id: str, status: str) -> Microservice | None:
        async with self._lock:
            ms = self._microservices.get(service_id)
            if ms is None:
                return None
            updated = ms.model_copy(update={"status": status})
            self._microservices[service_id] = updated
            self._events.append(
                Event(ts_ms=_now_ms(), type="microservice.status", payload={"id": service_id, "status": status})
            )
            return updated

    async def adjust_traffic(
        self,
        service_id: str,
        latency_delta: float = 0,
        throughput_delta: float = 0,
        error_rate_delta: float = 0,
    ) -> Microservice | None:
        async with self._lock:
            ms = self._microservices.get(service_id)
            if ms is None:
                return None

            new_metrics = MicroserviceMetrics(
                latency=max(0, ms.metrics.latency + latency_delta),
                throughput=max(0, ms.metrics.throughput + throughput_delta),
                errorRate=min(1, max(0, ms.metrics.errorRate + error_rate_delta)),
            )
            updated = ms.model_copy(update={"metrics": new_metrics})
            self._microservices[service_id] = updated
            self._events.append(
                Event(
                    ts_ms=_now_ms(),
                    type="microservice.traffic",
                    payload={
                        "id": service_id,
                        "latency": new_metrics.latency,
                        "throughput": new_metrics.throughput,
                        "errorRate": new_metrics.errorRate,
                    },
                )
            )
            return updated

    async def list_events(self, limit: int = 100) -> list[Event]:
        async with self._lock:
            return list(self._events[-limit:])

    # ========== 마이크로서비스 CRUD 메서드 ==========

    async def create_microservice(
        self,
        name: str,
        category: ServiceCategory,
        description: str,
        status: str = "healthy",
        metrics: MicroserviceMetrics | None = None,
        host: str = "localhost",
        port: int = 8080,
        protocol: str = "http",
    ) -> Microservice:
        """새 마이크로서비스 생성"""
        async with self._lock:
            # 중복 이름 검증
            for ms in self._microservices.values():
                if ms.name == name:
                    raise ValueError("DUPLICATE_NAME")

            # 카테고리별 번호 매핑
            category_map = {
                ServiceCategory.DATA_COLLECTION: 1,
                ServiceCategory.ANALYSIS_MODELING: 2,
                ServiceCategory.STRUCTURE_VISUALIZATION: 3,
            }
            category_num = category_map[category]

            # 해당 카테고리의 기존 서비스 개수 확인하여 시퀀스 번호 결정
            existing_in_category = [
                ms for ms in self._microservices.values() if ms.category == category
            ]
            seq = len(existing_in_category) + 1
            service_id = f"ms-{category_num}-{seq}"

            # 기본 메트릭 설정 (metrics가 None인 경우)
            if metrics is None:
                metrics = MicroserviceMetrics(latency=50.0, throughput=100.0, errorRate=0.02)

            new_service = Microservice(
                id=service_id,
                name=name,
                category=category,
                description=description,
                status=status,
                metrics=metrics,
                host=host,
                port=port,
                protocol=protocol,
            )

            self._microservices[service_id] = new_service
            self._events.append(
                Event(
                    ts_ms=_now_ms(),
                    type="microservice.created",
                    payload={"id": service_id, "name": name, "category": category.value},
                )
            )
            return new_service

    async def update_microservice(
        self,
        service_id: str,
        name: str | None = None,
        category: ServiceCategory | None = None,
        description: str | None = None,
        status: str | None = None,
        metrics: MicroserviceMetrics | None = None,
        host: str | None = None,
        port: int | None = None,
        protocol: str | None = None,
    ) -> Microservice | None:
        """마이크로서비스 수정"""
        async with self._lock:
            ms = self._microservices.get(service_id)
            if ms is None:
                return None

            # 중복 이름 검증 (이름이 변경되는 경우)
            if name is not None and name != ms.name:
                for existing_ms in self._microservices.values():
                    if existing_ms.id != service_id and existing_ms.name == name:
                        raise ValueError("DUPLICATE_NAME")

            # 부분 업데이트를 위한 딕셔너리 생성
            update_dict: dict[str, Any] = {}
            if name is not None:
                update_dict["name"] = name
            if category is not None:
                update_dict["category"] = category
            if description is not None:
                update_dict["description"] = description
            if status is not None:
                update_dict["status"] = status
            if metrics is not None:
                update_dict["metrics"] = metrics
            if host is not None:
                update_dict["host"] = host
            if port is not None:
                update_dict["port"] = port
            if protocol is not None:
                update_dict["protocol"] = protocol

            updated = ms.model_copy(update=update_dict)
            self._microservices[service_id] = updated
            self._events.append(
                Event(
                    ts_ms=_now_ms(),
                    type="microservice.updated",
                    payload={"id": service_id, "changes": list(update_dict.keys())},
                )
            )
            return updated

    async def delete_microservice(self, service_id: str) -> bool:
        """마이크로서비스 삭제"""
        async with self._lock:
            if service_id not in self._microservices:
                return False

            deleted_service = self._microservices[service_id]
            del self._microservices[service_id]
            self._events.append(
                Event(
                    ts_ms=_now_ms(),
                    type="microservice.deleted",
                    payload={"id": service_id, "name": deleted_service.name},
                )
            )
            return True

    # ========== 인증Key 관리 메서드 ==========

    async def list_api_keys(self) -> list[ApiKey]:
        """인증Key 목록 조회"""
        async with self._lock:
            return list(self._api_keys.values())

    async def create_api_key(self, name: str, permissions: list[str] | None = None) -> ApiKey:
        """새 인증Key 생성"""
        async with self._lock:
            key_id = f"key_{_now_ms()}"
            new_key = ApiKey(
                id=key_id,
                name=name,
                key=_generate_api_key(),
                createdAt=datetime.now().strftime("%Y-%m-%d"),
                lastUsed=None,
                status=ApiKeyStatus.ACTIVE,
                permissions=permissions or ["read", "write"],
            )
            self._api_keys[key_id] = new_key
            self._events.append(
                Event(
                    ts_ms=_now_ms(),
                    type="api_key.created",
                    payload={"id": key_id, "name": name},
                )
            )
            return new_key

    async def revoke_api_key(self, key_id: str) -> ApiKey | None:
        """인증Key 비활성화"""
        async with self._lock:
            key = self._api_keys.get(key_id)
            if key is None:
                return None
            updated = key.model_copy(update={"status": ApiKeyStatus.REVOKED})
            self._api_keys[key_id] = updated
            self._events.append(
                Event(ts_ms=_now_ms(), type="api_key.revoked", payload={"id": key_id})
            )
            return updated

    async def delete_api_key(self, key_id: str) -> bool:
        """인증Key 삭제 (Hard delete)"""
        async with self._lock:
            if key_id not in self._api_keys:
                return False
            del self._api_keys[key_id]
            self._events.append(
                Event(ts_ms=_now_ms(), type="api_key.deleted", payload={"id": key_id})
            )
            return True

    async def find_active_api_key_by_secret(self, raw_secret: str) -> ApiKey | None:
        """활성 인증Key 중 secret과 일치하는 항목을 조회합니다."""
        secret = raw_secret.strip()
        if not secret:
            return None
        async with self._lock:
            for k in self._api_keys.values():
                if k.status == ApiKeyStatus.ACTIVE and k.key == secret:
                    return k
            return None

    # ========== 외부 API 서비스 관리 메서드 ==========

    async def list_external_services(self) -> list[ExternalApiService]:
        """외부 API 서비스 목록 조회"""
        async with self._lock:
            return list(self._external_services.values())

    async def create_external_service(
        self,
        name: str,
        endpoint: str,
        description: str,
        status: ExternalApiServiceStatus,
        rate_limit: int | None = None,
        rate_limit_window_seconds: int | None = None,
        target_host: str | None = None,
        target_port: int | None = None,
        target_path: str | None = None,
        protocol: str = "http",
        target_service_id: str | None = None,
    ) -> ExternalApiService:
        """외부 API 서비스 등록"""
        async with self._lock:
            # endpoint 중복 방지
            for s in self._external_services.values():
                if s.endpoint == endpoint:
                    raise ValueError("DUPLICATE_ENDPOINT")

            service_id = f"svc_{_now_ms()}"
            created = ExternalApiService(
                id=service_id,
                name=name,
                endpoint=endpoint,
                status=status,
                rateLimit=rate_limit,
                rateLimitWindowSeconds=rate_limit_window_seconds,
                description=description,
                targetHost=target_host,
                targetPort=target_port,
                targetPath=target_path,
                protocol=protocol,
                targetServiceId=target_service_id,
            )
            self._external_services[service_id] = created
            self._events.append(
                Event(
                    ts_ms=_now_ms(),
                    type="external_service.created",
                    payload={
                        "id": service_id,
                        "name": name,
                        "endpoint": endpoint,
                        "status": status,
                    },
                )
            )
            return created

    async def update_service_status(
        self, service_id: str, status: ExternalApiServiceStatus
    ) -> ExternalApiService | None:
        """외부 API 서비스 상태 변경"""
        async with self._lock:
            service = self._external_services.get(service_id)
            if service is None:
                return None
            updated = service.model_copy(update={"status": status})
            self._external_services[service_id] = updated
            self._events.append(
                Event(
                    ts_ms=_now_ms(),
                    type="external_service.status_changed",
                    payload={"id": service_id, "status": status},
                )
            )
            return updated

    async def update_service_rate_limit(
        self,
        service_id: str,
        limit: int | None,
        window_seconds: int | None,
    ) -> ExternalApiService | None:
        """외부 API 서비스 제한 기준(횟수/기간) 설정"""
        async with self._lock:
            service = self._external_services.get(service_id)
            if service is None:
                return None

            updated = service.model_copy(
                update={
                    "rateLimit": limit,
                    "rateLimitWindowSeconds": window_seconds,
                }
            )
            self._external_services[service_id] = updated
            self._events.append(
                Event(
                    ts_ms=_now_ms(),
                    type="external_service.rate_limit_updated",
                    payload={
                        "id": service_id,
                        "rateLimit": limit,
                        "rateLimitWindowSeconds": window_seconds,
                    },
                )
            )
            return updated

    async def delete_external_service(self, service_id: str) -> bool:
        """외부 API 서비스 삭제 (Hard delete)"""
        async with self._lock:
            if service_id not in self._external_services:
                return False
            del self._external_services[service_id]
            self._events.append(
                Event(ts_ms=_now_ms(), type="external_service.deleted", payload={"id": service_id})
            )
            return True

    async def check_rate_limit(
        self, service_id: str, api_key: str, now_ms: int | None = None
    ) -> tuple[bool, int]:
        """Rate limit 집행(Fixed window).

        Returns:
            (allowed, retry_after_seconds)
        """
        async with self._lock:
            service = self._external_services.get(service_id)
            if service is None:
                return True, 0

            # 제한 설정이 없으면 허용
            if service.rateLimit is None or service.rateLimitWindowSeconds is None:
                return True, 0

            limit = service.rateLimit
            window_seconds = service.rateLimitWindowSeconds
            if limit <= 0 or window_seconds <= 0:
                return True, 0

            now = _now_ms() if now_ms is None else now_ms
            window_ms = window_seconds * 1000
            window_start = now - (now % window_ms)
            key = (service_id, api_key, window_start)
            current = self._rate_counters.get(key, 0)

            if current >= limit:
                retry_after = int((window_ms - (now % window_ms)) / 1000) or 1
                return False, retry_after

            self._rate_counters[key] = current + 1
            return True, 0


def _seed_infra_nodes() -> list[InfraNode]:
    return [
        InfraNode(
            id="ext-gw",
            name="External Gateway",
            type="gateway",
            description="User authentication & API control",
            details=["User Key Management", "Traffic Throttling", "Security Enforcement"],
        ),
        InfraNode(
            id="svc-mesh",
            name="Service Mesh",
            type="mesh",
            description="Internal communication fabric",
            details=["mTLS Encryption", "Version Routing", "Service Discovery"],
        ),
        InfraNode(
            id="mgmt-cont",
            name="Management Container",
            type="container",
            description="Orchestration & Lifecycle",
            details=["Auto-scaling", "Self-healing", "Instance Monitoring"],
        ),
        InfraNode(
            id="mon-diag",
            name="Monitoring & Diagnostics",
            type="monitor",
            description="System-wide observability",
            details=["Trace Analysis", "Resource Telemetry", "Alerting Engine"],
        ),
        InfraNode(
            id="datalake",
            name="Storage (DataLake)",
            type="storage",
            description="Industrial-scale persistent storage",
            details=["Big Data Support", "Hot/Cold Tiering", "Data Versioning"],
        ),
    ]


def _seed_microservices() -> list[Microservice]:
    return [
        Microservice(
            id="ms-1-1",
            name="Data Collection & Preprocessing",
            category=ServiceCategory.DATA_COLLECTION,
            description="Heterogeneous data ingestion and cleansing pipeline.",
            status="healthy",
            metrics=MicroserviceMetrics(latency=45, throughput=1250, errorRate=0.02),
            host="data-collection-service",
            port=8080,
            protocol="http",
        ),
        Microservice(
            id="ms-1-2",
            name="DataOps Manager",
            category=ServiceCategory.DATA_COLLECTION,
            description="Automated data operations and pipeline workflow orchestration.",
            status="healthy",
            metrics=MicroserviceMetrics(latency=12, throughput=450, errorRate=0.01),
            host="dataops-manager-service",
            port=8081,
            protocol="http",
        ),
        Microservice(
            id="ms-1-3",
            name="Quality Diagnosis System",
            category=ServiceCategory.DATA_COLLECTION,
            description="Measures and maintains industrial data integrity metrics.",
            status="degraded",
            metrics=MicroserviceMetrics(latency=85, throughput=300, errorRate=0.15),
            host="quality-diagnosis-service",
            port=8082,
            protocol="http",
        ),
        Microservice(
            id="ms-2-1",
            name="Relation Analysis Engine",
            category=ServiceCategory.ANALYSIS_MODELING,
            description="Variable correlation and characteristic relationship mapping.",
            status="healthy",
            metrics=MicroserviceMetrics(latency=210, throughput=85, errorRate=0.05),
            host="relation-analysis-service",
            port=8083,
            protocol="http",
        ),
        Microservice(
            id="ms-2-2",
            name="AI Feature Extractor",
            category=ServiceCategory.ANALYSIS_MODELING,
            description="Machine learning based automated feature engineering.",
            status="healthy",
            metrics=MicroserviceMetrics(latency=450, throughput=25, errorRate=0.08),
            host="ai-feature-extractor-service",
            port=8084,
            protocol="http",
        ),
        Microservice(
            id="ms-2-3",
            name="Model Recommender",
            category=ServiceCategory.ANALYSIS_MODELING,
            description="Recommends optimal analytical models based on data profile.",
            status="healthy",
            metrics=MicroserviceMetrics(latency=120, throughput=150, errorRate=0.02),
            host="model-recommender-service",
            port=8085,
            protocol="http",
        ),
        Microservice(
            id="ms-3-1",
            name="Ontology Hub",
            category=ServiceCategory.STRUCTURE_VISUALIZATION,
            description="Metadata and semantic mapping for industrial domain knowledge.",
            status="healthy",
            metrics=MicroserviceMetrics(latency=32, throughput=900, errorRate=0.01),
            host="ontology-hub-service",
            port=8086,
            protocol="http",
        ),
        Microservice(
            id="ms-3-2",
            name="Semantic Visualizer",
            category=ServiceCategory.STRUCTURE_VISUALIZATION,
            description="Rich graphical representation of semantic data relationships.",
            status="healthy",
            metrics=MicroserviceMetrics(latency=55, throughput=2100, errorRate=0.04),
            host="semantic-visualizer-service",
            port=8087,
            protocol="http",
        ),
        Microservice(
            id="ms-3-3",
            name="Conversational UX Agent",
            category=ServiceCategory.STRUCTURE_VISUALIZATION,
            description="AI-driven natural language interface for data queries.",
            status="healthy",
            metrics=MicroserviceMetrics(latency=75, throughput=120, errorRate=0.03),
            host="conversational-ux-agent-service",
            port=8088,
            protocol="http",
        ),
    ]


def _seed_api_keys() -> list[ApiKey]:
    """초기 인증Key 데이터"""
    return [
        ApiKey(
            id="key-1",
            name="Production API Key",
            key="sk_live_1234567890abcdef",
            createdAt="2024-01-15",
            lastUsed="2024-01-20",
            status=ApiKeyStatus.ACTIVE,
            permissions=["read", "write"],
        ),
        ApiKey(
            id="key-2",
            name="Development API Key",
            key="sk_test_abcdef1234567890",
            createdAt="2024-01-10",
            lastUsed="2024-01-19",
            status=ApiKeyStatus.ACTIVE,
            permissions=["read"],
        ),
        ApiKey(
            id="key-3",
            name="Staging API Key",
            key="sk_staging_9876543210fedcba",
            createdAt="2024-01-12",
            lastUsed="2024-01-18",
            status=ApiKeyStatus.ACTIVE,
            permissions=["read", "write"],
        ),
        ApiKey(
            id="key-4",
            name="Revoked API Key",
            key="sk_revoked_abcdefghijklmnop",
            createdAt="2023-12-20",
            lastUsed="2024-01-05",
            status=ApiKeyStatus.REVOKED,
            permissions=["read", "write"],
        ),
    ]


def _seed_external_services() -> list[ExternalApiService]:
    """초기 외부 API 서비스 데이터"""
    return [
        ExternalApiService(
            id="svc-1",
            name="Data Collection API",
            endpoint="/api/v1/data/collect",
            status=ExternalApiServiceStatus.ALLOWED,
            rateLimit=1000,
            rateLimitWindowSeconds=3600,
            description="산업 데이터 수집 API",
            targetHost="data-collection-service",
            targetPort=8080,
            targetPath=None,
            protocol="http",
            targetServiceId=None,
        ),
        ExternalApiService(
            id="svc-2",
            name="Analytics API",
            endpoint="/api/v1/analytics",
            status=ExternalApiServiceStatus.LIMITED,
            rateLimit=500,
            rateLimitWindowSeconds=3600,
            description="데이터 분석 API",
            targetHost="analytics-service",
            targetPort=8081,
            targetPath="/api/analytics",
            protocol="http",
            targetServiceId=None,
        ),
        ExternalApiService(
            id="svc-3",
            name="Reporting API",
            endpoint="/api/v1/reporting",
            status=ExternalApiServiceStatus.ALLOWED,
            rateLimit=None,
            rateLimitWindowSeconds=None,
            description="리포트 생성 API (Rate Limit 없음)",
        ),
        ExternalApiService(
            id="svc-4",
            name="Legacy API",
            endpoint="/api/v1/legacy",
            status=ExternalApiServiceStatus.BLOCKED,
            rateLimit=None,
            rateLimitWindowSeconds=None,
            description="구버전 API (차단됨)",
        ),
        ExternalApiService(
            id="svc-5",
            name="Monitoring API",
            endpoint="/api/v1/monitoring",
            status=ExternalApiServiceStatus.LIMITED,
            rateLimit=200,
            rateLimitWindowSeconds=3600,
            description="시스템 모니터링 API",
        ),
    ]
