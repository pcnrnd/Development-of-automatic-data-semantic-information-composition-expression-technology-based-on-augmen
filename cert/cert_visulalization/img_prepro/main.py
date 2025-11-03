from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse, StreamingResponse
from lib.image_augmentation import ImageAugmenter
from PIL import Image
import base64
import io, json
import logging
import asyncio
import os

# 로깅 설정
logging.basicConfig(level=logging.INFO)

# PIL 로깅 레벨 조정 (너무 상세한 로그 제거)
logging.getLogger('PIL').setLevel(logging.WARNING)

# 이미지 처리 로깅만 활성화
logging.getLogger('ImageProcessor').setLevel(logging.INFO)

def base64_to_image(base64_str):
    """base64 문자열을 PIL Image로 변환"""
    img_data = base64.b64decode(base64_str)
    img = Image.open(io.BytesIO(img_data))
    return img

def image_to_base64(image):
    """PIL Image를 base64 문자열로 변환"""
    buffer = io.BytesIO()
    image.save(buffer, format='PNG')
    img_str = base64.b64encode(buffer.getvalue()).decode()
    return img_str

app = FastAPI()

@app.get('/')
def main():
    return 'main'
@app.post('/api/preprocessing')
async def analysis(request: Request):
    """단일 이미지 전처리 (기존 호환성 유지)"""
    try:
        image_augmenter = ImageAugmenter()
        data = await request.json()
        
        img_base64 = data['img']
        params = data['params']
        
        # base64를 이미지로 변환
        img = base64_to_image(img_base64)
        
        # 전처리 수행
        aug_img = image_augmenter.augment_image(img, **params)
        
        # 결과를 base64로 변환하여 반환
        aug_img_base64 = image_to_base64(aug_img)
        
        return JSONResponse(content={'result': aug_img_base64})
    except Exception as e:
        logging.error(f"Error in preprocessing: {str(e)}", exc_info=True)
        return JSONResponse(content={'error': str(e)}, status_code=500)

@app.post('/api/batch_preprocessing')
async def batch_preprocessing(request: Request):
    """배치 이미지 전처리 - 스트리밍 방식"""
    try:
        data = await request.json()
        file_paths = data['file_paths']
        params = data['params']
        output_dir = data['output_dir']
        save_format = data.get('save_format', 'PNG')  # 저장 형식 추가
        
        # 비동기 제너레이터로 스트리밍 처리
        async def process_images():
            image_augmenter = ImageAugmenter()
            
            # 배치 처리 제너레이터 사용
            for result in image_augmenter.batch_process_images(file_paths, params, output_dir, save_format):
                # 진행률 반환
                yield f"data: {json.dumps(result)}\n\n"
            
            # 완료 신호
            yield f"data: {json.dumps({'status': 'completed', 'total': len(file_paths)})}\n\n"
        
        return StreamingResponse(
            process_images(),
            media_type="text/plain",
            headers={"Cache-Control": "no-cache"}
        )
        
    except Exception as e:
        logging.error(f"Error in batch preprocessing: {str(e)}", exc_info=True)
        return JSONResponse(content={'error': str(e)}, status_code=500)
# @app.post('/api/preprocessing')
# async def analysis(request: Request):
#     try:
#         image_augmenter = ImageAugmenter()
#         data = await request.json()
#         img = base64_to_image(data['img'])
#         params = data['params']
#         aug_img = image_augmenter.augment_image(img, **params)
#         return JSONResponse(content={'result': aug_img})
#     except Exception as e:
#         return JSONResponse(content={'error': str(e)}, status_code=500)