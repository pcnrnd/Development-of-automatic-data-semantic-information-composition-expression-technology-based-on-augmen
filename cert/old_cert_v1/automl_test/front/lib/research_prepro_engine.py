import os
import pandas as pd
import numpy as np
import yaml
from dataclasses import dataclass, field
from typing import Any, Dict, List, Tuple, Optional
import logging
from scipy import stats
from sklearn.preprocessing import StandardScaler, MinMaxScaler, RobustScaler
from sklearn.feature_selection import VarianceThreshold
from sklearn.ensemble import IsolationForest
import warnings
import re
from datetime import datetime
warnings.filterwarnings('ignore')

logger = logging.getLogger(__name__)

@dataclass
class ResearchRuleSet:
    """연구 기반 규칙 집합"""
    numeric: Dict[str, Any] = field(default_factory=dict)
    categorical: Dict[str, Any] = field(default_factory=dict)
    datetime: Dict[str, Any] = field(default_factory=dict)
    data_quality: Dict[str, Any] = field(default_factory=dict)
    feature_selection: Dict[str, Any] = field(default_factory=dict)

    @classmethod
    def load(cls, path: str = None) -> "ResearchRuleSet":
        if path is None:
            # 현재 파일의 디렉토리를 기준으로 상대 경로 설정
            current_dir = os.path.dirname(os.path.abspath(__file__))
            path = os.path.join(current_dir, "research_prepro_rules.yaml")
        
        with open(path, encoding="utf-8") as f:
            raw = yaml.safe_load(f)
        return cls(**raw)

class ResearchBasedPreprocessingRecommender:
    """연구 기반 전처리 추천 시스템"""
    
    def __init__(self, rules: ResearchRuleSet):
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
    
    def _extract_datetime_features(self, s: pd.Series) -> Dict[str, Any]:
        """날짜/시간 특성 추출"""
        try:
            # object 타입을 datetime으로 변환
            datetime_series = pd.to_datetime(s, errors='coerce')
            valid_dates = datetime_series.dropna()
            
            if len(valid_dates) == 0:
                return {}
            
            # 날짜 범위 계산
            date_range = valid_dates.max() - valid_dates.min()
            
            # 시간 단위별 고유값 개수
            unique_years = valid_dates.dt.year.nunique()
            unique_months = valid_dates.dt.month.nunique()
            unique_days = valid_dates.dt.day.nunique()
            unique_hours = valid_dates.dt.hour.nunique() if hasattr(valid_dates.dt, 'hour') else 0
            
            return {
                'date_range_days': date_range.days,
                'unique_years': unique_years,
                'unique_months': unique_months,
                'unique_days': unique_days,
                'unique_hours': unique_hours,
                'is_timeseries': date_range.days > 30,  # 30일 이상이면 시계열로 판단
                'has_time_component': unique_hours > 1,  # 시간 정보가 있는지
                'conversion_success_rate': len(valid_dates) / len(s)
            }
        except Exception as e:
            logger.warning(f"날짜 변환 실패: {e}")
            return {}
    
    def _analyze_distribution(self, s: pd.Series) -> Dict[str, float]:
        """분포 특성 분석 - 연구 기반 메트릭"""
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
        
        # 이중봉/다중봉 분포 검출
        value_counts = s.value_counts()
        is_bimodal = False
        is_multimodal = False
        
        if len(value_counts) > 2:
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
            'is_multimodal': is_multimodal
        }
    
    def _apply_datetime_rules(self, col: str, s: pd.Series) -> List[Tuple[str, str]]:
        """날짜/시간 데이터 규칙 적용"""
        rec: List[Tuple[str, str]] = []
        
        # 날짜 특성 추출
        datetime_features = self._extract_datetime_features(s)
        
        if not datetime_features:
            return rec
        
        # 기본 날짜 특성 추출
        rec.append(("datetime_extraction", "extract_date_time_features"))
        
        # 시계열 데이터인 경우
        if datetime_features.get('is_timeseries', False):
            rec.extend([
                ("cyclical_encoding", "temporal_cyclical_features"),
                ("lag_features", "time_series_lag_features"),
                ("rolling_statistics", "time_series_rolling_features")
            ])
        
        # 시간 정보가 있는 경우
        if datetime_features.get('has_time_component', False):
            rec.append(("time_based_features", "extract_time_components"))
        
        # 날짜 범위가 넓은 경우
        if datetime_features.get('date_range_days', 0) > 365:
            rec.append(("seasonal_decomposition", "long_term_temporal_patterns"))
        
        # 변환 성공률이 낮은 경우
        if datetime_features.get('conversion_success_rate', 1.0) < 0.8:
            rec.append(("datetime_cleaning", "inconsistent_date_formats"))
        
        return rec
    
    def _apply_numeric_rules(self, col: str, s: pd.Series) -> List[Tuple[str, str]]:
        """연구 기반 수치형 규칙 적용"""
        rec: List[Tuple[str, str]] = []
        r = self.rules.numeric
        
        # 기본 통계 계산
        miss = s.isna().mean()
        stats_dict = self._analyze_distribution(s)
        
        # 1. 결측치 처리 - 세분화된 임계값
        for cond in r["missing_ratio"]:
            if miss > cond.get("gt", -np.inf):
                rec.append((cond["action"], cond["why"]))
                break
        
        # 2. 분포 분석 - 연구 기반 임계값 (개선된 로직)
        for cond in r["distribution_analysis"]:
            # 조건 검사
            skew_condition = True
            kurt_condition = True
            skew_lt_condition = True
            kurt_lt_condition = True
            unique_ratio_condition = True
            
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
            is_bimodal_condition = True
            is_multimodal_condition = True
            
            if "is_bimodal" in cond:
                is_bimodal_condition = stats_dict.get('is_bimodal', False) == cond["is_bimodal"]
            if "is_multimodal" in cond:
                is_multimodal_condition = stats_dict.get('is_multimodal', False) == cond["is_multimodal"]
            
            # 모든 조건이 만족되면 적용
            if (skew_condition and kurt_condition and 
                skew_lt_condition and kurt_lt_condition and 
                unique_ratio_condition and
                is_bimodal_condition and is_multimodal_condition):
                rec.append((cond["action"], cond["why"]))
                break
        
        # 3. 변동성 분석
        for cond in r["variance_analysis"]:
            if stats_dict['cv'] < cond.get("cv_lt", -np.inf):
                rec.append((cond["action"], cond["why"]))
                break
        
        # 4. 이상치 탐지 - 다중 방법론
        if "outlier_detection" in r:
            for cond in r["outlier_detection"]:
                if "dimensions_gt" in cond:
                    # 다변량 이상치 (고차원 데이터)
                    if len(s) > cond["dimensions_gt"]:
                        rec.append((cond["action"], cond["why"]))
                        break
                else:
                    # 단변량 이상치
                    rec.append((cond["action"], cond["why"]))
                    break
        
        # 5. 스케일링 전략 - 복합 조건 (개선된 로직)
        if "scaling_strategy" in r:
            scaling_applied = False
            for cond in r["scaling_strategy"]:
                # 조건 검사
                cv_gt_condition = True
                cv_lt_condition = True
                outlier_gt_condition = True
                outlier_lt_condition = True
                
                if "cv_gt" in cond:
                    cv_gt_condition = stats_dict['cv'] > cond["cv_gt"]
                if "cv_lt" in cond:
                    cv_lt_condition = stats_dict['cv'] < cond["cv_lt"]
                if "outlier_ratio_gt" in cond:
                    outlier_gt_condition = stats_dict['outlier_ratio'] > cond["outlier_ratio_gt"]
                if "outlier_ratio_lt" in cond:
                    outlier_lt_condition = stats_dict['outlier_ratio'] < cond["outlier_ratio_lt"]
                
                # 모든 조건이 만족되면 적용
                if (cv_gt_condition and cv_lt_condition and 
                    outlier_gt_condition and outlier_lt_condition):
                    rec.append((cond["action"], cond["why"]))
                    scaling_applied = True
                    break
            
            # 조건에 맞는 스케일링이 없으면 기본 스케일링 적용
            if not scaling_applied and r["scaling_strategy"]:
                default_scaling = r["scaling_strategy"][-1]
                rec.append((default_scaling["action"], default_scaling["why"]))
        
        # 6. 도메인 특화 규칙 (우선순위 높음)
        if "domain_specific" in r:
            domain_matched = False
            for cond in r["domain_specific"]:
                if "name_contains" in cond:
                    if cond["name_contains"].lower() in col.lower():
                        domain_matched = True
                        # 추가 조건 체크
                        if "skew_lt" in cond and abs(stats_dict['skew']) < cond["skew_lt"]:
                            rec.append((cond["action"], cond["why"]))
                        elif "unique_lt" in cond and stats_dict['unique_count'] < cond["unique_lt"]:
                            rec.append((cond["action"], cond["why"]))
                        elif "unique_ratio_gt" in cond and stats_dict['unique_ratio'] > cond["unique_ratio_gt"]:
                            rec.append((cond["action"], cond["why"]))
                        else:
                            rec.append((cond["action"], cond["why"]))
                        break  # 도메인 규칙이 매치되면 다른 규칙은 무시
            
            # 도메인 규칙이 매치되지 않은 경우에만 기본 규칙 적용
            if not domain_matched:
                # 기본 분포 기반 규칙 적용 (이미 위에서 처리됨)
                pass
        
        return rec
    
    def _apply_categorical_rules(self, col: str, s: pd.Series) -> List[Tuple[str, str]]:
        """연구 기반 범주형 규칙 적용"""
        rec: List[Tuple[str, str]] = []
        r = self.rules.categorical
        
        # 날짜 데이터인지 먼저 확인
        if self._is_datetime_column(s, col):
            return self._apply_datetime_rules(col, s)
        
        miss = s.isna().mean()
        unique = s.nunique(dropna=True)
        
        # 1. 결측치 처리
        for cond in r["missing_ratio"]:
            if miss > cond.get("gt", -np.inf):
                rec.append((cond["action"], cond["why"]))
                break
        
        # 2. 카디널리티 전략 - 연구 기반 임계값
        for cond in r["cardinality_strategy"]:
            if ("lte" in cond and unique <= cond["lte"]) or ("gt" in cond and unique > cond["gt"]):
                rec.append((cond["action"], cond["why"]))
                break
        
        # 3. 텍스트 처리 규칙
        if "text_processing" in r:
            for cond in r["text_processing"]:
                if "name_contains" in cond and cond["name_contains"].lower() in col.lower():
                    rec.append((cond["action"], cond["why"]))
        
        # 4. 순서형 데이터 분석
        if "ordinal_analysis" in r:
            unique_values = set(s.dropna().astype(str).str.lower())
            for cond in r["ordinal_analysis"]:
                if "values_contain" in cond:
                    if any(val in unique_values for val in cond["values_contain"]):
                        rec.append((cond["action"], cond["why"]))
        
        return rec
    
    def _apply_data_quality_rules(self, df: pd.DataFrame) -> List[Tuple[str, str]]:
        """데이터 품질 규칙 적용"""
        rec: List[Tuple[str, str]] = []
        
        if "data_quality" in self.rules.data_quality:
            # 중복 데이터 검사
            duplicate_ratio = df.duplicated().mean()
            if duplicate_ratio > 0.1:
                rec.append(("remove_duplicates", "high_duplicate_ratio"))
            
            # 일관성 검사 (간단한 예시)
            for col in df.columns:
                if df[col].dtype == 'object':
                    # 문자열 길이 일관성 검사
                    str_lengths = df[col].astype(str).str.len()
                    if str_lengths.std() / str_lengths.mean() > 0.5:
                        rec.append(("data_cleaning", "inconsistent_data_patterns"))
        
        return rec
    
    def _apply_feature_selection_rules(self, df: pd.DataFrame) -> List[Tuple[str, str]]:
        """특성 선택 규칙 적용"""
        rec: List[Tuple[str, str]] = []
        
        if "feature_selection" in self.rules.feature_selection:
            numeric_df = df.select_dtypes(include=[np.number])
            
            if len(numeric_df.columns) > 1:
                # 다중공선성 검사
                corr_matrix = numeric_df.corr().abs()
                high_corr_pairs = []
                for i in range(len(corr_matrix.columns)):
                    for j in range(i+1, len(corr_matrix.columns)):
                        if corr_matrix.iloc[i, j] > 0.95:
                            high_corr_pairs.append((corr_matrix.columns[i], corr_matrix.columns[j]))
                
                if high_corr_pairs:
                    rec.append(("remove_collinear", "high_correlation_collinearity"))
        
        return rec
    
    def recommend(self, df: pd.DataFrame) -> Dict[str, List[Dict[str, str]]]:
        """연구 기반 추천 시스템"""
        out: Dict[str, List[Dict[str, str]]] = {}
        
        numeric_cols = df.select_dtypes(include="number").columns
        categorical_cols = df.select_dtypes(include=["object", "category", "string"]).columns
        
        # 수치형 컬럼 처리
        for c in numeric_cols:
            rec = self._apply_numeric_rules(c, df[c].dropna())
            out[c] = [{"action": a, "why": w} for a, w in rec]
        
        # 범주형 컬럼 처리 (날짜 데이터 포함)
        for c in categorical_cols:
            rec = self._apply_categorical_rules(c, df[c])
            out[c] = [{"action": a, "why": w} for a, w in rec]
        
        # 데이터 품질 규칙
        quality_rec = self._apply_data_quality_rules(df)
        if quality_rec:
            out["_data_quality"] = [{"action": a, "why": w} for a, w in quality_rec]
        
        # 특성 선택 규칙
        selection_rec = self._apply_feature_selection_rules(df)
        if selection_rec:
            out["_feature_selection"] = [{"action": a, "why": w} for a, w in selection_rec]
        
        return out

class ResearchBasedRecommendationEngine:
    """연구 기반 추천 엔진"""
    
    def __init__(self, rule_path: str = None):
        self.rules = ResearchRuleSet.load(rule_path)
        self.preproc = ResearchBasedPreprocessingRecommender(self.rules)
    
    def run(self, df: pd.DataFrame) -> Dict[str, Any]:
        return {
            "preprocessing": self.preproc.recommend(df),
        }
