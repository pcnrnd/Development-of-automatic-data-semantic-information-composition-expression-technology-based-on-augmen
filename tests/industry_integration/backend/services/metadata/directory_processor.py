import os
import pandas as pd
from PIL import Image, ExifTags
from typing import List

EXT_MAP = {
    "CSV": [".csv"],
    "Excel": [".xlsx"],
    "JSON": [".json"],
    "Image": [".jpg", ".jpeg", ".png"]
}

EXIF_WHITELIST = ["DateTime", "DateTimeOriginal", "Model", "Make", "LensModel", "Software", "GPSInfo"]

def extract_metadata_from_directory(path: str, types: List[str], filter_exif: bool = True) -> List[dict]:
    results = []
    extensions = tuple(ext for t in types for ext in EXT_MAP.get(t, []))

    for root, _, files in os.walk(path):
        for file in files:
            if not file.lower().endswith(extensions):
                continue

            full_path = os.path.join(root, file)
            rel_path = os.path.relpath(full_path, path)

            try:
                if file.endswith(".csv"):
                    df = pd.read_csv(full_path, nrows=1)
                    results.append({"file": rel_path, "type": "CSV", "columns": list(df.columns), "shape": df.shape})

                elif file.endswith(".xlsx"):
                    df = pd.read_excel(full_path, nrows=1)
                    results.append({"file": rel_path, "type": "Excel", "columns": list(df.columns), "shape": df.shape})

                elif file.endswith(".json"):
                    df = pd.read_json(full_path)
                    results.append({"file": rel_path, "type": "JSON", "columns": list(df.columns), "shape": df.shape})

                elif file.lower().endswith((".jpg", ".jpeg", ".png")):
                    image = Image.open(full_path)
                    exif_data = image._getexif()
                    if exif_data:
                        raw_metadata = {
                            ExifTags.TAGS.get(tag): value
                            for tag, value in exif_data.items()
                            if tag in ExifTags.TAGS
                        }
                        filtered = {
                            k: v for k, v in raw_metadata.items()
                            if not filter_exif or k in EXIF_WHITELIST
                        }
                        results.append({"file": rel_path, "type": "Image", **filtered})
                    else:
                        results.append({"file": rel_path, "type": "Image", "info": "No EXIF metadata"})

            except Exception as e:
                results.append({"file": rel_path, "error": str(e)})

    return results