"""
제조 데이터 관리 API (라인, 작업지시, 품질, 설비).
"""
from datetime import datetime
from fastapi import APIRouter, HTTPException

from db.neo4j import neo4j_run
from models.schemas import WorkOrder, QualityControl

router = APIRouter(prefix="/manufacturing", tags=["manufacturing"])


@router.get("/lines")
def get_manufacturing_lines():
    """제조 라인 목록 조회."""
    rows = neo4j_run("""
    MATCH (e:Equipment)
    WHERE e.uri CONTAINS 'Equipment'
    RETURN e.uri AS id,
           coalesce(e.`rdfs__label`, e.name, 'Unnamed Equipment') AS name,
           labels(e) AS types
    """)
    return {"lines": [dict(row) for row in rows]}


@router.get("/lines/{line_id}")
def get_manufacturing_line(line_id: str):
    """특정 제조 라인 상세 조회."""
    rows = neo4j_run("""
    MATCH (e:Equipment {uri: $line_id})
    OPTIONAL MATCH (e)-[r]->(related)
    RETURN e, r, related
    """, line_id=line_id)
    if not rows:
        raise HTTPException(status_code=404, detail="Line not found")
    return {"line": dict(rows[0])}


@router.get("/work-orders")
def get_work_orders():
    """작업지시서 목록 조회."""
    rows = neo4j_run("""
    MATCH (w:WorkOrder)
    OPTIONAL MATCH (w)-[:executedBy]->(e:Equipment)
    RETURN w.uri AS id,
           w.workOrderNumber AS workOrderNumber,
           w.plannedQuantity AS plannedQuantity,
           w.actualQuantity AS actualQuantity,
           w.status AS status,
           coalesce(e.`rdfs__label`, e.name) AS equipmentName
    """)
    return {"workOrders": [dict(row) for row in rows]}


@router.post("/work-orders")
def create_work_order(work_order: WorkOrder):
    """작업지시서 생성."""
    work_order_id = f"ex:WO_{work_order.workOrderNumber}"
    neo4j_run("""
    CREATE (w:WorkOrder {
        uri: $id,
        workOrderNumber: $workOrderNumber,
        plannedQuantity: $plannedQuantity,
        actualQuantity: $actualQuantity,
        status: $status
    })
    """,
    id=work_order_id,
    workOrderNumber=work_order.workOrderNumber,
    plannedQuantity=work_order.plannedQuantity,
    actualQuantity=work_order.actualQuantity,
    status=work_order.status)
    if work_order.equipment_id:
        neo4j_run("""
        MATCH (w:WorkOrder {uri: $workOrderId})
        MATCH (e:Equipment {uri: $equipmentId})
        CREATE (w)-[:executedBy]->(e)
        """, workOrderId=work_order_id, equipmentId=work_order.equipment_id)
    return {"id": work_order_id, "message": "Work order created successfully"}


@router.get("/quality/{product_id}")
def get_quality_data(product_id: str):
    """제품 품질 데이터 조회."""
    rows = neo4j_run("""
    MATCH (p:Product {uri: $product_id})-[:hasQuality]->(q:QualityControl)
    RETURN q.uri AS id, q.qualityResult AS qualityResult, q.timestamp AS timestamp
    """, product_id=product_id)
    return {"qualityData": [dict(row) for row in rows]}


@router.post("/quality")
def create_quality_data(quality: QualityControl):
    """품질 데이터 생성."""
    quality_id = f"ex:QC_{quality.product_id}_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
    neo4j_run("""
    MATCH (p:Product {uri: $productId})
    CREATE (q:QualityControl {
        uri: $qualityId,
        qualityResult: $qualityResult,
        timestamp: $timestamp
    })
    CREATE (p)-[:hasQuality]->(q)
    """,
    productId=quality.product_id,
    qualityId=quality_id,
    qualityResult=quality.qualityResult,
    timestamp=quality.timestamp)
    return {"id": quality_id, "message": "Quality data created successfully"}


@router.get("/equipment/{equipment_id}/status")
def get_equipment_status(equipment_id: str):
    """설비 상태 조회."""
    rows = neo4j_run("""
    MATCH (e:Equipment {uri: $equipment_id})
    OPTIONAL MATCH (e)-[:hasMaintenance]->(m:Maintenance)
    RETURN e.uri AS id, e.status AS status,
           m.timestamp AS lastMaintenance,
           m.maintenanceType AS maintenanceType
    ORDER BY m.timestamp DESC
    LIMIT 1
    """, equipment_id=equipment_id)
    if not rows:
        raise HTTPException(status_code=404, detail="Equipment not found")
    return {"equipment": dict(rows[0])}


@router.get("/equipment/{equipment_id}/maintenance-history")
def get_maintenance_history(equipment_id: str):
    """설비 유지보수 이력 조회."""
    rows = neo4j_run("""
    MATCH (e:Equipment {uri: $equipment_id})-[:hasMaintenance]->(m:Maintenance)
    RETURN m.uri AS id, m.maintenanceType AS maintenanceType, m.timestamp AS timestamp
    ORDER BY m.timestamp DESC
    """, equipment_id=equipment_id)
    return {"maintenanceHistory": [dict(row) for row in rows]}
