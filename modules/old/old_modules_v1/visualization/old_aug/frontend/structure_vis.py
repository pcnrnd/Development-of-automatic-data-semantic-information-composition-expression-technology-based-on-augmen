import streamlit as st
import pandas as pd
import numpy as np
import plotly.graph_objects as go
from typing import Dict, Any, Optional
from src.visualization import FrontendVisualization
from src.api import BackendClient, SessionManager
import requests


# 페이지 설정
st.set_page_config(layout='wide')
st.title("데이터 증강 및 시각화 도구")


BACKEND_URL = "http://localhost:8000"
# 컴포넌트 초기화
backend_client = BackendClient()
session_manager = SessionManager()
visualizer = FrontendVisualization()

# 기존 reset_session 함수는 session_manager.reset_session()으로 대체됨

def apply_local_augmentation(original_df: pd.DataFrame, params: Dict, methods: list) -> pd.DataFrame:
    """로컬에서 증강 처리"""
    try:
        augmented_df = original_df.copy()
        
        # 노이즈 추가
        if 'noise' in methods:
            numeric_cols = visualizer.get_numeric_columns(augmented_df)
            noise_level = params.get('noise_level', 0.05)
            for col in numeric_cols:
                if col in augmented_df.columns:
                    std_val = augmented_df[col].std()
                    if not pd.isna(std_val) and std_val > 0:
                        noise = np.random.normal(0, noise_level * std_val, len(augmented_df))
                        augmented_df[col] = augmented_df[col] + noise
        
        # 중복 추가 (증강 비율 적용)
        if 'duplicate' in methods:
            augmentation_ratio = params.get('augmentation_ratio', 0.5)
            dup_count = params.get('dup_count', 2)
            
            # 증강 비율에 따른 실제 복제 횟수 계산
            target_rows = int(len(original_df) * augmentation_ratio)
            actual_dup_count = max(2, int(target_rows / len(original_df)) + 1)
            
            for _ in range(actual_dup_count - 1):
                augmented_df = pd.concat([augmented_df, original_df], ignore_index=True)
        
        return augmented_df
        
    except Exception as e:
        st.error(f"로컬 증강 처리 중 오류: {str(e)}")
        return original_df.copy()

def call_backend_api(endpoint: str, method: str = "GET", data: Dict = None, files: Dict = None) -> Optional[Dict]:
    """백엔드 API를 호출하는 함수"""
    try:
        url = f"{BACKEND_URL}{endpoint}"
        
        # 타임아웃 설정
        timeout = 30
        
        if method == "GET":
            response = requests.get(url, timeout=timeout)
        elif method == "POST":
            if files:
                response = requests.post(url, files=files, timeout=timeout)
            else:
                response = requests.post(url, json=data, timeout=timeout)
        else:
            st.error(f"지원하지 않는 HTTP 메서드: {method}")
            return None
        
        if response.status_code == 200:
            return response.json()
        elif response.status_code == 404:
            st.error("세션이 만료되었습니다. 파일을 다시 업로드해주세요.")
            # 세션 상태 초기화
            st.session_state.session_id = None
            st.session_state.data_analysis = None
            st.session_state.augmentation_result = None
            return None
        elif response.status_code == 500:
            try:
                error_data = response.json()
                if 'detail' in error_data:
                    st.error(f"서버 오류: {error_data['detail']}")
                else:
                    st.error(f"서버 오류가 발생했습니다: {response.text}")
            except:
                st.error(f"서버 오류가 발생했습니다: {response.text}")
            return None
        else:
            st.error(f"API 호출 실패: {response.status_code} - {response.text}")
            return None
            
    except requests.exceptions.ConnectionError:
        st.error("백엔드 서버에 연결할 수 없습니다. 백엔드가 실행 중인지 확인해주세요.")
        return None
    except requests.exceptions.Timeout:
        st.error("요청 시간이 초과되었습니다. 다시 시도해주세요.")
        return None
    except Exception as e:
        st.error(f"API 호출 중 오류 발생: {str(e)}")
        return None

def upload_file_to_backend(uploaded_file) -> Optional[str]:
    """파일을 백엔드에 업로드하고 세션 ID를 반환"""
    try:
        # 파일 크기 검증 (10MB 제한)
        file_size = len(uploaded_file.getvalue())
        if file_size > 10 * 1024 * 1024:  # 10MB
            st.error("파일 크기가 너무 큽니다. 10MB 이하의 파일을 업로드해주세요.")
            return None
        
        # 로컬에서 DataFrame 생성 및 검증
        try:
            df = pd.read_csv(uploaded_file)
            if df.empty:
                st.error("빈 파일입니다. 데이터가 포함된 파일을 업로드해주세요.")
                return None
            if len(df.columns) == 0:
                st.error("유효하지 않은 CSV 파일입니다.")
                return None
        except Exception as e:
            st.error(f"CSV 파일 읽기 실패: {str(e)}")
            return None
        
        st.session_state.original_df = df
        
        # 백엔드에 업로드
        files = {"file": (uploaded_file.name, uploaded_file.getvalue(), "text/csv")}
        response = call_backend_api("/api/data/upload", method="POST", files=files)
        
        if response and response.get('success'):
            session_id = response['session_id']
            session_manager.set_session_id(session_id)
            # st.success(f"파일 업로드 성공! ({len(df)}행, {len(df.columns)}컬럼)")
            return session_id
        else:
            st.error("파일 업로드에 실패했습니다.")
            return None
            
    except Exception as e:
        st.error(f"파일 업로드 중 오류 발생: {str(e)}")
        return None

def check_session_status(session_id: str) -> bool:
    """세션 상태를 확인합니다."""
    if not session_id:
        return False
    
    response = call_backend_api(f"/api/session/status/{session_id}")
    if response and response.get('exists'):
        return True
    return False

def get_data_analysis(session_id: str) -> Optional[Dict]:
    """데이터 분석 결과를 백엔드에서 가져옴"""
    if not session_id:
        st.error("세션 ID가 없습니다.")
        return None
    
    # 세션 상태 확인
    if not check_session_status(session_id):
        st.error("세션이 만료되었습니다. 파일을 다시 업로드해주세요.")
        session_manager.reset_session()
        return None
    
    response = call_backend_api(f"/api/data/analyze/{session_id}")
    if response and response.get('success'):
        st.session_state.data_analysis = response
        return response
    return None

def get_data_preview(session_id: str, rows: int = 10) -> Optional[Dict]:
    """데이터 미리보기를 백엔드에서 가져옴"""
    response = call_backend_api(f"/api/data/preview/{session_id}?rows={rows}")
    return response if response and response.get('success') else None

def process_augmentation(session_id: str, params: Dict, methods: list) -> Optional[Dict]:
    """데이터 증강을 백엔드에서 실행"""
    try:
        if not session_id:
            st.error("세션 ID가 없습니다.")
            return None
        
        if not methods:
            st.error("증강 방법을 선택해주세요.")
            return None
        
        # 세션 상태 확인
        if not check_session_status(session_id):
            st.error("세션이 만료되었습니다. 파일을 다시 업로드해주세요.")
            session_manager.reset_session()
            return None
        
        augmentation_data = {
            "session_id": session_id,
            "methods": methods,
            **params
        }
        
        with st.spinner("🔄 데이터 증강 처리 중..."):
            response = call_backend_api("/api/augmentation/process", method="POST", data=augmentation_data)
            
        if response and response.get('success'):
            # 안전한 세션 상태 저장
            try:
                # 복잡한 객체는 간단한 형태로 변환하여 저장
                safe_response = {
                    'success': response.get('success', False),
                    'original_shape': response.get('original_shape', {}),
                    'augmented_shape': response.get('augmented_shape', {}),
                    'methods_used': response.get('methods_used', [])
                }
                session_manager.set_augmentation_result(safe_response)
            except Exception as e:
                st.warning(f"세션 상태 저장 중 오류: {str(e)}")
            
            # 증강된 데이터를 로컬 DataFrame으로 저장
            if session_manager.get_original_df() is not None:
                try:
                    # 간단한 증강 로직 (실제로는 백엔드에서 처리)
                    augmented_df = session_manager.get_original_df().copy()
                    
                    # 노이즈 추가
                    if 'noise' in methods:
                        numeric_cols = visualizer.get_numeric_columns(augmented_df)
                        noise_level = params.get('noise_level', 0.05)
                        for col in numeric_cols:
                            if col in augmented_df.columns:
                                std_val = augmented_df[col].std()
                                if not pd.isna(std_val) and std_val > 0:
                                    noise = np.random.normal(0, noise_level * std_val, len(augmented_df))
                                    augmented_df[col] = augmented_df[col] + noise
                    
                    # 중복 추가 (증강 비율 적용)
                    if 'duplicate' in methods:
                        augmentation_ratio = params.get('augmentation_ratio', 0.5)
                        dup_count = params.get('dup_count', 2)
                        
                        # 증강 비율에 따른 실제 복제 횟수 계산
                        target_rows = int(len(session_manager.get_original_df()) * augmentation_ratio)
                        actual_dup_count = max(2, int(target_rows / len(session_manager.get_original_df())) + 1)
                        
                        for _ in range(actual_dup_count - 1):
                            augmented_df = pd.concat([augmented_df, session_manager.get_original_df()], ignore_index=True)
                    
                    session_manager.set_augmented_df(augmented_df)
                except Exception as e:
                    st.error(f"로컬 증강 처리 중 오류: {str(e)}")
            
            st.success("✅ 데이터 증강 완료!")
            return response
        else:
            st.error("데이터 증강에 실패했습니다.")
            return None
            
    except Exception as e:
        st.error(f"증강 처리 중 오류 발생: {str(e)}")
        return None

def create_histogram_chart(column: str) -> Optional[go.Figure]:
    """히스토그램 차트를 로컬에서 생성"""
    try:
        original_df = session_manager.get_original_df()
        augmented_df = session_manager.get_augmented_df()
        
        if (original_df is not None and 
            augmented_df is not None and
            column in original_df.columns and
            column in augmented_df.columns):
            return visualizer.create_histogram_comparison(
                original_df, 
                augmented_df, 
                column
            )
    except Exception as e:
        st.error(f"히스토그램 생성 중 오류: {str(e)}")
    return None

def create_boxplot_chart(column: str) -> Optional[go.Figure]:
    """박스플롯 차트를 로컬에서 생성"""
    try:
        original_df = session_manager.get_original_df()
        augmented_df = session_manager.get_augmented_df()
        
        if (original_df is not None and 
            augmented_df is not None and
            column in original_df.columns and
            column in augmented_df.columns):
            return visualizer.create_boxplot_comparison(
                original_df, 
                augmented_df, 
                column
            )
    except Exception as e:
        st.error(f"박스플롯 생성 중 오류: {str(e)}")
    return None

def create_scatter_chart(x_column: str, y_column: str) -> Optional[go.Figure]:
    """산점도 차트를 로컬에서 생성"""
    try:
        original_df = session_manager.get_original_df()
        augmented_df = session_manager.get_augmented_df()
        
        if (original_df is not None and 
            augmented_df is not None and
            x_column in original_df.columns and
            y_column in original_df.columns and
            x_column in augmented_df.columns and
            y_column in augmented_df.columns):
            return visualizer.create_scatter_comparison(
                original_df, 
                augmented_df, 
                x_column, 
                y_column
            )
    except Exception as e:
        st.error(f"산점도 생성 중 오류: {str(e)}")
    return None

def create_categorical_comparison(column: str) -> Optional[go.Figure]:
    """범주형 비교 차트를 로컬에서 생성"""
    try:
        if (session_manager.get_original_df() is not None and 
            session_manager.get_augmented_df() is not None and
            column in session_manager.get_original_df().columns and
            column in session_manager.get_augmented_df().columns):
            
            # 컬럼이 수치형인 경우 문자열로 변환하여 처리
            orig_df = session_manager.get_original_df().copy()
            aug_df = session_manager.get_augmented_df().copy()
            
            # 수치형 컬럼을 문자열로 변환 (범주형 처리)
            if orig_df[column].dtype in ['int64', 'int32', 'float64', 'float32']:
                orig_df[column] = orig_df[column].astype(str)
                aug_df[column] = aug_df[column].astype(str)
            
            return visualizer.create_categorical_comparison(
                orig_df, 
                aug_df, 
                column
            )
    except Exception as e:
        st.error(f"범주형 비교 차트 생성 중 오류: {str(e)}")
    return None

def get_comparison_summary() -> Optional[Dict]:
    """비교 요약 통계를 로컬에서 생성"""
    try:
        if (st.session_state.original_df is not None and 
            st.session_state.augmented_df is not None):
            
            # 안전한 수치형 컬럼 추출
            try:
                numeric_cols = visualizer.get_numeric_columns(st.session_state.original_df)
                # 두 DataFrame에서 공통으로 존재하는 수치형 컬럼만 선택
                common_numeric_cols = [col for col in numeric_cols 
                                     if col in st.session_state.original_df.columns 
                                     and col in st.session_state.augmented_df.columns]
                
                if common_numeric_cols:
                    return visualizer.get_comparison_summary(
                        st.session_state.original_df, 
                        st.session_state.augmented_df, 
                        common_numeric_cols
                    )
                else:
                    st.warning("수치형 컬럼을 찾을 수 없습니다.")
                    return None
            except Exception as e:
                st.error(f"수치형 컬럼 추출 중 오류: {str(e)}")
                return None
    except Exception as e:
        st.error(f"비교 요약 생성 중 오류: {str(e)}")
    return None

def download_augmented_data(session_id: str) -> Optional[bytes]:
    """증강된 데이터를 백엔드에서 다운로드"""
    try:
        response = requests.get(f"{BACKEND_URL}/api/data/download/{session_id}?data_type=augmented")
        if response.status_code == 200:
            return response.content
        else:
            st.error("데이터 다운로드에 실패했습니다.")
            return None
    except Exception as e:
        st.error(f"다운로드 중 오류 발생: {str(e)}")
        return None

# 임시로 메서드를 직접 정의 (모듈 캐싱 문제 해결)
def setup_augmentation_parameters(categorical_cols, numeric_cols, df):
    """사이드바에서 증강 파라미터를 설정하고 반환합니다."""
    with st.sidebar:
        st.markdown("---")
        st.markdown("**🔧 증강 파라미터 설정**")
        
        # SMOTE 관련 설정
        st.markdown("**2. SMOTE 설정**")
        use_smote = st.checkbox("SMOTE 사용", value=False, help="불균형 데이터 증강을 위해 SMOTE를 사용합니다.")
        
        target_col = None
        imb_method = None
        
        if use_smote:
            st.markdown("**SMOTE 사용 시 반드시 타겟 레이블을 설정해야 합니다.**")
            
            # 범주형 컬럼 우선, 수치형 컬럼은 범주형으로 처리 가능한 경우만
            smote_cols = categorical_cols.copy()
            for col in numeric_cols:
                unique_count = df[col].nunique()
                if unique_count <= 20:  # 범주형으로 처리 가능한 수치형 컬럼
                    smote_cols.append(col)
            
            if smote_cols:
                target_col = st.selectbox(
                    "타겟(레이블) 컬럼 선택", 
                    smote_cols, 
                    key="target_select",
                    help="분류하고자 하는 클래스 레이블 컬럼을 선택하세요"
                )
                
                if target_col:
                    pass  # 메시지 제거
            else:
                use_smote = False
            
            if target_col:
                imb_method = "SMOTE"  # SMOTE만 사용
        
        # 노이즈 설정
        st.markdown("**3. 노이즈 설정**")
        
        # 노이즈 레벨 통합 설명
        with st.expander("노이즈 레벨 설명"):
            st.markdown("""
            **권장 설정:**
            - **낮은 노이즈 (0.01~0.05)**: 데이터의 원래 특성을 최대한 유지
            - **중간 노이즈 (0.05~0.1)**: 적절한 다양성 추가
            - **높은 노이즈 (0.1~0.2)**: 강한 다양성 추가 (주의 필요)
            """)
        
        noise_level = st.slider(
            "노이즈 레벨", 
            0.01, 0.2, 0.03, 
            step=0.01, 
            help="수치형 컬럼에 추가할 노이즈의 강도 (모든 증강 방법에서 공통 사용)"
        )
        
        # 증강 비율 설정
        st.markdown("**4. 증강 비율 설정**")
        
        # 증강 비율 설명
        with st.expander("증강 비율 설명"):
            st.markdown("""
            **증강 비율 적용 방식:**
            - **0.1 (10%)**: 원본 데이터의 10%만큼 추가 증강
            - **0.5 (50%)**: 원본 데이터의 50%만큼 추가 증강  
            - **1.0 (100%)**: 원본 데이터와 동일한 양만큼 증강
            - **2.0 (200%)**: 원본 데이터의 2배만큼 증강
            
            **실제 적용:** 중복 증강 방법에서 이 비율이 적용됩니다.
            """)
        
        # 통합된 증강 비율
        augmentation_ratio = st.slider(
            "증강 비율", 
            0.1, 2.0, 0.5, 
            step=0.1, 
            help="원본 데이터 대비 증강할 비율 (중복 증강에서 실제 적용됨)"
        )
        
        # 중복 설정
        dup_count = st.slider(
            "중복 횟수", 
            2, 10, 2, 
            help="전체 데이터를 몇 번 복제할지 설정"
        )
    
    # 기본 증강 방법 설정
    selected_methods = ['noise', 'duplicate', 'feature']
    if use_smote and target_col:
        selected_methods.append('smote')
    selected_methods.append('general')
    
    # 파라미터 딕셔너리 생성
    params = {
        'noise_level': noise_level,
        'dup_count': dup_count,
        'augmentation_ratio': augmentation_ratio
    }
    
    if use_smote and target_col:
        params['target_col'] = target_col
        params['imb_method'] = imb_method
    
    return params, selected_methods


# 파일 업로드 섹션
uploaded_file = st.sidebar.file_uploader("CSV 파일을 업로드하세요", type=["csv"])

if uploaded_file is not None:
    # 파일 업로드 처리 (한 번만 실행)
    if session_manager.get_session_id() is None:
        # 로컬에서 DataFrame 생성 및 검증
        try:
            df = pd.read_csv(uploaded_file)
            if df.empty:
                st.error("빈 파일입니다. 데이터가 포함된 파일을 업로드해주세요.")
                st.stop()
            if len(df.columns) == 0:
                st.error("유효하지 않은 CSV 파일입니다.")
                st.stop()
        except Exception as e:
            st.error(f"CSV 파일 읽기 실패: {str(e)}")
            st.stop()
        
        session_manager.set_original_df(df)
        
        session_id = backend_client.upload_file(uploaded_file)
        if not session_id:
            st.stop()
        
        session_manager.set_session_id(session_id)
    
    # 데이터 분석 (한 번만 실행)
    if not session_manager.is_data_analysis_cached():
        if session_manager.get_data_analysis() is None:
            data_analysis = backend_client.get_data_analysis(session_manager.get_session_id())
            if not data_analysis:
                st.stop()
            session_manager.set_data_analysis(data_analysis)
        session_manager.set_data_analysis_cached(True)
    
    # 분석 결과에서 데이터 추출
    analysis = session_manager.get_data_analysis()
    numeric_cols = analysis['numeric_columns']
    
    # 범주형 컬럼을 Frontend에서 필터링 (타임시리즈 제외, 레이블링된 데이터 포함)
    if session_manager.get_original_df() is not None:
        categorical_cols = visualizer.get_categorical_columns(session_manager.get_original_df())
        # 수치형 컬럼에서 범주형으로 처리할 수 있는 컬럼 제외
        numeric_cols = [col for col in numeric_cols if col not in categorical_cols]
    else:
        categorical_cols = analysis['categorical_columns']
    
    # ===== 데이터 분석 =====
    st.markdown("---")
    st.subheader("📊 데이터 분석")
    
    # 탭으로 구분된 분석 섹션
    tab1, tab2, tab3 = st.tabs(["📋 데이터 미리보기", "📈 기본 정보", "🔍 품질 분석"])
    
    with tab1:
        st.markdown("### 원본 데이터 미리보기")
        col1, col2 = st.columns([3, 1])
        with col1:
            preview_rows = st.slider(
                "미리보기 행 수", 
                5, 50, 10, 
                help="원본 데이터에서 보여줄 행 수를 선택하세요", 
            )
        with col2:
            st.write("")  # 공간 맞추기
            st.write("")  # 공간 맞추기
        
        # 미리보기 데이터 가져오기
        preview_data = backend_client.get_data_preview(session_manager.get_session_id(), preview_rows)
        if preview_data:
            preview_df = pd.DataFrame(preview_data['preview_data'])
            st.dataframe(preview_df, use_container_width=True)
            
            # 데이터 요약 정보
            # with st.expander("📊 데이터 요약 정보"):
            #     st.write(f"**데이터 형태**: {analysis['data_shape']['rows']:,}행 × {analysis['data_shape']['columns']}열")
            #     st.write("**데이터 타입 분포**:")
            #     st.write(f"- **수치형**: {len(numeric_cols)}개 | {', '.join(numeric_cols)}")
            #     st.write(f"- **범주형**: {len(categorical_cols)}개 | {', '.join(categorical_cols)}")
    
    with tab2:
        st.markdown("### 기본 데이터 정보")
        
        # 주요 메트릭
        col1, col2, col3, col4 = st.columns(4)
        with col1:
            st.metric("총 행 수", f"{analysis['data_shape']['rows']:,}", help="데이터셋의 총 행 수")
        with col2:
            st.metric("총 컬럼 수", f"{analysis['data_shape']['columns']}", help="데이터셋의 총 컬럼 수")
        with col3:
            st.metric("수치형 컬럼", f"{len(numeric_cols)}", help="수치형 데이터 컬럼 수")
        with col4:
            st.metric("범주형 컬럼", f"{len(categorical_cols)}", help="범주형 데이터 컬럼 수")
        
        # 컬럼 정보 상세
        st.markdown("### 컬럼 상세 정보")
        col_info_df = pd.DataFrame(analysis['column_info'])
        st.dataframe(col_info_df, use_container_width=True)
    
    with tab3:
        st.markdown("### 데이터 품질 분석")
        
        # 결측값 분석
        missing_data = analysis['missing_data']
        missing_df = pd.DataFrame([
            {'컬럼': col, '결측값 수': count} 
            for col, count in missing_data.items()
        ])
        
        col1, col2 = st.columns(2)
        with col1:
            st.markdown("**결측값 분석**")
            total_missing = sum(missing_data.values())
            if total_missing == 0:
                st.success("✅ 결측값이 없습니다.")
            else:
                st.dataframe(missing_df[missing_df['결측값 수'] > 0], use_container_width=True)
                st.warning(f"⚠️ 총 {total_missing:,}개의 결측값이 있습니다.")
        
        # 중복값 분석
        with col2:
            st.markdown("**중복값 분석**")
            duplicate_count = analysis['duplicate_count']
            duplicate_pct = (duplicate_count / analysis['data_shape']['rows']) * 100
            st.metric("중복 행 수", f"{duplicate_count:,} ({duplicate_pct:.1f}%)")
            if duplicate_count == 0:
                st.success("✅ 중복값이 없습니다.")
            else:
                st.warning(f"⚠️ 중복값이 {duplicate_pct:.1f}% 있습니다.")

    # ===== 증강 파라미터 설정 =====
    # 임시로 DataFrame을 생성하여 파라미터 설정 함수 사용
    temp_df = pd.DataFrame(columns=numeric_cols + categorical_cols)
    params, selected_methods = setup_augmentation_parameters(categorical_cols, numeric_cols, temp_df)
    
    # ===== 데이터 증강 버튼 =====
    st.sidebar.markdown("---")
    st.sidebar.markdown("**데이터 증강 실행**")
    
    # 증강 버튼
    augment_button = st.sidebar.button(
        "🚀 데이터 증강 시작", 
        type="primary",
        help="설정한 파라미터로 데이터 증강을 실행합니다",
        use_container_width=True
    )
    
    # 버튼 클릭 시 증강 실행 (최적화)
    if augment_button:
        # 파라미터 변경 감지
        current_params_key = f"{params}_{selected_methods}"
        if (session_manager.get_last_params_key() != current_params_key or 
            session_manager.get_augmentation_result() is None):
            
            augmentation_result = backend_client.process_augmentation(
                session_manager.get_session_id(), params, selected_methods
            )
            if not augmentation_result:
                st.stop()
            
            # 안전한 세션 상태 저장
            try:
                safe_response = {
                    'success': augmentation_result.get('success', False),
                    'original_shape': augmentation_result.get('original_shape', {}),
                    'augmented_shape': augmentation_result.get('augmented_shape', {}),
                    'methods_used': augmentation_result.get('methods_used', [])
                }
                session_manager.set_augmentation_result(safe_response)
            except Exception as e:
                st.warning(f"세션 상태 저장 중 오류: {str(e)}")
            
            # 증강된 데이터를 로컬 DataFrame으로 저장
            if session_manager.get_original_df() is not None:
                try:
                    augmented_df = apply_local_augmentation(
                        session_manager.get_original_df(), params, selected_methods
                    )
                    session_manager.set_augmented_df(augmented_df)
                except Exception as e:
                    st.error(f"로컬 증강 처리 중 오류: {str(e)}")
            
            # 파라미터 키 저장
            session_manager.set_last_params_key(current_params_key)
        else:
            st.info("ℹ️ 동일한 파라미터로 이미 증강이 완료되었습니다.")
    
    # 증강된 데이터가 있으면 시각화 실행
    if session_manager.get_augmentation_result():
        aug_result = session_manager.get_augmentation_result()
        
        # ===== 증강 전후 비교 섹션 =====
        st.markdown("---")
        st.subheader("1. 증강 전후 비교")
        
        # 증강 결과 요약
        col1, col2, col3, col4 = st.columns(4)
        with col1:
            st.metric("원본 행 수", f"{aug_result['original_shape']['rows']:,}")
        with col2:
            st.metric("증강 행 수", f"{aug_result['augmented_shape']['rows']:,}")
        with col3:
            increase = aug_result['augmented_shape']['rows'] - aug_result['original_shape']['rows']
            st.metric("증가 행 수", f"{increase:,}")
        with col4:
            increase_pct = (increase / aug_result['original_shape']['rows']) * 100
            st.metric("증가율", f"{increase_pct:.1f}%")
        
        # ===== 수치형 데이터 시각화 =====
        if numeric_cols:
            selected_compare = st.selectbox("비교할 수치형 컬럼 선택", numeric_cols, key="compare_select")
            
            # 히스토그램 비교
            st.markdown("### 1-2. 히스토그램 분포 비교")
            fig = create_histogram_chart(selected_compare)
            if fig:
                st.plotly_chart(fig, use_container_width=True, key="overlap_hist")
            
            # 박스플롯 비교
            st.markdown("### 1-3. 박스플롯 분포 비교")
            fig = create_boxplot_chart(selected_compare)
            if fig:
                st.plotly_chart(fig, use_container_width=True, key="overlap_box")
            
            # 통계 요약
            st.markdown("### 1-4. 통계 요약")
            summary_data = get_comparison_summary()
            if summary_data and selected_compare in summary_data:
                stats = summary_data[selected_compare]
                
                # 통계 요약표 생성
                summary_df = pd.DataFrame([
                    {
                        '지표': '평균',
                        '원본': f"{stats['original']['mean']:.2f}",
                        '증강': f"{stats['augmented']['mean']:.2f}",
                        '변화': f"{stats['changes']['mean_change']:.2f}"
                    },
                    {
                        '지표': '표준편차',
                        '원본': f"{stats['original']['std']:.2f}",
                        '증강': f"{stats['augmented']['std']:.2f}",
                        '변화': f"{stats['changes']['std_change']:.2f}"
                    }
                ])
                st.dataframe(summary_df, use_container_width=True)
            
            # ===== 산점도 비교 (수치형 컬럼이 2개 이상인 경우) =====
            if len(numeric_cols) >= 2:
                st.markdown("### 1-5. 산점도 비교")
                x_col_overlap = st.selectbox("X축 컬럼", numeric_cols, key="scatter_x_overlap")
                y_col_overlap = st.selectbox("Y축 컬럼", [col for col in numeric_cols if col != x_col_overlap], key="scatter_y_overlap")
                
                if x_col_overlap and y_col_overlap:
                    fig = create_scatter_chart(x_col_overlap, y_col_overlap)
                    if fig:
                        st.plotly_chart(fig, use_container_width=True, key="overlap_scatter")
        
        # ===== 범주형 데이터 비교 =====
        if categorical_cols:
            st.markdown("### 2. 범주형 데이터 비교")
            st.info(f"📊 필터링된 범주형 컬럼: {len(categorical_cols)}개 (타임시리즈 데이터 제외, 레이블링된 데이터 포함)")
            
            # 범주형 컬럼 정보 표시
            if st.session_state.original_df is not None:
                cat_info = []
                for col in categorical_cols:
                    try:
                        # 수치형 컬럼인 경우 문자열로 변환하여 고유값 계산
                        if st.session_state.original_df[col].dtype in ['int64', 'int32', 'float64', 'float32']:
                            unique_count = st.session_state.original_df[col].astype(str).nunique()
                        else:
                            unique_count = st.session_state.original_df[col].nunique()
                        
                        if unique_count == 2:
                            cat_type = "이진 데이터"
                        elif 3 <= unique_count <= 15:
                            cat_type = "다중 레이블"
                        else:
                            cat_type = "범주형"
                        
                        # 데이터 타입 정보 추가
                        dtype_info = st.session_state.original_df[col].dtype
                        cat_info.append(f"{col} ({cat_type}, {unique_count}개 값, 타입: {dtype_info})")
                    except Exception as e:
                        cat_info.append(f"{col} (오류: {str(e)})")
                
                with st.expander("📋 범주형 컬럼 상세 정보"):
                    for info in cat_info:
                        st.write(f"• {info}")
            
            # SMOTE 사용 시 타겟 컬럼을 기본값으로 설정
            default_cat_col = None
            if 'smote' in selected_methods and 'target_col' in params and params['target_col'] in categorical_cols:
                default_cat_col = params['target_col']
            
            # default_cat_col이 categorical_cols에 있는지 확인
            default_index = 0
            if default_cat_col and default_cat_col in categorical_cols:
                default_index = categorical_cols.index(default_cat_col)
            
            selected_cat_compare = st.selectbox("비교할 범주형 컬럼 선택", categorical_cols, key="cat_compare_select", index=default_index)
            
            # 표시할 카테고리 개수 설정
            col1, col2 = st.columns([3, 1])
            with col1:
                max_categories = st.slider("표시할 카테고리 개수", 5, 50, 20, help="상위 N개의 카테고리만 표시합니다")
            with col2:
                st.write("")  # 공간 맞추기
                st.write("")  # 공간 맞추기
            
            # 범주형 비교 차트 생성
            fig = create_categorical_comparison(selected_cat_compare)
            if fig:
                st.plotly_chart(fig, use_container_width=True, key="overlap_cat")
                
                # 차트 설명 추가
                with st.expander("📊 차트 설명"):
                    st.markdown("""
                    **대조 시각화 특징:**
                    - **연파랑**: 원본 데이터 분포
                    - **연붉은색**: 증강된 데이터 분포
                    - **그룹화된 막대**: 각 카테고리별 원본과 증강 데이터를 나란히 비교
                    - **수치 표시**: 각 막대 위에 정확한 개수 표시
                    - **대조 분석**: 증강 전후의 분포 변화를 직관적으로 확인 가능
                    """)
                
                # 통계 요약표
                st.markdown("**통계 요약**")
                if st.session_state.original_df is not None and st.session_state.augmented_df is not None:
                    try:
                        # 선택된 컬럼이 실제로 존재하는지 확인
                        if selected_cat_compare in st.session_state.original_df.columns and selected_cat_compare in st.session_state.augmented_df.columns:
                            # 수치형 컬럼인 경우 문자열로 변환하여 처리
                            orig_col = st.session_state.original_df[selected_cat_compare]
                            aug_col = st.session_state.augmented_df[selected_cat_compare]
                            
                            if orig_col.dtype in ['int64', 'int32', 'float64', 'float32']:
                                # float 값을 정수로 변환하여 표시
                                orig_col_str = orig_col.apply(lambda x: str(int(float(x))) if pd.notna(x) and float(x).is_integer() else str(x))
                                aug_col_str = aug_col.apply(lambda x: str(int(float(x))) if pd.notna(x) and float(x).is_integer() else str(x))
                            else:
                                orig_col_str = orig_col.astype(str)
                                aug_col_str = aug_col.astype(str)
                            
                            # 원본 데이터 카테고리별 개수 (설정된 개수만큼)
                            orig_counts = orig_col_str.value_counts().head(max_categories).reset_index()
                            orig_counts.columns = ['category', 'original']
                            
                            # 증강된 데이터 카테고리별 개수 (설정된 개수만큼)
                            aug_counts = aug_col_str.value_counts().head(max_categories).reset_index()
                            aug_counts.columns = ['category', 'augmented']
                            
                            # 안전한 병합 처리
                            try:
                                # 병합 전에 컬럼명 확인 및 수정
                                if len(orig_counts.columns) != 2:
                                    orig_counts = orig_counts.iloc[:, :2]
                                    orig_counts.columns = ['category', 'original']
                                
                                if len(aug_counts.columns) != 2:
                                    aug_counts = aug_counts.iloc[:, :2]
                                    aug_counts.columns = ['category', 'augmented']
                                
                                # 병합
                                comparison_df = orig_counts.merge(aug_counts, on='category', how='outer').fillna(0)
                                
                            except Exception as e:
                                # 병합 실패 시 개별 처리
                                st.error(f"데이터 병합 중 오류 발생: {str(e)}")
                                # 개별 DataFrame으로 처리
                                try:
                                    all_categories = list(set(orig_counts['category'].tolist() + aug_counts['category'].tolist()))
                                    comparison_df = pd.DataFrame({
                                        'category': all_categories,
                                        'original': [orig_counts[orig_counts['category'] == cat]['original'].iloc[0] if cat in orig_counts['category'].values else 0 for cat in all_categories],
                                        'augmented': [aug_counts[aug_counts['category'] == cat]['augmented'].iloc[0] if cat in aug_counts['category'].values else 0 for cat in all_categories]
                                    })
                                except Exception as inner_e:
                                    st.error(f"대체 처리 중 오류 발생: {str(inner_e)}")
                                    # 최소한의 DataFrame 생성
                                    comparison_df = pd.DataFrame({
                                        'category': ['데이터 오류'],
                                        'original': [0],
                                        'augmented': [0]
                                    })
                            
                            # 카테고리를 정렬 (숫자 레이블의 경우 숫자 순서로)
                            try:
                                numeric_categories = []
                                non_numeric_categories = []
                                
                                for cat in comparison_df['category']:
                                    try:
                                        numeric_categories.append((float(cat), cat))
                                    except:
                                        non_numeric_categories.append(cat)
                                
                                numeric_categories.sort()
                                non_numeric_categories.sort()
                                
                                sorted_categories = [cat for _, cat in numeric_categories] + non_numeric_categories
                                comparison_df = comparison_df.set_index('category').reindex(sorted_categories).reset_index()
                            except:
                                pass
                            
                            # 비율 계산 추가
                            total_orig = comparison_df['original'].sum()
                            total_aug = comparison_df['augmented'].sum()
                            
                            if total_orig > 0 and total_aug > 0:
                                comparison_df['원본_비율(%)'] = (comparison_df['original'] / total_orig * 100).round(2)
                                comparison_df['증강_비율(%)'] = (comparison_df['augmented'] / total_aug * 100).round(2)
                                comparison_df['비율_변화(%)'] = (comparison_df['증강_비율(%)'] - comparison_df['원본_비율(%)']).round(2)
                                
                                # 증강률 계산
                                comparison_df['증강률(%)'] = ((comparison_df['augmented'] - comparison_df['original']) / comparison_df['original'] * 100).round(2)
                                # NaN 값 처리
                                comparison_df['증강률(%)'] = comparison_df['증강률(%)'].fillna(0)
                            
                            # 컬럼 순서 조정
                            display_columns = ['category', 'original', 'augmented']
                            if '원본_비율(%)' in comparison_df.columns:
                                display_columns.extend(['원본_비율(%)', '증강_비율(%)', '비율_변화(%)', '증강률(%)'])
                            
                            # DataFrame 스타일링
                            styled_df = comparison_df[display_columns].copy()
                            
                            # 컬럼명 한글로 변경 (컬럼명 매핑 딕셔너리 사용)
                            column_mapping = {
                                'category': '카테고리',
                                'original': '원본 개수', 
                                'augmented': '증강 개수'
                            }
                            
                            # 비율 관련 컬럼이 있는 경우에만 추가
                            if '원본_비율(%)' in comparison_df.columns:
                                column_mapping.update({
                                    '원본_비율(%)': '원본 비율(%)',
                                    '증강_비율(%)': '증강 비율(%)',
                                    '비율_변화(%)': '비율 변화(%)',
                                    '증강률(%)': '증강률(%)'
                                })
                            
                            styled_df = styled_df.rename(columns=column_mapping)
                            
                            # 숫자 컬럼 포맷팅
                            styled_df['원본 개수'] = styled_df['원본 개수'].astype(int)
                            styled_df['증강 개수'] = styled_df['증강 개수'].astype(int)
                            
                            st.dataframe(styled_df, use_container_width=True)
                            
                            # 요약 통계
                            col1, col2, col3 = st.columns(3)
                            with col1:
                                st.metric("원본 총 개수", f"{total_orig:,}")
                            with col2:
                                st.metric("증강 총 개수", f"{total_aug:,}")
                            with col3:
                                increase_pct = ((total_aug - total_orig) / total_orig * 100) if total_orig > 0 else 0
                                st.metric("증가율", f"{increase_pct:.1f}%")
                        else:
                            st.error(f"선택된 컬럼 '{selected_cat_compare}'을 찾을 수 없습니다.")
                    except Exception as e:
                        st.error(f"통계 요약 생성 중 오류 발생: {str(e)}")
                        st.info("데이터를 다시 확인해주세요.")
        else:
            st.markdown("### 2. 범주형 데이터 비교")
            st.warning("⚠️ 비교 가능한 범주형 컬럼이 없습니다. (타임시리즈 데이터는 제외됩니다)")
            st.stop()
        
        # ===== 데이터 다운로드 =====
        st.markdown("---")
        st.subheader("증강 데이터 다운로드")
        
        if st.button("📥 증강된 데이터 다운로드"):
            data_content = backend_client.download_data(session_manager.get_session_id())
            if data_content:
                st.download_button(
                    label="💾 CSV 파일로 다운로드",
                    data=data_content,
                    file_name="augmented_data.csv",
                    mime="text/csv",
                    use_container_width=True
                )
    
    else:
        # 증강이 실행되지 않은 경우 안내 메시지
        st.markdown("---")
        st.info("ℹ️ 사이드바에서 파라미터를 설정하고 '🚀 데이터 증강 시작' 버튼을 클릭하여 증강을 실행하세요.")
        
else:
    # ===== 초기 안내 메시지 =====
    with st.expander("지원되는 데이터 형식"):
        st.markdown("""
        - **수치형 데이터**: 히스토그램, 박스플롯에 적합
        - **범주형 데이터**: 막대그래프, 파이차트에 적합
        - **CSV 파일 형식**만 지원됩니다
        """)
    
