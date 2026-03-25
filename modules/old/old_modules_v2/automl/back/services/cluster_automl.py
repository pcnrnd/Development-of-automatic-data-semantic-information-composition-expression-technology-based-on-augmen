from sklearn.cluster import KMeans, DBSCAN, AgglomerativeClustering, SpectralClustering
from sklearn.mixture import GaussianMixture
from sklearn.metrics import silhouette_score, calinski_harabasz_score, davies_bouldin_score
from sklearn.preprocessing import StandardScaler
import pandas as pd
import numpy as np
import logging
from tqdm import tqdm
import warnings

# 로깅 설정 - 중앙화
logger = logging.getLogger(__name__)

class Clustering:
    def __init__(self, df, scoring='silhouette'):
        # 강화된 데이터 검증
        if df is None or df.empty:
            raise ValueError("입력 데이터프레임이 비어있습니다.")
        
        if not isinstance(df, pd.DataFrame):
            raise ValueError("입력 데이터는 pandas DataFrame이어야 합니다.")
        
        # 수치형 데이터만 선택
        numeric_columns = df.select_dtypes(include=[np.number]).columns
        if len(numeric_columns) == 0:
            raise ValueError("수치형 데이터가 없습니다.")
        
        self.df = df
        self.scoring = scoring
        self.X = df[numeric_columns].copy()  # 메모리 최적화: 필요한 컬럼만 복사
        
        # 데이터 검증
        logger.info(f"입력 데이터 형태: X={self.X.shape}")
        logger.info(f"특성 컬럼: {list(self.X.columns)}")
        
        # 개선된 데이터 전처리
        self._preprocess_data()
        
        # 스케일링 적용
        self._scale_data()

    def _preprocess_data(self):
        """개선된 데이터 전처리"""
        # 무한값 처리
        self.X = self.X.replace([np.inf, -np.inf], np.nan)
        
        # 컬럼별 결측치 처리 (평균 대신 중앙값 사용)
        for col in self.X.columns:
            if self.X[col].isnull().sum() > 0:
                median_val = self.X[col].median()
                if pd.isna(median_val):
                    median_val = 0.0
                self.X[col].fillna(median_val, inplace=True)
        
        # 결측치가 여전히 있는 경우 제거
        if self.X.isnull().sum().sum() > 0:
            logger.warning("결측치가 있는 행을 제거합니다.")
            self.X = self.X.dropna()
            
        if len(self.X) == 0:
            raise ValueError("전처리 후 데이터가 없습니다.")

    def _scale_data(self):
        """데이터 스케일링"""
        try:
            scaler = StandardScaler()
            self.X_scaled = pd.DataFrame(
                scaler.fit_transform(self.X),
                columns=self.X.columns,
                index=self.X.index
            )
        except Exception as e:
            logger.warning(f"스케일링 실패, 원본 데이터 사용: {e}")
            self.X_scaled = self.X.copy()

    def _get_optimal_clusters(self, max_clusters=10):
        """최적 클러스터 수 찾기"""
        if len(self.X) < 10:
            return min(3, len(self.X) - 1)
        
        max_clusters = min(max_clusters, len(self.X) // 2)
        if max_clusters < 2:
            return 2
            
        return max_clusters

    def evaluate_clustering(self, labels):
        """개선된 군집화 결과 평가"""
        try:
            # 클러스터 수 확인
            unique_labels = np.unique(labels)
            n_clusters = len(unique_labels)
            
            # 노이즈 포인트 제거 (DBSCAN의 경우 -1이 노이즈)
            valid_mask = labels != -1
            if not np.any(valid_mask):
                logger.warning("모든 포인트가 노이즈입니다.")
                return self._get_default_scores()
            
            X_valid = self.X_scaled[valid_mask]
            labels_valid = labels[valid_mask]
            
            # 유효한 클러스터 수 확인
            unique_valid_labels = np.unique(labels_valid)
            if len(unique_valid_labels) < 2:
                logger.warning("유효한 클러스터가 1개 이하입니다.")
                return self._get_default_scores()
            
            # 평가 지표 계산
            try:
                silhouette = silhouette_score(X_valid, labels_valid)
            except:
                silhouette = 0.0
                
            try:
                calinski_harabasz = calinski_harabasz_score(X_valid, labels_valid)
            except:
                calinski_harabasz = 0.0
                
            try:
                davies_bouldin = davies_bouldin_score(X_valid, labels_valid)
            except:
                davies_bouldin = float('inf')
            
            return {
                'silhouette_score': silhouette,
                'calinski_harabasz_score': calinski_harabasz,
                'davies_bouldin_score': davies_bouldin,
                'n_clusters': len(unique_valid_labels)
            }
            
        except Exception as e:
            logger.error(f"군집화 평가 실패: {e}")
            return self._get_default_scores()

    def _get_default_scores(self):
        """기본 점수 반환"""
        return {
            'silhouette_score': 0.0,
            'calinski_harabasz_score': 0.0,
            'davies_bouldin_score': float('inf'),
            'n_clusters': 1
        }

    def _get_score_by_metric(self, scores):
        """지표별 점수 반환 (일관된 처리)"""
        if self.scoring == 'silhouette':
            return scores['silhouette_score']
        elif self.scoring == 'calinski_harabasz':
            return scores['calinski_harabasz_score']
        elif self.scoring == 'davies_bouldin':
            # davies_bouldin은 낮을수록 좋으므로 음수로 변환하여 일관성 유지
            return -scores['davies_bouldin_score']
        else:
            return scores['silhouette_score']

    def kmeans_model(self):
        """개선된 K-means 모델"""
        try:
            optimal_clusters = self._get_optimal_clusters()
            model = KMeans(n_clusters=optimal_clusters, random_state=42, n_init=10)
            labels = model.fit_predict(self.X_scaled)
            
            scores = self.evaluate_clustering(labels)
            return self._get_score_by_metric(scores)
                
        except Exception as e:
            logger.error(f"K-means 학습 실패: {e}")
            return 0.0

    def dbscan_model(self):
        """개선된 DBSCAN 모델"""
        try:
            # 데이터 크기에 따른 eps 조정
            eps = np.percentile(self.X_scaled.std(), 75) * 0.5
            min_samples = max(2, len(self.X_scaled) // 100)
            
            model = DBSCAN(eps=eps, min_samples=min_samples)
            labels = model.fit_predict(self.X_scaled)
            
            scores = self.evaluate_clustering(labels)
            return self._get_score_by_metric(scores)
                
        except Exception as e:
            logger.error(f"DBSCAN 학습 실패: {e}")
            return 0.0

    def agglomerative_model(self):
        """개선된 계층적 군집화 모델"""
        try:
            optimal_clusters = self._get_optimal_clusters()
            model = AgglomerativeClustering(n_clusters=optimal_clusters)
            labels = model.fit_predict(self.X_scaled)
            
            scores = self.evaluate_clustering(labels)
            return self._get_score_by_metric(scores)
                
        except Exception as e:
            logger.error(f"계층적 군집화 학습 실패: {e}")
            return 0.0

    def spectral_model(self):
        """개선된 Spectral Clustering 모델"""
        try:
            optimal_clusters = self._get_optimal_clusters()
            model = SpectralClustering(
                n_clusters=optimal_clusters, 
                gamma=1.0, 
                random_state=42,
                n_init=10
            )
            labels = model.fit_predict(self.X_scaled)
            
            scores = self.evaluate_clustering(labels)
            return self._get_score_by_metric(scores)
                
        except Exception as e:
            logger.error(f"Spectral Clustering 학습 실패: {e}")
            return 0.0

    def gaussian_mixture_model(self):
        """개선된 Gaussian Mixture 모델"""
        try:
            optimal_clusters = self._get_optimal_clusters()
            model = GaussianMixture(
                n_components=optimal_clusters, 
                covariance_type='full', 
                random_state=42,
                n_init=10
            )
            labels = model.fit_predict(self.X_scaled)
            
            scores = self.evaluate_clustering(labels)
            return self._get_score_by_metric(scores)
                
        except Exception as e:
            logger.error(f"Gaussian Mixture 학습 실패: {e}")
            return 0.0

    def run_cluster_models(self):
        """모든 군집화 모델을 실행하고 결과를 반환합니다."""
        logger.info(f"{self.scoring} 지표로 군집화 모델 학습을 시작합니다...")
        
        models = {
            'kmeans': self.kmeans_model,
            'dbscan': self.dbscan_model,
            'agglomerative': self.agglomerative_model,
            'spectral': self.spectral_model,
            'gaussian_mixture': self.gaussian_mixture_model
        }
        
        best_results = {}
        for model_name, model_func in models.items():
            try:
                score = model_func()
                best_results[model_name] = float(score)  # float로 변환하여 직렬화 보장
                logger.info(f"{model_name}: {score:.4f}")
            except Exception as e:
                logger.error(f"{model_name} 모델 실행 실패: {e}")
                best_results[model_name] = 0.0
        
        # API와 일관성을 위한 JSON 직렬화
        results_data = {
            'models': best_results,
            'best_model': max(best_results, key=best_results.get) if best_results else None,
            'best_score': float(max(best_results.values())) if best_results else 0.0,
            'scoring_metric': self.scoring
        }
        
        # JSON 문자열로 직렬화
        import json
        results_json = json.dumps(results_data, ensure_ascii=False)
        
        logger.info(f"{self.scoring} 지표 학습 완료. 최고 성능: {results_data['best_score']:.4f}")
        return {'best': results_json}

def compare_cluster_models(df):
    '''
    모든 군집화 모델을 여러 지표로 학습합니다.
    
    Args:
        df: 입력 데이터프레임
    
    Returns:
        dict: 각 지표별 결과
    '''
    # 함수 참조를 딕셔너리에 저장 (함수 호출 결과 대신)
    scorings = ['silhouette', 'calinski_harabasz', 'davies_bouldin']
    results = dict()
    
    logger.info(f"총 {len(scorings)}개 지표로 군집화 모델 학습을 시작합니다.")
    
    # 메모리 최적화: 데이터프레임을 한 번만 전처리
    try:
        # 공통 전처리
        if df is None or df.empty:
            raise ValueError("입력 데이터프레임이 비어있습니다.")
        
        numeric_df = df.select_dtypes(include=[np.number])
        if len(numeric_df.columns) == 0:
            raise ValueError("수치형 데이터가 없습니다.")
        
        # 결측치 처리
        numeric_df = numeric_df.replace([np.inf, -np.inf], np.nan)
        numeric_df = numeric_df.dropna()
        
        if len(numeric_df) == 0:
            raise ValueError("전처리 후 데이터가 없습니다.")
            
    except Exception as e:
        logger.error(f"데이터 전처리 실패: {e}")
        # 직접 JSON 직렬화 사용 (DataFrame 생성 대신)
        import json
        error_data = {
            'error': str(e),
            'message': '데이터 전처리 실패'
        }
        return {'error': json.dumps(error_data, ensure_ascii=False)}
    
    # 함수 참조를 딕셔너리에 저장
    clustering_functions = {
        'silhouette': lambda: Clustering(numeric_df, 'silhouette'),
        'calinski_harabasz': lambda: Clustering(numeric_df, 'calinski_harabasz'),
        'davies_bouldin': lambda: Clustering(numeric_df, 'davies_bouldin')
    }
    
    for idx, scoring in enumerate(scorings):
        logger.info(f"진행률: {idx+1}/{len(scorings)} - {scoring} 지표 학습 중...")
        try:
            # 함수 참조를 사용하여 Clustering 객체 생성
            clustering_func = clustering_functions[scoring]
            clustering = clustering_func()
            
            # 직접 JSON 직렬화 사용
            result = clustering.run_cluster_models()
            results[idx] = result
            
        except Exception as e:
            logger.error(f"{scoring} 지표 학습 실패: {e}")
            # 직접 JSON 직렬화 사용 (DataFrame 생성 대신)
            import json
            error_data = {
                'error': str(e),
                'scoring_metric': scoring,
                'message': f'{scoring} 지표 학습 실패'
            }
            results[idx] = {'best': json.dumps(error_data, ensure_ascii=False)}
    
    logger.info("모든 군집화 모델 학습이 완료되었습니다.")
    return results