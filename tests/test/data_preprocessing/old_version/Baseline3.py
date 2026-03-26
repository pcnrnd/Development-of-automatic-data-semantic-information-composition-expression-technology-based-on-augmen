# 필요한 라이브러리 import
import os
import glob
import time
import json
import psutil
import sqlite3
import logging
import subprocess
import pandas as pd
import duckdb
from tqdm import tqdm
from pathlib import Path
from lib.prepro import Preprocessing


prepro = Preprocessing()
con = duckdb.connect()

start_time = time.time() # 프로그램 시작 시간 기록

# logging 모드 설정: logging.INFO / logging.DEBUG
log_file = './log/prepro.log' # 데이터 처리 로그 저장 경로
logging.basicConfig(filename=log_file, level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s', encoding='utf-8') 

logging.info('데이터 처리 시작')
prepro.log_system_resources() # 시스템 리소스 확인

# data_dir = '../exhdd/industry_data/264.건설 모래 품질 관리데이터/' 
data_dir = '../exhdd/industry_data/' 


data_path = subprocess.run(['cmd', '/c', 'tree', data_dir], text=True, capture_output=True, check=True)

if data_path.returncode == 0:
    logging.info("데이터 디렉토리 확인:\n%s", data_path.stdout) # 로그 파일에 디렉토리 정보 출력

logging.info('데이터 로딩')

img_dir_list = prepro.get_all_file_paths('../exhdd/industry_data/') # 모든 경로 추출

# 이미지 데이터에서 메타 데이터 추출
logging.info('메타 데이터 추출 및 테이블 생성 시작..') # 데이터 처리 및 데이터프레임 생성
df = prepro.make_polars_dataframe(img_dir_list)

logging.info('메타 데이터 추출 및 테이블 생성 완료')

logging.info(f"Table row: {len(df)}, Table columns: {len(df.columns)}")

# 데이터 타입별로 counts 확인
img_types = ['png', 'jpg', 'jpeg', 'etc']
png_num = 0
jpg_num = 0
etc = 0
img_type_data = [] 
for data in df['full_path']:
    img_type_data.append(data.split('.')[-1])

for idx, img_types in enumerate(img_type_data):
    if img_types == 'png':
        png_num += 1
    elif img_types == 'jpg' or img_types == 'jpeg':
        jpg_num += 1
    else:
        etc += 1

# 처리한 데이터 정보 출력
file_size = sum(df['file_size']) # 전체 데이터 용량 sum
file_info = f"""
            데이터 처리 정보:
            --------------------------------------
            전체 이미지 데이터 수: {len(df)}
            전체 이미지 데이터 용량: {prepro.format_bytes(file_size)}
            png counts: {png_num} 
            jpg counts: {jpg_num}
            etc counts: {etc}
            --------------------------------------
            """
logging.info(file_info) # 데이터 처리 정보 확인

# 데이터베이스 생성 및 저장
db_path = './database/database.db' # sqlite3 데이터베이스 경로
conn = sqlite3.connect(db_path)
logging.info('데이터베이스 생성')

if Path(db_path).exists():
    logging.info("데이터베이스 경로: %s", db_path)

# 데이터 베이스에 데이터 저장
df.to_sql('TB_meta_info', conn, if_exists='replace', index=False) # pandas 데이터프레임을 db에 저장
logging.info('데이터베이스에 데이터 저장 완료')

conn.close() 
logging.info('데이터베이스 연결 종료')

# 전체 디렉토리 확인
current_directory = Path.cwd() 
# tree 명령어 실행 (현재 디렉토리만 포함)
# total_dir = subprocess.run(['tree', '-d', current_directory], text=True, capture_output=True, check=True)

total_dir = subprocess.run(['cmd', '/c', 'tree', current_directory], text=True, capture_output=True, check=True)


# 실행 결과를 로그 파일에 저장
if total_dir.returncode == 0:
    logging.info("전체 디렉토리 구조:\n%s", total_dir.stdout)

end_time = time.time()  # 실행 후 시간을 기록
elapsed_time = end_time - start_time  # 경과된 시간 계산
minutes, seconds = divmod(elapsed_time, 60) # ms를 분, 초로 변환
logging.info("경과 시간: {}분 {}초".format(int(minutes), int(seconds))) # 분, 초로 변환한 데이터 로깅
logging.info('데이터 처리 종료') 