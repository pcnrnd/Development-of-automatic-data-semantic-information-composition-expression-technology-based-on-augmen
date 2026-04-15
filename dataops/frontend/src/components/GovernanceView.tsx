import React, { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Shield,
  Database,
  Zap,
  PlusCircle,
  Trash2,
  Cloud,
  BarChart3,
  Terminal,
  CheckCircle2,
  Timer,
  X,
} from 'lucide-react';
import { Card, Badge, ProgressBar, FormInput, FormSelect, Metric } from './ui';

type ScheduleMode = 'streaming' | 'batch';

interface DataSource {
  id: string;
  label: string;
  sub: string;
  tag: string;
  icon: typeof Zap;
  active: boolean;
}

interface FilterRule {
  id: string;
  parts: string[];
  connector: string;
  severity: 'Critical' | 'Warning';
}

interface Destination {
  id: string;
  label: string;
  icon: typeof Cloud;
  active: boolean;
}

const INITIAL_SOURCES: DataSource[] = [
  { id: 'mqtt',  label: '공장 구역 MQTT 토픽', sub: 'Broker: 10.0.0.45 | factory/+/sensor/#', tag: 'MQTT', icon: Zap, active: true },
  { id: 'opcua', label: 'SCADA · 설비 표준 연동', sub: '연결 scada-srv:4840 | 전동기·펌프', tag: '설비연동', icon: Database, active: true },
  { id: 'sql',   label: 'MES 마스터 데이터', sub: 'PostgreSQL: mes-db-cluster (설비 코드)',     tag: 'SQL',    icon: Database, active: false },
];

const INITIAL_RULES: FilterRule[] = [
  { id: 'r1', parts: ['PT100 > 85.0 °C', 'Vibra < 0.2 g'],     connector: 'And', severity: 'Critical' },
  { id: 'r2', parts: ['curr > 250.0 A',  'Ground > 5.0 A'],     connector: 'And', severity: 'Critical' },
  { id: 'r3', parts: ['VoltR < 200.0 V', 'VoltS < 200.0 V'],   connector: 'Or',  severity: 'Warning'  },
];

const INITIAL_DESTINATIONS: Destination[] = [
  { id: 'hdfs',      label: 'HDFS 콜드 아카이브', icon: Database,  active: true  },
  { id: 'mes',       label: 'MES 실시간 피드',     icon: BarChart3, active: true  },
  { id: 'historian', label: 'SCADA Historian',     icon: Terminal,  active: true  },
  { id: 'adl',       label: 'Object storage',      icon: Cloud,     active: false },
];

const buildIngestionBars = (mode: ScheduleMode) =>
  mode === 'streaming'
    ? [
        { id: 's-6', short: '−6h', rel: 62, title: '6시간 전 · 7구간 최고 대비 62% (데모)' },
        { id: 's-5', short: '−5h', rel: 58, title: '5시간 전 · 7구간 최고 대비 58%' },
        { id: 's-4', short: '−4h', rel: 95, title: '4시간 전 · 7구간 최고 대비 95%' },
        { id: 's-3', short: '−3h', rel: 68, title: '3시간 전 · 7구간 최고 대비 68%' },
        { id: 's-2', short: '−2h', rel: 72, title: '2시간 전 · 7구간 최고 대비 72%' },
        { id: 's-1', short: '−1h', rel: 88, title: '1시간 전 · 7구간 최고 대비 88%' },
        { id: 's-0', short: '현재', rel: 100, title: '현재 구간 · 7구간 최고 대비 100%' },
      ]
    : [
        { id: 'b-6', short: '−6h', rel: 38, title: '6시간 전 · 7구간 최고 대비 63% (데모)' },
        { id: 'b-5', short: '−5h', rel: 44, title: '5시간 전 · 7구간 최고 대비 73%' },
        { id: 'b-4', short: '−4h', rel: 52, title: '4시간 전 · 7구간 최고 대비 87%' },
        { id: 'b-3', short: '−3h', rel: 48, title: '3시간 전 · 7구간 최고 대비 80%' },
        { id: 'b-2', short: '−2h', rel: 55, title: '2시간 전 · 7구간 최고 대비 92%' },
        { id: 'b-1', short: '−1h', rel: 60, title: '1시간 전 · 7구간 최고 대비 100%' },
        { id: 'b-0', short: '현재', rel: 58, title: '현재 구간 · 7구간 최고 대비 97%' },
      ];

const ALERT_INCIDENTS_7D = [1, 0, 2, 0, 0, 1, 0] as const;
const ACTIVE_INCIDENTS_NOW       = 0;
const ACTIVE_INCIDENTS_YESTERDAY = 1;

let ruleIdCounter = 100;

export const GovernanceView = () => {
  const [sources, setSources]           = useState<DataSource[]>(INITIAL_SOURCES);
  const [scheduleMode, setScheduleMode] = useState<ScheduleMode>('streaming');
  const [rules, setRules]               = useState<FilterRule[]>(INITIAL_RULES);
  const [destinations, setDestinations] = useState<Destination[]>(INITIAL_DESTINATIONS);
  const [showNewRule, setShowNewRule]   = useState(false);
  const [newField, setNewField]         = useState('');
  const [newOp, setNewOp]               = useState('>');
  const [newVal, setNewVal]             = useState('');
  const [newSev, setNewSev]             = useState<'Critical' | 'Warning'>('Warning');

  const toggleSource      = (id: string) => setSources(prev => prev.map(s => s.id === id ? { ...s, active: !s.active } : s));
  const toggleDestination = (id: string) => setDestinations(prev => prev.map(d => d.id === id ? { ...d, active: !d.active } : d));
  const deleteRule        = (id: string) => setRules(prev => prev.filter(r => r.id !== id));

  const addRule = () => {
    if (!newField.trim() || !newVal.trim()) return;
    setRules(prev => [...prev, {
      id: `r${++ruleIdCounter}`,
      parts: [`${newField.trim()} ${newOp} ${newVal.trim()}`],
      connector: '',
      severity: newSev,
    }]);
    setNewField(''); setNewVal(''); setShowNewRule(false);
  };

  const govHealth = 80 + sources.filter(s => s.active).length * 6 + (scheduleMode === 'streaming' ? 4 : 0);

  const ingestionBars      = useMemo(() => buildIngestionBars(scheduleMode), [scheduleMode]);
  const ingestionPeakRel   = Math.max(...ingestionBars.map(b => b.rel), 1);
  const alertIncidentsPeak = Math.max(...ALERT_INCIDENTS_7D, 1);

  const incidentDiff = ACTIVE_INCIDENTS_NOW - ACTIVE_INCIDENTS_YESTERDAY;

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap justify-between items-center gap-3">
        <div className="flex flex-wrap items-center gap-3 md:gap-4">
          <h1 className="text-2xl font-bold text-text-bright font-headline tracking-tight">데이터 파이프라인 설정</h1>
          <div className="h-6 w-px bg-white/10 hidden sm:block" />
          <Badge variant="accent" dot pulse>Live Pipeline</Badge>
          <div
            className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-white/10 bg-primary/50"
            title="활성 소스 수·스케줄 모드 기반 데모 점수"
          >
            <Shield className="w-3.5 h-3.5 text-accent shrink-0" aria-hidden />
            <span className="text-[11px] font-semibold text-text-bright tabular-nums">거버넌스 {govHealth.toFixed(1)}%</span>
          </div>
        </div>
      </header>

      <div className="space-y-6">
        {/* 데이터 소스 → 필터 → 목적지 (가로 동일 블록) */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">
          {/* Ingestion Sources */}
          <Card dim className="!p-6 md:!p-8 flex flex-col min-h-0">
            <h3 className="text-sm font-semibold text-text-bright font-headline mb-6 tracking-normal">
              데이터 소스 구성 <span className="text-surface-muted font-normal">(Ingestion Sources)</span>
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-1 gap-4 flex-1 min-h-0">
              {sources.map(source => (
                <button
                  key={source.id}
                  type="button"
                  onClick={() => toggleSource(source.id)}
                  className={`p-5 rounded-xl border transition-all text-left group ${
                    source.active ? 'border-accent bg-accent/5' : 'border-white/5 bg-primary/50 hover:bg-white/5'
                  }`}
                >
                  <div className="flex justify-between items-start mb-6">
                    <source.icon className={`w-8 h-8 transition-colors ${source.active ? 'text-accent' : 'text-surface-muted group-hover:text-text-dim'}`} />
                    <span className={`px-2 py-0.5 rounded-md text-[11px] font-semibold tracking-wide transition-colors ${
                      source.active ? 'bg-accent text-primary' : 'bg-primary text-surface-muted'
                    }`}>{source.tag}</span>
                  </div>
                  <h4 className="text-text-bright font-bold text-xs mb-1">{source.label}</h4>
                  <p className="text-surface-muted text-xs font-medium">{source.sub}</p>
                </button>
              ))}
            </div>
          </Card>

          {/* Complex Filtering */}
          <Card dim className="!p-6 md:!p-8 flex flex-col min-h-0">
            <h3 className="text-sm font-semibold text-text-bright font-headline mb-6 tracking-normal">
              복합 필터링 규칙 <span className="text-surface-muted font-normal">(Complex Filtering)</span>
            </h3>
            <div className="space-y-4 flex-1 min-h-0 overflow-y-auto max-h-[min(70vh,36rem)] lg:max-h-none lg:overflow-visible pr-1 custom-scrollbar">
              <AnimatePresence>
                {rules.map(rule => (
                  <motion.div
                    key={rule.id}
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, x: 40 }}
                    className={`flex flex-wrap items-center gap-4 p-5 bg-primary/50 rounded-xl border-l-4 ${
                      rule.severity === 'Critical' ? 'border-accent' : 'border-surface-card'
                    }`}
                  >
                    <span className={`text-xs font-semibold px-2 py-1 rounded-md uppercase tracking-wide ${
                      rule.severity === 'Critical' ? 'bg-accent/10 text-accent' : 'bg-white/5 text-text-dim'
                    }`}>If</span>
                    <span className="text-xs text-text-bright font-semibold">{rule.parts[0]}</span>
                    {rule.parts[1] && (
                      <>
                        <span className="text-xs text-surface-muted font-medium uppercase tracking-wide">{rule.connector}</span>
                        <span className="text-xs text-text-bright font-semibold">{rule.parts[1]}</span>
                      </>
                    )}
                    <div className="ml-auto flex items-center gap-3">
                      <span className={`text-[11px] font-semibold px-2 py-1 rounded-md tracking-wide uppercase ${
                        rule.severity === 'Critical' ? 'bg-red-500/20 text-red-400' : 'bg-white/5 text-surface-muted'
                      }`}>{rule.severity}</span>
                      <button
                        type="button"
                        onClick={() => deleteRule(rule.id)}
                        className="p-1.5 hover:bg-white/10 rounded transition-colors group/del"
                        title="규칙 삭제"
                      >
                        <Trash2 className="w-3.5 h-3.5 text-surface-muted group-hover/del:text-red-400 transition-colors" />
                      </button>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>

              <AnimatePresence>
                {showNewRule && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="p-5 bg-primary/50 rounded-xl border border-accent/30 space-y-4">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-accent uppercase tracking-wide">새 규칙 추가</span>
                        <button type="button" onClick={() => setShowNewRule(false)}>
                          <X className="w-4 h-4 text-surface-muted hover:text-text-bright" />
                        </button>
                      </div>
                      <div className="flex gap-3 flex-wrap">
                        <FormInput
                          placeholder="필드 (예: Temperature)"
                          value={newField}
                          onChange={e => setNewField(e.target.value)}
                          className="flex-1 min-w-28"
                        />
                        <FormSelect value={newOp} onChange={e => setNewOp(e.target.value)}>
                          {['>', '<', '>=', '<=', '==', '!='].map(op => <option key={op}>{op}</option>)}
                        </FormSelect>
                        <FormInput
                          placeholder="값 (예: 85.0)"
                          value={newVal}
                          onChange={e => setNewVal(e.target.value)}
                          className="flex-1 min-w-28"
                        />
                        <FormSelect
                          value={newSev}
                          onChange={e => setNewSev(e.target.value as 'Critical' | 'Warning')}
                        >
                          <option>Critical</option>
                          <option>Warning</option>
                        </FormSelect>
                      </div>
                      <button
                        type="button"
                        onClick={addRule}
                        className="w-full py-2 bg-accent text-primary text-xs font-semibold rounded-lg hover:brightness-110 transition-all"
                      >
                        규칙 추가
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {!showNewRule && (
                <button
                  type="button"
                  onClick={() => setShowNewRule(true)}
                  className="w-full py-4 border border-dashed border-white/10 rounded-xl text-surface-muted text-sm font-medium tracking-normal hover:border-accent/40 hover:text-text-bright transition-colors flex justify-center items-center gap-2"
                >
                  <PlusCircle className="w-4 h-4" />
                  새로운 규칙 추가
                </button>
              )}
            </div>
          </Card>

          {/* Destinations */}
          <Card dim className="!p-6 md:!p-8 flex flex-col min-h-0">
            <h3 className="text-sm font-semibold text-text-bright font-headline mb-6 tracking-normal">
              데이터 목적지 <span className="text-surface-muted font-normal">(Destinations)</span>
            </h3>
            <div className="space-y-4 flex-1 min-h-0">
              {destinations.map(dest => (
                <button
                  key={dest.id}
                  type="button"
                  onClick={() => toggleDestination(dest.id)}
                  className={`w-full flex items-center justify-between p-4 rounded-xl bg-primary/50 border border-white/5 transition-all ${
                    !dest.active ? 'opacity-40 hover:opacity-60' : 'hover:border-accent/30'
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-lg bg-surface-card flex items-center justify-center border border-white/5">
                      <dest.icon className="w-5 h-5 text-surface-muted" />
                    </div>
                    <span className="text-xs font-bold text-text-bright">{dest.label}</span>
                  </div>
                  <div className={`w-2 h-2 rounded-full transition-colors ${dest.active ? 'bg-accent' : 'bg-surface-muted'}`} />
                </button>
              ))}
            </div>
          </Card>
        </div>

        {/* 수집 스케줄링: 소스·필터·목적지 아래 전체 폭 */}
        <Card dim className="!p-6 md:!p-8">
          <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h4 className="text-text-bright font-bold text-xs flex items-center gap-2">
                <Timer className="w-4 h-4 text-accent" />
                수집 스케줄링 (Collection Scheduling)
              </h4>
              <span className="text-xs font-medium text-surface-muted">Timezone: UTC+09:00</span>
            </div>
            <div className="bg-primary/50 p-6 rounded-xl border border-white/5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="space-y-1">
                <div className="text-xs text-text-bright font-bold">
                  {scheduleMode === 'streaming' ? '실시간 스트리밍 모드' : '배치 처리 모드'}
                </div>
                <div className="text-xs text-surface-muted font-medium tracking-normal">
                  {scheduleMode === 'streaming'
                    ? '지연 시간: < 50ms, 최대 처리량: 10k msg/sec'
                    : '스케줄: 매 1시간, 최대 처리량: 500k records/batch'}
                </div>
              </div>
              <div className="flex gap-2 shrink-0">
                {([
                  { mode: 'batch',     label: '배치 처리' },
                  { mode: 'streaming', label: '스트리밍' },
                ] as const).map(({ mode, label }) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setScheduleMode(mode)}
                    className={`px-5 py-2.5 text-sm font-medium rounded-lg border border-white/5 tracking-normal transition-all ${
                      scheduleMode === mode ? 'bg-accent text-primary font-semibold' : 'bg-surface-card text-text-dim hover:bg-white/5'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* Bottom Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Ingestion Throughput */}
        <Card dim className="!p-6 md:!p-8 border-t-2 border-accent">
          <div className="text-xs text-surface-muted font-medium uppercase tracking-wide mb-3">Ingestion Throughput</div>
          <p className="text-[11px] text-surface-muted font-medium leading-snug tracking-normal mb-3">
            시간당 유입 추정치(GB/hr). 아래 막대는 최근 7시간(1시간 단위)별 부하를,{' '}
            <span className="text-text-dim">7개 구간 중 가장 높은 값을 100%</span>로 두고 나머지를 비율로 표시합니다(데모).
          </p>
          <Metric label="" value={scheduleMode === 'streaming' ? '4.2' : '1.8'} unit="GB/hr" size="lg" />
          <div className="mt-5" role="img" aria-label="최근 7시간 시간당 유입량 상대 추이 데모">
            <div className="flex justify-between text-[10px] text-surface-muted uppercase tracking-wide mb-1">
              <span>낮음</span>
              <span className="normal-case tracking-normal text-surface-muted/80">최근 7시간</span>
              <span>높음</span>
            </div>
            <div className="flex items-end gap-1.5 h-20 border-b border-white/10 pb-px">
              {ingestionBars.map((b, i) => {
                const hNorm = (b.rel / ingestionPeakRel) * 100;
                const isLast = i === ingestionBars.length - 1;
                return (
                  <div key={b.id} className="flex-1 flex flex-col items-center justify-end gap-1.5 min-w-0 h-full group">
                    <div
                      className={`w-full max-w-[2.25rem] mx-auto rounded-t-sm transition-colors ${
                        isLast ? 'bg-accent/75 ring-1 ring-accent/25' : 'bg-white/10 group-hover:bg-white/15'
                      }`}
                      style={{ height: `${Math.max(8, hNorm)}%` }}
                      title={b.title}
                    />
                    <span className="text-[9px] font-medium text-surface-muted tabular-nums leading-none text-center truncate w-full">{b.short}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </Card>

        {/* Data Quality Score */}
        <Card dim className="!p-6 md:!p-8">
          <div className="text-xs text-surface-muted font-medium uppercase tracking-wide mb-3">Data Quality Score</div>
          <Metric label="" value="99.2" unit="%" size="lg" />
          <ProgressBar value={99.2} className="mt-6" />
          <div className="mt-3 text-xs font-medium text-accent tracking-normal">Missing Values: 0.08%</div>
        </Card>

        {/* Active Alerts */}
        <Card dim className="!p-6 md:!p-8">
          <div className="text-xs text-surface-muted font-medium uppercase tracking-wide mb-3">Active Alerts</div>
          <p className="text-[11px] text-surface-muted font-medium leading-snug tracking-normal mb-3">
            미해결 사고 건수. 아래 막대는 지난 7일 <span className="text-text-dim">일별 신규 발생</span> 건수(데모).
          </p>
          <Metric label="" value={ACTIVE_INCIDENTS_NOW} unit="Incidents" size="lg" />
          <div className="mt-2 flex flex-wrap items-baseline gap-x-4 gap-y-1 text-[11px] font-medium tracking-normal">
            <span className="text-surface-muted">
              전일 동시간 대비{' '}
              <span
                className={`tabular-nums ${incidentDiff < 0 ? 'text-accent' : incidentDiff > 0 ? 'text-amber-400/90' : 'text-text-dim'}`}
                title="전일 이 시각 기준 활성 사고 수와의 차이(데모)"
              >
                {incidentDiff > 0 ? '+' : ''}{incidentDiff}건
              </span>
            </span>
            <span className="text-surface-muted">
              7일 누계 <span className="text-text-bright tabular-nums">{ALERT_INCIDENTS_7D.reduce((a, b) => a + b, 0)}건</span>
              <span className="text-surface-muted/80 font-normal"> · 전주 동기간 대비 </span>
              <span className="text-accent tabular-nums" title="전주 같은 7일 창 대비(데모)">−2건</span>
            </span>
          </div>
          <div className="mt-4" role="img" aria-label="지난 7일 일별 신규 사고 건수 데모 막대 그래프">
            <div className="flex items-end gap-1 h-12 border-b border-white/10 pb-px">
              {ALERT_INCIDENTS_7D.map((v, i) => {
                const isToday = i === ALERT_INCIDENTS_7D.length - 1;
                const h = Math.max(12, (v / alertIncidentsPeak) * 100);
                return (
                  <div key={i} className="flex-1 flex flex-col items-center justify-end gap-1 min-w-0 h-full">
                    <div
                      className={`w-full max-w-[1.75rem] mx-auto rounded-t-sm ${
                        isToday ? 'bg-accent/70 ring-1 ring-accent/20' : 'bg-white/10'
                      }`}
                      style={{ height: `${h}%` }}
                      title={`${ALERT_INCIDENTS_7D.length - 1 - i}일 전: ${v}건`}
                    />
                  </div>
                );
              })}
            </div>
            <div className="flex justify-between text-[9px] text-surface-muted mt-1 tabular-nums">
              <span>−6d</span>
              <span className="text-surface-muted/80">오늘</span>
            </div>
          </div>
          <div className="mt-5 flex items-center gap-2 text-xs font-medium text-accent tracking-normal">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            모든 시스템 정상 작동 중
          </div>
        </Card>
      </div>

    </div>
  );
};
