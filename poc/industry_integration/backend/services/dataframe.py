import glob
import os
import polars as pl
import pandas as pd
from concurrent.futures import ThreadPoolExecutor

    
class PolarsDataFrame:
    '''
    polars dataframe 생성
    '''
    
    def __init__(self):
        pass



    def get_all_file_paths(self, root_path):
        # glob를 사용하여 하위 디렉토리까지 검색
        paths = glob.glob(os.path.join(root_path, '**'), recursive=True)
        
        # .zip 파일을 제외한 파일들만 필터링
        file_paths = [path for path in paths if os.path.isfile(path) and not path.endswith('.zip')]
        
        return file_paths
    
    # def get_all_file_paths(self, root_path):
    #     paths = glob.glob(root_path)
    #     img_dir_list = [path for path in paths if not path.endswith('.zip')]
    #     file_paths = []
    #     for root_dir in img_dir_list:
    #         for dirpath, dirnames, filenames in os.walk(root_dir):
    #             for filename in filenames:
    #                 full_path = os.path.join(dirpath, filename)
    #                 file_paths.append(full_path)
    #     return file_paths

    def _extract_data(self, paths, extractor):
        with ThreadPoolExecutor() as executor:
            return list(executor.map(extractor, paths))


    def extract_file_id(self, paths):
        # 순차적인 ID 생성 (1, 2, 3, ...)
        return list(range(1, len(paths) + 1))
    # def extract_file_id(self, paths):
    #     return self._extract_data(paths, lambda path: os.path.splitext(os.path.basename(path))[0])

    def extract_file_name(self, paths):
        return self._extract_data(paths, lambda path: os.path.basename(path))

    def extract_folder_name(self, paths):
        return self._extract_data(paths, lambda path: os.path.basename(os.path.dirname(path)))

    def extract_file_size(self, paths):
        return self._extract_data(paths, lambda path: os.path.getsize(path))

    def make_polars_dataframe(self, paths):
        '''polars_dataframe 생성'''
        df = pl.DataFrame({
            "full_path": paths,
            "file_id": self.extract_file_id(paths),
            "file_name": self.extract_file_name(paths),
            "folder_name": self.extract_folder_name(paths),
            "file_size": self.extract_file_size(paths)
        })
        return df

class PandasDataFrame:
    '''
    polars dataframe 생성
    '''
    
    def __init__(self):
        pass



    def get_all_file_paths(self, root_path):
        # glob를 사용하여 하위 디렉토리까지 검색
        paths = glob.glob(os.path.join(root_path, '**'), recursive=True)
        
        # .zip 파일을 제외한 파일들만 필터링
        file_paths = [path for path in paths if os.path.isfile(path) and not path.endswith('.zip')]
        
        return file_paths
    
    def _extract_data(self, paths, extractor):
        with ThreadPoolExecutor() as executor:
            return list(executor.map(extractor, paths))

    def extract_file_id(self, paths):
        # 순차적인 ID 생성 (1, 2, 3, ...)
        return list(range(1, len(paths) + 1))

    def extract_file_name(self, paths):
        return self._extract_data(paths, lambda path: os.path.basename(path))

    def extract_folder_name(self, paths):
        return self._extract_data(paths, lambda path: os.path.basename(os.path.dirname(path)))

    def extract_file_size(self, paths):
        return self._extract_data(paths, lambda path: os.path.getsize(path))

    def make_pandas_dataframe(self, paths):
        '''polars_dataframe 생성'''
        df = pd.DataFrame({
            "full_path": paths,
            "file_id": self.extract_file_id(paths),
            "file_name": self.extract_file_name(paths),
            "folder_name": self.extract_folder_name(paths),
            "file_size": self.extract_file_size(paths)
        })
        return df
