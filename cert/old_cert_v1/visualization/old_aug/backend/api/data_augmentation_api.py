"""
데이터 증강 API 엔드포인트
services의 data_augmentation_service를 호출하여 데이터 증강 기능을 제공합니다.
"""

from fastapi import APIRouter, HTTPException, UploadFile, File, Form, Query
from fastapi.responses import FileResponse
from typing import List, Dict, Any, Optional
import pandas as pd
import json
import uuid
import os
from io import StringIO, BytesIO
import tempfile
import numpy as np

from services.data_augmentation_service import DataAugmentationService

router = APIRouter(prefix="/api", tags=["api"])
augmentation_service = DataAugmentationService()

# 세션 데이터 저장소 (실제 프로덕션에서는 Redis나 데이터베이스 사용)
session_data = {}

def safe_convert_df_to_dict(df):
    """DataFrame을 안전하게 딕셔너리로 변환"""
    try:
        # NumPy 타입을 Python 기본 타입으로 변환
        df_converted = df.copy()
        for col in df_converted.columns:
            try:
                if df_converted[col].dtype in ['int64', 'int32']:
                    df_converted[col] = df_converted[col].astype('int64').astype('object')
                elif df_converted[col].dtype in ['float64', 'float32']:
                    df_converted[col] = df_converted[col].astype('float64').astype('object')
                elif df_converted[col].dtype in ['bool']:
                    df_converted[col] = df_converted[col].astype('object')
            except Exception as col_error:
                # 개별 컬럼 변환 실패 시 문자열로 변환
                df_converted[col] = df_converted[col].astype('object')
        
        # NaN 값을 None으로 변환
        df_converted = df_converted.where(pd.notnull(df_converted), None)
        
        result = df_converted.to_dict(orient='records')
        
        # 최종 검증: 모든 값이 JSON 직렬화 가능한지 확인
        import json
        json.dumps(result)  # 직렬화 테스트
        
        return result
    except Exception as e:
        # 변환 실패 시 기본 변환 시도
        try:
            # NaN 값을 None으로 변환
            df_clean = df.where(pd.notnull(df), None)
            return df_clean.to_dict(orient='records')
        except Exception as e2:
            # 최후의 수단: 문자열로 변환
            return df.astype(str).to_dict(orient='records')

def validate_session(session_id: str) -> Dict[str, Any]:
    """세션 유효성을 검증하고 데이터를 반환합니다."""
    if session_id not in session_data:
        raise HTTPException(status_code=404, detail="세션을 찾을 수 없습니다.")
    return session_data[session_id]

def cleanup_expired_sessions():
    """만료된 세션을 정리합니다 (24시간 이상 된 세션)"""
    import time
    current_time = time.time()
    expired_sessions = []
    
    for session_id, session_info in session_data.items():
        if 'created_at' in session_info:
            if current_time - session_info['created_at'] > 86400:  # 24시간
                expired_sessions.append(session_id)
    
    for session_id in expired_sessions:
        del session_data[session_id]

@router.post("/data/upload")
async def upload_file(file: UploadFile = File(...)):
    """파일을 업로드하고 세션 ID를 반환합니다."""
    try:
        if not file.filename.endswith('.csv'):
            raise HTTPException(status_code=400, detail="CSV 파일만 지원됩니다.")
        
        content = await file.read()
        text_content = content.decode('utf-8')
        df = pd.read_csv(StringIO(text_content))
        
        # 세션 ID 생성
        session_id = str(uuid.uuid4())
        
        # 세션에 데이터 저장
        import time
        
        session_data[session_id] = {
            'original_data': safe_convert_df_to_dict(df),
            'augmented_data': None,
            'file_name': file.filename,
            'created_at': time.time(),
            'last_accessed': time.time()
        }
        
        return {
            "success": True,
            "session_id": session_id,
            "message": "파일 업로드 성공"
        }
        
    except UnicodeDecodeError:
        raise HTTPException(status_code=400, detail="파일 인코딩 오류입니다. UTF-8 인코딩으로 저장된 파일을 업로드해주세요.")
    except pd.errors.EmptyDataError:
        raise HTTPException(status_code=400, detail="빈 파일입니다. 데이터가 포함된 파일을 업로드해주세요.")
    except Exception as e:
        import traceback
        error_detail = f"파일 업로드 실패: {str(e)}"
        print(f"Error in upload_file: {error_detail}")
        print(f"Traceback: {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=error_detail)

@router.get("/data/analyze/{session_id}")
async def analyze_data(session_id: str):
    """세션 데이터를 분석합니다."""
    try:
        # 세션 정리 및 검증
        cleanup_expired_sessions()
        session_info = validate_session(session_id)
        
        # 마지막 접근 시간 업데이트
        import time
        session_info['last_accessed'] = time.time()
        
        data = session_info['original_data']
        df = pd.DataFrame(data)
        
        # 데이터 분석
        numeric_cols = df.select_dtypes(include=[np.number]).columns.tolist()
        categorical_cols = df.select_dtypes(include=['object', 'category']).columns.tolist()
        
        # 결측값 분석 - NumPy 타입을 안전하게 변환
        missing_data = {}
        for col in df.columns:
            missing_count = df[col].isnull().sum()
            missing_data[col] = int(missing_count) if not pd.isna(missing_count) else 0
        
        # 중복값 분석
        duplicate_count = int(df.duplicated().sum())
        
        # 컬럼 정보
        column_info = []
        for col in df.columns:
            try:
                col_info = {
                    'column': str(col),
                    'dtype': str(df[col].dtype),
                    'unique_count': int(df[col].nunique()),
                    'missing_count': int(df[col].isnull().sum())
                }
                
                if col in numeric_cols:
                    # 수치형 컬럼의 통계 정보
                    col_series = df[col].dropna()
                    if len(col_series) > 0:
                        min_val = col_series.min()
                        max_val = col_series.max()
                        mean_val = col_series.mean()
                        
                        col_info.update({
                            'min': float(min_val) if not pd.isna(min_val) else None,
                            'max': float(max_val) if not pd.isna(max_val) else None,
                            'mean': float(mean_val) if not pd.isna(mean_val) else None
                        })
                    else:
                        col_info.update({
                            'min': None,
                            'max': None,
                            'mean': None
                        })
                
                column_info.append(col_info)
            except Exception as e:
                # 개별 컬럼에서 오류 발생 시 기본 정보만 저장
                column_info.append({
                    'column': str(col),
                    'dtype': 'unknown',
                    'unique_count': 0,
                    'missing_count': 0
                })
        
        return {
            "success": True,
            "data_shape": {
                "rows": len(df),
                "columns": len(df.columns)
            },
            "numeric_columns": numeric_cols,
            "categorical_columns": categorical_cols,
            "missing_data": missing_data,
            "duplicate_count": int(duplicate_count),
            "column_info": column_info
        }
        
    except Exception as e:
        import traceback
        error_detail = f"데이터 분석 실패: {str(e)}"
        print(f"Error in analyze_data: {error_detail}")
        print(f"Traceback: {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=error_detail)

@router.get("/data/preview/{session_id}")
async def preview_data(session_id: str, rows: int = Query(10, ge=1, le=100)):
    """세션 데이터의 미리보기를 반환합니다."""
    try:
        # 세션 정리 및 검증
        cleanup_expired_sessions()
        session_info = validate_session(session_id)
        
        # 마지막 접근 시간 업데이트
        import time
        session_info['last_accessed'] = time.time()
        
        data = session_info['original_data']
        df = pd.DataFrame(data)
        
        preview_df = df.head(rows)
        
        return {
            "success": True,
            "preview_data": safe_convert_df_to_dict(preview_df)
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"데이터 미리보기 실패: {str(e)}")

@router.post("/augmentation/process")
async def process_augmentation(data: Dict[str, Any]):
    """데이터 증강을 처리합니다."""
    try:
        session_id = data.get('session_id')
        methods = data.get('methods', [])
        
        if not session_id:
            raise HTTPException(status_code=400, detail="세션 ID가 필요합니다.")
        
        # 세션 정리 및 검증
        cleanup_expired_sessions()
        session_info = validate_session(session_id)
        
        # 마지막 접근 시간 업데이트
        import time
        session_info['last_accessed'] = time.time()
        
        original_data = session_info['original_data']
        df = pd.DataFrame(original_data)
        
        # 증강 파라미터 추출
        noise_level = data.get('noise_level', 0.05)
        dup_count = data.get('dup_count', 2)
        augmentation_ratio = data.get('augmentation_ratio', 0.5)
        target_col = data.get('target_col')
        imb_method = data.get('imb_method')
        
        # 증강된 데이터 생성 (간단한 구현)
        augmented_df = df.copy()
        
        # 노이즈 추가
        if 'noise' in methods:
            numeric_cols = df.select_dtypes(include=[np.number]).columns
            for col in numeric_cols:
                try:
                    std_val = df[col].std()
                    if not pd.isna(std_val) and std_val > 0:
                        noise = np.random.normal(0, noise_level * std_val, len(df))
                        augmented_df[col] = df[col] + noise
                except Exception as e:
                    # 개별 컬럼에서 오류 발생 시 해당 컬럼 건너뛰기
                    continue
        
        # 중복 추가
        if 'duplicate' in methods:
            for _ in range(dup_count - 1):
                augmented_df = pd.concat([augmented_df, df], ignore_index=True)
        
        # 증강 비율에 맞게 샘플링
        target_rows = int(len(df) * (1 + augmentation_ratio))
        if len(augmented_df) > target_rows:
            augmented_df = augmented_df.sample(n=target_rows, replace=True)
        
        # 세션에 증강된 데이터 저장
        session_info['augmented_data'] = safe_convert_df_to_dict(augmented_df)
        
        return {
            "success": True,
            "original_shape": {
                "rows": len(df),
                "columns": len(df.columns)
            },
            "augmented_shape": {
                "rows": len(augmented_df),
                "columns": len(augmented_df.columns)
            },
            "methods_used": methods
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"데이터 증강 실패: {str(e)}")

@router.get("/data/download/{session_id}")
async def download_data(session_id: str, data_type: str = Query("augmented")):
    """증강된 데이터를 다운로드합니다."""
    try:
        # 세션 정리 및 검증
        cleanup_expired_sessions()
        session_info = validate_session(session_id)
        
        # 마지막 접근 시간 업데이트
        import time
        session_info['last_accessed'] = time.time()
        
        if data_type == "augmented":
            data = session_info.get('augmented_data')
            if not data:
                raise HTTPException(status_code=400, detail="증강된 데이터가 없습니다.")
        else:
            data = session_info['original_data']
        
        df = pd.DataFrame(data)
        
        # 임시 파일 생성
        with tempfile.NamedTemporaryFile(mode='w', suffix='.csv', delete=False) as tmp_file:
            df.to_csv(tmp_file.name, index=False)
            tmp_file_path = tmp_file.name
        
        return FileResponse(
            tmp_file_path,
            media_type='text/csv',
            filename=f"{data_type}_data.csv"
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"데이터 다운로드 실패: {str(e)}")

# 기존 엔드포인트들 유지
@router.get("/augmentation/methods")
async def get_available_methods():
    """사용 가능한 증강 방법 목록을 반환합니다."""
    try:
        methods = augmentation_service.get_available_methods()
        return {
            "success": True,
            "available_methods": methods,
            "count": len(methods)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"증강 방법 목록 조회 실패: {str(e)}")


@router.post("/augmentation/validate-params")
async def validate_augmentation_params(
    method: str,
    parameters: Dict[str, Any]
):
    """증강 파라미터의 유효성을 검증합니다."""
    try:
        result = augmentation_service.validate_augmentation_params(method, **parameters)
        return {
            "success": True,
            "validation_result": result
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"파라미터 검증 실패: {str(e)}")


@router.post("/augmentation/preview")
async def get_augmentation_preview(
    data: List[Dict[str, Any]],
    method: str,
    sample_size: int = 100,
    parameters: Dict[str, Any] = {}
):
    """증강 결과 미리보기를 제공합니다."""
    try:
        df = pd.DataFrame(data)
        
        if len(df) == 0:
            raise HTTPException(status_code=400, detail="데이터가 비어있습니다.")
        
        result = augmentation_service.get_augmentation_preview(
            df, method, sample_size, **parameters
        )
        
        return {
            "success": True,
            "preview_result": result
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"미리보기 생성 실패: {str(e)}")


@router.post("/augmentation/augment")
async def augment_data(
    data: List[Dict[str, Any]],
    method: str,
    parameters: Dict[str, Any] = {}
):
    """데이터 증강을 수행합니다."""
    try:
        df = pd.DataFrame(data)
        
        if len(df) == 0:
            raise HTTPException(status_code=400, detail="데이터가 비어있습니다.")
        
        # 파라미터 검증
        validation = augmentation_service.validate_augmentation_params(method, **parameters)
        if not validation.get("valid", False):
            raise HTTPException(status_code=400, detail=validation.get("error", "잘못된 파라미터입니다."))
        
        # 데이터 증강 수행
        result = augmentation_service.augment_data(df, method, **parameters)
        
        if not result.get("success", False):
            raise HTTPException(status_code=500, detail=result.get("error", "데이터 증강 실패"))
        
        return {
            "success": True,
            "augmentation_result": result
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"데이터 증강 실패: {str(e)}")


@router.post("/augmentation/batch-augment")
async def batch_augment_data(
    data: List[Dict[str, Any]],
    augmentations: List[Dict[str, Any]]
):
    """
    여러 증강 방법을 순차적으로 적용합니다.
    
    augmentations: [
        {"method": "조합 증강", "parameters": {...}},
        {"method": "조합 증강", "parameters": {...}}
    ]
    """
    try:
        df = pd.DataFrame(data)
        
        if len(df) == 0:
            raise HTTPException(status_code=400, detail="데이터가 비어있습니다.")
        
        results = []
        current_df = df.copy()
        
        for i, aug_config in enumerate(augmentations):
            method = aug_config.get("method")
            parameters = aug_config.get("parameters", {})
            
            if not method:
                raise HTTPException(status_code=400, detail=f"증강 설정 {i+1}에 method가 없습니다.")
            
            # 파라미터 검증
            validation = augmentation_service.validate_augmentation_params(method, **parameters)
            if not validation.get("valid", False):
                raise HTTPException(status_code=400, detail=f"증강 설정 {i+1} 파라미터 오류: {validation.get('error')}")
            
            # 데이터 증강 수행
            result = augmentation_service.augment_data(current_df, method, **parameters)
            
            if not result.get("success", False):
                raise HTTPException(status_code=500, detail=f"증강 설정 {i+1} 실패: {result.get('error')}")
            
            results.append({
                "step": i + 1,
                "method": method,
                "parameters": parameters,
                "result": result
            })
            
            # 다음 단계를 위해 증강된 데이터로 업데이트
            current_df = pd.DataFrame(result.get("augmented_data", []))
        
        return {
            "success": True,
            "batch_results": results,
            "final_data_info": {
                "original_rows": len(df),
                "final_rows": len(current_df),
                "total_augmentations": len(augmentations)
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"배치 증강 실패: {str(e)}")


@router.get("/session/status/{session_id}")
async def check_session_status(session_id: str):
    """세션 상태를 확인합니다."""
    try:
        cleanup_expired_sessions()
        
        if session_id not in session_data:
            return {
                "exists": False,
                "message": "세션을 찾을 수 없습니다."
            }
        
        session_info = session_data[session_id]
        return {
            "exists": True,
            "file_name": session_info.get('file_name', 'Unknown'),
            "has_original_data": session_info.get('original_data') is not None,
            "has_augmented_data": session_info.get('augmented_data') is not None,
            "created_at": session_info.get('created_at'),
            "last_accessed": session_info.get('last_accessed')
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"세션 상태 확인 실패: {str(e)}")

@router.get("/augmentation/health")
async def health_check():
    """서비스 상태를 확인합니다."""
    try:
        methods = augmentation_service.get_available_methods()
        return {
            "status": "healthy",
            "available_methods_count": len(methods),
            "service": "data_augmentation",
            "active_sessions": len(session_data)
        }
    except Exception as e:
        return {
            "status": "unhealthy",
            "error": str(e),
            "service": "data_augmentation"
        } 