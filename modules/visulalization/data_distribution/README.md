# 데이터 분포 분석 앱 백엔드 분리 완료

## 프로젝트 구조
```
visulalization/data_distribution/
├── backend/                    # FastAPI 백엔드
│   ├── main.py                # FastAPI 앱 진입점
│   ├── api/
│   │   └── analysis.py        # 데이터 분석 API 라우터
│   ├── services/
│   │   ├── data_quality.py   # 데이터 품질 분석 로직
│   │   ├── outlier_detection.py # 이상값 탐지 로직
│   │   └── distribution.py    # 분포 분석 로직
│   ├── models/
│   │   └── schemas.py         # Pydantic 스키마
│   └── requirements.txt       # 백엔드 의존성
├── frontend/                   # Streamlit 프론트엔드
│   ├── app.py                 # Streamlit 앱 (API 호출)
│   └── requirements.txt       # 프론트엔드 의존성
└── dist.py                    # 원본 파일 (참고용)
```

## 실행 방법

### 1. 백엔드 서버 실행
```bash
cd visulalization/data_distribution/backend
pip install -r requirements.txt
uvicorn main:app --reload --port 8002
```

### 2. 프론트엔드 실행
```bash
cd visulalization/data_distribution/frontend
pip install -r requirements.txt
streamlit run app.py
```

## 주요 변경사항

### 백엔드 (FastAPI)
- **API 엔드포인트**: `/api/upload`, `/api/analyze/*` 시리즈
- **메모리 기반 세션**: 업로드된 데이터를 세션 ID로 관리
- **서비스 모듈 분리**: 데이터 품질, 이상값 탐지, 분포 분석 로직 분리
- **scipy 제거**: pandas의 skew() 메서드로 대체

### 프론트엔드 (Streamlit)
- **API 호출 방식**: 백엔드 API를 통해 분석 수행
- **시각화 유지**: 기존 Plotly 시각화는 프론트엔드에서 직접 처리
- **세션 관리**: Streamlit session_state와 백엔드 세션 동기화

## API 엔드포인트

1. `POST /api/upload` - CSV 파일 업로드 및 세션 생성
2. `POST /api/analyze/quality` - 데이터 품질 분석
3. `POST /api/analyze/outliers` - 이상값 탐지
4. `POST /api/analyze/distribution` - 분포 특성 분석
5. `POST /api/analyze/correlation` - 상관관계 분석
6. `POST /api/analyze/statistics` - 통계 정보

## 기술 스택
- **백엔드**: FastAPI, pandas, numpy
- **프론트엔드**: Streamlit, Plotly, requests
- **세션 관리**: 메모리 기반 (별도 DB 불필요)
