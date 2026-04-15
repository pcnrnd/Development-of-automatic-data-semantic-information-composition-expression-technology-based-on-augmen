"""인메모리 상태 저장소 — 제조 센서 데이터 특화 프로토타이핑."""
import uuid
from datetime import datetime

from models.schemas import (
    Alert,
    AlertSeverity,
    ClusterRegion,
    DataSource,
    Destination,
    FilterCondition,
    FilterRule,
    Node,
    NodeErrorLog,
    NodeStatus,
    Pipeline,
    PipelineLog,
    PipelineStatus,
    QueryJob,
    Worker,
    WorkerStatus,
)


# ─── Monitoring ───────────────────────────────────────────────────────────────

ALERTS: list[Alert] = [
    Alert(id="AL-992", severity=AlertSeverity.critical,
          msg="EQ-PUMP-03 PT100 온도 초과 (92.4°C > 85°C 임계값)", time="2m ago"),
    Alert(id="AL-991", severity=AlertSeverity.warning,
          msg="EQ-MOTOR-07 3상 전류 불균형 감지 (R/S/T 편차 > 5%)", time="18m ago"),
    Alert(id="AL-990", severity=AlertSeverity.warning,
          msg="EQ-COMP-02 진동(Vibra) 이상 — 0.18g (정상 범위 0.2–2.0g 이탈)", time="35m ago"),
    Alert(id="AL-989", severity=AlertSeverity.info,
          msg="덕산공장 센서 데이터 수집 파이프라인 정기 체크포인트 완료", time="1h ago"),
]


# ─── Orchestration ────────────────────────────────────────────────────────────

PIPELINES: dict[str, Pipeline] = {
    "sensor-ingest": Pipeline(
        id="sensor-ingest",
        name="제조 센서 실시간 수집 파이프라인",
        status=PipelineStatus.running,
        success_rate=99.97,
        latency_ms=8.2,
        active_nodes=1248,
    ),
    "aug-batch": Pipeline(
        id="aug-batch",
        name="데이터 증강 배치 처리 파이프라인",
        status=PipelineStatus.idle,
        success_rate=98.85,
        latency_ms=340.0,
        active_nodes=32,
    ),
}

PIPELINE_LOGS: list[PipelineLog] = [
    PipelineLog(time="14:22:01.04", type="INFO",
                msg="센서 데이터 수집 시작: EQ-MOTOR-07, EQ-PUMP-03, EQ-COMP-02 (100ms 인터벌)"),
    PipelineLog(time="14:22:03.18", type="WARN",
                msg="EQ-MOTOR-07 currT 채널 순간 지연 감지 (18ms 초과)."),
    PipelineLog(time="14:22:05.42", type="INFO",
                msg="품질 검증 통과 — 배치 #429 (레코드 12,800건, 이상값 0건)."),
    PipelineLog(time="14:22:10.99", type="INFO",
                msg="파티션 커밋 완료. TX-99238-K-82 (파티션: plant=deoksan/dt=2024-01-20)."),
    PipelineLog(time="14:22:12.11", type="INFO",
                msg="노드간 복제 동기화 완료 — HDFS 복제팩터 3 유지 중."),
]

WORKERS: list[Worker] = [
    Worker(id="w-kr-gumi", name="Worker-KR-Gumi", region="KR-GUMI", status=WorkerStatus.primary),
    Worker(id="w-kr-changwon", name="Worker-KR-Changwon", region="KR-CHANGWON", status=WorkerStatus.standby),
]


# ─── Archiving ────────────────────────────────────────────────────────────────

QUERY_JOBS: list[QueryJob] = []


# ─── Governance ───────────────────────────────────────────────────────────────

DATA_SOURCES: dict[str, DataSource] = {
    "mqtt": DataSource(
        id="mqtt", label="현장 센서 (MQTT)",
        sub="Broker: 10.0.0.45 | 토픽: factory/+/sensor/#",
        tag="MQTT", active=True,
    ),
    "opcua": DataSource(
        id="opcua", label="SCADA / OPC-UA",
        sub="Endpoint: opc.tcp://scada-srv:4840 | 노드: 전동기·펌프·압축기",
        tag="OPC-UA", active=True,
    ),
    "sql": DataSource(
        id="sql", label="MES 마스터 데이터",
        sub="PostgreSQL: mes-db-cluster (설비 코드·공정 정보)",
        tag="SQL", active=False,
    ),
}

FILTER_RULES: dict[str, FilterRule] = {
    "rule-1": FilterRule(
        id="rule-1",
        conditions=[
            FilterCondition(field="PT100", operator=">", value="85.0"),
            FilterCondition(field="Vibra", operator="<", value="0.2"),
        ],
        severity="Critical",
    ),
    "rule-2": FilterRule(
        id="rule-2",
        conditions=[
            FilterCondition(field="curr", operator=">", value="250.0"),
            FilterCondition(field="Ground", operator=">", value="5.0"),
        ],
        severity="Critical",
    ),
    "rule-3": FilterRule(
        id="rule-3",
        conditions=[
            FilterCondition(field="VoltR", operator="<", value="200.0"),
            FilterCondition(field="VoltS", operator="<", value="200.0"),
        ],
        severity="Warning",
    ),
}

DESTINATIONS: list[Destination] = [
    Destination(id="hdfs", label="HDFS 콜드 아카이브", type="storage", active=True),
    Destination(id="mes", label="MES 실시간 피드", type="mes", active=True),
    Destination(id="historian", label="SCADA Historian", type="historian", active=True),
    Destination(id="adl", label="Azure Data Lake (백업)", type="cloud", active=False),
]


# ─── Nodes ────────────────────────────────────────────────────────────────────

NODES: dict[str, Node] = {
    "GU-NODE-A109": Node(
        id="GU-NODE-A109", ip="192.168.1.109", status=NodeStatus.healthy,
        storage_usage_pct=62, storage_used_gb=620, storage_total_gb=1000,
        load_avg="0.14, 0.09, 0.06", cpu_pct=14.0, memory_pct=36.0,
    ),
    "GU-NODE-B221": Node(
        id="GU-NODE-B221", ip="192.168.2.221", status=NodeStatus.warning,
        storage_usage_pct=87, storage_used_gb=870, storage_total_gb=1000,
        load_avg="2.45, 1.89, 1.45", cpu_pct=66.0, memory_pct=81.0,
    ),
    "CW-NODE-C004": Node(
        id="CW-NODE-C004", ip="192.168.3.004", status=NodeStatus.critical,
        storage_usage_pct=98, storage_used_gb=980, storage_total_gb=1000,
        load_avg="8.90, 7.50, 6.20", cpu_pct=94.0, memory_pct=96.0,
    ),
    "CW-NODE-D015": Node(
        id="CW-NODE-D015", ip="192.168.4.015", status=NodeStatus.healthy,
        storage_usage_pct=51, storage_used_gb=510, storage_total_gb=1000,
        load_avg="0.08, 0.07, 0.06", cpu_pct=9.0, memory_pct=28.0,
    ),
}

CLUSTER_REGIONS: list[ClusterRegion] = [
    ClusterRegion(label="KR-GUMI-01", active=True),
    ClusterRegion(label="KR-CHANGWON-01", active=True),
    ClusterRegion(label="KR-INCHEON-02", active=True),
    ClusterRegion(label="KR-ULSAN-03", active=False, error=True),
]

NODE_ERROR_LOGS: list[NodeErrorLog] = [
    NodeErrorLog(type="CRITICAL", node="CW-NODE-C004",
                 msg="센서 블록 재구성 실패 — EQ-PUMP-03 데이터 손상 감지.",
                 timestamp="2024-01-20 14:02:11"),
    NodeErrorLog(type="WARN", node="Replication Manager",
                 msg="복제 부족 블록 감지 (under-replicated: 12블록) — 재복제 진행 중.",
                 timestamp="2024-01-20 14:05:33"),
    NodeErrorLog(type="INFO", node="NameNode Service",
                 msg="정기 스냅샷 완료 — sensors.deoksan_equipment 파티션 2024-01-20.",
                 timestamp="2024-01-20 14:10:01"),
]
