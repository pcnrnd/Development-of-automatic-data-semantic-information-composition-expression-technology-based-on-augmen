import streamlit as st
# import pandas as pd
# import numpy as np
from PIL import Image # , ImageEnhance, ImageOps
# import io
# import random
import sys
import os

# 상위 디렉토리를 Python 경로에 추가
# sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# lib 모듈에서 추상화된 클래스들 임포트
from lib.image_augmentation import ImageAugmenter # , DataUtils

st.set_page_config(layout='wide')
st.title("🖼️ 이미지 데이터 전처리 및 시각화 도구")

# 클래스 인스턴스 생성
image_augmenter = ImageAugmenter()

uploaded_files = st.sidebar.file_uploader("이미지 파일을 업로드하세요 (여러 장 가능)", type=["png", "jpg", "jpeg"], accept_multiple_files=True)

if uploaded_files:
    # 원본 이미지 로드 및 표시
    # st.subheader("원본 이미지 미리보기")
    original_images = []
    
    # 이미지 로드 중 오류 처리
    for file in uploaded_files:
        try:
            img = Image.open(file).convert("RGB")
            original_images.append(img)
        except Exception as e:
            st.error(f"이미지 로드 실패: {file.name} - {str(e)}")
            continue
    
    if not original_images:
        st.error("❌ 로드할 수 있는 이미지가 없습니다.")
        st.info("💡 지원되는 이미지 형식을 확인해주세요:")
        st.markdown("""
        - **PNG**: 투명도 지원
        - **JPG/JPEG**: 압축된 이미지
        - **파일 크기**: 너무 큰 파일은 로드에 시간이 걸릴 수 있습니다
        """)

    if original_images:
        # 원본 이미지 그리드 표시
        original_captions = [f"원본 {file.name}" for file in uploaded_files[:len(original_images)]]
        # image_augmenter.display_images_grid(original_images, original_captions)

        st.sidebar.markdown("---")
        st.sidebar.subheader("전처리 옵션 설정")
        
        # 증강 파라미터 입력받기
        params = image_augmenter.get_augmentation_parameters()

        st.markdown("---")
        st.subheader("📊 원본 vs 전처리 비교")
        
        # 이미지 증강 수행
        augmented_images = []
        for img in original_images:
            try:
                aug_img = image_augmenter.augment_image(img, **params)
                augmented_images.append(aug_img)
            except Exception as e:
                st.error(f"이미지 증강 실패: {str(e)}")
                continue
        
        if augmented_images:
            # 각 이미지를 나란히 비교
            for i, (orig_img, aug_img, file) in enumerate(zip(original_images, augmented_images, uploaded_files)):
                col1, col2 = st.columns(2)
                with col1:
                    st.markdown(f"**원본 - {file.name}**")
                    st.image(orig_img, use_container_width =True)
                with col2:
                    st.markdown(f"**전처리 - {file.name}**")
                    st.image(aug_img, use_container_width =True)
                st.markdown("---")  # 이미지 간 구분선

            # 증강 전후 비교 섹션 추가
            st.markdown("---")
            st.subheader("📊 전처리 전후 비교")
            
            # 이미지 개수 및 크기 비교
            col1, col2 = st.columns(2)
            
            with col1:
                st.markdown("**📷 전처리 전 이미지 정보**")
                st.write(f"이미지 개수: {len(original_images)}")
                if original_images:
                    first_img = original_images[0]
                    st.write(f"이미지 크기: {first_img.size[0]} x {first_img.size[1]} 픽셀")
                    st.write(f"이미지 모드: {first_img.mode}")
            
            with col2:
                st.markdown("**📷 전처리 후 이미지 정보**")
                st.write(f"이미지 개수: {len(augmented_images)}")
                if augmented_images:
                    first_aug_img = augmented_images[0]
                    st.write(f"이미지 크기: {first_aug_img.size[0]} x {first_aug_img.size[1]} 픽셀")
                    st.write(f"이미지 모드: {first_aug_img.mode}")
            
            # 증강 효과 시각화
            st.markdown("**📊 전처리 전후 히스토그램 비교**")
            selected_img_idx = st.selectbox("비교할 이미지 선택", range(len(original_images)), format_func=lambda x: f"이미지 {x+1}")
            
            if selected_img_idx < len(original_images) and selected_img_idx < len(augmented_images):
                col1, col2 = st.columns(2)
                
                with col1:
                    st.markdown("**원본 이미지 히스토그램**")
                    fig_orig = image_augmenter.create_histogram(original_images[selected_img_idx])
                    st.plotly_chart(fig_orig, use_container_width=True, key="img_orig_hist")
                
                with col2:
                    st.markdown("**전처리 후 이미지 히스토그램**")
                    fig_aug = image_augmenter.create_histogram(augmented_images[selected_img_idx])
                    st.plotly_chart(fig_aug, use_container_width=True, key="img_aug_hist")
                
                # 증강 효과 요약
                st.markdown("**📋 전처리 효과 요약**")
                summary_col1, summary_col2, summary_col3 = st.columns(3)
                
                with summary_col1:
                    st.metric("좌우 반전", f"{params['flip']}")
                
                with summary_col2:
                    if params.get('rotation', 0) != 0:
                        st.metric("회전 각도", f"{params['rotation']}°")
                    else:
                        st.metric("회전 각도", "변경 없음")
                
                with summary_col3:
                    if params.get('brightness', 1.0) != 1.0:
                        st.metric("밝기 조절", f"{params['brightness']:.2f}x")
                    else:
                        st.metric("밝기 조절", "변경 없음")
                
                summary_col4, summary_col5, summary_col6 = st.columns(3)
                with summary_col4:
                    st.metric("노이즈 강도", f"{params['noise_intensity']}")
                with summary_col5:
                    st.metric("대비 조절", f"{params['contrast']:.2f}x")
                with summary_col6:
                    st.metric("색조 조절", f"{params['hue']:.2f}x")


            st.markdown("---")
            st.subheader("전처리 이미지 다운로드")
            
            # 다운로드 버튼 생성
            for idx, (img, file) in enumerate(zip(augmented_images, uploaded_files[:len(augmented_images)])):
                try:
                    img_bytes = image_augmenter.prepare_download(img)
                    st.download_button(
                        label=f"{file.name} 전처리본 다운로드",
                        data=img_bytes,
                        file_name=f"aug_{file.name}",
                        mime="image/png"
                    )
                except Exception as e:
                    st.error(f"다운로드 준비 실패: {file.name} - {str(e)}")
        else:
            st.error("❌ 전처리된 이미지가 없습니다.")
            st.info("💡 전처리 과정에서 오류가 발생했습니다. 다른 전처리 옵션을 시도해보세요.")
else:
    st.info("👈 왼쪽 사이드바에서 이미지 파일을 업로드하세요!")
    with st.expander("📋 지원되는 이미지 형식"):
        st.markdown("""
        - **PNG**: 투명도 지원
        - **JPG/JPEG**: 압축된 이미지
        - **여러 파일 동시 업로드** 가능
        - **권장 크기**: 너무 큰 이미지는 처리 시간이 오래 걸릴 수 있습니다
        """)
