# 베이스 이미지로 Python을 사용
FROM python:3.11-slim

# 작업 디렉토리 설정
WORKDIR /app

# 의존성 파일 복사
COPY requirements.txt .
COPY . /app

# 필요한 패키지 설치
RUN pip install --upgrade pip
RUN pip install --no-cache-dir -r requirements.txt

# FastAPI와 Streamlit의 포트를 오픈
EXPOSE 8000

CMD ["sh", "-c", "uvicorn main:app --host $FASTAPI_HOST --port $FASTAPI_PORT"]
