import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { cn } from '@/lib/utils';
import {
  ReactFlow,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  useReactFlow,
  Handle,
  Position,
  type Node,
  type Edge,
  type NodeProps,
  type NodeTypes,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { MES_ONTOLOGY } from '../constants';
import { stripLatinAcronymParentheses } from '../utils/displayLabels';
import { MESFunction, ResultTemplate, OntologySelectedNode } from '../types';
import {
  Network,
  Database,
  ShieldCheck,
  Settings,
  Package,
  Activity,
  LayoutTemplate,
} from 'lucide-react';

const CATEGORY_ORDER = ['Tracking', 'Quality', 'Maintenance', 'Inventory', 'Production'] as const;

/** 그래프 노드 툴팁·L1 라벨용 카테고리 한글명 */
const CATEGORY_LABEL_KO: Record<string, string> = {
  Tracking: '추적',
  Quality: '품질',
  Maintenance: '보전',
  Inventory: '재고',
  Production: '생산',
};

/** 카테고리 약어 (원형 노드 내 표시) */
const CATEGORY_SHORT: Record<string, string> = {
  Tracking: '추적',
  Quality: '품질',
  Maintenance: '보전',
  Inventory: '재고',
  Production: '생산',
};

/** 기능 노드 원형 내부 약어 */
const FUNCTION_SHORT: Record<string, string> = {
  F001: '진행',
  F002: '공정',
  F003: '예지',
  F004: '일정',
  F005: '이력',
  F006: '불량',
  F007: '오더',
  F008: '보전',
  F009: '자재',
};

/** 기능 노드 외부 한글 라벨 */
const FN_LABEL_KO: Record<string, string> = {
  F001: '진행 현황',
  F002: '공정 품질',
  F003: '예지 보전',
  F004: '일정 관리',
  F005: '이력 추적',
  F006: '불량 관리',
  F007: '생산 오더',
  F008: '보전 계획',
  F009: '자재 추적',
};

function groupByCategory(ontology: MESFunction[]): Map<string, MESFunction[]> {
  const map = new Map<string, MESFunction[]>();
  for (const fn of ontology) {
    const list = map.get(fn.category) ?? [];
    list.push(fn);
    map.set(fn.category, list);
  }
  return map;
}

/** L3 템플릿 시각 구분: 참조 카탈로그 / 추천 / 매칭 L2와 연결 / 이번 분석 결과(결과 화면 전용 id) */
type TemplateVariant = 'reference' | 'matchLinked' | 'recommended' | 'analysisResult';

function getTemplateVariant(
  tpl: ResultTemplate,
  highlightedIdSet: Set<string> | null,
  recommendedTemplateIdSet: Set<string> | null
): TemplateVariant {
  if (tpl.id === 'result-current') return 'analysisResult';
  if (recommendedTemplateIdSet?.has(tpl.id)) return 'recommended';
  if (highlightedIdSet && tpl.recommendedFunctionIds.some((fid) => highlightedIdSet.has(fid))) return 'matchLinked';
  return 'reference';
}

const CATEGORY_STYLE: Record<string, { bg: string; border: string; ring: string; text: string }> = {
  Tracking:    { bg: 'bg-blue-50',    border: 'border-blue-300',    ring: 'ring-blue-100',    text: 'text-blue-700'    },
  Quality:     { bg: 'bg-emerald-50', border: 'border-emerald-300', ring: 'ring-emerald-100', text: 'text-emerald-700' },
  Maintenance: { bg: 'bg-amber-50',   border: 'border-amber-300',   ring: 'ring-amber-100',   text: 'text-amber-700'   },
  Inventory:   { bg: 'bg-violet-50',  border: 'border-violet-300',  ring: 'ring-violet-100',  text: 'text-violet-700'  },
  Production:  { bg: 'bg-rose-50',    border: 'border-rose-300',    ring: 'ring-rose-100',    text: 'text-rose-700'    },
};

const CategoryIcon = ({ category, size = 14 }: { category: string; size?: number }) => {
  switch (category) {
    case 'Tracking':    return <Network     className="text-blue-500 shrink-0"    style={{ width: size, height: size }} />;
    case 'Quality':     return <ShieldCheck className="text-emerald-500 shrink-0" style={{ width: size, height: size }} />;
    case 'Maintenance': return <Settings    className="text-amber-500 shrink-0"   style={{ width: size, height: size }} />;
    case 'Inventory':   return <Package     className="text-violet-500 shrink-0"  style={{ width: size, height: size }} />;
    case 'Production':  return <Activity    className="text-rose-500 shrink-0"    style={{ width: size, height: size }} />;
    default:            return <Database    className="text-slate-500 shrink-0"   style={{ width: size, height: size }} />;
  }
};

/** 각도(rad)를 React Flow Handle Position으로 변환 (중심 방향 기준) */
function angleToPosition(angleRad: number): Position {
  const deg = (angleRad * 180) / Math.PI;
  if (deg >= -135 && deg < -45) return Position.Top;
  if (deg >= -45 && deg < 45) return Position.Left;
  if (deg >= 45 && deg < 135) return Position.Bottom;
  return Position.Right;
}

/** 반대 방향 Position (바깥쪽 엣지용) */
function oppositePosition(p: Position): Position {
  if (p === Position.Top) return Position.Bottom;
  if (p === Position.Bottom) return Position.Top;
  if (p === Position.Left) return Position.Right;
  return Position.Left;
}

/** 루트 노드: 중앙 원형 (L0, 전문적 시각). 클릭 시 메타 패널 표시 */
function RootNode({ data }: NodeProps<{ label: string }>) {
  return (
    <div className="relative w-20 h-20 rounded-full bg-gradient-to-br from-slate-800 to-slate-700 text-white shadow-xl shadow-slate-900/20 ring-2 ring-slate-600/50 flex flex-col items-center justify-center cursor-pointer">
      <Handle type="source" position={Position.Bottom} className="!w-0 !h-0 !min-w-0 !min-h-0 !border-0 !opacity-0" />
      <Database className="w-5 h-5 text-indigo-300 mb-0.5 shrink-0" />
      <span className="font-bold text-[13px] leading-tight px-0.5 text-center tracking-tight">{data.label}</span>
      <span className="absolute -top-1 -right-1 text-[10px] font-semibold text-slate-400 bg-slate-700/80 rounded px-1">L0</span>
    </div>
  );
}

/** 카테고리 노드: 원형, L1 도메인 (전문적 시각). data.functionIds는 클릭 시 패널용 */
function CategoryNode({ data }: NodeProps<{ label: string; category: string; shortLabel?: string; targetPos?: Position; sourcePos?: Position; functionIds?: string[] }>) {
  const target = data.targetPos ?? Position.Top;
  const source = data.sourcePos ?? Position.Bottom;
  const label = data.shortLabel ?? data.label;
  const cs = CATEGORY_STYLE[data.category] ?? { bg: 'bg-slate-50', border: 'border-slate-300', ring: 'ring-slate-100', text: 'text-slate-700' };
  return (
    <div className={`relative w-[4.5rem] h-[4.5rem] rounded-full border-2 shadow-md ring-1 flex flex-col items-center justify-center cursor-pointer ${cs.bg} ${cs.border} ${cs.ring}`} title={data.label}>
      <Handle type="target" position={target} className="!w-0 !h-0 !min-w-0 !min-h-0 !border-0 !opacity-0" />
      <Handle type="source" position={source} className="!w-0 !h-0 !min-w-0 !min-h-0 !border-0 !opacity-0" />
      <span className={`absolute -top-0.5 -right-0.5 text-[10px] font-semibold rounded px-1 ${cs.text} ${cs.bg}`}>L1</span>
      <CategoryIcon category={data.category} size={20} />
      <span className={`font-bold text-[13px] leading-tight mt-0.5 tracking-wide ${cs.text}`}>{label}</span>
    </div>
  );
}

/** 기능 노드: 원형, L2 기능. 원 외부에 한글 라벨 표시. highlighted 시 매칭 강조 */
function FunctionNode({ data, selected }: NodeProps<{ label: string; id: string; standard: string; fn: MESFunction; shortLabel?: string; targetPos?: Position; highlighted?: boolean }>) {
  const target = data.targetPos ?? Position.Top;
  const short = data.shortLabel ?? data.id;
  const highlighted = data.highlighted === true;
  const koLabel = FN_LABEL_KO[data.id] ?? short;
  return (
    <div className="flex flex-col items-center gap-1" title={`${data.id}: ${data.label}`}>
      <div
        className={`relative w-16 h-16 rounded-full flex flex-col items-center justify-center cursor-pointer transition-all border-2 ${
          selected
            ? 'bg-indigo-100 border-indigo-600 shadow-lg ring-[3px] ring-indigo-400'
            : highlighted
              ? 'bg-indigo-50 border-indigo-400 shadow-md ring-2 ring-indigo-200'
              : 'bg-white border-slate-200 shadow-sm hover:border-indigo-300 hover:bg-indigo-50/60 hover:shadow-md'
        }`}
      >
        <Handle type="target" position={target} className="!w-0 !h-0 !min-w-0 !min-h-0 !border-0 !opacity-0" />
        <span className="absolute -top-0.5 right-0.5 text-[10px] font-medium text-slate-400">L2</span>
        <span className={`font-mono text-[10px] font-semibold ${highlighted || selected ? 'text-indigo-400' : 'text-slate-400'}`}>{data.id}</span>
        <span className={`text-[13px] font-bold leading-tight ${highlighted || selected ? 'text-indigo-700' : 'text-slate-800'}`}>{short}</span>
      </div>
      <span className={`text-[11px] font-semibold leading-tight whitespace-nowrap ${highlighted || selected ? 'text-indigo-600' : 'text-slate-600'}`}>{koLabel}</span>
    </div>
  );
}

/**
 * L3 템플릿 노드: 저채도 공통 바탕 + 상태별 테두리/배지 강도로 구분합니다.
 * templateVariant는 buildGraphElements에서 추천 id·highlightedIds·템플릿 id 기준으로 설정합니다.
 */
function TemplateNode({
  data,
}: NodeProps<{
  label: string;
  templateId: string;
  template?: ResultTemplate;
  templateVariant?: TemplateVariant;
}>) {
  const v = data.templateVariant ?? 'reference';
  const shell =
    v === 'analysisResult'
      ? 'bg-emerald-100 border-emerald-600 ring-emerald-300/70 border-[3px]'
      : v === 'recommended'
        ? 'bg-indigo-100 border-indigo-600 ring-indigo-300/70 border-[2.5px]'
        : v === 'matchLinked'
          ? 'bg-sky-100 border-sky-600 ring-sky-300/70 border-2 border-dashed'
          : 'bg-slate-100 border-slate-400 ring-slate-200/70 border-2';
  const icon =
    v === 'analysisResult'
      ? 'text-emerald-700'
      : v === 'recommended'
        ? 'text-indigo-700'
        : v === 'matchLinked'
          ? 'text-sky-700'
          : 'text-slate-500';
  const badge =
    v === 'analysisResult'
      ? 'text-emerald-800 bg-emerald-200'
      : v === 'recommended'
        ? 'text-indigo-800 bg-indigo-200'
        : v === 'matchLinked'
          ? 'text-sky-800 bg-sky-200'
          : 'text-slate-600 bg-slate-200';
  const caption =
    v === 'analysisResult'
      ? 'text-emerald-800 font-bold'
      : v === 'recommended'
        ? 'text-indigo-800 font-bold'
        : v === 'matchLinked'
          ? 'text-sky-800 font-semibold'
          : 'text-slate-600';
  return (
    <div className="flex flex-col items-center gap-1" title={data.label}>
      <div
        className={`relative w-[4.5rem] h-[4.5rem] rounded-full border-2 shadow-md ring-2 flex flex-col items-center justify-center cursor-pointer ${shell}`}
      >
        <Handle type="source" position={Position.Bottom} className="!w-0 !h-0 !min-w-0 !min-h-0 !border-0 !opacity-0" />
        <LayoutTemplate className={`w-5 h-5 shrink-0 ${icon}`} />
        <span className={`absolute -top-0.5 right-0.5 text-[10px] font-semibold rounded px-1 ${badge}`}>L3</span>
      </div>
      <span className={`text-[11px] font-semibold leading-tight whitespace-nowrap max-w-[100px] text-center ${caption}`}>{data.label}</span>
    </div>
  );
}

const nodeTypes: NodeTypes = {
  root: RootNode,
  category: CategoryNode,
  function: FunctionNode,
  template: TemplateNode,
};

const EDGE_COLORS = {
  default:        '#94a3b8', // slate-400
  analysisResult: '#059669', // emerald-600
  recommended:    '#4f46e5', // indigo-600
  matchLinked:    '#0284c7', // sky-600
} as const;

/** 방사형(원형) 레이아웃: 중앙 루트 → 1링 카테고리 → 2링 기능 → 3링 템플릿(선택). */
function buildGraphElements(
  ontology: MESFunction[],
  highlightedIds?: string[],
  templates?: ResultTemplate[],
  recommendedTemplateIds?: ReadonlySet<string>
): { nodes: Node[]; edges: Edge[] } {
  const byCategory = groupByCategory(ontology);
  const nodes: Node[] = [];
  const edges: Edge[] = [];

  const ROOT_ID = 'mes-root';
  const cx = 480;
  const cy = 240;
  const R1 = 130; // 카테고리 반지름
  const R2 = 240; // 기능 반지름
  const R3 = 340; // L3 템플릿 반지름
  const FUN_SPREAD_DEG = 22; // 같은 카테고리 내 기능 간 각도
  const TPL_SPREAD_DEG = 18; // 같은 Function에 연결된 L3 템플릿 간 각도(겹침 방지)
  const TPL_RADIUS = 340; // L3 템플릿 반지름 (Function보다 바깥에 배치)

  // 루트 노드 (중앙)
  nodes.push({
    id: ROOT_ID,
    type: 'root',
    position: { x: cx - 40, y: cy - 40 },
    data: { label: '표준 MES' },
    sourcePosition: Position.Bottom,
    targetPosition: Position.Top,
  });

  // 카테고리: 1링에 균등 각도 (위쪽부터 시계방향)
  const categoryAngles: number[] = [];
  for (let i = 0; i < CATEGORY_ORDER.length; i++) {
    categoryAngles.push((-90 + (i * 360) / CATEGORY_ORDER.length) * (Math.PI / 180));
  }

  CATEGORY_ORDER.forEach((cat, idx) => {
    const list = byCategory.get(cat) ?? [];
    if (list.length === 0) return;
    const id = `cat-${cat}`;
    const rad = categoryAngles[idx];
    const x = cx + R1 * Math.cos(rad);
    const y = cy + R1 * Math.sin(rad);
    const angleToCenter = Math.atan2(cy - y, cx - x);
    const targetPos = angleToPosition(angleToCenter);
    const sourcePos = oppositePosition(targetPos);

    nodes.push({
      id,
      type: 'category',
      position: { x: x - 36, y: y - 36 },
      data: {
        label: CATEGORY_LABEL_KO[cat] ?? cat,
        category: cat,
        shortLabel: CATEGORY_SHORT[cat] ?? cat,
        targetPos,
        sourcePos,
        functionIds: list.map((f) => f.id),
      },
      sourcePosition: sourcePos,
      targetPosition: targetPos,
    });
    edges.push({
      id: `e-${ROOT_ID}-${id}`,
      source: ROOT_ID,
      target: id,
      type: 'straight',
      style: { stroke: EDGE_COLORS.default, strokeWidth: 1.5 },
    });
  });

  // 기능: 2링, 카테고리 방향 주변에 분산. L3 배치용으로 기능 노드 중심 좌표 맵 구성
  const functionPositionMap = new Map<string, { x: number; y: number }>();
  CATEGORY_ORDER.forEach((cat, catIdx) => {
    const list = byCategory.get(cat) ?? [];
    const catId = `cat-${cat}`;
    const baseRad = categoryAngles[catIdx];
    const n = list.length;
    const startOffset = n > 1 ? (-(n - 1) / 2) * (FUN_SPREAD_DEG * (Math.PI / 180)) : 0;

    list.forEach((fn, fnIdx) => {
      const nid = fn.id;
      const funRad = baseRad + startOffset + fnIdx * (FUN_SPREAD_DEG * (Math.PI / 180));
      const fx = cx + R2 * Math.cos(funRad);
      const fy = cy + R2 * Math.sin(funRad);
      functionPositionMap.set(nid, { x: fx, y: fy });
      const catX = cx + R1 * Math.cos(baseRad);
      const catY = cy + R1 * Math.sin(baseRad);
      const angleToCat = Math.atan2(catY - fy, catX - fx);
      const targetPos = angleToPosition(angleToCat);

      nodes.push({
        id: nid,
        type: 'function',
        position: { x: fx - 32, y: fy - 32 },
        data: {
          label: stripLatinAcronymParentheses(fn.nameKo ?? fn.name),
          id: fn.id,
          standard: fn.standard,
          fn,
          shortLabel: FUNCTION_SHORT[fn.id] ?? fn.id,
          targetPos,
          highlighted: highlightedIds?.includes(fn.id),
        },
        sourcePosition: Position.Bottom,
        targetPosition: targetPos,
      });
      edges.push({
        id: `e-${catId}-${nid}`,
        source: catId,
        target: nid,
        type: 'straight',
        style: { stroke: EDGE_COLORS.default, strokeWidth: 1.5 },
      });
    });
  });

  // L3 템플릿: 연결된 L2 Function 근처에 배치.
  const templateList = templates?.length ? templates : [];
  const highlightedIdSet = highlightedIds?.length ? new Set(highlightedIds) : null;
  const recommendedTemplateIdSet = recommendedTemplateIds && recommendedTemplateIds.size > 0
    ? new Set(recommendedTemplateIds)
    : null;
  const byPrimaryFid = new Map<string, number[]>();
  templateList.forEach((tpl, tplIdx) => {
    const primaryFid = tpl.recommendedFunctionIds[0] ?? '';
    const arr = byPrimaryFid.get(primaryFid) ?? [];
    arr.push(tplIdx);
    byPrimaryFid.set(primaryFid, arr);
  });

  templateList.forEach((tpl, tplIdx) => {
    const tplId = `template-${tpl.id}`;
    const primaryFid = tpl.recommendedFunctionIds[0];
    const pos = primaryFid ? functionPositionMap.get(primaryFid) : undefined;
    const indices = primaryFid ? byPrimaryFid.get(primaryFid) ?? [] : [];
    const indexInGroup = indices.indexOf(tplIdx);
    const groupSize = indices.length;

    let tx: number;
    let ty: number;
    if (pos && groupSize > 0) {
      const baseAngle = Math.atan2(pos.y - cy, pos.x - cx);
      const spreadRad = (TPL_SPREAD_DEG * (Math.PI / 180));
      const offset = (indexInGroup - (groupSize - 1) / 2) * spreadRad;
      const angle = baseAngle + offset;
      tx = cx + TPL_RADIUS * Math.cos(angle);
      ty = cy + TPL_RADIUS * Math.sin(angle);
    } else {
      const numTpl = templateList.length;
      const angle = numTpl === 1
        ? (90 * Math.PI) / 180
        : (-90 + (tplIdx * 360) / numTpl) * (Math.PI / 180);
      tx = cx + R3 * Math.cos(angle);
      ty = cy + R3 * Math.sin(angle);
    }

    const templateVariant = getTemplateVariant(tpl, highlightedIdSet, recommendedTemplateIdSet);
    nodes.push({
      id: tplId,
      type: 'template',
      position: { x: tx - 36, y: ty - 36 },
      data: { label: tpl.name, templateId: tpl.id, template: tpl, templateVariant },
      sourcePosition: Position.Bottom,
      targetPosition: Position.Top,
    });

    tpl.recommendedFunctionIds.forEach((fid) => {
      const toHighlighted = highlightedIdSet?.has(fid) ?? false;
      const isAnalysisTpl = tpl.id === 'result-current';
      const isRecommendedTpl = recommendedTemplateIdSet?.has(tpl.id) ?? false;
      const variant = isAnalysisTpl
        ? 'analysisResult'
        : isRecommendedTpl
          ? 'recommended'
          : toHighlighted
            ? 'matchLinked'
            : 'reference';
      const edgeStyle =
        variant === 'analysisResult'
          ? { stroke: EDGE_COLORS.analysisResult, strokeWidth: 2.8, strokeDasharray: undefined, opacity: 0.95 }
          : variant === 'recommended'
            ? { stroke: EDGE_COLORS.recommended,    strokeWidth: 2.3, strokeDasharray: undefined, opacity: 0.9  }
            : variant === 'matchLinked'
              ? { stroke: EDGE_COLORS.matchLinked,  strokeWidth: 2.0, strokeDasharray: '4 3',     opacity: 0.82 }
              : { stroke: EDGE_COLORS.default,      strokeWidth: 1.5, strokeDasharray: '2 4',     opacity: 0.65 };
      edges.push({
        id: `e-${tplId}-${fid}`,
        source: tplId,
        target: fid,
        type: 'straight',
        style: edgeStyle,
      });
    });
  });

  return { nodes, edges };
}

/**
 * 컨테이너 높이·노드 구성이 바뀐 뒤에도 그래프가 보이는 영역에 맞게 줌/팬되도록
 * `fitView`를 다시 호출합니다. 마운트 직후 크기 0 또는 ResizeObserver 갱신 시
 * React Flow가 한 번만 fit 하는 문제를 완화합니다.
 */
function RefitViewOnLayoutChange({ layoutKey }: { layoutKey: string }) {
  const { fitView } = useReactFlow();

  useEffect(() => {
    let cancelled = false;
    let innerRaf = 0;
    const outerRaf = requestAnimationFrame(() => {
      innerRaf = requestAnimationFrame(() => {
        if (cancelled) return;
        fitView({ padding: 0.12, duration: 0, maxZoom: 1.5 });
      });
    });
    return () => {
      cancelled = true;
      cancelAnimationFrame(outerRaf);
      cancelAnimationFrame(innerRaf);
    };
  }, [fitView, layoutKey]);

  return null;
}

export interface OntologyGraphProps {
  onSelectNode?: (node: OntologySelectedNode) => void;
  onSelectFunction?: (fn: MESFunction) => void;
  /** 고정 높이(px). 지정 시 레이아웃이 픽셀 고정됩니다. 미지정 시 뷰포트 기반 반응형 높이를 씁니다. */
  height?: number;
  /** true면 임베드·접힌 영역용으로 상대적으로 낮은 높이 clamp를 사용합니다(height가 있으면 무시). */
  compact?: boolean;
  highlightedIds?: string[];
  templates?: ResultTemplate[];
  recommendedTemplateIds?: ReadonlySet<string>;
}

const OntologyGraph: React.FC<OntologyGraphProps> = ({
  onSelectNode,
  onSelectFunction,
  height,
  compact = false,
  highlightedIds,
  templates,
  recommendedTemplateIds,
}) => {
  const fixedHeight = height != null;

  // 컨테이너 폭을 실측해 4:3 비율로 높이를 동적 계산 (반응형)
  const wrapperRef = useRef<HTMLDivElement>(null);
  const minH = compact ? 300 : 420;
  const maxHRatio = compact ? 0.56 : 0.80;
  const [canvasHeight, setCanvasHeight] = useState<number>(minH);

  const updateHeight = useCallback(() => {
    const el = wrapperRef.current;
    if (!el) return;
    const w = el.getBoundingClientRect().width;
    const computed = Math.round(w * (3 / 4));
    const maxH = Math.round(window.innerHeight * maxHRatio);
    setCanvasHeight(Math.min(Math.max(computed, minH), maxH));
  }, [minH, maxHRatio]);

  useEffect(() => {
    if (fixedHeight) return;
    updateHeight();
    const ro = new ResizeObserver(updateHeight);
    if (wrapperRef.current) ro.observe(wrapperRef.current);
    return () => ro.disconnect();
  }, [fixedHeight, updateHeight]);

  const { nodes: initialNodes, edges: initialEdges } = useMemo(
    () => buildGraphElements(MES_ONTOLOGY, highlightedIds, templates, recommendedTemplateIds),
    [highlightedIds, templates, recommendedTemplateIds]
  );
  const refitLayoutKey = `${fixedHeight ? (height ?? 0) : canvasHeight}|${initialNodes.length}|${initialEdges.length}|${highlightedIds?.join(',') ?? ''}|${templates?.length ?? 0}`;
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  /** highlightedIds·templates 변경 시 그래프를 다시 채웁니다(useNodesState 초기값은 마운트 시 한 번만 적용됨). */
  useEffect(() => {
    setNodes(initialNodes);
    setEdges(initialEdges);
  }, [initialNodes, initialEdges, setNodes, setEdges]);

  const onNodeClick = React.useCallback(
    (_: React.MouseEvent, node: Node) => {
      if (!onSelectNode && !onSelectFunction) return;
      switch (node.type) {
        case 'root':
          onSelectNode?.({ type: 'root', data: { label: (node.data?.label as string) ?? '표준 MES' } });
          break;
        case 'category': {
          const d = node.data as { category?: string; label?: string; functionIds?: string[] };
          onSelectNode?.({ type: 'domain', data: { category: d?.category ?? '', label: d?.label ?? '', functionIds: d?.functionIds ?? [] } });
          break;
        }
        case 'function':
          if (node.data?.fn) {
            onSelectNode?.({ type: 'function', data: { fn: node.data.fn as MESFunction } });
            onSelectFunction?.(node.data.fn as MESFunction);
          }
          break;
        case 'template':
          if (node.data?.template) {
            onSelectNode?.({ type: 'template', data: { template: node.data.template as ResultTemplate } });
          }
          break;
        default:
          break;
      }
    },
    [onSelectNode, onSelectFunction]
  );

  return (
    <div ref={wrapperRef} className="w-full">
    <div
      className="rounded-xl border border-slate-200 bg-gradient-to-b from-slate-50 to-slate-100/80 overflow-hidden shadow-sm flex flex-col w-full"
      style={{ height: fixedHeight ? height : canvasHeight }}
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-3 px-3 sm:px-4 py-2.5 border-b border-slate-200 bg-white/80 shrink-0">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-slate-800">Ontology Structure</h3>
          <p className="text-[10px] text-slate-500 mt-0.5 leading-snug">
            L0 Root · L1 Domain · L2 Function · L3 참조/매칭연계/추천/분석결과 템플릿
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[10px] text-slate-500 sm:justify-end w-full sm:w-auto sm:max-w-[min(100%,520px)]">
          <span className="flex items-center gap-1 shrink-0"><span className="w-2.5 h-2.5 rounded-full bg-slate-700" /> Root</span>
          <span className="flex items-center gap-1 shrink-0"><span className="w-2.5 h-2.5 rounded-full bg-blue-50 border-2 border-blue-300" /> Domain (L1)</span>
          <span className="flex items-center gap-1 shrink-0"><span className="w-2.5 h-2.5 rounded-full bg-white border-2 border-slate-300" /> Function (L2)</span>
          <span className="flex items-center gap-1 shrink-0"><span className="w-2.5 h-2.5 rounded-full bg-indigo-50 border-2 border-indigo-500" /> 매칭 기능</span>
          <span className="flex items-center gap-1 shrink-0"><span className="w-2.5 h-2.5 rounded-full bg-slate-100 border-2 border-slate-400" /> 참조 L3</span>
          <span className="flex items-center gap-1 shrink-0"><span className="w-2.5 h-2.5 rounded-full bg-sky-100 border-2 border-sky-600" style={{borderStyle:'dashed'}} /> 매칭 연계 L3</span>
          <span className="flex items-center gap-1 shrink-0"><span className="w-2.5 h-2.5 rounded-full bg-indigo-100 border-[2.5px] border-indigo-600" /> 추천 L3</span>
          <span className="flex items-center gap-1 shrink-0"><span className="w-2.5 h-2.5 rounded-full bg-emerald-100 border-[3px] border-emerald-600" /> 분석 결과 L3</span>
        </div>
      </div>
      <div className="relative flex-1 min-h-0 w-full">
        <ReactFlow
          className="h-full w-full"
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeClick={onNodeClick}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{ padding: 0.12, maxZoom: 1.5 }}
          minZoom={0.25}
          maxZoom={1.5}
          nodesDraggable
          nodesConnectable={false}
          elementsSelectable
          proOptions={{ hideAttribution: true }}
        >
          <RefitViewOnLayoutChange layoutKey={refitLayoutKey} />
          <Controls className="!bottom-3 !top-auto !bg-white/90 !rounded-lg !border !border-slate-200 !shadow" showInteractive={false} />
          <Background gap={20} size={1} color="#cbd5e1" />
        </ReactFlow>
      </div>
    </div>
    </div>
  );
};

export default OntologyGraph;
