"""
AutoML API: 산업데이터 기반 적합 모델 도출 (scikit-learn).
"""
from typing import List, Literal, Optional
import numpy as np
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from services.automl import select_best_model

router = APIRouter(prefix="/automl", tags=["automl"])

# 입력 크기 상한 — 메모리 보호용 (행·열)
MAX_SAMPLES = 50_000
MAX_FEATURES = 500
MIN_SAMPLES_PER_CLASS = 2


class AutoMLFitRequest(BaseModel):
    """학습 데이터. features: 2차원 배열, target: 1차원 배열, task: classification | regression."""
    features: List[List[float]] = Field(..., min_length=2)
    target: List[float] = Field(..., min_length=2)
    task: Literal["classification", "regression"] = "classification"
    cv: Optional[int] = 3
    scoring: Optional[str] = None


@router.post("/fit")
def automl_fit(req: AutoMLFitRequest):
    """
    입력된 산업데이터(features, target)로 여러 모델을 비교해
    적합한 모델 이름과 검증 점수를 반환합니다. (scikit-learn 기반)
    """
    try:
        X = np.array(req.features, dtype=float)
        y = np.array(req.target, dtype=float)
    except (TypeError, ValueError) as e:
        raise HTTPException(status_code=400, detail=f"features/target must be numeric: {e}")

    if X.ndim != 2 or y.ndim != 1 or len(X) != len(y) or len(X) < 2:
        raise HTTPException(
            status_code=400,
            detail="features must be 2D array, target 1D array, same length and at least 2 samples.",
        )
    if X.shape[0] > MAX_SAMPLES or X.shape[1] > MAX_FEATURES:
        raise HTTPException(
            status_code=413,
            detail=f"Input too large: max samples={MAX_SAMPLES}, max features={MAX_FEATURES}",
        )
    if not np.isfinite(X).all() or not np.isfinite(y).all():
        raise HTTPException(status_code=400, detail="features/target must not contain NaN or Inf")

    # 분류 사전 검증: 최소 2개 클래스, 클래스당 최소 샘플 수
    if req.task == "classification":
        classes, counts = np.unique(y, return_counts=True)
        if len(classes) < 2:
            raise HTTPException(
                status_code=400,
                detail="classification requires at least 2 distinct classes in target",
            )
        if counts.min() < MIN_SAMPLES_PER_CLASS:
            raise HTTPException(
                status_code=400,
                detail=f"each class needs at least {MIN_SAMPLES_PER_CLASS} samples",
            )
        cv_max = int(counts.min())  # StratifiedKFold 안전 상한
    else:
        cv_max = max(2, len(X) // 2)

    cv_effective = max(2, min(req.cv or 3, cv_max))

    try:
        return select_best_model(
            X, y,
            task=req.task,
            cv=cv_effective,
            scoring=req.scoring,
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AutoML failed: {e}")
