import os
import glob
import time
import json
import psutil
import sqlite3
import logging
import subprocess
import pandas as pd
import polars as pl
from tqdm import tqdm
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
from PIL import Image


class Preprocessing:
    def __init__(self):
        pass

    def format_bytes(size): # 파일 용량 계산
        '''
        byte를 KB, MB, GB, TB 등으로 변경하는 함수
        '''
        volum = 1024
        n = 0
        volum_labels = {0: 'B', 1: 'KB', 2: 'MB', 3: 'GB', 4: 'TB'}
        size - 0
        while tqdm(size > volum):
            size /= volum
            n += 1
        # return f"{size:.5f} {volum_labels[n]}"
        return f"{size} {volum_labels[n]}"


    def normalize_json(json_meta_data):
        """
        json 데이터를 pandas DataFrame으로 변환하는 함수
        """
        json_df = []
        for file in tqdm(json_meta_data, desc="JSON 파일 처리"):
            try:
                with open(file, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                    if data:  # JSON 파일이 비어 있지 않은 경우만 추가
                        data_df = pd.json_normalize(data)
                        json_df.append(data_df)
                    else:
                        logging.warning(f"파일 {file}에 데이터가 비어 있습니다.")
            except Exception as e:
                logging.error(f"파일 {file}을(를) 읽는 중 오류 발생: {e}")
        return json_df


    def log_system_resources(self):
        '''
        불필요한 자원이 사용되고 있는지 확인하는 함수
        '''
        # 시스템 리소스 정보를 얻기 위해 psutil 사용
        memory_info = psutil.virtual_memory() # 메모리 정보
        cpu_percent = psutil.cpu_percent(interval=1)  # CPU 사용량 (1초 간격)
        disk_usage = psutil.disk_usage('/')  # 루트 디스크 사용량 정보
        
        current_time = time.strftime('%Y-%m-%d %H:%M:%S') # 현재 시간 기록
        # 시스템 리소스 정보를 표 형태로 생성
        system_info = f"""
        사용 중인 자원 확인:
        --------------------------------------
        전체 메모리: {self.format_bytes(memory_info.total)} 
        사용 가능한 메모리: {self.format_bytes(memory_info.available)} 
        사용된 메모리: {self.format_bytes(memory_info.used)} 
        메모리 사용 퍼센트: {memory_info.percent}%
        CPU 사용 퍼센트: {cpu_percent}%
        전체 디스크 용량: {self.format_bytes(disk_usage.total)} 
        사용된 디스크 용량: {self.format_bytes(disk_usage.used)} 
        디스크 사용 퍼센트: {disk_usage.percent}%
        --------------------------------------
        """ # 각주가 아니라 log 출력되는 comment
        logging.info(system_info)

    def get_all_json_path(self, root_path):
        """
        root dir에서 하위 dir 경로를 순회하며 json 파일만 반환
        Args:
            root_path(str): 검색 시작할 루트 경로
        Return:
            list: json 파일 경로 목록
        """
        paths = glob.glob(os.path.join(root_path, '**'), recursive=True)
        json_file_paths = [path for path in paths if os.path.isfile(path) and path.endswith('.json')]
        
        return json_file_paths

    def get_all_file_paths(self, root_path):
        """
        glob를 사용하여 하위 디렉토리까지 검색 \n
        .zip 파일을 제외한 파일들만 필터링
        """
        # glob를 사용하여 하위 디렉토리까지 검색
        paths = glob.glob(os.path.join(root_path, '**'), recursive=True)
        
        # .zip 파일을 제외한 파일들만 필터링
        # file_paths = [path for path in paths if os.path.isfile(path) and not path.endswith('.zip')]
        image_paths = [path for path in paths if os.path.isfile(path) and path.lower().endswith(('.png', '.jpg', '.jpeg', '.bmp', '.tiff'))]

        return image_paths


    def _extract_data(self, paths, extractor):
        with ThreadPoolExecutor() as executor:
            return list(executor.map(extractor, paths))

    def extract_file_id(self, paths):
        # 순차적인 ID 생성 (1, 2, 3, ...)
        return list(range(1, len(paths) + 1))

    def extract_file_name(self, paths):
        return self._extract_data(paths, lambda path: os.path.basename(path))

    def extract_folder_name(self, paths):
        return self._extract_data(paths, lambda path: os.path.basename(os.path.dirname(path)))

    def extract_file_size(self, paths):
        return self._extract_data(paths, lambda path: os.path.getsize(path))

    def extract_image_resolutions(self, paths):
        image_paths = [path for path in paths if path.lower().endswith(('.png', '.jpg', '.jpeg', '.bmp', '.tiff'))]

        return self._extract_data(image_paths, lambda path: Image.open(path).size)

    def make_polars_dataframe(self, paths):
        '''
        polars_dataframe 생성 \n
        full_path, file_id, file_name, folder_name, file_size, image_width, image_height
        '''
        image_width_height = self.extract_image_resolutions(paths)

        df = pl.DataFrame({
            "full_path": paths,
            "file_id": self.extract_file_id(paths),
            "file_name": self.extract_file_name(paths),
            "folder_name": self.extract_folder_name(paths),
            "file_size": self.extract_file_size(paths),
            "image_width": [size[0] for size in image_width_height],
            "image_height": [size[1] for size in image_width_height],

        })
        return df.to_pandas()