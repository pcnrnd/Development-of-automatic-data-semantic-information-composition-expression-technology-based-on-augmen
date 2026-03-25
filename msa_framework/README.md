# Industrial Data Nexus - MSA Framework Demo

## 개요
- **프론트엔드**: Next.js(App Router) - `frontend/`
- **백엔드**: FastAPI(in-memory 데모) - `backend/`
- **연동**: Next `/api/*` → FastAPI 프록시

## 로컬 실행(필수 2개 터미널)

### 1) 백엔드(FastAPI) 실행
```bash
# miniforge/industry 가상환경 활성화(또는 python 3.10+ 환경)
mamba activate industry   # 또는 conda activate industry

# 의존성 설치(처음만)
cd backend
pip install -r requirements.txt

# 서버 실행(프로젝트 루트에서)
python -m uvicorn app.main:app --reload --port 8001 --app-dir backend
```

→ FastAPI가 `http://localhost:8001`에서 실행됨

### 2) 프론트엔드(Next) 실행
```bash
cd frontend

# 의존성 설치(처음만)
npm install

# .env.local 생성(중요: FastAPI 주소 설정)
# frontend/.env.local 파일을 만들고 아래 내용 추가:
FASTAPI_BASE_URL=http://localhost:8001

# 개발 서버 실행
npm run dev
```

→ Next가 `http://localhost:3000`에서 실행됨

### 3) 브라우저 접속
- **`http://localhost:3000`** 접속
- "System Dashboard" 탭: 마이크로서비스 상태/지표(API 기반)
- "System Architecture" 탭: 인프라 노드 맵(API 기반)

## 데모 시나리오
- **기본 조회**: 대시보드/아키텍처 화면에서 API 데이터 렌더링 확인
- **상태 변경(POST)**: 백엔드 API로 서비스 상태를 임의로 변경 가능
  ```bash
  # 예: "ms-1-3" 서비스를 degraded로 변경
  curl -X POST http://localhost:8001/v1/microservices/ms-1-3/actions/degrade
  
  # 복구
  curl -X POST http://localhost:8001/v1/microservices/ms-1-3/actions/recover
  ```
- 프론트를 새로고침하면 변경된 상태가 대시보드에 반영됨

## 주요 API 엔드포인트
- `GET /healthz` - 헬스체크
- `GET /v1/infra/nodes` - 인프라 노드 리스트
- `GET /v1/microservices` - 마이크로서비스 리스트
- `POST /v1/microservices/{id}/actions/degrade` - 서비스 상태를 degraded로
- `POST /v1/microservices/{id}/actions/recover` - 서비스 상태를 healthy로
- `POST /v1/microservices/{id}/actions/traffic` - latency/throughput/errorRate 조정
- `GET /v1/observability/events` - 최근 상태 변경 이벤트