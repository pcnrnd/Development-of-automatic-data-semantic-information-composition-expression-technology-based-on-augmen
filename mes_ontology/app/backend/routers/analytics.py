"""
분석 API (품질 트렌드, 설비 효율 OEE).
"""
from fastapi import APIRouter, HTTPException

from db.neo4j import neo4j_run

router = APIRouter(prefix="/analytics", tags=["analytics"])


@router.get("/quality-trend")
def get_quality_trend(period: str = "7d"):
    """품질 트렌드 분석."""
    rows = neo4j_run("""
    MATCH (q:QualityControl)
    WHERE q.timestamp >= datetime() - duration('P7D')
    RETURN date(q.timestamp) AS date,
           q.qualityResult AS result,
           count(*) AS count
    ORDER BY date
    """)
    return {"trend": [dict(row) for row in rows]}


@router.get("/equipment-efficiency/{equipment_id}")
def get_equipment_efficiency(equipment_id: str):
    """설비 효율성 (OEE) 계산."""
    rows = neo4j_run("""
    MATCH (e:Equipment {uri: $equipment_id})-[:executedBy]<-()-[w:WorkOrder]
    RETURN
        count(w) AS totalOrders,
        sum(w.plannedQuantity) AS plannedQuantity,
        sum(w.actualQuantity) AS actualQuantity,
        avg(CASE WHEN w.status = 'completed' THEN 1.0 ELSE 0.0 END) AS availability,
        avg(CASE WHEN w.actualQuantity >= w.plannedQuantity THEN 1.0 ELSE 0.0 END) AS performance,
        avg(CASE WHEN w.status = 'completed' AND w.actualQuantity >= w.plannedQuantity THEN 1.0 ELSE 0.0 END) AS quality
    """, equipment_id=equipment_id)
    if rows:
        data = dict(rows[0])
        data["oee"] = data["availability"] * data["performance"] * data["quality"]
        return {"efficiency": data}
    return {"efficiency": None}
