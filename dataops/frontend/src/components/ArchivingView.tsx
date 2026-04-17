import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Database,
  Play,
  Filter,
  Loader2,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Archive,
  HardDrive,
} from 'lucide-react';
import { Card, CardHeader, CardLabel, SectionHeader, ProgressBar, LabeledProgressBar, Chip, Metric } from './ui';

interface ArchiveRecord {
  id: string;
  jobId: string;
  destination: string;
  rowCount: number;
  elapsed: number;
  archivedAt: string;
}

const INITIAL_ARCHIVE_HISTORY: ArchiveRecord[] = [
  { id: 'arc-1', jobId: 'PWR-ARC-77201', destination: 'HDFS 아카이브', rowCount: 86400, elapsed: 4820, archivedAt: '2021-04-01 00:00~24:00' },
  { id: 'arc-2', jobId: 'PWR-ARC-77188', destination: 'HDFS 아카이브', rowCount: 86400, elapsed: 5130, archivedAt: '2021-03-31 00:00~24:00' },
  { id: 'arc-3', jobId: 'PWR-ARC-77120', destination: 'Object Storage',    rowCount: 259200, elapsed: 11200, archivedAt: '2021-03-01~31 (월간)' },
];

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

const DEFAULT_HIVE_QUERY = `-- 덕산공장 전력 품질 데이터 조회 (deoksan_equipment)
-- 3상 전압(VoltR/S/T), 3상 전류(currR/S/T), 누전(Ground), 온도(PT100)
SELECT
  time,
  VoltR, VoltS, VoltT,           -- 3상 전압 (정상: 220V ± 10%)
  currR, currS, currT, curr,      -- 3상 전류 + 합산전류
  Ground,                         -- 누전 전류 (임계값: 5A)
  PT100, Vibra                    -- 권선 온도, 진동
FROM sensors.deoksan_equipment
WHERE dt = '2021-04-01'
  AND (VoltR < 200.0 OR VoltS < 200.0 OR Ground > 5.0)
PARTITION BY (dt, equipment_id)
CLUSTER BY time
LIMIT 100;`;

const FALLBACK_JOBS = [
  { id: 'PWR-JOB-88291', status: 'RUNNING',          color: 'bg-accent',    text: 'text-accent',    animate: true  },
  { id: 'PWR-JOB-88295', status: 'In Queue',          color: 'bg-white/20',  text: 'text-text-dim',  animate: false },
  { id: 'PWR-JOB-88280', status: 'Failed (Timeout)',  color: 'bg-red-500',   text: 'text-red-400',   animate: false },
];

interface QueryRow {
  time: string;
  curr: number; currR: number; currS: number; currT: number;
  Ground: number; PT100: number; Vibra: number;
  Volt: number; VoltR: number; VoltS: number; VoltT: number;
}

interface QueryResult {
  jobId: string;
  rows: QueryRow[];
  elapsed: number;
  rowCount: number;
}

const rand = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;

const INITIAL_NODE_BARS = [42, 68, 82, 58, 91, 72, 48, 88];

function readPipelineStorage() {
  const instances = JSON.parse(localStorage.getItem('pipeline-storage-instances') || '[]') as StoredPipelineInstance[];
  const sources = JSON.parse(localStorage.getItem('pipeline-storage-sources') || '[]') as StoredSource[];
  const destinations = JSON.parse(localStorage.getItem('pipeline-storage-destinations') || '[]') as StoredDestination[];
  return { instances, sources, destinations };
}

function buildJobsFromPipelines(instances: StoredPipelineInstance[]): Array<{ id: string; status: string; color: string; text: string; animate: boolean }> {
  if (instances.length === 0) return FALLBACK_JOBS;
  return instances.map((p) => {
    const jobId = `JOB-${p.id.slice(-5).toUpperCase()}`;
    const isStreaming = p.scheduleMode === 'streaming';
    const status = isStreaming ? 'RUNNING' : 'SUCCEEDED';
    const color = isStreaming ? 'bg-accent' : 'bg-green-500';
    const text = isStreaming ? 'text-accent animate-pulse' : 'text-green-400';
    return { id: jobId, status, color, text, animate: isStreaming };
  });
}

function buildDefaultQueryForPipeline(instances: StoredPipelineInstance[], sources: StoredSource[]): string {
  if (instances.length === 0) return DEFAULT_HIVE_QUERY;
  const activeInstanceCount = instances.filter(p => p.destinationCount > 0).length;
  if (activeInstanceCount === 0) return DEFAULT_HIVE_QUERY;
  const firstPipeline = instances[0];
  const activeSources = sources.filter(s => s.active).slice(0, firstPipeline.sourceCount);
  const sourceComment = activeSources.length > 0
    ? activeSources.map(s => s.label).join(', ')
    : 'PostgreSQL 운영 데이터';
  const isStreaming = firstPipeline.scheduleMode === 'streaming';
  const whereClause = isStreaming
    ? `AND (Ground > 5.0 OR VoltR < 200.0 OR VoltS < 200.0)`
    : `AND dt BETWEEN '2021-04-01' AND '2021-04-30'`;
  return `-- 파이프라인: "${firstPipeline.name}"
-- 소스: ${sourceComment}
-- 모드: ${isStreaming ? '스트리밍 (실시간 전력 품질 감시)' : '배치 (월간 전력 데이터 아카이빙)'}
SELECT
  time,
  VoltR, VoltS, VoltT,           -- 3상 전압 (정상: 220V ± 10%)
  currR, currS, currT, curr,      -- 3상 전류 + 합산전류
  Ground,                         -- 누전 전류 (임계값: 5A)
  PT100, Vibra                    -- 권선 온도, 진동
FROM sensors.deoksan_equipment
WHERE equipment_id IN ('EQ-MOTOR-07', 'EQ-PUMP-03', 'EQ-COMP-02')
  ${whereClause}
PARTITION BY (dt, equipment_id)
CLUSTER BY time
LIMIT 100;`;
}

const RESULT_COLUMNS: { key: keyof QueryRow; label: string; getColor?: (row: QueryRow) => string }[] = [
  { key: 'time',  label: 'time',  getColor: () => 'text-text-dim' },
  { key: 'curr',  label: 'curr',  getColor: () => 'text-accent' },
  { key: 'currR', label: 'currR' },
  { key: 'currS', label: 'currS' },
  { key: 'currT', label: 'currT' },
  { key: 'Ground', label: 'Ground' },
  { key: 'PT100',  label: 'PT100',  getColor: (r) => r.PT100 > 80 ? 'text-red-400 font-semibold' : 'text-accent font-semibold' },
  { key: 'Vibra',  label: 'Vibra',  getColor: (r) => r.Vibra < 0.2 ? 'text-red-400 font-semibold' : 'text-text-bright font-semibold' },
  { key: 'Volt',  label: 'Volt' },
  { key: 'VoltR', label: 'VoltR' },
  { key: 'VoltS', label: 'VoltS' },
  { key: 'VoltT', label: 'VoltT' },
];

export const ArchivingView = () => {
  const [hiveQuery, setHiveQuery] = useState(DEFAULT_HIVE_QUERY);
  const [nodeBarHeights, setNodeBarHeights] = useState(INITIAL_NODE_BARS);
  const [mockJobs, setMockJobs] = useState<Array<{ id: string; status: string; color: string; text: string; animate: boolean }>>(FALLBACK_JOBS);
  const queryEditorRef = useRef<HTMLTextAreaElement>(null);
  const lineGutterRef  = useRef<HTMLDivElement>(null);

  // Sync pipeline storage and update jobs + default query
  useEffect(() => {
    const syncFromPipeline = () => {
      const { instances, sources } = readPipelineStorage();
      const jobs = buildJobsFromPipelines(instances);
      setMockJobs(jobs);
      // Update default query to reflect selected pipeline
      const updatedQuery = buildDefaultQueryForPipeline(instances, sources);
      setHiveQuery(updatedQuery);
      // Adjust node bar heights based on pipeline count (more pipelines = more nodes to display)
      const pipelineCount = instances.length;
      if (pipelineCount > 0) {
        setNodeBarHeights(Array.from({ length: Math.min(12, Math.max(4, pipelineCount * 2)) }, () => rand(40, 90)));
      } else {
        setNodeBarHeights(INITIAL_NODE_BARS);
      }
    };
    syncFromPipeline();
    window.addEventListener('pipeline-storage-updated', syncFromPipeline);
    window.addEventListener('focus', syncFromPipeline);
    return () => {
      window.removeEventListener('pipeline-storage-updated', syncFromPipeline);
      window.removeEventListener('focus', syncFromPipeline);
    };
  }, []);

  useEffect(() => {
    const id = window.setInterval(() => {
      setNodeBarHeights(prev =>
        prev.map(h => Math.min(96, Math.max(26, Math.round(h + (Math.random() - 0.5) * 12))))
      );
    }, 1700);
    return () => window.clearInterval(id);
  }, []);

  const [isRunning, setIsRunning] = useState(false);
  const [result, setResult]       = useState<QueryResult | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [jobHistory, setJobHistory]   = useState<{ id: string; preview: string; elapsed: number }[]>([]);
  const [isArchiving, setIsArchiving] = useState(false);
  const [archiveDone, setArchiveDone] = useState(false);
  const [archiveHistory, setArchiveHistory] = useState<ArchiveRecord[]>(INITIAL_ARCHIVE_HISTORY);
  const [archiveDestination, setArchiveDestination] = useState('HDFS 아카이브');
  const [destinations, setDestinations] = useState<StoredDestination[]>([]);

  useEffect(() => {
    const syncDest = () => {
      const { destinations: dest } = readPipelineStorage();
      const active = dest.filter(d => d.active);
      setDestinations(active);
      if (active.length > 0 && !active.find(d => d.label === archiveDestination)) {
        setArchiveDestination(active[0]!.label);
      }
    };
    syncDest();
    window.addEventListener('pipeline-storage-updated', syncDest);
    return () => window.removeEventListener('pipeline-storage-updated', syncDest);
  }, []);

  const handleArchive = () => {
    if (!result || isArchiving) return;
    setIsArchiving(true);
    setArchiveDone(false);
    const arcJobId = `PWR-ARC-${Math.floor(Math.random() * 90000) + 10000}`;
    // 잡 목록에 RUNNING 추가
    setMockJobs(prev => [
      { id: arcJobId, status: 'RUNNING', color: 'bg-accent', text: 'text-accent', animate: true },
      ...prev.slice(0, 4),
    ]);
    setTimeout(() => {
      const elapsed = 1200 + Math.round(Math.random() * 3000);
      const now = new Date();
      const archivedAt = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
      // 잡을 SUCCEEDED로 전환
      setMockJobs(prev => prev.map(j => j.id === arcJobId ? { ...j, status: 'SUCCEEDED', color: 'bg-green-500', text: 'text-green-400', animate: false } : j));
      // 아카이브 히스토리 추가
      setArchiveHistory(prev => [
        { id: `arc-${Date.now()}`, jobId: arcJobId, destination: archiveDestination, rowCount: result.rowCount, elapsed, archivedAt },
        ...prev.slice(0, 4),
      ]);
      setIsArchiving(false);
      setArchiveDone(true);
      setTimeout(() => setArchiveDone(false), 3000);
    }, 2000);
  };

  const lineNumbers = useMemo(() => {
    const n = hiveQuery.split('\n').length;
    return Array.from({ length: Math.max(1, n) }, (_, i) => i + 1);
  }, [hiveQuery]);

  const syncLineGutterScroll = () => {
    const ta     = queryEditorRef.current;
    const gutter = lineGutterRef.current;
    if (ta && gutter) gutter.scrollTop = ta.scrollTop;
  };

  const handleRunQuery = () => {
    if (isRunning || !hiveQuery.trim()) return;
    setIsRunning(true);
    setResult(null);
    const delay = 600 + Math.random() * 800;
    setTimeout(() => {
      const rowCount = rand(8, 25);
      const jobId = `JOB-${Math.random().toString(36).substring(2, 10).toUpperCase()}`;
      const rows: QueryRow[] = Array.from({ length: rowCount }, (_, i) => {
        const baseTs = new Date('2021-04-01T00:00:00.200');
        baseTs.setMilliseconds(baseTs.getMilliseconds() + i * 100);
        const voltBase = 219 + Math.random() * 6;
        const currBase = 218 + Math.random() * 8;
        return {
          time:   baseTs.toISOString().replace('Z', ''),
          curr:   Math.round((currBase + (Math.random() - 0.5) * 4) * 10) / 10,
          currR:  Math.round((currBase + (Math.random() - 0.5) * 3) * 10) / 10,
          currS:  Math.round((currBase + (Math.random() - 0.5) * 3) * 10) / 10,
          currT:  Math.round((currBase + (Math.random() - 0.5) * 3) * 10) / 10,
          Ground: Math.round((221 + (Math.random() - 0.5) * 3) * 10) / 10,
          PT100:  Math.round((65 + Math.random() * 15) * 10) / 10,
          Vibra:  Math.round((0.4 + Math.random() * 1.1) * 1000) / 1000,
          Volt:   Math.round((voltBase + (Math.random() - 0.5) * 2) * 10) / 10,
          VoltR:  Math.round((voltBase + (Math.random() - 0.5) * 2.5) * 10) / 10,
          VoltS:  Math.round((voltBase + (Math.random() - 0.5) * 2.5) * 10) / 10,
          VoltT:  Math.round((voltBase + (Math.random() - 0.5) * 2.5) * 10) / 10,
        };
      });
      setResult({ jobId, rows, elapsed: Math.round(delay), rowCount });
      setJobHistory(prev => [
        { id: jobId, preview: hiveQuery.trim().slice(0, 60), elapsed: Math.round(delay) },
        ...prev.slice(0, 9),
      ]);
      setIsRunning(false);
    }, delay);
  };

  return (
    <div className="space-y-8">
      <SectionHeader
        title="빅데이터 아카이빙"
        description="HDFS 클러스터 확장 상태 및 HiveQL 최적화 매트릭스 리포트"
      />

      <div className="grid grid-cols-12 gap-6">
        {/* Query Editor */}
        <Card noPadding className="col-span-12 lg:col-span-8 flex flex-col shadow-md">
          <CardHeader
            left={<><Database className="w-4 h-4 text-accent" /><CardLabel>HiveQL Query Editor</CardLabel></>}
            right={<><Chip>AUTO-PARTITION ON</Chip><Chip>COMPRESSION: SNAPPY</Chip></>}
          />
          <div className="flex min-h-[300px] max-h-[min(520px,60vh)] bg-primary font-mono text-xs">
            <div
              ref={lineGutterRef}
              className="scrollbar-none shrink-0 w-11 select-none overflow-y-auto overflow-x-hidden border-r border-white/5 bg-surface-card/20 py-3 pr-2 text-right text-surface-muted leading-5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
              aria-hidden
            >
              {lineNumbers.map(num => <div key={num} className="h-5 tabular-nums">{num}</div>)}
            </div>
            <textarea
              ref={queryEditorRef}
              value={hiveQuery}
              onChange={e => setHiveQuery(e.target.value)}
              onScroll={syncLineGutterScroll}
              spellCheck={false}
              wrap="off"
              rows={Math.max(10, lineNumbers.length + 2)}
              className="max-h-[min(520px,60vh)] min-h-[300px] min-w-0 flex-1 resize-y overflow-y-auto overflow-x-auto bg-transparent px-3 py-3 leading-5 text-text-bright caret-accent placeholder:text-surface-muted focus:outline-none focus:ring-0 whitespace-pre"
              aria-label="HiveQL query editor"
            />
          </div>
          <div className="px-5 py-3.5 bg-surface-card flex justify-between items-center gap-4 border-t border-white/5 flex-wrap">
            <p className="text-xs text-text-dim tracking-normal">
              예상 MapReduce 비용: <span className="text-accent font-semibold">1.2 TB 처리</span>
            </p>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={handleRunQuery}
                disabled={isRunning}
                className={`px-6 py-2.5 rounded-lg font-semibold text-sm transition-all flex items-center gap-2 tracking-normal ${
                  isRunning ? 'bg-accent/40 text-primary/60 cursor-not-allowed' : 'bg-accent text-primary hover:brightness-110'
                }`}
              >
                {isRunning ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5 fill-current" />}
                {isRunning ? '실행 중...' : '쿼리 실행'}
              </button>
              <div className="flex items-center gap-1">
                <select
                  value={archiveDestination}
                  onChange={e => setArchiveDestination(e.target.value)}
                  disabled={!result || isArchiving}
                  className="bg-primary border border-white/10 rounded-l-lg px-2 py-2.5 text-xs text-text-dim focus:outline-none focus:border-accent/40 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {destinations.length > 0
                    ? destinations.map(d => <option key={d.id} value={d.label}>{d.label}</option>)
                    : <>
                        <option value="HDFS 아카이브">HDFS 아카이브</option>
                        <option value="Object Storage">Object Storage</option>
                      </>
                  }
                </select>
                <button
                  type="button"
                  onClick={handleArchive}
                  disabled={!result || isArchiving}
                  className={`w-28 py-2.5 rounded-r-lg font-semibold text-sm transition-all flex items-center justify-center gap-2 tracking-normal shrink-0 ${
                    !result || isArchiving
                      ? 'bg-surface-card border border-white/5 text-surface-muted/40 cursor-not-allowed'
                      : archiveDone
                        ? 'bg-green-500/20 border border-green-500/30 text-green-400'
                        : 'bg-surface-card border border-accent/30 text-accent hover:bg-accent/10'
                  }`}
                >
                  {isArchiving
                    ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /><span>저장 중...</span></>
                    : archiveDone
                      ? <><CheckCircle2 className="w-3.5 h-3.5" /><span>완료</span></>
                      : <><Archive className="w-3.5 h-3.5" /><span>아카이빙</span></>
                  }
                </button>
              </div>
            </div>
          </div>
        </Card>

        {/* Cluster Status */}
        <div className="col-span-12 lg:col-span-4 lg:col-start-9 flex flex-col gap-6">
          <Card>
            <h3 className="text-xs font-semibold text-text-dim uppercase tracking-wide mb-2">HDFS Cluster Expansion</h3>
            <p className="text-[11px] text-surface-muted leading-snug tracking-normal mb-4">
              빅데이터 아카이브가 올라가는 <span className="text-text-dim">HDFS 클러스터 증설·랙 확장</span> 진행 상황을 한눈에 보는 위젯입니다.{' '}
              <span className="opacity-80">84%는 확장 목표 대비 완료율 예시, MoM은 전월 대비 증감(데모 고정값).</span>
            </p>
            <div className="flex items-baseline gap-3 mb-3">
              <span className="text-5xl font-bold text-text-bright font-headline">84%</span>
              <span className="text-accent text-xs font-semibold">+12.4% MoM</span>
            </div>
            <ProgressBar value={84} color="bg-gradient-to-r from-primary to-accent" height="h-2" className="mb-8" />
            <div className="grid grid-cols-2 gap-4">
              <Metric label="Total Nodes" value="256" size="sm" />
              <Metric label="Active Rack" value="12"  size="sm" />
            </div>
          </Card>

          <Card className="flex-1">
            <h3 className="text-xs font-semibold text-text-dim uppercase tracking-wide mb-4">MapReduce Job Status</h3>
            <div className="space-y-3">
              {mockJobs.map((job, i) => (
                <div key={i} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className={`w-1.5 h-1.5 rounded-full ${job.color} ${job.animate ? 'animate-pulse' : ''}`} />
                    <span className="text-[11px] font-bold text-text-bright font-mono">{job.id}</span>
                  </div>
                  <span className={`text-[11px] font-semibold ${job.text}`}>{job.status}</span>
                </div>
              ))}
            </div>

            <div className="mt-5 pt-4 border-t border-white/5">
              <h4 className="text-[11px] font-semibold text-text-dim uppercase tracking-wide mb-3 flex items-center gap-1.5">
                <HardDrive className="w-3 h-3 text-accent" />Archive History
              </h4>
              <div className="space-y-1.5">
                <AnimatePresence initial={false}>
                  {archiveHistory.map(rec => (
                    <motion.div
                      key={rec.id}
                      initial={{ opacity: 0, y: -6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      className="flex items-center justify-between gap-2 py-1.5 border-b border-white/5 last:border-0"
                    >
                      <div className="min-w-0">
                        <span className="text-[10px] font-mono text-green-400 font-semibold">{rec.jobId}</span>
                        <span className="text-[10px] text-surface-muted ml-2">{rec.destination}</span>
                      </div>
                      <span className="text-[10px] text-surface-muted shrink-0">{rec.rowCount.toLocaleString()}행</span>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowHistory(v => !v)}
              className="w-full mt-4 py-2 border border-white/5 rounded-lg text-xs font-medium text-text-dim hover:bg-primary transition-colors tracking-wide flex items-center justify-center gap-2"
            >
              {showHistory ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              {showHistory ? 'Hide Query History' : 'Query History'}
            </button>
            <AnimatePresence>
              {showHistory && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  <div className="mt-3 space-y-1.5">
                    {jobHistory.length === 0 ? (
                      <p className="text-[11px] text-surface-muted text-center py-2">아직 실행한 쿼리가 없습니다</p>
                    ) : (
                      jobHistory.map(j => (
                        <div key={j.id} className="bg-primary/50 px-3 py-2 rounded-lg border border-white/5 flex justify-between items-center gap-2">
                          <span className="text-[10px] font-mono font-semibold text-accent truncate">{j.id}</span>
                          <span className="text-[10px] text-surface-muted shrink-0">{j.elapsed}ms</span>
                        </div>
                      ))
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </Card>
        </div>

        {/* Query Result */}
        <AnimatePresence>
          {(result || isRunning) && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="col-span-12"
            >
              <Card noPadding className="overflow-hidden">
                <div className="px-6 py-4 bg-primary/50 border-b border-white/5 flex items-center gap-3">
                  {isRunning ? <Loader2 className="w-4 h-4 text-accent animate-spin" /> : <CheckCircle2 className="w-4 h-4 text-accent" />}
                  <span className="text-xs font-semibold uppercase tracking-wide text-text-bright">
                    {isRunning ? '쿼리 실행 중...' : `결과: ${result?.rowCount}행 · ${result?.elapsed}ms · ${result?.jobId}`}
                  </span>
                </div>
                {result && (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs font-mono">
                      <thead>
                        <tr className="bg-primary/30 text-surface-muted uppercase tracking-wide text-[11px]">
                          <th className="px-4 py-3 text-left font-semibold">#</th>
                          {RESULT_COLUMNS.map(col => (
                            <th key={col.key} className="px-4 py-3 text-left font-semibold">{col.label}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {result.rows.map((row, i) => (
                          <tr key={i} className="hover:bg-white/5 transition-colors">
                            <td className="px-4 py-2 text-surface-muted">{i + 1}</td>
                            {RESULT_COLUMNS.map(col => (
                              <td
                                key={col.key}
                                className={`px-4 py-2 ${col.key === 'time' ? 'whitespace-nowrap' : ''} ${
                                  col.getColor ? col.getColor(row) : 'text-text-bright'
                                }`}
                              >
                                {String(row[col.key])}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Performance Chart */}
        <Card className="col-span-12 lg:col-span-8 !p-8">
          <div className="flex justify-between items-start mb-8 gap-4">
            <div>
              <h3 className="text-base font-semibold text-text-bright font-headline">Parallel Processing Performance</h3>
              <p className="text-xs text-text-dim mt-1 tracking-normal">분산 노드 처리량 (GB/sec)</p>
            </div>
            <div className="flex gap-4 shrink-0">
              {[
                { label: 'Hive on Tez', color: 'bg-accent' },
                { label: 'MapReduce',   color: 'bg-white/10 border border-accent/30' },
              ].map(item => (
                <div key={item.label} className="flex items-center gap-2">
                  <div className={`w-2.5 h-2.5 rounded-sm ${item.color}`} />
                  <span className="text-[11px] font-medium text-text-dim uppercase tracking-wide">{item.label}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="flex h-60 gap-4">
            {nodeBarHeights.map((h, i) => (
              <div key={i} className="group flex h-full min-h-0 min-w-0 flex-1 flex-col justify-end items-center">
                <motion.div
                  initial={false}
                  animate={{ height: `${h}%` }}
                  transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                  className="w-full min-h-[4px] shrink-0 rounded-t-sm bg-gradient-to-t from-primary to-accent group-hover:brightness-125"
                />
                <span className="mt-2 shrink-0 text-[11px] font-medium uppercase tracking-wide text-surface-muted">
                  Node 0{i + 1}
                </span>
              </div>
            ))}
          </div>
        </Card>

        {/* Optimization Metrics */}
        <div className="col-span-12 lg:col-span-4 lg:col-start-9 bg-primary rounded-xl border border-white/10 flex flex-col overflow-hidden">
          <div className="p-5 bg-surface-card border-b border-white/5">
            <h3 className="text-xs font-semibold text-accent flex items-center gap-2 uppercase tracking-wide">
              <Filter className="w-3.5 h-3.5" />Optimization Metrics
            </h3>
          </div>
          <div className="p-6 space-y-6">
            <LabeledProgressBar label="Partitioning Density" valueLabel="4.8x"  value={70} />
            <LabeledProgressBar label="Bucketing Alignment"  valueLabel="98.2%" value={98} />
          </div>
        </div>
      </div>
    </div>
  );
};
