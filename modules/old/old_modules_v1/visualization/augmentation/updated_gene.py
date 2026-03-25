import json
import requests
import pandas as pd
import streamlit as st
from tabs.tab_vis import *
from gene_lib.sampling_lib import *
from sklearn.preprocessing import LabelEncoder
from imblearn.over_sampling import SMOTE 
from collections import Counter
from io import StringIO
import time

st.set_page_config( # 레이아웃 설정
        page_title="Data generator",
        layout="wide"
    )

with st.spinner('Wait for it...'): # 로딩이 완료되지 않으면 "Wair for it..."이  UI에 등장
    
    st.sidebar.title("Details") # sidebar
    uploaded_file = st.sidebar.file_uploader("csv file upload", type="csv") # 파일 업로드
    if uploaded_file is None: 
        st.write(
        '''
        ### 데이터증강 실행 방법
        1. Upload csv file
        2. Select Target Column 
        3. Drop cloumns
        4. Target data 정수 인코딩
        5. 제거할 Target 데이터 선택
        
        ''')
                 
    # @st.cache_data
    def load_data(uploaded_file):
        return pd.read_csv(uploaded_file)
    

    # 변수 선언 및 변수 초기화
    updated_df = None
    feature_selection = None
    target_feature = "" # 예측할 Label
    # target_feature = [0] # target_feature가 tuple로 감싸져 있어서 인덱싱
    le = LabelEncoder() # LabelEncoder 객체 선언 
    sampling_threshold = 0 # Binary class 임계값 초기화
    minority_boost_option = False  # 소수 클래스 추가 증강 옵션 초기화
    minority_boost_ratio = 100  # 소수 클래스 추가 증강 비율 초기화 
#################### sidebar
    if uploaded_file is not None: # 파일을 업로드해야 데이터전처리 옵션설정 가능
        st.subheader('데이터 분석')
        df = load_data(uploaded_file)
        col_list = df.columns.tolist() # multiselect list

        # 데이터 전처리 옵션 설정
        target_feature = st.sidebar.multiselect('Select Target Column', options=col_list) # 타겟 데이터 선택(필수)
        drop_columns = st.sidebar.multiselect('Drop Cloumns', options=col_list) # 불필요한 컬럼 제거
        data_for_labelencoding = st.sidebar.multiselect('Target data 정수 인코딩', options=col_list) # 타겟 데이터가 str인 경우, 선택
        feature_selection = st.sidebar.multiselect('Target data 유형 선택', options=['Multiclass', 'Binary class']) # 타겟 데이터의 필드값이 여러개인 경우 Multiclass, 2개인 경우 Binary class
        
        # 임계값 설정 (선택된 유형에 따라 동적으로 표시)
        sampling_threshold = 50  # 기본값
        
        if feature_selection:
            if feature_selection[0] == 'Multiclass':
                sampling_threshold = st.sidebar.slider('Multiclass 증강 비율 설정', 100, 200, 100,
                                                     help='모든 클래스에 적용되는 기본 증강 비율\n'
                                                          '• 100%: 원본 데이터과 동일 (증강 없음)\n'
                                                          '• 150%: 원본 데이터의 1.5배 크기로 증강\n'
                                                          '• 200%: 원본 데이터의 2배 크기로 증강')
                
                # 소수 클래스 추가 증강 옵션
                minority_boost_option = st.sidebar.checkbox('소수 클래스 추가 증강', 
                                                          help='소수 클래스를 더 많이 증강하여 클래스 불균형을 해결합니다')
                
                minority_boost_ratio = 100  # 기본값
                if minority_boost_option:
                    minority_boost_ratio = st.sidebar.slider('소수 클래스 추가 증강 비율', 150, 500, 200,
                                                            help='소수 클래스에 추가로 적용할 증강 비율\n'
                                                                 '• 150%: 기본 증강된 데이터의 1.5배 추가 증강\n'
                                                                 '• 200%: 기본 증강된 데이터의 2배 추가 증강\n'
                                                                 '• 300%: 기본 증강된 데이터의 3배 추가 증강')
                    
            elif feature_selection[0] == 'Binary class':
                sampling_threshold = st.sidebar.slider('Binary Class 증강 비율 설정', 0, 100, 50,
                                                     help='소수 클래스의 목표 비율 설정\n'
                                                          '• 0%: 소수 클래스를 다수 클래스와 동일한 비율로 증강\n'
                                                          '• 50%: 소수 클래스를 전체의 50% 비율로 증강\n'
                                                          '• 100%: 소수 클래스를 전체의 100% 비율로 증강')
        # else:
        #     # 선택하지 않은 경우 기본값으로 Multiclass 처리
        #     sampling_threshold = st.sidebar.slider('자동 Multiclass 증강 비율 설정', 50, 200, 80,
        #                                           help='모든 클래스를 최대 클래스의 몇 % 수준으로 증강할지 설정 (50-200%)')

#################### Original Data tabs
        tab_raw_df, tab_null_info, tab_label_counts = st.tabs(['Original data', 'Null information', 'Target counts'])
        with tab_raw_df: # Original data tab
            st.subheader("Original data")
            st.dataframe(df, use_container_width=True)

        with tab_null_info: # null information tab
            eda_null_info(df) # tabs > tab_vis (디렉토리에 있는 경로 확인)

        label_to_drop = ""
        val_counts_df = None
        with tab_label_counts: # Target data counts tab
            st.write("Label counts")
            val_counts_df = None
            if target_feature:            
                val_counts = df[target_feature].value_counts().reset_index()
                val_counts_df = pd.DataFrame({'Labels': val_counts.iloc[:, 0],
                                            'Counts': val_counts.iloc[:, 1]})
                
                st.dataframe(val_counts_df, use_container_width=True)
                # Target Data 설정해야 제거할 Label 선택 가능
                label_to_drop = st.sidebar.multiselect('제거할 Target 데이터 선택', options=val_counts_df.iloc[:, 0])
                bar_data = val_counts_df
                bar_data.index = val_counts_df['Labels']
                st.bar_chart(bar_data['Counts'])
            else:
                sample_df = pd.DataFrame({'Label': ['Select Target Column'],
                                        'Counts': ['Select Target Column']})
                st.write(sample_df) # Target데이터 선택
 
#################### Target Label 삭제      
    
        try:
            if label_to_drop:                                                                    # 제거할 Target label data
                if updated_df is None:
                    target_feature = target_feature[0]
                    label_to_drop = label_to_drop[0]
                    updated_df = df[df[target_feature] != label_to_drop]                         # 제거할 데이터만 제외하고 데이터프레임 업데이트
                if updated_df is not None: 
                    for drop_label in label_to_drop:
                        updated_df = updated_df[updated_df[target_feature] != drop_label]
        except ValueError:
            st.write('1개 이상 Label이 남아있어야 합니다.')

#################### LabelEncoding     
    
        label_col_name = ""  
        # print("==========", label_col_name)                 
                                              # Label Data
        if data_for_labelencoding:                                                              # 데이터프레임에 str 타입이 있는 경우, int 타입으로 정수 인코딩
            label_col_name = data_for_labelencoding[0]   
            # print("==========", label_col_name)   
            if updated_df is None:   
                if label_col_name == target_feature:
                    df[target_feature] = le.fit_transform(df[target_feature])                   # fit_transform 사용할 경우, 학습과 인코딩 동시에 가능
                # df[label_col_name] = le.fit_transform(df[label_col_name])                       # target 데이터가 아닌 str 타입의 데이터 정수 인코딩
                updated_df = df

            if updated_df is not None:
                # Label Encoding 실행
                if label_col_name == target_feature[0]:
                    updated_df[label_col_name] = le.fit_transform(updated_df[label_col_name])
                    print(f"Label Encoding 완료: {label_col_name}")
                    print(f"인코딩된 라벨: {updated_df[label_col_name].unique()}")

#################### 제거할 column 데이터

        try:
            if drop_columns:
                if updated_df is None:
                    updated_df = df.drop(drop_columns, axis=1)
                else:
                    updated_df = updated_df.drop(drop_columns, axis=1)
        except ValueError:
            st.write('1개 이상 데이터가 남아있어야 합니다.')
                
#################### generator_button & Clear

        generator_button = st.sidebar.button('데이터 증강', use_container_width=True)

        if st.sidebar.button("초기화", use_container_width=True):
            st.cache_resource.clear()

############### preprocessing
        sampling_df = None
        if updated_df is not None: 
            st.subheader('데이터 전처리')
            st.dataframe(updated_df)


#################### sampling strategy
        try:
            if generator_button:
                start_time = time.time()
                if updated_df is None:
                    updated_df = df
                
                st.subheader('Generated Data')
                with st.spinner('Wait for it...'):
                    target = target_feature
                    # print(updated_df[target_feature].value_counts().keys())

                    selected_feature_df = None
                    sampling_strategy = None
                    thresh_ratio = (sampling_threshold / 100)
                    thresh = thresh_ratio

                    # sampling_strategy 기본값 설정
                    sampling_strategy = 'auto'
                    
                    if feature_selection:
                        if feature_selection[0] == 'Multiclass':
                            # Multiclass: 각 클래스별로 원본 개수에 임계값 비율만큼 증강
                            if data_for_labelencoding and label_col_name:
                                # Label Encoding된 경우
                                unique_labels = updated_df[label_col_name].unique()
                                value_counts = updated_df[label_col_name].value_counts()
                                
                                # 각 클래스별로 원본 개수에 임계값 비율 적용
                                sampling_strategy = {}
                                
                                # 소수 클래스 추가 증강이 활성화된 경우
                                if minority_boost_option:
                                    # 평균 개수 계산 (소수 클래스 판단 기준)
                                    mean_count = value_counts.mean()
                                    
                                    for label in unique_labels:
                                        original_count = value_counts[label]
                                        
                                        # 평균보다 적은 클래스는 추가 증강
                                        if original_count < mean_count:
                                            # 기본 증강 + 추가 증강
                                            base_count = int(original_count * (sampling_threshold / 100))
                                            boost_count = int(base_count * (minority_boost_ratio / 100))
                                            target_count = base_count + boost_count
                                        else:
                                            # 평균 이상인 클래스는 기본 증강만
                                            target_count = int(original_count * (sampling_threshold / 100))
                                        
                                        sampling_strategy[int(label)] = target_count
                                        
                                        # 디버깅용 출력
                                        print(f"클래스 {label}: 원본={original_count}, 목표={target_count}")
                                        
                                        # 사용자에게 계산 과정 표시
                                        # if original_count < mean_count:
                                        #     st.write(f"🔍 **클래스 {label} (소수 클래스)**: "
                                        #            f"원본 {original_count}개 → "
                                        #            f"기본증강 {base_count}개 → "
                                        #            f"추가증강 {boost_count}개 → "
                                        #            f"최종 {target_count}개")
                                else:
                                    # 기존 방식: 모든 클래스에 동일한 비율 적용
                                    for label in unique_labels:
                                        original_count = value_counts[label]
                                        target_count = int(original_count * (sampling_threshold / 100))
                                        sampling_strategy[int(label)] = target_count
                
                            else:
                                # Label Encoding이 없는 경우
                                unique_labels = updated_df[target_feature[0]].unique()
                                value_counts = updated_df[target_feature[0]].value_counts()
                                
                                sampling_strategy = {}
                                
                                # 소수 클래스 추가 증강이 활성화된 경우
                                if minority_boost_option:
                                    # 평균 개수 계산 (소수 클래스 판단 기준)
                                    mean_count = value_counts.mean()
                                    
                                    for label in unique_labels:
                                        original_count = value_counts[label]
                                        
                                        # 평균보다 적은 클래스는 추가 증강
                                        if original_count < mean_count:
                                            # 기본 증강 + 추가 증강
                                            base_count = int(original_count * (sampling_threshold / 100))
                                            boost_count = int(base_count * (minority_boost_ratio / 100))
                                            target_count = base_count + boost_count
                                        else:
                                            # 평균 이상인 클래스는 기본 증강만
                                            target_count = int(original_count * (sampling_threshold / 100))
                                        
                                        sampling_strategy[label] = target_count
                                        
                                        # 디버깅용 출력
                                        print(f"클래스 {label}: 원본={original_count}, 목표={target_count}")
                                        
                                        # 사용자에게 계산 과정 표시
                                        # if original_count < mean_count:
                                        #     st.write(f"🔍 **클래스 {label} (소수 클래스)**: "
                                        #            f"원본 {original_count}개 → "
                                        #            f"기본증강 {base_count}개 → "
                                        #            f"추가증강 {boost_count}개 → "
                                        #            f"최종 {target_count}개")
                                else:
                                    # 기존 방식: 모든 클래스에 동일한 비율 적용
                                    for label in unique_labels:
                                        original_count = value_counts[label]
                                        target_count = int(original_count * (sampling_threshold / 100))
                                        sampling_strategy[label] = target_count
                                
                        if feature_selection[0] == 'Binary class':
                            sampling_strategy = thresh
     
           
                    sampling_df = None # sampling_df 초기화
                    
                    # 증강 전략 정보 표시
                    if feature_selection and feature_selection[0] == 'Multiclass':
                        if minority_boost_option:
                            st.info(f"🔧 **소수 클래스 추가 증강 활성화**\n"
                                   f"- 기본 증강 비율: {sampling_threshold}% (모든 클래스에 적용)\n"
                                   f"- 소수 클래스 추가 증강 비율: {minority_boost_ratio}% (평균 미만 클래스에만 적용)\n"
                                   f"- 소수 클래스 판단 기준: 전체 클래스의 평균 개수 미만\n"
                                   f"- 최종 증강 공식: (원본개수 × {sampling_threshold}%) + (기본증강개수 × {minority_boost_ratio}%)")
                        else:
                            st.info(f"📊 **균등 증강 모드**\n"
                                   f"- 모든 클래스에 동일한 증강 비율 적용: {sampling_threshold}%\n"
                                   f"- 증강 공식: 원본개수 × {sampling_threshold}%\n"
                                   f"- 결과: 각 클래스의 상대적 비율은 유지됨")
                    
                    # SMOTE 실행을 위한 변수 설정
                    if data_for_labelencoding and label_col_name:
                        # Label Encoding된 경우
                        target_col = label_col_name
               
                    else:
                        # Label Encoding이 없는 경우
                        target_col = target_feature[0]
                       
                    X_over_resampled, y_over_resampled = SMOTE(sampling_strategy=sampling_strategy).fit_resample(
                        updated_df.drop(target_col, axis=1), 
                        updated_df[target_col]
                    )
                    sampling_df = X_over_resampled
                    sampling_df[target_col] = y_over_resampled
                   

 

    #################### 증강된 데이터 전, 후 비교 출력
                    # st.write(target)
                    df_before = updated_df
                    df_before = df_before.drop(target, axis=1)
                    df_after = sampling_df
                    df_after = df_after.drop(target, axis=1)
                    
                    compare_tab_data = {'before_data': df_before.to_json(), 'after_data': df_after.to_json()}
                    compare_dump_data = json.dumps(compare_tab_data)
                    compare_json_data = json.loads(compare_dump_data) 
                    compare_response = requests.post('http://127.0.0.1:8000/compare', json=compare_json_data)
                    if compare_response.status_code == 200:
                        compare_response_data = compare_response.json()
                        compare_result_data = compare_response_data['compare_result'] 

                        tab_names = list(compare_result_data.keys())
                        tabs = st.tabs(tab_names)

                        for idx, tab_name in enumerate(tab_names):
                            with tabs[idx]:
                                df_data = pd.read_json(StringIO(compare_result_data[tab_name]))
                                st.area_chart(df_data, color=['#7cfc00','#00bfff'] ) # , color=['#7cfc00','#00bfff'] 

        #################### 증강한 데이터 출력
                    original_data, oversampling_data = st.columns(2) 
                    with original_data:
                        original_tab(df, target_feature)  # 시각화 변경 시 tab_vis.py 코드 참고

                    with oversampling_data:
                        sampling_tab(sampling_df, target) # 시각화 변경 시 tab_vis.py 코드 참고
                
                end_time = time.time()
                execution_time = end_time - start_time  # 실행 시간 계산
                print(f"코드 실행 시간: {execution_time} 초")
        # 데이터 전처리가 잘못 되었을 경우, 아래 설명 출력
        except ValueError as e:
            st.write(e)
            st.write('최소 2개 이상 Label이 있어합니다.')
            st.write('Target Label이 1개인 경우, 제거해야합니다.')
            st.write('데이터 전처리가 완료되어야 합니다.')
            st.write('Binary class인 경우, Multiclass가 적용되지 않습니다.')            
            # st.write(e)
        except AttributeError as e:
            st.write(e)
            st.write('전처리가 완료되어야 합니다.')
            # st.write(e)

        # 증강한 데이터 csv로 다운로드
        def convert_df(df):
            return df.to_csv().encode('utf-8')
        csv = None
        if sampling_df is not None:
            csv = convert_df(sampling_df)
        
        if csv is not None:
            st.sidebar.download_button(
                label="Download data as CSV",
                data=csv,
                file_name='sampling_data.csv',
                mime='text/csv',
                use_container_width=True
            )
    
