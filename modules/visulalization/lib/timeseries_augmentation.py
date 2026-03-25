"""
시계열 데이터 증강 기능을 제공하는 모듈
"""

import pandas as pd
import numpy as np
import streamlit as st
from typing import Optional, List


class TimeSeriesAugmenter:
    """시계열 데이터 증강을 위한 클래스"""
    
    def __init__(self):
        self.supported_methods = {
            "가우시안 노이즈 추가": self._add_gaussian_noise,
            "시계열 이동(Shift)": self._shift_timeseries,
            "리샘플링(Resample)": self._resample_timeseries,
            "스케일링": self._scale_timeseries,
            "윈도우 평균": self._window_average
        }
    
    def augment_timeseries(self, df: pd.DataFrame, date_col: str, method: str, **kwargs) -> pd.DataFrame:
        """
        시계열 데이터 증강을 수행합니다.
        
        Args:
            df (pd.DataFrame): 원본 데이터프레임
            date_col (str): 날짜 컬럼명
            method (str): 증강 방법
            **kwargs: 증강 방법별 추가 파라미터
            
        Returns:
            pd.DataFrame: 증강된 데이터프레임
        """
        if method not in self.supported_methods:
            st.error(f"지원하지 않는 증강 방법입니다: {method}")
            return df
            
        return self.supported_methods[method](df, date_col, **kwargs)
    
    def _add_gaussian_noise(self, df: pd.DataFrame, date_col: str, noise_level: float = 0.01) -> pd.DataFrame:
        """가우시안 노이즈를 추가합니다."""
        df_aug = df.copy()
        num_cols = df.select_dtypes(include=[np.number]).columns
        
        for col in num_cols:
            if col != date_col:
                noise = np.random.normal(0, noise_level * df[col].std(), size=len(df))
                df_aug[col] = df[col] + noise
                
        return df_aug
    
    def _shift_timeseries(self, df: pd.DataFrame, date_col: str, shift_days: int = 1) -> pd.DataFrame:
        """시계열을 이동시킵니다."""
        df_aug = df.copy()
        num_cols = df.select_dtypes(include=[np.number]).columns
        
        for col in num_cols:
            if col != date_col:
                df_aug[col] = df[col].shift(shift_days)
                
        df_aug[date_col] = df[date_col]
        df_aug = df_aug.dropna().reset_index(drop=True)
        
        return df_aug
    
    def _resample_timeseries(self, df: pd.DataFrame, date_col: str, freq: str = 'W') -> pd.DataFrame:
        """시계열을 리샘플링합니다."""
        df_aug = df.copy()
        df_aug[date_col] = pd.to_datetime(df_aug[date_col])
        df_aug = df_aug.set_index(date_col)
        df_aug = df_aug.resample(freq).mean().reset_index()
        
        return df_aug
    
    def _scale_timeseries(self, df: pd.DataFrame, date_col: str, scale_factor: float = 1.0) -> pd.DataFrame:
        """시계열을 스케일링합니다."""
        df_aug = df.copy()
        num_cols = df.select_dtypes(include=[np.number]).columns
        
        for col in num_cols:
            if col != date_col:
                df_aug[col] = df[col] * scale_factor
                
        return df_aug
    
    def _window_average(self, df: pd.DataFrame, date_col: str, window_size: int = 3) -> pd.DataFrame:
        """이동 평균을 계산합니다."""
        df_aug = df.copy()
        num_cols = df.select_dtypes(include=[np.number]).columns
        
        for col in num_cols:
            if col != date_col:
                df_aug[col] = df[col].rolling(window=window_size, center=True).mean()
                
        df_aug = df_aug.dropna().reset_index(drop=True)
        
        return df_aug
    
    def detect_date_columns(self, df: pd.DataFrame) -> List[str]:
        """날짜/시간 컬럼을 자동으로 감지합니다."""
        date_cols = []
        
        for col in df.columns:
            col_lower = col.lower()
            if any(keyword in col_lower for keyword in ['date', 'time', 'datetime', 'timestamp']):
                date_cols.append(col)
            else:
                # 데이터 타입으로도 확인
                try:
                    pd.to_datetime(df[col].iloc[0])
                    date_cols.append(col)
                except:
                    continue
                    
        return date_cols
    
    def get_supported_methods(self) -> List[str]:
        """지원되는 증강 방법 목록을 반환합니다."""
        return list(self.supported_methods.keys())
    
    def get_method_parameters(self, method: str) -> dict:
        """증강 방법별 파라미터를 UI에서 입력받습니다."""
        params = {}
        
        if method == "가우시안 노이즈 추가":
            params['noise_level'] = st.slider("노이즈 비율(표준편차 기준)", 0.001, 0.2, 0.01, step=0.001)
            
        elif method == "시계열 이동(Shift)":
            params['shift_days'] = st.slider("이동할 행 수(일)", 1, 30, 1)
            
        elif method == "리샘플링(Resample)":
            freq_options = ['D', 'W', 'M', 'Q', 'Y']
            freq_labels = ['일별', '주별', '월별', '분기별', '년별']
            selected_freq = st.selectbox("리샘플링 주기", freq_labels)
            params['freq'] = freq_options[freq_labels.index(selected_freq)]
            
        elif method == "스케일링":
            params['scale_factor'] = st.slider("스케일링 비율", 0.1, 3.0, 1.0, step=0.1)
            
        elif method == "윈도우 평균":
            params['window_size'] = st.slider("윈도우 크기", 2, 20, 3)
            
        return params 