"""오케스트레이션 라우터 — 파이프라인 제어 + 실시간 로그 스트림."""
import asyncio
import random
from datetime import datetime

from fastapi import APIRouter, HTTPException, WebSocket, WebSocketDisconnect

from models.schemas import (
    Pipeline,
    PipelineActionResponse,
    PipelineLog,
    PipelineStatus,
    Worker,
)
from services import store

router = APIRouter(prefix="/api/orchestration", tags=["orchestration"])

_LOG_TEMPLATES = [
    ("INFO",  "센서 배치 파티션 커밋 완료. TX-{tx} (plant=deoksan/dt=2024-01-20)."),
    ("INFO",  "노드간 HDFS 복제 동기화 완료 — 복제팩터 3 유지 중."),
    ("INFO",  "품질 검증 통과 — 배치 #{n}건 (이상값 0건, 성공률 {rate}%)."),
    ("WARN",  "EQ-MOTOR-07 currT 채널 순간 지연 감지 (처리 지연 >10ms)."),
    ("INFO",  "PT100 온도 데이터 정규화 완료 — {n}개 레코드 콜드 스토리지 이관."),
    ("INFO",  "스키마 검증 통과 (sensors.deoksan_equipment): {n}개 레코드."),
    ("INFO",  "3상 전류/전압 불균형 검사 완료 — 정상 범위 내."),
    ("WARN",  "GU-NODE-B221 스토리지 사용률 87% 초과 — 아카이빙 우선순위 조정."),
]


def _now_str() -> str:
    return datetime.utcnow().strftime("%H:%M:%S.%f")[:11]


def _random_log() -> PipelineLog:
    t, msg_tpl = random.choice(_LOG_TEMPLATES)
    msg = msg_tpl.format(
        tx=random.randint(10000, 99999),
        n=random.randint(100, 999),
        rate=round(99.90 + random.uniform(0, 0.09), 2),
    )
    return PipelineLog(time=_now_str(), type=t, msg=msg)


# ─── REST ─────────────────────────────────────────────────────────────────────

@router.get("/pipelines", response_model=list[Pipeline])
def list_pipelines():
    return list(store.PIPELINES.values())


@router.get("/pipelines/{pipeline_id}", response_model=Pipeline)
def get_pipeline(pipeline_id: str):
    p = store.PIPELINES.get(pipeline_id)
    if not p:
        raise HTTPException(status_code=404, detail="Pipeline not found")
    return p


@router.post("/pipelines/{pipeline_id}/run", response_model=PipelineActionResponse)
def run_pipeline(pipeline_id: str):
    p = store.PIPELINES.get(pipeline_id)
    if not p:
        raise HTTPException(status_code=404, detail="Pipeline not found")
    p.status = PipelineStatus.running
    store.PIPELINE_LOGS.append(PipelineLog(time=_now_str(), type="INFO", msg=f"Pipeline {pipeline_id} started manually."))
    return PipelineActionResponse(pipeline_id=pipeline_id, action="run", success=True, message="Pipeline is now running.")


@router.post("/pipelines/{pipeline_id}/pause", response_model=PipelineActionResponse)
def pause_pipeline(pipeline_id: str):
    p = store.PIPELINES.get(pipeline_id)
    if not p:
        raise HTTPException(status_code=404, detail="Pipeline not found")
    p.status = PipelineStatus.paused
    store.PIPELINE_LOGS.append(PipelineLog(time=_now_str(), type="WARN", msg=f"Pipeline {pipeline_id} paused by user."))
    return PipelineActionResponse(pipeline_id=pipeline_id, action="pause", success=True, message="Pipeline paused.")


@router.post("/pipelines/{pipeline_id}/rollback", response_model=PipelineActionResponse)
def rollback_pipeline(pipeline_id: str):
    p = store.PIPELINES.get(pipeline_id)
    if not p:
        raise HTTPException(status_code=404, detail="Pipeline not found")
    p.status = PipelineStatus.idle
    store.PIPELINE_LOGS.append(PipelineLog(time=_now_str(), type="WARN", msg=f"Pipeline {pipeline_id} rolled back."))
    return PipelineActionResponse(pipeline_id=pipeline_id, action="rollback", success=True, message="Rollback complete.")


@router.get("/logs", response_model=list[PipelineLog])
def get_logs(limit: int = 50):
    return store.PIPELINE_LOGS[-limit:]


@router.get("/workers", response_model=list[Worker])
def get_workers():
    return store.WORKERS


# ─── WebSocket: 실시간 로그 스트림 ────────────────────────────────────────────

@router.websocket("/ws/logs")
async def logs_ws(websocket: WebSocket):
    """2초마다 새 로그 라인을 push."""
    await websocket.accept()
    try:
        # 초기 히스토리 전송
        for log in store.PIPELINE_LOGS[-10:]:
            await websocket.send_text(log.model_dump_json())
        while True:
            await asyncio.sleep(2)
            log = _random_log()
            store.PIPELINE_LOGS.append(log)
            await websocket.send_text(log.model_dump_json())
    except WebSocketDisconnect:
        pass
