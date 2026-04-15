import React, { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Play,
  Pause,
  RotateCcw,
  Share2,
  Zap,
  Database,
  CircleHelp,
} from 'lucide-react';

type PipelineStatus = 'running' | 'paused' | 'idle';

interface LogEntry {
  id: number;
  time: string;
  type: 'INFO' | 'WARN' | 'ERROR';
  msg: string;
}

let logIdCounter = 0;
const makeLog = (type: LogEntry['type'], msg: string): LogEntry => {
  const d = new Date();
  const time = `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}:${String(d.getSeconds()).padStart(2,'0')}.${String(d.getMilliseconds()).padStart(3,'0').slice(0,2)}`;
  return { id: ++logIdCounter, time, type, msg };
};

const INITIAL_LOGS: LogEntry[] = [
  makeLog('INFO', '센서 데이터 수집 시작: EQ-MOTOR-07, EQ-PUMP-03, EQ-COMP-02 (100ms 인터벌)'),
  makeLog('WARN', 'EQ-MOTOR-07 currT 채널 순간 지연 감지 (처리 지연 >10ms).'),
  makeLog('INFO', '품질 검증 통과 — 배치 #429 (레코드 12,800건, 성공률 99.97%).'),
  makeLog('INFO', '파티션 커밋 완료. TX-99238-K-82 (plant=deoksan/dt=2024-01-20).'),
  makeLog('INFO', 'HDFS 노드간 복제 동기화 완료 — 복제팩터 3 유지 중.'),
];

/** 실행 중 주기적으로 추가되는 데모 로그 메시지 풀 */
const LIVE_LOG_TEMPLATES: { type: LogEntry['type']; msg: string }[] = [
  { type: 'INFO', msg: '배치 커밋 완료 — micro-batch 128ms, 레코드 2,400건.' },
  { type: 'INFO', msg: 'EQ-PUMP-03 진동 FFT 윈도우 계산 완료 (샘플 2048).' },
  { type: 'INFO', msg: 'Kafka consumer lag 안정: factory/sensor/v1 (12~18ms).' },
  { type: 'WARN', msg: 'EQ-COMP-02 VoltR 샘플 3건이 QA 임계값 근접 (±2%).' },
  { type: 'INFO', msg: 'Checkpoint barrier #18492 — 상태 백엔드 RocksDB flush OK.' },
  { type: 'INFO', msg: 'Tez DAG 스케줄: stage-reduce-04 대기 큐 2 → 실행 전환.' },
  { type: 'INFO', msg: 'S3 multipart upload 세션 갱신 — part 18/32 업로드됨.' },
  { type: 'WARN', msg: '네트워크 RTT 스파이크: EU-West 게이트웨이 42ms (평균 대비 +15ms).' },
  { type: 'INFO', msg: '역직렬화 스레드 풀 사용률 62% — 워커 확장 불필요.' },
];

/** 아카이브/모니터의 처리 노드와 대응시키기 위한 데모 Executor ID (8슬롯) */
const EXECUTOR_IDS = Array.from({ length: 8 }, (_, i) => `EX-${String(i + 1).padStart(2, '0')}`);

interface StageMappingRow {
  stage: string;
  labelKo: string;
}

const STAGE_DEFS: StageMappingRow[] = [
  { stage: 'Ingress', labelKo: '수집' },
  { stage: 'Transform', labelKo: '변환' },
  { stage: 'Validate', labelKo: '검증' },
  { stage: 'Egress', labelKo: '적재' },
];

const WORKER_ROWS = [
  { name: 'Worker-KR-Gumi', role: 'Primary', execRange: 'EX-01—03' },
  { name: 'Worker-KR-Changwon', role: 'Standby', execRange: '—' },
  { name: 'Worker-KR-Ulsan', role: 'Active', execRange: 'EX-04—06' },
  { name: 'Worker-KR-Incheon', role: 'Active', execRange: 'EX-07—08' },
] as const;

export const OrchestrationView = () => {
  const [status, setStatus] = useState<PipelineStatus>('running');
  const [logs, setLogs] = useState<LogEntry[]>(INITIAL_LOGS);
  const [metrics, setMetrics] = useState({ successRate: 99.98, latency: 12.4, activeNodes: 1248 });
  const [cpuUtil, setCpuUtil] = useState(70);
  const [throughput, setThroughput] = useState('8.4 GB/s');
  const [queueRps, setQueueRps] = useState(4820);
  const [ingressLagMs, setIngressLagMs] = useState(12);
  /** Executor 슬롯별 부하(%) — 토폴로지 스트립에 반영 */
  const [executorLoad, setExecutorLoad] = useState<number[]>(() =>
    [38, 52, 61, 44, 73, 58, 49, 66],
  );
  /** 스테이지별 실행 매핑(데모 수치) */
  const [stageStats, setStageStats] = useState(() => [
    { executors: 2, subtasks: 52, bp: '없음' as const },
    { executors: 4, subtasks: 128, bp: '낮음' as const },
    { executors: 3, subtasks: 96, bp: '낮음' as const },
    { executors: 2, subtasks: 40, bp: '없음' as const },
  ]);
  /** 로그 영역 스크롤 컨테이너 — scrollIntoView 금지(메인 화면이 따라 내려가는 현상 방지) */
  const logScrollRef = useRef<HTMLDivElement>(null);
  /** 사용자가 맨 아래 근처에 있을 때만 신규 로그에 맞춰 자동 스크롤 */
  const stickLogsToBottomRef = useRef(true);

  const push = useCallback((type: LogEntry['type'], msg: string) => {
    setLogs(prev => [...prev.slice(-30), makeLog(type, msg)]);
  }, []);

  const handleLogPanelScroll = () => {
    const el = logScrollRef.current;
    if (!el) return;
    const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    stickLogsToBottomRef.current = distFromBottom < 48;
  };

  useEffect(() => {
    const el = logScrollRef.current;
    if (!el || !stickLogsToBottomRef.current) return;
    el.scrollTop = el.scrollHeight;
  }, [logs]);

  /** running 동안 실시간 로그 스트림 시뮬레이션 */
  useEffect(() => {
    if (status !== 'running') return;
    const id = window.setInterval(() => {
      const pick = LIVE_LOG_TEMPLATES[Math.floor(Math.random() * LIVE_LOG_TEMPLATES.length)];
      push(pick.type, pick.msg);
    }, 2600);
    return () => window.clearInterval(id);
  }, [status, push]);

  /** running 동안 처리량·지연·CPU·큐 등 텔레메트리 숫자 갱신 */
  useEffect(() => {
    if (status !== 'running') return;
    const id = window.setInterval(() => {
      setThroughput(`${(7.3 + Math.random() * 2.5).toFixed(1)} GB/s`);
      setCpuUtil(u => Math.min(86, Math.max(52, Math.round(u + (Math.random() - 0.5) * 10))));
      setQueueRps(q => Math.min(6200, Math.max(3800, Math.round(q + (Math.random() - 0.5) * 420))));
      setIngressLagMs(l => Math.min(22, Math.max(8, Math.round(l + (Math.random() - 0.5) * 4))));
      setMetrics(m => ({
        ...m,
        latency: Math.round(Math.min(19, Math.max(9, m.latency + (Math.random() - 0.5) * 1.6)) * 10) / 10,
        successRate: Math.round(Math.min(99.99, Math.max(99.88, m.successRate + (Math.random() - 0.5) * 0.02)) * 1000) / 1000,
        activeNodes: Math.round(1230 + Math.random() * 36),
      }));
      setExecutorLoad(prev =>
        prev.map(v => Math.min(94, Math.max(18, Math.round(v + (Math.random() - 0.5) * 14)))),
      );
      setStageStats(prev =>
        prev.map(s => ({
          executors: Math.min(6, Math.max(1, s.executors + (Math.random() > 0.85 ? (Math.random() > 0.5 ? 1 : -1) : 0))),
          subtasks: Math.min(180, Math.max(32, s.subtasks + Math.round((Math.random() - 0.5) * 14))),
          bp: s.bp,
        })),
      );
    }, 1150);
    return () => window.clearInterval(id);
  }, [status]);

  const handleRun = () => {
    stickLogsToBottomRef.current = true;
    setStatus('running');
    setMetrics({ successRate: 99.98, latency: 12.4, activeNodes: 1248 });
    setCpuUtil(70);
    setThroughput('8.4 GB/s');
    setQueueRps(4820);
    setIngressLagMs(12);
    setExecutorLoad([38, 52, 61, 44, 73, 58, 49, 66]);
    setStageStats([
      { executors: 2, subtasks: 52, bp: '없음' },
      { executors: 4, subtasks: 128, bp: '낮음' },
      { executors: 3, subtasks: 96, bp: '낮음' },
      { executors: 2, subtasks: 40, bp: '없음' },
    ]);
    push('INFO', '파이프라인 시작 — 오퍼레이터 수동 실행.');
    push('INFO', '센서 수집 재개: EQ-MOTOR-07, EQ-PUMP-03, EQ-COMP-02');
  };

  const handlePause = () => {
    setStatus('paused');
    setMetrics(prev => ({ ...prev, activeNodes: 0 }));
    setCpuUtil(0);
    setThroughput('0 GB/s');
    push('WARN', '파이프라인 일시정지 — 오퍼레이터 요청. 활성 노드 드레인 완료.');
  };

  const handleRollback = () => {
    setStatus('idle');
    setMetrics({ successRate: 99.92, latency: 8.1, activeNodes: 0 });
    setCpuUtil(0);
    setThroughput('0 GB/s');
    push('WARN', '롤백 시작 — 마지막 체크포인트 TX-99238-K-82 (plant=deoksan) 복원 중.');
    setTimeout(() => push('INFO', '롤백 완료. 파이프라인 idle 상태로 초기화.'), 600);
  };

  const statusLabel: Record<PipelineStatus, string> = { running: 'Running', paused: 'Paused', idle: 'Idle' };
  const dotCls: Record<PipelineStatus, string> = {
    running: 'bg-accent animate-pulse',
    paused: 'bg-yellow-400',
    idle: 'bg-surface-muted',
  };
  const textCls: Record<PipelineStatus, string> = {
    running: 'text-accent',
    paused: 'text-yellow-400',
    idle: 'text-surface-muted',
  };

  type MetricCard = {
    label: string;
    value: string;
    change: string;
    color: string;
    sublabel?: string;
  };
  const metricItems: MetricCard[] = [
    { label: 'Automated Test Success Rate', value: `${metrics.successRate}%`, change: '+0.04%', color: 'text-accent' },
    { label: 'Average System Latency', value: `${metrics.latency}ms`, change: status === 'running' ? '+1.2ms' : '—', color: status === 'running' ? 'text-red-400' : 'text-surface-muted' },
    {
      label: 'Active Executors (pool)',
      sublabel: '물리 노드 수가 아니라 스케줄 단위',
      value: metrics.activeNodes.toLocaleString(),
      change: status === 'running' ? 'Stable' : 'Stopped',
      color: status === 'running' ? 'text-accent' : 'text-surface-muted',
    },
  ];

  return (
    <div className="space-y-8">
      <header className="flex justify-between items-end">
        <div>
          <nav className="flex text-xs text-surface-muted gap-2 mb-2 font-medium uppercase tracking-wide">
            <span>Pipelines</span><span>/</span>
            <span className="text-accent">제조 센서 실시간 수집 파이프라인</span>
          </nav>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-3xl font-bold font-headline tracking-tight text-text-bright">오케스트레이션 및 테스트 자동화</h1>
            <span className={`flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide ${textCls[status]}`}>
              <span className={`w-2 h-2 rounded-full ${dotCls[status]}`} />
              {statusLabel[status]}
            </span>
          </div>
          <details className="mt-2 max-w-3xl group">
            <summary className="flex cursor-pointer list-none items-center gap-1.5 text-xs font-medium text-surface-muted transition-colors hover:text-accent [&::-webkit-details-marker]:hidden">
              <CircleHelp className="w-3.5 h-3.5 shrink-0 opacity-80" aria-hidden />
              도움말
              <span className="text-surface-muted/70 font-normal">(화면 구성)</span>
            </summary>
            <p className="mt-2 border-l border-surface-muted/30 pl-4 text-sm text-text-dim tracking-normal">
              상단은 <span className="text-text-bright/90">파이프라인 스테이지(DAG)</span>, 하단은{' '}
              <span className="text-text-bright/90">실행 클러스터(Executor 8슬롯)</span>와 스테이지 매핑입니다. 아카이브의「노드 처리량」과 혼동되지 않도록 구분했습니다.
            </p>
          </details>
        </div>

        <div className="flex items-center gap-2 bg-surface-card/50 p-1 rounded-lg border border-white/5">
          <button
            type="button"
            onClick={handleRun}
            disabled={status === 'running'}
            className={`flex items-center gap-2 px-5 py-2 rounded-md font-semibold text-sm transition-all ${
              status === 'running' ? 'bg-accent/20 text-accent/40 cursor-not-allowed' : 'bg-accent text-primary hover:opacity-95'
            }`}
          >
            <Play className="w-3.5 h-3.5 fill-current" />Run
          </button>
          <button
            type="button"
            onClick={handlePause}
            disabled={status !== 'running'}
            className={`flex items-center gap-2 px-5 py-2 rounded-md font-medium text-sm transition-colors ${
              status !== 'running' ? 'text-surface-muted cursor-not-allowed' : 'hover:bg-white/5 text-text-dim'
            }`}
          >
            <Pause className="w-3.5 h-3.5" />Pause
          </button>
          <button
            type="button"
            onClick={handleRollback}
            className="flex items-center gap-2 px-5 py-2 rounded-md hover:bg-red-500/10 text-red-400 font-medium text-sm transition-colors"
          >
            <RotateCcw className="w-3 h-3" />Rollback
          </button>
        </div>
      </header>

      <div className="grid grid-cols-12 gap-6">
        {/* Metrics */}
        {metricItems.map((m, i) => (
          <div key={i} className="col-span-12 lg:col-span-4 bg-surface-card/30 rounded-xl p-6 border border-white/5">
            <p className="text-surface-muted text-xs font-medium uppercase tracking-wide mb-0.5">{m.label}</p>
            {m.sublabel ? (
              <p className="mb-2 text-[10px] tracking-normal text-surface-muted/90">{m.sublabel}</p>
            ) : null}
            <div className="flex items-baseline gap-3">
              <span className="text-4xl font-bold font-headline text-text-bright">{m.value}</span>
              <span className={`${m.color} text-xs font-semibold`}>{m.change}</span>
            </div>
          </div>
        ))}

        {/* Node Canvas */}
        <div className="col-span-12 xl:col-span-8 bg-surface-card/20 rounded-xl relative overflow-hidden border border-white/5">
          {/* Canvas header */}
          <div className="px-6 py-3 border-b border-white/5 flex flex-wrap items-center justify-between gap-2">
            <div>
              <span className="text-[11px] font-semibold uppercase tracking-wide text-surface-muted">Pipeline DAG — 제조 센서 실시간 수집</span>
              <p className="text-[10px] text-text-dim/80 mt-0.5 tracking-normal">처리 단계(스테이지). 물리 노드 8대와는 다른 개념입니다.</p>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-[11px] text-surface-muted">Throughput</span>
              <span className={`text-[11px] font-bold font-mono ${status === 'running' ? 'text-accent' : 'text-surface-muted'}`}>{throughput}</span>
            </div>
          </div>

          {/* Top row: 4-stage pipeline */}
          <div className="px-6 pt-6 pb-3 flex items-stretch gap-0">
            {/* Stage 1: Ingress */}
            <motion.div whileHover={{ scale: 1.01 }}
              className={`flex-1 bg-primary rounded-xl p-4 shadow-md z-20 border transition-colors duration-500 ${
                status === 'running' ? 'border-accent/25' : 'border-white/10'
              }`}>
              <div className="flex items-center justify-between mb-3">
                <span className={`text-[10px] px-2 py-0.5 rounded-md font-bold uppercase tracking-wide ${
                  status === 'running' ? 'bg-accent/10 text-accent' : 'bg-white/5 text-surface-muted'
                }`}>Ingress</span>
                <div className={`w-1.5 h-1.5 rounded-full ${status === 'running' ? 'bg-accent animate-pulse' : 'bg-surface-muted'}`} />
              </div>
              <h3 className="font-semibold text-xs text-text-bright mb-0.5">Data Collector V2</h3>
              <p className="text-[11px] text-surface-muted mb-3">Kafka-Cluster-01</p>
              <div className="space-y-1.5">
                <div className="flex justify-between text-[10px]">
                  <span className="text-surface-muted">Queue</span>
                  <span className={`font-mono font-semibold ${status === 'running' ? 'text-text-bright' : 'text-surface-muted'}`}>
                    {status === 'running' ? `${queueRps.toLocaleString()} msg/s` : '—'}
                  </span>
                </div>
                <div className="flex justify-between text-[10px]">
                  <span className="text-surface-muted">Topics</span>
                  <span className="font-mono text-text-dim">factory/+/sensor/#</span>
                </div>
                <div className="flex justify-between text-[10px]">
                  <span className="text-surface-muted">Lag</span>
                  <span className={`font-mono font-semibold ${status === 'running' ? 'text-accent' : 'text-surface-muted'}`}>
                    {status === 'running' ? `${ingressLagMs} ms` : '—'}
                  </span>
                </div>
              </div>
            </motion.div>

            {/* Connector 1→2 */}
            <div className="flex items-center px-1.5 shrink-0">
              <div className={`w-8 h-px opacity-40 ${status === 'running' ? 'flow-line' : 'bg-white/10'}`} />
            </div>

            {/* Stage 2: Transform */}
            <motion.div whileHover={{ scale: 1.01 }}
              className={`flex-1 bg-primary rounded-xl p-4 shadow-md z-20 border transition-colors duration-500 ${
                status === 'running' ? 'border-accent/35 ring-1 ring-accent/10' : 'border-white/10'
              }`}>
              <div className="flex items-center justify-between mb-3">
                <span className={`text-[10px] px-2 py-0.5 rounded-md font-bold uppercase tracking-wide ${
                  status === 'running' ? 'bg-accent/10 text-accent' : 'bg-white/5 text-surface-muted'
                }`}>Transform</span>
                <Zap className={`w-3 h-3 fill-current ${status === 'running' ? 'text-accent' : 'text-surface-muted'}`} />
              </div>
              <h3 className="font-semibold text-xs text-text-bright mb-0.5">Stream Aggregator</h3>
              <p className="text-[11px] text-surface-muted mb-3">Partitioning & Schema</p>
              <div className="space-y-1.5">
                <div className="flex justify-between text-[10px]">
                  <span className="text-surface-muted">CPU</span>
                  <span className={`font-mono font-semibold ${status === 'running' ? 'text-text-bright' : 'text-surface-muted'}`}>
                    {status === 'running' ? `${cpuUtil}%` : '0%'}
                  </span>
                </div>
                <div className="h-1 rounded-full bg-white/5 overflow-hidden">
                  <motion.div className="bg-accent h-full" animate={{ width: status === 'running' ? `${cpuUtil}%` : '0%' }} transition={{ duration: 0.6 }} />
                </div>
                <div className="flex justify-between text-[10px]">
                  <span className="text-surface-muted">Executor pool</span>
                  <span className={`font-mono font-semibold ${status === 'running' ? 'text-accent' : 'text-surface-muted'}`}>
                    {status === 'running' ? `${metrics.activeNodes.toLocaleString()}` : '0'}
                  </span>
                </div>
              </div>
            </motion.div>

            {/* Connector 2→3 */}
            <div className="flex items-center px-1.5 shrink-0">
              <div className={`w-8 h-px opacity-40 ${status === 'running' ? 'flow-line' : 'bg-white/10'}`} />
            </div>

            {/* Stage 3: Validate */}
            <motion.div whileHover={{ scale: 1.01 }}
              className={`flex-1 bg-primary rounded-xl p-4 shadow-md z-20 border transition-colors duration-500 ${
                status === 'running' ? 'border-accent/20' : 'border-white/10'
              }`}>
              <div className="flex items-center justify-between mb-3">
                <span className={`text-[10px] px-2 py-0.5 rounded-md font-bold uppercase tracking-wide ${
                  status === 'running' ? 'bg-accent/10 text-accent' : 'bg-white/5 text-surface-muted'
                }`}>Validate</span>
                <div className={`w-1.5 h-1.5 rounded-full ${status === 'running' ? 'bg-accent' : 'bg-surface-muted'}`} />
              </div>
              <h3 className="font-semibold text-xs text-text-bright mb-0.5">Schema & QA Gate</h3>
              <p className="text-[11px] text-surface-muted mb-3">sensors.deoksan_equipment</p>
              <div className="space-y-1.5">
                <div className="flex justify-between text-[10px]">
                  <span className="text-surface-muted">Pass Rate</span>
                  <span className={`font-mono font-semibold ${status === 'running' ? 'text-accent' : 'text-surface-muted'}`}>
                    {status === 'running' ? `${metrics.successRate}%` : '—'}
                  </span>
                </div>
                <div className="flex justify-between text-[10px]">
                  <span className="text-surface-muted">Checks</span>
                  <span className="font-mono text-text-dim">PT100·Vibra·3φ</span>
                </div>
                <div className="flex justify-between text-[10px]">
                  <span className="text-surface-muted">Latency</span>
                  <span className={`font-mono font-semibold ${status === 'running' ? 'text-text-bright' : 'text-surface-muted'}`}>
                    {status === 'running' ? `${metrics.latency}ms` : '—'}
                  </span>
                </div>
              </div>
            </motion.div>

            {/* Connector 3→4 */}
            <div className="flex items-center px-1.5 shrink-0">
              <div className={`w-8 h-px opacity-40 ${status === 'running' ? 'flow-line' : 'bg-white/10'}`} />
            </div>

            {/* Stage 4: Egress */}
            <motion.div whileHover={{ scale: 1.01 }}
              className="flex-1 bg-primary border border-white/10 rounded-xl p-4 shadow-md z-20">
              <div className="flex items-center justify-between mb-3">
                <span className="bg-white/5 text-text-dim text-[10px] px-2 py-0.5 rounded-md font-bold uppercase tracking-wide">Egress</span>
                <Database className="w-3 h-3 text-text-dim" />
              </div>
              <h3 className="font-semibold text-xs text-text-bright mb-0.5">Cold Storage</h3>
              <p className="text-[11px] text-surface-muted mb-3">S3-Archive-A / HDFS</p>
              <div className="space-y-1.5">
                <div className="flex justify-between text-[10px]">
                  <span className="text-surface-muted">State</span>
                  <span className={`font-mono font-semibold ${status === 'running' ? 'text-accent' : 'text-surface-muted'}`}>
                    {status === 'running' ? 'Writing' : 'Waiting'}
                  </span>
                </div>
                <div className="flex justify-between text-[10px]">
                  <span className="text-surface-muted">Partition</span>
                  <span className="font-mono text-text-dim">dt/equip_id</span>
                </div>
                <div className="flex justify-between text-[10px]">
                  <span className="text-surface-muted">Replicas</span>
                  <span className="font-mono text-text-dim">×3</span>
                </div>
              </div>
            </motion.div>
          </div>

          {/* Bottom row: data source tags + destination tags */}
          <div className="px-6 pb-5 grid grid-cols-2 gap-4">
            {/* Sources */}
            <div className="bg-primary/40 rounded-lg p-3 border border-white/5">
              <p className="text-[10px] font-semibold text-surface-muted uppercase tracking-wide mb-2">Data Sources</p>
              <div className="flex flex-wrap gap-1.5">
                {[
                  { label: 'MQTT', sub: 'EQ-MOTOR/PUMP/COMP', active: true },
                  /** 현장 SCADA·PLC 등 설비 표준 연동 채널 — UI에는 출처 중심 라벨 */
                  { label: '현장 SCADA', sub: '설비 표준 연동 · 4840', active: true },
                  { label: 'SQL', sub: 'MES Master DB', active: false },
                ].map(src => (
                  <div key={src.label + src.sub}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-[10px] font-medium ${
                      src.active && status === 'running'
                        ? 'bg-accent/5 border-accent/20 text-accent'
                        : 'bg-white/3 border-white/5 text-surface-muted'
                    }`}>
                    <div className={`w-1 h-1 rounded-full ${src.active && status === 'running' ? 'bg-accent animate-pulse' : 'bg-surface-muted'}`} />
                    <span>{src.label}</span>
                    <span className="text-surface-muted font-normal opacity-70">{src.sub}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Destinations */}
            <div className="bg-primary/40 rounded-lg p-3 border border-white/5">
              <p className="text-[10px] font-semibold text-surface-muted uppercase tracking-wide mb-2">Destinations</p>
              <div className="flex flex-wrap gap-1.5">
                {[
                  { label: 'HDFS', sub: 'Cold Archive', active: true },
                  { label: 'MES', sub: 'RT Feed', active: true },
                  { label: 'SCADA', sub: 'Historian', active: true },
                  { label: 'Azure DL', sub: 'Backup', active: false },
                ].map(dst => (
                  <div key={dst.label}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-[10px] font-medium ${
                      dst.active && status === 'running'
                        ? 'bg-accent/5 border-accent/20 text-accent'
                        : 'bg-white/3 border-white/5 text-surface-muted'
                    }`}>
                    <div className={`w-1 h-1 rounded-full ${dst.active && status === 'running' ? 'bg-accent' : 'bg-surface-muted'}`} />
                    <span>{dst.label}</span>
                    <span className="text-surface-muted font-normal opacity-70">{dst.sub}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Executor 8슬롯 토폴로지 — 아카이브 NODE 01~08과 같은 시각적 밀도 */}
          <div className="border-t border-white/5 px-6 py-4">
            <div className="mb-2 flex flex-wrap items-end justify-between gap-2">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-surface-muted">Executor cluster</span>
              <span className="text-[10px] tracking-normal text-text-dim">슬롯별 부하(데모). 스테이지 카드와 동기 갱신</span>
            </div>
            <div className="flex items-stretch justify-between gap-1 rounded-lg border border-white/5 bg-primary/40 px-2 py-3 sm:px-3">
              {EXECUTOR_IDS.map((id, i) => {
                const load = executorLoad[i] ?? 0;
                const hot = load > 78;
                const warm = load > 52;
                return (
                  <div
                    key={id}
                    className="flex min-w-0 flex-1 flex-col items-center gap-1.5"
                    title={`${id} · 부하 약 ${load}%`}
                  >
                    <div
                      className={`flex h-8 w-full max-w-[28px] flex-col justify-end rounded-sm border border-white/10 ${
                        status !== 'running' ? 'bg-white/5' : 'bg-primary/80'
                      }`}
                    >
                      <motion.div
                        className={`w-full rounded-sm ${hot ? 'bg-red-400/95' : warm ? 'bg-accent/85' : 'bg-accent/50'}`}
                        initial={false}
                        animate={{ height: status === 'running' ? `${Math.min(100, load)}%` : '12%' }}
                        transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
                      />
                    </div>
                    <span className="truncate text-[9px] font-mono text-surface-muted">{id}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 스테이지 → 실행 매핑 */}
          <div className="px-6 pb-5">
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-surface-muted">Stage → 실행 매핑</p>
            <div className="overflow-hidden rounded-lg border border-white/5 text-left text-[10px]">
              <table className="w-full border-collapse">
                <thead className="bg-primary/50 text-surface-muted">
                  <tr>
                    <th className="px-3 py-2 font-medium">Stage</th>
                    <th className="px-3 py-2 font-medium">Executors</th>
                    <th className="px-3 py-2 font-medium">Subtasks</th>
                    <th className="px-3 py-2 font-medium">Backpressure</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 text-text-dim">
                  {STAGE_DEFS.map((row, i) => {
                    const s = stageStats[i];
                    return (
                      <tr key={row.stage} className="bg-primary/20">
                        <td className="px-3 py-2 font-semibold text-text-bright">
                          {row.stage}
                          <span className="ml-1 font-normal text-surface-muted">({row.labelKo})</span>
                        </td>
                        <td className="px-3 py-2 font-mono text-text-bright">{status === 'running' ? s.executors : '—'}</td>
                        <td className="px-3 py-2 font-mono text-text-bright">{status === 'running' ? s.subtasks : '—'}</td>
                        <td className="px-3 py-2">{status === 'running' ? s.bp : '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Logs + Workers */}
        <div className="col-span-12 xl:col-span-4 flex flex-col gap-6">
          <div className="flex-1 bg-surface-card/30 rounded-xl flex flex-col overflow-hidden border border-white/5">
            <div className="px-6 py-4 bg-primary/50 border-b border-white/5 flex justify-between items-center">
              <span className="text-xs font-semibold tracking-wide text-text-dim uppercase">Real-time Logs</span>
              <div className="flex gap-1.5">
                <div className={`w-1.5 h-1.5 rounded-full ${status === 'running' ? 'bg-accent animate-pulse' : 'bg-surface-muted'}`} />
                <div className="w-1.5 h-1.5 rounded-full bg-white/10" />
              </div>
            </div>
            <div
              ref={logScrollRef}
              onScroll={handleLogPanelScroll}
              className="max-h-64 flex-1 space-y-3 overflow-y-auto p-6 font-mono text-xs custom-scrollbar"
            >
              <AnimatePresence initial={false}>
                {logs.map(log => (
                  <motion.div key={log.id} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className="flex gap-3">
                    <span className="text-surface-muted shrink-0">{log.time}</span>
                    <span className={`shrink-0 font-bold ${log.type === 'WARN' ? 'text-yellow-400' : log.type === 'ERROR' ? 'text-red-400' : 'text-accent'}`}>
                      [{log.type}]
                    </span>
                    <span className="text-text-dim">{log.msg}</span>
                  </motion.div>
                ))}
              </AnimatePresence>
              <div className="text-text-dim/30 italic">
                {status === 'running' ? 'Listening for new telemetry signals...' : 'Pipeline stopped.'}
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-surface-card to-primary rounded-xl border border-white/10 p-6">
            <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-accent">Worker 프로세스</h4>
            <p className="mb-4 text-[10px] tracking-normal text-text-dim">Executor 슬롯을 호스트에 매핑(데모)</p>
            <div className="max-h-52 space-y-3 overflow-y-auto pr-1 custom-scrollbar">
              {WORKER_ROWS.map((w, i) => (
                <div key={i} className="flex items-center justify-between gap-2 border-b border-white/5 pb-3 last:border-0 last:pb-0">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/5 bg-primary">
                      <Share2 className="h-4 w-4 text-text-dim" />
                    </div>
                    <div className="min-w-0">
                      <span className="block truncate text-xs font-bold text-text-bright">{w.name}</span>
                      <span className="text-[10px] font-mono text-surface-muted">슬롯 {w.execRange}</span>
                    </div>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${
                      w.role === 'Primary' && status === 'running'
                        ? 'bg-accent/10 text-accent'
                        : w.role === 'Active' && status === 'running'
                          ? 'bg-white/10 text-text-bright'
                          : 'bg-white/5 text-text-dim'
                    }`}
                  >
                    {w.role}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
