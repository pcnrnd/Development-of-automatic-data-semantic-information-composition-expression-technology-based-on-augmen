"""
설정 관리 모듈
"""
import os
import logging
from pathlib import Path


class Config:
    """애플리케이션 설정 클래스"""
    
    # 기본 설정
    DEFAULT_CONFIG = {
        'data_dir': r'/mnt/external_drive/industry_data',  # raw string 사용으로 백슬래시 이스케이프 방지
        'max_workers': 4,
        'log_level': logging.INFO,
        'log_file': './log/prepro.log',
        'db_path': './database/database.db',
        'supported_formats': ['.png', '.jpg', '.jpeg', '.bmp', '.tiff', '.gif', '.csv', '.txt', '.json', '.xml', '.zip'],
        
        # 파일 크기 범위 설정 (MB 단위)
        'file_size_ranges': {
            'small': {'min': 0, 'max': 10, 'level': 'info'},      # 0-10MB: 정보
            'medium': {'min': 10, 'max': 50, 'level': 'warning'}, # 10-50MB: 경고
            'large': {'min': 50, 'max': 100, 'level': 'warning'}, # 50-100MB: 경고
            'very_large': {'min': 100, 'max': float('inf'), 'level': 'error'} # 100MB+: 오류
        },
        'max_file_size_mb': 100,  # 100MB 이상 파일 경고 (기존 호환성)
        
        # 처리 범위 설정
        'processing_ranges': {
            'file_count_limit': 10000,  # 한 번에 처리할 최대 파일 수
            'batch_size': 1000,         # 배치 처리 크기
            'memory_limit_mb': 2048,    # 메모리 사용 제한 (2GB)
            'timeout_seconds': 300      # 파일 처리 타임아웃 (5분)
        },
        
        'progress_interval': 100,  # 진행률 표시 간격
        'extract_all_files': True,  # 모든 파일 형식 처리 여부
        'extract_image_metadata': True,  # 이미지 메타데이터 추출 여부
        'extract_text_metadata': True,  # 텍스트 파일 메타데이터 추출 여부
    }
    
    @classmethod
    def load_config(cls, config_file: str = None) -> dict:
        """설정 로드"""
        config = cls.DEFAULT_CONFIG.copy()
        
        # 환경 변수에서 설정 로드
        if os.getenv('DATA_DIR'):
            config['data_dir'] = os.getenv('DATA_DIR')
        if os.getenv('MAX_WORKERS'):
            config['max_workers'] = int(os.getenv('MAX_WORKERS'))
        if os.getenv('LOG_LEVEL'):
            config['log_level'] = getattr(logging, os.getenv('LOG_LEVEL').upper())
        
        # 파일 크기 범위 환경 변수
        if os.getenv('FILE_SIZE_SMALL_MAX'):
            config['file_size_ranges']['small']['max'] = float(os.getenv('FILE_SIZE_SMALL_MAX'))
        if os.getenv('FILE_SIZE_MEDIUM_MAX'):
            config['file_size_ranges']['medium']['max'] = float(os.getenv('FILE_SIZE_MEDIUM_MAX'))
        if os.getenv('FILE_SIZE_LARGE_MAX'):
            config['file_size_ranges']['large']['max'] = float(os.getenv('FILE_SIZE_LARGE_MAX'))
        
        # 처리 범위 환경 변수
        if os.getenv('FILE_COUNT_LIMIT'):
            config['processing_ranges']['file_count_limit'] = int(os.getenv('FILE_COUNT_LIMIT'))
        if os.getenv('BATCH_SIZE'):
            config['processing_ranges']['batch_size'] = int(os.getenv('BATCH_SIZE'))
        if os.getenv('MEMORY_LIMIT_MB'):
            config['processing_ranges']['memory_limit_mb'] = int(os.getenv('MEMORY_LIMIT_MB'))
        if os.getenv('TIMEOUT_SECONDS'):
            config['processing_ranges']['timeout_seconds'] = int(os.getenv('TIMEOUT_SECONDS'))
        
        # 설정 파일이 있으면 로드
        if config_file and Path(config_file).exists():
            # TODO: JSON 또는 YAML 설정 파일 로드 구현
            pass
            
        return config
    
    @classmethod
    def validate_config(cls, config: dict) -> bool:
        """설정 유효성 검사"""
        try:
            # 데이터 디렉토리 확인
            data_path = Path(config['data_dir'])
            if not data_path.exists():
                print(f"경고: 데이터 디렉토리가 존재하지 않습니다: {config['data_dir']}")
                return False
                
            # max_workers 값 확인
            if config['max_workers'] < 1:
                print("경고: max_workers는 1 이상이어야 합니다.")
                config['max_workers'] = 1
                
            # 로그 레벨 확인
            if config['log_level'] not in [logging.DEBUG, logging.INFO, logging.WARNING, logging.ERROR, logging.CRITICAL]:
                print("경고: 잘못된 로그 레벨입니다. INFO로 설정합니다.")
                config['log_level'] = logging.INFO
                
            return True
            
        except Exception as e:
            print(f"설정 검증 실패: {e}")
            return False
    
    @classmethod
    def get_supported_formats(cls) -> list:
        """지원되는 이미지 형식 반환"""
        return cls.DEFAULT_CONFIG['supported_formats']
    
    @classmethod
    def is_supported_format(cls, file_path: str) -> bool:
        """파일이 지원되는 형식인지 확인"""
        file_ext = Path(file_path).suffix.lower()
        return file_ext in cls.get_supported_formats()
    
    @classmethod
    def get_file_size_range(cls, file_size_mb: float) -> dict:
        """파일 크기에 따른 범위 정보 반환"""
        ranges = cls.DEFAULT_CONFIG['file_size_ranges']
        for range_name, range_info in ranges.items():
            if range_info['min'] <= file_size_mb < range_info['max']:
                return {
                    'range_name': range_name,
                    'level': range_info['level'],
                    'min': range_info['min'],
                    'max': range_info['max']
                }
        return None
    
    @classmethod
    def validate_file_size_range(cls, file_size_mb: float) -> bool:
        """파일 크기가 허용 범위 내인지 확인"""
        ranges = cls.DEFAULT_CONFIG['file_size_ranges']
        # very_large 범위는 허용하지 않음
        for range_name, range_info in ranges.items():
            if range_name == 'very_large':
                continue
            if range_info['min'] <= file_size_mb < range_info['max']:
                return True
        return False
    
    @classmethod
    def get_processing_range_info(cls) -> dict:
        """처리 범위 정보 반환"""
        return cls.DEFAULT_CONFIG['processing_ranges']
    
    @classmethod
    def validate_processing_limits(cls, file_count: int, estimated_memory_mb: float) -> dict:
        """처리 제한 사항 검증"""
        limits = cls.DEFAULT_CONFIG['processing_ranges']
        issues = []
        
        if file_count > limits['file_count_limit']:
            issues.append(f"파일 수가 제한을 초과합니다: {file_count} > {limits['file_count_limit']}")
        
        if estimated_memory_mb > limits['memory_limit_mb']:
            issues.append(f"예상 메모리 사용량이 제한을 초과합니다: {estimated_memory_mb}MB > {limits['memory_limit_mb']}MB")
        
        return {
            'is_valid': len(issues) == 0,
            'issues': issues,
            'recommendations': [
                f"배치 크기를 {limits['batch_size']}개로 줄이세요",
                f"메모리 제한: {limits['memory_limit_mb']}MB",
                f"타임아웃: {limits['timeout_seconds']}초"
            ]
        }