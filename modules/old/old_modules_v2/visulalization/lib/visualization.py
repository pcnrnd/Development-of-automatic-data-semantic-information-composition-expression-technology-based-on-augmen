"""
데이터 시각화 모듈
다양한 차트와 그래프를 생성하는 기능을 제공합니다.
"""

import pandas as pd
import numpy as np
import plotly.express as px
import plotly.graph_objects as go
from plotly.subplots import make_subplots
import streamlit as st
from typing import List, Optional, Dict, Any

class DataVisualizer:
    """데이터 시각화 클래스"""
    
    def __init__(self):
        """초기화"""
        pass
    
    def get_numeric_columns(self, df: pd.DataFrame) -> List[str]:
        """수치형 컬럼 목록을 반환합니다."""
        return df.select_dtypes(include=['number']).columns.tolist()
    
    def get_categorical_columns(self, df: pd.DataFrame) -> List[str]:
        """범주형 컬럼 목록을 반환합니다."""
        return df.select_dtypes(exclude=['number']).columns.tolist()
    
    def create_overlapping_histogram(self, df_orig: pd.DataFrame, df_aug: pd.DataFrame, column: str):
        """겹쳐진 히스토그램을 생성합니다."""
        fig = go.Figure()
        
        # 증강 데이터 히스토그램 (뒤에 배치)
        fig.add_trace(go.Histogram(
            x=df_aug[column],
            name='증강 데이터',
            opacity=0.7,
            marker_color='lightcoral'  # 연한 빨강
        ))
        
        # 원본 데이터 히스토그램 (앞에 배치)
        fig.add_trace(go.Histogram(
            x=df_orig[column],
            name='원본 데이터',
            opacity=0.7,
            marker_color='lightblue'  # 연한 파랑
        ))
        
        fig.update_layout(
            title=f'{column} 컬럼 분포 비교',
            xaxis_title=column,
            yaxis_title='빈도',
            barmode='overlay'
        )
        
        return fig
    
    def create_overlapping_boxplot(self, df_orig: pd.DataFrame, df_aug: pd.DataFrame, column: str):
        """겹쳐진 박스플롯을 생성합니다."""
        fig = go.Figure()
        
        # 증강 데이터 박스플롯 (뒤에 배치)
        fig.add_trace(go.Box(
            y=df_aug[column],
            name='증강 데이터',
            marker_color='lightcoral'  # 연한 빨강
        ))
        
        # 원본 데이터 박스플롯 (앞에 배치)
        fig.add_trace(go.Box(
            y=df_orig[column],
            name='원본 데이터',
            marker_color='lightblue'  # 연한 파랑
        ))
        
        fig.update_layout(
            title=f'{column} 컬럼 박스플롯 비교',
            yaxis_title=column
        )
        
        return fig
    
    def create_overlapping_scatter(self, df_orig: pd.DataFrame, df_aug: pd.DataFrame, x_col: str, y_col: str):
        """겹쳐진 산점도를 생성합니다."""
        fig = go.Figure()
        
        # 증강 데이터 산점도 (뒤에 배치)
        fig.add_trace(go.Scatter(
            x=df_aug[x_col],
            y=df_aug[y_col],
            mode='markers',
            name='증강 데이터',
            marker=dict(color='lightcoral', opacity=0.6)  # 연한 빨강
        ))
        
        # 원본 데이터 산점도 (앞에 배치)
        fig.add_trace(go.Scatter(
            x=df_orig[x_col],
            y=df_orig[y_col],
            mode='markers',
            name='원본 데이터',
            marker=dict(color='lightblue', opacity=0.6)  # 연한 파랑
        ))
        
        fig.update_layout(
            title=f'{x_col} vs {y_col} 산점도 비교',
            xaxis_title=x_col,
            yaxis_title=y_col
        )
        
        return fig
    
    def create_categorical_visualization(self, df: pd.DataFrame, column: str, chart_type: str = "막대그래프"):
        """범주형 데이터 시각화를 생성합니다."""
        if chart_type == "막대그래프":
            value_counts = df[column].value_counts()
            fig = px.bar(
                x=value_counts.index,
                y=value_counts.values,
                title=f'{column} 컬럼 분포',
                labels={'x': column, 'y': '개수'}
            )
            return fig
        return None
    
    def compare_distributions(self, df_orig: pd.DataFrame, df_aug: pd.DataFrame, target_col: str):
        """클래스 분포를 비교합니다."""
        col1, col2 = st.columns(2)
        
        with col1:
            orig_counts = df_orig[target_col].value_counts()
            fig_orig = px.pie(
                values=orig_counts.values,
                names=orig_counts.index,
                title=f'원본 {target_col} 분포'
            )
            st.plotly_chart(fig_orig, use_container_width=True)
        
        with col2:
            aug_counts = df_aug[target_col].value_counts()
            fig_aug = px.pie(
                values=aug_counts.values,
                names=aug_counts.index,
                title=f'증강 {target_col} 분포'
            )
            st.plotly_chart(fig_aug, use_container_width=True)
    
    def display_comparison_summary(self, df_orig: pd.DataFrame, df_aug: pd.DataFrame, numeric_cols: List[str]):
        """증강 전후 비교 요약을 표시합니다."""
        summary_data = []
        for col in numeric_cols:
            orig_mean = df_orig[col].mean()
            aug_mean = df_aug[col].mean()
            orig_std = df_orig[col].std()
            aug_std = df_aug[col].std()
            
            summary_data.append({
                '컬럼': col,
                '원본 평균': f"{orig_mean:.3f}",
                '증강 평균': f"{aug_mean:.3f}",
                '평균 변화': f"{aug_mean - orig_mean:.3f}",
                '원본 표준편차': f"{orig_std:.3f}",
                '증강 표준편차': f"{aug_std:.3f}",
                '표준편차 변화': f"{aug_std - orig_std:.3f}"
            })
        
        summary_df = pd.DataFrame(summary_data)
        st.dataframe(summary_df, use_container_width=True)
    
    def display_scatter_summary(self, df_orig: pd.DataFrame, df_aug: pd.DataFrame, x_col: str, y_col: str):
        """산점도 비교 요약을 표시합니다."""
        st.markdown("""
        **📈 산점도 통계 해석 가이드:**
        - **상관계수**: -1~1, 1에 가까울수록 강한 양의 상관관계
        - **데이터 포인트**: 산점도에 표시되는 점의 개수
        - **변화량**: 양수 = 증가, 음수 = 감소
        """)
        
        # 상관계수 계산
        orig_corr = df_orig[x_col].corr(df_orig[y_col])
        aug_corr = df_aug[x_col].corr(df_aug[y_col])
        corr_change = aug_corr - orig_corr
        
        # 데이터 포인트 수
        orig_points = len(df_orig)
        aug_points = len(df_aug)
        points_increase = aug_points - orig_points
        points_increase_pct = (points_increase / orig_points) * 100
        
        # 통계 요약표 생성
        summary_data = {
            '지표': ['상관계수', '데이터 포인트'],
            '원본': [f"{orig_corr:.3f}", f"{orig_points:,}개"],
            '증강': [f"{aug_corr:.3f}", f"{aug_points:,}개"],
            '변화량': [f"{corr_change:.3f}", f"{points_increase:,}개"],
            '변화율': [f"{corr_change/orig_corr*100:.1f}%" if orig_corr != 0 else "N/A", f"{points_increase_pct:.1f}%"]
        }
        
        summary_df = pd.DataFrame(summary_data)
        st.dataframe(summary_df, use_container_width=True)
    
    def create_comparison_dashboard(self, df_orig: pd.DataFrame, df_aug: pd.DataFrame, numeric_cols: List[str], categorical_cols: List[str]):
        """증강 전후 비교 대시보드를 생성합니다."""
        st.markdown("**📊 증강 전후 비교 대시보드**")
        
        # 수치형 컬럼이 있는 경우
        if numeric_cols:
            st.markdown("**📈 수치형 데이터 비교**")
            selected_numeric = st.selectbox("수치형 컬럼 선택", numeric_cols, key="dashboard_numeric")
            
            if selected_numeric:
                col1, col2 = st.columns(2)
                
                with col1:
                    fig_hist = self.create_overlapping_histogram(df_orig, df_aug, selected_numeric)
                    st.plotly_chart(fig_hist, use_container_width=True)
                
                with col2:
                    fig_box = self.create_overlapping_boxplot(df_orig, df_aug, selected_numeric)
                    st.plotly_chart(fig_box, use_container_width=True)
        
        # 범주형 컬럼이 있는 경우
        if categorical_cols:
            st.markdown("**📊 범주형 데이터 비교**")
            selected_categorical = st.selectbox("범주형 컬럼 선택", categorical_cols, key="dashboard_categorical")
            
            if selected_categorical:
                col1, col2 = st.columns(2)
                
                with col1:
                    st.markdown("**원본 데이터 분포**")
                    fig_orig_cat = self.create_categorical_visualization(df_orig, selected_categorical)
                    if fig_orig_cat:
                        st.plotly_chart(fig_orig_cat, use_container_width=True)
                
                with col2:
                    st.markdown("**증강 데이터 분포**")
                    fig_aug_cat = self.create_categorical_visualization(df_aug, selected_categorical)
                    if fig_aug_cat:
                        st.plotly_chart(fig_aug_cat, use_container_width=True)
        
        # 산점도 비교 (수치형 컬럼이 2개 이상인 경우)
        if len(numeric_cols) >= 2:
            st.markdown("**📊 산점도 비교**")
            x_col = st.selectbox("X축 컬럼", numeric_cols, key="dashboard_x")
            y_col = st.selectbox("Y축 컬럼", [col for col in numeric_cols if col != x_col], key="dashboard_y")
            
            if x_col and y_col:
                fig_scatter = self.create_overlapping_scatter(df_orig, df_aug, x_col, y_col)
                st.plotly_chart(fig_scatter, use_container_width=True)
    
    def create_augmentation_report(self, df_orig: pd.DataFrame, df_aug: pd.DataFrame, params: Dict[str, Any]):
        """증강 결과 리포트를 생성합니다."""
        # 메인 제목
        st.markdown("---")
        st.markdown("## 📊 증강 결과 리포트")
        
        # 1. 핵심 지표 카드
        st.markdown("### 🎯 핵심 지표")
        
        # 데이터 크기 비교
        col1, col2, col3, col4 = st.columns(4)
        
        with col1:
            st.markdown("""
            <div style="background-color: #f0f8ff; padding: 20px; border-radius: 10px; border-left: 5px solid #1f77b4;">
                <h4 style="margin: 0; color: #1f77b4;">📈 원본 데이터</h4>
                <h2 style="margin: 10px 0; color: #1f77b4;">{:,}</h2>
                <p style="margin: 0; color: #666;">행 × {:,}열</p>
            </div>
            """.format(len(df_orig), len(df_orig.columns)), unsafe_allow_html=True)
        
        with col2:
            st.markdown("""
            <div style="background-color: #fff0f0; padding: 20px; border-radius: 10px; border-left: 5px solid #ff7f0e;">
                <h4 style="margin: 0; color: #ff7f0e;">🚀 증강 데이터</h4>
                <h2 style="margin: 10px 0; color: #ff7f0e;">{:,}</h2>
                <p style="margin: 0; color: #666;">행 × {:,}열</p>
            </div>
            """.format(len(df_aug), len(df_aug.columns)), unsafe_allow_html=True)
        
        with col3:
            growth_rate = ((len(df_aug) - len(df_orig)) / len(df_orig)) * 100
            growth_color = "#28a745" if growth_rate > 0 else "#dc3545"
            st.markdown("""
            <div style="background-color: #f8fff8; padding: 20px; border-radius: 10px; border-left: 5px solid {};">
                <h4 style="margin: 0; color: {};">📊 증가율</h4>
                <h2 style="margin: 10px 0; color: {};">{:.1f}%</h2>
                <p style="margin: 0; color: #666;">데이터 확장</p>
            </div>
            """.format(growth_color, growth_color, growth_color, growth_rate), unsafe_allow_html=True)
        
        with col4:
            increase_count = len(df_aug) - len(df_orig)
            st.markdown("""
            <div style="background-color: #fff8f0; padding: 20px; border-radius: 10px; border-left: 5px solid #ffc107;">
                <h4 style="margin: 0; color: #ffc107;">➕ 증가량</h4>
                <h2 style="margin: 10px 0; color: #ffc107;">{:,}</h2>
                <p style="margin: 0; color: #666;">새로운 데이터</p>
            </div>
            """.format(increase_count), unsafe_allow_html=True)
        