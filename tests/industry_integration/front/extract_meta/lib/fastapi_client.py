import requests
from typing import Literal

API_URL = "http://industry_backend:8000/metadata/extract"

FileType = Literal["csv", "xlsx", "json", "image"]

def call_fastapi_metadata_api(uploaded_file, file_type: FileType, filter_exif: bool) -> dict:
    files = {"file": (uploaded_file.name, uploaded_file, uploaded_file.type)}
    data = {
        "file_type": file_type,
        "filter_exif": str(filter_exif)
    }
    response = requests.post(API_URL, files=files, data=data)
    if response.ok:
        return response.json()
    else:
        raise Exception(f"FastAPI 오류 발생: {response.text}")
