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
EXPOSE 8501


# FastAPI 서버와 Streamlit 서버를 동시에 실행할 수 있도록 설정
# 쉘 명령어로 FastAPI와 Streamlit을 백그라운드에서 실행하는 명령어 작성
CMD ["sh", "-c", "streamlit run app.py --server.address $STREAMLIT_HOST --server.port $STREAMLIT_PORT --server.runOnSave true"]
