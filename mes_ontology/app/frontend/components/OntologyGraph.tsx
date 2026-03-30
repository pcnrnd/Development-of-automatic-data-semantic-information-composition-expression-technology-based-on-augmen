import React, { useMemo } from 'react';
import {
  ReactFlow,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  Handle,
  Position,
  type Node,
  type Edge,
  type NodeProps,
  type NodeTypes,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { MES_ONTOLOGY } from '../constants';
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

/** 카테고리 약어 (원형 노드 내 가독성) */
const CATEGORY_SHORT: Record<string, string> = {
  Tracking: 'Track',
  Quality: 'Quality',
  Maintenance: 'Maint',
  Inventory: 'Inv',
  Production: 'Prod',
};

/** 기능 노드 원형 내부 약어 */
const FUNCTION_SHORT: Record<string, string> = {
  F001: 'WIP',
  F002: 'SPC',
  F003: 'PdM',
  F004: 'Sched',
  F005: 'Trace',
  F006: 'NCM',
  F007: 'POM',
  F008: 'Maint',
  F009: 'Mat',
};

/** 기능 노드 외부 한글 라벨 */
const FN_LABEL_KO: Record<string, string> = {
  F001: 'WIP 추적',
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

const CategoryIcon = ({ category, size = 14 }: { category: string; size?: number }) => {
  switch (category) {
    case 'Tracking': return <Network className="text-blue-500 shrink-0" style={{ width: size, height: size }} />;
    case 'Quality': return <ShieldCheck className="text-emerald-500 shrink-0" style={{ width: size, height: size }} />;
    case 'Maintenance': return <Settings className="text-amber-500 shrink-0" style={{ width: size, height: size }} />;
    case 'Inventory': return <Package className="text-indigo-500 shrink-0" style={{ width: size, height: size }} />;
    case 'Production': return <Activity className="text-rose-500 shrink-0" style={{ width: size, height: size }} />;
    default: return <Database className="text-slate-500 shrink-0" style={{ width: size, height: size }} />;
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
      <span className="font-bold text-xs leading-tight px-0.5 text-center tracking-tight">{data.label}</span>
      <span className="absolute -top-1 -right-1 text-[9px] font-semibold text-slate-400 bg-slate-700/80 rounded px-1">L0</span>
    </div>
  );
}

/** 카테고리 노드: 원형, L1 도메인 (전문적 시각). data.functionIds는 클릭 시 패널용 */
function CategoryNode({ data }: NodeProps<{ label: string; category: string; shortLabel?: string; targetPos?: Position; sourcePos?: Position; functionIds?: string[] }>) {
  const target = data.targetPos ?? Position.Top;
  const source = data.sourcePos ?? Position.Bottom;
  const label = data.shortLabel ?? data.label;
  return (
    <div className="relative w-[4.5rem] h-[4.5rem] rounded-full bg-white border-2 border-slate-300 shadow-md shadow-slate-200 ring-1 ring-slate-200 flex flex-col items-center justify-center cursor-pointer" title={data.label}>
      <Handle type="target" position={target} className="!w-0 !h-0 !min-w-0 !min-h-0 !border-0 !opacity-0" />
      <Handle type="source" position={source} className="!w-0 !h-0 !min-w-0 !min-h-0 !border-0 !opacity-0" />
      <span className="absolute -top-0.5 -right-0.5 text-[8px] font-semibold text-slate-400 bg-slate-100 rounded px-1">L1</span>
      <CategoryIcon category={data.category} size={20} />
      <span className="font-bold text-slate-800 text-xs uppercase leading-tight mt-0.5 tracking-wide">{label}</span>
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
            ? 'bg-indigo-50 border-indigo-500 shadow-lg ring-2 ring-indigo-200'
            : highlighted
              ? 'bg-indigo-50 border-indigo-500 shadow-md ring-2 ring-indigo-300'
              : 'bg-white border-slate-300 shadow-sm hover:border-indigo-400 hover:bg-indigo-50/80 hover:shadow-md'
        }`}
      >
        <Handle type="target" position={target} className="!w-0 !h-0 !min-w-0 !min-h-0 !border-0 !opacity-0" />
        <span className="absolute -top-0.5 right-0.5 text-[8px] font-medium text-slate-400">L2</span>
        <span className={`font-mono text-[9px] font-semibold ${highlighted || selected ? 'text-indigo-400' : 'text-slate-400'}`}>{data.id}</span>
        <span className={`text-[12px] font-bold leading-tight ${highlighted || selected ? 'text-indigo-700' : 'text-slate-800'}`}>{short}</span>
      </div>
      <span className={`text-[10px] font-semibold leading-tight whitespace-nowrap ${highlighted || selected ? 'text-indigo-600' : 'text-slate-600'}`}>{koLabel}</span>
    </div>
  );
}

/** L3 템플릿 노드: 블루 채운 원형. 이름은 원 외부에 표시해 가독성 확보 */
function TemplateNode({ data }: NodeProps<{ label: string; templateId: string; template?: ResultTemplate }>) {
  return (
    <div className="flex flex-col items-center gap-1" title={data.label}>
      <div className="relative w-[4.5rem] h-[4.5rem] rounded-full bg-blue-300 border-2 border-blue-400 shadow-lg ring-2 ring-blue-200/60 flex flex-col items-center justify-center cursor-pointer">
        <Handle type="source" position={Position.Bottom} className="!w-0 !h-0 !min-w-0 !min-h-0 !border-0 !opacity-0" />
        <LayoutTemplate className="w-5 h-5 text-blue-900 shrink-0" />
        <span className="absolute -top-0.5 right-0.5 text-[8px] font-semibold text-blue-700 bg-blue-100 rounded px-1">L3</span>
      </div>
      <span className="text-[10px] font-semibold text-blue-700 leading-tight whitespace-nowrap max-w-[90px] text-center">{data.label}</span>
    </div>
  );
}

const nodeTypes: NodeTypes = {
  root: RootNode,
  category: CategoryNode,
  function: FunctionNode,
  template: TemplateNode,
};

/** 방사형(원형) 레이아웃: 중앙 루트 → 1링 카테고리 → 2링 기능 → 3링 템플릿(선택). */
function buildGraphElements(
  ontology: MESFunction[],
  highlightedIds?: string[],
  templates?: ResultTemplate[]
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
    data: { label: 'Standard MES' },
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
      data: { label: cat, category: cat, shortLabel: CATEGORY_SHORT[cat] ?? cat, targetPos, sourcePos, functionIds: list.map((f) => f.id) },
      sourcePosition: sourcePos,
      targetPosition: targetPos,
    });
    edges.push({
      id: `e-${ROOT_ID}-${id}`,
      source: ROOT_ID,
      target: id,
      type: 'straight',
      style: { stroke: '#94a3b8', strokeWidth: 1.5 },
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
          label: fn.name,
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
        style: { stroke: '#94a3b8', strokeWidth: 1.5 },
      });
    });
  });

  // L3 템플릿: 연결된 L2 Function 근처에 배치.
  const templateList = templates?.length ? templates : [];
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

    nodes.push({
      id: tplId,
      type: 'template',
      position: { x: tx - 36, y: ty - 36 },
      data: { label: tpl.name, templateId: tpl.id, template: tpl },
      sourcePosition: Position.Bottom,
      targetPosition: Position.Top,
    });

    tpl.recommendedFunctionIds.forEach((fid) => {
      edges.push({
        id: `e-${tplId}-${fid}`,
        source: tplId,
        target: fid,
        type: 'straight',
        style: { stroke: '#60a5fa', strokeWidth: 2, strokeDasharray: '5 3' },
      });
    });
  });

  return { nodes, edges };
}

export interface OntologyGraphProps {
  onSelectNode?: (node: OntologySelectedNode) => void;
  onSelectFunction?: (fn: MESFunction) => void;
  height?: number;
  highlightedIds?: string[];
  templates?: ResultTemplate[];
}

const OntologyGraph: React.FC<OntologyGraphProps> = ({
  onSelectNode,
  onSelectFunction,
  height = 420,
  highlightedIds,
  templates,
}) => {
  const { nodes: initialNodes, edges: initialEdges } = useMemo(
    () => buildGraphElements(MES_ONTOLOGY, highlightedIds, templates),
    [highlightedIds, templates]
  );
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  const onNodeClick = React.useCallback(
    (_: React.MouseEvent, node: Node) => {
      if (!onSelectNode && !onSelectFunction) return;
      switch (node.type) {
        case 'root':
          onSelectNode?.({ type: 'root', data: { label: (node.data?.label as string) ?? 'Standard MES' } });
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
    <div className="rounded-xl border border-slate-200 bg-gradient-to-b from-slate-50 to-slate-100/80 overflow-hidden shadow-sm" style={{ height }}>
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-200 bg-white/80">
        <div>
          <h3 className="text-sm font-semibold text-slate-800">Ontology Structure</h3>
          <p className="text-[10px] text-slate-500 mt-0.5">L0 Root · L1 Domain · L2 Function · L3 Template</p>
        </div>
        <div className="flex items-center gap-3 text-[10px] text-slate-500">
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-slate-700" /> Root</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-white border-2 border-slate-300" /> Domain</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-white border-2 border-slate-300" /> Function</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-indigo-50 border-2 border-indigo-500" /> 매칭 기능</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-blue-300 border-2 border-blue-400" /> Template</span>
        </div>
      </div>
      <div className="relative" style={{ height: height - 52 }}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeClick={onNodeClick}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{ padding: 0.25 }}
          minZoom={0.25}
          maxZoom={1.5}
          defaultViewport={{ x: 0, y: 0, zoom: 0.85 }}
          nodesDraggable
          nodesConnectable={false}
          elementsSelectable
          proOptions={{ hideAttribution: true }}
        >
          <Controls className="!bottom-3 !top-auto !bg-white/90 !rounded-lg !border !border-slate-200 !shadow" showInteractive={false} />
          <Background gap={20} size={1} color="#cbd5e1" />
        </ReactFlow>
      </div>
    </div>
  );
};

export default OntologyGraph;
