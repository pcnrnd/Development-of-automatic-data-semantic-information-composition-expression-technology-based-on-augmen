# 데이터 시각화 및 증강 도구

이 프로젝트는 데이터 시각화와 증강 기능을 제공하는 웹 애플리케이션입니다. FastAPI 백엔드와 Streamlit 프론트엔드로 구성되어 있습니다.

## 🏗️ 프로젝트 구조

```
structure_vis/
├── backend/                    # FastAPI 백엔드 (데이터 증강 전용)
│   ├── main.py                # 메인 애플리케이션
│   ├── requirements.txt       # 백엔드 의존성
│   ├── api/                  # API 엔드포인트
│   │   ├── __init__.py
│   │   └── data_augmentation_api.py
│   ├── services/             # 서비스 레이어
│   │   ├── __init__.py
│   │   └── data_augmentation_service.py
│   └── lib/                  # 독립적인 라이브러리
│       ├── __init__.py
│       ├── data_augmentation.py
│       └── data_utils.py
├── frontend/                  # Streamlit 프론트엔드 (시각화 포함)
│   ├── structure_vis.py      # 메인 애플리케이션
│   ├── requirements.txt      # 프론트엔드 의존성
│   └── src/                  # 프론트엔드 모듈
│       ├── __init__.py
│       └── visualization.py  # 시각화 모듈
├── run_app.py                # 통합 실행 스크립트
├── scafold.py                # 개별 실행 스크립트
└── README.md                 # 프로젝트 문서
```

## 🚀 빠른 시작

### 1. 통합 실행 (권장)

```bash
cd structure_vis
python run_app.py
```

### 2. 개별 실행

#### 백엔드 실행
```bash
cd structure_vis/backend
pip install -r requirements.txt
python -m uvicorn main:app --host 0.0.0.0 --port 8000
```

#### 프론트엔드 실행
```bash
cd structure_vis/frontend
pip install -r requirements.txt
streamlit run structure_vis.py
```

#### 스캐폴드 사용
```bash
cd structure_vis
python scafold.py backend  # 백엔드만 실행
python scafold.py frontend # 프론트엔드만 실행
```

## 🌐 접속 정보

- **백엔드 API**: http://localhost:8000
- **API 문서**: http://localhost:8000/docs
- **프론트엔드**: http://localhost:8501

## 📊 주요 기능

### 데이터 증강 (Backend)
- **노이즈 추가**: 수치형 데이터에 랜덤 노이즈 추가
- **중복 생성**: 데이터 행 복제
- **SMOTE**: 불균형 데이터 처리
- **조합 증강**: 여러 방법을 조합한 증강

### 데이터 시각화 (Frontend)
- **히스토그램 비교**: 원본 vs 증강 데이터 분포 비교
- **박스플롯 비교**: 통계적 분포 비교
- **산점도 비교**: 두 변수 간 관계 비교
- **범주형 차트**: 막대그래프, 파이차트 등

### 데이터 분석
- **컬럼 타입 분석**: 수치형/범주형 자동 분류
- **데이터 미리보기**: 업로드된 데이터 확인
- **증강 통계**: 증강 전후 데이터 통계

## 🔧 기술 스택

### 백엔드
- **FastAPI**: 고성능 웹 프레임워크
- **Pandas**: 데이터 처리
- **NumPy**: 수치 계산
- **Scikit-learn**: 머신러닝 (SMOTE 등)

### 프론트엔드
- **Streamlit**: 웹 애플리케이션 프레임워크
- **Plotly**: 인터랙티브 차트
- **Requests**: HTTP 클라이언트
- **Pandas**: 데이터 처리

## 📋 API 엔드포인트

### 세션 기반 API (`/api`)
- `POST /data/upload`: 파일 업로드 및 세션 생성
- `GET /data/analyze/{session_id}`: 세션 데이터 분석
- `GET /data/preview/{session_id}`: 데이터 미리보기
- `POST /augmentation/process`: 데이터 증강 처리
- `GET /data/download/{session_id}`: 증강된 데이터 다운로드

### 기존 API (`/augmentation`)
- 기존 엔드포인트들도 유지하여 호환성 보장

## 💡 사용 예시

### 1. 데이터 업로드 및 분석
```python
import requests

# 파일 업로드
with open('data.csv', 'rb') as f:
    files = {'file': f}
    response = requests.post('http://localhost:8000/api/data/upload', files=files)
    session_id = response.json()['session_id']

# 데이터 분석
analysis = requests.get(f'http://localhost:8000/api/data/analyze/{session_id}').json()
```

### 2. 데이터 증강
```python
# 증강 파라미터 설정
params = {
    "session_id": session_id,
    "methods": ["noise", "duplicate"],
    "noise_level": 0.05,
    "augmentation_ratio": 0.5,
    "dup_count": 2
}

# 데이터 증강 실행
response = requests.post('http://localhost:8000/api/augmentation/process', json=params)
```

### 3. 시각화 (Frontend에서 처리)
```python
# Streamlit 앱에서 자동으로 처리됨
# 별도 API 호출 불필요
```

## 🔍 아키텍처

### 계층 구조
1. **API Layer**: HTTP 엔드포인트 제공 (Backend)
2. **Service Layer**: 비즈니스 로직 처리 (Backend)
3. **Library Layer**: 핵심 기능 구현 (독립적인 backend/lib)
4. **Visualization Layer**: 시각화 처리 (Frontend)

### 데이터 흐름
```
Frontend (Streamlit) → Backend API → Service Layer → Library Layer
                    ↓
              Visualization (Local)
```

### 역할 분담
- **Backend**: 데이터 증강, 세션 관리, API 제공
- **Frontend**: 시각화, 사용자 인터페이스, 데이터 표시

## 🛠️ 개발 환경 설정

### 필수 요구사항
- Python 3.8+
- pip

### 의존성 설치
```bash
# 백엔드 의존성
cd structure_vis/backend
pip install -r requirements.txt

# 프론트엔드 의존성
cd structure_vis/frontend
pip install -r requirements.txt
```

## 🔄 리팩토링 내용

### 주요 개선사항
1. **역할 분리**: Backend(증강) + Frontend(시각화)
2. **독립성 확보**: structure_vis 프로젝트 독립 관리
3. **코드 정리**: 사용하지 않는 파일 삭제
4. **의존성 최적화**: 독립적인 라이브러리 구조
5. **성능 개선**: 시각화를 로컬에서 처리하여 네트워크 오버헤드 감소

### 변경된 구조
- `frontend/app.py` 삭제 → `structure_vis.py` 단일 파일 사용
- `backend/lib/` 독립적인 라이브러리로 재구성
- `backend/visualization_api.py` 삭제 → `frontend/src/visualization.py`로 이동
- 세션 기반 API 추가로 대용량 데이터 처리 개선

## 🐛 문제 해결

### 백엔드 연결 오류
1. 백엔드 서버가 실행 중인지 확인
2. 포트 8000이 사용 가능한지 확인
3. CORS 설정 확인

### 의존성 오류
1. Python 버전 확인 (3.8+)
2. pip 업그레이드: `pip install --upgrade pip`
3. 가상환경 사용 권장

## 📝 라이센스

이 프로젝트는 MIT 라이센스 하에 배포됩니다.

## 🤝 기여하기

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## 📞 지원

문제가 발생하거나 질문이 있으시면 이슈를 생성해주세요. 