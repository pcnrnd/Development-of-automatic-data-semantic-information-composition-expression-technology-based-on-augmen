import json
import requests
import pandas as pd
import streamlit as st
from lib.template import Template
from lib.prepro import Preprocessing
from io import StringIO
import time
import numpy as np
import plotly.express as px


st.set_page_config(layout="wide")
st.sidebar.title("Details")

# 분류, 이상 탐지 등 추천받을 머신러닝 모델 선택
option = st.sidebar.selectbox(
    '머신러닝 유형 선택', ('분류', '회귀'))
connecton_option = st.sidebar.selectbox(
    'Select how to upload data', ('File_upload'))

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
        impute_null = st.sidebar.radio('Choose Impute Null column name', options=['ffill(forward fill)', 'bfill(backward fill)'])

        tab_eda_df, tab_eda_info, tab_Label_counts = st.tabs(['Original data', 'Null information', 'Target Data Counts']) # tab_Label_counts Labels counts
    
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


        if impute_null:
            if updated_df is None:
                if impute_null == 'ffill(forward fill)':
                    updated_df = df.ffill()
                if impute_null == 'bfill(backward fill)':
                    updated_df = df.bfill()
            if updated_df is not None:
                if impute_null == 'ffill(forward fill)':
                    updated_df = updated_df.ffill()
                if impute_null == 'bfill(backward fill)':
                    updated_df = updated_df.bfill()

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
                    response = requests.post('http://127.0.0.1:8000/new_clf', json=data) 
                    if response.status_code == 200: 
                        json_data = response.json() 
                        data = json.loads(json_data['result'])
                        #     0. accuracy 1. recall 2. precision 3. f1_weighted
                        accuracy_best_df = pd.read_json(StringIO(data['0']['best']))
                        recall_best_df = pd.read_json(StringIO(data['1']['best']))
                        precision_best_df = pd.read_json(StringIO(data['2']['best']))
                        f1score_best_df = pd.read_json(StringIO(data['3']['best']))

                        concat_df = pd.concat([accuracy_best_df, recall_best_df, precision_best_df, f1score_best_df], axis=1)
                        sorted_concat_df = concat_df.sort_values(by='f1_weighted', ascending=False)

                        # 모델 추천 시각화
                        st.line_chart(sorted_concat_df)

                        st.subheader('Model Recommendations')
                        st.dataframe(sorted_concat_df, use_container_width=True)
                  
                        st.subheader('Recommended Result')
                        st.dataframe(sorted_concat_df.head(1), use_container_width=True)

            if option == '회귀':
                st.subheader('머신러닝 학습 결과')
                with st.spinner('Wait for it...'):
                    if updated_df is None:
                        updated_df = df   

                    json_data = updated_df.to_json() # pandas DataFrame를 json 형태로 변환
                    data_dump = json.dumps({'json_data':json_data, 'target': target_feture}) # 학습 데이터, Target Data 객체를 문자열로 직렬화(serialize)
                    data = json.loads(data_dump) # json을 파이썬 객체로 변환
                    response = requests.post('http://127.0.0.1:8000/new_reg', json=data) 
                    if response.status_code == 200: 
                        json_data = response.json() 
                        data = json.loads(json_data['result'])

                        #     0. neg_mean_squared_error 1. neg_mean_absolute_error
                        neg_mean_squared_error_best_df = pd.read_json(StringIO(data['0']['best']))
                        neg_mean_absolute_error_best_df = pd.read_json(StringIO(data['1']['best']))

                        concat_df = pd.concat([neg_mean_squared_error_best_df, neg_mean_absolute_error_best_df], axis=1)
                        sorted_concat_df = concat_df.sort_values(by='neg_mean_absolute_error', ascending=False)

                        # 모델 추천 시각화
                        st.line_chart(sorted_concat_df)

                        st.subheader('Model Recommendations')
                        st.dataframe(sorted_concat_df, use_container_width=True)
                  
                        st.subheader('Recommended Result')
                        st.dataframe(sorted_concat_df.head(1), use_container_width=True)

