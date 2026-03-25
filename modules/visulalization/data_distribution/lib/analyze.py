import pandas as pd
import time
from scipy import stats as scipy_stats
# 데이터 분석 및 인사이트 생성 함수들

def time_buffer():
    time.sleep(0.7)

def analyze_data_quality(df):
    """데이터 품질 분석"""
    time_buffer()
    missing_ratio = df.isnull().sum().sum() / (df.shape[0] * df.shape[1]) * 100
    duplicate_ratio = df.duplicated().sum() / len(df) * 100
    
    quality_issues = []
    if missing_ratio > 10:
        quality_issues.append(f"결측값이 전체의 {missing_ratio:.1f}% 발견 (주의 필요)")
    if duplicate_ratio > 5:
        quality_issues.append(f"중복값이 전체의 {duplicate_ratio:.1f}% 발견")
    
    return missing_ratio, duplicate_ratio, quality_issues

def detect_outliers(df, numeric_cols):
    """이상값 탐지"""
    time_buffer()
    outlier_info = []
    for col in numeric_cols:
        Q1 = df[col].quantile(0.25)
        Q3 = df[col].quantile(0.75)
        IQR = Q3 - Q1
        lower_bound = Q1 - 1.5 * IQR
        upper_bound = Q3 + 1.5 * IQR
        outliers = df[(df[col] < lower_bound) | (df[col] > upper_bound)]
        if len(outliers) > 0:
            outlier_ratio = len(outliers) / len(df) * 100
            outlier_info.append(f"{col}: {len(outliers)}개 ({outlier_ratio:.1f}%)")
    return outlier_info

def analyze_distributions(df, numeric_cols, categorical_cols):
    """분포 특성 분석"""
    time_buffer()
    distribution_insights = []
    
    # 수치형 컬럼 분포 분석
    for col in numeric_cols:
        skewness = scipy_stats.skew(df[col].dropna())
        if abs(skewness) > 1:
            direction = "왼쪽" if skewness < 0 else "오른쪽"
            distribution_insights.append(f"{col}: {direction} 치우친 분포 (Skewness: {skewness:.2f})")
    
    # 범주형 컬럼 분포 분석
    for col in categorical_cols:
        value_counts = df[col].value_counts()
        if len(value_counts) > 0:
            max_freq = value_counts.iloc[0]
            total_count = len(df[col].dropna())
            if max_freq / total_count > 0.7:
                distribution_insights.append(f"{col}: 한 값이 {max_freq/total_count*100:.1f}% 차지 (불균등 분포)")
    
    return distribution_insights

def generate_recommendations(quality_issues, outlier_info, distribution_insights):
    """권장사항 생성"""
    time_buffer()
    recommendations = []
    
    if quality_issues:
        recommendations.append("결측값 처리 방법 검토 필요")
        recommendations.append("평균/중앙값 대체 vs 행 삭제 고려")
    
    if outlier_info:
        recommendations.append("이상값 원인 분석 권장")
        recommendations.append("데이터 수집 과정 검토")
    
    if distribution_insights:
        recommendations.append("데이터 변환 고려")
        recommendations.append("로그 변환, 정규화 등 적용 검토")
    
    return recommendations

# 타입 분류 함수
def smart_type_infer(df):
    time_buffer()
    numeric_cols, categorical_cols = [], []
    for col in df.columns:
        unique_count = df[col].nunique()
        unique_ratio = unique_count / len(df)
        colname = col.lower()
        # 컬럼명에 id, code, type 등이 포함되어 있으면 범주형
        if any(x in colname for x in ['id', 'code', 'type', 'category']):
            categorical_cols.append(col)
        # 고유값 개수/비율 기준
        elif df[col].dtype in ['int64', 'float64']:
            if unique_count <= 20 or unique_ratio < 0.05:
                categorical_cols.append(col)
            else:
                numeric_cols.append(col)
        else:
            categorical_cols.append(col)
    return numeric_cols, categorical_cols