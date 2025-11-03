"""
데이터 증강 기능을 제공하는 모듈
"""

import pandas as pd
import numpy as np
from imblearn.over_sampling import SMOTE, RandomOverSampler
from imblearn.under_sampling import RandomUnderSampler


class DataAugmenter:
    """데이터 증강을 위한 클래스"""
    
    def __init__(self):
        self.supported_methods = {
            "조합 증강": self._combined_augmentation
        }
        
        # 개별 증강 방법들 (조합 증강에서 사용)
        self.augmentation_methods = {
            "noise": self._add_noise_to_numeric,
            "duplicate": self._duplicate_rows,
            "drop": self._random_drop_rows,
            "feature": self._feature_based_augmentation,
            "smote": self._handle_imbalanced_data,
            "general": self._general_data_augmentation
        }
    
    def augment(self, df, method, **kwargs):
        """
        데이터 증강을 수행합니다.
        
        Args:
            df (pd.DataFrame): 원본 데이터프레임
            method (str): 증강 방법
            **kwargs: 증강 방법별 추가 파라미터
            
        Returns:
            pd.DataFrame: 증강된 데이터프레임
        """
        if method not in self.supported_methods:
            raise ValueError(f"지원하지 않는 증강 방법입니다: {method}")
            
        return self.supported_methods[method](df, **kwargs)
    
    def _add_noise_to_numeric(self, df, noise_level=0.01):
        """수치형 컬럼에 노이즈를 추가합니다."""
        df_aug = df.copy()
        num_cols = df.select_dtypes(include=[np.number]).columns
        
        for col in num_cols:
            noise = np.random.normal(0, noise_level * df[col].std(), size=len(df))
            df_aug[col] = df[col] + noise
            
        return df_aug
    
    def _duplicate_rows(self, df, dup_count=2):
        """행을 중복 추가합니다."""
        return pd.concat([df] * dup_count, ignore_index=True)
    
    def _random_drop_rows(self, df, drop_rate=0.1):
        """랜덤하게 행을 삭제합니다."""
        drop_n = int(len(df) * drop_rate)
        drop_idx = np.random.choice(df.index, size=drop_n, replace=False)
        return df.drop(drop_idx).reset_index(drop=True)
    
    def _handle_imbalanced_data(self, df, target_col=None, imb_method=None):
        """클래스 불균형 데이터를 처리합니다."""
        if target_col is None or target_col not in df.columns:
            return df
        
        # 타겟 컬럼이 범주형인지 확인
        if pd.api.types.is_numeric_dtype(df[target_col]):
            unique_values = df[target_col].unique()
            unique_count = len(unique_values)
            
            # 이진형 데이터 체크 (0과 1로만 구성된 경우)
            is_binary = set(unique_values).issubset({0, 1}) or set(unique_values).issubset({0.0, 1.0})
            
            # 범주형 데이터 체크 (정수로 레이블링된 경우)
            is_categorical = (
                unique_count <= 20 and  # 고유값이 20개 이하
                all(isinstance(val, (int, np.integer)) for val in unique_values) and  # 모든 값이 정수
                min(unique_values) >= 0 and  # 최소값이 0 이상
                max(unique_values) < unique_count  # 최대값이 고유값 개수보다 작음
            )
            
            if not (is_binary or is_categorical or unique_count <= 20):
                return df
        
        X = df.drop(columns=[target_col])
        y = df[target_col]
        
        # 클래스별 샘플 수 확인
        class_counts = y.value_counts()
        min_samples = class_counts.min()
        
        # 수치형 컬럼만 사용하여 SMOTE 적용 (범주형 컬럼은 제외)
        numeric_columns = X.select_dtypes(include=[np.number]).columns.tolist()
        
        if len(numeric_columns) == 0:
            return df
        
        X_numeric = X[numeric_columns]
        
        if imb_method == "SMOTE":
            try:
                # k_neighbors를 동적으로 조정 (최소 샘플 수에 맞춤)
                k_neighbors = min(3, min_samples - 1)  # 최소 1개는 남겨야 함
                if k_neighbors < 1:
                    k_neighbors = 1
                
                # SMOTE 적용 시 동적 설정 사용
                sm = SMOTE(random_state=42, k_neighbors=k_neighbors, sampling_strategy='auto')
                X_res, y_res = sm.fit_resample(X_numeric, y)
                
                # SMOTE로 생성된 데이터의 품질 개선
                X_res_df = pd.DataFrame(X_res, columns=numeric_columns)
                
                # 원본 데이터의 분포 범위 내로 제한
                for col in X_res_df.columns:
                    if col in df.columns:  # 원본에 있던 컬럼만 처리
                        # 극단값 제거 (상하위 1% 제거)
                        lower_bound = df[col].quantile(0.01)
                        upper_bound = df[col].quantile(0.99)
                        
                        # 범위를 벗어나는 값들을 원본 범위로 클리핑
                        X_res_df[col] = X_res_df[col].clip(lower=lower_bound, upper=upper_bound)
                
            except Exception as e:
                return df
                
        elif imb_method == "RandomOverSampler":
            try:
                ros = RandomOverSampler(random_state=42)
                X_res, y_res = ros.fit_resample(X_numeric, y)
                X_res_df = pd.DataFrame(X_res, columns=numeric_columns)
            except Exception as e:
                return df
                
        elif imb_method == "RandomUnderSampler":
            try:
                rus = RandomUnderSampler(random_state=42)
                X_res, y_res = rus.fit_resample(X_numeric, y)
                X_res_df = pd.DataFrame(X_res, columns=numeric_columns)
            except Exception as e:
                return df
        else:
            return df
        
        # 원본 데이터와 동일한 구조로 결과 생성
        result_df = df.copy()
        
        # 증강된 데이터를 원본 데이터에 추가
        for i, (_, row) in enumerate(X_res_df.iterrows()):
            new_row = df.iloc[0].copy()  # 첫 번째 행을 템플릿으로 사용
            
            # 수치형 컬럼 업데이트
            for col in numeric_columns:
                new_row[col] = row[col]
            
            # 타겟 컬럼 업데이트
            new_row[target_col] = y_res.iloc[i] if i < len(y_res) else y_res.iloc[-1]
            
            # 결과에 추가
            result_df = pd.concat([result_df, pd.DataFrame([new_row])], ignore_index=True)
        
        return result_df
    
    def _general_data_augmentation(self, df, augmentation_ratio=0.5, noise_level=0.05, **kwargs):
        """일반적인 데이터 증강을 수행합니다."""
        # 증강할 데이터 개수 계산
        augment_count = int(len(df) * augmentation_ratio)
        
        if augment_count == 0:
            augment_count = 1
        
        # 랜덤하게 데이터 선택하여 증강
        augment_indices = np.random.choice(df.index, size=augment_count, replace=True)
        augmented_data = df.loc[augment_indices].copy()
        
        # 수치형 컬럼에 노이즈 추가 (통합된 노이즈 레벨 사용)
        numeric_cols = df.select_dtypes(include=[np.number]).columns
        for col in numeric_cols:
            if col in augmented_data.columns:
                noise = np.random.normal(0, noise_level * df[col].std(), size=len(augmented_data))
                augmented_data[col] = augmented_data[col] + noise
        
        # 원본과 증강 데이터 결합
        result_df = pd.concat([df, augmented_data], ignore_index=True)
        
        return result_df
    
    def _feature_based_augmentation(self, df, **kwargs):
        """특성 기반 데이터 증강을 수행합니다."""
        # 수치형 컬럼 분석
        numeric_cols = df.select_dtypes(include=[np.number]).columns.tolist()
        
        if len(numeric_cols) == 0:
            return df
        
        # 각 수치형 컬럼의 분포 분석
        augmentation_data = []
        
        for col in numeric_cols:
            # 분포의 중심값과 표준편차 계산
            mean_val = df[col].mean()
            std_val = df[col].std()
            
            # 분포의 사분위수 계산
            q25 = df[col].quantile(0.25)
            q75 = df[col].quantile(0.75)
            iqr = q75 - q25
            
            # 증강할 데이터 개수 (기본값: 원본 데이터의 30%)
            augment_count = int(len(df) * 0.3)
            
            # 다양한 증강 방법 적용
            for i in range(augment_count):
                # 랜덤하게 원본 데이터 선택
                random_idx = np.random.choice(df.index)
                new_row = df.loc[random_idx].copy()
                
                # 특성별 증강 전략 (더 넓은 범위로 증강)
                if i % 3 == 0:  # 평균 중심 증강 (표준편차 증가)
                    new_row[col] = mean_val + np.random.normal(0, std_val * 0.5)
                elif i % 3 == 1:  # 사분위수 기반 증강 (전체 범위 사용)
                    new_row[col] = df[col].min() + np.random.uniform(0, df[col].max() - df[col].min())
                else:  # 경계값 기반 증강 (더 넓은 범위)
                    if np.random.random() > 0.5:
                        new_row[col] = df[col].min() + np.random.uniform(0, std_val * 2.0)
                    else:
                        new_row[col] = df[col].max() - np.random.uniform(0, std_val * 2.0)
                
                augmentation_data.append(new_row)
        
        if augmentation_data:
            # 증강 데이터를 데이터프레임으로 변환
            augmented_df = pd.DataFrame(augmentation_data)
            
            # 원본과 증강 데이터 결합
            result_df = pd.concat([df, augmented_df], ignore_index=True)
        else:
            result_df = df.copy()
        
        return result_df
    
    def _combined_augmentation(self, df, methods=None, **kwargs):
        """여러 증강 방법을 조합하여 수행합니다."""
        if methods is None:
            methods = ['noise', 'duplicate']
        
        result_df = df.copy()
        applied_methods = []
        
        # 각 증강 방법을 순차적으로 적용
        for i, method in enumerate(methods):
            if method not in self.augmentation_methods:
                continue
            
            try:
                # 각 방법별 파라미터 추출
                method_kwargs = self._extract_method_params(method, kwargs)
                
                # 증강 방법 적용
                if method == 'smote':
                    # SMOTE는 특별 처리 (타겟 컬럼 필요)
                    if 'target_col' in method_kwargs:
                        result_df = self.augmentation_methods[method](result_df, **method_kwargs)
                        applied_methods.append(f"SMOTE ({method_kwargs.get('imb_method', 'SMOTE')})")
                    else:
                        continue
                else:
                    result_df = self.augmentation_methods[method](result_df, **method_kwargs)
                    applied_methods.append(self._get_method_display_name(method))
                
            except Exception as e:
                continue
        
        if not applied_methods:
            result_df = df.copy()
        
        return result_df
    
    def _extract_method_params(self, method, all_kwargs):
        """각 증강 방법에 필요한 파라미터를 추출합니다."""
        method_kwargs = {}
        
        if method == 'noise':
            method_kwargs['noise_level'] = all_kwargs.get('noise_level', 0.03)
        elif method == 'duplicate':
            method_kwargs['dup_count'] = all_kwargs.get('dup_count', 2)
        elif method == 'drop':
            method_kwargs['drop_rate'] = all_kwargs.get('drop_rate', 0.1)
        elif method == 'feature':
            # feature_ratio 파라미터 제거 - 기본값 0.3 사용
            pass
        elif method == 'smote':
            method_kwargs['target_col'] = all_kwargs.get('target_col')
            method_kwargs['imb_method'] = all_kwargs.get('imb_method', 'SMOTE')
        elif method == 'general':
            method_kwargs['augmentation_ratio'] = all_kwargs.get('augmentation_ratio', 0.5)
            # 통합된 노이즈 레벨 사용 (general_noise_level 제거)
            method_kwargs['noise_level'] = all_kwargs.get('noise_level', 0.05)
        
        return method_kwargs
    
    def _get_method_display_name(self, method):
        """증강 방법의 표시 이름을 반환합니다."""
        display_names = {
            'noise': '노이즈 추가',
            'duplicate': '데이터 중복',
            'drop': '데이터 삭제',
            'feature': '특성 기반 증강',
            'smote': 'SMOTE',
            'general': '일반 증강'
        }
        return display_names.get(method, method)
    
    def get_available_methods(self):
        """사용 가능한 증강 방법 목록을 반환합니다."""
        return {
            'noise': '노이즈 추가 (수치형 컬럼에 랜덤 노이즈 추가)',
            'duplicate': '데이터 중복 (전체 데이터를 복제)',
            'drop': '데이터 삭제 (랜덤하게 일부 데이터 삭제)',
            'feature': '특성 기반 증강 (데이터 분포 분석 기반 증강)',
            'smote': 'SMOTE (불균형 데이터 증강)',
            'general': '일반 증강 (랜덤 샘플링 + 노이즈)'
        } 