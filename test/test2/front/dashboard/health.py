import streamlit as st
import pandas as pd
import numpy as np

# from st_pages import add_page_title, get_nav_from_toml
st.set_page_config(layout='wide')

st.sidebar.title('Monitoring System')
st.sidebar.subheader('Dashboard')
st.sidebar.subheader('Data Source')
st.sidebar.subheader('Workflow')
st.sidebar.subheader('Pipeline')
st.sidebar.subheader('Bigdata archiving')
st.sidebar.subheader('Logs')

# df = pd.read_csv('../../data/Test_01.csv')
# st.write(df)
col1, col2, col3, col4 = st.columns(4)

with col1:
    with st.container(border=True):
        st.metric("Data Source", "11")
with col2:
    with st.container(border=True):
        st.metric("Checks", "7")
with col3:
    with st.container(border=True):
        st.metric("Last Incident", "8:30 PM")
with col4:
    with st.container(border=True):
        st.metric("Last Check", "11:45 PM")


# 랜덤 시드 설정
np.random.seed(0)

# 1개월 동안의 날짜 생성
date_range = pd.date_range(start='2024-10-01', periods=30, freq='D')

# 샘플 데이터 생성
data = {
    "date": date_range,
    "original_value": np.random.choice([np.nan, "valid_data", "invalid_data"], size=30, p=[0.2, 0.7, 0.1]),
}

# 전처리 함수 정의
def preprocess(value):
    if pd.isnull(value):
        return "Failure"  # 결측치인 경우
    elif value == "valid_data":
        return "Success"  # 유효한 데이터인 경우
    else:
        return "Failure"  # 유효하지 않은 데이터인 경우

# 전처리 실행
data["status"] = [preprocess(val) for val in data["original_value"]]

# 데이터프레임 생성
df = pd.DataFrame(data)

# 날짜별로 성공 및 실패 카운트
status_counts = df.groupby(['date', 'status']).size().unstack(fill_value=0)

# 누적 성공 및 실패 계산
status_counts['Success'] = status_counts['Success'].cumsum()
status_counts['Failure'] = status_counts['Failure'].cumsum()




# 샘플 데이터 생성
data = {
    "Database": [f"Database {i}" for i in range(1, 11)],  
    "Progress": np.random.randint(0, 100, size=10)  # 0에서 100 
}

# 데이터프레임 생성
data_df = pd.DataFrame(data)


# 두 개의 열 생성 (col1, col2)
col1, col2 = st.columns(2)

col1, col2 = st.columns(2)


with col1:
    with st.container(border=True):
        st.subheader('Data Health Check')
        st.bar_chart(status_counts[['Success', 'Failure']], height=350, width=1000, use_container_width=True)

# col2에 데이터 편집기 추가
with col2:
    with st.container(border=True):
        st.subheader('Data Source Check')
        st.data_editor(
            pd.DataFrame(data_df),  # 직접 데이터프레임을 전달
            column_config={
                "Progress": st.column_config.ProgressColumn(
                    "Progress",
                    format="%d%%",  # 퍼센트 형식
                    min_value=0,
                    max_value=100,
                ),
            },
            hide_index=True, use_container_width=True, height=350, width=500
        )

