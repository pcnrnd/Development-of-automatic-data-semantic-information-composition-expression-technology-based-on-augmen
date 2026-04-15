from datetime import datetime
from enum import Enum
from typing import Any

from pydantic import BaseModel, Field


# ─── Monitoring ───────────────────────────────────────────────────────────────

class AlertSeverity(str, Enum):
    critical = "critical"
    warning = "warning"
    info = "info"


class Alert(BaseModel):
    id: str
    severity: AlertSeverity
    msg: str
    time: str
    is_active: bool = True


class SystemMetrics(BaseModel):
    cpu_percent: float
    memory_percent: float
    disk_io_gbps: float
    active_sessions: int
    health_score: float
    uptime_percent: float
    timestamp: datetime = Field(default_factory=datetime.utcnow)


class ThroughputPoint(BaseModel):
    label: str
    ingress: float
    egress: float


# ─── Orchestration ────────────────────────────────────────────────────────────

class PipelineStatus(str, Enum):
    running = "running"
    paused = "paused"
    idle = "idle"
    error = "error"


class Pipeline(BaseModel):
    id: str
    name: str
    status: PipelineStatus
    success_rate: float
    latency_ms: float
    active_nodes: int


class PipelineLog(BaseModel):
    time: str
    type: str
    msg: str


class WorkerStatus(str, Enum):
    primary = "primary"
    standby = "standby"
    offline = "offline"


class Worker(BaseModel):
    id: str
    name: str
    region: str
    status: WorkerStatus


class PipelineActionResponse(BaseModel):
    pipeline_id: str
    action: str
    success: bool
    message: str


# ─── Archiving ────────────────────────────────────────────────────────────────

class QueryRequest(BaseModel):
    query: str
    max_rows: int = 100


class QueryColumn(BaseModel):
    name: str
    type: str


class QueryResult(BaseModel):
    job_id: str
    status: str
    columns: list[QueryColumn]
    rows: list[dict[str, Any]]
    row_count: int
    elapsed_ms: float


class QueryJob(BaseModel):
    job_id: str
    query_preview: str
    status: str
    elapsed_ms: float
    created_at: datetime


# ─── Governance ───────────────────────────────────────────────────────────────

class DataSource(BaseModel):
    id: str
    label: str
    sub: str
    tag: str
    active: bool


class DataSourceUpdate(BaseModel):
    active: bool


class FilterCondition(BaseModel):
    field: str
    operator: str
    value: str


class FilterRule(BaseModel):
    id: str
    conditions: list[FilterCondition]
    severity: str
    active: bool = True


class FilterRuleCreate(BaseModel):
    conditions: list[FilterCondition]
    severity: str


class Destination(BaseModel):
    id: str
    label: str
    type: str
    active: bool


class GovernanceSummary(BaseModel):
    encryption: str
    retention_policy: str
    access_control: str
    health_score: float
    ingestion_throughput_gbhr: float
    data_quality_score: float
    active_alerts: int


# ─── Nodes ────────────────────────────────────────────────────────────────────

class NodeStatus(str, Enum):
    healthy = "Healthy"
    warning = "Warning"
    critical = "Critical"
    offline = "Offline"


class Node(BaseModel):
    id: str
    ip: str
    status: NodeStatus
    storage_usage_pct: int
    storage_used_gb: int
    storage_total_gb: int
    load_avg: str
    cpu_pct: float
    memory_pct: float


class ClusterRegion(BaseModel):
    label: str
    active: bool
    error: bool = False


class NodeErrorLog(BaseModel):
    type: str
    node: str
    msg: str
    timestamp: str


class NodeActionResponse(BaseModel):
    node_id: str
    action: str
    success: bool
    message: str
