"""
앱 설정 - 환경 변수 기반.
"""
import os

NEO4J_URI = os.getenv("NEO4J_URI", "neo4j://127.0.0.1:7687")
NEO4J_USER = os.getenv("NEO4J_USER", "neo4j")
NEO4J_PASS = os.getenv("NEO4J_PASS", "passwd")

# 온톨로지 파일 로드 경로 (Docker 기본값)
ONTOLOGY_DIR = os.getenv("ONTOLOGY_DIR", "/app/ontology")
