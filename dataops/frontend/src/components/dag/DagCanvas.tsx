import React, { useCallback, useEffect, useRef, useState } from 'react';
import type { DagNode as DagNodeType, DagEdge as DagEdgeType, DagNodeType as NodeType } from '../../types/dag';
import { DagNode, NODE_WIDTH, NODE_HEIGHT } from './DagNode';
import { DagEdge, DrawingEdge } from './DagEdge';

interface DrawingEdgeState {
  sourceId: string;
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
}

interface DagCanvasProps {
  nodes: DagNodeType[];
  edges: DagEdgeType[];
  isEditMode: boolean;
  isRunning: boolean;
  selectedNodeId: string | null;
  onSelectNode: (id: string | null) => void;
  onMoveNode: (id: string, x: number, y: number) => void;
  onAddEdge: (sourceId: string, targetId: string) => void;
  onDeleteEdge: (edgeId: string) => void;
  onAddNode: (type: NodeType, x: number, y: number) => void;
  onQuickAddNode: (sourceNodeId: string, type: NodeType) => void;
}

export const DagCanvas: React.FC<DagCanvasProps> = ({
  nodes,
  edges,
  isEditMode,
  isRunning,
  selectedNodeId,
  onSelectNode,
  onMoveNode,
  onAddEdge,
  onDeleteEdge,
  onAddNode,
  onQuickAddNode,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [pan, setPan] = useState({ x: 40, y: 40 });
  const [zoom, setZoom] = useState(1);
  const isPanning = useRef(false);
  const panStart = useRef({ mx: 0, my: 0, px: 0, py: 0 });
  const [drawingEdge, setDrawingEdge] = useState<DrawingEdgeState | null>(null);

  // Pan handlers
  const handleCanvasPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    isPanning.current = true;
    panStart.current = { mx: e.clientX, my: e.clientY, px: pan.x, py: pan.y };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }, [pan]);

  const handleCanvasPointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (drawingEdge) {
      setDrawingEdge(prev => prev ? { ...prev, currentX: (e.clientX - pan.x) / zoom, currentY: (e.clientY - pan.y) / zoom } : null);
      return;
    }
    if (!isPanning.current) return;
    const dx = e.clientX - panStart.current.mx;
    const dy = e.clientY - panStart.current.my;
    setPan({ x: panStart.current.px + dx, y: panStart.current.py + dy });
  }, [drawingEdge, pan, zoom]);

  const handleCanvasPointerUp = useCallback(() => {
    isPanning.current = false;
    if (drawingEdge) {
      setDrawingEdge(null);
    }
  }, [drawingEdge]);

  const applyZoomAtCursor = useCallback((clientX: number, clientY: number, deltaY: number) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const cursorX = clientX - rect.left;
    const cursorY = clientY - rect.top;
    // Trackpad/mouse wheel 모두에서 과도한 줌 변화를 막기 위해 완만한 지수 스케일을 사용한다.
    const zoomFactor = Math.exp(-deltaY * 0.0008);
    setZoom(prev => {
      const next = Math.min(1.8, Math.max(0.4, prev * zoomFactor));
      setPan(p => ({
        x: cursorX - (cursorX - p.x) * (next / prev),
        y: cursorY - (cursorY - p.y) * (next / prev),
      }));
      return next;
    });
  }, []);

  // Zoom (React synthetic event fallback)
  const handleWheel = useCallback((e: React.WheelEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    applyZoomAtCursor(e.clientX, e.clientY, e.deltaY);
  }, [applyZoomAtCursor]);

  // Native wheel capture: 상위 스크롤 영역으로 이벤트가 새지 않도록 강제 차단
  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;
    const onNativeWheel = (event: WheelEvent) => {
      event.preventDefault();
      event.stopPropagation();
      applyZoomAtCursor(event.clientX, event.clientY, event.deltaY);
    };
    element.addEventListener('wheel', onNativeWheel, { passive: false, capture: true });
    return () => {
      element.removeEventListener('wheel', onNativeWheel, true);
    };
  }, [applyZoomAtCursor]);

  // Node interaction
  const handlePortDragStart = useCallback((nodeId: string, x: number, y: number) => {
    setDrawingEdge({ sourceId: nodeId, startX: x, startY: y, currentX: x, currentY: y });
  }, []);

  const handlePortDrop = useCallback((targetId: string) => {
    if (drawingEdge && drawingEdge.sourceId !== targetId) {
      onAddEdge(drawingEdge.sourceId, targetId);
    }
    setDrawingEdge(null);
  }, [drawingEdge, onAddEdge]);

  // Drag-and-drop from palette
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    isPanning.current = false;
    const nodeType = e.dataTransfer.getData('dag-node-type') as NodeType;
    if (!nodeType) return;
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const canvasX = (e.clientX - rect.left - pan.x) / zoom;
    const canvasY = (e.clientY - rect.top - pan.y) / zoom;
    onAddNode(nodeType, canvasX - NODE_WIDTH / 2, canvasY - NODE_HEIGHT / 2);
  };

  const nodeMap = Object.fromEntries(nodes.map(n => [n.id, n]));

  // Canvas size for SVG (large enough for all nodes)
  const maxX = nodes.reduce((m, n) => Math.max(m, n.position.x + NODE_WIDTH + 100), 1200);
  const maxY = nodes.reduce((m, n) => Math.max(m, n.position.y + NODE_HEIGHT + 100), 600);

  return (
    <div
      ref={containerRef}
      className="w-full h-full overflow-hidden dag-canvas-bg rounded-xl border border-white/10 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.04)] relative"
      style={{ cursor: isPanning.current ? 'grabbing' : 'grab', overscrollBehavior: 'contain' }}
      onPointerDown={handleCanvasPointerDown}
      onPointerMove={handleCanvasPointerMove}
      onPointerUp={handleCanvasPointerUp}
      onWheel={handleWheel}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      onClick={() => onSelectNode(null)}
    >
      {/* Zoom indicator */}
      <div className="absolute bottom-3 right-3 z-10 text-[10px] text-surface-muted bg-primary-container/80 px-2 py-1 rounded-md border border-white/5 select-none">
        {Math.round(zoom * 100)}%
      </div>

      <div
        style={{
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          transformOrigin: '0 0',
          willChange: 'transform',
        }}
      >
        <svg
          width={maxX}
          height={maxY}
          style={{ overflow: 'visible', position: 'absolute', top: 0, left: 0, pointerEvents: 'none' }}
        >
          <defs>
            <marker
              id="dag-arrow"
              markerWidth="8"
              markerHeight="8"
              refX="7"
              refY="3"
              orient="auto"
            >
              <path d="M0,0 L0,6 L8,3 z" fill="var(--color-accent)" fillOpacity={0.7} />
            </marker>
          </defs>

          {/* Edges */}
          <g style={{ pointerEvents: isEditMode ? 'all' : 'none' }}>
            {edges.map(edge => {
              const src = nodeMap[edge.source];
              const tgt = nodeMap[edge.target];
              if (!src || !tgt) return null;
              return (
                <DagEdge
                  key={edge.id}
                  edge={edge}
                  sourceNode={src}
                  targetNode={tgt}
                  isRunning={isRunning}
                  isEditMode={isEditMode}
                  onDelete={onDeleteEdge}
                />
              );
            })}

            {/* Drawing edge preview */}
            {drawingEdge && (
              <DrawingEdge
                startX={drawingEdge.startX}
                startY={drawingEdge.startY}
                currentX={drawingEdge.currentX}
                currentY={drawingEdge.currentY}
              />
            )}
          </g>
        </svg>

        {/* Nodes (rendered on top of SVG via absolute positioning sibling) */}
        <div style={{ position: 'relative', width: maxX, height: maxY }}>
          <svg
            width={maxX}
            height={maxY}
            style={{ position: 'absolute', top: 0, left: 0 }}
            onClick={e => e.stopPropagation()}
          >
            <defs>
              <marker
                id="dag-arrow-nodes"
                markerWidth="8"
                markerHeight="8"
                refX="7"
                refY="3"
                orient="auto"
              >
                <path d="M0,0 L0,6 L8,3 z" fill="var(--color-accent)" fillOpacity={0.7} />
              </marker>
            </defs>
            {nodes.map(node => (
              <DagNode
                key={node.id}
                node={node}
                isSelected={selectedNodeId === node.id}
                isEditMode={isEditMode}
                onSelect={onSelectNode}
                onMove={onMoveNode}
                onPortDragStart={handlePortDragStart}
                onPortDrop={handlePortDrop}
                onQuickAddNode={onQuickAddNode}
                zoom={zoom}
                pan={pan}
              />
            ))}
          </svg>
        </div>
      </div>
    </div>
  );
};
