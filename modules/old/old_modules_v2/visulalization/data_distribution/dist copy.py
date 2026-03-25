import streamlit as st
import pandas as pd
import numpy as np
import plotly.express as px
from scipy import stats as scipy_stats
import time
from PIL import Image

transparent = Image.new("RGBA", (32, 32), (255, 255, 255, 0))
st.set_page_config(page_title="데이터 분포 분석 및 시각화", page_icon=transparent, layout="wide")

# 데이터 입력 받기
uploaded_file = st.sidebar.file_uploader("CSV 파일을 업로드하세요", type=["csv"])

if uploaded_file is not None:
    # CSV 파일 읽기
    data = pd.read_csv(uploaded_file)
    
    st.title("데이터 분포 분석 및 시각화")
    st.dataframe(data, width='stretch', height=300)    
    st.markdown("---")

    # 데이터 분석 및 인사이트 생성 함수들
    def analyze_data_quality(df):
        """데이터 품질 분석"""
        missing_ratio = df.isnull().sum().sum() / (df.shape[0] * df.shape[1]) * 100
        duplicate_ratio = df.duplicated().sum() / len(df) * 100
        
        quality_issues = []
        if missing_ratio > 10:
            quality_issues.append(f"결측값이 전체의 {missing_ratio:.1f}% 발견 (주의 필요)")
        if duplicate_ratio > 5:
            quality_issues.append(f"중복값이 전체의 {duplicate_ratio:.1f}% 발견")
        
        return missing_ratio, duplicate_ratio, quality_issues
    
    def detect_outliers(df, numeric_cols):
        """이상값 탐지"""
        outlier_info = []
        for col in numeric_cols:
            Q1 = df[col].quantile(0.25)
            Q3 = df[col].quantile(0.75)
            IQR = Q3 - Q1
            lower_bound = Q1 - 1.5 * IQR
            upper_bound = Q3 + 1.5 * IQR
            outliers = df[(df[col] < lower_bound) | (df[col] > upper_bound)]
            if len(outliers) > 0:
                outlier_ratio = len(outliers) / len(df) * 100
                outlier_info.append(f"{col}: {len(outliers)}개 ({outlier_ratio:.1f}%)")
        return outlier_info
    
    def analyze_distributions(df, numeric_cols, categorical_cols):
        """분포 특성 분석"""
        distribution_insights = []
        
        # 수치형 컬럼 분포 분석
        for col in numeric_cols:
            skewness = scipy_stats.skew(df[col].dropna())
            if abs(skewness) > 1:
                direction = "왼쪽" if skewness < 0 else "오른쪽"
                distribution_insights.append(f"{col}: {direction} 치우친 분포 (Skewness: {skewness:.2f})")
        
        # 범주형 컬럼 분포 분석
        for col in categorical_cols:
            value_counts = df[col].value_counts()
            if len(value_counts) > 0:
                max_freq = value_counts.iloc[0]
                total_count = len(df[col].dropna())
                if max_freq / total_count > 0.7:
                    distribution_insights.append(f"{col}: 한 값이 {max_freq/total_count*100:.1f}% 차지 (불균등 분포)")
        
        return distribution_insights
    
    def generate_recommendations(quality_issues, outlier_info, distribution_insights):
        """권장사항 생성"""
        recommendations = []
        
        if quality_issues:
            recommendations.append("결측값 처리 방법 검토 필요")
            recommendations.append("평균/중앙값 대체 vs 행 삭제 고려")
        
        if outlier_info:
            recommendations.append("이상값 원인 분석 권장")
            recommendations.append("데이터 수집 과정 검토")
        
        if distribution_insights:
            recommendations.append("데이터 변환 고려")
            recommendations.append("로그 변환, 정규화 등 적용 검토")
        
        return recommendations

    # 타입 분류 함수
    def smart_type_infer(df):
        numeric_cols, categorical_cols = [], []
        for col in df.columns:
            unique_count = df[col].nunique()
            unique_ratio = unique_count / len(df)
            colname = col.lower()
            # 컬럼명에 id, code, type 등이 포함되어 있으면 범주형
            if any(x in colname for x in ['id', 'code', 'type', 'category']):
                categorical_cols.append(col)
            # 고유값 개수/비율 기준
            elif df[col].dtype in ['int64', 'float64']:
                if unique_count <= 20 or unique_ratio < 0.05:
                    categorical_cols.append(col)
                else:
                    numeric_cols.append(col)
            else:
                categorical_cols.append(col)
        return numeric_cols, categorical_cols

    # 스마트 자동 분류 적용
    numeric_cols, categorical_cols = smart_type_infer(data)

    # --- 컬럼 타입 직접 지정 UI ---
    with st.container():
        st.title("📊 데이터 분포 분석 및 시각화")
        with st.expander("🔧 컬럼 타입 직접 지정", expanded=False):
            st.markdown("컬럼 타입이 잘못 분류된 경우, 아래에서 직접 선택해 주세요.")
            st.dataframe(pd.DataFrame({'컬럼명': data.columns, '타입': data.dtypes.astype(str)}))
            manual_numeric = st.multiselect("수치형(연속형) 컬럼 직접 선택", data.columns, default=numeric_cols)
            manual_categorical = st.multiselect("범주형(카테고리) 컬럼 직접 선택", data.columns, default=categorical_cols)
            numeric_cols = manual_numeric
            categorical_cols = manual_categorical
        st.markdown("---")

        # 시각화 추천 데이터프레임 생성
        visualization_recommendations = []
        for col in numeric_cols:
            visualization_recommendations.append({'Column': col, 
                                                'Recommended Visualizations1': 'Histogram',
                                                'Recommended Visualizations2': 'Bar chart',
                                                'Recommended Visualizations3': 'Box plot'})
        for col in categorical_cols:
            visualization_recommendations.append({'Column': col, 
                                                'Recommended Visualizations1': 'Bar chart',
                                                'Recommended Visualizations2': 'Pie chart',})
        recommendations_df = pd.DataFrame(visualization_recommendations)

        # 데이터 정보 표시
        st.info(f"📋 **데이터 정보**: {data.shape[0]}행, {data.shape[1]}열 | 수치형: {len(numeric_cols)}개, 범주형: {len(categorical_cols)}개")
        
        # 첫 번째 섹션: 기본 시각화 차트
        st.header("📈 기본 시각화 차트")
        with st.expander("🔧 차트 설정", expanded=True):
            select_col1, select_col2, select_col3 = st.columns(3)
            with select_col1:
                if len(numeric_cols) > 0:
                    selected_col = st.selectbox("히스토그램 컬럼", numeric_cols, key='hist_select')
                else:
                    st.warning("수치형 컬럼이 없습니다")
                    selected_col = None
            with select_col2:
                if len(categorical_cols) > 0:
                    selected_cat = st.selectbox("막대그래프 컬럼", categorical_cols, key='bar_select')
                else:
                    st.warning("범주형 컬럼이 없습니다")
                    selected_cat = None
            with select_col3:
                if len(categorical_cols) > 0 and len(numeric_cols) > 0:
                    selected_cat_box = st.selectbox("박스플롯 X축 컬럼", categorical_cols, key='box_cat_select')
                    selected_num_box = st.selectbox("박스플롯 Y축 컬럼", numeric_cols, key='box_num_select')
                else:
                    st.warning("박스플롯을 위한 컬럼이 부족합니다")
                    selected_cat_box = None
                    selected_num_box = None
        chart_col1, chart_col2, chart_col3 = st.columns(3)
        with chart_col1:
            st.markdown("**📊 히스토그램**")
            if selected_col and selected_col in numeric_cols:
                try:
                    fig_hist = px.histogram(data, x=selected_col, nbins=30, 
                                        title=f"Distribution of {selected_col}")
                    fig_hist.update_layout(height=400, showlegend=False)
                    st.plotly_chart(fig_hist)
                except Exception as e:
                    st.error(f"히스토그램 생성 오류: {str(e)}")
            else:
                st.info("수치형 컬럼을 선택해주세요")
        with chart_col2:
            st.markdown("**📊 막대그래프**")
            if selected_cat and selected_cat in categorical_cols:
                try:
                    value_counts = data[selected_cat].value_counts()
                    fig_bar = px.bar(x=value_counts.index, y=value_counts.values,
                                    title=f"Count of {selected_cat}")
                    fig_bar.update_layout(height=400, showlegend=False)
                    st.plotly_chart(fig_bar)
                except Exception as e:
                    st.error(f"막대그래프 생성 오류: {str(e)}")
            else:
                st.info("범주형 컬럼을 선택해주세요")
        with chart_col3:
            st.markdown("**📊 박스플롯**")
            if selected_cat_box and selected_num_box and selected_cat_box in categorical_cols and selected_num_box in numeric_cols:
                try:
                    fig_box = px.box(data, x=selected_cat_box, y=selected_num_box, 
                                    title=f"{selected_num_box} by {selected_cat_box}")
                    fig_box.update_layout(height=400, showlegend=False)
                    st.plotly_chart(fig_box)
                except Exception as e:
                    st.error(f"박스플롯 생성 오류: {str(e)}")
            else:
                st.info("범주형과 수치형 컬럼을 선택해주세요")
        st.markdown("---")
        st.header("📊 추가 시각화 차트")
        with st.expander("🔧 추가 차트 설정", expanded=True):
            select_col4, select_col5 = st.columns(2)
            with select_col4:
                if len(categorical_cols) > 0:
                    selected_pie = st.selectbox("파이차트 컬럼", categorical_cols, key='pie_select')
                else:
                    selected_pie = None
            with select_col5:
                if len(numeric_cols) >= 2:
                    selected_x = st.selectbox("산점도 X축 컬럼", numeric_cols, key='scatter_x_select')
                    selected_y = st.selectbox("산점도 Y축 컬럼", numeric_cols, key='scatter_y_select')
                else:
                    selected_x = None
                    selected_y = None
        chart_col4, chart_col5 = st.columns(2)
        with chart_col4:
            st.markdown("**📊 파이 차트**")
            if selected_pie and selected_pie in categorical_cols:
                try:
                    value_counts = data[selected_pie].value_counts()
                    fig_pie = px.pie(values=value_counts.values, names=value_counts.index,
                                    title=f"Distribution of {selected_pie}")
                    fig_pie.update_layout(height=400)
                    st.plotly_chart(fig_pie)
                except Exception as e:
                    st.error(f"파이차트 생성 오류: {str(e)}")
            else:
                st.info("범주형 컬럼을 선택해주세요")
        with chart_col5:
            st.markdown("**📊 산점도**")
            if selected_x and selected_y and selected_x in numeric_cols and selected_y in numeric_cols:
                try:
                    fig_scatter = px.scatter(data, x=selected_x, y=selected_y,
                                        color=selected_x, color_continuous_scale='viridis',
                                        title=f"{selected_y} vs {selected_x}")
                    fig_scatter.update_traces(marker=dict(size=8))
                    fig_scatter.update_layout(height=400)
                    st.plotly_chart(fig_scatter)
                except Exception as e:
                    st.error(f"산점도 생성 오류: {str(e)}")
            else:
                st.info("두 개의 수치형 컬럼을 선택해주세요")
        st.markdown("---")
        
        # 겹침 시각화 섹션 추가
        st.header("오버레이 히스토그램")
        with st.expander("🔧 겹침 차트 설정", expanded=True):
            overlay_col1, overlay_col2 = st.columns(2)
            with overlay_col1:
                if len(numeric_cols) >= 2:
                    selected_overlay_numeric = st.multiselect("오버레이 히스토그램 컬럼들", numeric_cols, 
                                                            default=numeric_cols[:2] if len(numeric_cols) >= 2 else numeric_cols,
                                                            key='overlay_hist_select')
                else:
                    selected_overlay_numeric = []

            with overlay_col2:
                overlay_alpha = st.slider("투명도 조절", 0.1, 1.0, 0.7, 0.1, key='overlay_alpha')
        
        
        if len(selected_overlay_numeric) >= 2:
            try:
                import plotly.graph_objects as go
                fig_overlay = go.Figure()
                
                colors = px.colors.qualitative.Set3[:len(selected_overlay_numeric)]
                
                for i, col in enumerate(selected_overlay_numeric):
                    fig_overlay.add_trace(go.Histogram(
                        x=data[col],
                        name=col,
                        opacity=overlay_alpha,
                        nbinsx=30,
                        marker_color=colors[i]
                    ))
                
                fig_overlay.update_layout(
                    title="여러 수치형 컬럼 분포 비교",
                    xaxis_title="값",
                    yaxis_title="빈도",
                    barmode='overlay',
                    height=400,
                    showlegend=True
                )
                st.plotly_chart(fig_overlay)
            except Exception as e:
                st.error(f"오버레이 히스토그램 생성 오류: {str(e)}")
        else:
            st.info("최소 2개의 수치형 컬럼을 선택해주세요")
    
        
        st.markdown("---")
        
        if st.sidebar.button("데이터 분석 시작", width='stretch'):
            time.sleep(2)
            st.header("📋 데이터 분석 인사이트 및 결론")

            # 상관관계 분석 (수치형 컬럼이 2개 이상일 때)
            if len(numeric_cols) >= 2:
                st.subheader("🔗 상관관계 분석")
                correlation_matrix = data[numeric_cols].corr()
                fig_corr = px.imshow(correlation_matrix, 
                                    text_auto=True, 
                                    aspect="auto",
                                    title="수치형 컬럼 간 상관관계",
                                    color_continuous_scale='RdBu_r')
                fig_corr.update_layout(height=500)
                st.plotly_chart(fig_corr)
            else:
                st.info("상관관계 분석을 위해서는 최소 2개의 수치형 컬럼이 필요합니다.")

            # 수치형 컬럼 통계 요약
            if len(numeric_cols) > 0:
                st.subheader("🔢 수치형 컬럼 통계")
                numeric_stats = data[numeric_cols].describe()
                st.dataframe(numeric_stats, width='stretch')
                st.markdown("---")
            
            # 범주형 컬럼 통계 요약
            if len(categorical_cols) > 0:
                st.subheader("📝 범주형 컬럼 통계")
                categorical_stats = []
                for col in categorical_cols:
                    stats = {
                        '컬럼명': col,
                        '고유값 개수': data[col].nunique(),
                        '최빈값': data[col].mode().iloc[0] if not data[col].mode().empty else 'N/A',
                        '최빈값 빈도': data[col].value_counts().iloc[0] if len(data[col].value_counts()) > 0 else 0,
                        '결측값 개수': data[col].isnull().sum()
                    }
                    categorical_stats.append(stats)
                st.dataframe(pd.DataFrame(categorical_stats), width='stretch')
                st.markdown("---")
                    
            # 분석 실행
            missing_ratio, duplicate_ratio, quality_issues = analyze_data_quality(data)
            outlier_info = detect_outliers(data, numeric_cols)
            distribution_insights = analyze_distributions(data, numeric_cols, categorical_cols)
            recommendations = generate_recommendations(quality_issues, outlier_info, distribution_insights)
            
            # 상세 분석 결과
            st.subheader("📊 상세 분석 결과")

            st.markdown("---")
            
            # 데이터 품질 분석 (확장 가능)

            with st.expander("🔍 데이터 품질 분석", expanded=True):
                col1, col2 = st.columns(2)
                with col1:
                    st.metric("결측값 비율", f"{missing_ratio:.1f}%", 
                            help="전체 데이터에서 결측값이 차지하는 비율입니다")
                with col2:
                    st.metric("중복값 비율", f"{duplicate_ratio:.1f}%",
                            help="전체 행에서 중복된 행이 차지하는 비율입니다")
                
                if quality_issues:
                    st.error("⚠️ 품질 이슈 발견:")
                    for issue in quality_issues:
                        st.write(f"• {issue}")
                else:
                    st.success("✅ 데이터 품질이 양호합니다")
            
            # 이상값 분석
            with st.expander("🔍 이상값 분석", expanded=True):
                if outlier_info:
                    st.info(f"총 {len(outlier_info)}개 컬럼에서 이상값이 발견되었습니다")
                    for outlier in outlier_info:
                        st.write(f"• {outlier}")
                else:
                    st.success("✅ 이상값이 발견되지 않았습니다")
            
            
            st.markdown("---")
            
            # 권장사항 (확장 가능)
            with st.expander("💡 단계별 권장사항", expanded=True):
                if recommendations:
                    st.info("분석 결과를 바탕으로 다음 단계를 권장합니다:")
                    for i, rec in enumerate(recommendations, 1):
                        st.write(f"**{i}단계**: {rec}")
                        
                        # 상세 설명 추가
                        if "결측값 처리" in rec:
                            st.caption("💡 팁: 결측값이 많은 경우 해당 행을 삭제하거나, 적은 경우 평균/중앙값으로 대체를 고려하세요")
                        elif "이상값" in rec:
                            st.caption("💡 팁: 이상값이 비즈니스적으로 의미있는지 확인하고, 단순히 제거하지 마세요")
                        elif "데이터 변환" in rec:
                            st.caption("💡 팁: 로그 변환, 제곱근 변환 등을 통해 정규분포에 가깝게 만들 수 있습니다")
                else:
                    st.success("✅ 추가적인 데이터 전처리가 필요하지 않습니다")

else:
    st.title("📊 데이터 분포 분석 및 시각화")
    st.markdown("---")
    st.info("👈 왼쪽 사이드바에서 CSV 파일을 업로드하여 데이터 시각화를 시작하세요!")
    with st.expander("📋 지원되는 데이터 형식"):
        st.markdown("""
        - **수치형 데이터**: 히스토그램, 박스플롯, 산점도에 적합
        - **범주형 데이터**: 막대그래프, 파이차트에 적합
        - **CSV 파일 형식**만 지원됩니다
        """)
