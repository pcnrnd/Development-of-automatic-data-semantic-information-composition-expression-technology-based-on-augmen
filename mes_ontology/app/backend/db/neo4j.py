"""
Neo4j 연결 및 쿼리 실행. n10s 설정·온톨로지 로드 포함.
"""
import os
import glob
from fastapi import HTTPException
from neo4j import GraphDatabase
from neo4j.exceptions import ServiceUnavailable, AuthError, TransientError

from config import NEO4J_URI, NEO4J_USER, NEO4J_PASS, ONTOLOGY_DIR

driver = None

try:
    driver = GraphDatabase.driver(NEO4J_URI, auth=(NEO4J_USER, NEO4J_PASS))
    driver.verify_connectivity()
    print(f"Neo4j connected successfully to {NEO4J_URI}")
except Exception as e:
    print(f"Warning: Neo4j connection failed: {e}")
    driver = None


def _try_connect_neo4j():
    """Neo4j 연결 시도. 성공 시 driver 반환, 실패 시 None. (lazy reconnection용)"""
    try:
        d = GraphDatabase.driver(NEO4J_URI, auth=(NEO4J_USER, NEO4J_PASS))
        d.verify_connectivity()
        return d
    except Exception:
        return None


def neo4j_run(cypher: str, **params):
    """Neo4j 쿼리 실행. driver가 None이면 한 번 재연결 시도."""
    global driver
    if driver is None:
        driver = _try_connect_neo4j()
        if driver is not None:
            print(f"Neo4j reconnected successfully to {NEO4J_URI}")
        else:
            raise HTTPException(
                status_code=503,
                detail="Neo4j driver is not initialized. Please check the connection."
            )
    try:
        with driver.session() as s:
            result = s.run(cypher, **params)
            return list(result)
    except ServiceUnavailable as e:
        raise HTTPException(status_code=503, detail=f"Neo4j service unavailable: {str(e)}")
    except AuthError as e:
        raise HTTPException(status_code=401, detail=f"Neo4j authentication failed: {str(e)}")
    except TransientError as e:
        raise HTTPException(status_code=503, detail=f"Neo4j transient error: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Neo4j query error: {str(e)}")


def ensure_n10s_config():
    """n10s 설정 초기화 (안전한 방식)."""
    try:
        result = neo4j_run("CALL n10s.graphconfig.show()")
        if result:
            print("n10s already configured, skipping initialization")
            return
    except Exception:
        pass
    try:
        neo4j_run("""
        CALL n10s.graphconfig.init({
          handleVocabUris: "SHORTEN", keepLangTag: false, typesToLabels: true
        })
        """)
        print("n10s configuration initialized successfully")
    except Exception as e:
        if "non-empty" not in str(e):
            print(f"Warning: n10s configuration failed: {e}")
    try:
        neo4j_run("CREATE CONSTRAINT n10s_uri IF NOT EXISTS FOR (r:Resource) REQUIRE r.uri IS UNIQUE")
    except Exception as e:
        print(f"Warning: Constraint creation failed: {e}")


def load_ontology_files():
    """온톨로지 파일들을 자동으로 로딩."""
    if not os.path.exists(ONTOLOGY_DIR):
        return
    ttl_files = [
        f for f in glob.glob(os.path.join(ONTOLOGY_DIR, "*.ttl"))
        if not os.path.basename(f).lower().startswith("shapes")
    ]
    for ttl_file in ttl_files:
        try:
            with open(ttl_file, "r", encoding="utf-8") as f:
                ttl_content = f.read()
            neo4j_run("""
            CALL n10s.rdf.import.inline($ttl, "Turtle")
            YIELD terminationStatus, triplesLoaded
            RETURN terminationStatus AS status, triplesLoaded AS count
            """, ttl=ttl_content)
            print(f"Loaded ontology file: {os.path.basename(ttl_file)}")
        except Exception as e:
            print(f"Error loading {ttl_file}: {e}")
