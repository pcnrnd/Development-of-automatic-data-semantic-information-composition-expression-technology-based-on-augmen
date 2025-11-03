#!/usr/bin/env python3
"""
데이터 시각화 및 증강 도구 실행 스크립트
백엔드와 프론트엔드를 함께 실행합니다.
"""

import subprocess
import sys
import time
import os
import signal
import threading
from pathlib import Path

# Global process variables to manage them
backend_process = None
frontend_process = None

def terminate_processes():
    """실행 중인 백엔드와 프론트엔드 프로세스를 종료합니다."""
    global backend_process, frontend_process
    print("\n애플리케이션 종료 중...")
    if backend_process:
        print("🛑 백엔드 서버 종료 중...")
        try:
            backend_process.terminate()
            backend_process.wait(timeout=10)
            if backend_process.poll() is None: # Still running
                backend_process.kill()
        except Exception as e:
            print(f"백엔드 종료 중 오류 발생: {e}")
        print("백엔드 서버 종료 완료.")
    if frontend_process:
        print("🛑 프론트엔드 서버 종료 중...")
        try:
            frontend_process.terminate()
            frontend_process.wait(timeout=10)
            if frontend_process.poll() is None: # Still running
                frontend_process.kill()
        except Exception as e:
            print(f"프론트엔드 종료 중 오류 발생: {e}")
        print("프론트엔드 서버 종료 완료.")
    print("애플리케이션이 종료되었습니다.")
    sys.exit(0) # 정상 종료

def main():
    global backend_process, frontend_process

    # Ctrl+C (SIGINT) 및 SIGTERM 신호 핸들러 등록
    signal.signal(signal.SIGINT, lambda s, f: terminate_processes())
    signal.signal(signal.SIGTERM, lambda s, f: terminate_processes())

    original_cwd = os.getcwd() # 현재 작업 디렉토리 저장

    # --- 백엔드 서버 시작 ---
    backend_dir = Path(__file__).parent / "backend"
    os.makedirs(backend_dir, exist_ok=True) # 디렉토리 존재 확인

    print("🚀 백엔드 서버를 시작합니다...")
    print(f"📁 백엔드 디렉토리: {backend_dir}")
    
    try:
        # 백엔드 서버 실행 (uvicorn을 직접 호출)
        backend_command = [sys.executable, "-m", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
        backend_process = subprocess.Popen(backend_command, cwd=backend_dir, 
                                           stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
        
        print("⏳ 백엔드 서버 시작 대기 중 (5초)...")
        time.sleep(5) # 백엔드가 완전히 시작될 시간을 줍니다.
        
        if backend_process.poll() is not None: # 프로세스가 이미 종료되었는지 확인
            print("❌ 백엔드 서버가 시작되지 않았거나 즉시 종료되었습니다.")
            stdout, stderr = backend_process.communicate()
            print("백엔드 STDOUT:\n", stdout)
            print("백엔드 STDERR:\n", stderr)
            terminate_processes()
            return

    except Exception as e:
        print(f"❌ 백엔드 실행 중 오류 발생: {e}")
        terminate_processes()
        return
    finally:
        os.chdir(original_cwd) # 원래 작업 디렉토리로 돌아옴

    # --- 프론트엔드 서버 시작 ---
    frontend_dir = Path(__file__).parent / "frontend"
    os.makedirs(frontend_dir, exist_ok=True) # 디렉토리 존재 확인

    print("🚀 프론트엔드 서버를 시작합니다...")
    print(f"📁 프론트엔드 디렉토리: {frontend_dir}")

    try:
        # 프론트엔드 서버 실행 (streamlit을 직접 호출)
        frontend_command = [sys.executable, "-m", "streamlit", "run", "structure_vis.py"]
        frontend_process = subprocess.Popen(frontend_command, cwd=frontend_dir, 
                                            stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
        
        print("⏳ 프론트엔드 서버 시작 대기 중 (5초)...")
        time.sleep(5) # 프론트엔드가 완전히 시작될 시간을 줍니다.

        if frontend_process.poll() is not None: # 프로세스가 이미 종료되었는지 확인
            print("❌ 프론트엔드 서버가 시작되지 않았거나 즉시 종료되었습니다.")
            stdout, stderr = frontend_process.communicate()
            print("프론트엔드 STDOUT:\n", stdout)
            print("프론트엔드 STDERR:\n", stderr)
            terminate_processes()
            return

        print("\n✅ 백엔드와 프론트엔드 서버가 성공적으로 시작되었습니다.")
        print("프론트엔드에 접속하세요: http://localhost:8501")
        print("백엔드 API 문서: http://localhost:8000/docs")
        print("종료하려면 Ctrl+C를 누르세요.")

        # 메인 스레드를 계속 실행하여 서브프로세스들이 유지되도록 함
        # 두 프로세스 중 하나라도 종료되면 메인 스레드도 종료
        while backend_process.poll() is None and frontend_process.poll() is None:
            time.sleep(1)

    except Exception as e:
        print(f"❌ 프론트엔드 실행 중 오류 발생: {e}")
        terminate_processes()
        return
    finally:
        os.chdir(original_cwd) # 원래 작업 디렉토리로 돌아옴
        terminate_processes() # 스크립트 종료 시 프로세스들이 확실히 종료되도록 함

if __name__ == "__main__":
    main() 