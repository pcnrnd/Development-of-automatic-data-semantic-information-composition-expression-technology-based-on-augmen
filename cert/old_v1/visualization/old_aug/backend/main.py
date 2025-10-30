from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
import uvicorn

from api.data_augmentation_api import router as augmentation_router

# FastAPI 애플리케이션 생성
app = FastAPI(
    title="데이터 증강 API",
    description="데이터 증강 기능을 제공하는 FastAPI 서버",
    version="1.0.0"
)

# CORS 설정
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # 프로덕션에서는 특정 도메인으로 제한해야 합니다
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# API 라우터 등록
app.include_router(augmentation_router)

# API 문서 경로 수정
app.title = "데이터 시각화 및 증강 API"
app.description = "데이터 시각화와 증강 기능을 제공하는 FastAPI 서버"

# 정적 파일 서빙 (favicon 등)
try:
    app.mount("/static", StaticFiles(directory="static"), name="static")
except:
    pass  # static 폴더가 없어도 무시


@app.get("/")
async def root():
    """루트 엔드포인트"""
    return {
        "message": "데이터 증강 API 서버",
        "version": "1.0.0",
        "endpoints": {
            "augmentation": "/api",
            "docs": "/docs"
        }
    }


@app.get("/health")
async def health_check():
    """전체 서비스 상태 확인"""
    return {
        "status": "healthy",
        "service": "data_augmentation_api",
        "version": "1.0.0"
    }


@app.exception_handler(Exception)
async def global_exception_handler(request, exc):
    """전역 예외 처리"""
    return JSONResponse(
        status_code=500,
        content={
            "success": False,
            "error": "서버 내부 오류가 발생했습니다.",
            "detail": str(exc)
        }
    )


if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info"
    )