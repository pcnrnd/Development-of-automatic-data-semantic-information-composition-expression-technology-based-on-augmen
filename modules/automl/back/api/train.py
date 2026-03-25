from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse
from io import StringIO
from services.clf_automl import compare_clf_models
from services.reg_automl import compare_reg_models
from services.cluster_automl import compare_cluster_models
import pandas as pd
import json
import logging

# 로깅 설정
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

router = APIRouter()

@router.post('/classification')
async def new_clf(request: Request):
    try:
        data = await request.json()
        logger.info(f"분류 요청 데이터: {data.keys()}")
        
        # 데이터 검증
        if 'json_data' not in data or 'target' not in data:
            return JSONResponse(
                status_code=400,
                content={'error': '필수 필드가 누락되었습니다: json_data, target'}
            )
        
        df = pd.read_json(StringIO(data['json_data']))
        logger.info(f"데이터프레임 형태: {df.shape}")
        
        # target이 리스트인 경우 첫 번째 요소 사용
        target = data['target'][0] if isinstance(data['target'], list) else data['target']
        logger.info(f"타겟 컬럼: {target}")
        
        # 데이터 검증
        if target not in df.columns:
            return JSONResponse(
                status_code=400,
                content={'error': f'타겟 컬럼 "{target}"이 데이터에 존재하지 않습니다.'}
            )
        
        # 수치형 데이터만 선택
        numeric_df = df.select_dtypes(include=['number'])
        if target not in numeric_df.columns:
            return JSONResponse(
                status_code=400,
                content={'error': f'타겟 컬럼 "{target}"이 수치형이 아닙니다.'}
            )
        
        reg_compare = compare_clf_models(numeric_df, target)
        dumps_data = json.dumps(reg_compare)
        logger.info('분류 모델 학습 완료')

        return JSONResponse(content={'result': dumps_data})
    except Exception as e:
        logger.error(f"분류 모델 학습 오류: {str(e)}")
        return JSONResponse(
            status_code=500,
            content={'error': f'분류 모델 학습 오류: {str(e)}'}
        )

@router.post('/regression')
async def new_reg(request: Request):
    try:
        data = await request.json()
        logger.info(f"회귀 요청 데이터: {data.keys()}")
        
        # 데이터 검증
        if 'json_data' not in data or 'target' not in data:
            return JSONResponse(
                status_code=400,
                content={'error': '필수 필드가 누락되었습니다: json_data, target'}
            )
        
        df = pd.read_json(StringIO(data['json_data']))
        logger.info(f"데이터프레임 형태: {df.shape}")
        
        # target이 리스트인 경우 첫 번째 요소 사용
        target = data['target'][0] if isinstance(data['target'], list) else data['target']
        logger.info(f"타겟 컬럼: {target}")
        
        # 데이터 검증
        if target not in df.columns:
            return JSONResponse(
                status_code=400,
                content={'error': f'타겟 컬럼 "{target}"이 데이터에 존재하지 않습니다.'}
            )
        
        # 수치형 데이터만 선택
        numeric_df = df.select_dtypes(include=['number'])
        if target not in numeric_df.columns:
            return JSONResponse(
                status_code=400,
                content={'error': f'타겟 컬럼 "{target}"이 수치형이 아닙니다.'}
            )
        
        # 결측값 처리
        numeric_df = numeric_df.dropna()
        if len(numeric_df) == 0:
            return JSONResponse(
                status_code=400,
                content={'error': '결측값 제거 후 데이터가 없습니다.'}
            )
        
        reg_compare = compare_reg_models(numeric_df, target)
        dumps_data = json.dumps(reg_compare)
        logger.info('회귀 모델 학습 완료')
        
        return JSONResponse(content={'result': dumps_data})
    except Exception as e:
        logger.error(f"회귀 모델 학습 오류: {str(e)}")
        return JSONResponse(
            status_code=500,
            content={'error': f'회귀 모델 학습 오류: {str(e)}'}
        )

@router.post('/clustering')
async def new_cluster(request: Request):
    try:
        data = await request.json()
        logger.info(f"군집화 요청 데이터: {data.keys()}")
        
        # 데이터 검증
        if 'json_data' not in data:
            return JSONResponse(
                status_code=400,
                content={'error': '필수 필드가 누락되었습니다: json_data'}
            )
        
        df = pd.read_json(StringIO(data['json_data']))
        logger.info(f"데이터프레임 형태: {df.shape}")
        
        # 수치형 데이터만 선택
        numeric_df = df.select_dtypes(include=['number'])
        if len(numeric_df.columns) == 0:
            return JSONResponse(
                status_code=400,
                content={'error': '수치형 데이터가 없습니다.'}
            )
        
        # 결측값 처리
        numeric_df = numeric_df.dropna()
        if len(numeric_df) == 0:
            return JSONResponse(
                status_code=400,
                content={'error': '결측값 제거 후 데이터가 없습니다.'}
            )
        
        # 군집화는 비지도 학습이므로 target 필드는 무시
        logger.info('군집화 모델 학습 시작...')
        cluster_compare = compare_cluster_models(numeric_df)
        dumps_data = json.dumps(cluster_compare)
        logger.info('군집화 모델 학습 완료')
        
        return JSONResponse(content={'result': dumps_data})
    except Exception as e:
        logger.error(f"군집화 모델 학습 오류: {str(e)}")
        return JSONResponse(
            status_code=500,
            content={'error': f'군집화 모델 학습 오류: {str(e)}'}
        )