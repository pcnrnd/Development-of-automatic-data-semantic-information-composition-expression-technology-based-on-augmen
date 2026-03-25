import streamlit as st
import networkx as nx
import matplotlib.pyplot as plt
import graphviz
import plotly.express as px
import pandas as pd
from streamlit_timeline import st_timeline

st.set_page_config(layout='wide')

# 세션 상태 초기화
if 'graph' not in st.session_state:
    st.session_state.graph = nx.Graph()
    st.session_state.node_colors = {}

# 노드 추가 함수
def add_node(node_name, color):
    st.session_state.graph.add_node(node_name)
    st.session_state.node_colors[node_name] = color

# 엣지 추가 함수
def add_edge(node1, node2):
    if node1 and node2:
        st.session_state.graph.add_edge(node1, node2)

# 그래프 시각화
def draw_graph(graph):
    plt.figure(figsize=(8, 6))
    pos = nx.spring_layout(graph)
    
    # 노드 색상 설정
    colors = [st.session_state.node_colors[node] for node in graph.nodes()]
    
    nx.draw(graph, pos, with_labels=True, node_color=colors, node_size=2000, font_size=16, font_color='black', font_weight='bold')
    plt.axis('off')
    st.pyplot(plt)

##############################################
# 노드 추가 UI
col1, col2 = st.columns(2)

with col1:
    st.title("Workflow management")
with col2:
    st.title("Timeline")

# 노드 이름 및 색상 선택
st.sidebar.title('Settings')
new_node = st.sidebar.text_input("Add a new node:")
node_color = st.sidebar.color_picker("Select node color:", "#E5EDF9")  # 기본색: 녹색
if st.sidebar.button("Add Node"):
    add_node(new_node, node_color) # node_color
    # st.success(f"Node '{new_node}' added with color {node_color}!")

# 노드 선택 UI
if st.session_state.graph.number_of_nodes() > 0:
    node1 = st.sidebar.selectbox("Select the first node to connect:", list(st.session_state.graph.nodes()))
    node2 = st.sidebar.selectbox("Select the second node to connect:", list(st.session_state.graph.nodes()))

    if st.sidebar.button("Connect Nodes"):
        add_edge(node1, node2)
        # st.success(f"Connected '{node1}' and '{node2}'!")


# 그래프 그리기
if st.session_state.graph.number_of_nodes() > 0:
    draw_graph(st.session_state.graph)


# 리셋 버튼
if st.sidebar.button("Reset Graph"):
    st.session_state.graph.clear()
    st.session_state.node_colors.clear()
    # st.success("Graph has been reset!")

# Create a graphlib graph object

def graph_vis():
    graph = graphviz.Digraph()
    graph.attr(rankdir='LR')
    graph.node("Extract5", "Extract5", shape="rectangle", style="filled", fillcolor="#E5EDF9")
    graph.node("transform5", "transform5", shape="rectangle", style="filled", fillcolor="#E5EDF9")
    graph.node("Load5", "Load5", shape="rectangle", style="filled", fillcolor="#E5EDF9")
    graph.edge("Extract1", "transform1", color="black")
    graph.edge("transform1", "Load1", color="black")

graph = graphviz.Digraph()
graph.attr(rankdir='LR')

# 노드 추가 및 색상 설정
graph.node("Extract5", "Extract5", shape="rectangle", style="filled", fillcolor="#E5EDF9")
graph.node("transform5", "transform5", shape="rectangle", style="filled", fillcolor="#E5EDF9")
graph.node("Load5", "Load5", shape="rectangle", style="filled", fillcolor="#E5EDF9")

graph.node("Extract4", "Extract4", shape="rectangle", style="filled", fillcolor="#E5EDF9")
graph.node("transform4", "transform4", shape="rectangle", style="filled", fillcolor="#E5EDF9")
graph.node("transform4-2", "transform4-2", shape="rectangle", style="filled", fillcolor="#E5EDF9")
graph.node("Load4", "Load4", shape="rectangle", style="filled", fillcolor="#E5EDF9")

graph.node("Extract3", "Extract3", shape="rectangle", style="filled", fillcolor="#E5EDF9")
graph.node("transform3", "transform3", shape="rectangle", style="filled", fillcolor="#E5EDF9")
graph.node("transform3-2", "transform3-2", shape="rectangle", style="filled", fillcolor="#E5EDF9")
graph.node("Load3", "Load3", shape="rectangle", style="filled", fillcolor="#E5EDF9")

graph.node("Extract2", "Extract2", shape="rectangle", style="filled", fillcolor="#E5EDF9")
graph.node("transform2", "transform2", shape="rectangle", style="filled", fillcolor="#E5EDF9")
graph.node("Load2", "Load2", shape="rectangle", style="filled", fillcolor="#E5EDF9")

graph.node("Extract1", "Extract1", shape="rectangle", style="filled", fillcolor="#E5EDF9")
graph.node("transform1", "transform1", shape="rectangle", style="filled", fillcolor="#E5EDF9")
graph.node("transform1-2", "transform1-2", shape="rectangle", style="filled", fillcolor="#E5EDF9")
graph.node("Load1", "Load1", shape="rectangle", style="filled", fillcolor="#E5EDF9")


# graph.node("Extract5", "Extract5", shape="rectangle", style="filled", fillcolor="#E5EDF9")
# graph.node("transform5", "transform5", shape="rectangle", style="filled", fillcolor="#E5EDF9")
# graph.node("Load5", "Load5", shape="rectangle", style="filled", fillcolor="#E5EDF9")

# 엣지 추가
col1, col2 = st.columns(2)


graph.edge("Extract1", "transform1", color="black")
graph.edge("transform1", "transform1-2", color="black")
graph.edge("transform1-2", "Load1", color="black")

graph.edge("Extract2", "transform2", color="black")
graph.edge("transform2", "Load2", color="black")

graph.edge("Extract3", "transform3", color="black")
graph.edge("Extract3", "transform3-2", color="black")
graph.edge("transform3", "Load3", color="black")
graph.edge("transform3-2", "Load3", color="black")

graph.edge("Extract4", "transform4", color="black")
graph.edge("transform4", "transform4-2", color="black")
graph.edge("transform4-2", "Load4", color="black")

graph.edge("Extract5", "transform5", color="black")
graph.edge("transform5", "Load5", color="black")



items = [
    {"id": 1, "content": "2024-10-07", "start": "2024-10-07"},
    {"id": 2, "content": "2024-10-09", "start": "2024-10-09"},
    {"id": 3, "content": "2024-10-18", "start": "2024-10-18"},
    {"id": 4, "content": "2024-10-16", "start": "2024-10-16"},
    {"id": 5, "content": "2024-10-25", "start": "2024-10-25"},
]

# Streamlit에서 그래프 시각화
with col1:
    with st.container(border=True):
        st.graphviz_chart(graph)


with col2:
    with st.container(border=True):
        timeline = st_timeline(items, groups=[], options={}, height="410px")
        # st.subheader("Selected item")
        # st.write(timeline)