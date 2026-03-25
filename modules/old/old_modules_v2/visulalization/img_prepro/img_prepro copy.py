import streamlit as st
from PIL import Image 
import sys
import os
import glob
import requests
import json
# lib 모듈에서 추상화된 클래스들 임포트
from lib.image_augmentation import ImageAugmenter
from lib.file_manager import FileManager

st.set_page_config(layout='wide')
st.title("🖼️ 이미지 데이터 전처리 및 시각화 도구")

# 클래스 인스턴스 생성
image_augmenter = ImageAugmenter()
file_manager = FileManager()

# 지연 로딩 함수 정의
def load_image_on_demand(file_path):
    """이미지를 필요할 때만 로드하는 함수 (메모리 최적화)"""
    try:
        return Image.open(file_path).convert("RGB")
    except Exception as e:
        st.error(f"이미지 로드 실패: {os.path.basename(file_path)} - {str(e)}")
        return None

# 입력 방식 선택
input_method = st.sidebar.selectbox(
    "입력 방식 선택", 
    ["폴더 경로 입력", "개별 파일 업로드"]
)

if input_method == "폴더 경로 입력":
    image_path = st.sidebar.text_input(
        "이미지 폴더 경로:",
        placeholder="/path/to/images 또는 C:\\path\\to\\images",
        help="처리할 이미지들이 들어있는 폴더 경로"
    )
    
    if image_path:
        if os.path.exists(image_path):
            # 경로에서 이미지 파일 찾기
            image_extensions = ['*.jpg', '*.jpeg', '*.png', '*.JPG', '*.JPEG', '*.PNG', '*.bmp', '*.BMP']
            image_files = []
            for ext in image_extensions:
                image_files.extend(glob.glob(os.path.join(image_path, ext)))
            
            if image_files:
                st.sidebar.success(f"✅ {len(image_files)}개 이미지 파일 발견")
                uploaded_files = image_files  # 파일 경로 리스트로 변환
            else:
                st.sidebar.warning("⚠️ 지정된 경로에서 이미지 파일을 찾을 수 없습니다")
                uploaded_files = None
        else:
            st.sidebar.error("❌ 지정된 경로가 존재하지 않습니다")
            uploaded_files = None
    else:
        uploaded_files = None

elif input_method == "개별 파일 업로드":
    uploaded_files = st.sidebar.file_uploader("이미지 파일을 업로드하세요 (여러 장 가능)", type=["png", "jpg", "jpeg"], accept_multiple_files=True)

if uploaded_files:
    # 파일 경로만 저장 (메모리 최적화)
    image_file_paths = []
    file_info_list = []  # 파일 정보 저장용 리스트
    
    # 파일 정보만 수집 (이미지는 로드하지 않음)
    for file in uploaded_files:
        try:
            # 파일이 문자열 경로인지 파일 객체인지 확인
            if isinstance(file, str):
                # 폴더 경로 입력 방식
                image_file_paths.append(file)
                # 파일명만 추출하는 간단한 객체 생성
                file_info = type('FileInfo', (), {'name': os.path.basename(file)})()
            else:
                # 개별 파일 업로드 방식 - 임시 파일로 저장
                temp_path = f"temp_{file.name}"
                with open(temp_path, "wb") as f:
                    f.write(file.getbuffer())
                image_file_paths.append(temp_path)
                file_info = file
            
            file_info_list.append(file_info)
            
        except Exception as e:
            filename = file.name if hasattr(file, 'name') else str(file)
            st.error(f"파일 정보 수집 실패: {filename} - {str(e)}")
            continue
    
    if not image_file_paths:
        st.error("❌ 처리할 수 있는 이미지 파일이 없습니다.")
        st.info("💡 지원되는 이미지 형식을 확인해주세요:")
        st.markdown("""
        - **PNG**: 투명도 지원
        - **JPG/JPEG**: 압축된 이미지
        - **파일 크기**: 메모리 효율적 처리로 대용량 파일도 안전하게 처리됩니다
        """)

    if image_file_paths:
        st.sidebar.markdown("---")
        st.sidebar.subheader("전처리 옵션 설정")
        
        # 증강 파라미터 입력받기
        params = image_augmenter.get_augmentation_parameters()
        
        # 저장 설정 섹션 추가
        st.sidebar.markdown("---")
        st.sidebar.subheader("💾 저장 설정")
        
      
        # 저장 경로 설정
        output_path = st.sidebar.text_input(
            "저장할 폴더 경로:", 
            value=file_manager.default_output_path,
            help="전처리된 이미지들이 저장될 폴더",
            key="output_path" 
        )
        
        # 경로 상태 확인
        path_exists, path_writable = file_manager.validate_path(output_path)
        
        if path_exists and path_writable:
            st.sidebar.success("✅ 저장 가능한 경로입니다")
        elif path_exists and not path_writable:
            st.sidebar.error("❌ 쓰기 권한이 없습니다")
        else:
            file_manager.create_output_directory(output_path)
            # st.sidebar.warning("⚠️ 폴더가 존재하지 않습니다")
            # if st.sidebar.button("📁 폴더 생성"):
            #     if file_manager.create_output_directory(output_path):
            #         st.sidebar.success("✅ 폴더 생성 완료!")
                # else:
                #     st.sidebar.error("❌ 폴더 생성 실패")
        
        # 저장 옵션
        save_format = st.sidebar.selectbox("저장 형식", ["PNG", "JPEG", "원본과 동일"])

        # 대표 이미지 선택 (파일명 기반 - 메모리 최적화)
        st.markdown("---")
        st.subheader("🎯 대표 이미지 선택")
        
        if len(image_file_paths) > 1:
            selected_file_path = st.selectbox(
                "전처리 효과 확인용 대표 이미지를 선택하세요",
                image_file_paths,
                format_func=lambda x: os.path.basename(x),
                key="preview_image_selector"
            )
            
            # 선택된 대표 이미지 로드 및 표시
            preview_image = load_image_on_demand(selected_file_path)
            
            if preview_image:
                col1, col2 = st.columns([2, 1])
                with col1:
                    st.image(preview_image, caption=f"대표 이미지: {os.path.basename(selected_file_path)}")
                
                with col2:
                    st.markdown("**📋 설정 정보**")
                    st.write(f"전체 파일: {len(image_file_paths)}개")
                    st.write(f"대표 파일: {os.path.basename(selected_file_path)}")
                    st.write(f"이미지 크기: {preview_image.size[0]} x {preview_image.size[1]} 픽셀")
                    st.info("이 이미지의 전처리 결과를 전체 파일에 적용합니다")
                    
                # 대표 이미지로 전처리 미리보기 버튼
                # if st.button("🔍 대표 이미지 전처리 미리보기", key="preview_test"):
                #     test_img = image_augmenter.augment_image(preview_image, **params)
                #     col1, col2 = st.columns(2)
                #     with col1:
                #         st.markdown("**원본 이미지**")
                #         st.image(preview_image)
                #     with col2:
                #         st.markdown("**전처리 결과**")
                #         st.image(test_img)
        else:
            # 이미지가 1개인 경우
            st.info("📸 이미지가 1개만 있습니다. 이 파일에 전처리를 적용합니다.")
            selected_file_path = image_file_paths[0]
            preview_image = load_image_on_demand(selected_file_path)

        # 일괄 처리 버튼 (메모리 최적화된 순차 처리)
        if st.sidebar.button("⚡ 전체 이미지 일괄 처리", type="primary", key="batch_process", width='stretch'):
            # 이전 결과 초기화 (방법 2)
            if 'processing_result' in st.session_state:
                del st.session_state['processing_result']
            
            # 처리 시작 상태를 세션에 저장
            st.session_state['processing_started'] = True
            st.session_state['processing_files'] = image_file_paths
            st.session_state['processing_params'] = params
            st.session_state['processing_output_path'] = output_path
            st.session_state['processing_save_format'] = save_format
            st.session_state['processing_file_info'] = file_info_list
            st.rerun()  # 페이지 새로고침하여 진행률 표시 영역으로 이동
        
        # 처리 결과 미리보기 (메모리 최적화)
        st.markdown("---")
        st.subheader("📊 처리 결과 미리보기")
        
        # 대표 이미지로 전처리 결과 미리보기
        if preview_image:
            # 전처리된 이미지 생성
            processed_preview = image_augmenter.augment_image(preview_image, **params)
            
            # 비교 표시
            col1, col2 = st.columns(2)
            with col1:
                st.markdown(f"**원본 - {os.path.basename(selected_file_path)}**")
                st.image(preview_image, width='stretch')
            with col2:
                st.markdown(f"**전처리 결과 미리보기**")
                st.image(processed_preview, width='stretch')
            
            # 히스토그램 비교
            st.markdown("---")
            st.subheader("📊 히스토그램 비교")
            
            col1, col2 = st.columns(2)
            with col1:
                st.markdown("**원본 이미지 히스토그램**")
                fig_orig = image_augmenter.create_histogram(preview_image)
                st.plotly_chart(fig_orig, key="img_orig_hist")
            
            with col2:
                st.markdown("**전처리 후 히스토그램**")
                fig_aug = image_augmenter.create_histogram(processed_preview)
                st.plotly_chart(fig_aug, key="img_aug_hist")
            
            # 전처리 효과 요약
            st.markdown("---")
            st.subheader("📋 전처리 효과 요약")
            
            col1, col2, col3 = st.columns(3)
            with col1:
                st.metric("좌우 반전", f"{params['flip']}")
                st.metric("회전 각도", f"{params['rotation']}°" if params.get('rotation', 0) != 0 else "변경 없음")
            
            with col2:
                st.metric("밝기 조절", f"{params['brightness']:.2f}x" if params.get('brightness', 1.0) != 1.0 else "변경 없음")
                st.metric("노이즈 강도", f"{params['noise_intensity']}")
            
            with col3:
                st.metric("대비 조절", f"{params['contrast']:.2f}x" if params.get('contrast', 1.0) != 1.0 else "변경 없음")
                st.metric("색조 조절", f"{params['hue']:.2f}x" if params.get('hue', 1.0) != 1.0 else "변경 없음")
        
        # 진행률 표시 (전처리 효과 아래)
        if 'processing_started' in st.session_state and st.session_state['processing_started']:
            # st.markdown("---")
            # st.subheader("⚡ 이미지 처리 진행 상황")
            
            # 진행률 표시를 위한 컨테이너
            progress_container = st.container()
            status_container = st.container()
            
            with progress_container:
                progress_bar = st.progress(0)
            
            with status_container:
                status_text = st.empty()
            
            # 처리 데이터 가져오기
            image_file_paths = st.session_state['processing_files']
            params = st.session_state['processing_params']
            output_path = st.session_state['processing_output_path']
            save_format = st.session_state['processing_save_format']
            file_info_list = st.session_state['processing_file_info']
            
            # 순차 처리 및 즉시 저장 (메모리 최적화)
            processed_count = 0
            failed_count = 0
            
            for i, file_path in enumerate(image_file_paths):
                try:
                    # 이미지 로드
                    img = load_image_on_demand(file_path)
                    if img is None:
                        failed_count += 1
                        continue
                    
                    # 전처리 수행
                    import base64
                    import io

                    def image_to_base64(image):
                        """PIL Image를 base64 문자열로 변환"""
                        buffer = io.BytesIO()
                        image.save(buffer, format='PNG')
                        img_str = base64.b64encode(buffer.getvalue()).decode()
                        return img_str

                    # 284-285번 라인 수정
                    img_base64 = image_to_base64(img)
                    request_data = json.dumps({"img": img_base64, "params": params})
                    response = requests.post(f"http://localhost:8000/api/preprocessing", json=request_data)
                    # aug_img = image_augmenter.augment_image(img, **params)
                    if response.status_code == 200:
                        json_data = response.json()
                        aug_img = json.loads(json_data['result'])['img']
                    else:
                        failed_count += 1
                        continue
                    # 즉시 저장
                    saved_files, failed_files = file_manager.save_processed_images(
                        [aug_img], 
                        [file_info_list[i]], 
                        output_path, 
                        save_format
                    )
                    
                    if saved_files:
                        processed_count += 1
                    
                    # 메모리 즉시 해제
                    del img, aug_img
                    
                    # 진행률 업데이트
                    progress_bar.progress((i + 1) / len(image_file_paths))
                    status_text.text(f"처리 중... {i+1}/{len(image_file_paths)} - {os.path.basename(file_path)}")
                    
                except Exception as e:
                    st.error(f"이미지 처리 실패: {os.path.basename(file_path)} - {str(e)}")
                    failed_count += 1
                    continue
            
            # 완료 후 진행률과 상태 텍스트 모두 제거
            progress_bar.empty()
            status_text.empty()
            
            # 처리 결과를 세션에 저장 (전처리 효과 아래에 표시용)
            if processed_count > 0:
                st.session_state['processing_result'] = {
                    'processed_count': processed_count,
                    'failed_count': failed_count,
                    'output_path': output_path,
                    'completed': True
                }
                # status_text.success(f"✅ {processed_count}개 이미지 처리 완료!")
            else:
                st.session_state['processing_result'] = {
                    'processed_count': 0,
                    'failed_count': failed_count,
                    'output_path': output_path,
                    'completed': True
                }
                status_text.error("❌ 처리된 이미지가 없습니다.")
            
            # 처리 완료 후 시작 상태 초기화
            st.session_state['processing_started'] = False
        
        # 처리 완료 결과 표시 (전처리 효과 아래)
        if 'processing_result' in st.session_state and st.session_state['processing_result']['completed']:
            st.markdown("---")
            st.subheader("🎉 처리 완료 결과")
            
            result = st.session_state['processing_result']
            
            if result['processed_count'] > 0:
                st.success(f"✅ {result['processed_count']}개 이미지 처리 완료!")
                st.info(f"저장 위치: `{result['output_path']}`")
            
            if result['failed_count'] > 0:
                st.warning(f"⚠️ {result['failed_count']}개 이미지 처리 실패")
            
            # 결과 표시 후 즉시 초기화 (방법 1)
            del st.session_state['processing_result']
        
        # 처리 안내
        st.markdown("---")
else:
    st.info("👈 왼쪽 사이드바에서 이미지 파일을 업로드하세요!")
    with st.expander("📋 지원되는 이미지 형식"):
        st.markdown("""
        - **PNG**: 투명도 지원
        - **JPG/JPEG**: 압축된 이미지
        - **여러 파일 동시 업로드** 가능
        - **권장 크기**: 너무 큰 이미지는 처리 시간이 오래 걸릴 수 있습니다
        """)
