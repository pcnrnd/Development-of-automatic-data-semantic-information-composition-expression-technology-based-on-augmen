"""
파일 저장 및 관리를 담당하는 모듈
"""

import os
import datetime
from typing import List, Tuple
from PIL import Image
import streamlit as st


class FileManager:
    """전처리된 이미지 파일들을 관리하는 클래스"""
    
    def __init__(self):
        self.default_output_path = "./outputs/processed_images"
    
    def validate_path(self, path: str) -> Tuple[bool, bool]:
        """
        경로 유효성을 검사합니다.
        
        Args:
            path (str): 검사할 경로
            
        Returns:
            Tuple[bool, bool]: (경로 존재여부, 쓰기권한여부)
        """
        path_exists = os.path.exists(path)
        path_writable = False
        
        if path_exists:
            path_writable = os.access(path, os.W_OK)
        
        return path_exists, path_writable
    
    def create_output_directory(self, path: str) -> bool:
        """
        출력 디렉토리를 생성합니다.
        
        Args:
            path (str): 생성할 경로
            
        Returns:
            bool: 생성 성공 여부
        """
        try:
            os.makedirs(path, exist_ok=True)
            return True
        except Exception as e:
            st.error(f"디렉토리 생성 실패: {str(e)}")
            return False
    
    def generate_filename(self, original_name: str, save_format: str) -> str:
        """
        저장할 파일명을 생성합니다.
        
        Args:
            original_name (str): 원본 파일명
            save_format (str): 저장 형식 (PNG/JPEG)
            
        Returns:
            str: 생성된 파일명 (원본명_processed.확장자)
        """
        # 확장자 결정
        if save_format.lower() == "png":
            ext = ".png"
        elif save_format.lower() == "jpeg":
            ext = ".jpg"
        else:
            ext = os.path.splitext(original_name)[1]
        
        # 파일명 생성 (원본명_processed 형식만 지원)
        base_name = os.path.splitext(os.path.basename(original_name))[0]
        return f"{base_name}_processed{ext}"
    
    def save_processed_images(self, processed_images: List[Image.Image], 
                            original_files: List, 
                            output_path: str,
                            save_format: str = "PNG") -> Tuple[List[str], List[str]]:
        """
        전처리된 이미지들을 지정된 폴더에 저장합니다.
        
        Args:
            processed_images (List[Image.Image]): 처리된 이미지 리스트
            original_files (List): 원본 파일 정보
            output_path (str): 저장할 출력 경로
            save_format (str): 저장 형식 ("PNG", "JPEG")
            
        Returns:
            Tuple[List[str], List[str]]: (성공한 파일명 리스트, 실패한 파일 정보 리스트)
        """
        saved_files = []
        failed_files = []
        
        for i, (img, file_info) in enumerate(zip(processed_images, original_files)):
            try:
                # 원본 파일명 추출
                if hasattr(file_info, 'name'):
                    original_name = file_info.name
                elif isinstance(file_info, str):
                    original_name = os.path.basename(file_info)
                else:
                    original_name = f"unknown_{i}"
                
                # 저장할 파일명 생성
                filename = self.generate_filename(original_name, save_format)
                file_path = os.path.join(output_path, filename)
                
                # 이미지 저장
                if save_format.upper() == "JPEG":
                    # JPEG 저장 시 투명도 제거
                    if img.mode in ('RGBA', 'LA'):
                        # 투명 배경을 흰색으로 변환
                        background = Image.new('RGB', img.size, (255, 255, 255))
                        background.paste(img, mask=img.split()[-1] if img.mode == 'RGBA' else None)
                        img_to_save = background
                    else:
                        img_to_save = img.convert('RGB')
                    
                    img_to_save.save(file_path, "JPEG", quality=95)
                else:
                    # PNG 저장 (기본값)
                    img.save(file_path, "PNG")
                
                saved_files.append(filename)
                
            except Exception as e:
                failed_files.append(f"{original_name}: {str(e)}")
        
        return saved_files, failed_files
    
    def get_folder_stats(self, folder_path: str) -> dict:
        """
        폴더의 통계 정보를 반환합니다.
        
        Args:
            folder_path (str): 분석할 폴더 경로
            
        Returns:
            dict: 폴더 통계 정보
        """
        if not os.path.exists(folder_path):
            return {"error": "폴더가 존재하지 않습니다"}
        
        try:
            files = [f for f in os.listdir(folder_path) if os.path.isfile(os.path.join(folder_path, f))]
            
            image_extensions = {'.jpg', '.jpeg', '.png', '.bmp', '.tiff', '.tif'}
            image_files = [f for f in files if os.path.splitext(f)[1].lower() in image_extensions]
            
            total_size = sum(os.path.getsize(os.path.join(folder_path, f)) for f in files)
            
            return {
                "total_files": len(files),
                "image_files": len(image_files), 
                "total_size_mb": round(total_size / (1024 * 1024), 2),
                "image_extensions": list(set(os.path.splitext(f)[1].lower() for f in image_files))
            }
        except Exception as e:
            return {"error": f"폴더 분석 실패: {str(e)}"}
