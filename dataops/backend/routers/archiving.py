"""아카이빙 라우터 — HiveQL 실행(mock) + 작업 이력 (제조 센서 데이터 특화)."""
import random
import time
import uuid
from datetime import datetime, timedelta

from fastapi import APIRouter, HTTPException

from models.schemas import QueryJob, QueryRequest, QueryResult, QueryColumn
from services import store

router = APIRouter(prefix="/api/archiving", tags=["archiving"])

# ─── 제조 센서 컬럼 정의 (deoksan 데이터셋 기준) ─────────────────────────────

_SENSOR_COLUMNS = [
    QueryColumn(name="time",    type="TIMESTAMP"),
    QueryColumn(name="curr",    type="FLOAT"),   # 전류 (A)
    QueryColumn(name="currR",   type="FLOAT"),   # R상 전류 (A)
    QueryColumn(name="currS",   type="FLOAT"),   # S상 전류 (A)
    QueryColumn(name="currT",   type="FLOAT"),   # T상 전류 (A)
    QueryColumn(name="Ground",  type="FLOAT"),   # 지락 전류 (A)
    QueryColumn(name="PT100",   type="FLOAT"),   # 온도 (°C)
    QueryColumn(name="Vibra",   type="FLOAT"),   # 진동 가속도 (g)
    QueryColumn(name="Volt",    type="FLOAT"),   # 전압 (V)
    QueryColumn(name="VoltR",   type="FLOAT"),   # R상 전압 (V)
    QueryColumn(name="VoltS",   type="FLOAT"),   # S상 전압 (V)
    QueryColumn(name="VoltT",   type="FLOAT"),   # T상 전압 (V)
]


def _mock_sensor_rows(n: int, start_ts: datetime | None = None) -> list[dict]:
    """deoksan 센서 범위를 참고한 현실적인 Mock 데이터 생성."""
    base_ts = start_ts or datetime(2021, 4, 1, 0, 0, 0)
    rows = []
    for i in range(n):
        ts = base_ts + timedelta(milliseconds=i * 100)
        # 3상 전류/전압 정상 범위 기반 (deoksan chunk 참고)
        volt_base = round(random.uniform(218.0, 226.0), 1)
        curr_base = round(random.uniform(210.0, 230.0), 1)
        rows.append({
            "time":   ts.strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3],
            "curr":   round(curr_base + random.uniform(-3, 3), 1),
            "currR":  round(curr_base + random.uniform(-2, 2), 1),
            "currS":  round(curr_base + random.uniform(-2, 2), 1),
            "currT":  round(curr_base + random.uniform(-2, 2), 1),
            "Ground": round(random.uniform(220.0, 224.0), 1),
            "PT100":  round(random.uniform(60.0, 80.0), 1),
            "Vibra":  round(random.uniform(0.3, 1.5), 3),
            "Volt":   round(volt_base + random.uniform(-1, 1), 1),
            "VoltR":  round(volt_base + random.uniform(-1.5, 1.5), 1),
            "VoltS":  round(volt_base + random.uniform(-1.5, 1.5), 1),
            "VoltT":  round(volt_base + random.uniform(-1.5, 1.5), 1),
        })
    return rows


# ─── REST ─────────────────────────────────────────────────────────────────────

@router.post("/query", response_model=QueryResult)
def execute_query(req: QueryRequest):
    """HiveQL 쿼리 실행 (Mock — 제조 센서 스키마 기반 결과 반환)."""
    query = req.query.strip()
    if not query:
        raise HTTPException(status_code=400, detail="Query must not be empty")

    start = time.perf_counter()
    time.sleep(random.uniform(0.1, 0.4))
    elapsed = (time.perf_counter() - start) * 1000

    row_count = min(req.max_rows, random.randint(10, req.max_rows))
    job_id = f"JOB-{uuid.uuid4().hex[:8].upper()}"

    result = QueryResult(
        job_id=job_id,
        status="SUCCESS",
        columns=_SENSOR_COLUMNS,
        rows=_mock_sensor_rows(row_count),
        row_count=row_count,
        elapsed_ms=round(elapsed, 2),
    )

    store.QUERY_JOBS.append(
        QueryJob(
            job_id=job_id,
            query_preview=query[:80],
            status="SUCCESS",
            elapsed_ms=round(elapsed, 2),
            created_at=datetime.utcnow(),
        )
    )

    return result


@router.get("/jobs", response_model=list[QueryJob])
def get_jobs(limit: int = 20):
    """최근 쿼리 실행 이력."""
    return list(reversed(store.QUERY_JOBS))[:limit]


@router.delete("/jobs/{job_id}", status_code=204)
def delete_job(job_id: str):
    original_len = len(store.QUERY_JOBS)
    store.QUERY_JOBS[:] = [j for j in store.QUERY_JOBS if j.job_id != job_id]
    if len(store.QUERY_JOBS) == original_len:
        raise HTTPException(status_code=404, detail="Job not found")
