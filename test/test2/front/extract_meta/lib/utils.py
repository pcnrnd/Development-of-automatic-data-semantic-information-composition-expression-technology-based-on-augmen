import os
from typing import Optional

def detect_file_type(filename: str) -> Optional[str]:
    name = filename.lower()
    if name.endswith(".csv"):
        return "CSV"
    elif name.endswith(".xlsx"):
        return "Excel"
    elif name.endswith(".json"):
        return "JSON"
    elif name.endswith((".jpg", ".jpeg", ".png")):
        return "Image"
    return None

def is_valid_directory(path: str) -> bool:
    return os.path.isdir(path)
