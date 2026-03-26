# 대시보드 UI
# https://docs.streamlit.io/knowledge-base/deploy/increase-file-uploader-limit-streamlit-cloud
# https://docs.streamlit.io/library/advanced-features/configuration#set-configuration-options
# 실행방법1: streamlit run recomendation.py
# 실행방법2: streamlit run recomendation.py --server.maxUploadSize 500 --server.maxMessageSize 500 (업로드 파일 용량 증대할 경우)
# import time # 코드 실행 시간 측정 시 사용
# sqlite:///./database/database.db
# AxiosError: Request failed with status code 403 in streamlit 발생 시, enableXsrfProtection 입력하여 실행
# streamlit run recomendation.py --server.enableXsrfProtection false

# streamlit 1.24.0 이상 버전에서 파일 업로드할 경우 AxiosError: Request failed with status code 403 발생할 수 있음
# AxiosError 403 에러 발생 시 streamlit==1.24.0 버전으로 변경 
# pip install streamlit==1.24.0

# import ray
import json
import requests
import pandas as pd
import streamlit as st
from recommendation.lib.template import Template
from recommendation.lib.prepro import Preprocessing
# from database.connector import Database # , SelectTB
from io import StringIO
import time
import numpy as np
import plotly.express as px


# import matplotlib.pyplot as plt
# import seaborn as sns


st.set_page_config(layout="wide")
st.sidebar.title("Details")

# 분류, 이상 탐지 등 추천받을 머신러닝 모델 선택
option = st.sidebar.selectbox(
    '머신러닝 유형 선택', ('분류', '이상탐지', '회귀'))
connecton_option = st.sidebar.selectbox(
    'Select how to upload data', ('File_upload', 'DB_connection'))

uploaded_file = None
df = None

if connecton_option == 'File_upload':
    uploaded_file = st.sidebar.file_uploader("csv file upload", type="csv") # 파일 업로드
    if uploaded_file:
        df = pd.read_csv(uploaded_file)

with st.spinner('Wait for it...'):
    updated_df = None
    # Uploaded data Dashboard
    if uploaded_file is not None or df is not None:
        template = Template(df)
        st.subheader('데이터 분석')
        col_list = df.columns.tolist() # 데이터 전처리 옵션 설정 리스트
        target_feture = ""
        if option == '분류' or option == '회귀':
            target_feture = st.sidebar.multiselect('Select Target Column', options=col_list)
        data_to_drop = st.sidebar.multiselect('Drop Cloumns', options=col_list)
        data_for_labelencoding = st.sidebar.multiselect('Choose LabelEncoding column name', options=col_list)
        
        tab_eda_df, tab_eda_info, tab_Label_counts = st.tabs(['Original data', 'Null information', 'Target Data Counts']) # tab_Label_counts Labels counts
        # tab_eda_df, tab_eda_info tab UI Template
        template.eda_df(tab_eda_df=tab_eda_df, tab_eda_info=tab_eda_info)
        label_to_drop = ""
        with tab_Label_counts: # Target Data 정보 출력 및 시각화
            if target_feture:            
                label_to_drop = template.label_to_drop(target_feture) # 제거할 Target 데이터 선택
            else:
                template.sample_df()

  
        if data_for_labelencoding:
            prepro = Preprocessing()
            if updated_df is None:
                # st.write(type(df[data_for_labelencoding]))
                df = prepro.encoded_df(df, data_for_labelencoding[0])
                updated_df = df
            if updated_df is not None:
                updated_df = prepro.encoded_df(updated_df, data_for_labelencoding[0])

       
        if data_to_drop:
            for data in data_to_drop:
                updated_df = df.drop(data_to_drop, axis=1)

     
        try:
            if label_to_drop:
                target_feture = target_feture[0]
                label_to_drop = label_to_drop[0]
                updated_df = df[df[target_feture] != label_to_drop]
        except ValueError:
            st.write('1개 이상 데이터가 남아있어야 합니다.')

        # 데이터 전처리된 데이터 출력
        if updated_df is not None: 
            st.subheader('데이터 전처리')
            st.dataframe(updated_df, use_container_width=True)
        
        if st.sidebar.button("초기화"):
            st.cache_resource.clear()


#################### Starting ML traning
        button_for_training = st.sidebar.button("머신러닝 테스트 실행", key="button1") 
        if button_for_training: # 분류, 이상탐지 옵션에 따라 머신러닝 학습 진행
            start_time = time.time()
            # start_time = time.time() # 학습 시간 체크 시 설정


            if option == '분류':
                st.subheader('머신러닝 학습 결과')
                with st.spinner('Wait for it...'):
                    if updated_df is None:
                        updated_df = df   

                    json_data = updated_df.to_json() # pandas DataFrame를 json 형태로 변환
                    data_dump = json.dumps({'json_data':json_data, 'target': target_feture}) # 학습 데이터, Target Data 객체를 문자열로 직렬화(serialize)
                    data = json.loads(data_dump) # json을 파이썬 객체로 변환
                    response = requests.post('http://industry_backend:8000/recommendation/new_clf', json=data) # 127.0.0.1 / new_clf

                    if response.status_code == 200: 
                        json_data = response.json() 
                        data = json.loads(json_data['result'])
                        #     0. accuracy 1. recall 2. precision 3. f1_weighted
                        accuracy_best_df = pd.read_json(StringIO(data['0']['best']))
                        accuracy_trial_df = pd.read_json(StringIO(data['0']['trial']))

                        recall_best_df = pd.read_json(StringIO(data['1']['best']))
                        recall_trial_df = pd.read_json(StringIO(data['1']['trial']))
                        
                        precision_best_df = pd.read_json(StringIO(data['2']['best']))
                        precision_trial_df = pd.read_json(StringIO(data['2']['trial']))

                        f1score_best_df = pd.read_json(StringIO(data['3']['best']))
                        f1score_trial_df = pd.read_json(StringIO(data['3']['trial']))

                        concat_df = pd.concat([accuracy_best_df, recall_best_df, precision_best_df, f1score_best_df], axis=1)
                        sorted_concat_df = concat_df.sort_values(by='f1_weighted', ascending=False)

                        # 모델 추천
                        st.title('Augmented Analysis')
                        st.line_chart(sorted_concat_df)

                        st.subheader('Model Recommendations')
                        st.dataframe(sorted_concat_df, use_container_width=True)
                        

                        data = updated_df
                        # 데이터 유형 확인
                        # data_types = data.dtypes

                        # 수치형 데이터 확인
                        numeric_cols = data.select_dtypes(include=[np.number]).columns.tolist()
                        # 범주형 데이터 확인
                        categorical_cols = data.select_dtypes(include=['object']).columns.tolist()

                        preprocessing_recommendations = []

                        # 수치형 데이터에 대한 전처리 기법 추천
                        for col in numeric_cols:
                            preprocessing_recommendations.append({
                                'Column': col,
                                'Recommended Preprocessing 1': 'Normalization (Min-Max Scaling)',
                                'Recommended Preprocessing 2': 'Standardization (Z-score)',
                                'Recommended Preprocessing 3': 'Outlier Detection (IQR method)'
                            })

                        # 범주형 데이터에 대한 전처리 기법 추천
                        for col in categorical_cols:
                            preprocessing_recommendations.append({
                                'Column': col,
                                'Recommended Preprocessing 1': 'One-Hot Encoding',
                                'Recommended Preprocessing 2': 'Label Encoding',
                                'Recommended Preprocessing 3': 'Handling Missing Values (Imputation)'
                            })

                        # 추천 데이터프레임으로 변환
                        prepro_recommendations_df = pd.DataFrame(preprocessing_recommendations)

                        # 결과를 Streamlit으로 표시
                        st.subheader("Recommended preprocessing techniques for each column")
                        st.dataframe(prepro_recommendations_df, use_container_width=True)


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
                        vis_recommendations_df = pd.DataFrame(visualization_recommendations)

                        st.subheader("Recommended visualization charts for each column")
                        st.dataframe(vis_recommendations_df, use_container_width=True)
                        reset_df = sorted_concat_df.reset_index()
                        concat_recommendation = pd.DataFrame([reset_df.iloc[0, 0], prepro_recommendations_df.iloc[0, 1], vis_recommendations_df.iloc[0, 1]],  ['Model', 'Preprocessing', 'Visualizations'])
                        # concat_recommendation.columns = ['Model', 'Preprocessing', 'Visualization']
                        st.subheader('Recommended Results')
                        st.dataframe(concat_recommendation.T, use_container_width=True)



