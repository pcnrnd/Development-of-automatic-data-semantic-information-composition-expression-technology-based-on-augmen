"""
그래프 조회 API (Cytoscape 요소, 프로세스 플로우, 설비 계층).
"""
import logging
import traceback
from fastapi import APIRouter, Query, HTTPException

from db.neo4j import neo4j_run

router = APIRouter(prefix="/graph", tags=["graph"])


@router.get("/elements")
def graph_elements(limit: int = Query(100, ge=1, le=1000)):
    """Cytoscape.js용 노드/엣지 elements JSON."""
    try:
        rows = neo4j_run("""
        MATCH (n)-[r]->(m)
        RETURN id(n) AS sid,
               labels(n) AS sTypes,
               coalesce(n.`rdfs__label`, n.name, head(labels(n))) AS sLabel,
               type(r) AS rel,
               id(m) AS tid,
               labels(m) AS tTypes,
               coalesce(m.`rdfs__label`, m.name, head(labels(m))) AS tLabel
        LIMIT $limit
        """, limit=limit)
        if not rows:
            return {"elements": []}
        nodes = {}
        edges = []
        for row in rows:
            sid, tid = f"n{row['sid']}", f"n{row['tid']}"
            nodes[sid] = {"data": {"id": sid, "label": row["sLabel"] or "node", "types": row.get("sTypes", [])}}
            nodes[tid] = {"data": {"id": tid, "label": row["tLabel"] or "node", "types": row.get("tTypes", [])}}
            edges.append({"data": {"id": f"{sid}->{tid}:{row['rel']}", "source": sid, "target": tid, "label": row["rel"]}})
        return {"elements": list(nodes.values()) + edges}
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error in graph_elements: {e}\n{traceback.format_exc()}")
        return {"elements": []}


@router.get("/process-flow/{process_id}")
def get_process_flow(process_id: str):
    """프로세스 플로우 조회."""
    rows = neo4j_run("""
    MATCH (p:Process {uri: $process_id})-[:precedes*]->(ops:Operation)
    RETURN ops.uri AS operationId,
           ops.`rdfs__label` AS operationName,
           ops.precedes AS nextOperation
    """, process_id=process_id)
    return {"processFlow": [dict(row) for row in rows]}


@router.get("/equipment-hierarchy")
def get_equipment_hierarchy():
    """설비 계층구조 조회."""
    rows = neo4j_run("""
    MATCH (parent:Equipment)-[:hasPart]->(child:Equipment)
    RETURN parent.uri AS parentId,
           parent.`rdfs__label` AS parentName,
           child.uri AS childId,
           child.`rdfs__label` AS childName
    """)
    return {"hierarchy": [dict(row) for row in rows]}
