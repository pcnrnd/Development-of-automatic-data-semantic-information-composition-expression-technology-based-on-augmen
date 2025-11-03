"""
이미지 증강 기능을 제공하는 모듈
"""

import numpy as np
from PIL import Image, ImageEnhance, ImageOps
import streamlit as st
import plotly.graph_objects as go
import plotly.express as px
import io
import os
import time
import psutil
import logging
from datetime import datetime, timedelta
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
        
        # 로거 설정 (핸들러 추가 없이 - main.py의 basicConfig 사용)
        self.logger = logging.getLogger('ImageProcessor')
        self.logger.setLevel(logging.INFO)
    
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
                st.image(img, caption=caption, width='stretch')
    
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
    
    def process_and_save_image(self, img: Image.Image, file_path: str, params: dict, 
                             output_dir: str, save_format: str = "PNG") -> str:
        """
        이미지를 전처리하고 저장합니다.
        
        Args:
            img (Image.Image): 원본 이미지
            file_path (str): 원본 파일 경로
            params (dict): 전처리 파라미터
            output_dir (str): 저장할 디렉토리
            save_format (str): 저장 형식 (PNG, JPG, JPEG, 원본과 동일)
            
        Returns:
            str: 저장된 파일의 전체 경로
        """
        # 이미지 전처리
        processed_img = self.augment_image(img, **params)
        
        # 저장 형식에 따른 처리
        base_name = os.path.splitext(os.path.basename(file_path))[0]
        
        if save_format.upper() in ["JPEG", "JPG"]:
            output_filename = f"{base_name}_processed.jpg"
            processed_img = self._convert_to_jpeg(processed_img)
            processed_img.save(os.path.join(output_dir, output_filename), "JPEG", quality=95)
        elif save_format == "원본과 동일":
            # 원본 파일 확장자 확인
            original_ext = os.path.splitext(file_path)[1].lower()
            if original_ext in ['.jpg', '.jpeg']:
                output_filename = f"{base_name}_processed.jpg"
                processed_img = self._convert_to_jpeg(processed_img)
                processed_img.save(os.path.join(output_dir, output_filename), "JPEG", quality=95)
            else:
                output_filename = f"{base_name}_processed.png"
                processed_img.save(os.path.join(output_dir, output_filename), "PNG")
        else:
            # PNG 저장 (기본값)
            output_filename = f"{base_name}_processed.png"
            processed_img.save(os.path.join(output_dir, output_filename), "PNG")
        
        return os.path.join(output_dir, output_filename)
    
    def _convert_to_jpeg(self, img: Image.Image) -> Image.Image:
        """
        이미지를 JPEG 형식으로 변환합니다.
        투명도가 있는 경우 흰색 배경으로 변환합니다.
        
        Args:
            img (Image.Image): 변환할 이미지
            
        Returns:
            Image.Image: RGB 모드로 변환된 이미지
        """
        if img.mode in ('RGBA', 'LA'):
            # 투명도가 있는 경우 흰색 배경으로 변환
            background = Image.new('RGB', img.size, (255, 255, 255))
            background.paste(img, mask=img.split()[-1] if img.mode == 'RGBA' else None)
            return background
        else:
            # RGB 모드로 변환
            return img.convert('RGB')
    
    def batch_process_images(self, file_paths: List[str], params: dict, 
                           output_dir: str, save_format: str = "PNG"):
        """
        여러 이미지를 배치로 처리합니다. (성능 메트릭과 함께 실시간 표시)
        
        Args:
            file_paths (List[str]): 처리할 이미지 파일 경로들
            params (dict): 전처리 파라미터
            output_dir (str): 저장할 디렉토리
            save_format (str): 저장 형식
            
        Yields:
            dict: 처리 결과 정보
        """
        start_time = time.time()
        processed_size = 0
        
        # 처리 시작 로깅
        self.logger.info("=" * 40)
        self.logger.info("이미지 배치 처리 시작")
        self.logger.info(f"처리할 이미지: {len(file_paths)}개")
        self.logger.info(f"출력 디렉토리: {output_dir}")
        self.logger.info(f"저장 형식: {save_format}")
        self.logger.info(f"전처리 파라미터: {self._format_params(params)}")
        self.logger.info("=" * 40)
        
        for i, file_path in enumerate(file_paths):
            filename = os.path.basename(file_path)
            process_start = time.time()
            
            try:
                # 현재 상태 표시
                elapsed = time.time() - start_time
                progress = (i / len(file_paths)) * 100
                
                self.logger.info(f"[{i+1:3d}/{len(file_paths)}] 처리 시작: {filename}")
                self.logger.info(f"[{i+1:3d}/{len(file_paths)}] 진행률: {progress:.1f}% | 경과시간: {elapsed:.1f}초")
                
                # 파일 크기 정보
                file_size = os.path.getsize(file_path)
                processed_size += file_size
                
                # 처리 속도 계산
                if elapsed > 0:
                    avg_speed = processed_size / elapsed
                    self.logger.info(f"[{i+1:3d}/{len(file_paths)}] 처리 속도: {self._format_size(avg_speed)}/초")
                
                # 실제 처리
                img = Image.open(file_path).convert("RGB")
                output_path = self.process_and_save_image(img, file_path, params, output_dir, save_format)
                
                # 처리 시간 계산
                process_time = time.time() - process_start
                self.logger.info(f"[{i+1:3d}/{len(file_paths)}] 처리 완료: {filename} ({process_time:.3f}초)")
                
                # 메모리 정리
                del img
                
                # 성공 결과 반환
                yield {
                    'progress': i + 1,
                    'total': len(file_paths),
                    'current_file': file_path,
                    'output_path': output_path,
                    'status': 'success',
                    'process_time': process_time,
                    'file_size': file_size
                }
                
            except Exception as e:
                self.logger.error(f"[{i+1:3d}/{len(file_paths)}] 처리 실패: {filename}")
                self.logger.error(f"[{i+1:3d}/{len(file_paths)}] 오류: {str(e)}")
                
                # 실패 결과 반환
                yield {
                    'progress': i + 1,
                    'total': len(file_paths),
                    'current_file': file_path,
                    'error': str(e),
                    'status': 'failed'
                }
        
        # 처리 완료 통계
        total_time = time.time() - start_time
        self.logger.info("=" * 40)
        self.logger.info("이미지 배치 처리 완료")
        self.logger.info(f"총 처리시간: {total_time:.2f}초")
        self.logger.info(f"총 처리용량: {self._format_size(processed_size)}")
        self.logger.info(f"평균 처리속도: {len(file_paths)/total_time:.2f} 이미지/초")
        self.logger.info("=" * 40)
    
    def _format_params(self, params: dict) -> str:
        """파라미터 포맷팅"""
        formatted = []
        for key, value in params.items():
            if isinstance(value, float):
                formatted.append(f"{key}={value:.2f}")
            else:
                formatted.append(f"{key}={value}")
        return ", ".join(formatted)
    
    def _format_size(self, size_bytes: int) -> str:
        """파일 크기 포맷팅"""
        if size_bytes == 0:
            return "0B"
        
        size_names = ["B", "KB", "MB", "GB"]
        i = 0
        while size_bytes >= 1024 and i < len(size_names) - 1:
            size_bytes /= 1024.0
            i += 1
        
        return f"{size_bytes:.1f}{size_names[i]}" 