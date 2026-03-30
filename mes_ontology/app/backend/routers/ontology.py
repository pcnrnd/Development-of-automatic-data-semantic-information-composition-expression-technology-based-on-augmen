"""
온톨로지 검증·임포트 및 Triple CRUD API.
"""
from typing import Optional
from fastapi import APIRouter, UploadFile, File, HTTPException
from rdflib import Graph
from pyshacl import validate

from db.neo4j import neo4j_run
from models.schemas import ImportResult, Triple, BulkTripleOperation

router = APIRouter(prefix="/ontology", tags=["ontology"])


@router.post("/validate-and-import", response_model=ImportResult)
async def validate_and_import(
    data_ttl: UploadFile = File(...),
    shapes_ttl: UploadFile = File(...),
):
    """SHACL 검증 후 Neo4j n10s로 임포트."""
    data_bytes = await data_ttl.read()
    shapes_bytes = await shapes_ttl.read()
    data_g = Graph().parse(data=data_bytes.decode("utf-8"), format="turtle")
    shapes_g = Graph().parse(data=shapes_bytes.decode("utf-8"), format="turtle")
    conforms, report_graph, report_text = validate(
        data_g, shacl_graph=shapes_g, inference="rdfs", serialize_report_graph=True
    )
    if not conforms:
        return ImportResult(triplesLoaded=0, validationConforms=False, report=report_text)
    res = neo4j_run("""
    CALL n10s.rdf.import.inline($ttl, "Turtle")
    YIELD terminationStatus, triplesLoaded
    RETURN terminationStatus AS status, triplesLoaded AS count
    """, ttl=data_bytes.decode("utf-8"))
    count = res[0]["count"] if res else 0
    return ImportResult(triplesLoaded=count, validationConforms=True)


@router.post("/triples")
def create_triple(triple: Triple):
    """관계(Triple) 추가."""
    try:
        neo4j_run("""
        MATCH (s:Resource {uri: $subject})
        MATCH (o:Resource {uri: $object})
        CALL apoc.create.relationship(s, $predicate, {}, o) YIELD rel
        RETURN rel
        """, subject=triple.subject, predicate=triple.predicate, object=triple.object)
        return {"message": "Triple created successfully"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/triples")
def get_triples(
    subject: Optional[str] = None,
    predicate: Optional[str] = None,
    object: Optional[str] = None,
):
    """관계 조회."""
    where_clauses = []
    params = {}
    if subject:
        where_clauses.append("s.uri = $subject")
        params["subject"] = subject
    if predicate:
        where_clauses.append("type(r) = $predicate")
        params["predicate"] = predicate
    if object:
        where_clauses.append("o.uri = $object")
        params["object"] = object
    where_clause = " AND ".join(where_clauses) if where_clauses else "1=1"
    rows = neo4j_run(f"""
    MATCH (s)-[r]->(o)
    WHERE {where_clause}
    RETURN s.uri AS subject, type(r) AS predicate, o.uri AS object,
           coalesce(s.`rdfs__label`, s.name) AS subject_label,
           coalesce(o.`rdfs__label`, o.name) AS object_label
    """, **params)
    return {"triples": [dict(row) for row in rows]}


@router.delete("/triples")
def delete_triple(triple: Triple):
    """관계 삭제."""
    try:
        result = neo4j_run("""
        MATCH (s:Resource {uri: $subject})-[r]->(o:Resource {uri: $object})
        WHERE type(r) = $predicate
        DELETE r
        RETURN count(r) AS deleted
        """, subject=triple.subject, predicate=triple.predicate, object=triple.object)
        if result and result[0]["deleted"] > 0:
            return {"message": "Triple deleted successfully"}
        raise HTTPException(status_code=404, detail="Triple not found")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/nodes/{node_id}")
def delete_node(node_id: str):
    """노드 삭제 (관련 관계 모두 삭제)."""
    try:
        result = neo4j_run("""
        MATCH (n:Resource {uri: $node_id})
        DETACH DELETE n
        RETURN count(n) AS deleted
        """, node_id=node_id)
        if result and result[0]["deleted"] > 0:
            return {"message": "Node and all related relationships deleted successfully"}
        raise HTTPException(status_code=404, detail="Node not found")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/triples/bulk")
def bulk_triple_operation(operation: BulkTripleOperation):
    """Triple 벌크 추가/삭제."""
    results = {"added": 0, "deleted": 0, "errors": []}
    for triple in operation.add:
        try:
            neo4j_run("""
            MATCH (s:Resource {uri: $subject})
            MATCH (o:Resource {uri: $object})
            CALL apoc.create.relationship(s, $predicate, {}, o) YIELD rel
            RETURN rel
            """, subject=triple.subject, predicate=triple.predicate, object=triple.object)
            results["added"] += 1
        except Exception as e:
            results["errors"].append(f"Add error: {str(e)}")
    for triple in operation.delete:
        try:
            neo4j_run("""
            MATCH (s:Resource {uri: $subject})-[r]->(o:Resource {uri: $object})
            WHERE type(r) = $predicate
            DELETE r
            """, subject=triple.subject, predicate=triple.predicate, object=triple.object)
            results["deleted"] += 1
        except Exception as e:
            results["errors"].append(f"Delete error: {str(e)}")
    return results
