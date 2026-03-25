"""
이미지 증강 기능을 제공하는 모듈
"""

import numpy as np
from PIL import Image, ImageEnhance, ImageOps
import streamlit as st
import plotly.graph_objects as go
import plotly.express as px
import io
from typing import List, Tuple


class ImageAugmenter:
    """이미지 증강을 위한 클래스"""
    
    def __init__(self):
        self.supported_methods = {
            "회전": self._rotate_image,
            "좌우 반전": self._flip_image,
            "밝기 조절": self._adjust_brightness,
            "노이즈 추가": self._add_noise,
            "대비 조절": self._adjust_contrast,
            "색조 조절": self._adjust_hue
        }
    
    def augment_image(self, img: Image.Image, **kwargs) -> Image.Image:
        """
        이미지 증강을 수행합니다.
        
        Args:
            img (Image.Image): 원본 이미지
            **kwargs: 증강 파라미터들
            
        Returns:
            Image.Image: 증강된 이미지
        """
        augmented_img = img.copy()
        
        # 회전
        if 'rotation' in kwargs and kwargs['rotation'] != 0:
            augmented_img = self._rotate_image(augmented_img, kwargs['rotation'])
        
        # 좌우 반전
        if 'flip' in kwargs and kwargs['flip']:
            augmented_img = self._flip_image(augmented_img)
        
        # 밝기 조절
        if 'brightness' in kwargs and kwargs['brightness'] != 1.0:
            augmented_img = self._adjust_brightness(augmented_img, kwargs['brightness'])
        
        # 노이즈 추가
        if 'noise_intensity' in kwargs and kwargs['noise_intensity'] != 15:
            augmented_img = self._add_noise(augmented_img, kwargs.get('noise_intensity', 15))
        
        # 대비 조절
        if 'contrast' in kwargs and kwargs['contrast'] != 1.0:
            augmented_img = self._adjust_contrast(augmented_img, kwargs['contrast'])
        
        # 색조 조절
        if 'hue' in kwargs and kwargs['hue'] != 1.0:
            augmented_img = self._adjust_hue(augmented_img, kwargs['hue'])
        
        return augmented_img
    
    def _rotate_image(self, img: Image.Image, angle: int) -> Image.Image:
        """이미지를 회전합니다."""
        return img.rotate(angle)
    
    def _flip_image(self, img: Image.Image) -> Image.Image:
        """이미지를 좌우 반전합니다."""
        return ImageOps.mirror(img)
    
    def _adjust_brightness(self, img: Image.Image, factor: float) -> Image.Image:
        """이미지 밝기를 조절합니다."""
        enhancer = ImageEnhance.Brightness(img)
        return enhancer.enhance(factor)
    
    def _adjust_contrast(self, img: Image.Image, factor: float) -> Image.Image:
        """이미지 대비를 조절합니다."""
        enhancer = ImageEnhance.Contrast(img)
        return enhancer.enhance(factor)
    
    def _adjust_hue(self, img: Image.Image, factor: float) -> Image.Image:
        """이미지 색조를 조절합니다."""
        enhancer = ImageEnhance.Color(img)
        return enhancer.enhance(factor)
    
    def _add_noise(self, img: Image.Image, intensity: int = 15) -> Image.Image:
        """이미지에 노이즈를 추가합니다."""
        arr = np.array(img)
        noise_arr = np.random.normal(0, intensity, arr.shape).astype(np.int16)
        arr = np.clip(arr + noise_arr, 0, 255).astype(np.uint8)
        return Image.fromarray(arr)
    
    def create_histogram(self, img: Image.Image) -> go.Figure:
        """이미지의 히스토그램을 plotly로 생성합니다."""
        arr = np.array(img)
        
        if arr.ndim == 3 and arr.shape[2] == 3:
            # 컬러 이미지
            fig = go.Figure()
            
            for i, color in enumerate(['red', 'green', 'blue']):
                hist, bins = np.histogram(arr[:,:,i].flatten(), bins=32, range=(0, 255))
                fig.add_trace(go.Bar(
                    x=bins[:-1],
                    y=hist,
                    name=color,
                    opacity=0.7
                ))
            
            fig.update_layout(
                title="픽셀 분포",
                xaxis_title="픽셀값",
                yaxis_title="빈도",
                barmode='overlay'
            )
        else:
            # 그레이스케일 이미지
            hist, bins = np.histogram(arr.flatten(), bins=32, range=(0, 255))
            fig = go.Figure(data=go.Bar(
                x=bins[:-1],
                y=hist,
                name='gray'
            ))
            
            fig.update_layout(
                title="픽셀 분포",
                xaxis_title="픽셀값",
                yaxis_title="빈도"
            )
        
        return fig
    
    def prepare_download(self, img: Image.Image, format: str = "PNG") -> bytes:
        """이미지를 다운로드용 바이트로 변환합니다."""
        buf = io.BytesIO()
        img.save(buf, format=format)
        return buf.getvalue()
    
    def display_images_grid(self, images: List[Image.Image], captions: List[str], cols: int = 4):
        """이미지들을 그리드 형태로 표시합니다."""
        st_cols = st.columns(min(cols, len(images)))
        for idx, (img, caption) in enumerate(zip(images, captions)):
            with st_cols[idx % len(st_cols)]:
                st.image(img, caption=caption, use_container_width=True)
    
    def get_augmentation_parameters(self) -> dict:
        """증강 파라미터들을 UI에서 입력받습니다."""
        # col1, col2, col3, col4 = st.columns(4)
        
        params = {}
        
        # with col1:
        params['rotation'] = st.sidebar.slider("회전 각도", -45, 45, 0, step=1)
            
        # with col2:
        params['flip'] = st.sidebar.checkbox("좌우 반전", value=False)
            
        # with col3:
        params['brightness'] = st.sidebar.slider("밝기 조절", 0.5, 2.0, 1.0, step=0.05)
            
        # with col4:
        # params['noise'] = st.sidebar.checkbox("노이즈 추가", value=False)
        params['noise_intensity'] = st.sidebar.slider("노이즈 강도", 1, 30, 15)
        # params['noise_intensity'] = st.sidebar.slider("노이즈 강도", 1, 30, 15, disabled=not params['noise'])
        
        # 추가 파라미터들
        # col5, col6 = st.columns(2)
        # with col5:
        params['contrast'] = st.sidebar.slider("대비 조절", 0.5, 2.0, 1.0, step=0.05)
        # with col6:
        params['hue'] = st.sidebar.slider("색조 조절", 0.5, 2.0, 1.0, step=0.05)
        
        return params 