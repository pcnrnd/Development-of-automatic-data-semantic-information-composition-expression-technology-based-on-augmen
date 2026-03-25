from sklearn.ensemble import RandomForestClassifier, AdaBoostClassifier, GradientBoostingClassifier, ExtraTreesClassifier
from sklearn.neighbors import KNeighborsClassifier
from catboost import CatBoostClassifier
from xgboost import XGBClassifier
from sklearn.naive_bayes import GaussianNB
from sklearn.svm import SVC
from sklearn.linear_model import LogisticRegression
from sklearn.tree import DecisionTreeClassifier
from sklearn.neural_network import MLPClassifier
from sklearn.model_selection import cross_val_score
import pandas as pd
import numpy as np
import logging
import lightgbm as lgb

# 로깅 설정
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class Classification:
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
        """Random Forest 모델을 정의합니다."""
        try:
            model = RandomForestClassifier(n_estimators=100, max_depth=10, random_state=42)
            scores = cross_val_score(model, self.X, self.y, cv=self.cv, scoring=self.scoring)
            return scores.mean()
        except Exception as e:
            logger.error(f"Random Forest 학습 실패: {e}")
            return 0.0

    def adaboost_model(self):
        """AdaBoost 모델을 정의합니다."""
        try:
            model = AdaBoostClassifier(n_estimators=100, learning_rate=0.1, algorithm='SAMME', random_state=42)
            scores = cross_val_score(model, self.X, self.y, cv=self.cv, scoring=self.scoring)
            return scores.mean()
        except Exception as e:
            logger.error(f"AdaBoost 학습 실패: {e}")
            return 0.0
    
    def gradientboost_model(self):
        """Gradient Boosting 모델을 정의합니다."""
        try:
            model = GradientBoostingClassifier(n_estimators=100, max_depth=6, random_state=42)
            scores = cross_val_score(model, self.X, self.y, cv=self.cv, scoring=self.scoring)
            return scores.mean()
        except Exception as e:
            logger.error(f"Gradient Boosting 학습 실패: {e}")
            return 0.0

    def knn_model(self):
        """K-Nearest Neighbors 모델을 정의합니다."""
        try:
            model = KNeighborsClassifier(n_neighbors=5)
            scores = cross_val_score(model, self.X, self.y, cv=self.cv, scoring=self.scoring)
            return scores.mean()
        except Exception as e:
            logger.error(f"KNN 학습 실패: {e}")
            return 0.0

    def catboost_model(self):
        """CatBoost 모델을 정의합니다."""
        try:
            model = CatBoostClassifier(n_estimators=100, max_depth=6, random_state=42, verbose=False)
            scores = cross_val_score(model, self.X, self.y, cv=self.cv, scoring=self.scoring)
            return scores.mean()
        except Exception as e:
            logger.error(f"CatBoost 학습 실패: {e}")
            return 0.0

    def xgboost_model(self):
        """XGBoost 모델을 정의합니다."""
        try:
            model = XGBClassifier(n_estimators=100, max_depth=6, random_state=42, verbosity=0)
            scores = cross_val_score(model, self.X, self.y, cv=self.cv, scoring=self.scoring)
            return scores.mean()
        except Exception as e:
            logger.error(f"XGBoost 학습 실패: {e}")
            return 0.0

    def gaussiannb_model(self):
        """Gaussian Naive Bayes 모델을 정의합니다."""
        try:
            model = GaussianNB(var_smoothing=1e-9)
            scores = cross_val_score(model, self.X, self.y, cv=self.cv, scoring=self.scoring)
            return scores.mean()
        except Exception as e:
            logger.error(f"Gaussian NB 학습 실패: {e}")
            return 0.0

    def svm_model(self):
        """SVM 모델을 정의합니다."""
        try:
            model = SVC(C=1.0, kernel='rbf', gamma='scale', random_state=42)
            scores = cross_val_score(model, self.X, self.y, cv=self.cv, scoring=self.scoring)
            return scores.mean()
        except Exception as e:
            logger.error(f"SVM 학습 실패: {e}")
            return 0.0

    def logistic_regression_model(self):
        """Logistic Regression 모델을 정의합니다."""
        try:
            model = LogisticRegression(C=1.0, penalty='l2', solver='liblinear', random_state=42)
            scores = cross_val_score(model, self.X, self.y, cv=self.cv, scoring=self.scoring)
            return scores.mean()
        except Exception as e:
            logger.error(f"Logistic Regression 학습 실패: {e}")
            return 0.0

    def decision_tree_model(self):
        """Decision Tree 모델을 정의합니다."""
        try:
            model = DecisionTreeClassifier(max_depth=10, min_samples_split=2, min_samples_leaf=1, random_state=42)
            scores = cross_val_score(model, self.X, self.y, cv=self.cv, scoring=self.scoring)
            return scores.mean()
        except Exception as e:
            logger.error(f"Decision Tree 학습 실패: {e}")
            return 0.0

    def extra_trees_model(self):
        """Extra Trees 모델을 정의합니다."""
        try:
            model = ExtraTreesClassifier(n_estimators=100, max_depth=10, random_state=42)
            scores = cross_val_score(model, self.X, self.y, cv=self.cv, scoring=self.scoring)
            return scores.mean()
        except Exception as e:
            logger.error(f"Extra Trees 학습 실패: {e}")
            return 0.0

    def lightgbm_model(self):
        """LightGBM 모델을 정의합니다."""
        try:
            model = lgb.LGBMClassifier(n_estimators=100, max_depth=6, learning_rate=0.1, random_state=42, verbose=-1)
            scores = cross_val_score(model, self.X, self.y, cv=self.cv, scoring=self.scoring)
            return scores.mean()
        except Exception as e:
            logger.error(f"LightGBM 학습 실패: {e}")
            return 0.0

    def mlp_model(self):
        """MLP (Neural Network) 모델을 정의합니다."""
        try:
            model = MLPClassifier(hidden_layer_sizes=(100,), alpha=0.0001, learning_rate_init=0.001, random_state=42, max_iter=500)
            scores = cross_val_score(model, self.X, self.y, cv=self.cv, scoring=self.scoring)
            return scores.mean()
        except Exception as e:
            logger.error(f"MLP 학습 실패: {e}")
            return 0.0

    def run_clf_models(self):
        """모든 분류 모델을 실행하고 결과를 반환합니다."""
        scoring = self.scoring
        logger.info(f"{scoring} 스코어로 모델 학습을 시작합니다...")
        
        models = {
            'randomforest': self.random_forest_model,
            'adaboost': self.adaboost_model,
            'gradientboost': self.gradientboost_model,
            'KNeighbors': self.knn_model,
            'catboost': self.catboost_model,
            'xgboost': self.xgboost_model,
            'GaussianNB': self.gaussiannb_model,
            'svm': self.svm_model,
            'logistic_regression': self.logistic_regression_model,
            'decision_tree': self.decision_tree_model,
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
 
def compare_clf_models(df, target):
    '''
    모든 분류 모델을 학습합니다.
    
    Args:
        df: 입력 데이터프레임
        target: 타겟 컬럼명
    
    Returns:
        dict: 각 스코어별 결과
    '''
    scorings = ['accuracy', 'recall', 'precision', 'f1_weighted']
    results = dict()
    
    logger.info(f"총 {len(scorings)}개 스코어로 학습을 시작합니다.")
    
    for idx, scoring in enumerate(scorings):
        logger.info(f"진행률: {idx+1}/{len(scorings)} - {scoring} 스코어 학습 중...")
        try:
            results[idx] = Classification(df, target, scoring).run_clf_models()
        except Exception as e:
            logger.error(f"{scoring} 스코어 학습 실패: {e}")
            results[idx] = {'best': '{}'}
    
    logger.info("모든 학습이 완료되었습니다.")
    return results