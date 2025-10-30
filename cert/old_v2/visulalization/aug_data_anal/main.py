from fastapi import FastAPI, Request
import time
from sklearn.metrics.pairwise import cosine_similarity
import pandas as pd
from io import StringIO
import logging



# 코사인 유사도 계산 함수
# def calculate_cosine_similarity(original_df, augmented_df, numeric_cols):
#     """통계적 특성 기반 코사인 유사도 계산"""
#     similarity_results = {}
    
#     for col in numeric_cols:
#         orig_data = original_df[col].dropna()
#         aug_data = augmented_df[col].dropna()
#         time.sleep(0.5)
#         if len(orig_data) > 0 and len(aug_data) > 0:
#             # 통계적 특성 추출 
#             orig_stats = [
#                 orig_data.mean(),
#                 orig_data.std(), 
#                 orig_data.median(),
#                 orig_data.quantile(0.25),
#                 orig_data.quantile(0.75),
#                 orig_data.skew(),  # 왜도
#                 orig_data.kurtosis()  # 첨도
#             ]
            
#             aug_stats = [
#                 aug_data.mean(),
#                 aug_data.std(),
#                 aug_data.median(), 
#                 aug_data.quantile(0.25),
#                 aug_data.quantile(0.75),
#                 aug_data.skew(),
#                 aug_data.kurtosis()
#             ]
#             time.sleep(0.5)
#             # 코사인 유사도 계산
#             cosine_sim = cosine_similarity([orig_stats], [aug_stats])[0, 0]
#             time.sleep(0.5)
#             similarity_results[col] = {
#                 'Cosine Similarity': round(cosine_sim, 3)
#             }

#     return similarity_results
def time_buffer():
    time.sleep(0.5)

def calculate_cosine_similarity(original_df, augmented_df, numeric_cols):
    """통계적 특성 기반 코사인 유사도 계산"""
    similarity_results = {}
    logger = logging.getLogger(__name__)
    
    logger.info(f"🔍 분석 시작 - 총 {len(numeric_cols)}개 컬럼")
    
    for i, col in enumerate(numeric_cols, 1):
        orig_data = original_df[col].dropna()
        aug_data = augmented_df[col].dropna()
        time_buffer()
        
        if len(orig_data) > 0 and len(aug_data) > 0:
            # ... 기존 통계 계산 로직 ...
            orig_stats = [
                orig_data.mean(),
                orig_data.std(), 
                orig_data.median(),
                orig_data.quantile(0.25),
                orig_data.quantile(0.75),
                orig_data.skew(),  # 왜도
                orig_data.kurtosis()  # 첨도
            ]
            time_buffer()
            aug_stats = [
                aug_data.mean(),
                aug_data.std(),
                aug_data.median(), 
                aug_data.quantile(0.25),
                aug_data.quantile(0.75),
                aug_data.skew(),
                aug_data.kurtosis()
            ]
            time_buffer()
            cosine_sim = cosine_similarity([orig_stats], [aug_stats])[0, 0]
            time_buffer()
            similarity_results[col] = {
                'Cosine Similarity': round(cosine_sim, 3)
            }
            
            logger.info(f"✅ [{i}/{len(numeric_cols)}] '{col}' 완료 - 유사도: {cosine_sim:.3f}")
        else:
            logger.warning(f"⚠️ [{i}/{len(numeric_cols)}] '{col}' 스킵 - 데이터 부족")
    
    logger.info(f"🎯 전체 분석 완료 - 성공: {len(similarity_results)}개")
    return similarity_results

app = FastAPI()

# logging.basicConfig(
#     level=logging.INFO,
#     format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
# )
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s | %(levelname)-8s | %(funcName)-15s | %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)

logger = logging.getLogger(__name__)


@app.get('/')
def main():
    return {'message': 'Hello, World!'}

# @app.post('/anal/')
# async def aug(request: Request):
#     data = await request.json()
#     original_df = pd.DataFrame(data['original_df'])
#     augmented_df = pd.DataFrame(data['augmented_df'])
#     numeric_cols = data['numeric_cols']

#     logger.info(f"데이터 유사도 측정 시작 - 대상 컬럼: {numeric_cols}")
#     logger.info(f"원본 데이터: {original_df.shape}, 증강 데이터: {augmented_df.shape}")
#     similarity_results = calculate_cosine_similarity(original_df, augmented_df, numeric_cols)
#     logger.info(f"데이터 유사도 측정 완료 - 결과: {similarity_results}")
#     return {'similarity_results': similarity_results}

@app.post('/anal/')
async def aug(request: Request):
    # 요청 ID 생성 (식별용)
    request_id = f"REQ_{int(time.time())}"
    
    logger.info(f"🚀 [{request_id}] 데이터 유사도 분석 요청 시작")
    
    data = await request.json()
    original_df = pd.DataFrame(data['original_df'])
    augmented_df = pd.DataFrame(data['augmented_df'])
    numeric_cols = data['numeric_cols']
    
    logger.info(f"📋 [{request_id}] 분석 대상: {len(numeric_cols)}개 컬럼")
    logger.info(f"📊 [{request_id}] 데이터 크기 - 원본: {original_df.shape}, 증강: {augmented_df.shape}")
    
    similarity_results = calculate_cosine_similarity(original_df, augmented_df, numeric_cols)
    
    logger.info(f"✅ [{request_id}] 분석 완료 - 성공: {len(similarity_results)}개")
    
    # 평균 유사도 계산 및 로깅
    if similarity_results:
        avg_similarity = sum(r['Cosine Similarity'] for r in similarity_results.values()) / len(similarity_results)
        logger.info(f"📈 [{request_id}] 평균 유사도: {avg_similarity:.3f}")
    
    return {'similarity_results': similarity_results}