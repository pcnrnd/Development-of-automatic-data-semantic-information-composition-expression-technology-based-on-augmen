# 필요한 라이브러리 import
import time
import logging
import sys
from pathlib import Path
from lib.prepro import DataProcessor
from config import Config


def main():
    """메인 실행 함수"""
    start_time = time.time() # 프로그램 시작 시간 기록
    
    try:
        # 설정 로드 및 검증
        config = Config.load_config()
        if not Config.validate_config(config):
            print("설정 검증에 실패했습니다. 프로그램을 종료합니다.")
            sys.exit(1)
        
        # 로깅 설정
        DataProcessor.setup_logging(
            log_file=config['log_file'],
            level=config['log_level']
        )
        logging.info('데이터 처리 시작')
        logging.info(f"설정: max_workers={config['max_workers']}, log_level={config['log_level']}")
        logging.info(DataProcessor.log_system_resources()) # 시스템 리소스 확인
        
        # 데이터 디렉토리 정보 확인
        data_dir = config['data_dir']
        logging.info(f"데이터 디렉토리: {data_dir}")
        logging.info(f"데이터 디렉토리 확인중...")
        
        # 빠른 요약(폴더/파일 개수 및 진행률)만 로그로 남김
        data_path_info = DataProcessor.get_directory_info(data_dir, summary_only=True)
        if data_path_info:
            logging.info("데이터 디렉토리 요약:\n%s", data_path_info)
        else:
            logging.warning("데이터 디렉토리 정보를 가져올 수 없습니다.")
        
        # 데이터 소스 디렉토리 구조 출력
        logging.info("데이터 소스 디렉토리 구조:")
        data_structure = DataProcessor.get_directory_info(data_dir, summary_only=False)
        if data_structure:
            logging.info(data_structure)
        else:
            logging.warning("데이터 소스 디렉토리 구조를 가져올 수 없습니다.")
        
        # 배치 크기 설정
        batch_size = config['processing_ranges']['batch_size']
        logging.info(f"배치 크기: {batch_size}")
            
        # 데이터 처리 파이프라인 실행 (배치 처리)
        logging.info("배치 데이터 처리 파이프라인 시작...")
        pandas_df, file_info, db_path = DataProcessor.process_data_pipeline(
            data_dir, 
            output_db_path=config['db_path'],
            max_workers=config['max_workers'],
            batch_size=batch_size
        )

        # 전체 디렉토리 구조 확인
        current_directory = Path.cwd() 
        total_dir_info = DataProcessor.get_directory_info(str(current_directory))
        if total_dir_info:
            logging.info("전체 디렉토리 구조:\n%s", total_dir_info)
        
        # 결과 로깅
        logging.info('메타 데이터 추출 완료')
        logging.info('데이터 테이블 생성 완료') 
        logging.info(f"Table row: {len(pandas_df)}, Table columns: {len(pandas_df.columns)}")
        logging.info(file_info)
        logging.info(f'데이터베이스 저장 완료: {db_path}')

        # 실행 시간 계산
        end_time = time.time()
        elapsed_time = end_time - start_time
        minutes, seconds = divmod(elapsed_time, 60)

        logging.info("경과 시간: {}분 {}초".format(int(minutes), int(seconds)))
        logging.info('데이터 처리 종료')
        
    except FileNotFoundError as e:
        logging.error(f"파일을 찾을 수 없습니다: {e}")
        print(f"오류: 파일을 찾을 수 없습니다 - {e}")
        sys.exit(1)
    except PermissionError as e:
        logging.error(f"권한 오류: {e}")
        print(f"오류: 접근 권한이 없습니다 - {e}")
        sys.exit(1)
    except ValueError as e:
        logging.error(f"값 오류: {e}")
        print(f"오류: 잘못된 값입니다 - {e}")
        sys.exit(1)
    except Exception as e:
        logging.error(f"예상치 못한 오류: {e}")
        print(f"오류: 예상치 못한 문제가 발생했습니다 - {e}")
        sys.exit(1)


if __name__ == "__main__":
    main() 