import logging
import uuid
import time
from datetime import datetime
from typing import Optional
from contextlib import contextmanager

def time_buffer():
    time.sleep(0.5)

class RequestLogger:
    """요청별 로깅을 위한 클래스"""
    
    def __init__(self, name: str = __name__):
        self.logger = logging.getLogger(name)
        self.request_id: Optional[str] = None
        self.start_time: Optional[datetime] = None
    
    def setup_logging(self, level: int = logging.INFO):
        """로거 설정"""
        logging.basicConfig(
            level=level,
            format='%(asctime)s | %(levelname)-8s | %(name)s | %(funcName)s:%(lineno)d | %(message)s',
            datefmt='%Y-%m-%d %H:%M:%S'
        )
    
    def start_request(self, request_id: Optional[str] = None) -> str:
        """요청 시작"""
        self.request_id = request_id or str(uuid.uuid4())[:8]
        self.start_time = datetime.now()
        self.info("데이터 분석 요청 시작")
        time_buffer()
        return self.request_id
    
    def end_request(self) -> float:
        """요청 종료 및 처리시간 반환"""
        if self.start_time:
            processing_time = (datetime.now() - self.start_time).total_seconds()
            self.info(f"분석 완료")
            return processing_time
        return 0.0
    
    def _format_message(self, message: str) -> str:
        """메시지에 request_id 추가"""
        if self.request_id:
            return f"[{self.request_id}] {message}"
        return message
    
    def info(self, message: str):
        """INFO 레벨 로그"""
        self.logger.info(self._format_message(message))
    
    def warning(self, message: str):
        """WARNING 레벨 로그"""
        self.logger.warning(self._format_message(message))
    
    def error(self, message: str, exc_info: bool = False):
        """ERROR 레벨 로그"""
        self.logger.error(self._format_message(message), exc_info=exc_info)
    
    def debug(self, message: str):
        """DEBUG 레벨 로그"""
        self.logger.debug(self._format_message(message))
    
    def log_data_info(self, data_keys: list, numeric_cols: list, categorical_cols: list):
        """데이터 정보 로깅"""
        self.info(f"요청 데이터 키: {data_keys}")
        time_buffer()
        self.info(f"컬럼 분류 완료 - 수치형: {len(numeric_cols)}개, 범주형: {len(categorical_cols)}개")
        time_buffer()
        self.debug(f"수치형 컬럼 목록: {numeric_cols}")
        time_buffer()
        self.debug(f"범주형 컬럼 목록: {categorical_cols}")
        time_buffer()
    
    def log_dataframe_info(self, shape: tuple):
        """데이터프레임 정보 로깅"""
        self.info(f"데이터프레임 생성 완료 - 형태: {shape[0]}행 x {shape[1]}열")
        time_buffer()
    
    def log_quality_analysis(self, missing_ratio: float, duplicate_ratio: float, quality_issues: list):
        """품질 분석 결과 로깅"""
        self.info("데이터 품질 분석 시작")
        self.info(f"품질 분석 결과 - 결측값: {missing_ratio:.2f}%, 중복값: {duplicate_ratio:.2f}%")
        time_buffer()
        if quality_issues:
            self.warning(f"품질 이슈 발견: {len(quality_issues)}개")
            for i, issue in enumerate(quality_issues, 1):
                self.warning(f"이슈 {i}: {issue}")
        else:
            self.info("데이터 품질 양호")
    
    def log_outlier_analysis(self, outlier_info: list):
        """이상값 분석 결과 로깅"""
        self.info("이상값 분석 시작")
        
        if outlier_info:
            self.warning(f"이상값 발견: {len(outlier_info)}개 컬럼")
            for outlier in outlier_info:
                self.warning(f"이상값: {outlier}")
                time_buffer()
        else:
            self.info("이상값 없음")
    
    def log_distribution_analysis(self, distribution_insights: list):
        """분포 분석 결과 로깅"""
        self.info("분포 분석 시작")
        
        if distribution_insights:
            self.info(f"분포 인사이트: {len(distribution_insights)}개")
            for insight in distribution_insights:
                self.info(f"인사이트: {insight}")
                time_buffer()
        else:
            self.info("특별한 분포 특성 없음")
                
    def log_recommendations(self, recommendations: list):
        """권장사항 로깅"""
        self.info("권장사항 생성 시작")
        self.info(f"권장사항 생성 완료: {len(recommendations)}개")
        
        for i, rec in enumerate(recommendations, 1):
            self.info(f"권장사항 {i}: {rec}")
            time_buffer()
    def log_error(self, error_type: str, error_message: str, exc_info: bool = False):
        """에러 로깅"""
        self.error(f"{error_type}: {error_message}", exc_info=exc_info)

@contextmanager
def request_logger(name: str = __name__):
    """요청 로거 컨텍스트 매니저"""
    logger = RequestLogger(name)
    logger.setup_logging()
    request_id = logger.start_request()
    
    try:
        yield logger
    finally:
        logger.end_request()

# 전역 로거 인스턴스
app_logger = RequestLogger(__name__)
app_logger.setup_logging()
