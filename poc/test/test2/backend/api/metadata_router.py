from fastapi import APIRouter, UploadFile, Depends
from fastapi.responses import JSONResponse
# from fastapi import Form
# from pydantic import BaseModel
from services.metadata.file_handler import handle_uploaded_file
from typing import Literal, Union, Dict

router = APIRouter()

# class MetadataExtractForm(BaseModel):
#     file_type: Literal["csv", "xlsx", "json", "image"]
#     filter_exif: bool = True

# def get_metadata_form(
#     file_type: str = Form(...),
#     filter_exif: bool = Form(True)
# ) -> MetadataExtractForm:
#     return MetadataExtractForm(file_type=file_type, filter_exif=filter_exif)

@router.post("/extract", response_model=None)  # ✅ 명시적으로 response_model 생성 방지
def extract_metadata(file: UploadFile):
    try:
        metadata, _ = handle_uploaded_file(
            file=file,
            file_type="image",  # 테스트 시에는 하드코딩 or 추후 form에서 전달받도록 수정
            filter_exif=True,
            show_preview=False
        )
        return metadata
    except Exception as e:
        return JSONResponse(status_code=400, content={"error": str(e)})

# @router.post("/extract")
# def extract_metadata(
#     file: UploadFile,
#     # form_data: MetadataExtractForm = Depends(get_metadata_form)
# ) -> Union[Dict, JSONResponse]:
#     try:
#         metadata: Dict
#         metadata, _ = handle_uploaded_file(
#             file,
#             form_data.file_type,
#             filter_exif=form_data.filter_exif,
#             show_preview=False
#         )
#         return metadata
#     except Exception as e:
#         return JSONResponse(status_code=400, content={"error": str(e)})


# # api/metadata_router.py

# from fastapi import APIRouter, UploadFile, File, Form
# from pydantic import BaseModel
# from typing import Literal, Union
# from services import metadata_extractor

# router = APIRouter()

# # 파일 형식 enum-like 제한
# FileType = Literal["csv", "xlsx", "json", "image"]

# # 결과 모델 (선택적 사용 가능)
# class MetadataResult(BaseModel):
#     file: str
#     type: str
#     shape: tuple[int, int] | None = None
#     columns: list[str] | None = None
#     exif: dict | None = None

# @router.post("/extract", response_model=Union[dict, MetadataResult])
# async def extract_metadata(
#     file: UploadFile = File(...),
#     file_type: FileType = Form(...),
#     filter_exif: bool = Form(True)
# ) -> Union[dict, MetadataResult]:
#     try:
#         if file_type == "csv":
#             return metadata_extractor.extract_csv(file.file)
#         elif file_type == "xlsx":
#             return metadata_extractor.extract_excel(file.file)
#         elif file_type == "json":
#             return metadata_extractor.extract_json(file.file)
#         elif file_type == "image":
#             file_bytes = await file.read()
#             return metadata_extractor.extract_image(file_bytes, filter_exif)
#         else:
#             return {"error": "Unsupported file type"}
#     except Exception as e:
#         return {"error": str(e)}


# from pydantic import BaseModel
# from typing import List, Union, Optional
# from services.metadata import MetadataExtractor
# import json
# from fastapi import APIRouter, HTTPException

# router = APIRouter()

# class MetadataRequest(BaseModel):
#     file_paths: Union[str, List[str]]
#     output_path: Optional[str] = None  # Optional parameter for saving metadata

# @router.post("/metadata")
# async def get_metadata(request: MetadataRequest):
#     """
#     API endpoint to extract metadata for given file paths.
#     Optionally save the metadata to a JSON file.
#     """
#     try:
#         extractor = MetadataExtractor(request.file_paths)
#         metadata = extractor.extract_metadata()
#         if not metadata:
#             raise HTTPException(status_code=404, detail="Metadata not found")
        
#         # Save metadata to JSON if output_path is provided
#         if request.output_path:
#             with open(request.output_path, 'w') as json_file:
#                 json.dump(metadata, json_file, indent=4)
        
#         return {"metadata": metadata}
#     except FileNotFoundError as e:
#         raise HTTPException(status_code=404, detail=str(e))
#     except ValueError as e:
#         raise HTTPException(status_code=400, detail=str(e))
#     except Exception as e:
#         raise HTTPException(status_code=500, detail=str(e))