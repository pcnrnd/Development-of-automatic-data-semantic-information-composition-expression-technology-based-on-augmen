import streamlit as st
import pandas as pd
import numpy as np
import plotly.express as px
import sys
import os

# 상위 디렉토리를 Python 경로에 추가
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# lib 모듈에서 추상화된 클래스들 임포트
from lib import TimeSeriesAugmenter, DataVisualizer, DataUtils

st.set_page_config(layout='wide')
st.title("⏰ 시계열 데이터 증강 및 시각화 도구")

# 클래스 인스턴스 생성
timeseries_augmenter = TimeSeriesAugmenter()
visualizer = DataVisualizer()

uploaded_file = st.sidebar.file_uploader("CSV 파일을 업로드하세요 (시계열 데이터)", type=["csv"])

if uploaded_file is not None:
    # 데이터 로드
    df = DataUtils.load_csv_file(uploaded_file)
    
    if df is not None and DataUtils.validate_data(df):
        # 데이터 정보 표시
        DataUtils.display_data_info(df)
        DataUtils.display_missing_values_info(df)
        
        # 원본 데이터 미리보기
        DataUtils.show_data_preview(df, "원본 데이터 미리보기")
        st.markdown("---")

        # 날짜 컬럼 자동 감지
        date_cols = timeseries_augmenter.detect_date_columns(df)
        
        if len(date_cols) == 0:
            st.error("❌ 날짜/시간 컬럼이 포함된 데이터를 업로드해주세요.")
            st.info("💡 시계열 분석을 위해서는 다음 중 하나의 컬럼이 필요합니다:")
            st.markdown("""
            - **날짜 컬럼**: 'date', 'datetime', 'time', 'timestamp' 등이 포함된 컬럼명
            - **날짜 형식 데이터**: 실제 날짜/시간 값이 포함된 컬럼
            """)
        else:
            date_col = st.selectbox("날짜/시간 컬럼 선택", date_cols)
            df[date_col] = pd.to_datetime(df[date_col])

            st.subheader("시계열 데이터 시각화")
            numeric_cols = visualizer.get_numeric_columns(df)
            
            if len(numeric_cols) == 0:
                st.warning("⚠️ 수치형 컬럼이 없습니다.")
                st.info("💡 시계열 시각화를 위해서는 수치형 데이터가 필요합니다:")
                st.markdown("""
                - **수치형 컬럼**: 숫자 형태의 데이터 (예: 매출, 온도, 가격 등)
                - **현재 데이터 타입**: 
                """)
                # 현재 데이터 타입 표시
                type_info = df.dtypes.to_frame('데이터 타입')
                type_info['컬럼명'] = type_info.index
                st.dataframe(type_info[['컬럼명', '데이터 타입']], use_container_width=True)

            st.markdown("---")
            st.subheader("시계열 데이터 증강")
            
            # 수치형 컬럼이 있는 경우에만 증강 옵션 제공
            if len(numeric_cols) > 0:
                method = st.selectbox("증강 방법 선택", timeseries_augmenter.get_supported_methods())
                
                # 증강 방법별 파라미터 설정
                params = timeseries_augmenter.get_method_parameters(method)
                
                # 데이터 증강 수행
                df_aug = timeseries_augmenter.augment_timeseries(df, date_col, method, **params)

                # 증강 데이터 미리보기
                DataUtils.show_data_preview(df_aug, "증강 데이터 미리보기")

                # 증강 전후 비교 섹션 추가
                st.markdown("---")
                st.subheader("📊 증강 전후 비교")
                
                # 기본 통계 비교
                col1, col2 = st.columns(2)
                
                with col1:
                    st.markdown("**📈 원본 데이터 통계**")
                    st.write(f"행 수: {len(df):,}")
                    st.write(f"열 수: {len(df.columns)}")
                    st.write(f"기간: {df[date_col].min()} ~ {df[date_col].max()}")
                    if numeric_cols:
                        st.write("수치형 컬럼 통계:")
                        numeric_stats = df[numeric_cols].describe()
                        st.dataframe(numeric_stats, use_container_width=True)
                
                with col2:
                    st.markdown("**📈 증강 데이터 통계**")
                    st.write(f"행 수: {len(df_aug):,}")
                    st.write(f"열 수: {len(df_aug.columns)}")
                    st.write(f"기간: {df_aug[date_col].min()} ~ {df_aug[date_col].max()}")
                    if numeric_cols:
                        st.write("수치형 컬럼 통계:")
                        numeric_stats_aug = df_aug[numeric_cols].describe()
                        st.dataframe(numeric_stats_aug, use_container_width=True)
                
                # 증강 효과 시각화
                st.markdown("**📊 증강 전후 시계열 비교**")
                selected_compare = st.selectbox("비교할 수치형 컬럼 선택", numeric_cols, key="compare_select")
                
                # 시각화 타입 선택
                timeseries_viz_type = st.radio("시각화 타입", ["나란히 비교", "겹쳐서 비교"], horizontal=True, key="timeseries_viz_type")
                
                if timeseries_viz_type == "나란히 비교":
                    col1, col2 = st.columns(2)
                    
                    with col1:
                        st.markdown("**원본 시계열**")
                        fig_orig = visualizer._create_line_chart(df, date_col, selected_compare, title=f"원본 {selected_compare} 시계열")
                        st.plotly_chart(fig_orig, use_container_width=True, key="compare_orig")
                    
                    with col2:
                        st.markdown("**증강 시계열**")
                        fig_aug = visualizer._create_line_chart(df_aug, date_col, selected_compare, title=f"증강 {selected_compare} 시계열")
                        st.plotly_chart(fig_aug, use_container_width=True, key="compare_aug")
                
                else:  # 겹쳐서 비교
                    st.markdown("**겹쳐진 시계열 비교**")
                    st.info("💡 파란색: 원본 데이터, 빨간색: 증강 데이터")
                    
                    fig_overlap_line = visualizer.create_overlapping_line_chart(df, df_aug, date_col, selected_compare)
                    st.plotly_chart(fig_overlap_line, use_container_width=True, key="overlap_line")
                
                # 증강 효과 요약
                st.markdown("**📋 증강 효과 요약**")
                summary_col1, summary_col2, summary_col3 = st.columns(3)
                
                with summary_col1:
                    st.metric("데이터 증가율", f"{((len(df_aug) - len(df)) / len(df) * 100):.1f}%")
                
                with summary_col2:
                    if numeric_cols:
                        orig_mean = df[selected_compare].mean()
                        aug_mean = df_aug[selected_compare].mean()
                        mean_change = ((aug_mean - orig_mean) / orig_mean * 100) if orig_mean != 0 else 0
                        st.metric("평균 변화율", f"{mean_change:.1f}%")
                
                with summary_col3:
                    if numeric_cols:
                        orig_std = df[selected_compare].std()
                        aug_std = df_aug[selected_compare].std()
                        std_change = ((aug_std - orig_std) / orig_std * 100) if orig_std != 0 else 0
                        st.metric("표준편차 변화율", f"{std_change:.1f}%")
                
                # 산점도 비교 (수치형 컬럼이 2개 이상인 경우)
                if len(numeric_cols) >= 2:
                    st.markdown("**📊 증강 전후 산점도 비교**")
                    st.info("💡 산점도를 통해 시간과 수치형 컬럼 간의 관계 변화를 확인할 수 있습니다.")
                    
                    # 산점도 시각화 타입 선택
                    scatter_viz_type = st.radio("산점도 시각화 타입", ["나란히 비교", "겹쳐서 비교"], horizontal=True, key="scatter_viz_type")
                    
                    if scatter_viz_type == "나란히 비교":
                        col1, col2 = st.columns(2)
                        
                        with col1:
                            st.markdown("**원본 데이터 산점도**")
                            y_col_orig = st.selectbox("Y축 컬럼 (원본)", numeric_cols, key="scatter_y_orig")
                            
                            if y_col_orig:
                                fig_orig_scatter = visualizer._create_scatter_plot(df, date_col, y_col_orig, title=f"원본: {date_col} vs {y_col_orig}")
                                if fig_orig_scatter:
                                    st.plotly_chart(fig_orig_scatter, use_container_width=True, key="orig_scatter")
                        
                        with col2:
                            st.markdown("**증강 데이터 산점도**")
                            y_col_aug = st.selectbox("Y축 컬럼 (증강)", numeric_cols, key="scatter_y_aug")
                            
                            if y_col_aug:
                                fig_aug_scatter = visualizer._create_scatter_plot(df_aug, date_col, y_col_aug, title=f"증강: {date_col} vs {y_col_aug}")
                                if fig_aug_scatter:
                                    st.plotly_chart(fig_aug_scatter, use_container_width=True, key="aug_scatter")
                    
                    else:  # 겹쳐서 비교
                        st.markdown("**겹쳐진 산점도 비교**")
                        st.info("💡 파란색: 원본 데이터, 빨간색: 증강 데이터")
                        
                        y_col_overlap = st.selectbox("Y축 컬럼", numeric_cols, key="scatter_y_overlap")
                        
                        if y_col_overlap:
                            fig_overlap_scatter = visualizer.create_overlapping_scatter(df, df_aug, date_col, y_col_overlap)
                            st.plotly_chart(fig_overlap_scatter, use_container_width=True, key="overlap_scatter")
                    
                    # 산점도 비교 분석
                    if (scatter_viz_type == "나란히 비교" and y_col_orig and y_col_aug) or \
                       (scatter_viz_type == "겹쳐서 비교" and y_col_overlap):
                        st.markdown("**📋 산점도 비교 분석**")
                        
                        # 상관관계 비교 (시간과의 관계)
                        if scatter_viz_type == "나란히 비교":
                            orig_corr = df[date_col].dt.dayofyear.corr(df[y_col_orig])
                            aug_corr = df_aug[date_col].dt.dayofyear.corr(df_aug[y_col_aug])
                        else:
                            orig_corr = df[date_col].dt.dayofyear.corr(df[y_col_overlap])
                            aug_corr = df_aug[date_col].dt.dayofyear.corr(df_aug[y_col_overlap])
                        
                        corr_col1, corr_col2, corr_col3 = st.columns(3)
                        
                        with corr_col1:
                            st.metric("원본 시간 상관계수", f"{orig_corr:.3f}")
                        
                        with corr_col2:
                            st.metric("증강 시간 상관계수", f"{aug_corr:.3f}")
                        
                        with corr_col3:
                            corr_change = aug_corr - orig_corr
                            st.metric("상관계수 변화", f"{corr_change:.3f}", delta=f"{corr_change:.3f}")
                        
                        # 데이터 포인트 수 비교
                        point_col1, point_col2, point_col3 = st.columns(3)
                        
                        with point_col1:
                            st.metric("원본 데이터 포인트", f"{len(df):,}개")
                        
                        with point_col2:
                            st.metric("증강 데이터 포인트", f"{len(df_aug):,}개")
                        
                        with point_col3:
                            point_change = len(df_aug) - len(df)
                            point_change_pct = (point_change / len(df)) * 100
                            st.metric("포인트 증가", f"{point_change:,}개", delta=f"{point_change_pct:.1f}%")

                st.markdown("---")

                st.subheader("증강 데이터 다운로드")
                DataUtils.create_download_button(df_aug, "augmented_timeseries.csv")
            else:
                st.warning("⚠️ 시계열 증강을 위해서는 수치형 컬럼이 필요합니다.")
                st.info("💡 증강 가능한 수치형 데이터를 추가해주세요.")
            
else:
    st.info("👈 왼쪽 사이드바에서 시계열 CSV 파일을 업로드하세요!")
    with st.expander("📋 지원되는 데이터 형식"):
        st.markdown("""
        - **필수**: 날짜/시간 컬럼이 포함되어야 합니다 (예: 'date', 'datetime', 'time' 등)
        - **수치형 데이터**: 시계열 차트 및 증강에 사용
        - **CSV 파일 형식**만 지원됩니다
        """)
