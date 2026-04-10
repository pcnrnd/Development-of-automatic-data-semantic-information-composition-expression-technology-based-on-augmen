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
    """설비 효율성 (OEE) 계산.

    OEE = 가용성(Availability) × 성능(Performance) × 품질(Quality)
    - 가용성: 완료된 작업지시 비율
    - 성능: 실적수량 / 계획수량 평균 (0~1로 클리핑)
    - 품질: 양품 비율 (계획수량 이상 + 완료 상태)
    실제 운영 OEE 정의와는 다를 수 있으므로 도메인에 맞게 보정 필요.
    """
    rows = neo4j_run("""
    MATCH (w:WorkOrder)-[:executedBy]->(e:Equipment {uri: $equipment_id})
    RETURN
        count(w) AS totalOrders,
        sum(w.plannedQuantity) AS plannedQuantity,
        sum(w.actualQuantity) AS actualQuantity,
        avg(CASE WHEN w.status = 'completed' THEN 1.0 ELSE 0.0 END) AS availability,
        avg(CASE
            WHEN w.plannedQuantity > 0
            THEN CASE WHEN toFloat(w.actualQuantity) / w.plannedQuantity > 1.0
                      THEN 1.0
                      ELSE toFloat(w.actualQuantity) / w.plannedQuantity END
            ELSE 0.0 END) AS performance,
        avg(CASE WHEN w.status = 'completed' AND w.actualQuantity >= w.plannedQuantity THEN 1.0 ELSE 0.0 END) AS quality
    """, equipment_id=equipment_id)
    if rows and rows[0]["totalOrders"]:
        data = dict(rows[0])
        a = data.get("availability") or 0.0
        p = data.get("performance") or 0.0
        q = data.get("quality") or 0.0
        data["oee"] = a * p * q
        return {"efficiency": data}
    return {"efficiency": None}
