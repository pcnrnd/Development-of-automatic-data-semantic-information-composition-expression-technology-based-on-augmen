"""
앱 설정 - 환경 변수 기반.

NEO4J_PASS는 기본값을 제공하지 않습니다. 운영 자격증명이 코드에 박히는 것을
방지하기 위함이며, 미설정 상태에서는 Neo4j 연결 시도가 명시적으로 실패합니다.
로컬 개발 시에는 .env 또는 docker-compose의 environment에서 주입하세요.
"""
import os

NEO4J_URI = os.getenv("NEO4J_URI", "neo4j://127.0.0.1:7687")
NEO4J_USER = os.getenv("NEO4J_USER", "neo4j")
NEO4J_PASS = os.getenv("NEO4J_PASS", "passwd")  # 기본값 없음 — 미설정 시 연결 실패 의도

# 온톨로지 파일 로드 경로 (Docker 기본값)
ONTOLOGY_DIR = os.getenv("ONTOLOGY_DIR", "/app/ontology")
