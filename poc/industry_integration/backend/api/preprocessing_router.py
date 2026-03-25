from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse
from services.dataframe import PolarsDataFrame, PandasDataFrame
from services.prepro_img import ImageProcessor
import duckdb
import os
router = APIRouter()
DATA_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'data')

img_prepro = ImageProcessor()

@router.post('/extract_metadata')
async def extract_metadata(request: Request):
    data = request.json()
    path = data['path']
    path_data = img_prepro.get_all_file_paths(path)
    df = img_prepro.make_polars_dataframe(path_data)
    result = df.to_json()
    return JSONResponse(content=result)

@router.get('/read_file_list')
def read_file_list():
    pf = PolarsDataFrame()
    paths = pf.get_all_file_paths('./data/')
    return {'paths': paths}

@router.post('/add_file_data')
async def add_file_data(request: Request):
    '''
    add unstructured data psths
    '''
    data = await request.json()
    abs_path_of_file = data['abs_path']
    table_name = data['table_name']

    # pf = PolarsDataFrame()
    pd = PandasDataFrame()

    paths = pd.get_all_file_paths(abs_path_of_file) # 모든 파일 데이터 경로 추출
    df = pd.make_pandas_dataframe(paths) # 추출한 경로 데이터프레임 생성
    # df_pandas = df.to_pandas()
    
    con = duckdb.connect(database='./database.db')
    con.register("df_temp", df)
    con.execute(f'DROP TABLE IF EXISTS {table_name}')
    con.execute(f'CREATE TABLE "{table_name}" AS SELECT * FROM df_temp')

    return {'message': '데이터 저장 완료!'}

@router.get('/show_tables')
async def show_tables():
    con = duckdb.connect(database='./database.db')
    tables = con.execute('SHOW TABLES').fetchall()
    return {'tables': tables}
    
@router.get('/read_file_data/{table_name}')
def read_file_data(table_name: str):
    '''
    read unstructured data table
    '''
    con = duckdb.connect(database='./database.db')
    query_result = con.execute(f'SELECT * FROM "{table_name}"').fetchall()

    try:
        # 테이블 목록 조회
        tables = con.execute("SHOW TABLES").fetchall()
        table_names = [table[0] for table in tables]

        if table_name not in table_names:
            return {'error': f"Table '{table_name}' does not exist."}

        # 테이블이 존재하면 데이터 조회
        query_result = con.execute(f'SELECT * FROM "{table_name}"').fetchall()
        return {'query_result': query_result}
    
    except Exception as e:
        return {'error': f"Failed to execute query: {e}"}