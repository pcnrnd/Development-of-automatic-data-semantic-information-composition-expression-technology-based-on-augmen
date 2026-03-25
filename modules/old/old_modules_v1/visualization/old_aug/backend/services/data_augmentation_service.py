"""
데이터 증강 서비스 레이어
lib의 data_augmentation 모듈을 호출하여 데이터 증강 기능을 제공합니다.
"""

import pandas as pd
from typing import Dict, Any, List, Optional
import json

from lib.data_augmentation import DataAugmenter


class DataAugmentationService:
    """데이터 증강 서비스 클래스"""
    
    def __init__(self):
        """초기화"""
        self.augmenter = DataAugmenter()
    
    def get_available_methods(self) -> List[str]:
        """사용 가능한 증강 방법 목록을 반환합니다."""
        return list(self.augmenter.supported_methods.keys())
    
    def augment_data(self, df: pd.DataFrame, method: str, **kwargs) -> Dict[str, Any]:
        """
        데이터 증강을 수행합니다.
        
        Args:
            df: 원본 데이터프레임
            method: 증강 방법
            **kwargs: 증강 파라미터
            
        Returns:
            증강 결과 정보
        """
        try:
            # 원본 데이터 정보
            original_info = {
                "rows": len(df),
                "columns": len(df.columns),
                "column_names": df.columns.tolist(),
                "dtypes": df.dtypes.to_dict()
            }
            
            # 데이터 증강 수행
            augmented_df = self.augmenter.augment(df, method, **kwargs)
            
            # 증강된 데이터 정보
            augmented_info = {
                "rows": len(augmented_df),
                "columns": len(augmented_df.columns),
                "column_names": augmented_df.columns.tolist(),
                "dtypes": augmented_df.dtypes.to_dict()
            }
            
            # 증강 통계
            augmentation_stats = {
                "original_rows": original_info["rows"],
                "augmented_rows": augmented_info["rows"],
                "row_increase": augmented_info["rows"] - original_info["rows"],
                "row_increase_ratio": (augmented_info["rows"] - original_info["rows"]) / original_info["rows"] * 100
            }
            
            return {
                "success": True,
                "method": method,
                "parameters": kwargs,
                "original_data_info": original_info,
                "augmented_data_info": augmented_info,
                "augmentation_stats": augmentation_stats,
                "augmented_data": augmented_df.to_dict(orient="records")
            }
            
        except Exception as e:
            return {
                "success": False,
                "error": str(e),
                "method": method,
                "parameters": kwargs
            }
    
    def get_augmentation_preview(self, df: pd.DataFrame, method: str, sample_size: int = 100, **kwargs) -> Dict[str, Any]:
        """
        증강 결과 미리보기를 제공합니다.
        
        Args:
            df: 원본 데이터프레임
            method: 증강 방법
            sample_size: 미리보기용 샘플 크기
            **kwargs: 증강 파라미터
            
        Returns:
            미리보기 결과
        """
        try:
            # 샘플 데이터로 증강 수행
            sample_df = df.sample(min(sample_size, len(df)), random_state=42)
            augmented_sample = self.augmenter.augment(sample_df, method, **kwargs)
            
            return {
                "success": True,
                "original_sample": sample_df.to_dict(orient="records"),
                "augmented_sample": augmented_sample.to_dict(orient="records"),
                "sample_stats": {
                    "original_sample_size": len(sample_df),
                    "augmented_sample_size": len(augmented_sample)
                }
            }
            
        except Exception as e:
            return {
                "success": False,
                "error": str(e)
            }
    
    def validate_augmentation_params(self, method: str, **kwargs) -> Dict[str, Any]:
        """
        증강 파라미터의 유효성을 검증합니다.
        
        Args:
            method: 증강 방법
            **kwargs: 검증할 파라미터
            
        Returns:
            검증 결과
        """
        try:
            # 지원하는 방법인지 확인
            if method not in self.augmenter.supported_methods:
                return {
                    "valid": False,
                    "error": f"지원하지 않는 증강 방법입니다: {method}",
                    "available_methods": self.get_available_methods()
                }
            
            # 파라미터 검증 로직 (필요에 따라 확장)
            validation_result = {
                "valid": True,
                "method": method,
                "parameters": kwargs
            }
            
            return validation_result
            
        except Exception as e:
            return {
                "valid": False,
                "error": str(e)
            } 