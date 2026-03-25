# PATH_CCTV_DATA = './exhdd/industry_data/117.산업시설 열화상 CCTV 데이터/01.데이터/1.Training/원천데이터/*'
# PATH_CCTV_LABEL_DATA = './exhdd/industry_data/117.산업시설 열화상 CCTV 데이터/01.데이터/1.Training/라벨링데이터/*'

# PATH_SAND_DATA = './exhdd/industry_data/264.건설 모래 품질 관리데이터/01-1.정식개방데이터/Training/01.원천데이터/*'
# PATH_SAND_LABEL_DATA = './exhdd/industry_data/264.건설 모래 품질 관리데이터/01-1.정식개방데이터/Training/02.라벨링데이터/*'

import streamlit as st
import requests
import glob
import os

st.set_page_config(layout='wide')


with st.form('show_file_list'):
    st.write('Show file list')
    submitted = st.form_submit_button("Submit")
    if submitted:
        try:
            response = requests.get('http://industry_backend:8000/preprocessing/read_file_list')
            if response.status_code == 200:
                select_result = response.json()
                st.json(select_result)
                st.selectbox('File list', list(select_result['paths']))

            else:
                st.error(f"Failed to submit data: {response.status_code}")
                st.write(response.status_code)
        except Exception as e:
            st.error(f'An error occurred: {e}')

col1, col2 = st.columns(2)
with col1:
    with st.form("path_and_tablee_name"):
        st.write("Input path and table name")

        text_data = st.text_input('input data path')
        table_name = st.text_input('input table name')

        json_data = {'abs_path': text_data,
                    'table_name': table_name}

        submitted = st.form_submit_button("Submit")
        if submitted:
            try:
                response = requests.post('http://industry_backend:8000/preprocessing/add_file_data', json=json_data)

                # 응답 처리
                if response.status_code == 200:
                    st.success("Data submitted successfully!")
                    st.json(response.json())  # API 응답 데이터 출력
                else:
                    st.error(f"Failed to submit data: {response.status_code}")
                    st.write(response.text)  # 오류 메시지 출력
            except Exception as e:
                st.error(f"An error occurred: {e}")

with col2:
    with st.form("Show tables"):
        st.write('Check table name')
        submitted = st.form_submit_button("Submit")
        if submitted:
            try:
                response = requests.get('http://industry_backend:8000/preprocessing/show_tables')

                # 응답 처리
                if response.status_code == 200:
                    st.success("Data submitted successfully!")
                    st.json(response.json())  # API 응답 데이터 출력
                else:
                    st.error(f"Failed to submit data: {response.status_code}")
                    st.write(response.text)  # 오류 메시지 출력
            except Exception as e:
                st.error(f"An error occurred: {e}")

    with st.form('select data'):
        table_name = st.text_input('input table name')
        submitted = st.form_submit_button("Submit")
        if submitted:
            try:
                response = requests.get(f'http://industry_backend:8000/preprocessing/read_file_data/{table_name}')
                if response.status_code == 200:
                    st.success('Query success!')
                    st.json(response.json())
                else:
                    st.error(f"Failed to submit data: {response.status_code}")
                    st.write(response.text)  # 오류 메시지 출력         
            except Exception as e:
                st.error(f'An error occurred: {e}')
