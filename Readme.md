# Industrial Data Platform

증강 분석 기반 산업 데이터 상태 진단 및 개선을 위한 데이터 시맨틱 정보 자동 구성/표현 기술 개발

---

## 프로젝트 구성

```
ontology/          제조 MES 온톨로지 플랫폼
msa_framework/     마이크로서비스 프레임워크
modules/           공통 모듈 (전처리, 증강, 모델 추천 등)
data/              샘플 데이터셋
poc/               PoC 및 실험 코드
```

---

## msa_framework — 마이크로서비스 모니터링 플랫폼

마이크로서비스 플랫폼
- 도메인 레이어 분리 구조의 백엔드 REST API 서버
- 컴포넌트 기반 프론트엔드 SPA

```
msa_framework/
├── backend/
│   └── app/
│       ├── api/        API 라우터
│       ├── core/       설정 및 의존성
│       ├── domain/     도메인 모델
│       └── store/      인메모리 데이터 저장소
└── frontend/
    └── src/
        ├── components/ UI 컴포넌트
        ├── hooks/      커스텀 훅
        └── lib/        유틸리티
```

**주요 기능**
- 마이크로서비스 헬스·트래픽 상태 실시간 모니터링
- 인프라 노드 맵 시각화
- 상태 변경 이벤트 로그

**실행**
```bash
# 백엔드
cd msa_framework/backend
pip install -r requirements.txt
python -m uvicorn app.main:app --reload --port 8001 --app-dir backend

# 프론트엔드
cd msa_framework/frontend
npm install && npm run dev
# http://localhost:3000
```

---

## ontology — 제조 온톨로지 플랫폼

제조 설비·공정 데이터를 지식 그래프로 구성·분석하는 플랫폼
- 라우터·서비스 레이어 구조의 백엔드
- 온톨로지 시각화 SPA 프론트엔드
- Docker Compose 기반 전체 스택 구동

```
ontology/
├── ontology-compose.yaml
└── app/
    ├── backend/
    │   ├── db/         그래프 DB 연동
    │   ├── models/     데이터 스키마
    │   ├── routers/    API 라우터
    │   └── services/   비즈니스 로직 (AutoML 포함)
    └── ontology-platform/
        ├── components/ 그래프 시각화 컴포넌트
        ├── services/   API 클라이언트
        └── utils/      유틸리티
```

**주요 기능**
- OWL/RDF 온톨로지 검증·임포트 및 Triple CRUD
- 제조 라인·작업지시·품질·설비 상태 관리
- 품질 트렌드 분석, OEE(설비 종합효율) 계산
- 다중 머신러닝 모델 비교 기반 AutoML (분류/회귀)

**실행**
```bash
# Docker Compose로 전체 스택 구동 (DB + 백엔드 + 프론트엔드)
docker compose -f ontology/ontology-compose.yaml up
# 프론트엔드: http://localhost:3001
# 백엔드 API: http://localhost:8001
```
