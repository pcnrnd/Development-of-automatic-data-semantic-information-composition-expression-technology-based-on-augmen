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
import { Card, SectionHeader, Badge, ProgressBar, Metric } from './ui';

type TimeRange = '1H' | '6H' | '24H' | '7D';
type AlertSeverity = 'critical' | 'warning' | 'info';

interface AlertItem {
  id: string;
  severity: AlertSeverity;
  msg: string;
  time: string;
}

const INITIAL_ALERTS: AlertItem[] = [
  { id: 'AL-992', severity: 'critical', msg: 'EQ-PUMP-03 PT100 온도 초과 (92.4°C > 85°C 임계값)', time: '2m ago' },
  { id: 'AL-991', severity: 'warning',  msg: 'EQ-MOTOR-07 3상 전류 불균형 감지 (R/S/T 편차 > 5%)', time: '18m ago' },
  { id: 'AL-990', severity: 'warning',  msg: 'EQ-COMP-02 진동(Vibra) 이상 — 0.18g (정상 범위 이탈)', time: '35m ago' },
  { id: 'AL-989', severity: 'info',     msg: '덕산공장 센서 파이프라인 정기 체크포인트 완료', time: '1h ago' },
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

export const MonitoringView = () => {
  const [timeRange, setTimeRange] = useState<TimeRange>('1H');
  const [alerts, setAlerts] = useState<AlertItem[]>(INITIAL_ALERTS);
  const [throughputTick, setThroughputTick] = useState(0);

  useEffect(() => { setThroughputTick(0); }, [timeRange]);

  useEffect(() => {
    const id = window.setInterval(() => setThroughputTick(t => t + 1), 1400);
    return () => window.clearInterval(id);
  }, [timeRange]);

  const health = HEALTH_BY_RANGE[timeRange];
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

  const resourceItems = [
    { label: 'CPU Cluster Load',  value: '42%',   icon: Zap,       data: [40, 35, 45, 42, 38, 42] },
    { label: 'Memory Allocation', value: '68%',   icon: BarChart3, data: [60, 62, 65, 68, 67, 68] },
    { label: 'Storage I/O',       value: '1.2 GB/s', icon: Activity,  data: [8, 10, 14, 12, 11, 12], vizTone: 'accent' as const },
    { label: 'Active Sessions',   value: '12.4k', icon: PieChart,  data: [10, 11, 13, 12, 12, 12.4], vizTone: 'neutral' as const, sessionScale: true as const },
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
        <div className="col-span-12 lg:col-span-8 grid grid-cols-2 gap-4 items-start">
          {resourceItems.map((item, i) => {
            const pct = utilizationPercent(item.value);
            const liveSeries =
              pct === null
                ? item.data.map((v, j) =>
                    Math.max(0.01, v + 0.32 * Math.sin(throughputTick * 0.11 + i * 0.73 + j * 0.52))
                  )
                : item.data;
            const livePeak = Math.max(...liveSeries, 1e-6);
            const { areaD, lineD } = pct === null ? throughputSparkPaths(liveSeries) : { areaD: '', lineD: '' };
            const vizTone = 'vizTone' in item && item.vizTone ? item.vizTone : 'accent';
            const sessionK = 'sessionScale' in item && item.sessionScale ? liveSeries[liveSeries.length - 1]! : null;
            const headline = sessionK !== null ? `${sessionK.toFixed(1)}k` : item.value;

            return (
              <Card key={i} className="flex flex-col">
                <div className="flex justify-between items-start gap-3 shrink-0">
                  <div className="w-9 h-9 shrink-0 rounded-lg bg-primary flex items-center justify-center border border-white/5">
                    <item.icon className="w-[18px] h-[18px] text-accent" />
                  </div>
                  <div className="text-right min-w-0">
                    <p className="text-[11px] font-medium text-surface-muted uppercase tracking-wide mb-1">{item.label}</p>
                    <motion.p
                      className="text-lg sm:text-xl font-bold text-text-bright tabular-nums leading-tight"
                      initial={false}
                      animate={{ opacity: 1 }}
                      transition={{ duration: 0.25 }}
                    >
                      {headline}
                    </motion.p>
                  </div>
                </div>
                <div className="mt-3 w-full shrink-0">
                  {pct !== null ? (
                    <div className="w-full space-y-2.5" title="현재 이용률">
                      <ProgressBar value={pct} height="h-3.5" color="bg-accent/55" />
                      <svg className="w-full h-11 text-accent/40" viewBox="0 0 100 22" preserveAspectRatio="none" aria-hidden>
                        <polyline
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.35"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          vectorEffect="non-scaling-stroke"
                          points={sparklinePoints(item.data)}
                        />
                      </svg>
                    </div>
                  ) : (
                    <div
                      className="w-full space-y-2.5"
                      title={vizTone === 'neutral' ? '동시 세션 수 샘플 추세(데모)' : '스토리지 처리량 샘플 추세(데모)'}
                    >
                      <svg className="w-full h-[5.5rem]" viewBox="0 0 100 32" preserveAspectRatio="none" aria-hidden>
                        <line x1="0" y1="31.5" x2="100" y2="31.5" className="stroke-white/10" strokeWidth="0.5" vectorEffect="non-scaling-stroke" />
                        <path d={areaD} className={vizTone === 'neutral' ? 'fill-white/5' : 'fill-accent/12'} />
                        <path
                          d={lineD}
                          fill="none"
                          className={vizTone === 'neutral' ? 'stroke-white/35' : 'stroke-accent/45'}
                          strokeWidth="1.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          vectorEffect="non-scaling-stroke"
                        />
                      </svg>
                      <ProgressBar
                        value={Math.min(100, (liveSeries[liveSeries.length - 1]! / livePeak) * 100)}
                        height="h-2"
                        color={vizTone === 'neutral' ? 'bg-white/30' : 'bg-accent/35'}
                      />
                    </div>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
};
