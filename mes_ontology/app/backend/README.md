# Manufacturing Ontology API (Backend)

FastAPI 기반 제조 온톨로지·제조 데이터·분석 API입니다.

## 구조 (리팩토링 후)

- **main.py** — 앱 진입점, CORS, 전역 예외 처리, 라우터 등록
- **config.py** — 환경 변수 (NEO4J_URI, NEO4J_USER, NEO4J_PASS, ONTOLOGY_DIR)
- **db/neo4j.py** — Neo4j 연결, `neo4j_run`, n10s 설정, 온톨로지 파일 로드
- **models/schemas.py** — Pydantic 요청/응답 모델
- **routers/** — API 라우터
  - **ontology.py** — 검증·임포트, Triple CRUD
  - **graph.py** — 그래프 요소, 프로세스 플로우, 설비 계층
  - **manufacturing.py** — 라인, 작업지시, 품질, 설비 상태·보전 이력
  - **analytics.py** — 품질 트렌드, 설비 효율(OEE)
  - **automl.py** — scikit-learn 기반 AutoML (`POST /automl/fit`)
- **services/automl.py** — 다중 모델 비교·최적 모델 도출 (분류/회귀)

## 실행

```bash
pip install -r requirements.txt
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

Docker:

```bash
docker build -t ontology-backend .
docker run -p 8000:8000 --env-file .env ontology-backend
```

## AutoML API

- **POST /automl/fit** — body: `{ "features": [[...]], "target": [...], "task": "classification"|"regression", "cv": 3 }`  
  - 산업데이터(features, target)로 여러 scikit-learn 모델을 비교해 최적 모델명·검증 점수 반환.
