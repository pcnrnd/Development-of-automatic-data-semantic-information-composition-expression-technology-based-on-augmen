# 데이터 증강 및 시각화 도구

이 프로젝트는 다양한 데이터 타입(CSV, 이미지, 시계열)에 대한 증강 및 시각화 기능을 제공하는 Streamlit 기반 웹 애플리케이션입니다.

## 🏗️ 프로젝트 구조

```
visualization/
├── lib/                           # 공통 라이브러리 모듈
│   ├── __init__.py               # 패키지 초기화
│   ├── data_augmentation.py      # CSV 데이터 증강 클래스
│   ├── image_augmentation.py     # 이미지 증강 클래스
│   ├── timeseries_augmentation.py # 시계열 데이터 증강 클래스
│   ├── visualization.py          # 데이터 시각화 클래스
│   └── data_utils.py             # 데이터 유틸리티 클래스
├── csv_prepro/
│   └── csv_vis.py                # CSV 데이터 처리 앱
├── img_prepro/
│   └── img_prepro.py             # 이미지 처리 앱
├── time_prepro/
│   └── time_prepro.py            # 시계열 데이터 처리 앱
├── quantitative_goal.py          # 정량적 목표 분석 앱
├── requirements.txt              # 의존성 패키지
└── README.md                     # 프로젝트 문서
```

## 📚 라이브러리 모듈 (lib/)

### 1. DataAugmenter (`data_augmentation.py`)
CSV 데이터 증강을 위한 클래스입니다.

**주요 기능:**
- 수치형 컬럼에 노이즈 추가
- 행 중복 추가
- 랜덤 행 삭제
- 클래스 불균형 데이터 증강 (SMOTE, RandomOverSampler, RandomUnderSampler)

**사용 예시:**
```python
from lib import DataAugmenter

augmenter = DataAugmenter()
df_augmented = augmenter.augment(df, "수치형 컬럼에 노이즈 추가", noise_level=0.01)
```

### 2. ImageAugmenter (`image_augmentation.py`)
이미지 증강을 위한 클래스입니다.

**주요 기능:**
- 회전, 좌우 반전
- 밝기, 대비, 색조 조절
- 노이즈 추가
- 히스토그램 생성
- 이미지 그리드 표시

**사용 예시:**
```python
from lib import ImageAugmenter

image_augmenter = ImageAugmenter()
augmented_img = image_augmenter.augment_image(img, rotation=45, brightness=1.2)
```

### 3. TimeSeriesAugmenter (`timeseries_augmentation.py`)
시계열 데이터 증강을 위한 클래스입니다.

**주요 기능:**
- 가우시안 노이즈 추가
- 시계열 이동 (Shift)
- 리샘플링 (Resample)
- 스케일링
- 윈도우 평균

**사용 예시:**
```python
from lib import TimeSeriesAugmenter

timeseries_augmenter = TimeSeriesAugmenter()
df_augmented = timeseries_augmenter.augment_timeseries(df, "date", "가우시안 노이즈 추가", noise_level=0.01)
```

### 4. DataVisualizer (`visualization.py`)
데이터 시각화를 위한 클래스입니다.

**주요 기능:**
- 히스토그램, 박스플롯 (수치형 데이터)
- 막대그래프, 파이차트 (범주형 데이터)
- 산점도, 라인차트
- 클래스 분포 비교

**사용 예시:**
```python
from lib import DataVisualizer

visualizer = DataVisualizer()
fig = visualizer.create_numeric_visualization(df, "column_name", "히스토그램")
```

### 5. DataUtils (`data_utils.py`)
데이터 유틸리티 기능을 위한 클래스입니다.

**주요 기능:**
- CSV 파일 로드
- 데이터 정보 표시
- 결측값 분석
- 데이터 유효성 검사
- 다운로드 버튼 생성

**사용 예시:**
```python
from lib import DataUtils

df = DataUtils.load_csv_file(uploaded_file)
DataUtils.display_data_info(df)
```

## 🚀 실행 방법

### 1. 의존성 설치
```bash
pip install -r requirements.txt
```

### 2. 애플리케이션 실행

#### CSV 데이터 처리
```bash
streamlit run csv_prepro/csv_vis.py
```

#### 이미지 데이터 처리
```bash
streamlit run img_prepro/img_prepro.py
```

#### 시계열 데이터 처리
```bash
streamlit run time_prepro/time_prepro.py
```

#### 정량적 목표 분석
```bash
streamlit run quantitative_goal.py
```

## 🔧 추상화의 장점

### 1. 코드 재사용성
- 공통 기능들이 `lib/` 모듈로 분리되어 여러 앱에서 재사용 가능
- 중복 코드 제거로 유지보수성 향상

### 2. 확장성
- 새로운 증강 방법이나 시각화 기능을 쉽게 추가 가능
- 기존 코드 수정 없이 새로운 기능 확장

### 3. 일관성
- 모든 앱에서 동일한 인터페이스 사용
- 사용자 경험의 일관성 보장

### 4. 테스트 용이성
- 각 클래스별로 독립적인 테스트 작성 가능
- 단위 테스트 및 통합 테스트 용이

## 📦 지원하는 데이터 형식

### CSV 데이터
- 수치형 데이터: 히스토그램, 박스플롯
- 범주형 데이터: 막대그래프, 파이차트
- 클래스 불균형 데이터: SMOTE, RandomOverSampler, RandomUnderSampler

### 이미지 데이터
- PNG, JPG, JPEG 형식
- 회전, 반전, 밝기/대비/색조 조절
- 노이즈 추가
- 히스토그램 분석

### 시계열 데이터
- 날짜/시간 컬럼 자동 감지
- 노이즈 추가, 시계열 이동, 리샘플링
- 라인차트 시각화

## 🤝 기여하기

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## 📄 라이선스

이 프로젝트는 MIT 라이선스 하에 배포됩니다. 