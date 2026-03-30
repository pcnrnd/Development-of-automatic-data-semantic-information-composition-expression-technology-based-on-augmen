"""
AutoML API: 산업데이터 기반 적합 모델 도출 (scikit-learn).
"""
from typing import List, Literal, Optional
import numpy as np
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from services.automl import select_best_model

router = APIRouter(prefix="/automl", tags=["automl"])


class AutoMLFitRequest(BaseModel):
    """학습 데이터. features: 2차원 배열, target: 1차원 배열, task: classification | regression."""
    features: List[List[float]]
    target: List[float]
    task: Literal["classification", "regression"] = "classification"
    cv: Optional[int] = 3
    scoring: Optional[str] = None


@router.post("/fit")
def automl_fit(req: AutoMLFitRequest):
    """
    입력된 산업데이터(features, target)로 여러 모델을 비교해
    적합한 모델 이름과 검증 점수를 반환합니다. (scikit-learn 기반)
    """
    X = np.array(req.features, dtype=float)
    y = np.array(req.target, dtype=float)
    if X.ndim != 2 or y.ndim != 1 or len(X) != len(y) or len(X) < 2:
        raise HTTPException(
            status_code=400,
            detail="features must be 2D array, target 1D array, same length and at least 2 samples.",
        )
    try:
        result = select_best_model(
            X, y,
            task=req.task,
            cv=min(req.cv or 3, max(2, len(X) // 2)),
            scoring=req.scoring,
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
