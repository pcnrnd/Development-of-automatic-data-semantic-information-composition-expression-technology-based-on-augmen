"""
scikit-learn 기반 간단 AutoML: 여러 모델을 비교해 최적 모델·점수 반환.
산업데이터에 적합한 모델 도출용 (분류/회귀).
"""
from typing import Any, List, Optional, Literal
import numpy as np
from sklearn.model_selection import cross_validate
from sklearn.preprocessing import StandardScaler
from sklearn.pipeline import Pipeline
from sklearn.linear_model import LogisticRegression, Ridge, Lasso, ElasticNet
from sklearn.ensemble import (
    RandomForestClassifier, RandomForestRegressor,
    GradientBoostingClassifier, GradientBoostingRegressor,
    ExtraTreesClassifier, ExtraTreesRegressor,
    AdaBoostClassifier, AdaBoostRegressor,
    HistGradientBoostingClassifier, HistGradientBoostingRegressor,
)
from sklearn.neighbors import KNeighborsClassifier, KNeighborsRegressor
from sklearn.svm import SVC, SVR
from sklearn.tree import DecisionTreeClassifier

# 분류용 후보 (10개) — 모델 내부 n_jobs 미설정: fold 병렬화(cross_validate)와 중첩 방지
CLASSIFIERS = [
    ("LogisticRegression", LogisticRegression(max_iter=1000)),
    ("RandomForest", RandomForestClassifier(n_estimators=100, random_state=42)),
    ("ExtraTrees", ExtraTreesClassifier(n_estimators=100, random_state=42)),
    ("HistGradientBoosting", HistGradientBoostingClassifier(max_iter=100, random_state=42)),
    ("GradientBoosting", GradientBoostingClassifier(n_estimators=100, random_state=42)),
    ("AdaBoost", AdaBoostClassifier(n_estimators=100, random_state=42)),
    ("SVC", SVC(kernel="rbf", random_state=42)),
    ("KNN", KNeighborsClassifier(n_neighbors=5)),
    ("DecisionTree", DecisionTreeClassifier(random_state=42)),
    ("KNN_k3", KNeighborsClassifier(n_neighbors=3)),
]
# 회귀용 후보 (10개)
REGRESSORS = [
    ("Ridge", Ridge()),
    ("Lasso", Lasso(max_iter=2000)),
    ("ElasticNet", ElasticNet(max_iter=2000)),
    ("RandomForest", RandomForestRegressor(n_estimators=100, random_state=42)),
    ("ExtraTrees", ExtraTreesRegressor(n_estimators=100, random_state=42)),
    ("HistGradientBoosting", HistGradientBoostingRegressor(max_iter=100, random_state=42)),
    ("GradientBoosting", GradientBoostingRegressor(n_estimators=100, random_state=42)),
    ("AdaBoost", AdaBoostRegressor(n_estimators=100, random_state=42)),
    ("SVR", SVR(kernel="rbf")),
    ("KNN", KNeighborsRegressor(n_neighbors=5)),
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

# 모델 패밀리 분류: 스케일 민감 vs 트리/부스팅
SCALE_DEPENDENT_MODELS = frozenset({
    "LogisticRegression", "SVC", "SVR", "KNN", "KNN_k3",
    "Ridge", "Lasso", "ElasticNet",
})
TREE_BOOSTING_MODELS = frozenset({
    "RandomForest", "ExtraTrees", "GradientBoosting",
    "HistGradientBoosting", "AdaBoost", "DecisionTree",
})


def _get_pipeline(name: str, estimator: Any) -> Pipeline:
    """스케일링 + 추정기 파이프라인."""
    return Pipeline([
        ("scaler", StandardScaler()),
        ("estimator", estimator),
    ])


def _compute_data_hints(X: np.ndarray, y: np.ndarray, task: str) -> dict:
    """데이터 특성 힌트를 한 번만 계산해 반환."""
    n_samples, n_features = X.shape
    has_missing = False
    if np.issubdtype(X.dtype, np.floating):
        missing_ratio = np.isnan(X).sum() / max(X.size, 1)
        has_missing = missing_ratio > MISSING_RATIO_THRESHOLD

    has_imbalance = False
    n_classes = 0
    if task == "classification":
        y_valid = y[~np.isnan(y)] if np.issubdtype(y.dtype, np.floating) else y
        if y_valid.size > 0:
            _, counts = np.unique(y_valid, return_counts=True)
            n_classes = len(counts)
            if len(counts) >= 2 and counts.min() > 0:
                has_imbalance = counts.max() / counts.min() >= CLASS_IMBALANCE_RATIO_THRESHOLD

    return {
        "n_samples": n_samples,
        "n_features": n_features,
        "has_missing": has_missing,
        "has_imbalance": has_imbalance,
        "n_classes": n_classes,
    }


def _get_per_model_recommendations(name: str, task: str, hints: dict) -> tuple[List[str], List[str]]:
    """
    모델별 전처리·시각화 추천 (휴리스틱, 참고용).
    모델 특성 + 데이터 힌트를 조합해 모델마다 다른 제안을 반환합니다.
    """
    n_features = hints["n_features"]
    has_missing = hints["has_missing"]
    has_imbalance = hints["has_imbalance"]
    n_classes = hints["n_classes"]
    n_samples = hints["n_samples"]
    many_features = n_features > HIGH_FEATURE_COUNT

    preprocessing: List[str] = []
    visualization: List[str] = []

    # ── 결측치: 모델별 내성 차이 반영 ──────────────────────────────
    if has_missing:
        if name == "HistGradientBoosting":
            preprocessing.append("결측치 직접 처리(내부 지원)")
        else:
            preprocessing.append("결측치 대체(중앙값/평균)")

    # ── 모델별 전처리 ──────────────────────────────────────────────
    if name == "LogisticRegression":
        preprocessing += ["StandardScaler", "이상치 IQR 클리핑", "다중공선성 확인(VIF)", "범주형 인코딩(One-Hot)"]
    elif name in ("Ridge", "Lasso", "ElasticNet"):
        preprocessing += ["StandardScaler", "이상치 IQR 클리핑", "다중공선성 확인(VIF)"]
        if name == "Lasso":
            preprocessing.append("희소 피처 사전 확인")
        elif name == "ElasticNet":
            preprocessing.append("L1/L2 혼합 비율(l1_ratio) 탐색")
    elif name in ("SVC", "SVR"):
        preprocessing += ["StandardScaler", "이상치 IQR 클리핑", "RBF 커널 γ·C 그리드 탐색"]
        if many_features:
            preprocessing.append("차원 축소(PCA 후 SVM)")
    elif name in ("KNN", "KNN_k3"):
        preprocessing += ["StandardScaler", "이상치 IQR 클리핑"]
        if many_features:
            preprocessing.append("차원 축소(PCA) — 고차원 거리 왜곡 방지")
        k_val = 3 if name == "KNN_k3" else 5
        preprocessing.append(f"k={k_val} 이웃 수 교차검증으로 재확인")
    elif name == "RandomForest":
        preprocessing += ["이상치 IQR 클리핑(선택)", "범주형 인코딩(Label/Ordinal)", "n_estimators·max_depth 탐색"]
        if has_imbalance and task == "classification":
            preprocessing.append("class_weight='balanced' 설정")
    elif name == "ExtraTrees":
        preprocessing += ["이상치 허용(분할 기반)", "범주형 인코딩(Label/Ordinal)", "max_features 비율 탐색"]
    elif name == "GradientBoosting":
        preprocessing += ["이상치 IQR 클리핑(선택)", "범주형 인코딩(Label/Ordinal)", "learning_rate·n_estimators 조합 탐색"]
    elif name == "HistGradientBoosting":
        preprocessing += ["범주형 인코딩(OrdinalEncoder 권장)", "max_iter·learning_rate 탐색"]
        if many_features:
            preprocessing.append("피처 중요도 기반 불필요 피처 제거")
    elif name == "AdaBoost":
        preprocessing += ["이상치 IQR 클리핑 — 부스팅 가중치 왜곡 방지", "범주형 인코딩(Label)", "약한 학습기 max_depth=1~3 조정"]
        if has_imbalance and task == "classification":
            preprocessing.append("클래스 균형 샘플링(SMOTE 검토)")
    elif name == "DecisionTree":
        preprocessing += ["이상치 허용(분할 기반)", "범주형 인코딩(Label/Ordinal)", "max_depth 제한으로 과적합 방지", "min_samples_leaf 조정"]
    else:
        if name in SCALE_DEPENDENT_MODELS:
            preprocessing += ["StandardScaler", "이상치 IQR 클리핑"]
        else:
            preprocessing += ["이상치 IQR 클리핑", "범주형 인코딩"]

    # 공통: 클래스 불균형
    if task == "classification" and has_imbalance and "클래스 균형" not in " ".join(preprocessing):
        preprocessing.append("클래스 균형(가중치/샘플링 검토)")

    # ── 시각화: 모델별 ────────────────────────────────────────────
    if name in ("LogisticRegression", "Ridge", "Lasso", "ElasticNet"):
        if task == "classification":
            visualization += ["혼동 행렬(학습 후)", "클래스 분포", "상관관계 히트맵", "계수(coef) 크기 막대"]
        else:
            visualization += ["잔차 플롯", "타깃·피처 관계", "상관관계 히트맵", "계수 크기 막대"]
    elif name in ("SVC", "SVR"):
        if task == "classification":
            visualization += ["혼동 행렬(학습 후)", "클래스 분포", "서포트 벡터 수 확인"]
            if has_imbalance:
                visualization.insert(0, "클래스 불균형 분포")
        else:
            visualization += ["잔차 플롯", "타깃·피처 관계", "오차 분포"]
    elif name in ("KNN", "KNN_k3"):
        if task == "classification":
            visualization += ["혼동 행렬(학습 후)", "클래스 분포", "k별 정확도 곡선"]
        else:
            visualization += ["타깃·피처 관계", "잔차 플롯", "k별 R² 곡선"]
    elif name in ("RandomForest", "ExtraTrees"):
        if task == "classification":
            visualization += ["피처 중요도(상위 10)", "혼동 행렬(학습 후)", "클래스별 정밀도·재현율"]
        else:
            visualization += ["피처 중요도(상위 10)", "잔차 플롯", "타깃·피처 관계"]
    elif name in ("GradientBoosting", "HistGradientBoosting"):
        if task == "classification":
            visualization += ["피처 중요도(상위 10)", "학습 곡선(반복별 손실)", "혼동 행렬(학습 후)"]
        else:
            visualization += ["피처 중요도(상위 10)", "학습 곡선(반복별 손실)", "잔차 플롯"]
    elif name == "AdaBoost":
        if task == "classification":
            visualization += ["약한 학습기 오류율 추이", "피처 중요도", "혼동 행렬(학습 후)"]
        else:
            visualization += ["약한 학습기 오류율 추이", "잔차 플롯", "타깃·피처 관계"]
    elif name == "DecisionTree":
        if task == "classification":
            visualization += ["트리 구조 시각화(depth≤3)", "피처 중요도", "혼동 행렬(학습 후)"]
        else:
            visualization += ["트리 구조 시각화(depth≤3)", "피처 중요도", "잔차 플롯"]
    else:
        if task == "classification":
            visualization += ["클래스 분포", "혼동 행렬(학습 후)"]
        else:
            visualization += ["잔차 플롯", "타깃·피처 관계"]

    if n_features > 5:
        visualization.append("시계열/피처별 추세")

    preprocessing = list(dict.fromkeys(preprocessing))[:MAX_RECOMMEND_ITEMS]
    visualization = list(dict.fromkeys(visualization))[:MAX_RECOMMEND_ITEMS]
    return preprocessing, visualization


def select_best_model(
    X: np.ndarray,
    y: np.ndarray,
    task: Literal["classification", "regression"] = "classification",
    cv: int = 5,
    scoring: Optional[str] = None,
) -> dict:
    """
    여러 모델을 교차검증으로 비교해 최적 모델 이름·평균 점수 반환.
    X, y: numpy array (2D, 1D). task가 classification이면 scoring 기본 accuracy, regression이면 r2.
    cross_validate로 primary·aux 지표를 한 번에 수집해 CV 실행 횟수를 절반으로 줄임.
    """
    if task == "classification":
        candidates = CLASSIFIERS
        scoring = scoring or "accuracy"
        aux_scoring = "f1_weighted"
    else:
        candidates = REGRESSORS
        scoring = scoring or "r2"
        aux_scoring = "neg_mean_absolute_error"

    multi_scoring = {"primary": scoring, "aux": aux_scoring}

    # 데이터 힌트를 한 번만 계산 (모든 모델 추천에 공유)
    hints = _compute_data_hints(X, y, task)

    best_name, best_score = None, -np.inf
    results: List[dict] = []

    for name, est in candidates:
        pipe = _get_pipeline(name, est)
        try:
            # cross_validate: primary + aux를 한 번의 CV 루프에서 수집 (속도 2배 향상)
            # n_jobs=2: fold 2개씩 병렬 실행 — 전 코어 사용(-1) 시 중첩 부하 방지
            cv_result = cross_validate(pipe, X, y, cv=cv, scoring=multi_scoring, n_jobs=2)
            primary_scores = cv_result["test_primary"]
            aux_scores = cv_result["test_aux"]
            mean_score = float(np.mean(primary_scores))
            std_score = float(np.std(primary_scores))
            aux_mean = float(np.mean(aux_scores))
            pre_methods, viz_methods = _get_per_model_recommendations(name, task, hints)
            results.append({
                "model": name,
                "mean_score": mean_score,
                "std_score": std_score,
                "aux_score": aux_mean,
                "cv_scores": primary_scores.tolist(),
                "preprocessing_methods": pre_methods,
                "visualization_methods": viz_methods,
            })
            if mean_score > best_score:
                best_score = mean_score
                best_name = name
        except Exception:
            continue

    # 전역 전처리·시각화 추천: best_model 기준 (하위호환 유지)
    best_result = next((r for r in results if r["model"] == best_name), None)
    preprocessing_methods = best_result["preprocessing_methods"] if best_result else DEFAULT_PREPROCESSING.copy()
    visualization_methods = best_result["visualization_methods"] if best_result else DEFAULT_VISUALIZATION.copy()

    return {
        "best_model": best_name,
        "best_score": best_score,
        "task": task,
        "scoring": scoring,
        "aux_scoring": aux_scoring,
        "all_results": results,
        "preprocessing_methods": preprocessing_methods,
        "visualization_methods": visualization_methods,
    }
