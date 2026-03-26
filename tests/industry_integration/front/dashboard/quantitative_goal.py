import streamlit as st
import pandas as pd
import numpy as np
import plotly.express as px

st.set_page_config(layout='wide')
# 제목 설정
st.title("Data visualization recommendation")

# 데이터 입력 받기
uploaded_file = st.sidebar.file_uploader("CSV 파일을 업로드하세요", type=["csv"])

if uploaded_file is not None:
    # CSV 파일 읽기
    data = pd.read_csv(uploaded_file)
    # 데이터 유형 확인
    data_types = data.dtypes

    # 수치형 데이터 확인
    numeric_cols = data.select_dtypes(include=[np.number]).columns.tolist()
    # 범주형 데이터 확인
    categorical_cols = data.select_dtypes(include=['object']).columns.tolist()


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

    # 추천 데이터프레임으로 변환
    recommendations_df = pd.DataFrame(visualization_recommendations)

    col1, col2, col3 = st.columns(3)

    with col1:
            # 히스토그램
        st.subheader("Histogram")
        fig_hist = px.histogram(data, x=numeric_cols[0], nbins=30)
        st.plotly_chart(fig_hist)


    with col2:
        # 막대그래프
        st.subheader("Bar chart")
        fig_bar = px.bar(data, x=categorical_cols[0])
        st.plotly_chart(fig_bar)

    with col3:
        # 박스플롯
        st.subheader("Box plot")
        fig_box = px.box(data, x=categorical_cols[0], y=numeric_cols[0])
        st.plotly_chart(fig_box)
    st.subheader("Recommended visualization charts for each column")
    st.dataframe(recommendations_df, use_container_width=True)
