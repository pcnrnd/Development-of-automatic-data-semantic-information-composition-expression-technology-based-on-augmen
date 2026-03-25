import streamlit as st
import pandas as pd
import numpy as np
import plotly.express as px

st.set_page_config(layout='wide')

# 데이터 입력 받기
uploaded_file = st.sidebar.file_uploader("CSV 파일을 업로드하세요", type=["csv"])

if uploaded_file is not None:
    # CSV 파일 읽기
    data = pd.read_csv(uploaded_file)
    
    st.title("데이터 분포 분석 및 시각화")
    st.dataframe(data, use_container_width=True, height=300)    
    st.markdown("---")

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
                    st.plotly_chart(fig_hist, use_container_width=True)
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
                    st.plotly_chart(fig_bar, use_container_width=True)
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
                    st.plotly_chart(fig_box, use_container_width=True)
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
                    st.plotly_chart(fig_pie, use_container_width=True)
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
                    st.plotly_chart(fig_scatter, use_container_width=True)
                except Exception as e:
                    st.error(f"산점도 생성 오류: {str(e)}")
            else:
                st.info("두 개의 수치형 컬럼을 선택해주세요")
        st.markdown("---")
        st.header("📊 데이터 통계 요약")
        
        # 전체 데이터셋 정보
        col1, col2, col3, col4 = st.columns(4)
        with col1:
            st.metric("총 행 수", f"{data.shape[0]:,}")
        with col2:
            st.metric("총 열 수", f"{data.shape[1]:,}")
        with col3:
            missing_count = data.isnull().sum().sum()
            st.metric("결측값 개수", f"{missing_count:,}")
        with col4:
            duplicate_count = data.duplicated().sum()
            st.metric("중복 행 수", f"{duplicate_count:,}")
        
        st.markdown("---")
        

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
            st.plotly_chart(fig_corr, use_container_width=True)
        else:
            st.info("상관관계 분석을 위해서는 최소 2개의 수치형 컬럼이 필요합니다.")

        # 수치형 컬럼 통계 요약
        if len(numeric_cols) > 0:
            st.subheader("🔢 수치형 컬럼 통계")
            numeric_stats = data[numeric_cols].describe()
            st.dataframe(numeric_stats, use_container_width=True)
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
            st.dataframe(pd.DataFrame(categorical_stats), use_container_width=True)
            st.markdown("---")
        

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
