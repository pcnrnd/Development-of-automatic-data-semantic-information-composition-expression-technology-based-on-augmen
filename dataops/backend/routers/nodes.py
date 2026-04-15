"""노드 관리 라우터 — 노드 목록, 클러스터 현황, 에러 로그, 재시작."""
import asyncio
import random

from fastapi import APIRouter, HTTPException, WebSocket, WebSocketDisconnect

from models.schemas import (
    ClusterRegion,
    Node,
    NodeActionResponse,
    NodeErrorLog,
    NodeStatus,
)
from services import store

router = APIRouter(prefix="/api/nodes", tags=["nodes"])


# ─── REST ─────────────────────────────────────────────────────────────────────

@router.get("", response_model=list[Node])
def list_nodes(status: str | None = None):
    nodes = list(store.NODES.values())
    if status:
        nodes = [n for n in nodes if n.status.value.lower() == status.lower()]
    return nodes


@router.get("/{node_id}", response_model=Node)
def get_node(node_id: str):
    node = store.NODES.get(node_id)
    if not node:
        raise HTTPException(status_code=404, detail="Node not found")
    return node


@router.post("/{node_id}/restart", response_model=NodeActionResponse)
def restart_node(node_id: str):
    node = store.NODES.get(node_id)
    if not node:
        raise HTTPException(status_code=404, detail="Node not found")
    # 재시작 시뮬레이션: Critical → Healthy로 복구
    if node.status == NodeStatus.critical:
        node.status = NodeStatus.healthy
        node.storage_usage_pct = max(node.storage_usage_pct - 20, 50)
        node.cpu_pct = random.uniform(10, 30)
        node.memory_pct = random.uniform(30, 60)
    return NodeActionResponse(node_id=node_id, action="restart", success=True, message=f"Node {node_id} restart initiated.")


@router.get("/clusters/regions", response_model=list[ClusterRegion])
def get_regions():
    return store.CLUSTER_REGIONS


@router.get("/logs/errors", response_model=list[NodeErrorLog])
def get_error_logs():
    return store.NODE_ERROR_LOGS


# ─── 노드 상태 요약 ────────────────────────────────────────────────────────────

@router.get("/summary/health")
def get_health_summary():
    nodes = list(store.NODES.values())
    total = len(nodes)
    healthy = sum(1 for n in nodes if n.status == NodeStatus.healthy)
    warning = sum(1 for n in nodes if n.status == NodeStatus.warning)
    critical = sum(1 for n in nodes if n.status == NodeStatus.critical)
    avg_storage = round(sum(n.storage_usage_pct for n in nodes) / total, 1) if total else 0
    health_score = round((healthy / total) * 100 - (critical * 5), 1) if total else 0
    return {
        "total": total,
        "healthy": healthy,
        "warning": warning,
        "critical": critical,
        "avg_storage_pct": avg_storage,
        "health_score": health_score,
        "balancing_pct": 74,
    }


# ─── WebSocket: 노드 실시간 상태 ──────────────────────────────────────────────

@router.websocket("/ws")
async def nodes_ws(websocket: WebSocket):
    """3초마다 노드 목록의 CPU/메모리를 변동시켜 push."""
    await websocket.accept()
    try:
        while True:
            for node in store.NODES.values():
                if node.status == NodeStatus.healthy:
                    node.cpu_pct = round(random.uniform(5, 30), 1)
                    node.memory_pct = round(random.uniform(20, 50), 1)
                elif node.status == NodeStatus.warning:
                    node.cpu_pct = round(random.uniform(50, 80), 1)
                    node.memory_pct = round(random.uniform(70, 90), 1)
            payload = [n.model_dump() for n in store.NODES.values()]
            import json
            await websocket.send_text(json.dumps(payload, default=str))
            await asyncio.sleep(3)
    except WebSocketDisconnect:
        pass
