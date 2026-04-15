# Backend (FastAPI) - Industrial Data Gateway Demo

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

## JWT (액세스 토큰)
- `JWT_SECRET` (필수): HS256 서명용 비밀 문자열. 미설정 시 `POST /v1/auth/token` 은 503.
- `JWT_ALGORITHM` (선택, 기본 `HS256`), `ACCESS_TOKEN_EXPIRE_MINUTES` (선택, 기본 60).
- `POST /v1/auth/token`: `grant_type=api_key` + `api_key` 로 활성 API Key 교환, 또는 `grant_type=password` + `username`/`password` (이때 `JWT_AUTH_USERNAME`, `JWT_AUTH_PASSWORD` 필요).
- `GET /v1/auth/me`: `Authorization: Bearer` 로 토큰 검증 데모.

## 주요 엔드포인트
- `GET /healthz`
- `GET /v1/infra/nodes`
- `GET /v1/microservices`
- `POST /v1/microservices/{id}/actions/degrade`
- `POST /v1/microservices/{id}/actions/recover`
- `POST /v1/microservices/{id}/actions/traffic`
- `GET /v1/observability/events`
- `POST /v1/auth/token`, `GET /v1/auth/me`

