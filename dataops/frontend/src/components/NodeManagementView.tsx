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
import { Card, ProgressBar, Metric } from './ui';

type NodeStatus = 'Healthy' | 'Warning' | 'Critical';
type FilterTab  = 'All' | 'Warning' | 'Critical';

interface NodeData {
  id: string;
  ip: string;
  status: NodeStatus;
  storageUsed: number;
  storageTotal: number;
  loadAvg: string;
}

const INITIAL_NODES: NodeData[] = [
  { id: 'GU-NODE-A109', ip: '192.168.1.109', status: 'Healthy',  storageUsed: 620, storageTotal: 1000, loadAvg: '0.14, 0.09, 0.06' },
  { id: 'GU-NODE-B221', ip: '192.168.2.221', status: 'Warning',  storageUsed: 870, storageTotal: 1000, loadAvg: '2.45, 1.89, 1.45' },
  { id: 'CW-NODE-C004', ip: '192.168.3.004', status: 'Critical', storageUsed: 980, storageTotal: 1000, loadAvg: '8.90, 7.50, 6.20' },
  { id: 'CW-NODE-D015', ip: '192.168.4.015', status: 'Healthy',  storageUsed: 510, storageTotal: 1000, loadAvg: '0.08, 0.07, 0.06' },
];

/**
 * 노드 ID에서 표시용 번호(마지막 `-` 이후, 예: GU-NODE-A109 → A109)만 반환합니다.
 */
function nodeDisplaySuffix(id: string): string {
  const segs = id.split('-');
  return segs.length > 0 ? segs[segs.length - 1]! : id;
}

/**
 * 그룹에 속한 노드 ID의 마지막 세그먼트(예: GU-NODE-A109 → A109)를 모아 카드 제목 문자열을 만듭니다.
 * 노드가 많으면 앞 두 개만 보이고 나머지는 "외 N대"로 축약합니다.
 */
function formatNodeGroupLabel(group: NodeData[]): string {
  if (group.length === 0) return '—';
  const refs = group.map(n => nodeDisplaySuffix(n.id));
  if (refs.length <= 3) return refs.join(' · ');
  return `${refs.slice(0, 2).join(' · ')} · 외 ${refs.length - 2}대`;
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
}

const LOG_PREVIEW_COUNT = 3;

/** View All에서 스크롤로 볼 수 있는 전체 로그(데모 데이터) */
const ALL_ERROR_LOGS: ErrorLogEntry[] = [
  { type: 'CRITICAL', node: 'NameNode HA', msg: 'Journal 동기화 지연 — 메타데이터 쓰기 큐 적체. 노드 단위 이슈는 목록의 Status·스토리지를 확인하세요.', color: 'border-red-500', text: 'text-red-400', ts: '2024-01-20 14:02:11' },
  { type: 'WARN', node: 'Replication Mgr', msg: '복제 부족 블록 12개 감지 — 재복제 진행 중.', color: 'border-yellow-500', text: 'text-yellow-400', ts: '2024-01-20 13:58:02' },
  { type: 'INFO', node: 'NameNode Service', msg: '정기 스냅샷 완료 — sensors.deoksan_equipment 2024-01-20.', color: 'border-accent', text: 'text-accent', ts: '2024-01-20 13:45:00' },
  { type: 'WARN', node: 'DataNode C004', msg: '디스크 I/O 대기 시간 상승 — 해당 노드 스토리지 사용률이 높습니다.', color: 'border-yellow-500', text: 'text-yellow-400', ts: '2024-01-20 13:40:18' },
  { type: 'INFO', node: 'Balancer', msg: '클러스터 재균형 단계 2/5 완료.', color: 'border-accent', text: 'text-accent', ts: '2024-01-20 13:22:44' },
  { type: 'WARN', node: 'ZK Ensemble', msg: '세션 타임아웃 임계치 근접 — 연결 수 모니터링 권장.', color: 'border-yellow-500', text: 'text-yellow-400', ts: '2024-01-20 12:11:09' },
  { type: 'INFO', node: 'Audit', msg: '접근 로그 아카이빙 배치 정상 종료.', color: 'border-accent', text: 'text-accent', ts: '2024-01-20 11:05:33' },
  { type: 'CRITICAL', node: 'DataNode C004', msg: '블록 손상 의심 블록 2개 격리 — 자동 복구 큐에 등록됨.', color: 'border-red-500', text: 'text-red-400', ts: '2024-01-20 10:58:51' },
  { type: 'INFO', node: 'NameNode Service', msg: '메타데이터 체크포인트 저장 완료.', color: 'border-accent', text: 'text-accent', ts: '2024-01-20 09:30:00' },
];

const FILTER_TABS: FilterTab[] = ['All', 'Warning', 'Critical'];

export const NodeManagementView = () => {
  const [nodes, setNodes]           = useState<NodeData[]>(INITIAL_NODES);
  const [filter, setFilter]         = useState<FilterTab>('All');
  const [search, setSearch]         = useState('');
  const [restarting, setRestarting] = useState<string | null>(null);
  const [restarted, setRestarted]   = useState<Set<string>>(new Set());
  const [logsModalOpen, setLogsModalOpen] = useState(false);

  const previewLogs = ALL_ERROR_LOGS.slice(0, LOG_PREVIEW_COUNT);

  useEffect(() => {
    if (!logsModalOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setLogsModalOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [logsModalOpen]);

  const filteredNodes = useMemo(() => nodes.filter(n => {
    const matchFilter = filter === 'All' || n.status === filter;
    const q = search.toLowerCase();
    return matchFilter && (!q || n.id.toLowerCase().includes(q) || n.ip.includes(q));
  }), [nodes, filter, search]);

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

  const healthScore = useMemo(() => {
    const healthy  = nodes.filter(n => n.status === 'Healthy').length;
    const critical = nodes.filter(n => n.status === 'Critical').length;
    return Math.max(0, ((healthy / nodes.length) * 100 - critical * 5)).toFixed(1);
  }, [nodes]);

  const siteSummaries = useMemo(() => {
    const buckets = [
      { key: 'gumi', pred: (id: string) => id.startsWith('GU-') },
      { key: 'changwon', pred: (id: string) => id.startsWith('CW-') },
    ];
    return buckets.map(b => {
      const group = nodes.filter(n => b.pred(n.id));
      const label = formatNodeGroupLabel(group);
      const worst: NodeStatus = group.some(n => n.status === 'Critical') ? 'Critical'
        : group.some(n => n.status === 'Warning') ? 'Warning' : 'Healthy';
      const avgStorage = group.length === 0
        ? 0
        : Math.round(group.reduce((s, n) => s + storageUsagePct(n), 0) / group.length);
      return { key: b.key, label, nodes: group, worst, avgStorage, count: group.length };
    });
  }, [nodes]);

  const healthScoreNum = parseFloat(healthScore);

  return (
    <div className="space-y-8">
      <header className="flex justify-between items-center">
        <div className="flex items-center gap-8">
          <h2 className="text-2xl font-bold text-text-bright font-headline tracking-tight">시스템 상태 및 노드 관리</h2>
          <div className="relative group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-muted" />
            <input
              className="bg-surface-card border-none rounded-xl pl-10 pr-4 py-2 text-xs text-text-bright focus:ring-1 focus:ring-accent w-64 transition-all placeholder:text-surface-muted"
              placeholder="노드 IP 또는 ID 검색..."
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
            <p className="text-surface-muted font-medium text-xs uppercase tracking-wide mb-2">Global Health Score</p>
            <p className="text-[11px] text-surface-muted font-medium leading-snug tracking-normal mb-3">
              노드 상태 비율 기반 <span className="text-text-dim">요약 점수</span>입니다. 스토리지·로드·이벤트는 아래 목록·로그에서 확인하세요.
            </p>
            <motion.h3
              key={healthScore}
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              className="text-4xl font-bold text-accent leading-none mb-4 font-headline"
            >
              {healthScore}<span className="text-lg opacity-60 ml-1">%</span>
            </motion.h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="text-text-dim">시스템 안정성</span>
                <span className={`font-bold ${healthScoreNum >= 90 ? 'text-green-400' : healthScoreNum >= 70 ? 'text-yellow-400' : 'text-red-400'}`}>
                  {healthScoreNum >= 90 ? '최상' : healthScoreNum >= 70 ? '경고' : '위험'}
                </span>
              </div>
              <ProgressBar value={healthScoreNum} color="bg-gradient-to-r from-accent to-blue-300" height="h-1.5" />
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
              <h3 className="text-sm font-semibold text-text-bright tracking-normal">사이트별 노드 요약</h3>
              <p className="text-xs text-surface-muted font-medium mt-1 tracking-normal">
                Node Identity List와 동일 노드 집계 · 사이트당 최악 상태·평균 스토리지 사용률
              </p>
            </div>
            <span className="px-3 py-1 bg-primary rounded-md text-[11px] text-accent font-semibold border border-accent/20 tabular-nums">
              {nodes.length} nodes · {siteSummaries.length} 그룹
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {siteSummaries.map(site => (
              <div key={site.key} className="rounded-xl bg-primary/50 border border-white/5 p-5 flex flex-col gap-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-text-bright tracking-normal">{site.label}</span>
                  <span className={`text-[11px] font-semibold uppercase tracking-wide ${STATUS_TEXT[site.worst]}`}>{site.worst}</span>
                </div>
                <p className="text-[11px] text-surface-muted font-medium tabular-nums">
                  노드 {site.count}대 · 평균 스토리지 {site.avgStorage}%
                </p>
                <ProgressBar value={site.avgStorage} color={STATUS_BAR[site.worst]} height="h-1.5" animated={false} />
                <p className="text-[10px] text-surface-muted leading-snug">
                  노드 ID·IP·로드는 표에서 확인. 이 카드는 사이트 단위 집계만 표시합니다.
                </p>
              </div>
            ))}
          </div>
        </Card>

        {/* Node List */}
        <Card noPadding className="col-span-12 lg:col-span-9 overflow-hidden">
          <div className="p-6 border-b border-white/5 flex justify-between items-center">
            <h3 className="text-sm font-semibold text-text-bright tracking-normal">Node Identity List</h3>
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
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="text-[11px] uppercase tracking-wide text-surface-muted bg-primary/30">
                  {['Node ID / IP Address', 'Status', 'Storage Usage', 'Load Avg', 'Actions'].map((h, i) => (
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
                              title={node.status === 'Healthy' ? '정상 상태' : '노드 재시작'}
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
              Data Balancing
              <RefreshCw className="w-3 h-3 text-accent" />
            </h3>
            <p className="text-[10px] text-surface-muted font-medium leading-snug mb-5 tracking-normal">
              블록 재분산 진행률(클러스터 작업). 노드별 디스크 사용률과는 별개 지표입니다.
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
              현재 재균형 작업이 진행 중입니다. 클러스터 성능에 미치는 영향은 낮음으로 유지됩니다.
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
                  <p className="text-[10px] opacity-40 mt-2 font-medium">{log.ts}</p>
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
                    <p className="text-[10px] opacity-40 mt-2 font-medium">{log.ts}</p>
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
