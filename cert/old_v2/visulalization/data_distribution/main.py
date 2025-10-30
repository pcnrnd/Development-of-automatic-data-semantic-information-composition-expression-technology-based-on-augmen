from fastapi import FastAPI, Request
from lib.analyze import *
from lib.logger import RequestLogger
from fastapi.responses import JSONResponse
import pandas as pd
import json

app = FastAPI()

@app.get('/')
def main():
    return 'main'

@app.post('/api/analysis')
async def analysis(request: Request):
    # 로거 초기화
    logger = RequestLogger(__name__)
    logger.setup_logging()
    request_id = logger.start_request()
    
    try:
        # 요청 데이터 파싱
        data = await request.json()
        if isinstance(data, str):
            data = json.loads(data)
        
        # 컬럼 정보 추출
        numeric_cols = data.get('numeric_cols', [])
        categorical_cols = data.get('categorical_cols', [])
        
        # 데이터 정보 로깅
        logger.log_data_info(list(data.keys()), numeric_cols, categorical_cols)
        
        # 데이터프레임 생성
        df = pd.DataFrame(data['data'])
        logger.log_dataframe_info(df.shape)
        
        # 데이터 품질 분석
        missing_ratio, duplicate_ratio, quality_issues = analyze_data_quality(df)
        logger.log_quality_analysis(missing_ratio, duplicate_ratio, quality_issues)
        
        # 이상값 분석
        outlier_info = detect_outliers(df, numeric_cols)
        logger.log_outlier_analysis(outlier_info)
        
        # 분포 분석
        distribution_insights = analyze_distributions(df, numeric_cols, categorical_cols)
        logger.log_distribution_analysis(distribution_insights)
        
        # 권장사항 생성
        recommendations = generate_recommendations(quality_issues, outlier_info, distribution_insights)
        logger.log_recommendations(recommendations)
        
        # 처리 시간 계산
        processing_time = logger.end_request()
        
        return JSONResponse(content={
            'request_id': request_id,
            'processing_time': processing_time,
            'missing_ratio': missing_ratio,
            'duplicate_ratio': duplicate_ratio,
            'quality_issues': quality_issues,
            'outlier_info': outlier_info,
            'distribution_insights': distribution_insights,
            'recommendations': recommendations
        })
        
    except KeyError as e:
        logger.log_error("필수 키 누락", str(e))
        return JSONResponse(
            content={"error": f"필수 데이터 누락: {str(e)}", "request_id": request_id}, 
            status_code=400
        )
    except Exception as e:
        logger.log_error("분석 중 오류 발생", str(e), exc_info=True)
        return JSONResponse(
            content={"error": f"분석 오류: {str(e)}", "request_id": request_id}, 
            status_code=500
        )