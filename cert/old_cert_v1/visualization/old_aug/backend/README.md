# 데이터 시각화 및 증강 FastAPI 백엔드

이 프로젝트는 데이터 시각화와 증강 기능을 제공하는 FastAPI 백엔드 서버입니다.

## 구조

```
backend/
├── main.py                          # FastAPI 메인 애플리케이션
├── requirements.txt                 # 의존성 패키지
├── api/                            # API 엔드포인트
│   ├── __init__.py
│   ├── visualization_api.py        # 시각화 API
│   └── data_augmentation_api.py    # 데이터 증강 API
├── services/                       # 서비스 레이어
│   ├── __init__.py
│   ├── visualization_service.py    # 시각화 서비스
│   └── data_augmentation_service.py # 데이터 증강 서비스
└── lib/                           # 핵심 라이브러리
    ├── __init__.py
    ├── visualization.py           # 시각화 기능
    ├── data_augmentation.py       # 데이터 증강 기능
    └── data_utils.py              # 데이터 유틸리티
```

## 아키텍처

- **API Layer**: FastAPI 라우터를 통해 HTTP 엔드포인트 제공
- **Service Layer**: 비즈니스 로직 처리 및 lib 모듈 호출
- **Library Layer**: 핵심 기능 구현 (시각화, 데이터 증강 등)

## 설치 및 실행

### 1. 의존성 설치
```bash
pip install -r requirements.txt
```

### 2. 서버 실행
```bash
python main.py
```

또는
```bash
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

### 3. API 문서 확인
- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

## 주요 엔드포인트

### 시각화 API (`/visualization`)
- `POST /upload-data`: 데이터 파일 업로드
- `POST /get-column-types`: 컬럼 타입 분석
- `POST /create-histogram-comparison`: 히스토그램 비교 차트
- `POST /create-boxplot-comparison`: 박스플롯 비교 차트
- `POST /create-scatter-comparison`: 산점도 비교 차트
- `POST /create-categorical-chart`: 범주형 차트
- `POST /create-comparison-dashboard`: 비교 대시보드
- `POST /get-comparison-summary`: 비교 요약 정보

### 데이터 증강 API (`/augmentation`)
- `GET /methods`: 사용 가능한 증강 방법 목록
- `POST /validate-params`: 증강 파라미터 검증
- `POST /preview`: 증강 결과 미리보기
- `POST /augment`: 데이터 증강 수행
- `POST /batch-augment`: 배치 증강 수행
- `GET /health`: 서비스 상태 확인

## 사용 예시

### 데이터 업로드
```python
import requests

# CSV 파일 업로드
with open('data.csv', 'rb') as f:
    files = {'file': f}
    response = requests.post('http://localhost:8000/visualization/upload-data', files=files)
    data = response.json()
```

### 데이터 증강
```python
import requests

# 증강 방법 목록 조회
response = requests.get('http://localhost:8000/augmentation/methods')
methods = response.json()

# 데이터 증강 수행
augmentation_data = {
    "data": your_data_list,
    "method": "조합 증강",
    "parameters": {
        "augmentation_ratio": 0.5,
        "noise_level": 0.05
    }
}
response = requests.post('http://localhost:8000/augmentation/augment', json=augmentation_data)
result = response.json()
```

### 시각화 생성
```python
import requests

# 히스토그램 비교 차트 생성
chart_data = {
    "original_data": original_data_list,
    "augmented_data": augmented_data_list,
    "column": "feature_name"
}
response = requests.post('http://localhost:8000/visualization/create-histogram-comparison', json=chart_data)
chart_result = response.json()
```

## 환경 설정

### 개발 환경
- Python 3.8+
- FastAPI 0.104.1
- Uvicorn 0.24.0

### 프로덕션 배포
프로덕션 환경에서는 다음 사항을 고려하세요:
- CORS 설정을 특정 도메인으로 제한
- 보안 헤더 추가
- 로깅 설정
- 데이터베이스 연결 (필요시)
- 캐싱 설정 (필요시)

## 라이센스

이 프로젝트는 MIT 라이센스 하에 배포됩니다. 