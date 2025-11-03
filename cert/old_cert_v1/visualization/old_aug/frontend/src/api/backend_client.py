"""
백엔드 API 클라이언트

백엔드 서버와의 통신을 담당하는 클라이언트 클래스
"""

import requests
import streamlit as st
from typing import Dict, Any, Optional


class BackendClient:
    """백엔드 API 클라이언트"""
    
    def __init__(self, base_url: str = "http://localhost:8000"):
        self.base_url = base_url
        self.timeout = 30
    
    def _make_request(self, endpoint: str, method: str = "GET", data: Dict = None, files: Dict = None) -> Optional[Dict]:
        """API 요청을 수행하는 내부 메서드"""
        try:
            url = f"{self.base_url}{endpoint}"
            
            if method == "GET":
                response = requests.get(url, timeout=self.timeout)
            elif method == "POST":
                if files:
                    response = requests.post(url, files=files, timeout=self.timeout)
                else:
                    response = requests.post(url, json=data, timeout=self.timeout)
            else:
                st.error(f"지원하지 않는 HTTP 메서드: {method}")
                return None
            
            if response.status_code == 200:
                return response.json()
            elif response.status_code == 404:
                st.error("세션이 만료되었습니다. 파일을 다시 업로드해주세요.")
                return None
            elif response.status_code == 500:
                try:
                    error_data = response.json()
                    if 'detail' in error_data:
                        st.error(f"서버 오류: {error_data['detail']}")
                    else:
                        st.error(f"서버 오류가 발생했습니다: {response.text}")
                except:
                    st.error(f"서버 오류가 발생했습니다: {response.text}")
                return None
            else:
                st.error(f"API 호출 실패: {response.status_code} - {response.text}")
                return None
                
        except requests.exceptions.ConnectionError:
            st.error("백엔드 서버에 연결할 수 없습니다. 백엔드가 실행 중인지 확인해주세요.")
            return None
        except requests.exceptions.Timeout:
            st.error("요청 시간이 초과되었습니다. 다시 시도해주세요.")
            return None
        except Exception as e:
            st.error(f"API 호출 중 오류 발생: {str(e)}")
            return None
    
    def upload_file(self, uploaded_file) -> Optional[str]:
        """파일을 백엔드에 업로드하고 세션 ID를 반환"""
        try:
            # 파일 크기 검증 (10MB 제한)
            file_size = len(uploaded_file.getvalue())
            if file_size > 10 * 1024 * 1024:  # 10MB
                st.error("파일 크기가 너무 큽니다. 10MB 이하의 파일을 업로드해주세요.")
                return None
            
            # 백엔드에 업로드
            files = {"file": (uploaded_file.name, uploaded_file.getvalue(), "text/csv")}
            response = self._make_request("/api/data/upload", method="POST", files=files)
            
            if response and response.get('success'):
                session_id = response['session_id']
                st.success(f"파일 업로드 성공! 세션 ID: {session_id}")
                return session_id
            else:
                st.error("파일 업로드에 실패했습니다.")
                return None
                
        except Exception as e:
            st.error(f"파일 업로드 중 오류 발생: {str(e)}")
            return None
    
    def check_session_status(self, session_id: str) -> bool:
        """세션 상태를 확인합니다."""
        if not session_id:
            return False
        
        response = self._make_request(f"/api/session/status/{session_id}")
        return response and response.get('exists', False)
    
    def get_data_analysis(self, session_id: str) -> Optional[Dict]:
        """데이터 분석 결과를 백엔드에서 가져옴"""
        if not session_id:
            st.error("세션 ID가 없습니다.")
            return None
        
        # 세션 상태 확인
        if not self.check_session_status(session_id):
            st.error("세션이 만료되었습니다. 파일을 다시 업로드해주세요.")
            return None
        
        response = self._make_request(f"/api/data/analyze/{session_id}")
        if response and response.get('success'):
            return response
        return None
    
    def get_data_preview(self, session_id: str, rows: int = 10) -> Optional[Dict]:
        """데이터 미리보기를 백엔드에서 가져옴"""
        response = self._make_request(f"/api/data/preview/{session_id}?rows={rows}")
        return response if response and response.get('success') else None
    
    def process_augmentation(self, session_id: str, params: Dict, methods: list) -> Optional[Dict]:
        """데이터 증강을 백엔드에서 실행"""
        try:
            if not session_id:
                st.error("세션 ID가 없습니다.")
                return None
            
            if not methods:
                st.error("증강 방법을 선택해주세요.")
                return None
            
            # 세션 상태 확인
            if not self.check_session_status(session_id):
                st.error("세션이 만료되었습니다. 파일을 다시 업로드해주세요.")
                return None
            
            augmentation_data = {
                "session_id": session_id,
                "methods": methods,
                **params
            }
            
            with st.spinner("🔄 데이터 증강 처리 중..."):
                response = self._make_request("/api/augmentation/process", method="POST", data=augmentation_data)
            
            if response and response.get('success'):
                st.success("✅ 데이터 증강 완료!")
                return response
            else:
                st.error("데이터 증강에 실패했습니다.")
                return None
                
        except Exception as e:
            st.error(f"증강 처리 중 오류 발생: {str(e)}")
            return None
    
    def download_data(self, session_id: str) -> Optional[bytes]:
        """증강된 데이터를 백엔드에서 다운로드"""
        try:
            response = requests.get(f"{self.base_url}/api/data/download/{session_id}?data_type=augmented")
            if response.status_code == 200:
                return response.content
            else:
                st.error("데이터 다운로드에 실패했습니다.")
                return None
        except Exception as e:
            st.error(f"다운로드 중 오류 발생: {str(e)}")
            return None
