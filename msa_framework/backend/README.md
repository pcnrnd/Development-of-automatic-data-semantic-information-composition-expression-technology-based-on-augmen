# Backend (FastAPI) - Industrial Data Nexus Demo

## 목적
- `frontend/` UI가 호출할 데모용 API를 제공합니다.
- 상태는 **in-memory**라서 서버 재시작 시 초기화됩니다.

## 실행(로컬)
의존성 설치:

```bash
python -m pip install -r requirements.txt
```

서버 실행(프로젝트 루트에서):

```bash
python -m uvicorn app.main:app --reload --port 8000 --app-dir backend
```

## 주요 엔드포인트
- `GET /healthz`
- `GET /v1/infra/nodes`
- `GET /v1/microservices`
- `POST /v1/microservices/{id}/actions/degrade`
- `POST /v1/microservices/{id}/actions/recover`
- `POST /v1/microservices/{id}/actions/traffic`
- `GET /v1/observability/events`

