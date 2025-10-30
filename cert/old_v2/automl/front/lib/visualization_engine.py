import os
import pandas as pd
import numpy as np
import yaml
from dataclasses import dataclass, field
from typing import Any, Dict, List, Tuple, Optional
import logging
from scipy import stats
import warnings
import re
from datetime import datetime
warnings.filterwarnings('ignore')

logger = logging.getLogger(__name__)

@dataclass
class VisualizationRuleSet:
    """시각화 규칙 집합"""
    numeric: Dict[str, Any] = field(default_factory=dict)
    categorical: Dict[str, Any] = field(default_factory=dict)
    datetime: Dict[str, Any] = field(default_factory=dict)
    correlation: Dict[str, Any] = field(default_factory=dict)
    distribution: Dict[str, Any] = field(default_factory=dict)
    outlier: Dict[str, Any] = field(default_factory=dict)

    @classmethod
    def load(cls, path: str = None) -> "VisualizationRuleSet":
        if path is None:
            # 현재 파일의 디렉토리를 기준으로 상대 경로 설정
            current_dir = os.path.dirname(os.path.abspath(__file__))
            path = os.path.join(current_dir, "visualization_rules.yaml")
        
        with open(path, encoding="utf-8") as f:
            raw = yaml.safe_load(f)
        return cls(**raw)

class VisualizationRecommender:
    """시각화 추천 시스템"""
    
    def __init__(self, rules: VisualizationRuleSet):
        self.rules = rules
    
    def _is_datetime_column(self, s: pd.Series, col_name: str) -> bool:
        """날짜/시간 컬럼인지 판단하는 함수"""
        
        # 1. 컬럼명 기반 판단
        col_lower = col_name.lower()
        date_keywords = ['date', 'time', 'dt', 'datetime', 'timestamp', 'created', 'updated']
        if any(keyword in col_lower for keyword in date_keywords):
            return True
        
        # 2. 데이터 패턴 기반 판단
        if s.dtype == 'object':
            # 샘플 데이터로 날짜 패턴 테스트
            sample_data = s.dropna().head(100)
            if len(sample_data) == 0:
                return False
            
            # 다양한 날짜 패턴 정의
            date_patterns = [
                r'\d{4}-\d{2}-\d{2}',  # YYYY-MM-DD
                r'\d{2}/\d{2}/\d{4}',  # MM/DD/YYYY
                r'\d{2}-\d{2}-\d{4}',  # MM-DD-YYYY
                r'\d{4}/\d{2}/\d{2}',  # YYYY/MM/DD
                r'\d{2}/\d{2}/\d{2}',  # MM/DD/YY
                r'\d{8}',              # YYYYMMDD
                r'\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}',  # YYYY-MM-DD HH:MM:SS
                r'\d{2}:\d{2}:\d{2}',  # HH:MM:SS
            ]
            
            # 패턴 매칭 테스트
            pattern_matches = 0
            total_tested = 0
            
            for value in sample_data:
                value_str = str(value).strip()
                if value_str and value_str != 'nan':
                    total_tested += 1
                    for pattern in date_patterns:
                        if re.match(pattern, value_str):
                            pattern_matches += 1
                            break
            
            # 70% 이상이 날짜 패턴이면 날짜 컬럼으로 판단
            if total_tested > 0 and pattern_matches / total_tested > 0.7:
                return True
            
            # 3. 실제 날짜 변환 테스트
            try:
                pd.to_datetime(sample_data, errors='raise')
                return True
            except (ValueError, TypeError):
                pass
        
        return False
    
    def _analyze_distribution(self, s: pd.Series) -> Dict[str, float]:
        """분포 특성 분석"""
        skew = s.skew()
        kurt = s.kurtosis()
        mean = s.mean()
        std = s.std()
        cv = std / mean if mean != 0 else np.inf
        
        # 이상치 비율 계산 (IQR 방법)
        Q1, Q3 = s.quantile([0.25, 0.75])
        IQR = Q3 - Q1
        outlier_mask = (s < Q1 - 1.5 * IQR) | (s > Q3 + 1.5 * IQR)
        outlier_ratio = outlier_mask.mean()
        
        # 분포 형태 분석
        is_normal = abs(skew) < 0.5 and abs(kurt) < 1
        is_uniform = s.nunique() / len(s) > 0.8
        
        # 이중봉/다중봉 분포 검출 (개선된 방법)
        value_counts = s.value_counts()
        is_bimodal = False
        is_multimodal = False
        
        if len(value_counts) > 2:
            # 값의 분포에서 주요 피크가 있는지 확인
            sorted_values = value_counts.sort_values(ascending=False)
            if len(sorted_values) >= 2:
                # 상위 2개 값의 비율이 비슷하고 나머지와 차이가 크면 이중봉으로 판단
                top_ratio = sorted_values.iloc[0] / sorted_values.iloc[1]
                third_ratio = sorted_values.iloc[1] / sorted_values.iloc[2] if len(sorted_values) > 2 else 0
                is_bimodal = 0.5 < top_ratio < 2.0 and third_ratio > 2.0
                
                # 다중봉 분포 검출 (3개 이상의 주요 피크)
                if len(sorted_values) >= 3:
                    # 상위 3개 값이 모두 비슷한 빈도를 가지면 다중봉으로 판단
                    top_three_ratios = [
                        sorted_values.iloc[0] / sorted_values.iloc[1],
                        sorted_values.iloc[1] / sorted_values.iloc[2]
                    ]
                    is_multimodal = all(0.3 < ratio < 3.0 for ratio in top_three_ratios)
        
        return {
            'skew': skew,
            'kurt': kurt,
            'cv': cv,
            'outlier_ratio': outlier_ratio,
            'unique_count': s.nunique(),
            'unique_ratio': s.nunique() / len(s),
            'is_normal': is_normal,
            'is_uniform': is_uniform,
            'is_bimodal': is_bimodal,
            'is_multimodal': is_multimodal,
            'range': s.max() - s.min(),
            'iqr': IQR
        }
    
    def _apply_numeric_visualization_rules(self, col: str, s: pd.Series) -> List[Tuple[str, str]]:
        """수치형 데이터 시각화 규칙 적용"""
        rec: List[Tuple[str, str]] = []
        r = self.rules.numeric
        
        # 기본 통계 계산
        stats_dict = self._analyze_distribution(s)
        
        # 1. 분포 특성 기반 시각화 (개선된 로직)
        for cond in r["distribution_analysis"]:
            # 조건 검사
            skew_condition = True
            kurt_condition = True
            skew_lt_condition = True
            kurt_lt_condition = True
            unique_ratio_condition = True
            is_bimodal_condition = True
            is_multimodal_condition = True
            
            # skew 조건
            if "skew" in cond:
                skew_condition = abs(stats_dict['skew']) > cond["skew"]
            if "skew_lt" in cond:
                skew_lt_condition = abs(stats_dict['skew']) < cond["skew_lt"]
            
            # kurt 조건
            if "kurt" in cond:
                kurt_condition = stats_dict['kurt'] > cond["kurt"]
            if "kurt_lt" in cond:
                kurt_lt_condition = stats_dict['kurt'] < cond["kurt_lt"]
            
            # unique_ratio 조건
            if "unique_ratio_gt" in cond:
                unique_ratio_condition = stats_dict['unique_ratio'] > cond["unique_ratio_gt"]
            
            # 분포 형태 조건
            if "is_bimodal" in cond:
                is_bimodal_condition = stats_dict.get('is_bimodal', False) == cond["is_bimodal"]
            if "is_multimodal" in cond:
                is_multimodal_condition = stats_dict.get('is_multimodal', False) == cond["is_multimodal"]
            
            # 모든 조건이 만족되면 적용
            if (skew_condition and kurt_condition and 
                skew_lt_condition and kurt_lt_condition and 
                unique_ratio_condition and
                is_bimodal_condition and is_multimodal_condition):
                rec.append((cond["primary_chart"], cond["why"]))
                if "secondary_chart" in cond:
                    rec.append((cond["secondary_chart"], cond["why"]))
                break
        
        # 2. 이상치 탐지 시각화
        for cond in r["outlier_detection"]:
            outlier_threshold = cond.get("outlier_ratio_gt", 0)
            if stats_dict['outlier_ratio'] > outlier_threshold:
                rec.append((cond["chart"], cond["why"]))
        
        # 3. 분포 형태 기반 시각화
        for cond in r["distribution_shape"]:
            if cond.get("is_normal", False) and stats_dict['is_normal']:
                rec.append((cond["chart"], cond["why"]))
            elif cond.get("is_uniform", False) and stats_dict['is_uniform']:
                rec.append((cond["chart"], cond["why"]))
            elif cond.get("is_bimodal", False) and stats_dict['is_bimodal']:
                rec.append((cond["chart"], cond["why"]))
        
        # 4. 변동성 기반 시각화
        for cond in r["variance_analysis"]:
            cv_threshold = cond.get("cv_gt", 0)
            if stats_dict['cv'] > cv_threshold:
                rec.append((cond["chart"], cond["why"]))
        
        # 5. 도메인 특화 시각화 (우선순위 높음)
        domain_matched = False
        for cond in r["domain_specific"]:
            if "name_contains" in cond:
                if cond["name_contains"].lower() in col.lower():
                    domain_matched = True
                    # primary_chart와 secondary_chart가 있는 경우
                    if "primary_chart" in cond and "secondary_chart" in cond:
                        rec.append((cond["primary_chart"], cond["why"]))
                        rec.append((cond["secondary_chart"], cond["why"]))
                    else:
                        # 기존 방식 (chart만 있는 경우)
                        rec.append((cond["chart"], cond["why"]))
                    break  # 도메인 규칙이 매치되면 다른 규칙은 무시
        
        # 도메인 규칙이 매치되지 않은 경우에만 기본 규칙 적용
        if not domain_matched:
            # 기본 시각화 추가
            rec.extend([
                ("Histogram", "basic_distribution_analysis"),
                ("Box Plot", "basic_outlier_analysis"),
                ("Summary Statistics", "descriptive_statistics")
            ])
        
        # 중복 제거 (순서 유지)
        seen = set()
        unique_rec = []
        for chart, why in rec:
            if chart not in seen:
                seen.add(chart)
                unique_rec.append((chart, why))
        
        return unique_rec
    
    def _apply_categorical_visualization_rules(self, col: str, s: pd.Series) -> List[Tuple[str, str]]:
        """범주형 데이터 시각화 규칙 적용"""
        rec: List[Tuple[str, str]] = []
        r = self.rules.categorical
        
        # 날짜 데이터인지 먼저 확인
        if self._is_datetime_column(s, col):
            return self._apply_datetime_visualization_rules(col, s)
        
        unique_count = s.nunique()
        total_count = len(s)
        category_ratio = unique_count / total_count
        
        # 1. 카디널리티 기반 시각화
        for cond in r["cardinality_strategy"]:
            if ("lte" in cond and unique_count <= cond["lte"]) or ("gt" in cond and unique_count > cond["gt"]):
                rec.append((cond["primary_chart"], cond["why"]))
                if "secondary_chart" in cond:
                    rec.append((cond["secondary_chart"], cond["why"]))
                break
        
        # 2. 분포 균형성 분석
        value_counts = s.value_counts()
        max_count = value_counts.max()
        min_count = value_counts.min()
        balance_ratio = min_count / max_count if max_count > 0 else 1
        
        for cond in r["balance_analysis"]:
            balance_threshold = cond.get("balance_ratio_lt", 1)
            if balance_ratio < balance_threshold:
                rec.append((cond["chart"], cond["why"]))
        
        # 3. 텍스트 데이터 특별 규칙
        if "text_processing" in r:
            for cond in r["text_processing"]:
                if "name_contains" in cond and cond["name_contains"].lower() in col.lower():
                    rec.append((cond["chart"], cond["why"]))
        
        # 기본 시각화 추가
        rec.extend([
            ("Bar Chart", "basic_categorical_analysis"),
            ("Value Counts", "category_frequency_analysis")
        ])
        
        return rec
    
    def _apply_datetime_visualization_rules(self, col: str, s: pd.Series) -> List[Tuple[str, str]]:
        """날짜/시간 데이터 시각화 규칙 적용"""
        rec: List[Tuple[str, str]] = []
        r = self.rules.datetime
        
        try:
            # object 타입을 datetime으로 변환
            datetime_series = pd.to_datetime(s, errors='coerce')
            valid_dates = datetime_series.dropna()
            
            if len(valid_dates) == 0:
                return rec
            
            # 시간 특성 분석
            date_range = valid_dates.max() - valid_dates.min()
            unique_years = valid_dates.dt.year.nunique()
            unique_months = valid_dates.dt.month.nunique()
            unique_days = valid_dates.dt.day.nunique()
            unique_hours = valid_dates.dt.hour.nunique() if hasattr(valid_dates.dt, 'hour') else 0
            
            # 시계열 데이터인지 판단
            is_timeseries = date_range.days > 30
            has_time_component = unique_hours > 1
            
            # 기본 시계열 시각화
            if is_timeseries:
                rec.extend([
                    ("Time Series Plot", "temporal_trend_analysis"),
                    ("Seasonal Decomposition", "seasonal_pattern_analysis")
                ])
            
            # 시간 정보가 있는 경우
            if has_time_component:
                rec.append(("Hourly Distribution", "time_component_analysis"))
            
            # 년도별 분포
            if unique_years > 1:
                rec.append(("Yearly Distribution", "annual_trend_analysis"))
            
            # 월별 분포
            if unique_months > 1:
                rec.append(("Monthly Distribution", "monthly_pattern_analysis"))
            
            # 기본 시각화
            rec.extend([
                ("Date Distribution", "basic_temporal_analysis"),
                ("Summary Statistics", "temporal_statistics")
            ])
            
        except Exception as e:
            logger.warning(f"날짜 시각화 분석 실패: {e}")
            rec.append(("Text Analysis", "datetime_parsing_failed"))
        
        return rec
    
    def _apply_correlation_visualization_rules(self, df: pd.DataFrame) -> List[Tuple[str, str]]:
        """상관관계 시각화 규칙 적용"""
        rec: List[Tuple[str, str]] = []
        r = self.rules.correlation
        
        numeric_df = df.select_dtypes(include=[np.number])
        
        if len(numeric_df.columns) < 2:
            return rec
        
        # 상관관계 매트릭스
        corr_matrix = numeric_df.corr().abs()
        high_corr_pairs = []
        
        for i in range(len(corr_matrix.columns)):
            for j in range(i+1, len(corr_matrix.columns)):
                if corr_matrix.iloc[i, j] > 0.7:  # 높은 상관관계 임계값
                    high_corr_pairs.append((corr_matrix.columns[i], corr_matrix.columns[j]))
        
        # 상관관계 시각화 규칙
        for cond in r["correlation_analysis"]:
            corr_threshold = cond.get("correlation_gt", 0)
            if len(high_corr_pairs) > 0:
                rec.append((cond["chart"], cond["why"]))
        
        # 기본 상관관계 시각화
        if len(numeric_df.columns) >= 2:
            rec.extend([
                ("Correlation Heatmap", "basic_correlation_analysis"),
                ("Pair Plot", "multivariate_analysis")
            ])
        
        return rec
    
    def _apply_distribution_visualization_rules(self, df: pd.DataFrame) -> List[Tuple[str, str]]:
        """전체 분포 시각화 규칙 적용"""
        rec: List[Tuple[str, str]] = []
        r = self.rules.distribution
        
        numeric_df = df.select_dtypes(include=[np.number])
        
        if len(numeric_df.columns) == 0:
            return rec
        
        # 데이터 크기 기반 시각화
        data_size = len(df)
        feature_count = len(numeric_df.columns)
        
        for cond in r["data_size_analysis"]:
            size_threshold = cond.get("data_size_gt", 0)
            feature_threshold = cond.get("feature_count_gt", 0)
            
            if data_size > size_threshold and feature_count > feature_threshold:
                rec.append((cond["chart"], cond["why"]))
        
        # 기본 분포 시각화
        rec.extend([
            ("Distribution Overview", "basic_distribution_analysis"),
            ("Summary Statistics", "descriptive_statistics")
        ])
        
        return rec
    
    def recommend(self, df: pd.DataFrame) -> Dict[str, List[Dict[str, str]]]:
        """시각화 추천 시스템"""
        out: Dict[str, List[Dict[str, str]]] = {}
        
        numeric_cols = df.select_dtypes(include="number").columns
        categorical_cols = df.select_dtypes(include=["object", "category", "string"]).columns
        
        # 수치형 컬럼 시각화
        for c in numeric_cols:
            rec = self._apply_numeric_visualization_rules(c, df[c].dropna())
            out[c] = [{"chart": a, "why": w} for a, w in rec]
        
        # 범주형 컬럼 시각화 (날짜 데이터 포함)
        for c in categorical_cols:
            rec = self._apply_categorical_visualization_rules(c, df[c])
            out[c] = [{"chart": a, "why": w} for a, w in rec]
        
        # 상관관계 시각화
        correlation_rec = self._apply_correlation_visualization_rules(df)
        if correlation_rec:
            out["_correlation"] = [{"chart": a, "why": w} for a, w in correlation_rec]
        
        # 전체 분포 시각화
        distribution_rec = self._apply_distribution_visualization_rules(df)
        if distribution_rec:
            out["_distribution"] = [{"chart": a, "why": w} for a, w in distribution_rec]
        
        return out

class VisualizationRecommendationEngine:
    """시각화 추천 엔진"""
    
    def __init__(self, rule_path: str = None):
        self.rules = VisualizationRuleSet.load(rule_path)
        self.visualizer = VisualizationRecommender(self.rules)
    
    def run(self, df: pd.DataFrame) -> Dict[str, Any]:
        return {
            "visualization": self.visualizer.recommend(df),
        } 