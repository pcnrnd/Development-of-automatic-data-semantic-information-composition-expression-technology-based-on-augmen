import os
import pandas as pd
import json
from typing import Literal

ExportFormat = Literal["CSV", "JSON"]

def save_metadata_result(result: dict, save_path: str, export_format: ExportFormat) -> str:
    """
    메타데이터 결과를 지정한 경로에 저장하고 저장된 경로를 반환
    """
    os.makedirs(save_path, exist_ok=True)

    if export_format == "CSV":
        df = pd.DataFrame([result])
        out_path = os.path.join(save_path, "metadata_result.csv")
        df.to_csv(out_path, index=False)
        return out_path

    elif export_format == "JSON":
        out_path = os.path.join(save_path, "metadata_result.json")
        with open(out_path, "w", encoding="utf-8") as f:
            json.dump(result, f, indent=2, ensure_ascii=False)
        return out_path

    else:
        raise ValueError(f"지원되지 않는 포맷: {export_format}")