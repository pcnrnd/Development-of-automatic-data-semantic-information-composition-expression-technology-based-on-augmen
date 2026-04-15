import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Database,
  Play,
  AlertTriangle,
  Filter,
  Loader2,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { Card, CardHeader, CardLabel, SectionHeader, ProgressBar, LabeledProgressBar, Chip, Metric } from './ui';

const DEFAULT_HIVE_QUERY = `-- 덕산 공장 전동기 센서 데이터 조회 (deoksan_equipment)
SELECT
  time, curr, currR, currS, currT,
  Ground, PT100, Vibra,
  Volt, VoltR, VoltS, VoltT
FROM sensors.deoksan_equipment
WHERE dt = '2021-04-01'
  AND PT100 > 60.0
PARTITION BY (dt, equipment_id)
CLUSTER BY time
LIMIT 100;`;

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

const MOCK_JOBS = [
  { id: 'Job_ID_88291', status: '92% Completed',    color: 'bg-accent',    text: 'text-accent',    animate: true  },
  { id: 'Job_ID_88295', status: 'In Queue',          color: 'bg-white/20',  text: 'text-text-dim',  animate: false },
  { id: 'Job_ID_88280', status: 'Failed (Timeout)',  color: 'bg-red-500',   text: 'text-red-400',   animate: false },
];

const INITIAL_NODE_BARS = [42, 68, 82, 58, 91, 72, 48, 88];

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
  const queryEditorRef = useRef<HTMLTextAreaElement>(null);
  const lineGutterRef  = useRef<HTMLDivElement>(null);

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
          <div className="px-5 py-3.5 bg-surface-card flex justify-between items-center gap-4 border-t border-white/5">
            <p className="text-xs text-text-dim tracking-normal">
              예상 MapReduce 비용: <span className="text-accent font-semibold">1.2 TB 처리</span>
            </p>
            <button
              type="button"
              onClick={handleRunQuery}
              disabled={isRunning}
              className={`px-6 py-2.5 rounded-lg font-semibold text-sm transition-all flex items-center gap-2 shrink-0 tracking-normal ${
                isRunning ? 'bg-accent/40 text-primary/60 cursor-not-allowed' : 'bg-accent text-primary hover:brightness-110'
              }`}
            >
              {isRunning ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5 fill-current" />}
              {isRunning ? '실행 중...' : '쿼리 실행'}
            </button>
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
            <h3 className="text-xs font-semibold text-text-dim uppercase tracking-wide mb-6">MapReduce Job Status</h3>
            <div className="space-y-5">
              {MOCK_JOBS.map((job, i) => (
                <div key={i} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-1.5 h-1.5 rounded-full ${job.color} ${job.animate ? 'animate-pulse' : ''}`} />
                    <span className="text-xs font-bold text-text-bright">{job.id}</span>
                  </div>
                  <span className={`text-xs font-semibold ${job.text}`}>{job.status}</span>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setShowHistory(v => !v)}
              className="w-full mt-8 py-2.5 border border-white/5 rounded-lg text-xs font-medium text-text-dim hover:bg-primary transition-colors tracking-wide flex items-center justify-center gap-2"
            >
              {showHistory ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              {showHistory ? 'Hide Job History' : 'View All Job History'}
            </button>
            <AnimatePresence>
              {showHistory && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  <div className="mt-4 space-y-2">
                    {jobHistory.length === 0 ? (
                      <p className="text-xs text-surface-muted text-center py-2">아직 실행한 쿼리가 없습니다</p>
                    ) : (
                      jobHistory.map(j => (
                        <div key={j.id} className="bg-primary/50 p-3 rounded-lg border border-white/5">
                          <div className="flex justify-between mb-1">
                            <span className="text-[11px] font-mono font-semibold text-accent">{j.id}</span>
                            <span className="text-[11px] text-surface-muted">{j.elapsed}ms</span>
                          </div>
                          <p className="text-[11px] text-text-dim truncate">{j.preview}…</p>
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
            <div className="pt-6 border-t border-white/5">
              <p className="text-xs text-surface-muted font-semibold uppercase mb-3 tracking-wide">Skewed Data Alerts</p>
              <div className="flex items-center gap-3 bg-red-500/10 p-3 rounded-lg border border-red-500/20">
                <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
                <span className="text-[11px] text-red-400 font-medium tracking-normal">Table: sales_raw (Partition: region)</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
