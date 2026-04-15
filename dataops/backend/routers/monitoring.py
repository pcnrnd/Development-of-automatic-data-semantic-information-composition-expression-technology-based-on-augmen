"""모니터링 라우터 — 실시간 메트릭(WebSocket) + REST."""
import asyncio
import json

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from models.schemas import Alert, SystemMetrics, ThroughputPoint
from services import metrics as metrics_svc
from services import store

router = APIRouter(prefix="/api/monitoring", tags=["monitoring"])


@router.get("/metrics", response_model=SystemMetrics)
def get_metrics():
    """현재 시스템 메트릭 1회 조회."""
    return metrics_svc.get_system_metrics()


@router.get("/throughput", response_model=list[ThroughputPoint])
def get_throughput(points: int = 40):
    """네트워크 처리량 시계열 데이터."""
    return metrics_svc.get_throughput_series(points)


@router.get("/alerts", response_model=list[Alert])
def get_alerts(active_only: bool = False):
    alerts = store.ALERTS
    if active_only:
        alerts = [a for a in alerts if a.is_active]
    return alerts


@router.put("/alerts/{alert_id}/resolve", response_model=Alert)
def resolve_alert(alert_id: str):
    for alert in store.ALERTS:
        if alert.id == alert_id:
            alert.is_active = False
            return alert
    from fastapi import HTTPException
    raise HTTPException(status_code=404, detail="Alert not found")


# ─── WebSocket: 실시간 메트릭 스트림 ──────────────────────────────────────────

@router.websocket("/ws")
async def metrics_ws(websocket: WebSocket):
    """1초마다 시스템 메트릭을 JSON으로 push."""
    await websocket.accept()
    try:
        while True:
            m = metrics_svc.get_system_metrics()
            await websocket.send_text(m.model_dump_json())
            await asyncio.sleep(1)
    except WebSocketDisconnect:
        pass
