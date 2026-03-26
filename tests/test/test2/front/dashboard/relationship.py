import os
import streamlit as st
import networkx as nx
import matplotlib.pyplot as plt
import pandas as pd
from itertools import combinations

# 페이지 제목 설정
st.set_page_config(layout='wide')
st.title("데이터셋 상관관계 시각화")

# 데이터셋 경로 및 선택
paths = os.listdir('../data')
options = st.sidebar.multiselect('Select data', paths)

try:
    with st.container():
        dfs = []  # 데이터프레임을 저장할 리스트
        for filename in options:
            temp_df = pd.read_csv(f'../data/{filename}')
            dfs.append(temp_df.select_dtypes(include=['number']))  # 숫자형 데이터만 선택하여 추가

        dataset_names = [name.split('.')[0] for name in options]  # 데이터셋 이름 리스트
        edges = []  # 상관계수 엣지 저장용

        # 데이터셋 간의 상관계수 계산
        for (dataset1, df1), (dataset2, df2) in combinations(zip(dataset_names, dfs), 2):
            # 공통 수치형 컬럼을 찾기
            numeric_cols1 = df1.columns
            numeric_cols2 = df2.columns
            common_cols = list(set(numeric_cols1) & set(numeric_cols2))  # 공통 컬럼
            
            if common_cols:  # 공통 수치형 컬럼이 있는 경우에만 상관계수 계산
                correlation = df1[common_cols].corrwith(df2[common_cols]).mean()  # 평균 상관계수 corrwith
                if pd.notna(correlation) and correlation > 0:  # NaN 값이 아니고 양의 상관관계만 추가
                    edges.append((dataset1, dataset2, round(correlation, 2)))  # 데이터셋 이름과 상관계수 저장
                    # print(f"Edge added: {dataset1} - {dataset2} with correlation {round(correlation, 2)}")  # 디버깅용 출력

        # 그래프 생성 및 시각화
        G = nx.Graph()
        G.add_nodes_from(dataset_names)  # 데이터셋 이름을 노드로 추가
        for edge in edges:
            G.add_edge(edge[0], edge[1], weight=edge[2])  # 상관계수로 가중치 추가

        # 간선이 추가되었는지 확인
        if edges:
            # 그래프 시각화
            plt.figure(figsize=(10, 8))
            pos = nx.spring_layout(G, seed=42)  # 레이아웃 고정
            edge_labels = nx.get_edge_attributes(G, 'weight')
            nx.draw_networkx_nodes(G, pos, node_size=500, node_color="skyblue")
            nx.draw_networkx_edges(G, pos, width=2, alpha=0.5, edge_color="gray")
            nx.draw_networkx_labels(G, pos, font_size=12, font_family="sans-serif")
            nx.draw_networkx_edge_labels(G, pos, edge_labels=edge_labels, font_color='red')
            st.pyplot(plt)  # Streamlit으로 matplotlib 플롯을 표시
        else:
            st.write("양의 상관관계가 있는 데이터셋 간의 간선이 없습니다.")

        # 원본 데이터 표시
        tabs = st.tabs([tab for tab in options])
        for i, tab in enumerate(tabs):
            with tab:
                st.subheader(options[i])
                df = pd.read_csv(f'./data/{options[i]}')
                # st.write(df)
                st.dataframe(df, use_container_width=True)

except IndexError:
    st.write('Please select at least one dataset')
