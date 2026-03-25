from sklearn.ensemble import RandomForestRegressor, GradientBoostingRegressor, AdaBoostRegressor
from sklearn.neighbors import KNeighborsRegressor
from sklearn.tree import DecisionTreeRegressor

from catboost import CatBoostRegressor
from xgboost import XGBRegressor
# import lightgbm as lgb

from sklearn.linear_model import Ridge, Lasso, ElasticNet

from sklearn.model_selection import cross_val_score
import numpy as np
import pandas as pd
import optuna

class RegressionModels:
    def __init__(self, df, target, scoring, n_trials=10):
        self.df = df
        self.target = target
        self.n_trials = n_trials
        self.X = df.drop(target, axis=1)
        self.y = np.ravel(df[target])
        self.scoring = scoring
        # Tree-based models params info
        self.start_n_estimator = 10
        self.end_n_estimator = 15
        self.start_max_depth = 6
        self.end_max_depth = 16

        self.start_learning_rate = 0.01
        self.end_learning_rate = 1

        self.start_n_neighbors = 5
        self.end_n_neighbors = 10

        self.start_var_smoothing = 1e-9
        self.end_var_smoothing = 1e-5

    def optimizer(self, model_func):
        study = optuna.create_study(direction="maximize")
        study.optimize(model_func, n_trials=self.n_trials)
        return study

    def random_forest_model(self, trial):
        max_depth = trial.suggest_int("max_depth", self.start_max_depth, self.end_max_depth)
        n_estimator = trial.suggest_int("n_estimator", self.start_n_estimator, self.end_n_estimator)
        model = RandomForestRegressor(max_depth=max_depth, n_estimators=n_estimator)
        return cross_val_score(model, self.X, self.y, cv=5, scoring=self.scoring).mean()

    def gradient_boosting_model(self, trial):
        max_depth = trial.suggest_int("max_depth", self.start_max_depth, self.end_max_depth)
        n_estimator = trial.suggest_int("n_estimator", self.start_n_estimator, self.end_n_estimator)
        model = GradientBoostingRegressor(max_depth=max_depth, n_estimators=n_estimator)
        return cross_val_score(model, self.X, self.y, cv=5, scoring=self.scoring).mean()

    def xgboost_model(self, trial):
        max_depth = trial.suggest_int("max_depth", self.start_max_depth, self.end_max_depth)
        n_estimator = trial.suggest_int("n_estimator", self.start_n_estimator, self.end_n_estimator)
        model = XGBRegressor(max_depth=max_depth, n_estimators=n_estimator)
        return cross_val_score(model, self.X, self.y, cv=5, scoring=self.scoring).mean()

    def catboost_model(self, trial):
        max_depth = trial.suggest_int("max_depth", self.start_max_depth, self.end_max_depth)
        n_estimator = trial.suggest_int("n_estimator", self.start_n_estimator, self.end_n_estimator)
        model = CatBoostRegressor(max_depth=max_depth, n_estimators=n_estimator, verbose=0)
        return cross_val_score(model, self.X, self.y, cv=5, scoring=self.scoring).mean()

    def adaboost_model(self, trial):
        n_estimators = trial.suggest_int('n_estimators', self.start_n_estimator, self.end_n_estimator)
        learning_rate = trial.suggest_float('learning_rate', self.start_learning_rate, self.end_learning_rate)
        model = AdaBoostRegressor(n_estimators=n_estimators, learning_rate=learning_rate)
        return cross_val_score(model, self.X, self.y, cv=5, scoring=self.scoring).mean()

    def decision_tree_model(self, trial):
        max_depth = trial.suggest_int('max_depth', self.start_max_depth, self.end_max_depth)
        model = DecisionTreeRegressor(max_depth=max_depth)
        return cross_val_score(model, self.X, self.y, cv=5, scoring=self.scoring).mean()

    def knn_model(self, trial):
        n_neighbors = trial.suggest_int('n_neighbors', self.start_n_neighbors, self.end_n_neighbors)
        model = KNeighborsRegressor(n_neighbors=n_neighbors)
        return cross_val_score(model, self.X, self.y, cv=5, scoring=self.scoring).mean()

    def run_reg_models(self):
        scoring = self.scoring
        models = {
            'randomforest': self.optimizer(self.random_forest_model),
            'gradientboost': self.optimizer(self.gradient_boosting_model),
            'xgboost': self.optimizer(self.xgboost_model),
            'catboost': self.optimizer(self.catboost_model),
            'adaboost': self.optimizer(self.adaboost_model),
            'DecisionTree': self.optimizer(self.decision_tree_model),
            'KNeighbors': self.optimizer(self.knn_model),
        }
        best_results = {model: study.best_value for model, study in models.items()} # Best score output
        # trial_results = {model: study.get_trials() for model, study in models.items()} # All trial score output
        trial_results = {model: [trial.value for trial in study.get_trials()] for model, study in models.items()}
       
        # return pd.DataFrame([results])

        best_results_df = pd.DataFrame.from_dict(best_results, orient='index', columns=[scoring])
        best_results_df.index = ['randomforest', 'gradientboost', 'xgboost', 'catboost', 'adaboost', 'DecisionTree', 'KNeighbors']
        trial_result_df = pd.DataFrame(trial_results)
        renamed_trial_df = trial_result_df.rename(columns=lambda x: x + '_' + scoring)
    
        return {'best': best_results_df.to_json(), 'trial': renamed_trial_df.to_json()}

def compare_reg_models(df, target, n_trials):
    '''
    train all regression models
    idx 1 is neg_mean_squared_error
    idx 2 is neg_mean_absolute_error 
    '''
    scorings = ['neg_mean_squared_error', 'neg_mean_absolute_error']
    results = dict()
    for idx, scoring in enumerate(scorings):
        results[idx] = RegressionModels(df, target, scoring, n_trials).run_reg_models()
    return results
