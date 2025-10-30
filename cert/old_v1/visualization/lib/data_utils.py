"""
데이터 유틸리티 모듈
데이터 로딩, 검증, 전처리 등의 공통 기능을 제공합니다.
"""

import pandas as pd
import streamlit as st
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
            st.error(f"파일 로드 중 오류가 발생했습니다: {str(e)}")
            return None
    
    @staticmethod
    def validate_data(df: pd.DataFrame) -> bool:
        """데이터 유효성을 검사합니다."""
        if df is None or df.empty:
            st.error("데이터가 비어있습니다.")
            return False
        return True
    
    @staticmethod
    def show_data_preview(df: pd.DataFrame, title: str):
        """데이터 미리보기를 표시합니다."""
        st.subheader(title)
        st.dataframe(df.head(), use_container_width=True)
    
    @staticmethod
    def create_download_button(df: pd.DataFrame, filename: str):
        """다운로드 버튼을 생성합니다."""
        csv = df.to_csv(index=False)
        st.download_button(
            label="📥 증강된 데이터 다운로드",
            data=csv,
            file_name=filename,
            mime="text/csv"
        )
    
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
    def setup_augmentation_parameters(categorical_cols: List[str], numeric_cols: List[str], df: pd.DataFrame) -> Tuple[Dict[str, Any], List[str]]:
        """사이드바에서 증강 파라미터를 설정하고 반환합니다."""
        with st.sidebar:
            st.markdown("---")
            st.markdown("**🔧 증강 파라미터 설정**")
            
            # SMOTE 관련 설정
            st.markdown("**🎯 SMOTE 설정**")
            use_smote = st.checkbox("SMOTE 사용", value=False, help="불균형 데이터 증강을 위해 SMOTE를 사용합니다.")
            
            target_col = None
            imb_method = None
            
            if use_smote:
                all_cols = categorical_cols + numeric_cols
                target_col = st.selectbox("타겟(레이블) 컬럼 선택", all_cols, key="target_select")
                
                if target_col:
                    if target_col in numeric_cols:
                        unique_count = df[target_col].nunique()
                        if unique_count > 20:
                            st.warning("⚠️ 연속형 데이터로 보입니다.")
                        else:
                            st.success("✅ 범주형으로 처리 가능")
                    else:
                        st.success(f"✅ 범주형 데이터")
                
                imb_method = st.selectbox("불균형 증강 방법", ["SMOTE", "RandomOverSampler", "RandomUnderSampler"], key="imb_method_select")
            
            # 노이즈 설정
            st.markdown("**🔊 노이즈 설정**")
            noise_level = st.slider("노이즈 레벨", 0.01, 0.2, 0.03, step=0.01, help="수치형 컬럼에 추가할 노이즈의 강도")
            
            # 중복 설정
            st.markdown("**📋 중복 설정**")
            dup_count = st.slider("중복 횟수", 2, 10, 2, help="전체 데이터를 몇 번 복제할지 설정")
            
            # 특성 기반 증강 설정
            st.markdown("**📊 특성 기반 증강 설정**")
            feature_ratio = st.slider("특성 증강 비율", 0.1, 1.0, 0.3, step=0.1, help="각 특성별로 증강할 데이터의 비율")
            
            # 일반 증강 설정
            st.markdown("**🔄 일반 증강 설정**")
            augmentation_ratio = st.slider("일반 증강 비율", 0.1, 2.0, 0.5, step=0.1, help="원본 데이터 대비 증강할 비율")
            general_noise_level = st.slider("일반 노이즈 레벨", 0.01, 0.2, 0.05, step=0.01, help="일반 증강에서 사용할 노이즈 레벨")
            
            # 데이터 삭제 설정
            st.markdown("**🗑️ 데이터 삭제 설정**")
            use_drop = st.checkbox("데이터 삭제 사용", value=False, help="과적합 방지를 위해 일부 데이터를 삭제합니다.")
            drop_rate = None
            if use_drop:
                drop_rate = st.slider("삭제 비율", 0.01, 0.5, 0.1, step=0.01, help="랜덤하게 삭제할 데이터의 비율")
        
        # 기본 증강 방법 설정
        selected_methods = ['noise', 'duplicate', 'feature']
        if use_smote and target_col:
            selected_methods.append('smote')
        if use_drop:
            selected_methods.append('drop')
        selected_methods.append('general')
        
        # 파라미터 딕셔너리 생성
        params = {
            'noise_level': noise_level,
            'dup_count': dup_count,
            'feature_ratio': feature_ratio,
            'augmentation_ratio': augmentation_ratio,
            'general_noise_level': general_noise_level
        }
        
        if use_drop and drop_rate is not None:
            params['drop_rate'] = drop_rate
        if use_smote and target_col:
            params['target_col'] = target_col
            params['imb_method'] = imb_method
        
        return params, selected_methods
    
    @staticmethod
    def filter_categorical_columns(categorical_cols: List[str], df: pd.DataFrame) -> List[str]:
        """타임시리즈가 아닌 범주형 컬럼만 필터링합니다."""
        return [
            col for col in categorical_cols
            if not DataUtils.is_datetime_series(df[col])
        ]