import React, { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Shield,
  Database,
  Zap,
  PlusCircle,
  Trash2,
  Cloud,
  CheckCircle2,
  X,
} from 'lucide-react';
import { Card, Badge, FormInput, FormSelect } from './ui';
import type { DagEdge, DagNode, PipelineDag } from '../types/dag';

type ScheduleMode = 'streaming' | 'batch';
type RuleInputMode = 'threshold' | 'extension';

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
  type: string;
  icon: typeof Cloud;
  active: boolean;
}

interface PipelineInstance {
  id: string;
  name: string;
  sourceCount: number;
  ruleCount: number;
  destinationCount: number;
  scheduleMode: ScheduleMode;
  createdAt: string;
}

const INITIAL_SOURCES: DataSource[] = [
  { id: 'postgresql',    label: 'PostgreSQL 운영 데이터', sub: 'Cluster: mes-db-cluster | schema: public', tag: 'PostgreSQL',    icon: Database, active: true },
  { id: 'hdfs',          label: 'HDFS 이력 데이터',       sub: 'Path: /data/lake/mes/events | parquet',     tag: 'HDFS',          icon: Database, active: true },
  { id: 'objectStorage', label: 'Object Storage 파일',    sub: 'Bucket: s3://mes-archive/raw | json/csv',   tag: 'Object Storage', icon: Cloud,    active: false },
];

const INITIAL_RULES: FilterRule[] = [
  { id: 'r1', parts: ['PT100 > 85.0 °C', 'Vibra < 0.2 g'],     connector: 'And', severity: 'Critical' },
  { id: 'r2', parts: ['curr > 250.0 A',  'Ground > 5.0 A'],     connector: 'And', severity: 'Critical' },
  { id: 'r3', parts: ['VoltR < 200.0 V', 'VoltS < 200.0 V'],   connector: 'Or',  severity: 'Warning'  },
];

const INITIAL_DESTINATIONS: Destination[] = [
  { id: 'hdfs',       label: 'HDFS 아카이브', type: 'HDFS',           icon: Database, active: true  },
  { id: 'postgresql', label: 'PostgreSQL 운영 DB', type: 'PostgreSQL',     icon: Database, active: true  },
  { id: 'adl',        label: 'Object storage',      type: 'Object storage', icon: Cloud,    active: false },
];

const INITIAL_PIPELINES: PipelineInstance[] = [
  {
    id: 'pipeline-1',
    name: '덕산 3상 전류·전압 실시간 모니터링',
    sourceCount: 2,
    ruleCount: 3,
    destinationCount: 2,
    scheduleMode: 'streaming',
    createdAt: new Date(Date.now() - 3600000).toLocaleString('ko-KR', { hour12: false }),
  },
  {
    id: 'pipeline-2',
    name: '전력 품질 데이터 월간 아카이빙',
    sourceCount: 2,
    ruleCount: 2,
    destinationCount: 1,
    scheduleMode: 'batch',
    createdAt: new Date(Date.now() - 86400000).toLocaleString('ko-KR', { hour12: false }),
  },
  {
    id: 'pipeline-3',
    name: '누전·전압강하 이상 감지',
    sourceCount: 1,
    ruleCount: 2,
    destinationCount: 2,
    scheduleMode: 'streaming',
    createdAt: new Date(Date.now() - 172800000).toLocaleString('ko-KR', { hour12: false }),
  },
];

let ruleIdCounter = 100;
let pipelineIdCounter = 3;
let sourceIdCounter = 100;
let destinationIdCounter = 100;
const PIPELINE_STORAGE_SOURCES_KEY = 'pipeline-storage-sources';
const PIPELINE_STORAGE_DESTINATIONS_KEY = 'pipeline-storage-destinations';
const PIPELINE_STORAGE_INSTANCES_KEY = 'pipeline-storage-instances';
const DAG_STORAGE_KEY = 'pipeline-storage-dag';

/** 짧은 DAG 라벨을 만들기 위해 긴 텍스트를 잘라낸다. */
function shortenLabel(value: string, max = 28): string {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

/** 규칙 내용을 DAG 노드 타입과 표시 문구로 변환한다. */
function toRuleDagNode(pipelineId: string, rule: FilterRule, index: number, x: number, y: number): DagNode {
  const joined = rule.parts.join(` ${rule.connector} `).trim();
  const normalized = joined.toLowerCase();
  const nodeType = normalized.includes('convert_to') || normalized.includes('file_ext')
    ? 'transform'
    : rule.severity === 'Critical'
      ? 'validate'
      : 'filter';

  return {
    id: `${pipelineId}-rule-${index + 1}`,
    type: nodeType,
    label: shortenLabel(rule.parts[0] ?? `Rule ${index + 1}`, 24),
    subLabel: shortenLabel(joined || rule.severity, 36),
    position: { x, y },
    config: {
      severity: rule.severity,
      connector: rule.connector || 'single',
      expression: joined,
    },
  };
}

/** 현재 활성 설정을 바탕으로 파이프라인용 기본 DAG를 생성한다. */
function buildPipelineDag(
  pipelineId: string,
  activeSources: DataSource[],
  rules: FilterRule[],
  activeDestinations: Destination[],
): PipelineDag {
  const nodes: DagNode[] = [];
  const edges: DagEdge[] = [];
  const sourceX = 60;
  const stageStartX = 320;
  const stageGapX = 220;
  const sinkGapX = rules.length > 0 ? 220 : 320;
  const baseY = 220;
  const laneGapY = 120;

  const sourceStartY = baseY - ((activeSources.length - 1) * laneGapY) / 2;
  const sourceNodes = activeSources.map((source, index) => ({
    id: `${pipelineId}-source-${source.id}`,
    type: 'source' as const,
    label: shortenLabel(source.label, 22),
    subLabel: shortenLabel(source.sub, 32),
    position: { x: sourceX, y: sourceStartY + index * laneGapY },
    config: {
      sourceId: source.id,
      sourceType: source.tag,
    },
  }));
  nodes.push(...sourceNodes);

  const ruleStartY = baseY - ((rules.length - 1) * laneGapY) / 2;
  const ruleNodes = rules.map((rule, index) => (
    toRuleDagNode(pipelineId, rule, index, stageStartX + index * stageGapX, ruleStartY + index * laneGapY)
  ));
  nodes.push(...ruleNodes);

  const sinkX = rules.length > 0
    ? stageStartX + Math.max(ruleNodes.length - 1, 0) * stageGapX + sinkGapX
    : stageStartX + sinkGapX;
  const sinkStartY = baseY - ((activeDestinations.length - 1) * laneGapY) / 2;
  const sinkNodes = activeDestinations.map((destination, index) => ({
    id: `${pipelineId}-sink-${destination.id}`,
    type: 'sink' as const,
    label: shortenLabel(destination.label, 22),
    subLabel: shortenLabel(destination.type, 28),
    position: { x: sinkX, y: sinkStartY + index * laneGapY },
    config: {
      destinationId: destination.id,
      destinationType: destination.type,
    },
  }));
  nodes.push(...sinkNodes);

  if (ruleNodes.length > 0) {
    sourceNodes.forEach((sourceNode, index) => {
      edges.push({
        id: `${pipelineId}-edge-source-${index + 1}`,
        source: sourceNode.id,
        target: ruleNodes[0]!.id,
      });
    });

    ruleNodes.forEach((ruleNode, index) => {
      const nextNode = ruleNodes[index + 1];
      if (!nextNode) return;
      edges.push({
        id: `${pipelineId}-edge-rule-${index + 1}`,
        source: ruleNode.id,
        target: nextNode.id,
      });
    });

    sinkNodes.forEach((sinkNode, index) => {
      edges.push({
        id: `${pipelineId}-edge-sink-${index + 1}`,
        source: ruleNodes[ruleNodes.length - 1]!.id,
        target: sinkNode.id,
      });
    });
  } else {
    sourceNodes.forEach((sourceNode, sourceIndex) => {
      sinkNodes.forEach((sinkNode, sinkIndex) => {
        edges.push({
          id: `${pipelineId}-edge-direct-${sourceIndex + 1}-${sinkIndex + 1}`,
          source: sourceNode.id,
          target: sinkNode.id,
        });
      });
    });
  }

  return {
    pipelineId,
    nodes,
    edges,
    updatedAt: new Date().toISOString(),
  };
}

function readStoredDags(): Record<string, PipelineDag> {
  try {
    const raw = localStorage.getItem(DAG_STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as Record<string, PipelineDag>;
  } catch {
    return {};
  }
}

export const GovernanceView = () => {
  const [sources, setSources]           = useState<DataSource[]>(INITIAL_SOURCES);
  const [draftScheduleMode, setDraftScheduleMode] = useState<ScheduleMode>('streaming');
  const [rules, setRules]               = useState<FilterRule[]>(INITIAL_RULES);
  const [destinations, setDestinations] = useState<Destination[]>(INITIAL_DESTINATIONS);
  const [showNewRule, setShowNewRule]   = useState(false);
  const [showNewSource, setShowNewSource] = useState(false);
  const [showNewDestination, setShowNewDestination] = useState(false);
  const [newSourceLabel, setNewSourceLabel] = useState('');
  const [newSourceTag, setNewSourceTag] = useState('PostgreSQL');
  const [newSourceSub, setNewSourceSub] = useState('');
  const [newDestinationLabel, setNewDestinationLabel] = useState('');
  const [newDestinationType, setNewDestinationType] = useState('HDFS');
  const [newField, setNewField]         = useState('');
  const [newOp, setNewOp]               = useState('>');
  const [newVal, setNewVal]             = useState('');
  const [newSev, setNewSev]             = useState<'Critical' | 'Warning'>('Warning');
  const [newRuleMode, setNewRuleMode]   = useState<RuleInputMode>('threshold');
  const [newFromExt, setNewFromExt]     = useState('.csv');
  const [newToExt, setNewToExt]         = useState('.parquet');
  const [pipelines, setPipelines]       = useState<PipelineInstance[]>(INITIAL_PIPELINES);
  const [selectedPipelineId, setSelectedPipelineId] = useState<string | null>(null);
  const [editingPipelineId, setEditingPipelineId] = useState<string | null>(null);
  const [editingPipelineName, setEditingPipelineName] = useState('');

  useEffect(() => {
    try {
      const plainSources = sources.map(({ id, label, sub, tag, active }) => ({ id, label, sub, tag, active }));
      const plainDestinations = destinations.map(({ id, label, type, active }) => ({ id, label, type, active }));
      localStorage.setItem(PIPELINE_STORAGE_SOURCES_KEY, JSON.stringify(plainSources));
      localStorage.setItem(PIPELINE_STORAGE_DESTINATIONS_KEY, JSON.stringify(plainDestinations));
      window.dispatchEvent(new CustomEvent('pipeline-storage-updated'));
    } catch {
      /* ignore */
    }
  }, [sources, destinations]);

  useEffect(() => {
    try {
      localStorage.setItem(PIPELINE_STORAGE_INSTANCES_KEY, JSON.stringify(pipelines));
      window.dispatchEvent(new CustomEvent('pipeline-storage-updated'));
    } catch {
      /* ignore */
    }
  }, [pipelines]);

  const toggleSource      = (id: string) => setSources(prev => prev.map(s => s.id === id ? { ...s, active: !s.active } : s));
  const deleteSource      = (id: string) => setSources(prev => prev.filter(s => s.id !== id));
  const toggleDestination = (id: string) => setDestinations(prev => prev.map(d => d.id === id ? { ...d, active: !d.active } : d));
  const deleteDestination = (id: string) => setDestinations(prev => prev.filter(d => d.id !== id));
  const deleteRule        = (id: string) => setRules(prev => prev.filter(r => r.id !== id));
  /** 현재 선택한 소스/규칙/목적지를 기반으로 파이프라인 생성 요청을 처리한다. */
  const handleAddPipeline = () => {
    const activeSources = sources.filter(source => source.active);
    const activeDestinations = destinations.filter(destination => destination.active);
    const sourceCount = activeSources.length;
    const destinationCount = activeDestinations.length;
    const ruleCount = rules.length;
    pipelineIdCounter += 1;

    const nextPipeline: PipelineInstance = {
      id: `pipeline-${pipelineIdCounter}`,
      name: `Pipeline ${String(pipelineIdCounter).padStart(2, '0')}`,
      sourceCount,
      ruleCount,
      destinationCount,
      scheduleMode: draftScheduleMode,
      createdAt: new Date().toLocaleString('ko-KR', { hour12: false }),
    };

    setPipelines(prev => [nextPipeline, ...prev]);
    setSelectedPipelineId(nextPipeline.id);

    try {
      const storedDags = readStoredDags();
      if (!storedDags[nextPipeline.id]) {
        localStorage.setItem(
          DAG_STORAGE_KEY,
          JSON.stringify({
            ...storedDags,
            [nextPipeline.id]: buildPipelineDag(nextPipeline.id, activeSources, rules, activeDestinations),
          }),
        );
        window.dispatchEvent(new CustomEvent('pipeline-storage-updated'));
      }
    } catch {
      /* ignore */
    }
  };

  /** 특정 파이프라인의 수집 스케줄 모드를 갱신한다. */
  const setScheduleModeForPipeline = (pipelineId: string, mode: ScheduleMode) => {
    setPipelines(prev => prev.map(pipeline => (
      pipeline.id === pipelineId ? { ...pipeline, scheduleMode: mode } : pipeline
    )));
  };

  /** 파이프라인 이름 편집 모드를 시작한다. */
  const startPipelineRename = (pipelineId: string, currentName: string) => {
    setEditingPipelineId(pipelineId);
    setEditingPipelineName(currentName);
  };

  /** 파이프라인 이름 편집을 취소한다. */
  const cancelPipelineRename = () => {
    setEditingPipelineId(null);
    setEditingPipelineName('');
  };

  /** 파이프라인 이름 변경을 저장한다. */
  const savePipelineRename = () => {
    if (!editingPipelineId) return;
    const nextName = editingPipelineName.trim();
    if (!nextName) return;

    setPipelines(prev => prev.map(pipeline => (
      pipeline.id === editingPipelineId ? { ...pipeline, name: nextName } : pipeline
    )));
    cancelPipelineRename();
  };

  const addRule = () => {
    if (newRuleMode === 'extension') {
      const fromExt = newFromExt.trim();
      const toExt = newToExt.trim();
      if (!fromExt || !toExt) return;

      setRules(prev => [...prev, {
        id: `r${++ruleIdCounter}`,
        parts: [`file_ext == ${fromExt}`, `convert_to == ${toExt}`],
        connector: 'Then',
        severity: newSev,
      }]);
      setNewFromExt('.csv');
      setNewToExt('.parquet');
      setShowNewRule(false);
      return;
    }

    if (!newField.trim() || !newVal.trim()) return;
    setRules(prev => [...prev, {
      id: `r${++ruleIdCounter}`,
      parts: [`${newField.trim()} ${newOp} ${newVal.trim()}`],
      connector: '',
      severity: newSev,
    }]);
    setNewField('');
    setNewVal('');
    setShowNewRule(false);
  };

  /** 새로운 데이터 소스를 목록에 추가한다. */
  const addSource = () => {
    const label = newSourceLabel.trim();
    const sub = newSourceSub.trim();
    const tag = newSourceTag.trim();
    if (!label || !tag) return;

    sourceIdCounter += 1;
    const normalizedTag = tag.toLowerCase();
    const icon = normalizedTag.includes('object') || normalizedTag.includes('s3') ? Cloud : Database;
    const defaultSub = normalizedTag.includes('hdfs')
      ? 'Path: /data/lake/default | parquet'
      : normalizedTag.includes('object') || normalizedTag.includes('s3')
        ? 'Bucket: s3://default-bucket/raw | json/csv'
        : 'Cluster: default-cluster | schema: public';

    setSources(prev => [{
      id: `src-${sourceIdCounter}`,
      label,
      sub: sub || defaultSub,
      tag,
      icon,
      active: true,
    }, ...prev]);

    setNewSourceLabel('');
    setNewSourceSub('');
    setNewSourceTag('PostgreSQL');
    setShowNewSource(false);
  };

  /** 새로운 데이터 목적지를 목록에 추가한다. */
  const addDestination = () => {
    const label = newDestinationLabel.trim();
    const type = newDestinationType.trim();
    if (!label || !type) return;

    destinationIdCounter += 1;
    const normalizedType = type.toLowerCase();
    const icon = normalizedType.includes('object') || normalizedType.includes('s3') ? Cloud : Database;

    setDestinations(prev => [{
      id: `dst-${destinationIdCounter}`,
      label,
      type,
      icon,
      active: true,
    }, ...prev]);

    setNewDestinationLabel('');
    setNewDestinationType('HDFS');
    setShowNewDestination(false);
  };

  const selectedPipeline = useMemo(
    () => pipelines.find(pipeline => pipeline.id === selectedPipelineId) ?? null,
    [pipelines, selectedPipelineId]
  );
  const activeScheduleMode = selectedPipeline?.scheduleMode ?? draftScheduleMode;
  const govHealth = 80 + sources.filter(s => s.active).length * 6 + (activeScheduleMode === 'streaming' ? 4 : 0);

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
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded-md text-[11px] font-semibold tracking-wide transition-colors ${
                        source.active ? 'bg-accent text-primary' : 'bg-primary text-surface-muted'
                      }`}>{source.tag}</span>
                      {source.id.startsWith('src-') && (
                        <span
                          role="button"
                          tabIndex={0}
                          onClick={event => {
                            event.stopPropagation();
                            deleteSource(source.id);
                          }}
                          onKeyDown={event => {
                            if (event.key === 'Enter' || event.key === ' ') {
                              event.preventDefault();
                              event.stopPropagation();
                              deleteSource(source.id);
                            }
                          }}
                          className="p-1.5 rounded-md border border-white/10 bg-primary/60 text-surface-muted hover:text-red-300 hover:border-red-400/40 transition-colors"
                          title="추가한 소스 삭제"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </span>
                      )}
                    </div>
                  </div>
                  <h4 className="text-text-bright font-bold text-xs mb-1">{source.label}</h4>
                  <p className="text-surface-muted text-xs font-medium">{source.sub}</p>
                </button>
              ))}

              <AnimatePresence>
                {showNewSource && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden sm:col-span-3 lg:col-span-1"
                  >
                    <div className="p-4 bg-primary/50 rounded-xl border border-accent/30 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-accent uppercase tracking-wide">데이터 소스 추가</span>
                        <button type="button" onClick={() => setShowNewSource(false)}>
                          <X className="w-4 h-4 text-surface-muted hover:text-text-bright" />
                        </button>
                      </div>
                      <FormInput
                        placeholder="소스 이름 (예: PostgreSQL 운영 데이터)"
                        value={newSourceLabel}
                        onChange={event => setNewSourceLabel(event.target.value)}
                      />
                      <FormSelect value={newSourceTag} onChange={event => setNewSourceTag(event.target.value)}>
                        <option>PostgreSQL</option>
                        <option>HDFS</option>
                        <option>Object Storage</option>
                      </FormSelect>
                      <FormInput
                        placeholder="연결 정보 (예: Cluster: mes-db-cluster | schema: public)"
                        value={newSourceSub}
                        onChange={event => setNewSourceSub(event.target.value)}
                      />
                      <button
                        type="button"
                        onClick={addSource}
                        className="w-full py-2 bg-accent text-primary text-xs font-semibold rounded-lg hover:brightness-110 transition-all"
                      >
                        소스 추가
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {!showNewSource && (
                <button
                  type="button"
                  onClick={() => setShowNewSource(true)}
                  className="sm:col-span-3 lg:col-span-1 w-full py-3 border border-dashed border-white/10 rounded-xl text-surface-muted text-xs font-medium tracking-normal hover:border-accent/40 hover:text-text-bright transition-colors flex justify-center items-center gap-2"
                >
                  <PlusCircle className="w-4 h-4" />
                  데이터 소스 추가
                </button>
              )}
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
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => setNewRuleMode('threshold')}
                          className={`py-1.5 text-[11px] font-semibold rounded-md border transition-colors ${
                            newRuleMode === 'threshold'
                              ? 'border-accent/40 bg-accent/10 text-accent'
                              : 'border-white/10 bg-primary/60 text-surface-muted hover:text-text-bright'
                          }`}
                        >
                          임계값 규칙
                        </button>
                        <button
                          type="button"
                          onClick={() => setNewRuleMode('extension')}
                          className={`py-1.5 text-[11px] font-semibold rounded-md border transition-colors ${
                            newRuleMode === 'extension'
                              ? 'border-accent/40 bg-accent/10 text-accent'
                              : 'border-white/10 bg-primary/60 text-surface-muted hover:text-text-bright'
                          }`}
                        >
                          확장자 변환 규칙
                        </button>
                      </div>
                      {newRuleMode === 'threshold' ? (
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
                      ) : (
                        <div className="flex gap-3 flex-wrap">
                          <FormInput
                            placeholder="원본 확장자 (예: .csv)"
                            value={newFromExt}
                            onChange={e => setNewFromExt(e.target.value)}
                            className="flex-1 min-w-28"
                          />
                          <FormInput
                            placeholder="대상 확장자 (예: .parquet)"
                            value={newToExt}
                            onChange={e => setNewToExt(e.target.value)}
                            className="flex-1 min-w-28"
                          />
                        </div>
                      )}
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
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full transition-colors ${dest.active ? 'bg-accent' : 'bg-surface-muted'}`} />
                    {dest.id.startsWith('dst-') && (
                      <span
                        role="button"
                        tabIndex={0}
                        onClick={event => {
                          event.stopPropagation();
                          deleteDestination(dest.id);
                        }}
                        onKeyDown={event => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault();
                            event.stopPropagation();
                            deleteDestination(dest.id);
                          }
                        }}
                        className="p-1.5 rounded-md border border-white/10 bg-primary/60 text-surface-muted hover:text-red-300 hover:border-red-400/40 transition-colors"
                        title="추가한 목적지 삭제"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </span>
                    )}
                  </div>
                </button>
              ))}

              <AnimatePresence>
                {showNewDestination && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="p-4 bg-primary/50 rounded-xl border border-accent/30 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-accent uppercase tracking-wide">데이터 목적지 추가</span>
                        <button type="button" onClick={() => setShowNewDestination(false)}>
                          <X className="w-4 h-4 text-surface-muted hover:text-text-bright" />
                        </button>
                      </div>
                      <FormInput
                        placeholder="목적지 이름 (예: HDFS 아카이브)"
                        value={newDestinationLabel}
                        onChange={event => setNewDestinationLabel(event.target.value)}
                      />
                      <FormSelect value={newDestinationType} onChange={event => setNewDestinationType(event.target.value)}>
                        <option>HDFS</option>
                        <option>PostgreSQL</option>
                        <option>Object storage</option>
                      </FormSelect>
                      <button
                        type="button"
                        onClick={addDestination}
                        className="w-full py-2 bg-accent text-primary text-xs font-semibold rounded-lg hover:brightness-110 transition-all"
                      >
                        목적지 추가
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {!showNewDestination && (
                <button
                  type="button"
                  onClick={() => setShowNewDestination(true)}
                  className="w-full py-3 border border-dashed border-white/10 rounded-xl text-surface-muted text-xs font-medium tracking-normal hover:border-accent/40 hover:text-text-bright transition-colors flex justify-center items-center gap-2"
                >
                  <PlusCircle className="w-4 h-4" />
                  데이터 목적지 추가
                </button>
              )}
            </div>
          </Card>
        </div>

        <div className="flex justify-end">
          <button
            type="button"
            onClick={handleAddPipeline}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-accent/35 bg-accent/10 hover:bg-accent/15 text-xs font-semibold text-text-bright transition-colors"
          >
            <PlusCircle className="w-3.5 h-3.5 text-accent" aria-hidden />
            현재 설정으로 파이프라인 추가
          </button>
        </div>

        <Card dim className="!p-6 md:!p-8">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
            <h4 className="text-text-bright font-bold text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-accent" />
              생성된 파이프라인
            </h4>
            <span className="text-xs font-medium text-surface-muted">{pipelines.length}개</span>
          </div>
          {pipelines.length === 0 ? (
            <div className="rounded-xl border border-dashed border-white/10 bg-primary/40 px-4 py-6 text-center text-xs text-surface-muted">
              현재 설정으로 파이프라인을 추가하면 여기에 표시됩니다.
            </div>
          ) : (
            <div className="space-y-3">
              {pipelines.map(pipeline => (
                <div
                  key={pipeline.id}
                  onClick={() => setSelectedPipelineId(pipeline.id)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={event => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      setSelectedPipelineId(pipeline.id);
                    }
                  }}
                  className={`w-full rounded-xl border px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-left transition-colors ${
                    selectedPipelineId === pipeline.id
                      ? 'border-accent/45 bg-accent/10'
                      : 'border-white/10 bg-primary/50 hover:border-accent/25'
                  }`}
                >
                  <div>
                    {editingPipelineId === pipeline.id ? (
                      <div className="flex flex-wrap items-center gap-2">
                        <FormInput
                          value={editingPipelineName}
                          onChange={event => setEditingPipelineName(event.target.value)}
                          className="min-w-44 h-8 text-xs"
                          placeholder="파이프라인 이름"
                        />
                        <button
                          type="button"
                          onClick={event => {
                            event.stopPropagation();
                            savePipelineRename();
                          }}
                          className="px-2.5 py-1 rounded-md text-[11px] font-semibold border border-accent/40 bg-accent/10 text-text-bright hover:bg-accent/15 transition-colors"
                        >
                          저장
                        </button>
                        <button
                          type="button"
                          onClick={event => {
                            event.stopPropagation();
                            cancelPipelineRename();
                          }}
                          className="px-2.5 py-1 rounded-md text-[11px] font-semibold border border-white/10 bg-primary/60 text-surface-muted hover:text-text-bright hover:border-accent/30 transition-colors"
                        >
                          취소
                        </button>
                      </div>
                    ) : (
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-xs font-semibold text-text-bright">{pipeline.name}</p>
                        <button
                          type="button"
                          onClick={event => {
                            event.stopPropagation();
                            startPipelineRename(pipeline.id, pipeline.name);
                          }}
                          className="px-2 py-0.5 rounded-md text-[11px] font-semibold border border-white/10 bg-primary/60 text-surface-muted hover:text-text-bright hover:border-accent/30 transition-colors"
                        >
                          이름 변경
                        </button>
                      </div>
                    )}
                    <p className="text-[11px] text-surface-muted mt-1">생성 시각: {pipeline.createdAt}</p>
                  </div>
                  <div className="flex flex-col items-start sm:items-end gap-2">
                    <p className="text-[11px] font-medium text-text-dim">
                      소스 {pipeline.sourceCount} · 규칙 {pipeline.ruleCount} · 목적지 {pipeline.destinationCount}
                    </p>
                    <div className="inline-flex gap-1.5">
                      {([
                        { mode: 'batch', label: '배치' },
                        { mode: 'streaming', label: '스트리밍' },
                      ] as const).map(({ mode, label }) => (
                        <span
                          key={`${pipeline.id}-${mode}`}
                          role="button"
                          tabIndex={0}
                          onClick={event => {
                            event.stopPropagation();
                            setScheduleModeForPipeline(pipeline.id, mode);
                          }}
                          onKeyDown={event => {
                            if (event.key === 'Enter' || event.key === ' ') {
                              event.preventDefault();
                              event.stopPropagation();
                              setScheduleModeForPipeline(pipeline.id, mode);
                            }
                          }}
                          className={`px-2.5 py-1 rounded-md text-[11px] font-semibold tracking-normal border transition-colors ${
                            pipeline.scheduleMode === mode
                              ? 'bg-accent text-primary border-accent'
                              : 'bg-primary/60 text-surface-muted border-white/10 hover:text-text-bright hover:border-accent/30'
                          }`}
                        >
                          {label}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

      </div>

    </div>
  );
};
