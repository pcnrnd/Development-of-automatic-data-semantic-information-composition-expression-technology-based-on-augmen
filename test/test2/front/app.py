# 실행방법: streamlit run app.py
import streamlit as st
import os
import sys

directories = ['./dashboard', './recommendation', './augmentation', './preprocessing']
for directory in directories:
    sys.path.append(os.path.abspath(directory))

pages = {
    "Home": [
        st.Page(os.path.join('dashboard', 'main.py'), title='main')
    ],
    'Dashboard': [
        st.Page(os.path.join('dashboard', 'health.py'), title='health'),
        st.Page(os.path.join('dashboard', 'quantitative_goal.py'), title='quantitative'),
        st.Page(os.path.join('dashboard', 'relationship.py'), title='relationship'),
        st.Page(os.path.join('dashboard', 'workflow.py'), title='workflow'),
    ],
    "Model": [
        st.Page(os.path.join('recommendation', 'recommendation.py'), title='Model Recommendation'),
    ],
    'Data': [
        st.Page(os.path.join('augmentation', 'gene.py'), title='Data Augmentation'),
        st.Page(os.path.join('preprocessing', 'preprocessing.py'), title='Data preprocessing'),
        st.Page(os.path.join('extract_meta', 'metadata.py'), title='Metadata Collection'),
    ]
}

pg = st.navigation(pages)
pg.run()
