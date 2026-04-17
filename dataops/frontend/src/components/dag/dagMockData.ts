import type { PipelineDag } from '../../types/dag';

// Pipeline 1: 덕산 3상 전류·전압 실시간 모니터링 (streaming)
// 구조: 선형 + 팬아웃 (sink 2개)
const dag1: PipelineDag = {
  pipelineId: 'pipeline-1',
  nodes: [
    {
      id: 'n1-source',
      type: 'source',
      label: 'PostgreSQL 수집',
      subLabel: 'DB-PRIMARY-01',
      position: { x: 60, y: 220 },
      config: { host: 'db-primary-01.local', port: '5432', table: 'sensor_raw' },
    },
    {
      id: 'n1-transform',
      type: 'transform',
      label: 'Stream Aggregator',
      subLabel: '100ms 윈도우',
      position: { x: 300, y: 220 },
      config: { windowMs: '100', function: 'avg' },
    },
    {
      id: 'n1-validate',
      type: 'validate',
      label: 'Schema & QA Gate',
      subLabel: 'PT100 범위 검사',
      position: { x: 540, y: 220 },
      config: { schemaRef: 'sensor_v2.json', failAction: 'discard' },
    },
    {
      id: 'n1-sink-hdfs',
      type: 'sink',
      label: 'HDFS Archive',
      subLabel: '/data/deoksan/dt=*',
      position: { x: 780, y: 120 },
      config: { path: '/data/deoksan', format: 'parquet' },
    },
    {
      id: 'n1-sink-pg',
      type: 'sink',
      label: 'PostgreSQL 적재',
      subLabel: 'DB-REPLICA-02',
      position: { x: 780, y: 320 },
      config: { host: 'db-replica-02.local', table: 'sensor_agg' },
    },
  ],
  edges: [
    { id: 'e1-1', source: 'n1-source', target: 'n1-transform' },
    { id: 'e1-2', source: 'n1-transform', target: 'n1-validate' },
    { id: 'e1-3', source: 'n1-validate', target: 'n1-sink-hdfs' },
    { id: 'e1-4', source: 'n1-validate', target: 'n1-sink-pg' },
  ],
  updatedAt: new Date().toISOString(),
};

// Pipeline 2: 전력 품질 데이터 월간 아카이빙 (batch)
// 구조: 팬인 (source 2개 → filter → transform → sink)
const dag2: PipelineDag = {
  pipelineId: 'pipeline-2',
  nodes: [
    {
      id: 'n2-source-hdfs',
      type: 'source',
      label: 'HDFS 원시 데이터',
      subLabel: '/data/raw/power/*',
      position: { x: 60, y: 120 },
      config: { path: '/data/raw/power', format: 'csv' },
    },
    {
      id: 'n2-source-pg',
      type: 'source',
      label: 'PostgreSQL 메타',
      subLabel: 'DB-ANALYTICS-01',
      position: { x: 60, y: 320 },
      config: { host: 'db-analytics-01.local', table: 'power_meta' },
    },
    {
      id: 'n2-filter',
      type: 'filter',
      label: 'Threshold Filter',
      subLabel: 'VoltR > 220V 제거',
      position: { x: 300, y: 220 },
      config: { rule: 'VoltR > 220', action: 'drop' },
    },
    {
      id: 'n2-transform',
      type: 'transform',
      label: 'Parquet 변환',
      subLabel: '.csv → .parquet',
      position: { x: 540, y: 220 },
      config: { outputFormat: 'parquet', compression: 'snappy' },
    },
    {
      id: 'n2-sink',
      type: 'sink',
      label: 'Object Storage',
      subLabel: 's3://archive/monthly',
      position: { x: 780, y: 220 },
      config: { bucket: 'archive', prefix: 'monthly/', region: 'ap-northeast-2' },
    },
  ],
  edges: [
    { id: 'e2-1', source: 'n2-source-hdfs', target: 'n2-filter' },
    { id: 'e2-2', source: 'n2-source-pg', target: 'n2-filter' },
    { id: 'e2-3', source: 'n2-filter', target: 'n2-transform' },
    { id: 'e2-4', source: 'n2-transform', target: 'n2-sink' },
  ],
  updatedAt: new Date().toISOString(),
};

// Pipeline 3: 누전·전압강하 이상 감지 (streaming)
// 구조: 브랜치 (branch → 2경로)
const dag3: PipelineDag = {
  pipelineId: 'pipeline-3',
  nodes: [
    {
      id: 'n3-source',
      type: 'source',
      label: 'PostgreSQL 센서',
      subLabel: 'EQ-MOTOR-07',
      position: { x: 60, y: 220 },
      config: { host: 'db-primary-01.local', table: 'leakage_raw' },
    },
    {
      id: 'n3-filter',
      type: 'filter',
      label: '누전 감지 필터',
      subLabel: 'ΔI > 30mA',
      position: { x: 280, y: 220 },
      config: { rule: 'deltaI > 30', unit: 'mA' },
    },
    {
      id: 'n3-branch',
      type: 'branch',
      label: 'Severity Router',
      subLabel: 'Critical / Normal',
      position: { x: 500, y: 220 },
      config: { criticalThreshold: '100', normalThreshold: '30' },
    },
    {
      id: 'n3-validate',
      type: 'validate',
      label: 'Alert QA Gate',
      subLabel: '알림 중복 제거',
      position: { x: 720, y: 120 },
      config: { deduplicateWindow: '60s' },
    },
    {
      id: 'n3-sink-pg',
      type: 'sink',
      label: 'PostgreSQL 알림',
      subLabel: 'DB-ALERT-01',
      position: { x: 940, y: 120 },
      config: { host: 'db-alert-01.local', table: 'alert_log' },
    },
    {
      id: 'n3-sink-hdfs',
      type: 'sink',
      label: 'HDFS 이력',
      subLabel: '/data/leakage/*',
      position: { x: 720, y: 320 },
      config: { path: '/data/leakage', format: 'parquet' },
    },
  ],
  edges: [
    { id: 'e3-1', source: 'n3-source', target: 'n3-filter' },
    { id: 'e3-2', source: 'n3-filter', target: 'n3-branch' },
    { id: 'e3-3', source: 'n3-branch', target: 'n3-validate', label: 'Critical' },
    { id: 'e3-4', source: 'n3-validate', target: 'n3-sink-pg' },
    { id: 'e3-5', source: 'n3-branch', target: 'n3-sink-hdfs', label: 'Normal' },
  ],
  updatedAt: new Date().toISOString(),
};

export const DAG_MOCK_DATA: Record<string, PipelineDag> = {
  'pipeline-1': dag1,
  'pipeline-2': dag2,
  'pipeline-3': dag3,
};
