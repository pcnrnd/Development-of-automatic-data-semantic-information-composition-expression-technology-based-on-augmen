# AutoML Test 프로젝트 기술문서

## 📋 프로젝트 개요

AutoML Test 프로젝트는 자동화된 머신러닝 모델 학습과 비교를 위한 웹 애플리케이션입니다. FastAPI 백엔드와 Streamlit 프론트엔드로 구성되어 있으며, 분류, 회귀, 군집화 작업을 지원합니다.

## 🏗️ 아키텍처

```
automl_test/
├── back/                    # 백엔드 (FastAPI)
│   ├── api/                # API 엔드포인트
│   │   └── train.py        # 기본 AutoML API
│   ├── services/           # AutoML 서비스 로직
│   │   ├── clf_automl.py  # 분류 모델 서비스
│   │   ├── reg_automl.py  # 회귀 모델 서비스
│   │   └── cluster_automl.py # 군집화 모델 서비스
│   └── main.py            # FastAPI 애플리케이션 진입점
└── front/                  # 프론트엔드 (Streamlit)
    ├── app.py             # 메인 Streamlit 애플리케이션
    └── lib/               # 라이브러리 모듈
        ├── template.py    # UI 템플릿
        ├── prepro.py      # 데이터 전처리
        ├── research_prepro_engine.py # 데이터 특성 기반 추천 엔진
        └── visualization_engine.py   # 시각화 엔진
```

## 🚀 주요 기능

### 1. 자동화된 머신러닝 모델 비교
- **분류 (Classification)**: 13개 모델 지원
  - Random Forest, AdaBoost, Gradient Boosting
  - K-Nearest Neighbors, CatBoost, XGBoost
  - Gaussian Naive Bayes, SVM, Logistic Regression
  - Decision Tree, Extra Trees, LightGBM, MLP

- **회귀 (Regression)**: 13개 모델 지원
  - Random Forest, AdaBoost, Gradient Boosting
  - K-Nearest Neighbors, CatBoost, XGBoost
  - Linear Regression, Ridge, Lasso, ElasticNet
  - Decision Tree, Extra Trees, LightGBM, MLP

- **군집화 (Clustering)**: 6개 모델 지원
  - K-Means, DBSCAN, Agglomerative Clustering
  - Spectral Clustering, Gaussian Mixture, Birch

### 2. 데이터 특성 기반 전처리
- 자동 결측값 처리
- 수치형 데이터 필터링
- Label Encoding 지원
- 데이터 검증 및 오류 처리

### 3. 데이터 전처리
- 자동 결측값 처리
- 수치형 데이터 필터링
- Label Encoding 지원
- 데이터 검증 및 오류 처리

### 4. 시각화 및 분석
- 데이터 탐색적 분석 (EDA)
- 모델 성능 비교 시각화
- 데이터 특성 기반 추천 시스템
- 인터랙티브 대시보드

### 5. 지능형 추천 시스템
- **데이터 특성 기반 전처리 추천**: 데이터 분포, 카디널리티, 이상치 특성 분석 기반 규칙
- **자동 시각화 추천**: 데이터 특성 기반 최적 차트 선택
- **모델 선택 가이드**: 데이터 특성에 따른 최적 모델 추천

## 🔧 기술 스택

### 백엔드
- **FastAPI**: 고성능 웹 프레임워크
- **scikit-learn**: 머신러닝 라이브러리
- **pandas**: 데이터 처리
- **numpy**: 수치 계산
- **CatBoost, XGBoost, LightGBM**: 그래디언트 부스팅 라이브러리

### 프론트엔드
- **Streamlit**: 데이터 과학 웹 애플리케이션 프레임워크
- **Plotly**: 인터랙티브 시각화
- **pandas**: 데이터 처리

## 📊 API 엔드포인트

### 기본 AutoML API (`/automl`)

#### 분류 모델 학습
```http
POST /automl/classification
Content-Type: application/json

{
  "json_data": "데이터프레임 JSON 문자열",
  "target": "타겟 컬럼명"
}
```

#### 회귀 모델 학습
```http
POST /automl/regression
Content-Type: application/json

{
  "json_data": "데이터프레임 JSON 문자열",
  "target": "타겟 컬럼명"
}
```

#### 군집화 모델 학습
```http
POST /automl/clustering
Content-Type: application/json

{
  "json_data": "데이터프레임 JSON 문자열"
}
```



## 🛠️ 설치 및 실행

### 1. 의존성 설치
```bash
pip install -r requirements.txt
```

### 2. 백엔드 서버 실행
```bash
cd automl_test/back
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

### 3. 프론트엔드 실행
```bash
cd automl_test/front
streamlit run app.py
```

## 📈 모델 성능 평가

### 분류 모델 평가 지표
- **Accuracy**: 정확도
- **Precision**: 정밀도
- **Recall**: 재현율
- **F1-Score**: F1 점수 (weighted)

### 회귀 모델 평가 지표
- **R² Score**: 결정 계수
- **Mean Squared Error**: 평균 제곱 오차
- **Mean Absolute Error**: 평균 절대 오차
- **Root Mean Squared Error**: 평균 제곱근 오차

### 군집화 모델 평가 지표
- **Silhouette Score**: 실루엣 점수
- **Calinski-Harabasz Index**: 칼린스키-하라바즈 지수
- **Davies-Bouldin Index**: 데이비스-볼딘 지수

## 🔍 데이터 처리 파이프라인

1. **데이터 업로드**: CSV 파일 업로드
2. **데이터 검증**: 타겟 컬럼 존재 여부 확인
3. **지능형 전처리**: 연구 기반 규칙 시스템을 통한 자동 전처리
4. **모델 학습**: 다중 모델 병렬 학습
5. **성능 평가**: 교차 검증을 통한 성능 측정
6. **결과 시각화**: 데이터 특성 기반 자동 시각화

## 🧠 지능형 추천 시스템

### 1. 데이터 특성 기반 전처리 추천 시스템

#### 데이터 특성 분석
- **수치형 데이터**: 분포 특성(왜도, 첨도), 변동성, 이상치 비율 분석
- **범주형 데이터**: 카디널리티, 균형성, 텍스트 패턴 분석
- **날짜/시간 데이터**: 시간 패턴, 시계열 특성 분석

#### 데이터 특성 기반 전처리 규칙 적용
```yaml
# 수치형 데이터 전처리 규칙
numeric:
  distribution_analysis:
    - {skew: 4, kurt: 20, action: "yeo_johnson_transform"}
    - {skew: 2.5, kurt: 10, action: "boxcox_transform"}
    - {skew: 1.8, action: "log_transform"}
    - {skew_lt: 0.5, kurt_lt: 1, action: "no_transform_needed"}

  scaling_strategy:
    - {cv_gt: 1.5, outlier_ratio_gt: 0.1, action: "robust_scaler"}
    - {cv_gt: 1.0, outlier_ratio_lt: 0.05, action: "standard_scaler"}
    - {cv_lt: 0.3, action: "min_max_scaler"}

# 범주형 데이터 전처리 규칙
categorical:
  cardinality_strategy:
    - {lte: 2, action: "binary_encode"}
    - {lte: 5, action: "one_hot_encode"}
    - {lte: 15, action: "one_hot_encode"}
    - {lte: 50, action: "ordinal_encode"}
    - {lte: 200, action: "target_encode"}
    - {gt: 200, action: "feature_hashing"}
```

#### 도메인 특화 규칙
- **측정값**: level, rate, ratio, score, index 패턴 인식
- **카운트 데이터**: count, number 패턴에 sqrt 변환 적용
- **비율/확률**: prob, percent 패턴에 logit/arcsin 변환 적용
- **시간 데이터**: time, date, hour, day, month 패턴 인식
- **상태/범주**: status, type, category 패턴에 ordinal 인코딩 적용

### 2. 자동 시각화 추천 시스템

#### 데이터 특성 기반 차트 선택
```yaml
# 수치형 데이터 시각화 규칙
numeric:
  distribution_analysis:
    - {skew: 4, kurt: 20, primary_chart: "Violin Plot"}
    - {skew: 2.5, kurt: 10, primary_chart: "Box Plot"}
    - {skew: 1.8, primary_chart: "Histogram with KDE"}
    - {skew_lt: 0.5, kurt_lt: 1, primary_chart: "Q-Q Plot"}

  outlier_detection:
    - {outlier_ratio_gt: 0.05, chart: "Box Plot"}
    - {outlier_ratio_gt: 0.10, chart: "Scatter Plot with Outliers"}

# 범주형 데이터 시각화 규칙
categorical:
  cardinality_strategy:
    - {lte: 2, primary_chart: "Bar Chart"}
    - {lte: 5, primary_chart: "Bar Chart"}
    - {lte: 15, primary_chart: "Bar Chart"}
    - {lte: 50, primary_chart: "Horizontal Bar Chart"}
    - {lte: 200, primary_chart: "Top N Bar Chart"}
```

#### 도메인 특화 시각화
- **측정값**: Line Plot, Log Scale Plot, Histogram
- **카운트 데이터**: Bar Chart, Histogram
- **비율/확률**: Beta Distribution Plot, Pie Chart
- **시간 데이터**: Time Series Plot, Circular Histogram
- **상태/범주**: Bar Chart, Pie Chart

### 3. 데이터 특성 기반 모델 선택 가이드

#### 데이터 특성 분석 기반 모델 추천
- **분류 문제**:
  - **데이터 크기**: 
    - 소규모 데이터 (< 1K): SVM, Logistic Regression
    - 중간 규모 데이터 (1K-10K): Random Forest, XGBoost
    - 대규모 데이터 (> 10K): LightGBM, CatBoost
  - **특성 수**:
    - 저차원 (< 10): SVM, Logistic Regression
    - 중차원 (10-100): Random Forest, XGBoost
    - 고차원 (> 100): MLP, SVM with RBF
  - **클래스 불균형**:
    - 균형 데이터: Random Forest, XGBoost
    - 불균형 데이터: AdaBoost, Gradient Boosting
  - **특성 상관관계**:
    - 높은 상관관계: Lasso, Ridge, ElasticNet
    - 낮은 상관관계: Random Forest, XGBoost

- **회귀 문제**:
  - **데이터 분포**:
    - 정규분포: Linear Regression, Ridge
    - 비정규분포: Random Forest, XGBoost
  - **이상치 비율**:
    - 낮은 이상치 (< 5%): Linear Regression, Ridge
    - 높은 이상치 (> 10%): Random Forest, Robust Regression
  - **특성 중요도**:
    - 중요도 균등: Random Forest, XGBoost
    - 중요도 불균등: Linear Regression, Lasso

- **군집화 문제**:
  - **클러스터 형태**:
    - 구형 클러스터: K-Means, Gaussian Mixture
    - 비정형 클러스터: DBSCAN, Spectral Clustering
  - **데이터 밀도**:
    - 균등 밀도: K-Means, Agglomerative Clustering
    - 불균등 밀도: DBSCAN, OPTICS
  - **데이터 크기**:
    - 소규모 (< 1K): 모든 알고리즘
    - 대규모 (> 10K): Mini-Batch K-Means, Birch

#### 데이터 특성 기반 성능 평가 지표 선택
- **분류 평가**:
  - **균형 데이터**: Accuracy, F1-Score
  - **불균형 데이터**: Precision, Recall, F1-Weighted
  - **다중 클래스**: Macro/Micro F1-Score
- **회귀 평가**:
  - **정규분포 오차**: R², MSE
  - **비정규분포 오차**: MAE, RMSE
  - **이상치 많은 데이터**: Robust 평가 지표
- **군집화 평가**:
  - **구형 클러스터**: Silhouette Score
  - **비정형 클러스터**: Calinski-Harabasz Index
  - **고차원 데이터**: Davies-Bouldin Index

## 🎯 제조 산업 사용 시나리오

### 1. 분류 문제
- **품질 불량 예측**: 제품 불량 여부를 사전에 예측하여 불량률 감소
- **설비 고장 예측**: 장비 고장 가능성을 예측하여 예방 정비 실시
- **원자재 품질 분류**: 원자재 등급을 자동으로 분류하여 품질 관리
- **안전 사고 위험 분류**: 작업 환경 위험도를 분류하여 안전 사고 예방

### 2. 회귀 문제
- **생산량 예측**: 시장 수요에 따른 최적 생산량 예측
- **에너지 소비량 예측**: 설비별 에너지 사용량 예측으로 비용 최적화
- **제품 수명 예측**: 제품의 예상 수명을 예측하여 보증 정책 수립
- **원가 예측**: 제품별 생산 원가를 예측하여 가격 정책 수립

### 3. 군집화 문제
- **설비 그룹화**: 유사한 특성을 가진 설비들을 그룹화하여 관리 효율화
- **제품 라인 세분화**: 제품 특성에 따른 생산 라인 최적화
- **공정 이상 탐지**: 정상 공정과 이상 공정을 구분하여 품질 관리
- **공급업체 분류**: 공급업체 특성에 따른 등급 분류 및 관리

### 4. 제조 특화 시나리오

#### 품질 관리 (Quality Control)
- **불량률 예측**: 생산 공정 데이터를 분석하여 불량 발생 가능성 예측
- **품질 특성 분석**: 제품 품질에 영향을 미치는 주요 요인 식별
- **검사 최적화**: 샘플링 검사 대신 전체 검사가 필요한 제품 식별

#### 예방 정비 (Predictive Maintenance)
- **설비 상태 모니터링**: 센서 데이터를 분석하여 설비 상태 실시간 추적
- **고장 원인 분석**: 설비 고장의 주요 원인과 패턴 분석
- **정비 일정 최적화**: 설비별 최적 정비 시점 예측

#### 공급망 관리 (Supply Chain Management)
- **수요 예측**: 제품별 시장 수요를 정확히 예측하여 재고 최적화
- **공급업체 평가**: 공급업체 성과를 데이터 기반으로 평가
- **운송 최적화**: 배송 경로와 운송 수단을 최적화하여 비용 절감

#### 생산 계획 (Production Planning)
- **생산 능력 분석**: 설비별 생산 능력을 정확히 평가하여 계획 수립
- **작업 일정 최적화**: 작업 순서와 시간을 최적화하여 효율성 증대
- **자원 할당**: 인력, 설비, 원자재의 최적 배분으로 생산성 향상

#### 에너지 관리 (Energy Management)
- **에너지 효율성 분석**: 설비별 에너지 사용 효율성 평가
- **피크 시간 예측**: 에너지 사용량이 최대가 되는 시간대 예측
- **비용 최적화**: 에너지 사용 패턴을 분석하여 비용 절감 방안 도출

## 🔧 설정 및 커스터마이징

### 모델 하이퍼파라미터 조정
각 서비스 파일(`clf_automl.py`, `reg_automl.py`, `cluster_automl.py`)에서 모델별 하이퍼파라미터를 수정할 수 있습니다.

### 평가 지표 변경
```python
# 분류 모델의 경우
scoring_methods = ['accuracy', 'precision', 'recall', 'f1_weighted']

# 회귀 모델의 경우
scoring_methods = ['r2', 'neg_mean_squared_error', 'neg_mean_absolute_error']
```

### 새로운 모델 추가
각 서비스 클래스에 새로운 모델 메서드를 추가하고 `run_*_models()` 메서드의 모델 딕셔너리에 등록하면 됩니다.

### 추천 규칙 커스터마이징

#### 데이터 특성 기반 전처리 규칙 수정
`front/lib/research_prepro_rules.yaml` 파일에서 전처리 규칙을 수정할 수 있습니다:

```yaml
# 새로운 전처리 규칙 추가
numeric:
  custom_rules:
    - {condition: "your_condition", action: "your_action", why: "explanation"}
```

#### 시각화 규칙 수정
`front/lib/visualization_rules.yaml` 파일에서 시각화 규칙을 수정할 수 있습니다:

```yaml
# 새로운 시각화 규칙 추가
numeric:
  custom_visualization:
    - {condition: "your_condition", chart: "your_chart", why: "explanation"}
```

#### 도메인 특화 규칙 추가
```yaml
# 특정 도메인에 대한 규칙 추가
domain_specific:
  - {name_contains: "your_pattern", action: "your_action", why: "explanation"}
```

## 🐛 문제 해결

### 일반적인 오류

1. **타겟 컬럼 오류**
   - 해결: 데이터에 타겟 컬럼이 존재하는지 확인
   - 해결: 타겟 컬럼이 올바른 데이터 타입인지 확인

2. **메모리 부족**
   - 해결: 데이터 크기 축소
   - 해결: 모델 수 줄이기

3. **학습 시간 초과**
   - 해결: 데이터 샘플링
   - 해결: 모델 하이퍼파라미터 조정

4. **제조 데이터 특화 오류**
   - 해결: 센서 데이터 형식 검증
   - 해결: 시계열 데이터 전처리 확인

### 로그 확인
```bash
# 백엔드 로그
tail -f automl_test/back/logs/app.log

# 프론트엔드 로그
streamlit run app.py --logger.level debug
```

## 📝 개발 가이드

### 새로운 모델 추가하기

1. **서비스 파일에 모델 메서드 추가**
```python
def new_model(self):
    """새로운 모델을 정의합니다."""
    try:
        model = NewModelClassifier(parameters)
        scores = cross_val_score(model, self.X, self.y, cv=self.cv, scoring=self.scoring)
        return scores.mean()
    except Exception as e:
        logger.error(f"New Model 학습 실패: {e}")
        return 0.0
```

2. **모델 딕셔너리에 등록**
```python
models = {
    'existing_model': self.existing_model,
    'new_model': self.new_model,  # 새로 추가
}
```

### API 엔드포인트 추가하기

1. **새로운 라우터 생성**
```python
@router.post('/new_endpoint')
async def new_endpoint(request: Request):
    # 엔드포인트 로직
    pass
```

2. **메인 앱에 등록**
```python
app.include_router(new_router, prefix="/automl", tags=["new"])
```

### 추천 시스템 확장하기

#### 새로운 데이터 특성 기반 전처리 규칙 추가
```python
def _apply_custom_rules(self, col: str, s: pd.Series) -> List[Tuple[str, str]]:
    """사용자 정의 데이터 특성 기반 전처리 규칙 적용"""
    rec: List[Tuple[str, str]] = []
    
    # 데이터 특성 분석
    data_characteristics = self._analyze_data_characteristics(s)
    
    # 사용자 정의 조건 검사
    if your_condition(data_characteristics):
        rec.append(("custom_action", "custom_explanation"))
    
    return rec
```

#### 새로운 데이터 특성 기반 시각화 규칙 추가
```python
def _apply_custom_visualization_rules(self, col: str, s: pd.Series) -> List[Tuple[str, str]]:
    """사용자 정의 데이터 특성 기반 시각화 규칙 적용"""
    rec: List[Tuple[str, str]] = []
    
    # 데이터 특성 분석
    data_characteristics = self._analyze_data_characteristics(s)
    
    # 사용자 정의 조건 검사
    if your_condition(data_characteristics):
        rec.append(("custom_chart", "custom_explanation"))
    
    return rec
```

## 📊 제조 산업 데이터 예시

### 센서 데이터 형식
```csv
timestamp,temperature,pressure,vibration,quality_label
2024-01-01 08:00:00,25.5,101.3,0.02,good
2024-01-01 08:01:00,25.6,101.4,0.03,good
2024-01-01 08:02:00,25.8,101.2,0.05,defect
```

### 공정 데이터 형식
```csv
product_id,process_time,temperature,humidity,operator_id,quality_score
P001,120.5,24.2,45.3,OP001,95.2
P002,118.3,24.5,44.8,OP002,92.1
P003,125.1,23.8,46.1,OP001,88.5
```

### 설비 상태 데이터 형식
```csv
equipment_id,timestamp,runtime_hours,maintenance_due,status
EQ001,2024-01-01 08:00:00,1250.5,2024-01-15,operational
EQ002,2024-01-01 08:00:00,890.2,2024-01-10,warning
EQ003,2024-01-01 08:00:00,2100.8,2024-01-05,maintenance
```


## 📋 단계별 사용 가이드

### 1단계: 데이터 준비
1. **데이터 수집**: 센서, 공정, 설비 데이터 수집
2. **데이터 정제**: 결측값, 이상치 처리
3. **데이터 형식 변환**: CSV 형식으로 변환

### 2단계: 시스템 실행
1. **백엔드 서버 시작**: `uvicorn main:app --reload --host 0.0.0.0 --port 8000`
2. **프론트엔드 실행**: `streamlit run app.py`
3. **데이터 업로드**: CSV 파일 업로드

### 3단계: 데이터 분석
1. **데이터 탐색**: EDA를 통한 데이터 특성 파악
2. **타겟 변수 선택**: 예측하고자 하는 변수 선택
3. **특성 선택**: 관련 특성들 선택

### 4단계: 모델 학습
1. **모델 유형 선택**: 분류, 회귀, 군집화 중 선택
2. **자동 학습 실행**: 시스템이 자동으로 최적 모델 선택
3. **결과 확인**: 모델 성능 및 예측 결과 확인

### 5단계: 결과 활용
1. **모델 성능 평가**: 다양한 지표로 모델 성능 평가
2. **예측 결과 해석**: 비즈니스 관점에서 결과 해석
3. **실제 적용**: 예측 모델을 실제 제조 공정에 적용

## 📚 참고 자료

- [FastAPI 공식 문서](https://fastapi.tiangolo.com/)
- [Streamlit 공식 문서](https://docs.streamlit.io/)
- [scikit-learn 공식 문서](https://scikit-learn.org/)


