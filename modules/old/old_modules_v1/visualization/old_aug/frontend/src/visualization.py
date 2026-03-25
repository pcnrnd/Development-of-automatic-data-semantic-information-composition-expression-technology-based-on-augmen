"""
Frontend 시각화 모듈
Plotly를 사용하여 시각화 기능을 제공합니다.
"""

import pandas as pd
import plotly.express as px
import plotly.graph_objects as go
from typing import Dict, Any, List, Optional
import numpy as np


class FrontendVisualization:
    """프론트엔드 시각화 클래스"""
    
    def __init__(self):
        """초기화"""
        pass
    
    def create_histogram_comparison(self, df_orig: pd.DataFrame, df_aug: pd.DataFrame, column: str) -> go.Figure:
        """히스토그램 비교 차트를 생성합니다."""
        try:
            fig = go.Figure()
            
            # NaN 값 제거 및 안전한 데이터 처리
            orig_data = df_orig[column].dropna()
            aug_data = df_aug[column].dropna()
            
            if len(aug_data) > 0:
                # 증강된 데이터 히스토그램 (연붉은색) - 뒤에 위치
                fig.add_trace(go.Histogram(
                    x=aug_data,
                    name='증강',
                    opacity=0.5,
                    marker_color='lightcoral'
                ))
            
            if len(orig_data) > 0:
                # 원본 데이터 히스토그램 (연파랑) - 앞에 위치
                fig.add_trace(go.Histogram(
                    x=orig_data,
                    name='원본',
                    opacity=0.8,
                    marker_color='lightblue'
                ))
            
            fig.update_layout(
                title=f'{column} 히스토그램 비교',
                xaxis_title=column,
                yaxis_title='빈도',
                barmode='overlay'
            )
            
            return fig
        except Exception as e:
            # 오류 발생 시 빈 차트 반환
            fig = go.Figure()
            fig.add_annotation(
                text=f"차트 생성 중 오류 발생: {str(e)}",
                xref="paper", yref="paper",
                x=0.5, y=0.5, showarrow=False
            )
            return fig
    
    def create_boxplot_comparison(self, df_orig: pd.DataFrame, df_aug: pd.DataFrame, column: str) -> go.Figure:
        """박스플롯 비교 차트를 생성합니다."""
        try:
            fig = go.Figure()
            
            # NaN 값 제거 및 안전한 데이터 처리
            orig_data = df_orig[column].dropna()
            aug_data = df_aug[column].dropna()
            
            if len(orig_data) > 0:
                # 원본 데이터 박스플롯 (연파랑)
                fig.add_trace(go.Box(
                    y=orig_data,
                    name='원본',
                    marker_color='lightblue'
                ))
            
            if len(aug_data) > 0:
                # 증강된 데이터 박스플롯 (연붉은색)
                fig.add_trace(go.Box(
                    y=aug_data,
                    name='증강',
                    marker_color='lightcoral'
                ))
            
            fig.update_layout(
                title=f'{column} 박스플롯 비교',
                yaxis_title=column
            )
            
            return fig
        except Exception as e:
            # 오류 발생 시 빈 차트 반환
            fig = go.Figure()
            fig.add_annotation(
                text=f"차트 생성 중 오류 발생: {str(e)}",
                xref="paper", yref="paper",
                x=0.5, y=0.5, showarrow=False
            )
            return fig
    
    def create_scatter_comparison(self, df_orig: pd.DataFrame, df_aug: pd.DataFrame, x_col: str, y_col: str) -> go.Figure:
        """산점도 비교 차트를 생성합니다."""
        try:
            fig = go.Figure()
            
            # NaN 값 제거 및 안전한 데이터 처리
            orig_data = df_orig[[x_col, y_col]].dropna()
            aug_data = df_aug[[x_col, y_col]].dropna()
            
            if len(aug_data) > 0:
                # 증강된 데이터 산점도 (연붉은색) - 뒤에 위치
                fig.add_trace(go.Scatter(
                    x=aug_data[x_col],
                    y=aug_data[y_col],
                    mode='markers',
                    name='증강',
                    marker=dict(color='lightcoral', size=8, opacity=0.6)
                ))
            
            if len(orig_data) > 0:
                # 원본 데이터 산점도 (연파랑) - 앞에 위치
                fig.add_trace(go.Scatter(
                    x=orig_data[x_col],
                    y=orig_data[y_col],
                    mode='markers',
                    name='원본',
                    marker=dict(color='lightblue', size=8, opacity=0.7)
                ))
            
            fig.update_layout(
                title=f'{x_col} vs {y_col} 산점도 비교',
                xaxis_title=x_col,
                yaxis_title=y_col
            )
            
            return fig
        except Exception as e:
            # 오류 발생 시 빈 차트 반환
            fig = go.Figure()
            fig.add_annotation(
                text=f"차트 생성 중 오류 발생: {str(e)}",
                xref="paper", yref="paper",
                x=0.5, y=0.5, showarrow=False
            )
            return fig
    
    def create_categorical_comparison(self, df_orig: pd.DataFrame, df_aug: pd.DataFrame, column: str) -> go.Figure:
        """범주형 비교 차트를 생성합니다."""
        try:
            # NaN 값 제거 및 안전한 데이터 처리
            orig_data = df_orig[column].dropna()
            aug_data = df_aug[column].dropna()
            
            if len(orig_data) == 0 and len(aug_data) == 0:
                # 데이터가 없는 경우 빈 차트 반환
                fig = go.Figure()
                fig.add_annotation(
                    text="데이터가 없습니다.",
                    xref="paper", yref="paper",
                    x=0.5, y=0.5, showarrow=False
                )
                return fig
            
            # 데이터 타입 통일 (문자열로 변환)
            orig_data_str = orig_data.astype(str)
            aug_data_str = aug_data.astype(str)
            
            # 원본 데이터 카테고리별 개수 (안전한 처리)
            try:
                orig_counts = orig_data_str.value_counts().reset_index()
                # 컬럼명 강제 설정
                if len(orig_counts.columns) >= 2:
                    orig_counts = orig_counts.iloc[:, :2]
                orig_counts.columns = ['category', 'original']
            except Exception as e:
                # 오류 발생 시 빈 DataFrame 생성
                orig_counts = pd.DataFrame({'category': [], 'original': []})
            
            # 증강된 데이터 카테고리별 개수 (안전한 처리)
            try:
                aug_counts = aug_data_str.value_counts().reset_index()
                # 컬럼명 강제 설정
                if len(aug_counts.columns) >= 2:
                    aug_counts = aug_counts.iloc[:, :2]
                aug_counts.columns = ['category', 'augmented']
            except Exception as e:
                # 오류 발생 시 빈 DataFrame 생성
                aug_counts = pd.DataFrame({'category': [], 'augmented': []})
            
            # 안전한 병합 처리
            try:
                # 병합
                comparison_df = orig_counts.merge(aug_counts, on='category', how='outer').fillna(0)
                
            except Exception as e:
                # 병합 실패 시 개별 처리
                try:
                    all_categories = list(set(orig_counts['category'].tolist() + aug_counts['category'].tolist()))
                    comparison_df = pd.DataFrame({
                        'category': all_categories,
                        'original': [orig_counts[orig_counts['category'] == cat]['original'].iloc[0] if cat in orig_counts['category'].values else 0 for cat in all_categories],
                        'augmented': [aug_counts[aug_counts['category'] == cat]['augmented'].iloc[0] if cat in aug_counts['category'].values else 0 for cat in all_categories]
                    })
                except Exception as inner_e:
                    # 최종 대체 처리
                    comparison_df = pd.DataFrame({
                        'category': ['데이터 오류'],
                        'original': [0],
                        'augmented': [0]
                    })
            
            # 카테고리를 정렬 (숫자 레이블의 경우 숫자 순서로)
            try:
                # 숫자로 변환 가능한 카테고리들을 숫자로 정렬
                numeric_categories = []
                non_numeric_categories = []
                
                for cat in comparison_df['category']:
                    try:
                        # float 값을 정수로 변환하여 표시
                        float_val = float(cat)
                        if float_val.is_integer():
                            display_cat = str(int(float_val))
                        else:
                            # 소수점이 있는 경우 원래 값 유지
                            display_cat = str(float_val)
                        numeric_categories.append((float_val, display_cat))
                    except:
                        # 숫자가 아닌 경우 원래 값 유지
                        non_numeric_categories.append(cat)
                
                # 숫자 카테고리는 숫자 순서로, 나머지는 알파벳 순서로
                numeric_categories.sort()
                non_numeric_categories.sort()
                
                sorted_categories = [cat for _, cat in numeric_categories] + non_numeric_categories
                comparison_df = comparison_df.set_index('category').reindex(sorted_categories).reset_index()
                
                # 카테고리 표시값 업데이트
                for i, (_, display_cat) in enumerate(numeric_categories):
                    if i < len(comparison_df):
                        comparison_df.iloc[i, comparison_df.columns.get_loc('category')] = display_cat
            except:
                # 정렬 실패 시 원래 순서 유지
                pass
            
            # 데이터 타입에 따른 차트 선택
            unique_count = len(comparison_df)
            
            # 대조 가능한 시각화 생성
            fig = go.Figure()
            
            # 원본 데이터 (연파랑)
            fig.add_trace(go.Bar(
                x=list(range(len(comparison_df))),  # 인덱스 기반 X축
                y=comparison_df['original'],
                name='원본',
                marker_color='lightblue',
                opacity=0.8,
                text=comparison_df['original'],
                textposition='auto',
                texttemplate='%{text:,}',
                textfont=dict(size=10)
            ))
            
            # 증강 데이터 (연붉은색)
            fig.add_trace(go.Bar(
                x=list(range(len(comparison_df))),  # 인덱스 기반 X축
                y=comparison_df['augmented'],
                name='증강',
                marker_color='lightcoral',
                opacity=0.8,
                text=comparison_df['augmented'],
                textposition='auto',
                texttemplate='%{text:,}',
                textfont=dict(size=10)
            ))
            
            # 차트 제목 및 레이아웃 설정
            if unique_count == 2:
                title = f'{column} 이진 분포 대조'
            elif 3 <= unique_count <= 10:
                title = f'{column} 다중 레이블 분포 대조'
            else:
                title = f'{column} 범주형 분포 대조'
            
            fig.update_layout(
                title=dict(
                    text=title,
                    x=0.5,
                    font=dict(size=16, color='black')
                ),
                xaxis_title='카테고리',
                yaxis_title='개수',
                barmode='group',  # 그룹화된 막대 차트
                showlegend=True,
                legend=dict(
                    orientation="h",
                    yanchor="bottom",
                    y=1.02,
                    xanchor="right",
                    x=1
                ),
                plot_bgcolor='white',
                paper_bgcolor='white',
                font=dict(size=12),
                margin=dict(l=50, r=50, t=80, b=50)
            )
            
            # x축 설정 (그리드 제거, float 표시 개선)
            fig.update_xaxes(
                showgrid=False,  # 그리드 제거
                tickangle=45 if unique_count > 5 else 0,
                tickmode='array',
                ticktext=comparison_df['category'].astype(str).tolist(),
                tickvals=list(range(len(comparison_df)))
            )
            
            # y축 설정 (그리드 제거)
            fig.update_yaxes(
                showgrid=False  # 그리드 제거
            )
            
            return fig
        except Exception as e:
            # 오류 발생 시 빈 차트 반환
            fig = go.Figure()
            fig.add_annotation(
                text=f"차트 생성 중 오류 발생: {str(e)}",
                xref="paper", yref="paper",
                x=0.5, y=0.5, showarrow=False
            )
            return fig
    
    def get_comparison_summary(self, df_orig: pd.DataFrame, df_aug: pd.DataFrame, numeric_cols: List[str]) -> Dict[str, Any]:
        """비교 요약 통계를 반환합니다."""
        summary_stats = {}
        
        # 컬럼 존재 여부 확인
        available_cols = [col for col in numeric_cols if col in df_orig.columns and col in df_aug.columns]
        
        for col in available_cols:
            try:
                # NaN 값 처리 및 안전한 통계 계산
                orig_col = df_orig[col].dropna()
                aug_col = df_aug[col].dropna()
                
                if len(orig_col) == 0 or len(aug_col) == 0:
                    continue
                
                # 데이터 타입 확인 및 변환
                if not pd.api.types.is_numeric_dtype(orig_col) or not pd.api.types.is_numeric_dtype(aug_col):
                    continue
                
                # 통계 계산 전에 안전한 변환
                orig_col_clean = pd.to_numeric(orig_col, errors='coerce').dropna()
                aug_col_clean = pd.to_numeric(aug_col, errors='coerce').dropna()
                
                if len(orig_col_clean) == 0 or len(aug_col_clean) == 0:
                    continue
                
                orig_stats = {
                    'mean': float(orig_col_clean.mean()) if not pd.isna(orig_col_clean.mean()) else 0.0,
                    'std': float(orig_col_clean.std()) if not pd.isna(orig_col_clean.std()) else 0.0,
                    'min': float(orig_col_clean.min()) if not pd.isna(orig_col_clean.min()) else 0.0,
                    'max': float(orig_col_clean.max()) if not pd.isna(orig_col_clean.max()) else 0.0
                }
                
                aug_stats = {
                    'mean': float(aug_col_clean.mean()) if not pd.isna(aug_col_clean.mean()) else 0.0,
                    'std': float(aug_col_clean.std()) if not pd.isna(aug_col_clean.std()) else 0.0,
                    'min': float(aug_col_clean.min()) if not pd.isna(aug_col_clean.min()) else 0.0,
                    'max': float(aug_col_clean.max()) if not pd.isna(aug_col_clean.max()) else 0.0
                }
                
                summary_stats[col] = {
                    'original': orig_stats,
                    'augmented': aug_stats,
                    'changes': {
                        'mean_change': aug_stats['mean'] - orig_stats['mean'],
                        'std_change': aug_stats['std'] - orig_stats['std']
                    }
                }
            except Exception as e:
                # 개별 컬럼에서 오류 발생 시 해당 컬럼 건너뛰기
                continue
        
        return summary_stats
    
    def get_numeric_columns(self, df: pd.DataFrame) -> List[str]:
        """수치형 컬럼 목록을 반환합니다."""
        return df.select_dtypes(include=[np.number]).columns.tolist()
    
    def get_categorical_columns(self, df: pd.DataFrame) -> List[str]:
        """범주형 컬럼 목록을 반환합니다. (타임시리즈 데이터 제외, 레이블링된 데이터 포함)"""
        categorical_cols = []
        
        # 1. object/category 타입 컬럼 (기본 범주형)
        object_cols = df.select_dtypes(include=['object', 'category']).columns.tolist()
        
        for col in object_cols:
            try:
                # 타임시리즈 데이터 필터링
                if self._is_timeseries_column(df[col]):
                    continue
                categorical_cols.append(col)
            except:
                # 오류 발생 시 포함
                categorical_cols.append(col)
        
        # 2. 수치형 컬럼에서 범주형으로 처리할 수 있는 컬럼
        numeric_cols = df.select_dtypes(include=[np.number]).columns.tolist()
        
        for col in numeric_cols:
            try:
                if self._is_categorical_numeric(df[col]):
                    categorical_cols.append(col)
            except:
                continue
        
        return categorical_cols
    
    def _is_timeseries_column(self, series: pd.Series) -> bool:
        """타임시리즈 컬럼인지 확인합니다."""
        try:
            sample_data = series.dropna().head(20)
            if len(sample_data) == 0:
                return False
            
            # 날짜/시간 패턴 확인
            time_patterns = [
                '202', '201', '200', '199',  # 연도
                'jan', 'feb', 'mar', 'apr', 'may', 'jun',  # 월
                'jul', 'aug', 'sep', 'oct', 'nov', 'dec',
                '월', '화', '수', '목', '금', '토', '일',  # 요일
                'am', 'pm', '오전', '오후',  # 시간
                ':', '-', '/', '\\'  # 구분자
            ]
            
            for val in sample_data:
                val_str = str(val).lower()
                if any(pattern in val_str for pattern in time_patterns):
                    return True
            
            # 숫자로만 구성된 경우 추가 확인
            numeric_count = 0
            unique_values = set()
            for val in sample_data:
                val_str = str(val).strip()
                if val_str.replace('.', '').replace('-', '').isdigit():
                    numeric_count += 1
                unique_values.add(val_str)
            
            # 숫자 비율이 높고 고유값이 많은 경우 타임시리즈로 간주
            if numeric_count / len(sample_data) > 0.8 and len(unique_values) > 10:
                return True
                
            return False
            
        except:
            return False
    
    def _is_categorical_numeric(self, series: pd.Series) -> bool:
        """수치형 컬럼이 범주형으로 처리 가능한지 확인합니다."""
        try:
            sample_data = series.dropna().head(50)
            if len(sample_data) == 0:
                return False
            
            unique_count = len(set(sample_data))
            
            # 고유값이 적은 경우 범주형으로 간주
            if unique_count <= 20:
                min_val = min(sample_data)
                max_val = max(sample_data)
                
                # 이진 데이터 (0, 1) 또는 소수의 정수값들
                if (min_val == 0 and max_val == 1) or (unique_count <= 10 and max_val - min_val <= 20):
                    return True
            
            return False
            
        except:
            return False 