"""거버넌스 라우터 — 데이터 소스, 필터링 규칙, 목적지 CRUD."""
import uuid

from fastapi import APIRouter, HTTPException

from models.schemas import (
    DataSource,
    DataSourceUpdate,
    Destination,
    FilterRule,
    FilterRuleCreate,
    GovernanceSummary,
)
from services import store

router = APIRouter(prefix="/api/governance", tags=["governance"])


# ─── Data Sources ─────────────────────────────────────────────────────────────

@router.get("/sources", response_model=list[DataSource])
def list_sources():
    return list(store.DATA_SOURCES.values())


@router.put("/sources/{source_id}", response_model=DataSource)
def update_source(source_id: str, body: DataSourceUpdate):
    src = store.DATA_SOURCES.get(source_id)
    if not src:
        raise HTTPException(status_code=404, detail="Source not found")
    src.active = body.active
    return src


# ─── Filtering Rules ──────────────────────────────────────────────────────────

@router.get("/rules", response_model=list[FilterRule])
def list_rules():
    return list(store.FILTER_RULES.values())


@router.post("/rules", response_model=FilterRule, status_code=201)
def create_rule(body: FilterRuleCreate):
    rule_id = f"rule-{uuid.uuid4().hex[:6]}"
    rule = FilterRule(id=rule_id, conditions=body.conditions, severity=body.severity)
    store.FILTER_RULES[rule_id] = rule
    return rule


@router.delete("/rules/{rule_id}", status_code=204)
def delete_rule(rule_id: str):
    if rule_id not in store.FILTER_RULES:
        raise HTTPException(status_code=404, detail="Rule not found")
    del store.FILTER_RULES[rule_id]


# ─── Destinations ─────────────────────────────────────────────────────────────

@router.get("/destinations", response_model=list[Destination])
def list_destinations():
    return store.DESTINATIONS


@router.put("/destinations/{dest_id}", response_model=Destination)
def toggle_destination(dest_id: str, active: bool):
    for dest in store.DESTINATIONS:
        if dest.id == dest_id:
            dest.active = active
            return dest
    raise HTTPException(status_code=404, detail="Destination not found")


# ─── Summary ──────────────────────────────────────────────────────────────────

@router.get("/summary", response_model=GovernanceSummary)
def get_summary():
    return GovernanceSummary(
        encryption="AES-256 비트 인플레이션 암호화 적용 중",
        retention_policy="핫 스토리지 30일 / 콜드 아카이브 7년",
        access_control="Role-based Access Control (RBAC) 활성화",
        health_score=98.4,
        ingestion_throughput_gbhr=4.2,
        data_quality_score=99.2,
        active_alerts=sum(1 for a in store.ALERTS if a.is_active),
    )
