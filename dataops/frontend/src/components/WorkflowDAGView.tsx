import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Pencil, Eye, Play, RotateCcw, Plus } from 'lucide-react';
import { DagCanvas } from './dag/DagCanvas';
import { DagNodePalette } from './dag/DagNodePalette';
import { DagNodeConfigPanel } from './dag/DagNodeConfigPanel';
import { DAG_MOCK_DATA } from './dag/dagMockData';
import type { DagNode, DagEdge, PipelineDag, DagNodeType } from '../types/dag';

const PIPELINE_STORAGE_INSTANCES_KEY = 'pipeline-storage-instances';
const DAG_STORAGE_KEY = 'pipeline-storage-dag';

interface StoredPipelineInstance {
  id: string;
  name: string;
  scheduleMode: 'streaming' | 'batch';
  createdAt: string;
}

function readStoredPipelines(): StoredPipelineInstance[] {
  try {
    const raw = localStorage.getItem(PIPELINE_STORAGE_INSTANCES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as StoredPipelineInstance[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
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

function makeDagId(): string {
  return `node-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
}

/** 저장된 DAG가 없는 파이프라인을 위한 기본 DAG 구조를 만든다. */
function buildEmptyDag(pipelineId: string): PipelineDag {
  return {
    pipelineId,
    nodes: [],
    edges: [],
    updatedAt: new Date().toISOString(),
  };
}

const SCHEDULE_BADGE: Record<string, string> = {
  streaming: 'bg-accent/10 text-accent border-accent/20',
  batch: 'bg-purple-400/10 text-purple-400 border-purple-400/20',
};

export function WorkflowDAGView() {
  const [pipelines, setPipelines] = useState<StoredPipelineInstance[]>([]);
  const [dagByPipeline, setDagByPipeline] = useState<Record<string, PipelineDag>>({});
  const [selectedPipelineId, setSelectedPipelineId] = useState<string | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [isEditMode, setEditMode] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const isFirstLoad = useRef(true);

  // Initial load
  useEffect(() => {
    const stored = readStoredPipelines();
    const storedDags = readStoredDags();

    // Seed mock data for known pipelines if not already stored
    const merged: Record<string, PipelineDag> = { ...storedDags };
    Object.entries(DAG_MOCK_DATA).forEach(([id, dag]) => {
      if (!merged[id]) merged[id] = dag;
    });

    setPipelines(stored.length > 0 ? stored : [
      { id: 'pipeline-1', name: '덕산 3상 전류·전압 실시간 모니터링', scheduleMode: 'streaming', createdAt: '' },
      { id: 'pipeline-2', name: '전력 품질 데이터 월간 아카이빙', scheduleMode: 'batch', createdAt: '' },
      { id: 'pipeline-3', name: '누전·전압강하 이상 감지', scheduleMode: 'streaming', createdAt: '' },
    ]);
    setDagByPipeline(merged);
    setSelectedPipelineId('pipeline-1');
    isFirstLoad.current = false;
  }, []);

  // Sync pipelines on storage update
  useEffect(() => {
    const onUpdate = () => {
      const fresh = readStoredPipelines();
      if (fresh.length > 0) setPipelines(fresh);
    };
    window.addEventListener('pipeline-storage-updated', onUpdate);
    window.addEventListener('focus', onUpdate);
    return () => {
      window.removeEventListener('pipeline-storage-updated', onUpdate);
      window.removeEventListener('focus', onUpdate);
    };
  }, []);

  useEffect(() => {
    if (!selectedPipelineId || dagByPipeline[selectedPipelineId]) return;
    setDagByPipeline(prev => ({
      ...prev,
      [selectedPipelineId]: buildEmptyDag(selectedPipelineId),
    }));
  }, [selectedPipelineId, dagByPipeline]);

  // Persist DAG changes
  useEffect(() => {
    if (isFirstLoad.current) return;
    try {
      localStorage.setItem(DAG_STORAGE_KEY, JSON.stringify(dagByPipeline));
      window.dispatchEvent(new CustomEvent('pipeline-storage-updated'));
    } catch {/* ignore */}
  }, [dagByPipeline]);

  // Keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSelectedNodeId(null);
      if ((e.key === 'Delete' || e.key === 'Backspace') && isEditMode && selectedNodeId) {
        const target = e.target as HTMLElement;
        if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;
        handleDeleteNode(selectedNodeId);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEditMode, selectedNodeId]);

  const currentDag = selectedPipelineId ? dagByPipeline[selectedPipelineId] : null;

  const updateDag = useCallback((pipelineId: string, updater: (dag: PipelineDag) => PipelineDag) => {
    setDagByPipeline(prev => {
      const dag = prev[pipelineId];
      if (!dag) return prev;
      return { ...prev, [pipelineId]: { ...updater(dag), updatedAt: new Date().toISOString() } };
    });
  }, []);

  const handleMoveNode = useCallback((id: string, x: number, y: number) => {
    if (!selectedPipelineId) return;
    updateDag(selectedPipelineId, dag => ({
      ...dag,
      nodes: dag.nodes.map(n => n.id === id ? { ...n, position: { x, y } } : n),
    }));
  }, [selectedPipelineId, updateDag]);

  const handleAddEdge = useCallback((sourceId: string, targetId: string) => {
    if (!selectedPipelineId) return;
    updateDag(selectedPipelineId, dag => {
      // Prevent duplicates
      const exists = dag.edges.some(e => e.source === sourceId && e.target === targetId);
      if (exists) return dag;
      return {
        ...dag,
        edges: [...dag.edges, { id: makeDagId(), source: sourceId, target: targetId }],
      };
    });
  }, [selectedPipelineId, updateDag]);

  const handleDeleteEdge = useCallback((edgeId: string) => {
    if (!selectedPipelineId) return;
    updateDag(selectedPipelineId, dag => ({
      ...dag,
      edges: dag.edges.filter(e => e.id !== edgeId),
    }));
  }, [selectedPipelineId, updateDag]);

  const handleAddNode = useCallback((type: DagNodeType, x: number, y: number) => {
    if (!selectedPipelineId) return;
    const defaultLabels: Record<DagNodeType, string> = {
      source: '수집 소스',
      filter: '필터 규칙',
      transform: '변환 단계',
      validate: '검증 단계',
      branch: '분기 노드',
      sink: '적재 대상',
    };
    const newNode: DagNode = {
      id: makeDagId(),
      type,
      label: defaultLabels[type],
      subLabel: '',
      position: { x, y },
      config: {},
    };
    updateDag(selectedPipelineId, dag => ({
      ...dag,
      nodes: [...dag.nodes, newNode],
    }));
    setSelectedNodeId(newNode.id);
  }, [selectedPipelineId, updateDag]);

  /** 선택한 노드 오른쪽에 새 노드를 만들고 자동 연결한다. */
  const handleQuickAddConnectedNode = useCallback((sourceNodeId: string, type: DagNodeType) => {
    if (!selectedPipelineId || !currentDag) return;
    const sourceNode = currentDag.nodes.find(node => node.id === sourceNodeId);
    if (!sourceNode) return;

    const defaultLabels: Record<DagNodeType, string> = {
      source: '수집 소스',
      filter: '필터 규칙',
      transform: '변환 단계',
      validate: '검증 단계',
      branch: '분기 노드',
      sink: '적재 대상',
    };
    const sameTypeNodes = currentDag.nodes.filter(node => node.type === type);
    const baseX = sourceNode.position.x + 240;
    const baseY = sourceNode.position.y;
    const occupied = currentDag.nodes.some(
      node => Math.abs(node.position.x - baseX) < 40 && Math.abs(node.position.y - baseY) < 40,
    );
    const nextY = occupied ? Math.max(baseY, ...sameTypeNodes.map(node => node.position.y)) + 110 : baseY;
    const newNodeId = makeDagId();

    updateDag(selectedPipelineId, dag => ({
      ...dag,
      nodes: [
        ...dag.nodes,
        { id: newNodeId, type, label: defaultLabels[type], subLabel: '', position: { x: baseX, y: nextY }, config: {} },
      ],
      edges: [...dag.edges, { id: makeDagId(), source: sourceNodeId, target: newNodeId }],
    }));
    setSelectedNodeId(newNodeId);
  }, [currentDag, selectedPipelineId, updateDag]);

  /** 팔레트 클릭 추가 시 타입별 컬럼에 맞춰 기본 위치로 노드를 배치한다. */
  const handlePaletteAddNode = useCallback((type: DagNodeType) => {
    const columnByType: Record<DagNodeType, number> = {
      source: 80,
      filter: 340,
      transform: 340,
      validate: 580,
      branch: 580,
      sink: 840,
    };
    const columnNodes = currentDag?.nodes.filter(node => node.type === type) ?? [];
    const nextY = columnNodes.length > 0
      ? Math.max(...columnNodes.map(node => node.position.y)) + 110
      : 120;
    handleAddNode(type, columnByType[type], nextY);
  }, [currentDag, handleAddNode]);

  const handleDeleteNode = useCallback((nodeId: string) => {
    if (!selectedPipelineId) return;
    updateDag(selectedPipelineId, dag => ({
      ...dag,
      nodes: dag.nodes.filter(n => n.id !== nodeId),
      edges: dag.edges.filter(e => e.source !== nodeId && e.target !== nodeId),
    }));
    setSelectedNodeId(null);
  }, [selectedPipelineId, updateDag]);

  const handleUpdateLabel = useCallback((id: string, label: string) => {
    if (!selectedPipelineId) return;
    updateDag(selectedPipelineId, dag => ({
      ...dag,
      nodes: dag.nodes.map(n => n.id === id ? { ...n, label } : n),
    }));
  }, [selectedPipelineId, updateDag]);

  const handleUpdateSubLabel = useCallback((id: string, subLabel: string) => {
    if (!selectedPipelineId) return;
    updateDag(selectedPipelineId, dag => ({
      ...dag,
      nodes: dag.nodes.map(n => n.id === id ? { ...n, subLabel } : n),
    }));
  }, [selectedPipelineId, updateDag]);

  const handleUpdateConfig = useCallback((id: string, key: string, value: string) => {
    if (!selectedPipelineId) return;
    updateDag(selectedPipelineId, dag => ({
      ...dag,
      nodes: dag.nodes.map(n =>
        n.id === id ? { ...n, config: { ...(n.config ?? {}), [key]: value } } : n
      ),
    }));
  }, [selectedPipelineId, updateDag]);

  const handleResetDag = () => {
    if (!selectedPipelineId) return;
    const mock = DAG_MOCK_DATA[selectedPipelineId];
    if (!mock) return;
    setDagByPipeline(prev => ({ ...prev, [selectedPipelineId]: { ...mock, updatedAt: new Date().toISOString() } }));
    setSelectedNodeId(null);
  };

  const selectedNode = currentDag?.nodes.find(n => n.id === selectedNodeId) ?? null;

  return (
    <div className="flex gap-4 h-[calc(100vh-10rem)] min-h-[500px]">
      {/* Left Panel */}
      <div className="w-56 shrink-0 flex flex-col gap-4">
        {/* Pipeline Selector */}
        <div className="bg-primary-container rounded-xl border border-white/5 p-3 flex-shrink-0">
          <div className="text-[10px] font-semibold text-surface-muted uppercase tracking-widest mb-2">
            파이프라인
          </div>
          <div className="space-y-1">
            {pipelines.map(p => (
              <button
                key={p.id}
                onClick={() => { setSelectedPipelineId(p.id); setSelectedNodeId(null); }}
                className={`w-full text-left px-2.5 py-2 rounded-lg transition-colors ${
                  selectedPipelineId === p.id
                    ? 'bg-primary/80 border border-white/10 text-text-bright'
                    : 'text-text-dim hover:bg-white/5'
                }`}
              >
                <div className="text-[11px] font-semibold leading-tight truncate">{p.name}</div>
                <div className="flex items-center gap-1.5 mt-1">
                  <span className={`text-[9px] px-1.5 py-0.5 rounded border ${SCHEDULE_BADGE[p.scheduleMode] ?? 'text-surface-muted border-white/10'}`}>
                    {p.scheduleMode}
                  </span>
                  {dagByPipeline[p.id] && (
                    <span className="text-[9px] text-surface-muted">
                      {dagByPipeline[p.id].nodes.length}노드
                    </span>
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Node Palette (edit mode only) */}
        {isEditMode && (
          <div className="bg-primary-container rounded-xl border border-white/5 p-3 flex-1 overflow-y-auto custom-scrollbar">
            <DagNodePalette onAddNode={handlePaletteAddNode} />
          </div>
        )}
      </div>

      {/* Center: Canvas Area */}
      <div className="flex-1 flex flex-col gap-3 min-w-0">
        {/* Toolbar */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-text-bright font-headline">
              {pipelines.find(p => p.id === selectedPipelineId)?.name ?? 'DAG Editor'}
            </h2>
            {currentDag && (
              <span className="text-[10px] text-surface-muted">
                노드 {currentDag.nodes.length} · 엣지 {currentDag.edges.length}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {/* Running toggle */}
            <button
              onClick={() => setIsRunning(r => !r)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                isRunning
                  ? 'bg-red-400/10 text-red-400 border-red-400/20 hover:bg-red-400/20'
                  : 'bg-accent/10 text-accent border-accent/20 hover:bg-accent/20'
              }`}
            >
              <Play className="w-3.5 h-3.5" />
              {isRunning ? '실행 중지' : '실행 미리보기'}
            </button>

            {/* Reset */}
            {isEditMode && DAG_MOCK_DATA[selectedPipelineId ?? ''] && (
              <button
                onClick={handleResetDag}
                title="Mock 데이터로 초기화"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-white/10 text-text-dim hover:bg-white/5 transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                초기화
              </button>
            )}

            {/* Edit mode toggle */}
            <button
              onClick={() => { setEditMode(e => !e); setSelectedNodeId(null); }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                isEditMode
                  ? 'bg-primary/80 text-text-bright border-white/20'
                  : 'border-white/10 text-text-dim hover:bg-white/5'
              }`}
            >
              {isEditMode ? <Eye className="w-3.5 h-3.5" /> : <Pencil className="w-3.5 h-3.5" />}
              {isEditMode ? '보기 모드' : '편집 모드'}
            </button>
          </div>
        </div>

        {/* Canvas */}
        {currentDag ? (
          <DagCanvas
            nodes={currentDag.nodes}
            edges={currentDag.edges}
            isEditMode={isEditMode}
            isRunning={isRunning}
            selectedNodeId={selectedNodeId}
            onSelectNode={setSelectedNodeId}
            onMoveNode={handleMoveNode}
            onAddEdge={handleAddEdge}
            onDeleteEdge={handleDeleteEdge}
            onAddNode={handleAddNode}
            onQuickAddNode={handleQuickAddConnectedNode}
          />
        ) : (
          <div className="flex-1 flex items-center justify-center bg-primary-container rounded-xl border border-white/5 dag-canvas-bg">
            <div className="text-center">
              <div className="text-sm text-surface-muted mb-2">파이프라인을 선택하세요</div>
              <div className="text-xs text-surface-muted/60">좌측 목록에서 파이프라인을 선택하면 DAG가 표시됩니다</div>
            </div>
          </div>
        )}

        {/* Edit mode hint */}
        {isEditMode && (
          <div className="text-[10px] text-surface-muted flex items-center gap-4">
            <span>• 노드 드래그: 위치 이동</span>
            <span>• 출력 포트(●) → 입력 포트: 엣지 연결</span>
            <span>• 엣지 클릭: 삭제</span>
            <span>• Del: 선택 노드 삭제</span>
          </div>
        )}
      </div>

      {/* Right Panel: Node Config */}
      <DagNodeConfigPanel
        node={selectedNode}
        isEditMode={isEditMode}
        onClose={() => setSelectedNodeId(null)}
        onUpdateLabel={handleUpdateLabel}
        onUpdateSubLabel={handleUpdateSubLabel}
        onUpdateConfig={handleUpdateConfig}
        onDeleteNode={handleDeleteNode}
      />
    </div>
  );
}
