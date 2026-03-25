import pandas as pd
from PIL import Image, ExifTags
import io
from typing import Literal

EXIF_WHITELIST = ["DateTime", "DateTimeOriginal", "Model", "Make", "LensModel", "Software", "GPSInfo"]

FileType = Literal["csv", "xlsx", "json", "image"]

def handle_uploaded_file(uploaded_file, file_type: FileType, filter_exif: bool = True, show_preview: bool = True):
    """
    업로드된 파일을 유형별로 처리하여 메타데이터를 반환합니다.
    """
    result = {}
    try:
        if file_type == "csv":
            df = pd.read_csv(uploaded_file)
            result = {"type": "csv", "shape": df.shape, "columns": list(df.columns)}
            if show_preview:
                return result, df.head()

        elif file_type == "xlsx":
            df = pd.read_excel(uploaded_file)
            result = {"type": "excel", "shape": df.shape, "columns": list(df.columns)}
            if show_preview:
                return result, df.head()

        elif file_type == "json":
            df = pd.read_json(uploaded_file)
            result = {"type": "json", "shape": df.shape, "columns": list(df.columns)}
            if show_preview:
                return result, df.head()

        elif file_type == "image":
            image = Image.open(uploaded_file)
            exif_data = image._getexif()
            if exif_data:
                raw_metadata = {
                    ExifTags.TAGS.get(tag): value
                    for tag, value in exif_data.items()
                    if tag in ExifTags.TAGS
                }
                filtered_metadata = {
                    k: v for k, v in raw_metadata.items()
                    if not filter_exif or k in EXIF_WHITELIST
                }
                result = {"type": "image", **filtered_metadata}
            else:
                result = {"type": "image", "info": "No EXIF metadata"}
            if show_preview:
                return result, image

    except Exception as e:
        result = {"error": str(e)}

    return result, None
