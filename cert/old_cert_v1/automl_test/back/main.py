from fastapi import FastAPI
from api import train
import logging

# 로깅 설정
logger = logging.getLogger(__name__)

app = FastAPI(
    title="AutoML API",
    description="자동 머신러닝 API 서비스",
    version="1.0.0"
)

# 라우터 등록
app.include_router(train.router, prefix="/automl", tags=["train"])

@app.get("/")
async def root():
    return {"message": "AutoML API is running"}

@app.get("/health")
async def health_check():
    return {"status": "healthy"}
