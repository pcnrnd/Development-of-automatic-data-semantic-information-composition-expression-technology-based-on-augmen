import streamlit as st
import pandas as pd
import json
import os
from extract_meta.lib.fastapi_client import call_fastapi_metadata_api
from extract_meta.lib.result_saver import save_metadata_result
from extract_meta.lib.utils import detect_file_type, is_valid_directory

st.title("메타데이터 추출 및 시각화")

# -----------------------------
# 사이드바 설정
# -----------------------------
st.sidebar.header("설정")

selected_types = st.sidebar.multiselect(
    "처리할 파일 형식 선택",
    options=["CSV", "Excel", "JSON", "Image"],
    default=["CSV", "Excel", "JSON", "Image"]
)

show_preview = st.sidebar.checkbox("데이터 미리보기 (표/이미지)", value=True)
filter_exif = st.sidebar.checkbox("EXIF 주요 필드만 보기 (이미지 전용)", value=True)

st.sidebar.markdown("### 결과 저장")
save_path = st.sidebar.text_input("결과 저장할 로컬 경로 (예: ./exported_metadata)", value="exported_metadata")
export_format = st.sidebar.selectbox("내보낼 형식 선택", ["CSV", "JSON"])
enable_save = st.sidebar.checkbox("자동으로 저장 실행", value=False)

# -----------------------------
# 디렉토리 분석
# -----------------------------
st.subheader("디렉토리 기반 분석")
directory_path = st.text_input("분석할 디렉토리 경로 입력 (예: ./data):")
directory_results = []

if directory_path:
    if is_valid_directory(directory_path):
        st.info(f"분석 대상 경로: {directory_path}")
        if st.button("디렉토리 내 메타데이터 추출 요청"):
            with st.spinner("디렉토리 내 파일을 분석 중..."):
                directory_results = extract_metadata_from_directory(
                    path=directory_path,
                    types=selected_types,
                    filter_exif=filter_exif
                )
            st.success(f"총 {len(directory_results)}개 파일 메타데이터 추출 완료")
            st.dataframe(pd.DataFrame(directory_results))
    else:
        st.error("❌ 유효한 디렉토리 경로가 아닙니다.")

# -----------------------------
# 파일 업로드 및 처리
# -----------------------------
uploaded_file = st.file_uploader("파일 업로드", type=["csv", "xlsx", "json", "jpg", "jpeg", "png"])
metadata_result = None

if uploaded_file:
    file_type = detect_file_type(uploaded_file.name)
    if file_type not in selected_types:
        st.warning(f"선택한 유형 '{file_type}'은(는) 현재 비활성화 상태입니다.")
    else:
        st.write(f"**파일 이름:** {uploaded_file.name}")
        with st.spinner("메타정보 추출 요청 중..."):
            try:
                metadata_result = call_fastapi_metadata_api(uploaded_file, file_type.lower(), filter_exif)
                st.success("메타데이터 추출 완료")
            except Exception as e:
                st.error(str(e))

        if metadata_result:
            if isinstance(metadata_result, dict) and "columns" in metadata_result:
                st.write(f"Shape: {metadata_result.get('shape')}")
                st.write(f"Columns: {metadata_result.get('columns')}")
                if show_preview:
                    st.markdown("#### 데이터 미리보기")
                    df_preview = pd.DataFrame(columns=metadata_result.get("columns", []))
                    st.dataframe(df_preview)
            else:
                if show_preview:
                    st.json(metadata_result)

# -----------------------------
# 결과 저장 처리
# -----------------------------
if metadata_result:
    st.markdown("### 메타데이터 결과 저장")
    try:
        out_path = save_metadata_result(metadata_result, save_path, export_format)
        st.download_button(
            label=f"{export_format}로 다운로드",
            data=open(out_path, "rb").read(),
            file_name=os.path.basename(out_path),
            mime="application/json" if export_format == "JSON" else "text/csv"
        )
        if enable_save:
            st.success(f"자동 저장 완료: {out_path}")
    except Exception as e:
        st.error(f"저장 실패: {e}")



# import streamlit as st
# import os
# import pandas as pd
# from PIL import Image, ExifTags
# import json

# # -----------------------------
# # ⚙️ 사이드바 옵션
# # -----------------------------
# st.sidebar.header("⚙️ 설정")

# selected_types = st.sidebar.multiselect(
#     "처리할 파일 형식 선택",
#     options=["CSV", "Excel", "JSON", "Image"],
#     default=["CSV", "Excel", "JSON", "Image"]
# )

# show_preview = st.sidebar.checkbox("데이터 미리보기 (표/이미지)", value=True)
# show_exif_only = st.sidebar.checkbox("이미지: EXIF 메타데이터만 보기", value=False)

# # EXIF 필터 옵션
# st.sidebar.markdown("### 🖼️ EXIF 필터")
# filter_exif = st.sidebar.checkbox("EXIF 주요 필드만 보기", value=True)
# EXIF_WHITELIST = ["DateTime", "DateTimeOriginal", "Model", "Make", "LensModel", "Software", "GPSInfo"]

# # 결과 저장 옵션
# st.sidebar.markdown("### 💾 결과 저장")
# save_path = st.sidebar.text_input("결과 저장할 로컬 경로 (예: D:/result 또는 ./data)", value="exported_metadata")
# export_format = st.sidebar.selectbox("내보낼 형식 선택", ["CSV", "JSON"])
# enable_save = st.sidebar.checkbox("자동으로 저장 실행", value=False)

# # -----------------------------
# # 📁 파일 확장자 정의
# # -----------------------------
# EXT_MAP = {
#     "CSV": [".csv"],
#     "Excel": [".xlsx"],
#     "JSON": [".json"],
#     "Image": [".jpg", ".jpeg", ".png"]
# }
# SUPPORTED_EXTENSIONS = tuple(ext for t in selected_types for ext in EXT_MAP[t])
# metadata_results = []

# # -----------------------------
# # 🔼 업로드된 파일 처리
# # -----------------------------
# st.title("📂 메타데이터 추출기")
# st.subheader("1️⃣ 파일 업로드")

# uploaded_files = st.file_uploader("파일 업로드 (여러 개 가능)", type=[e[1:] for e in SUPPORTED_EXTENSIONS], accept_multiple_files=True)

# if uploaded_files:
#     for uploaded_file in uploaded_files:
#         st.write(f"**파일:** {uploaded_file.name}")
#         try:
#             if uploaded_file.name.endswith(".csv") and "CSV" in selected_types:
#                 df = pd.read_csv(uploaded_file)
#                 st.write(f"**Shape:** {df.shape}, **Columns:** {list(df.columns)}")
#                 if show_preview:
#                     st.dataframe(df.head())
#             elif uploaded_file.name.endswith(".xlsx") and "Excel" in selected_types:
#                 df = pd.read_excel(uploaded_file)
#                 st.write(f"**Shape:** {df.shape}, **Columns:** {list(df.columns)}")
#                 if show_preview:
#                     st.dataframe(df.head())
#             elif uploaded_file.name.endswith(".json") and "JSON" in selected_types:
#                 df = pd.read_json(uploaded_file)
#                 st.write(f"**Shape:** {df.shape}, **Columns:** {list(df.columns)}")
#                 if show_preview:
#                     st.dataframe(df.head())
#             elif uploaded_file.name.lower().endswith(('.jpg', '.jpeg', '.png')) and "Image" in selected_types:
#                 image = Image.open(uploaded_file)
#                 if not show_exif_only and show_preview:
#                     st.image(image, caption=uploaded_file.name, use_container_width=True)
#                 exif_data = image._getexif()
#                 if exif_data:
#                     raw_metadata = {ExifTags.TAGS.get(tag): value for tag, value in exif_data.items() if tag in ExifTags.TAGS}
#                     filtered_metadata = {k: v for k, v in raw_metadata.items() if k in EXIF_WHITELIST} if filter_exif else raw_metadata
#                     st.json(filtered_metadata)
#                     metadata_results.append({"file": uploaded_file.name, **filtered_metadata})
#                 else:
#                     st.info("EXIF 메타데이터 없음.")
#         except Exception as e:
#             st.error(f"⚠️ 처리 오류: {e}")

# # -----------------------------
# # 📂 디렉토리 경로 처리
# # -----------------------------
# st.subheader("2️⃣ 디렉토리 경로 입력")

# directory = st.text_input("분석할 디렉토리 경로 입력:")

# if directory and os.path.isdir(directory):
#     file_paths = []
#     for root, _, files in os.walk(directory):
#         for file in files:
#             if file.lower().endswith(SUPPORTED_EXTENSIONS):
#                 full_path = os.path.join(root, file)
#                 rel_path = os.path.relpath(full_path, directory)
#                 file_paths.append((rel_path, full_path))

#     if file_paths:
#         selected_files = st.multiselect("처리할 파일 선택:", [f[0] for f in file_paths])
#         for rel_path, full_path in file_paths:
#             if rel_path not in selected_files:
#                 continue
#             st.write(f"**파일:** {rel_path}")
#             try:
#                 if full_path.endswith(".csv") and "CSV" in selected_types:
#                     df = pd.read_csv(full_path)
#                     st.write(f"**Shape:** {df.shape}, **Columns:** {list(df.columns)}")
#                     if show_preview:
#                         st.dataframe(df.head())
#                 elif full_path.endswith(".xlsx") and "Excel" in selected_types:
#                     df = pd.read_excel(full_path)
#                     st.write(f"**Shape:** {df.shape}, **Columns:** {list(df.columns)}")
#                     if show_preview:
#                         st.dataframe(df.head())
#                 elif full_path.endswith(".json") and "JSON" in selected_types:
#                     df = pd.read_json(full_path)
#                     st.write(f"**Shape:** {df.shape}, **Columns:** {list(df.columns)}")
#                     if show_preview:
#                         st.dataframe(df.head())
#                 elif full_path.lower().endswith(('.jpg', '.jpeg', '.png')) and "Image" in selected_types:
#                     image = Image.open(full_path)
#                     if not show_exif_only and show_preview:
#                         st.image(image, caption=rel_path, use_container_width=True)
#                     exif_data = image._getexif()
#                     if exif_data:
#                         raw_metadata = {ExifTags.TAGS.get(tag): value for tag, value in exif_data.items() if tag in ExifTags.TAGS}
#                         filtered_metadata = {k: v for k, v in raw_metadata.items() if k in EXIF_WHITELIST} if filter_exif else raw_metadata
#                         st.json(filtered_metadata)
#                         metadata_results.append({"file": rel_path, **filtered_metadata})
#                     else:
#                         st.info("EXIF 메타데이터 없음.")
#             except Exception as e:
#                 st.error(f"⚠️ 처리 오류: {e}")
#     else:
#         st.warning("유효한 파일이 없습니다.")
# elif directory:
#     st.error("❌ 유효하지 않은 디렉토리 경로입니다.")

# # -----------------------------
# # 💾 결과 저장 처리
# # -----------------------------
# if metadata_results:
#     st.markdown("### 📁 메타데이터 결과 저장")

#     if export_format == "CSV":
#         df_export = pd.DataFrame(metadata_results)
#         csv_data = df_export.to_csv(index=False).encode("utf-8")
#         st.download_button("📥 CSV로 다운로드", data=csv_data, file_name="metadata_result.csv", mime="text/csv")
#         if enable_save:
#             try:
#                 os.makedirs(save_path, exist_ok=True)
#                 out_path = os.path.join(save_path, "metadata_result.csv")
#                 df_export.to_csv(out_path, index=False)
#                 st.success(f"✅ 저장 완료: '{out_path}'")
#             except Exception as e:
#                 st.error(f"❌ 저장 실패: {e}")

#     elif export_format == "JSON":
#         json_data = json.dumps(metadata_results, indent=2, ensure_ascii=False)
#         st.download_button("📥 JSON으로 다운로드", data=json_data, file_name="metadata_result.json", mime="application/json")
#         if enable_save:
#             try:
#                 os.makedirs(save_path, exist_ok=True)
#                 out_path = os.path.join(save_path, "metadata_result.json")
#                 with open(out_path, "w", encoding="utf-8") as f:
#                     f.write(json_data)
#                 st.success(f"✅ 저장 완료: '{out_path}'")
#             except Exception as e:
#                 st.error(f"❌ 저장 실패: {e}")

