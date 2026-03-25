from fastapi import Request

from app.store.in_memory import InMemoryStore


def get_store(request: Request) -> InMemoryStore:
    """FastAPI request.state에 저장된 전역 in-memory store를 반환합니다."""
    return request.state.store

