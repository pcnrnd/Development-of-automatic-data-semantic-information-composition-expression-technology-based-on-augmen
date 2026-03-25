"""
데이터 유틸리티 모듈
데이터 로딩, 검증, 전처리 등의 공통 기능을 제공합니다.
"""

import pandas as pd
import numpy as np
import re
from typing import Dict, List, Any, Optional, Tuple

class DataUtils:
    """데이터 유틸리티 클래스"""
    
    # 날짜/시간 패턴 정의
    DATETIME_PATTERNS = [
        # YYYY-MM-DD 형식
        r'^\d{4}-\d{1,2}-\d{1,2}$',
        # YYYY/MM/DD 형식
        r'^\d{4}/\d{1,2}/\d{1,2}$',
        # YYYY.MM.DD 형식
        r'^\d{4}\.\d{1,2}\.\d{1,2}$',
        # YYYY-MM-DD HH:MM:SS 형식
        r'^\d{4}-\d{1,2}-\d{1,2}\s+\d{1,2}:\d{1,2}(:\d{1,2})?$',
        # YYYY/MM/DD HH:MM:SS 형식
        r'^\d{4}/\d{1,2}/\d{1,2}\s+\d{1,2}:\d{1,2}(:\d{1,2})?$',
        # DD-MM-YYYY 형식
        r'^\d{1,2}-\d{1,2}-\d{4}$',
        # DD/MM/YYYY 형식
        r'^\d{1,2}/\d{1,2}/\d{4}$',
        # YYYYMMDD 형식
        r'^\d{8}$',
        # HH:MM:SS 형식
        r'^\d{1,2}:\d{1,2}(:\d{1,2})?$',
        # MM/DD/YYYY 형식
        r'^\d{1,2}/\d{1,2}/\d{4}$',
        # YYYY년 MM월 DD일 형식 (한국어)
        r'^\d{4}년\s*\d{1,2}월\s*\d{1,2}일$',
    ]
    
    @staticmethod
    def load_csv_file(uploaded_file) -> Optional[pd.DataFrame]:
        """CSV 파일을 로드합니다."""
        try:
            df = pd.read_csv(uploaded_file)
            return df
        except Exception as e:
            raise ValueError(f"파일 로드 중 오류가 발생했습니다: {str(e)}")
    
    @staticmethod
    def validate_data(df: pd.DataFrame) -> bool:
        """데이터 유효성을 검사합니다."""
        if df is None or df.empty:
            raise ValueError("데이터가 비어있습니다.")
        return True
    
    @staticmethod
    def is_datetime_series(series: pd.Series) -> bool:
        """정규표현식을 사용하여 시리즈가 날짜/시간 형식인지 확인합니다."""
        try:
            # 결측값이 아닌 샘플만 선택 (최대 10개)
            sample_data = series.dropna().astype(str).head(10)
            
            if len(sample_data) == 0:
                return False
            
            # 각 샘플에 대해 날짜 패턴 매칭 시도
            datetime_count = 0
            total_samples = len(sample_data)
            
            for value in sample_data:
                value_str = str(value).strip()
                
                # 각 패턴에 대해 매칭 시도
                for pattern in DataUtils.DATETIME_PATTERNS:
                    if re.match(pattern, value_str):
                        datetime_count += 1
                        break
            
            # 50% 이상이 날짜 패턴과 매칭되면 날짜 시리즈로 판단
            return (datetime_count / total_samples) >= 0.5
            
        except Exception:
            return False
    
    @staticmethod
    def filter_categorical_columns(categorical_cols: List[str], df: pd.DataFrame) -> List[str]:
        """타임시리즈가 아닌 범주형 컬럼만 필터링합니다."""
        return [
            col for col in categorical_cols
            if not DataUtils.is_datetime_series(df[col])
        ] 