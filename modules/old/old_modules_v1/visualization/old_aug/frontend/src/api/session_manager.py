"""
세션 관리자

세션 상태 관리 및 초기화를 담당하는 클래스
"""

import streamlit as st
from typing import Optional


class SessionManager:
    """세션 관리자"""
    
    def __init__(self):
        self.initialize_session_state()
    
    def initialize_session_state(self):
        """세션 상태를 초기화합니다."""
        if 'session_id' not in st.session_state:
            st.session_state.session_id = None
        if 'data_analysis' not in st.session_state:
            st.session_state.data_analysis = None
        if 'augmentation_result' not in st.session_state:
            st.session_state.augmentation_result = None
        if 'original_df' not in st.session_state:
            st.session_state.original_df = None
        if 'augmented_df' not in st.session_state:
            st.session_state.augmented_df = None
        if 'last_params_key' not in st.session_state:
            st.session_state.last_params_key = None
        if 'data_analysis_cached' not in st.session_state:
            st.session_state.data_analysis_cached = False
    
    def reset_session(self):
        """세션 상태를 초기화합니다."""
        st.session_state.session_id = None
        st.session_state.data_analysis = None
        st.session_state.augmentation_result = None
        st.session_state.original_df = None
        st.session_state.augmented_df = None
        st.session_state.last_params_key = None
        st.session_state.data_analysis_cached = False
    
    def get_session_id(self) -> Optional[str]:
        """세션 ID를 반환합니다."""
        return st.session_state.session_id
    
    def set_session_id(self, session_id: str):
        """세션 ID를 설정합니다."""
        st.session_state.session_id = session_id
    
    def get_data_analysis(self) -> Optional[dict]:
        """데이터 분석 결과를 반환합니다."""
        return st.session_state.data_analysis
    
    def set_data_analysis(self, analysis: dict):
        """데이터 분석 결과를 설정합니다."""
        st.session_state.data_analysis = analysis
    
    def get_augmentation_result(self) -> Optional[dict]:
        """증강 결과를 반환합니다."""
        return st.session_state.augmentation_result
    
    def set_augmentation_result(self, result: dict):
        """증강 결과를 설정합니다."""
        st.session_state.augmentation_result = result
    
    def get_original_df(self):
        """원본 데이터프레임을 반환합니다."""
        return st.session_state.original_df
    
    def set_original_df(self, df):
        """원본 데이터프레임을 설정합니다."""
        st.session_state.original_df = df
    
    def get_augmented_df(self):
        """증강된 데이터프레임을 반환합니다."""
        return st.session_state.augmented_df
    
    def set_augmented_df(self, df):
        """증강된 데이터프레임을 설정합니다."""
        st.session_state.augmented_df = df
    
    def get_last_params_key(self) -> Optional[str]:
        """마지막 파라미터 키를 반환합니다."""
        return st.session_state.last_params_key
    
    def set_last_params_key(self, key: str):
        """마지막 파라미터 키를 설정합니다."""
        st.session_state.last_params_key = key
    
    def is_data_analysis_cached(self) -> bool:
        """데이터 분석이 캐시되었는지 확인합니다."""
        return st.session_state.data_analysis_cached
    
    def set_data_analysis_cached(self, cached: bool):
        """데이터 분석 캐시 상태를 설정합니다."""
        st.session_state.data_analysis_cached = cached
