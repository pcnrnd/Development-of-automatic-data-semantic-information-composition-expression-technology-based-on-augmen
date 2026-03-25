# services/metadata_extractor.py

import pandas as pd
from PIL import Image, ExifTags
import io

EXIF_WHITELIST = ["DateTime", "DateTimeOriginal", "Model", "Make", "LensModel", "Software", "GPSInfo"]

def extract_csv(file) -> dict:
    df = pd.read_csv(file)
    return {"type": "csv", "shape": df.shape, "columns": list(df.columns)}

def extract_excel(file) -> dict:
    df = pd.read_excel(file)
    return {"type": "excel", "shape": df.shape, "columns": list(df.columns)}

def extract_json(file) -> dict:
    df = pd.read_json(file)
    return {"type": "json", "shape": df.shape, "columns": list(df.columns)}

def extract_image(file_bytes: bytes, filter_exif: bool = True) -> dict:
    image = Image.open(io.BytesIO(file_bytes))
    exif_data = image._getexif()
    if not exif_data:
        return {"info": "No EXIF metadata found"}
    raw_metadata = {ExifTags.TAGS.get(tag): value for tag, value in exif_data.items() if tag in ExifTags.TAGS}
    if filter_exif:
        raw_metadata = {k: v for k, v in raw_metadata.items() if k in EXIF_WHITELIST}
    return raw_metadata
