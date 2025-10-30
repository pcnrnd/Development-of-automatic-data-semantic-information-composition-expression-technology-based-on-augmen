from sklearn.ensemble import RandomForestRegressor, GradientBoostingRegressor, AdaBoostRegressor, ExtraTreesRegressor
from sklearn.neighbors import KNeighborsRegressor
from sklearn.tree import DecisionTreeRegressor
from sklearn.svm import SVR
from sklearn.linear_model import Ridge, Lasso, ElasticNet, LinearRegression
from sklearn.neural_network import MLPRegressor

from catboost import CatBoostRegressor
from xgboost import XGBRegressor
import lightgbm as lgb

from sklearn.model_selection import cross_val_score
import numpy as np
import pandas as pd
import logging
from tqdm import tqdm

# 로깅 설정
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class RegressionModels:
    def __init__(self, df, target, scoring):
        self.df = df
        self.target = target
        self.X = df.drop(target, axis=1)
        self.y = np.ravel(df[target])
        self.scoring = scoring
        self.cv = 3
        
        # 데이터 검증
        logger.info(f"입력 데이터 형태: X={self.X.shape}, y={self.y.shape}")
        logger.info(f"타겟 컬럼: {target}")
        logger.info(f"특성 컬럼: {list(self.X.columns)}")
        
        # 무한값과 NaN 처리
        self.X = self.X.replace([np.inf, -np.inf], np.nan)
        self.X = self.X.fillna(self.X.mean())
        self.y = np.nan_to_num(self.y, nan=np.nanmean(self.y))

    def random_forest_model(self):
        """Random Forest 회귀 모델을 정의합니다."""
        try:
            model = RandomForestRegressor(random_state=42, n_estimators=100)
            scores = cross_val_score(model, self.X, self.y, cv=self.cv, scoring=self.scoring)
            return scores.mean()
        except Exception as e:
            logger.error(f"Random Forest 학습 실패: {e}")
            return -float('inf')

    def gradient_boosting_model(self):
        """Gradient Boosting 회귀 모델을 정의합니다."""
        try:
            model = GradientBoostingRegressor(random_state=42, n_estimators=100)
            scores = cross_val_score(model, self.X, self.y, cv=self.cv, scoring=self.scoring)
            return scores.mean()
        except Exception as e:
            logger.error(f"Gradient Boosting 학습 실패: {e}")
            return -float('inf')

    def xgboost_model(self):
        """XGBoost 회귀 모델을 정의합니다."""
        try:
            model = XGBRegressor(random_state=42, n_estimators=100, verbosity=0)
            scores = cross_val_score(model, self.X, self.y, cv=self.cv, scoring=self.scoring)
            return scores.mean()
        except Exception as e:
            logger.error(f"XGBoost 학습 실패: {e}")
            return -float('inf')

    def catboost_model(self):
        """CatBoost 회귀 모델을 정의합니다."""
        try:
            model = CatBoostRegressor(random_state=42, verbose=0, iterations=100)
            scores = cross_val_score(model, self.X, self.y, cv=self.cv, scoring=self.scoring)
            return scores.mean()
        except Exception as e:
            logger.error(f"CatBoost 학습 실패: {e}")
            return -float('inf')

    def adaboost_model(self):
        """AdaBoost 회귀 모델을 정의합니다."""
        try:
            model = AdaBoostRegressor(random_state=42, n_estimators=100)
            scores = cross_val_score(model, self.X, self.y, cv=self.cv, scoring=self.scoring)
            return scores.mean()
        except Exception as e:
            logger.error(f"AdaBoost 학습 실패: {e}")
            return -float('inf')

    def decision_tree_model(self):
        """Decision Tree 회귀 모델을 정의합니다."""
        try:
            model = DecisionTreeRegressor(random_state=42)
            scores = cross_val_score(model, self.X, self.y, cv=self.cv, scoring=self.scoring)
            return scores.mean()
        except Exception as e:
            logger.error(f"Decision Tree 학습 실패: {e}")
            return -float('inf')

    def knn_model(self):
        """K-Nearest Neighbors 회귀 모델을 정의합니다."""
        try:
            model = KNeighborsRegressor(n_neighbors=5)
            scores = cross_val_score(model, self.X, self.y, cv=self.cv, scoring=self.scoring)
            return scores.mean()
        except Exception as e:
            logger.error(f"KNN 학습 실패: {e}")
            return -float('inf')

    def svr_model(self):
        """Support Vector Regression 모델을 정의합니다."""
        try:
            model = SVR(kernel='rbf')
            scores = cross_val_score(model, self.X, self.y, cv=self.cv, scoring=self.scoring)
            return scores.mean()
        except Exception as e:
            logger.error(f"SVR 학습 실패: {e}")
            return -float('inf')

    def ridge_model(self):
        """Ridge 회귀 모델을 정의합니다."""
        try:
            model = Ridge(random_state=42)
            scores = cross_val_score(model, self.X, self.y, cv=self.cv, scoring=self.scoring)
            return scores.mean()
        except Exception as e:
            logger.error(f"Ridge 학습 실패: {e}")
            return -float('inf')

    def lasso_model(self):
        """Lasso 회귀 모델을 정의합니다."""
        try:
            model = Lasso(random_state=42)
            scores = cross_val_score(model, self.X, self.y, cv=self.cv, scoring=self.scoring)
            return scores.mean()
        except Exception as e:
            logger.error(f"Lasso 학습 실패: {e}")
            return -float('inf')

    def elastic_net_model(self):
        """Elastic Net 회귀 모델을 정의합니다."""
        try:
            model = ElasticNet(random_state=42)
            scores = cross_val_score(model, self.X, self.y, cv=self.cv, scoring=self.scoring)
            return scores.mean()
        except Exception as e:
            logger.error(f"Elastic Net 학습 실패: {e}")
            return -float('inf')

    def linear_regression_model(self):
        """Linear Regression 모델을 정의합니다."""
        try:
            model = LinearRegression()
            scores = cross_val_score(model, self.X, self.y, cv=self.cv, scoring=self.scoring)
            return scores.mean()
        except Exception as e:
            logger.error(f"Linear Regression 학습 실패: {e}")
            return -float('inf')

    def extra_trees_model(self):
        """Extra Trees 회귀 모델을 정의합니다."""
        try:
            model = ExtraTreesRegressor(random_state=42, n_estimators=100)
            scores = cross_val_score(model, self.X, self.y, cv=self.cv, scoring=self.scoring)
            return scores.mean()
        except Exception as e:
            logger.error(f"Extra Trees 학습 실패: {e}")
            return -float('inf')

    def lightgbm_model(self):
        """LightGBM 회귀 모델을 정의합니다."""
        try:
            model = lgb.LGBMRegressor(random_state=42, verbose=-1, n_estimators=100)
            scores = cross_val_score(model, self.X, self.y, cv=self.cv, scoring=self.scoring)
            return scores.mean()
        except Exception as e:
            logger.error(f"LightGBM 학습 실패: {e}")
            return -float('inf')

    def mlp_model(self):
        """MLP (Neural Network) 회귀 모델을 정의합니다."""
        try:
            model = MLPRegressor(random_state=42, max_iter=500, hidden_layer_sizes=(100,))
            scores = cross_val_score(model, self.X, self.y, cv=self.cv, scoring=self.scoring)
            return scores.mean()
        except Exception as e:
            logger.error(f"MLP 학습 실패: {e}")
            return -float('inf')

    def run_reg_models(self):
        """모든 회귀 모델을 실행하고 결과를 반환합니다."""
        scoring = self.scoring
        logger.info(f"{scoring} 스코어로 회귀 모델 학습을 시작합니다...")
        
        models = {
            'randomforest': self.random_forest_model,
            'gradientboost': self.gradient_boosting_model,
            'xgboost': self.xgboost_model,
            'catboost': self.catboost_model,
            'adaboost': self.adaboost_model,
            'decision_tree': self.decision_tree_model,
            'knn': self.knn_model,
            'svr': self.svr_model,
            'ridge': self.ridge_model,
            'lasso': self.lasso_model,
            'elastic_net': self.elastic_net_model,
            'linear_regression': self.linear_regression_model,
            'extra_trees': self.extra_trees_model,
            'lightgbm': self.lightgbm_model,
            'mlp': self.mlp_model,
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
    
        logger.info(f"{scoring} 스코어 학습 완료. 최고 성능: {results_data['best_score']:.4f}")
        return {'best': results_json}

def compare_reg_models(df, target):
    '''
    모든 회귀 모델을 학습합니다.
    
    Args:
        df: 입력 데이터프레임
        target: 타겟 컬럼명
    
    Returns:
        dict: 각 스코어별 결과
    '''
    scorings = ['neg_mean_squared_error', 'neg_mean_absolute_error']
  
    results = dict()
    
    logger.info(f"총 {len(scorings)}개 스코어로 회귀 모델 학습을 시작합니다.")
    
    for idx, scoring in enumerate(scorings):
        logger.info(f"진행률: {idx+1}/{len(scorings)} - {scoring} 스코어 학습 중...")
        try:
            results[idx] = RegressionModels(df, target, scoring).run_reg_models()
        except Exception as e:
            logger.error(f"{scoring} 스코어 학습 실패: {e}")
            results[idx] = {'best': '{}'}
    
    logger.info("모든 회귀 모델 학습이 완료되었습니다.")
    return results