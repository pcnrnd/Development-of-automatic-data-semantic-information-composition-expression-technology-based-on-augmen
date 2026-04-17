import React, { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Search,
  Server,
  Settings2,
  RefreshCw,
  Loader2,
  CheckCircle2,
  X,
} from 'lucide-react';
import { Card, ProgressBar } from './ui';

type NodeStatus = 'Healthy' | 'Warning' | 'Critical';
type FilterTab  = 'All' | 'Warning' | 'Critical';
type PriorityFilter = 'All' | 'P1' | 'P2' | 'P3';

interface NodeData {
  id: string;
  ip: string;
  status: NodeStatus;
  storageUsed: number;
  storageTotal: number;
  loadAvg: string;
}

interface StoredSource {
  id: string;
  label: string;
  sub: string;
  tag: string;
  active: boolean;
}

interface StoredDestination {
  id: string;
  label: string;
  type: string;
  active: boolean;
}

interface StoredPipelineInstance {
  id: string;
  name: string;
  sourceCount: number;
  ruleCount: number;
  destinationCount: number;
  scheduleMode: 'streaming' | 'batch';
  createdAt: string;
}

interface NodeDataWithPipeline extends NodeData {
  pipelineName?: string;
}

const INITIAL_NODES: NodeData[] = [
  { id: 'SRC-POSTGRESQL', ip: 'mes-db-cluster:5432',         status: 'Healthy',  storageUsed: 620, storageTotal: 1000, loadAvg: '18ms, 22ms, 31ms' },
  { id: 'SRC-HDFS',       ip: 'hdfs://cluster-nn:8020',      status: 'Warning',  storageUsed: 870, storageTotal: 1000, loadAvg: '45ms, 58ms, 73ms' },
  { id: 'TGT-OBJECT',     ip: 's3://mes-archive/raw',         status: 'Critical', storageUsed: 980, storageTotal: 1000, loadAvg: '96ms, 121ms, 149ms' },
  { id: 'TGT-POSTGRESQL', ip: 'mes-warehouse-cluster:5432',   status: 'Healthy',  storageUsed: 510, storageTotal: 1000, loadAvg: '12ms, 17ms, 25ms' },
];
const PIPELINE_STORAGE_SOURCES_KEY = 'pipeline-storage-sources';
const PIPELINE_STORAGE_DESTINATIONS_KEY = 'pipeline-storage-destinations';
const PIPELINE_STORAGE_INSTANCES_KEY = 'pipeline-storage-instances';

function getPipelineNamesForNode(nodeId: string, instances: StoredPipelineInstance[]): string[] {
  if (nodeId.startsWith('SRC-')) {
    return instances.slice(0, 1).map(p => p.name);
  }
  if (nodeId.startsWith('TGT-')) {
    return instances.slice(0, 1).map(p => p.name);
  }
  return [];
}

function inferStatus(active: boolean, index: number): NodeStatus {
  if (!active) return 'Warning';
  if (index % 5 === 0) return 'Critical';
  return 'Healthy';
}

function buildNodesFromPipelineStorage(): NodeDataWithPipeline[] {
  try {
    const rawSources = localStorage.getItem(PIPELINE_STORAGE_SOURCES_KEY);
    const rawDestinations = localStorage.getItem(PIPELINE_STORAGE_DESTINATIONS_KEY);
    const rawInstances = localStorage.getItem(PIPELINE_STORAGE_INSTANCES_KEY);
    if (!rawSources && !rawDestinations) return INITIAL_NODES;

    const sources: StoredSource[] = rawSources ? JSON.parse(rawSources) : [];
    const destinations: StoredDestination[] = rawDestinations ? JSON.parse(rawDestinations) : [];
    const instances: StoredPipelineInstance[] = rawInstances ? JSON.parse(rawInstances) : [];
    const endpoints = [
      ...sources.map(source => ({ kind: 'SRC' as const, id: source.id, label: source.label, detail: source.sub, active: source.active })),
      ...destinations.map(destination => ({ kind: 'TGT' as const, id: destination.id, label: destination.label, detail: destination.type, active: destination.active })),
    ];

    if (endpoints.length === 0) return INITIAL_NODES;

    return endpoints.map((endpoint, index) => {
      const status = inferStatus(endpoint.active, index);
      const usedBase = status === 'Critical' ? 940 : status === 'Warning' ? 830 : 580;
      const storageUsed = Math.min(990, usedBase + (index % 3) * 25);
      const latency = status === 'Critical' ? [96, 121, 149] : status === 'Warning' ? [45, 58, 73] : [18, 22, 31];
      const safeId = endpoint.label.toUpperCase().replace(/[^A-Z0-9]+/g, '-').replace(/^-+|-+$/g, '') || `ENDPOINT-${index + 1}`;
      const nodeId = `${endpoint.kind}-${safeId}`;
      const pipelineNames = getPipelineNamesForNode(nodeId, instances);

      return {
        id: nodeId,
        ip: endpoint.detail,
        status,
        storageUsed,
        storageTotal: 1000,
        loadAvg: `${latency[0]}, ${latency[1]}, ${latency[2]}ms`,
        pipelineName: pipelineNames.length > 0 ? pipelineNames[0] : undefined,
      };
    });
  } catch {
    return INITIAL_NODES;
  }
}

/**
 * 노드 ID에서 표시용 번호(마지막 `-` 이후, 예: GU-NODE-A109 → A109)만 반환합니다.
 */
function nodeDisplaySuffix(id: string): string {
  const segs = id.split('-');
  return segs.length > 0 ? segs[segs.length - 1]! : id;
}

/**
 * 그룹에 속한 저장소 ID의 마지막 세그먼트를 모아 요약 문자열을 만듭니다.
 * 엔드포인트가 많으면 앞 두 개만 보이고 나머지는 "외 N개"로 축약합니다.
 */
function formatNodeGroupLabel(group: NodeData[]): string {
  if (group.length === 0) return '—';
  const refs = group.map(n => nodeDisplaySuffix(n.id));
  if (refs.length <= 3) return refs.join(' · ');
  return `${refs.slice(0, 2).join(' · ')} · 외 ${refs.length - 2}개`;
}

const STATUS_DOT: Record<NodeStatus, string> = {
  Healthy:  'bg-green-400',
  Warning:  'bg-yellow-400',
  Critical: 'bg-red-500 animate-pulse',
};

const STATUS_TEXT: Record<NodeStatus, string> = {
  Healthy:  'text-green-400',
  Warning:  'text-yellow-400',
  Critical: 'text-red-500',
};

const STATUS_BAR: Record<NodeStatus, string> = {
  Healthy:  'bg-accent',
  Warning:  'bg-yellow-400',
  Critical: 'bg-red-500',
};

/** 사이드 카드·전체 보기 모달에서 공통으로 쓰는 에러 로그 한 건 */
interface ErrorLogEntry {
  type: string;
  node: string;
  msg: string;
  color: string;
  text: string;
  ts: string;
  impactedNodes: number;
  state: '진행중' | '모니터링' | '해결됨';
}

const LOG_PREVIEW_COUNT = 3;

/** View All에서 스크롤로 볼 수 있는 전체 로그(데모 데이터) */
const ALL_ERROR_LOGS: ErrorLogEntry[] = [
  { type: 'CRITICAL', node: 'Object Storage Gateway', msg: 'PUT 실패율 급증 — 업로드 큐 적체로 타겟 적재 지연 발생.', color: 'border-red-500', text: 'text-red-400', ts: '2024-01-20 14:02:11', impactedNodes: 2, state: '진행중' },
  { type: 'WARN', node: 'HDFS NameNode', msg: 'HDFS 블록 복제 지연 감지 — 읽기 지연 상승 모니터링 중.', color: 'border-yellow-500', text: 'text-yellow-400', ts: '2024-01-20 13:58:02', impactedNodes: 1, state: '모니터링' },
  { type: 'INFO', node: 'PostgreSQL Source', msg: 'CDC 슬롯 지연 복구 완료 — 수집 레이턴시 정상화.', color: 'border-accent', text: 'text-accent', ts: '2024-01-20 13:45:00', impactedNodes: 0, state: '해결됨' },
  { type: 'WARN', node: 'Object Storage Lifecycle', msg: '압축 배치 대기열 증가 — 임시 저장소 사용률 주의.', color: 'border-yellow-500', text: 'text-yellow-400', ts: '2024-01-20 13:40:18', impactedNodes: 1, state: '모니터링' },
  { type: 'INFO', node: 'Pipeline Router', msg: '소스-타겟 경로 재분배 단계 2/5 완료.', color: 'border-accent', text: 'text-accent', ts: '2024-01-20 13:22:44', impactedNodes: 0, state: '해결됨' },
  { type: 'WARN', node: 'PostgreSQL Target', msg: '쓰기 TPS 임계치 근접 — 배치 윈도우 조정 권장.', color: 'border-yellow-500', text: 'text-yellow-400', ts: '2024-01-20 12:11:09', impactedNodes: 1, state: '모니터링' },
  { type: 'INFO', node: 'Storage Audit', msg: 'Object Storage 아카이빙 검증 정상 종료.', color: 'border-accent', text: 'text-accent', ts: '2024-01-20 11:05:33', impactedNodes: 0, state: '해결됨' },
  { type: 'CRITICAL', node: 'HDFS Data Path', msg: '읽기 타임아웃 반복 감지 — 대체 경로 전환 진행중.', color: 'border-red-500', text: 'text-red-400', ts: '2024-01-20 10:58:51', impactedNodes: 1, state: '진행중' },
  { type: 'INFO', node: 'PostgreSQL Target', msg: '체크포인트/인덱스 유지보수 완료.', color: 'border-accent', text: 'text-accent', ts: '2024-01-20 09:30:00', impactedNodes: 0, state: '해결됨' },
];

const FILTER_TABS: FilterTab[] = ['All', 'Warning', 'Critical'];
const PRIORITY_FILTERS: PriorityFilter[] = ['All', 'P1', 'P2', 'P3'];

export const NodeManagementView = () => {
  const [nodes, setNodes]           = useState<NodeDataWithPipeline[]>(() => buildNodesFromPipelineStorage());
  const [filter, setFilter]         = useState<FilterTab>('All');
  const [search, setSearch]         = useState('');
  const [restarting, setRestarting] = useState<string | null>(null);
  const [restarted, setRestarted]   = useState<Set<string>>(new Set());
  const [logsModalOpen, setLogsModalOpen] = useState(false);
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>('All');

  const previewLogs = ALL_ERROR_LOGS.slice(0, LOG_PREVIEW_COUNT);
  const statusRank: Record<NodeStatus, number> = { Critical: 0, Warning: 1, Healthy: 2 };

  useEffect(() => {
    if (!logsModalOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setLogsModalOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [logsModalOpen]);

  useEffect(() => {
    const syncFromPipeline = () => setNodes(buildNodesFromPipelineStorage());
    window.addEventListener('pipeline-storage-updated', syncFromPipeline);
    window.addEventListener('focus', syncFromPipeline);
    return () => {
      window.removeEventListener('pipeline-storage-updated', syncFromPipeline);
      window.removeEventListener('focus', syncFromPipeline);
    };
  }, []);

  const nodePriority = (node: NodeData): Exclude<PriorityFilter, 'All'> => {
    const pct = Math.round((node.storageUsed / node.storageTotal) * 100);
    if (node.status === 'Critical' || pct >= 90) return 'P1';
    if (node.status === 'Warning' || pct >= 80) return 'P2';
    return 'P3';
  };

  const priorityCounts = useMemo(() => ({
    P1: nodes.filter(node => nodePriority(node) === 'P1').length,
    P2: nodes.filter(node => nodePriority(node) === 'P2').length,
    P3: nodes.filter(node => nodePriority(node) === 'P3').length,
  }), [nodes]);

  const filteredNodes = useMemo(() => nodes
    .filter(n => {
      const matchFilter = filter === 'All' || n.status === filter;
      const matchPriority = priorityFilter === 'All' || nodePriority(n) === priorityFilter;
      const q = search.toLowerCase();
      return matchFilter && matchPriority && (!q || n.id.toLowerCase().includes(q) || n.ip.includes(q));
    })
    .sort((a, b) => {
      const byStatus = statusRank[a.status] - statusRank[b.status];
      if (byStatus !== 0) return byStatus;
      const storagePctA = Math.round((a.storageUsed / a.storageTotal) * 100);
      const storagePctB = Math.round((b.storageUsed / b.storageTotal) * 100);
      return storagePctB - storagePctA;
    }), [nodes, filter, search, priorityFilter]);

  const counts = useMemo(() => ({
    all:      nodes.length,
    warning:  nodes.filter(n => n.status === 'Warning').length,
    critical: nodes.filter(n => n.status === 'Critical').length,
  }), [nodes]);

  const restartNode = (nodeId: string) => {
    if (restarting) return;
    setRestarting(nodeId);
    setTimeout(() => {
      setNodes(prev => prev.map(n =>
        n.id === nodeId
          ? { ...n, status: 'Healthy', storageUsed: Math.max(n.storageUsed - 200, 400), loadAvg: '0.20, 0.15, 0.10' }
          : n
      ));
      setRestarted(prev => new Set(prev).add(nodeId));
      setRestarting(null);
      setTimeout(() => setRestarted(prev => { const s = new Set(prev); s.delete(nodeId); return s; }), 2000);
    }, 2200);
  };

  const storageUsagePct = (n: NodeData) => Math.round((n.storageUsed / n.storageTotal) * 100);

  const healthFactors = useMemo(() => {
    const avgStorageUsage = nodes.reduce((sum, node) => sum + storageUsagePct(node), 0) / Math.max(nodes.length, 1);
    const avgLatencyMs = nodes.reduce((sum, node) => sum + Number.parseFloat(node.loadAvg.split(',')[0] ?? '0'), 0) / Math.max(nodes.length, 1);
    const eventPenalty = counts.critical * 20 + counts.warning * 8;

    // 저장소 레이턴시를 0~100 점수로 정규화합니다. (0ms=100, 150ms 이상=0)
    const storageScore = Math.max(0, 100 - avgStorageUsage);
    const latencyScore = Math.max(0, 100 - (avgLatencyMs / 150) * 100);
    const eventScore = Math.max(0, 100 - eventPenalty);
    const overall = storageScore * 0.4 + latencyScore * 0.4 + eventScore * 0.2;

    return {
      storageScore,
      latencyScore,
      avgLatencyMs,
      eventScore,
      overall: overall.toFixed(1),
    };
  }, [nodes, counts.critical, counts.warning]);

  const siteSummaries = useMemo(() => {
    const buckets = [
      { key: 'source', title: '소스 저장소 그룹', pred: (id: string) => id.startsWith('SRC-') },
      { key: 'target', title: '타겟 저장소 그룹', pred: (id: string) => id.startsWith('TGT-') },
    ];
    return buckets.map(b => {
      const group = nodes.filter(n => b.pred(n.id));
      const members = formatNodeGroupLabel(group);
      const worst: NodeStatus = group.some(n => n.status === 'Critical') ? 'Critical'
        : group.some(n => n.status === 'Warning') ? 'Warning' : 'Healthy';
      const avgStorage = group.length === 0
        ? 0
        : Math.round(group.reduce((s, n) => s + storageUsagePct(n), 0) / group.length);
      const priority = worst === 'Critical' || avgStorage >= 90 ? 'P1'
        : worst === 'Warning' || avgStorage >= 80 ? 'P2'
        : 'P3';
      return { key: b.key, title: b.title, members, nodes: group, worst, avgStorage, count: group.length, priority };
    });
  }, [nodes]);

  const healthScoreNum = parseFloat(healthFactors.overall);

  return (
    <div className="space-y-8">
      <header className="flex justify-between items-center">
        <div className="flex items-center gap-8">
          <h2 className="text-2xl font-bold text-text-bright font-headline tracking-tight">저장소 상태 모니터링</h2>
          <div className="relative group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-muted" />
            <input
              className="bg-surface-card border-none rounded-xl pl-10 pr-4 py-2 text-xs text-text-bright focus:ring-1 focus:ring-accent w-64 transition-all placeholder:text-surface-muted"
              placeholder="저장소 ID 또는 엔드포인트 검색..."
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        </div>
      </header>

      <div className="grid grid-cols-12 gap-6">
        {/* Global Health */}
        <Card className="col-span-12 lg:col-span-4 flex flex-col justify-between">
          <div>
            <p className="text-surface-muted font-medium text-xs uppercase tracking-wide mb-2">Storage Health Score</p>
            <p className="text-[11px] text-surface-muted font-medium leading-snug tracking-normal mb-3">
              소스/타겟 저장소 상태 기반 <span className="text-text-dim">요약 점수</span>입니다. 사용률·지연·이벤트는 아래 목록·로그에서 확인하세요.
            </p>
            <p className="text-[10px] text-surface-muted/90 mb-3">
              계산식: 스토리지 40% + 지연 40% + 이벤트 20%
            </p>
            <motion.h3
              key={healthFactors.overall}
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              className="text-4xl font-bold text-accent leading-none mb-4 font-headline"
            >
              {healthFactors.overall}<span className="text-lg opacity-60 ml-1">%</span>
            </motion.h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="text-text-dim">스토리지 안정성</span>
                <span className={`font-bold ${healthScoreNum >= 90 ? 'text-green-400' : healthScoreNum >= 70 ? 'text-yellow-400' : 'text-red-400'}`}>
                  {healthScoreNum >= 90 ? '최상' : healthScoreNum >= 70 ? '경고' : '위험'}
                </span>
              </div>
              <ProgressBar value={healthScoreNum} color="bg-gradient-to-r from-accent to-blue-300" height="h-1.5" />
              <div className="grid grid-cols-3 gap-2 text-[10px] text-surface-muted">
                <span>스토리지 {healthFactors.storageScore.toFixed(0)}</span>
                <span>지연 {healthFactors.latencyScore.toFixed(0)}</span>
                <span>이벤트 {healthFactors.eventScore.toFixed(0)}</span>
              </div>
              <p className="text-[10px] text-surface-muted/90">
                평균 지연(p95): {healthFactors.avgLatencyMs.toFixed(1)}ms
              </p>
            </div>
          </div>
          <div className="mt-6 pt-4 border-t border-white/5">
            <p className="text-[11px] text-surface-muted font-medium tracking-normal">
              Critical {counts.critical} · Warning {counts.warning} · Healthy {counts.all - counts.critical - counts.warning}
            </p>
          </div>
        </Card>

        {/* Site Summary */}
        <Card className="col-span-12 lg:col-span-8 relative overflow-hidden">
          <div className="flex flex-wrap justify-between items-start gap-3 mb-5">
            <div>
              <h3 className="text-sm font-semibold text-text-bright tracking-normal">소스/타겟 저장소 요약</h3>
              <p className="text-xs text-surface-muted font-medium mt-1 tracking-normal">
                Endpoint List와 동일 집계 · 그룹별 최악 상태·평균 사용률
              </p>
            </div>
            <span className="px-3 py-1 bg-primary rounded-md text-[11px] text-accent font-semibold border border-accent/20 tabular-nums">
              {nodes.length} endpoints · {siteSummaries.length} 그룹
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {siteSummaries.map(site => (
              <div key={site.key} className="rounded-xl bg-primary/50 border border-white/5 p-5 flex flex-col gap-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-text-bright tracking-normal">{site.title}</span>
                  <div className="flex items-center gap-2">
                    <span className={`text-[11px] font-semibold uppercase tracking-wide ${STATUS_TEXT[site.worst]}`}>{site.worst}</span>
                    <span className={`px-2 py-0.5 rounded-md text-[10px] font-semibold ${
                      site.priority === 'P1' ? 'bg-red-500/20 text-red-300'
                        : site.priority === 'P2' ? 'bg-yellow-500/20 text-yellow-300'
                        : 'bg-white/10 text-surface-muted'
                    }`}>
                      {site.priority}
                    </span>
                  </div>
                </div>
                <p className="text-[11px] text-surface-muted font-medium tabular-nums">
                  엔드포인트 {site.count}개 · 평균 사용률 {site.avgStorage}%
                </p>
                <p className="text-[11px] text-text-dim font-medium tabular-nums">
                  구성: {site.members}
                </p>
                <ProgressBar value={site.avgStorage} color={STATUS_BAR[site.worst]} height="h-1.5" animated={false} />
                <p className="text-[10px] text-surface-muted leading-snug">
                  저장소 상세는 아래 목록에서 확인. 이 카드는 그룹 단위 집계만 표시합니다.
                </p>
              </div>
            ))}
          </div>
        </Card>

        {/* Endpoint List */}
        <Card noPadding className="col-span-12 lg:col-span-9 overflow-hidden">
          <div className="p-6 border-b border-white/5 space-y-3">
            <div className="flex justify-between items-center">
              <h3 className="text-sm font-semibold text-text-bright tracking-normal">Storage Endpoint List</h3>
              <div className="flex gap-4 text-xs font-semibold uppercase tracking-wide">
                {FILTER_TABS.map(tab => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setFilter(tab)}
                    className={`transition-colors ${filter === tab ? 'text-accent' : 'text-surface-muted hover:text-text-bright'}`}
                  >
                    {tab} ({tab === 'All' ? counts.all : tab === 'Warning' ? counts.warning : counts.critical})
                  </button>
                ))}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {PRIORITY_FILTERS.map(level => {
                const count = level === 'All' ? counts.all : priorityCounts[level];
                return (
                  <button
                    key={level}
                    type="button"
                    onClick={() => setPriorityFilter(level)}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-semibold border transition-colors ${
                      priorityFilter === level
                        ? level === 'P1'
                          ? 'border-red-500/40 bg-red-500/15 text-red-300'
                          : level === 'P2'
                            ? 'border-yellow-500/40 bg-yellow-500/15 text-yellow-300'
                            : level === 'P3'
                              ? 'border-white/20 bg-white/10 text-text-bright'
                              : 'border-accent/35 bg-accent/10 text-accent'
                        : 'border-white/10 bg-primary/60 text-surface-muted hover:text-text-bright hover:border-accent/30'
                    }`}
                  >
                    {level} ({count})
                  </button>
                );
              })}
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="text-[11px] uppercase tracking-wide text-surface-muted bg-primary/30">
                  {['Storage ID / Endpoint', 'Status', 'Capacity Usage', 'Latency p95', 'Actions'].map((h, i) => (
                    <th key={h} className={`px-6 py-4 font-semibold ${i === 4 ? 'text-right' : ''}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                <AnimatePresence>
                  {filteredNodes.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-8 text-center text-xs text-surface-muted">검색 결과가 없습니다</td>
                    </tr>
                  ) : (
                    filteredNodes.map(node => {
                      const pct         = storageUsagePct(node);
                      const isCritical  = node.status === 'Critical';
                      const isRestarting = restarting === node.id;
                      const isDone       = restarted.has(node.id);
                      return (
                        <motion.tr
                          key={node.id}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          className="hover:bg-white/5 transition-colors group"
                        >
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded bg-primary flex items-center justify-center border border-white/5">
                                <Server className={`w-4 h-4 ${isCritical ? 'text-red-500' : 'text-accent'}`} />
                              </div>
                              <div>
                                <p className="font-mono text-xs font-bold text-text-bright" title={node.id}>
                                  {nodeDisplaySuffix(node.id)}
                                </p>
                                <p className="text-[11px] text-surface-muted font-medium">{node.ip}</p>
                                {node.pipelineName && (
                                  <p className="text-[10px] text-accent font-medium mt-0.5">Pipeline: {node.pipelineName}</p>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <span className={`flex items-center gap-2 text-xs font-semibold uppercase tracking-wide ${STATUS_TEXT[node.status]}`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${STATUS_DOT[node.status]}`} />
                              {node.status}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <div className="w-32">
                              <div className={`flex justify-between text-[11px] mb-1 font-semibold ${isCritical ? 'text-red-400' : 'text-text-dim'}`}>
                                <span>{pct}%</span>
                                <span>{node.storageUsed}GB / {node.storageTotal}GB</span>
                              </div>
                              <ProgressBar value={pct} color={STATUS_BAR[node.status]} height="h-1" />
                            </div>
                          </td>
                          <td className="px-6 py-4 font-mono text-xs text-surface-muted">{node.loadAvg}</td>
                          <td className="px-6 py-4 text-right">
                            <button
                              type="button"
                              onClick={() => restartNode(node.id)}
                              disabled={!!restarting || node.status === 'Healthy'}
                              className={`p-2 rounded-lg transition-colors ${
                                isRestarting || isDone ? '' :
                                node.status === 'Healthy' ? 'text-surface-muted/30 cursor-default' :
                                isCritical ? 'hover:bg-red-500/10 text-red-500' : 'hover:bg-white/10 text-surface-muted'
                              }`}
                              title={node.status === 'Healthy' ? '정상 상태' : '연결 재시도'}
                            >
                              {isRestarting ? <Loader2 className="w-4 h-4 animate-spin text-accent" />
                                : isDone ? <CheckCircle2 className="w-4 h-4 text-green-400" />
                                : <Settings2 className="w-4 h-4" />}
                            </button>
                          </td>
                        </motion.tr>
                      );
                    })
                  )}
                </AnimatePresence>
              </tbody>
            </table>
          </div>
        </Card>

        {/* Balancing & Logs */}
        <div className="col-span-12 lg:col-span-3 space-y-6">
          <Card className="border-l-4 border-accent !rounded-xl">
            <h3 className="text-xs font-semibold mb-2 flex items-center justify-between tracking-wide uppercase">
              Path Balancing
              <RefreshCw className="w-3 h-3 text-accent" />
            </h3>
            <p className="text-[10px] text-surface-muted font-medium leading-snug mb-5 tracking-normal">
              소스→타겟 경로 재분배 진행률(파이프라인 작업). 저장소별 사용률과는 별개 지표입니다.
            </p>
            <div className="relative h-24 flex items-center justify-center mb-6">
              <svg className="w-20 h-20 transform -rotate-90">
                <circle className="text-primary" cx="40" cy="40" fill="transparent" r="36" stroke="currentColor" strokeWidth="4" />
                <circle className="text-accent" cx="40" cy="40" fill="transparent" r="36" stroke="currentColor" strokeDasharray="226.2" strokeDashoffset="60" strokeWidth="4" />
              </svg>
              <div className="absolute text-center">
                <span className="text-xl font-bold text-text-bright font-headline">74%</span>
              </div>
            </div>
            <p className="text-xs text-center text-surface-muted font-medium leading-relaxed tracking-normal">
              현재 경로 재분배 작업이 진행 중입니다. 파이프라인 지연 영향은 낮음으로 유지됩니다.
            </p>
          </Card>

          <Card className="flex-1 flex flex-col">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xs font-semibold uppercase tracking-wide">Error Logs</h3>
              <button
                type="button"
                className="text-xs text-accent font-medium tracking-normal hover:underline"
                onClick={() => setLogsModalOpen(true)}
              >
                View All
              </button>
            </div>
            <div className="space-y-4 overflow-y-auto pr-2 custom-scrollbar">
              {previewLogs.map((log, i) => (
                <div key={`${log.ts}-${i}`} className={`bg-primary/50 p-3 rounded-lg text-[11px] border-l-2 ${log.color} border-y border-r border-white/5`}>
                  <p className={`font-mono font-semibold mb-1 ${log.text}`}>[{log.type}] {log.node}</p>
                  <p className="text-text-dim font-medium tracking-normal">{log.msg}</p>
                  <div className="mt-2 flex items-center justify-between gap-2 text-[10px]">
                    <p className="opacity-40 font-medium">{log.ts}</p>
                    <p className="text-surface-muted">
                      영향 {log.impactedNodes}개 저장소 · {log.state}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>

      <AnimatePresence>
        {logsModalOpen && (
          <motion.div
            key="error-logs-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="error-logs-modal-title"
            className="fixed inset-0 z-[60] flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <button
              type="button"
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              aria-label="로그 창 닫기"
              onClick={() => setLogsModalOpen(false)}
            />
            <motion.div
              className="relative z-10 w-full max-w-lg rounded-xl border border-white/10 bg-surface-card shadow-xl flex flex-col max-h-[85vh]"
              initial={{ scale: 0.96, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.96, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            >
              <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-white/5 shrink-0">
                <h2 id="error-logs-modal-title" className="text-sm font-semibold text-text-bright tracking-normal">
                  전체 로그 <span className="text-surface-muted font-normal tabular-nums">({ALL_ERROR_LOGS.length})</span>
                </h2>
                <button
                  type="button"
                  className="p-2 rounded-lg text-surface-muted hover:text-text-bright hover:bg-white/5 transition-colors"
                  aria-label="닫기"
                  onClick={() => setLogsModalOpen(false)}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="overflow-y-auto custom-scrollbar p-4 space-y-3 min-h-0 max-h-[min(70vh,28rem)]">
                {ALL_ERROR_LOGS.map((log, i) => (
                  <div key={`modal-${log.ts}-${i}`} className={`bg-primary/50 p-3 rounded-lg text-[11px] border-l-2 ${log.color} border-y border-r border-white/5`}>
                    <p className={`font-mono font-semibold mb-1 ${log.text}`}>[{log.type}] {log.node}</p>
                    <p className="text-text-dim font-medium tracking-normal">{log.msg}</p>
                    <div className="mt-2 flex items-center justify-between gap-2 text-[10px]">
                      <p className="opacity-40 font-medium">{log.ts}</p>
                      <p className="text-surface-muted">
                        영향 {log.impactedNodes}개 저장소 · {log.state}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
