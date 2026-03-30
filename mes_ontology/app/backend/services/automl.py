"""
scikit-learn 기반 간단 AutoML: 여러 모델을 비교해 최적 모델·점수 반환.
산업데이터에 적합한 모델 도출용 (분류/회귀).
"""
from typing import Any, List, Optional, Literal
import numpy as np
from sklearn.model_selection import cross_val_score
from sklearn.preprocessing import StandardScaler
from sklearn.pipeline import Pipeline
from sklearn.linear_model import LogisticRegression, Ridge
from sklearn.ensemble import RandomForestClassifier, RandomForestRegressor, GradientBoostingClassifier, GradientBoostingRegressor
from sklearn.neighbors import KNeighborsClassifier, KNeighborsRegressor
from sklearn.svm import SVC, SVR

# 분류용 후보 (5개)
CLASSIFIERS = [
    ("LogisticRegression", LogisticRegression(max_iter=1000)),
    ("RandomForest", RandomForestClassifier(n_estimators=50, random_state=42)),
    ("SVC", SVC(kernel="rbf", random_state=42)),
    ("KNN", KNeighborsClassifier()),
    ("GradientBoosting", GradientBoostingClassifier(n_estimators=50, random_state=42)),
]
# 회귀용 후보 (5개)
REGRESSORS = [
    ("Ridge", Ridge()),
    ("RandomForest", RandomForestRegressor(n_estimators=50, random_state=42)),
    ("SVR", SVR(kernel="rbf")),
    ("KNN", KNeighborsRegressor()),
    ("GradientBoosting", GradientBoostingRegressor(n_estimators=50, random_state=42)),
]

# 전처리·시각화 추천용 상수 (매직 넘버 제거)
MISSING_RATIO_THRESHOLD = 0.01
HIGH_FEATURE_COUNT = 10
MAX_RECOMMEND_ITEMS = 5
MAX_CLASSES_FOR_CONFUSION = 10
MAX_SAMPLES_FOR_CONFUSION = 5000
CLASS_IMBALANCE_RATIO_THRESHOLD = 5.0
DEFAULT_PREPROCESSING = ["StandardScaler", "이상치 IQR 클리핑"]
DEFAULT_VISUALIZATION = ["산점도", "상관관계 히트맵"]


def _get_pipeline(name: str, estimator: Any) -> Pipeline:
    """스케일링 + 추정기 파이프라인."""
    return Pipeline([
        ("scaler", StandardScaler()),
        ("estimator", estimator),
    ])


def _recommend_preprocessing_and_visualization(
    X: np.ndarray, y: np.ndarray, task: str
) -> tuple[List[str], List[str]]:
    """
    업로드 데이터 특성(X, y, task)을 분석해 적합한 전처리·시각화 방법을 추천합니다.
    빈/작은 데이터 시 기본 리스트를 반환합니다.
    """
    if X.size == 0 or y.size == 0:
        return (DEFAULT_PREPROCESSING.copy(), DEFAULT_VISUALIZATION.copy())

    n_samples, n_features = X.shape
    preprocessing: List[str] = []
    visualization: List[str] = []

    # 전처리: 결측이 있으면 대체 추천
    if np.issubdtype(X.dtype, np.floating):
        missing_ratio = np.isnan(X).sum() / max(X.size, 1)
        if missing_ratio > MISSING_RATIO_THRESHOLD:
            preprocessing.append("결측치 대체(중앙값/평균)")
    preprocessing.append("StandardScaler")
    if n_features > HIGH_FEATURE_COUNT:
        preprocessing.append("차원 축소(PCA 검토)")
    preprocessing.append("이상치 IQR 클리핑")

    # 분류: y NaN 제외 후 n_classes·불균형 계산
    y_valid = y[~np.isnan(y)] if np.issubdtype(y.dtype, np.floating) else y
    n_classes = len(np.unique(y_valid)) if y_valid.size > 0 else 0
    if task == "classification" and y_valid.size > 0:
        _, counts = np.unique(y_valid, return_counts=True)
        if len(counts) >= 2 and counts.min() > 0:
            if counts.max() / counts.min() >= CLASS_IMBALANCE_RATIO_THRESHOLD:
                preprocessing.append("클래스 균형(가중치/샘플링 검토)")

    # 시각화: 공통
    visualization.append("산점도")
    if n_features >= 2:
        visualization.append("상관관계 히트맵")
    if task == "classification":
        visualization.append("클래스 분포")
        if n_classes <= MAX_CLASSES_FOR_CONFUSION and n_samples <= MAX_SAMPLES_FOR_CONFUSION:
            visualization.append("혼동 행렬(학습 후)")
    else:
        visualization.append("잔차 플롯")
        visualization.append("실측 vs 예측")
    if n_features > 5:
        visualization.append("시계열/피처별 추세")

    preprocessing = list(dict.fromkeys(preprocessing))[:MAX_RECOMMEND_ITEMS]
    visualization = list(dict.fromkeys(visualization))[:MAX_RECOMMEND_ITEMS]
    return preprocessing, visualization


def select_best_model(
    X: np.ndarray,
    y: np.ndarray,
    task: Literal["classification", "regression"] = "classification",
    cv: int = 3,
    scoring: Optional[str] = None,
) -> dict:
    """
    여러 모델을 교차검증으로 비교해 최적 모델 이름·평균 점수 반환.
    X, y: numpy array (2D, 1D). task가 classification이면 scoring 기본 accuracy, regression이면 r2.
    """
    if task == "classification":
        candidates = CLASSIFIERS
        scoring = scoring or "accuracy"
    else:
        candidates = REGRESSORS
        scoring = scoring or "r2"

    best_name, best_score = None, -np.inf
    results: List[dict] = []

    for name, est in candidates:
        pipe = _get_pipeline(name, est)
        try:
            scores = cross_val_score(pipe, X, y, cv=cv, scoring=scoring)
            mean_score = float(np.mean(scores))
            results.append({"model": name, "mean_score": mean_score, "cv_scores": scores.tolist()})
            if mean_score > best_score:
                best_score = mean_score
                best_name = name
        except Exception:
            continue

    # 업로드 데이터 특성 기반 전처리·시각화 추천 (프론트 UI용)
    preprocessing_methods, visualization_methods = _recommend_preprocessing_and_visualization(
        X, y, task
    )

    return {
        "best_model": best_name,
        "best_score": best_score,
        "task": task,
        "scoring": scoring,
        "all_results": results,
        "preprocessing_methods": preprocessing_methods,
        "visualization_methods": visualization_methods,
    }
