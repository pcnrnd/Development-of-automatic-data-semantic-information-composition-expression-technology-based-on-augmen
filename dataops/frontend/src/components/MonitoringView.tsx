import React, { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Activity,
  AlertCircle,
  CheckCircle2,
  Zap,
  Shield,
  BarChart3,
  PieChart,
  X,
} from 'lucide-react';
import { sparklinePoints, throughputSparkPaths, makeBarData } from '../utils/chart';
import { Card, SectionHeader, Badge, Metric } from './ui';

type TimeRange = '1H' | '6H' | '24H' | '7D';
type AlertSeverity = 'critical' | 'warning' | 'info';

interface StoredPipelineInstance {
  id: string;
  name: string;
  sourceCount: number;
  ruleCount: number;
  destinationCount: number;
  scheduleMode: 'streaming' | 'batch';
  createdAt: string;
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

interface AlertItem {
  id: string;
  severity: AlertSeverity;
  msg: string;
  time: string;
}

const INITIAL_ALERTS: AlertItem[] = [
  { id: 'AL-992', severity: 'critical', msg: 'EQ-MOTOR-07 VoltR 전압강하 감지 (198.4V < 200V 임계값)', time: '2m ago' },
  { id: 'AL-991', severity: 'critical', msg: 'EQ-PUMP-03 Ground 누전 전류 초과 (6.2A > 5A 임계값)', time: '7m ago' },
  { id: 'AL-990', severity: 'warning',  msg: 'EQ-MOTOR-07 3상 전류 불균형 — currR/S/T 편차 5.8%', time: '18m ago' },
  { id: 'AL-989', severity: 'warning',  msg: 'EQ-COMP-02 PT100 온도 상승 추세 (81.2°C, 임계값 85°C)', time: '32m ago' },
  { id: 'AL-988', severity: 'info',     msg: '덕산 전력 파이프라인 체크포인트 완료 (TX-99238-K-82)', time: '1h ago' },
];

const TIME_LABELS: Record<TimeRange, string[]> = {
  '1H':  ['14:00', '14:15', '14:30', '14:45', '15:00'],
  '6H':  ['09:00', '10:30', '12:00', '13:30', '15:00'],
  '24H': ['00:00', '06:00', '12:00', '18:00', '24:00'],
  '7D':  ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
};

const BAR_COUNTS: Record<TimeRange, number> = { '1H': 40, '6H': 36, '24H': 48, '7D': 42 };

const BAR_DATA: Record<TimeRange, { h1: number; h2: number }[]> = {
  '1H':  makeBarData(BAR_COUNTS['1H'],  13),
  '6H':  makeBarData(BAR_COUNTS['6H'],  7),
  '24H': makeBarData(BAR_COUNTS['24H'], 19),
  '7D':  makeBarData(BAR_COUNTS['7D'],  5),
};

const HEALTH_BY_RANGE: Record<TimeRange, number> = { '1H': 98, '6H': 96, '24H': 93, '7D': 89 };

const dotColor: Record<AlertSeverity, string> = {
  critical: 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]',
  warning:  'bg-yellow-500',
  info:     'bg-blue-500',
};

const utilizationPercent = (value: string): number | null => {
  const m = value.trim().match(/^(\d+(?:\.\d+)?)%$/);
  if (!m) return null;
  return Math.min(100, Math.max(0, Number(m[1])));
};

const TIME_RANGE_OPTIONS: TimeRange[] = ['1H', '6H', '24H', '7D'];

function readPipelineStorage() {
  const instances = JSON.parse(localStorage.getItem('pipeline-storage-instances') || '[]') as StoredPipelineInstance[];
  const sources = JSON.parse(localStorage.getItem('pipeline-storage-sources') || '[]') as StoredSource[];
  const destinations = JSON.parse(localStorage.getItem('pipeline-storage-destinations') || '[]') as StoredDestination[];
  return { instances, sources, destinations };
}

// 전력 품질 이상 메시지 풀 (덕산 전력 데이터 기반)
const POWER_ALERT_POOL = [
  { severity: 'critical' as AlertSeverity, msg: 'EQ-MOTOR-07 VoltR 전압강하 감지 (198.4V < 200V 임계값)' },
  { severity: 'critical' as AlertSeverity, msg: 'EQ-PUMP-03 Ground 누전 전류 초과 (6.2A > 5A 임계값)' },
  { severity: 'warning'  as AlertSeverity, msg: 'EQ-MOTOR-07 3상 전류 불균형 — currR/S/T 편차 5.8%' },
  { severity: 'warning'  as AlertSeverity, msg: 'EQ-COMP-02 PT100 온도 상승 추세 (81.2°C, 임계값 85°C)' },
  { severity: 'warning'  as AlertSeverity, msg: 'EQ-PUMP-03 VoltS/VoltT 불균형 감지 (편차 > 3V)' },
  { severity: 'warning'  as AlertSeverity, msg: 'EQ-MOTOR-07 curr 최대 허용치 근접 (241A / 250A)' },
];

function buildAlertsFromPipelines(instances: StoredPipelineInstance[], sources: StoredSource[]): AlertItem[] {
  if (instances.length === 0) return INITIAL_ALERTS;
  const alerts: AlertItem[] = [];
  let alertId = 0;

  // streaming 파이프라인마다 전력 수집 체크포인트 INFO 알림
  instances.filter(p => p.scheduleMode === 'streaming').forEach(p => {
    alerts.push({
      id: `AL-${1000 + alertId++}`,
      severity: 'info',
      msg: `${p.name} — 덕산 전력 스트리밍 체크포인트 완료`,
      time: '방금 전',
    });
  });

  // inactive 소스 → 전력 수집 중단 WARNING
  sources.filter(s => !s.active).forEach(s => {
    alerts.push({
      id: `AL-${1000 + alertId++}`,
      severity: 'warning',
      msg: `${s.label} 전력 데이터 수집 중단 — 소스 연결 확인 필요`,
      time: '3분 전',
    });
  });

  // 파이프라인 룰 수가 많으면 → 전력 품질 이상 알림 추가
  const maxRules = Math.max(...instances.map(p => p.ruleCount), 0);
  if (maxRules >= 2) {
    const poolPick = POWER_ALERT_POOL.slice(0, Math.min(2, maxRules - 1));
    poolPick.forEach((item, i) => {
      alerts.push({
        id: `AL-${900 + i}`,
        severity: item.severity,
        msg: item.msg,
        time: `${(i + 1) * 8}분 전`,
      });
    });
  }

  if (alerts.length < 2) {
    alerts.push(...INITIAL_ALERTS.slice(0, 2 - alerts.length));
  }
  return alerts.slice(0, 6);
}

export const MonitoringView = () => {
  const [timeRange, setTimeRange] = useState<TimeRange>('1H');
  const [alerts, setAlerts] = useState<AlertItem[]>(INITIAL_ALERTS);
  const [throughputTick, setThroughputTick] = useState(0);
  const [pipelineCount, setPipelineCount] = useState(0);

  // Sync pipeline storage and update alerts + metrics
  useEffect(() => {
    const syncFromPipeline = () => {
      const { instances, sources } = readPipelineStorage();
      const newAlerts = buildAlertsFromPipelines(instances, sources);
      setAlerts(newAlerts);
      setPipelineCount(instances.length);
    };
    syncFromPipeline();
    window.addEventListener('pipeline-storage-updated', syncFromPipeline);
    window.addEventListener('focus', syncFromPipeline);
    return () => {
      window.removeEventListener('pipeline-storage-updated', syncFromPipeline);
      window.removeEventListener('focus', syncFromPipeline);
    };
  }, []);

  useEffect(() => { setThroughputTick(0); }, [timeRange]);

  useEffect(() => {
    const id = window.setInterval(() => setThroughputTick(t => t + 1), 1400);
    return () => window.clearInterval(id);
  }, [timeRange]);

  // Scale health based on pipeline activity (more pipelines = slight degradation)
  const baseHealth = HEALTH_BY_RANGE[timeRange];
  const health = Math.max(70, baseHealth - Math.min(15, pipelineCount * 2));
  const circumference = 2 * Math.PI * 88;

  const bars = useMemo(() => {
    const base = BAR_DATA[timeRange];
    const phase = throughputTick * 0.11;
    const jitter = (throughputTick % 5) * 0.4;
    return base.map((b, i) => ({
      h1: Math.round(Math.min(94, Math.max(18, b.h1 + 14 * Math.sin(phase + i * 0.31) + jitter * Math.sin(i * 0.9)))),
      h2: Math.round(Math.min(88, Math.max(14, b.h2 + 11 * Math.cos(phase * 0.85 + i * 0.24) + jitter * 0.6 * Math.cos(i * 0.7)))),
    }));
  }, [timeRange, throughputTick]);

  const throughputLive = useMemo(() => {
    if (bars.length === 0) return { inMbps: 0, egMbps: 0, peakMbps: 0 };
    const avgIn  = bars.reduce((s, b) => s + b.h1, 0) / bars.length;
    const avgEg  = bars.reduce((s, b) => s + b.h2, 0) / bars.length;
    const peakH  = Math.max(...bars.map(b => Math.max(b.h1, b.h2)));
    const wobble = Math.sin(throughputTick * 0.19) * 22 + Math.cos(throughputTick * 0.11) * 14;
    return {
      inMbps:   Math.max(120, Math.round(480 + avgIn * 9.2 + wobble)),
      egMbps:   Math.max(90,  Math.round(360 + avgEg * 8.4 + wobble * 0.85)),
      peakMbps: Math.max(0,   Math.round(620 + peakH * 5.5 + wobble * 0.5)),
    };
  }, [bars, throughputTick]);

  const labels = TIME_LABELS[timeRange];
  const criticalCount = alerts.filter(a => a.severity === 'critical').length;

  const dismissAlert = (id: string) => setAlerts(prev => prev.filter(a => a.id !== id));

  // Scale resource metrics based on pipeline count
  const cpuBase = Math.min(95, 42 + pipelineCount * 8);
  const sessionBase = 12.4 + pipelineCount * 1.5;
  const storageBase = 1.2 + pipelineCount * 0.3;

  // Live animated values — all 4 items jitter in real time via throughputTick
  const liveResource = useMemo(() => {
    const t = throughputTick;
    const cpu     = Math.min(97, Math.max(28, cpuBase + 4 * Math.sin(t * 0.13) + 2.5 * Math.cos(t * 0.31)));
    const mem     = Math.min(88, Math.max(54, 68 + 2.5 * Math.sin(t * 0.09 + 1.2) + 1.8 * Math.cos(t * 0.22)));
    const storage = Math.max(0.4, storageBase + 0.5 * Math.sin(t * 0.17 + 0.8) + 0.3 * Math.cos(t * 0.27));
    const sess    = Math.max(8, sessionBase + 1.2 * Math.sin(t * 0.14 + 2.1) + 0.9 * Math.cos(t * 0.19));

    // Rolling 12-point sparkline series computed from tick offsets
    const wave = (base: number, amp: number, freq: number, phase: number) =>
      Array.from({ length: 12 }, (_, k) =>
        Math.max(0.1, base + amp * Math.sin(freq * (t - 11 + k) + phase))
      );

    return {
      cpu,   cpuSeries:     wave(cpuBase, 5, 0.13, 0),
      mem,   memSeries:     wave(68,      3, 0.09, 1.2),
      storage, storageSeries: wave(storageBase, 0.6, 0.17, 0.8),
      sess,  sessSeries:    wave(sessionBase,  1.4, 0.14, 2.1),
    };
  }, [throughputTick, cpuBase, storageBase, sessionBase]);

  const resourceItems = [
    { label: 'CPU Cluster Load',  icon: Zap,      headline: `${Math.round(liveResource.cpu)}%`,          series: liveResource.cpuSeries,     pct: Math.round(liveResource.cpu) },
    { label: 'Memory Allocation', icon: BarChart3, headline: `${Math.round(liveResource.mem)}%`,          series: liveResource.memSeries,     pct: Math.round(liveResource.mem) },
    { label: 'Storage I/O',       icon: Activity,  headline: `${liveResource.storage.toFixed(1)} GB/s`,   series: liveResource.storageSeries, pct: null },
    { label: 'Active Sessions',   icon: PieChart,  headline: `${liveResource.sess.toFixed(1)}k`,          series: liveResource.sessSeries,    pct: null },
  ];

  return (
    <div className="space-y-8">
      <SectionHeader
        title="실시간 모니터링"
        description="전체 시스템 데이터 및 장애 감지 현황"
        right={
          <div className="flex gap-2 bg-surface-card/50 p-1 rounded-xl border border-white/5">
            {TIME_RANGE_OPTIONS.map(t => (
              <button
                key={t}
                type="button"
                onClick={() => setTimeRange(t)}
                className={`px-4 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  t === timeRange ? 'bg-accent text-primary' : 'text-text-dim hover:bg-white/5'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        }
      />

      <div className="grid grid-cols-12 gap-6">
        {/* Health Score */}
        <Card className="col-span-12 lg:col-span-4 !p-8 relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4">
            <Shield className="w-6 h-6 text-accent opacity-20" />
          </div>
          <h3 className="text-xs font-semibold text-text-dim uppercase tracking-wide mb-6">System Health Index</h3>
          <div className="flex flex-col items-center justify-center py-4">
            <div className="relative w-48 h-48 flex items-center justify-center">
              <svg className="w-full h-full -rotate-90">
                <circle cx="96" cy="96" r="88" fill="none" stroke="currentColor" strokeWidth="12" className="text-primary" />
                <motion.circle
                  cx="96" cy="96" r="88" fill="none" stroke="currentColor" strokeWidth="12"
                  strokeDasharray={circumference}
                  animate={{ strokeDashoffset: circumference * (1 - health / 100) }}
                  transition={{ duration: 0.8, ease: 'easeOut' }}
                  className="text-accent"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <motion.span
                  key={health}
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="text-5xl font-bold text-text-bright font-headline"
                >
                  {health}
                </motion.span>
                <span className="text-xs font-medium text-accent uppercase tracking-wide">
                  {health >= 97 ? 'Optimal' : health >= 90 ? 'Good' : 'Degraded'}
                </span>
              </div>
            </div>
          </div>
          <div className="mt-8 grid grid-cols-3 gap-4 border-t border-white/5 pt-6">
            {[
              { label: 'Uptime',    value: '99.99%' },
              { label: 'MTTR',      value: '14m' },
              { label: 'Incidents', value: String(criticalCount) },
            ].map(item => (
              <div key={item.label} className="text-center">
                <p className="text-[11px] text-surface-muted font-medium uppercase tracking-wide mb-1">{item.label}</p>
                <p className="text-sm font-bold text-text-bright">{item.value}</p>
              </div>
            ))}
          </div>
        </Card>

        {/* Throughput Chart */}
        <Card className="col-span-12 lg:col-span-8 !p-8">
          <div className="flex justify-between items-start mb-10">
            <div>
              <h3 className="text-base font-semibold text-text-bright font-headline">Network Throughput</h3>
              <p className="text-xs text-text-dim mt-1 tracking-normal">글로벌 게이트웨이 인입·인출 처리량</p>
            </div>
            <div className="flex flex-col items-end gap-2 sm:flex-row sm:items-center sm:gap-4">
              {[
                { label: 'Ingress', dotClass: 'bg-accent' },
                { label: 'Egress', dotClass: 'throughput-legend-egress-dot' },
              ].map(item => (
                <div key={item.label} className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full shrink-0 ${item.dotClass}`} />
                  <span className="text-[11px] font-medium text-text-dim uppercase tracking-wide">{item.label}</span>
                </div>
              ))}
            </div>
          </div>
          <p className="mt-3 text-[11px] font-mono text-text-dim tabular-nums tracking-normal">
            <span className="text-accent/90">IN</span> {throughputLive.inMbps} Mbps ·{' '}
            <span className="text-surface-muted">OUT</span> {throughputLive.egMbps} Mbps · 피크 {throughputLive.peakMbps} Mbps
            <span className="text-surface-muted font-sans text-[10px] ml-2">· 1.4s 샘플(데모)</span>
          </p>
          <div className="mt-3 h-56 rounded-lg throughput-chart-panel p-2 flex flex-col min-h-0">
            <motion.div
              key={timeRange}
              initial={{ opacity: 0.88 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.2 }}
              className="flex flex-1 items-end gap-0.5 w-full min-h-0"
            >
              {bars.map((bar, i) => {
                const isRecent = i >= bars.length - 4;
                const totalH = Math.min(98, Math.max(6, Math.round((bar.h1 + bar.h2) * 0.5)));
                return (
                  <div key={i} className="group relative flex h-full min-w-0 flex-1 flex-col justify-end">
                    <motion.div
                      initial={false}
                      animate={{ height: `${totalH}%` }}
                      transition={{ duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
                      className={`mx-auto flex min-h-0 w-full max-w-[1.35rem] flex-col overflow-hidden rounded-md transition-[filter] throughput-one-bar ${
                        isRecent ? 'throughput-one-bar-recent' : ''
                      }`}
                    >
                      <div
                        className="throughput-stack-ingress min-h-[2px] w-full"
                        style={{ flex: `${bar.h1} 1 0px` }}
                      />
                      <div
                        className="throughput-stack-egress min-h-[2px] w-full"
                        style={{ flex: `${bar.h2} 1 0px` }}
                      />
                    </motion.div>
                  </div>
                );
              })}
            </motion.div>
          </div>
          <div className="mt-6 flex justify-between text-[11px] font-medium text-surface-muted uppercase tracking-wide">
            {labels.map(l => <span key={l}>{l}</span>)}
          </div>
        </Card>

        {/* Alerts Panel */}
        <Card noPadding className="col-span-12 lg:col-span-4 overflow-hidden flex flex-col">
          <div className="px-6 py-4 bg-primary/50 border-b border-white/5 flex justify-between items-center">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-accent" />
              <span className="text-xs font-semibold uppercase tracking-wide text-text-bright">Active Alerts</span>
            </div>
            {alerts.length > 0 && (
              <span className="bg-red-500 text-white text-[11px] px-2 py-0.5 rounded-full font-semibold">
                {alerts.length} NEW
              </span>
            )}
          </div>
          <div className="divide-y divide-white/5 flex-1">
            <AnimatePresence>
              {alerts.length === 0 ? (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="p-8 flex flex-col items-center gap-2 text-center"
                >
                  <CheckCircle2 className="w-8 h-8 text-accent" />
                  <p className="text-xs text-text-dim font-medium">모든 알림이 해소되었습니다</p>
                </motion.div>
              ) : (
                alerts.map(alert => (
                  <motion.div
                    key={alert.id}
                    initial={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 40 }}
                    transition={{ duration: 0.25 }}
                    className="p-6 hover:bg-white/5 transition-colors group"
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex items-center gap-3">
                        <div className={`w-2 h-2 rounded-full ${dotColor[alert.severity]}`} />
                        <span className="text-xs font-mono font-semibold text-surface-muted">{alert.id}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-surface-muted font-medium">{alert.time}</span>
                        <button
                          type="button"
                          onClick={() => dismissAlert(alert.id)}
                          className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-white/10 rounded"
                          title="알림 해소"
                        >
                          <X className="w-3 h-3 text-surface-muted hover:text-text-bright" />
                        </button>
                      </div>
                    </div>
                    <p className="text-xs font-medium text-text-bright group-hover:text-accent transition-colors">{alert.msg}</p>
                  </motion.div>
                ))
              )}
            </AnimatePresence>
          </div>
          <button type="button" className="p-4 text-xs font-medium text-text-dim tracking-wide hover:bg-white/5 transition-colors border-t border-white/5">
            View Alert Archive
          </button>
        </Card>

        {/* Resource Usage */}
        <div className="col-span-12 lg:col-span-8 grid grid-cols-2 gap-3 items-stretch">
          {resourceItems.map((item, i) => {
            const W = 100; const H = 36; const padX = 0; const padY = 3;
            const innerH = H - padY * 2;
            const n = item.series.length;
            const min = Math.min(...item.series);
            const max = Math.max(...item.series);
            const range = max - min || 1;

            // min-max 정규화 → 진폭이 차트 높이 전체를 채움
            const pts = item.series.map((v, j) => {
              const x = n <= 1 ? 0 : (j / (n - 1)) * (W - padX * 2) + padX;
              const y = H - padY - ((v - min) / range) * innerH;
              return { x, y };
            });
            const lineD = pts.map((p, j) => `${j === 0 ? 'M' : 'L'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
            const areaD = `${lineD} L${W} ${H} L0 ${H}Z`;

            return (
              <Card key={i} className="flex h-full flex-col !p-4 overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-6 h-6 shrink-0 rounded-md bg-primary flex items-center justify-center border border-white/5">
                      <item.icon className="w-3 h-3 text-accent" />
                    </div>
                    <p className="text-[10px] font-medium text-surface-muted uppercase tracking-wide truncate">{item.label}</p>
                  </div>
                  <motion.span
                    className="text-sm font-bold text-text-bright tabular-nums shrink-0"
                    initial={{ opacity: 0.5 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.2 }}
                  >
                    {item.headline}
                  </motion.span>
                </div>

                {/* Area sparkline — min-max normalized, full visual range */}
                <div className="my-auto flex w-full flex-col gap-3 py-2">
                  <svg className="w-full h-14" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden>
                    <defs>
                      <linearGradient id={`rg-${i}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="currentColor" stopOpacity="0.25" />
                        <stop offset="100%" stopColor="currentColor" stopOpacity="0.02" />
                      </linearGradient>
                    </defs>
                    {/* area fill */}
                    <path d={areaD} fill={`url(#rg-${i})`} className="text-accent" />
                    {/* line */}
                    <path
                      d={lineD}
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      vectorEffect="non-scaling-stroke"
                      className="text-accent"
                    />
                    {/* current value dot */}
                    {pts.length > 0 && (
                      <circle
                        cx={pts[pts.length - 1]!.x.toFixed(1)}
                        cy={pts[pts.length - 1]!.y.toFixed(1)}
                        r="2"
                        fill="currentColor"
                        className="text-accent"
                      />
                    )}
                  </svg>

                </div>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
};
