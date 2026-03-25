import streamlit as st
import pandas as pd
import numpy as np
import plotly.express as px
import plotly.graph_objects as go
import time
from plotly.subplots import make_subplots

st.set_page_config(
    page_title="증강 데이터 분석 시각화", 
    layout="wide",
    initial_sidebar_state="expanded"
)

st.title("📊 증강 데이터 분석 및 시각화 대시보드")

# ------------------------------
# 1. 데이터 업로드 (원본 + 증강)
# ------------------------------
st.sidebar.subheader("📁 데이터 업로드")

# st.sidebar.write("**원본 데이터**")
original_file = st.sidebar.file_uploader(
    "원본 CSV 또는 Excel 파일", 
    type=["csv", "xlsx"], 
    key="original",
    help="증강 전 원본 데이터 파일을 업로드하세요"
)

# st.sidebar.write("**증강 데이터**")
augmented_file = st.sidebar.file_uploader(
    "증강 CSV 또는 Excel 파일", 
    type=["csv", "xlsx"], 
    key="augmented",
    help="증강 후 데이터 파일을 업로드하세요"
)

# 데이터 로드 함수
def load_data(file):
    """파일을 읽어서 DataFrame으로 반환"""
    if file is None:
        return None
    
    try:
        if file.name.endswith(".csv"):
            # CSV 파일 읽기 - 여러 인코딩 시도
            encodings = ['utf-8', 'cp949', 'euc-kr', 'iso-8859-1', 'latin-1']
            for encoding in encodings:
                try:
                    # 파일을 여러 인코딩으로 시도하여 읽기 위해서는,
                    # 파일 포인터를 항상 처음(0)으로 돌려야 합니다.
                    # 그렇지 않으면 첫 한 번 읽은 뒤에는 파일 포인터가 끝에 위치해
                    # 다시 읽기를 시도해도 빈 값을 반환할 수 있습니다.
                    file.seek(0)
                    df = pd.read_csv(file, encoding=encoding)
                    return df
                except UnicodeDecodeError:
                    continue
            return None
        else:
            return pd.read_excel(file)
    except Exception as e:
        st.error(f"파일 읽기 오류: {str(e)}")
        return None

# 데이터 로드
original_df = load_data(original_file)
augmented_df = load_data(augmented_file)


if original_df is not None and augmented_df is not None:
    st.success("✅ 원본 데이터와 증강 데이터가 모두 업로드되었습니다!")
    data_preview = st.sidebar.multiselect("데이터 미리보기", ["원본 데이터", "증강 데이터"])
    # 데이터 타입 분석
    numeric_cols = st.sidebar.multiselect("수치형 데이터 선택", original_df.columns.tolist())
    # categorical_cols = st.sidebar.multiselect("증강 수치형 데이터 선택", augmented_df.columns.tolist())
    # numeric_cols = original_df.select_dtypes(include=[np.number]).columns.tolist()
    # categorical_cols = original_df.select_dtypes(exclude=[np.number]).columns.tolist()
    
    # ------------------------------
    # 2. 핵심 지표 카드
    # ------------------------------
    st.markdown("---")
    st.subheader("데이터 요약")
    
    # 핵심 지표 정보를 데이터프레임으로 변환하여 표시
    indicators = [
        {
            "지표": "원본 데이터",
            "값": f"{len(original_df):,}",
            "설명": f"행 × {len(original_df.columns):,}열"
        },
        {
            "지표": "증강 데이터",
            "값": f"{len(augmented_df):,}",
            "설명": f"행 × {len(augmented_df.columns):,}열"
        },
        {
            "지표": "증강 비율",
            "값": f"{len(augmented_df) / len(original_df):.2f}x",
            "설명": f"{((len(augmented_df) - len(original_df)) / len(original_df)) * 100:.1f}% 증가"
        },
        {
            "지표": "증가량",
            "값": f"{len(augmented_df) - len(original_df):,}",
            "설명": "새로운 데이터"
        }
    ]
    indicators_df = pd.DataFrame(indicators)
    st.dataframe(indicators_df, hide_index=True, width='stretch')
    # ------------------------------
    # 3. 시각화 분석 섹션
    # ------------------------------
    st.markdown("---")
    
    # ------------------------------
    # 데이터 미리보기
    # ------------------------------
    st.subheader("데이터 미리보기")
    col1, col2 = st.columns(2)

    if data_preview:
        if "원본 데이터" in data_preview:
            with col1:
                st.write("**원본 데이터**")
                st.dataframe(original_df.head(10), width='stretch')
                st.info(f"원본 데이터 크기: {original_df.shape[0]:,}행 × {original_df.shape[1]:,}열")

        if "증강 데이터" in data_preview:
            with col2:
                st.write("**증강 데이터**")
                st.dataframe(augmented_df.head(10), width='stretch')
                st.info(f"증강 데이터 크기: {augmented_df.shape[0]:,}행 × {augmented_df.shape[1]:,}열")
    else:
        st.info("데이터 미리보기를 위해서는 데이터 미리보기 옵션을 선택해주세요")
    # data_preview = st.sidebar.multiselect("데이터 미리보기", ["원본 데이터", "증강 데이터"])


    # ------------------------------
    # 통계 비교
    # ------------------------------
    st.markdown("---")
    
    st.subheader("통계 비교")
    if numeric_cols:
        # 통계 요약 비교
        original_stats = original_df[numeric_cols].describe()
        augmented_stats = augmented_df[numeric_cols].describe()
        
        col1, col2 = st.columns(2)
        
        with col1:
            st.write("**원본 데이터 통계**")
            st.dataframe(original_stats.round(3), width='stretch')
        
        with col2:
            st.write("**증강 데이터 통계**")
            st.dataframe(augmented_stats.round(3), width='stretch')
    else:
        st.info("수치형 컬럼이 없어 통계 비교를 수행할 수 없습니다.")

    # ------------------------------
    # 분포 비교 시각화
    # ------------------------------
    st.markdown("---")
    st.subheader("🎨 분포 비교 시각화")
    col1, col2 = st.columns(2)
    with col1:
        if numeric_cols:
            selected_col = st.selectbox("비교할 변수 선택", numeric_cols, key="dist_select")
            
            if selected_col:
                # 겹쳐진 히스토그램
                fig = go.Figure()
                
                # 증강 데이터 히스토그램 (뒤에 배치)
                fig.add_trace(go.Histogram(
                    x=augmented_df[selected_col].dropna(),
                    name='증강 데이터',
                    opacity=0.5,
                    marker_color='lightcoral'
                ))
                
                # 원본 데이터 히스토그램 (앞에 배치)
                fig.add_trace(go.Histogram(
                    x=original_df[selected_col].dropna(),
                    name='원본 데이터',
                    opacity=0.8,
                    marker_color='lightblue'
                ))
                
                fig.update_layout(
                    title=f'{selected_col} 분포 비교',
                    xaxis_title=selected_col,
                    yaxis_title='빈도',
                    barmode='overlay',
                    height=500
                )
                
                st.plotly_chart(fig)
                
                # 박스플롯 비교
                fig_box = go.Figure()
                
                # 증강 데이터 박스플롯 (뒤에 배치)
                fig_box.add_trace(go.Box(
                    y=augmented_df[selected_col].dropna(),
                    name='증강 데이터',
                    marker_color='lightcoral',
                    opacity=0.7
                ))
                
                # 원본 데이터 박스플롯 (앞에 배치)
                fig_box.add_trace(go.Box(
                    y=original_df[selected_col].dropna(),
                    name='원본 데이터',
                    marker_color='lightblue',
                    opacity=0.9
                ))
                
                # fig_box.update_layout(
                #     title=f'{selected_col} 박스플롯 비교',
                #     yaxis_title=selected_col,
                #     height=400
                # )
                
                # st.plotly_chart(fig_box, use_container_width=True)
        else:
            st.info("수치형 컬럼이 없어 분포 비교를 수행할 수 없습니다.")

    with col2:
        # 박스플롯
        if len(numeric_cols) > 0:
            selected_col = st.selectbox("박스플롯 컬럼 선택", numeric_cols, key="box_col")
            
            fig_box = go.Figure()
            fig_box.add_trace(go.Box(
                y=augmented_df[selected_col].dropna(),
                name='증강 데이터',
                marker_color='lightcoral',
                opacity=0.7
            ))
            fig_box.add_trace(go.Box(
                y=original_df[selected_col].dropna(),
                name='원본 데이터',
                marker_color='lightblue',
                opacity=0.9
            ))
            fig_box.update_layout(
                title=f'{selected_col} 박스플롯 비교',
                yaxis_title=selected_col,
                height=400
            )
            st.plotly_chart(fig_box)
        else:
            st.warning("박스플롯을 위해서는 최소 1개의 수치형 컬럼이 필요합니다.")


    # st.write("**산점도**")
    st.markdown("---")
    
    if len(numeric_cols) >= 2:
        col1, col2 = st.columns(2)
        with col1:
            x_axis = st.selectbox("X축 선택", numeric_cols, key="custom_x")
    
        with col2:
            y_axis = st.selectbox("Y축 선택", [col for col in numeric_cols if col != x_axis], key="custom_y")
        
        # 산점도
        fig_scatter = go.Figure()
        # fig_scatter.add_trace(go.Scatter(
        #     x=augmented_df[x_axis],
        #     y=augmented_df[y_axis],
        #     mode='markers',
        #     name='증강 데이터',
        #     marker=dict(color='red', opacity=1, size=6)
        # ))
        fig_scatter.add_trace(go.Scatter(
            x=original_df[x_axis],
            y=original_df[y_axis],
            mode='markers',
            name='원본 데이터',
            marker=dict(color='lightblue', opacity=1, size=8)
        ))
        fig_scatter.add_trace(go.Scatter(
            x=augmented_df[x_axis],
            y=augmented_df[y_axis],
            mode='markers',
            name='증강 데이터',
            marker=dict(color='lightcoral', opacity=0.5, size=6)
        ))
        fig_scatter.update_layout(
            title=f"산점도: {x_axis} vs {y_axis}",
            xaxis_title=x_axis,
            yaxis_title=y_axis,
            height=400
        )
        st.plotly_chart(fig_scatter)
        
    else:
        st.warning("산점도와 라인 차트를 위해서는 최소 2개의 수치형 컬럼이 필요합니다.")


    st.markdown("---")
    st.sidebar.subheader("데이터 유사도 분석")
    similarity_button = st.sidebar.button("유사도 분석 시작", width='stretch')
    if similarity_button:
        with st.spinner("유사도 분석 중..."):
            time.sleep(3)
            st.subheader("데이터 유사도 분석 결과")
            if len(numeric_cols) > 0:
                # st.write("**원본과 증강 데이터 간 코사인 유사도**")
                
                try:
                    # from sklearn.metrics.pairwise import cosine_similarity
                    
                    # # 코사인 유사도 계산 함수
                    # def calculate_cosine_similarity(original_df, augmented_df, numeric_cols):
                    #     """통계적 특성 기반 코사인 유사도 계산"""
                    #     similarity_results = {}
                        
                    #     for col in numeric_cols:
                    #         orig_data = original_df[col].dropna()
                    #         aug_data = augmented_df[col].dropna()
                            
                    #         if len(orig_data) > 0 and len(aug_data) > 0:
                    #             # 통계적 특성 추출 
                    #             orig_stats = [
                    #                 orig_data.mean(),
                    #                 orig_data.std(), 
                    #                 orig_data.median(),
                    #                 orig_data.quantile(0.25),
                    #                 orig_data.quantile(0.75),
                    #                 orig_data.skew(),  # 왜도
                    #                 orig_data.kurtosis()  # 첨도
                    #             ]
                                
                    #             aug_stats = [
                    #                 aug_data.mean(),
                    #                 aug_data.std(),
                    #                 aug_data.median(), 
                    #                 aug_data.quantile(0.25),
                    #                 aug_data.quantile(0.75),
                    #                 aug_data.skew(),
                    #                 aug_data.kurtosis()
                    #             ]
                                
                    #             # 코사인 유사도 계산
                    #             cosine_sim = cosine_similarity([orig_stats], [aug_stats])[0, 0]
                                
                    #             similarity_results[col] = {
                    #                 'Cosine Similarity': round(cosine_sim, 3)
                    #             }
                        
                    #     return similarity_results
                    import requests
                    response = requests.post('http://localhost:8000/anal/', json={'original_df': original_df.to_dict(), 'augmented_df': augmented_df.to_dict(), 'numeric_cols': numeric_cols})
                    if response.status_code == 200:
                        similarity_results = response.json()['similarity_results']
                    # 코사인 유사도 계산
                    # similarity_results = calculate_cosine_similarity(original_df, augmented_df, numeric_cols)
                    
                    if similarity_results:
                        # 결과 표시
                        sim_df = pd.DataFrame(similarity_results).T
                        sim_df = sim_df.sort_values('Cosine Similarity', ascending=False)
                    
                        
                        # 코사인 유사도 바 차트
                        fig_bar = px.bar(
                            sim_df.reset_index(),
                            x='index',
                            y='Cosine Similarity',
                            color='Cosine Similarity',
                            color_continuous_scale='RdYlGn',
                            # title='변수별 코사인 유사도',
                            labels={'index': '변수', 'Cosine Similarity': '코사인 유사도'}
                        )
                        fig_bar.update_layout(height=500)

                        col1, col2 = st.columns(2)
                        with col1:
                            st.write("**변수별 코사인 유사도 시각화 결과**")
                            st.plotly_chart(fig_bar)
                        with col2:
                            st.write("**원본과 증강 데이터 간 코사인 유사도 결과**")
                            st.dataframe(sim_df, width='stretch')
                        
                        # 전체 평균 코사인 유사도
                        avg_similarity = sim_df['Cosine Similarity'].mean()
                        st.metric("**전체 평균 코사인 유사도**", f"{avg_similarity:.3f}")
                        
                        # 유사도 해석
                        if avg_similarity >= 0.9:
                            st.success("✅ 매우 높은 유사도: 원본과 증강 데이터가 거의 동일한 방향성을 가집니다.")
                        elif avg_similarity >= 0.7:
                            st.info("ℹ️ 높은 유사도: 원본과 증강 데이터가 매우 유사한 방향성을 가집니다.")
                        elif avg_similarity >= 0.5:
                            st.warning("⚠️ 보통 유사도: 원본과 증강 데이터가 어느 정도 유사한 방향성을 가집니다.")
                        else:
                            st.error("❌ 낮은 유사도: 원본과 증강 데이터 간 방향성 차이가 큽니다.")
                        
                        # 상세 해석
                        # with st.expander("📊 코사인 유사도 설명"):
                        #     st.markdown("""
                        #     **코사인 유사도란?**
                        #     - 두 벡터 간의 각도를 측정하는 유사도 지표입니다
                        #     - 값의 범위: -1 ~ 1 (1에 가까울수록 유사)
                            
                        #     **참고:**
                        #     - **0.9 이상**: 매우 높은 유사도 - 거의 동일한 패턴
                        #     - **0.7-0.9**: 높은 유사도 - 매우 유사한 패턴
                        #     - **0.5-0.7**: 보통 유사도 - 어느 정도 유사한 패턴
                        #     - **0.5 미만**: 낮은 유사도 - 상당한 차이 존재
                            
                        #     """)
                    
                    else:
                        st.warning("코사인 유사도 분석을 수행할 수 있는 수치형 데이터가 없습니다.")
                
                except ImportError:
                    st.error("scikit-learn 라이브러리가 필요합니다.")
                    st.info("다음 명령어로 설치해주세요: `pip install scikit-learn`")

            else:
                st.warning("데이터 유사도 분석을 위해서는 최소 1개의 수치형 컬럼이 필요합니다.")


elif original_df is not None:
    st.warning("⚠️ 증강 데이터를 업로드해주세요.")
elif augmented_df is not None:
    st.warning("⚠️ 원본 데이터를 업로드해주세요.")
else:
    st.info("📁 원본 데이터와 증강 데이터를 모두 업로드하세요.")
    
    # 사용 가이드
    # with st.expander("📋 사용 가이드", expanded=True):
    #     st.markdown("""
    #     ### 🚀 증강 데이터 분석 대시보드 사용법
        
    #     **1. 데이터 업로드**
    #     - 원본 데이터와 증강 데이터를 각각 업로드하세요
    #     - CSV 또는 Excel 파일 형식을 지원합니다
    
    #     """)
