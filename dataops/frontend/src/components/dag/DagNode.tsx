import React, { useRef, useState } from 'react';
import { Database, Filter, Zap, Shield, GitFork, Download, Plus } from 'lucide-react';
import type { DagNode as DagNodeType, DagNodeType as NodeType } from '../../types/dag';

export const NODE_WIDTH = 160;
export const NODE_HEIGHT = 72;

const NODE_META: Record<NodeType, { icon: React.ElementType; border: string; iconColor: string; label: string }> = {
  source:    { icon: Database, border: 'border-blue-400/40',   iconColor: 'text-blue-400',   label: 'Source' },
  filter:    { icon: Filter,   border: 'border-yellow-400/40', iconColor: 'text-yellow-400', label: 'Filter' },
  transform: { icon: Zap,      border: 'border-accent/40',     iconColor: 'text-accent',     label: 'Transform' },
  validate:  { icon: Shield,   border: 'border-green-400/40',  iconColor: 'text-green-400',  label: 'Validate' },
  branch:    { icon: GitFork,  border: 'border-purple-400/40', iconColor: 'text-purple-400', label: 'Branch' },
  sink:      { icon: Download, border: 'border-orange-400/40', iconColor: 'text-orange-400', label: 'Sink' },
};

interface DagNodeProps {
  node: DagNodeType;
  isSelected: boolean;
  isEditMode: boolean;
  onSelect: (id: string) => void;
  onMove: (id: string, x: number, y: number) => void;
  onPortDragStart: (nodeId: string, x: number, y: number) => void;
  onPortDrop: (nodeId: string) => void;
  onQuickAddNode: (nodeId: string, type: NodeType) => void;
  zoom: number;
  pan: { x: number; y: number };
}

export const DagNode: React.FC<DagNodeProps> = ({
  node,
  isSelected,
  isEditMode,
  onSelect,
  onMove,
  onPortDragStart,
  onPortDrop,
  onQuickAddNode,
  zoom,
  pan,
}) => {
  const meta = NODE_META[node.type];
  const Icon = meta.icon;
  const dragOffset = useRef<{ ox: number; oy: number } | null>(null);
  const [isHovered, setHovered] = useState(false);
  const [isQuickMenuOpen, setQuickMenuOpen] = useState(false);

  const handlePointerDown = (e: React.PointerEvent) => {
    if (!isEditMode) return;
    const target = e.target as HTMLElement;
    // 퀵 추가(+) UI를 클릭할 때는 노드 드래그를 시작하지 않는다.
    if (target.closest('[data-dag-quick-add="true"]')) return;
    e.stopPropagation();
    const container = e.currentTarget as HTMLElement;
    container.setPointerCapture(e.pointerId);
    const canvasX = (e.clientX - pan.x) / zoom;
    const canvasY = (e.clientY - pan.y) / zoom;
    dragOffset.current = { ox: canvasX - node.position.x, oy: canvasY - node.position.y };
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isEditMode || !dragOffset.current) return;
    e.stopPropagation();
    const canvasX = (e.clientX - pan.x) / zoom;
    const canvasY = (e.clientY - pan.y) / zoom;
    onMove(node.id, canvasX - dragOffset.current.ox, canvasY - dragOffset.current.oy);
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (!dragOffset.current) return;
    dragOffset.current = null;
    (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
  };

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSelect(node.id);
  };

  // Port (output) drag start
  const handleOutputPortPointerDown = (e: React.PointerEvent) => {
    e.stopPropagation();
    const portX = node.position.x + NODE_WIDTH;
    const portY = node.position.y + NODE_HEIGHT / 2;
    onPortDragStart(node.id, portX, portY);
  };

  // Port (input) drop
  const handleInputPortPointerUp = (e: React.PointerEvent) => {
    e.stopPropagation();
    onPortDrop(node.id);
  };

  const quickAddTypes: NodeType[] = ['filter', 'transform', 'sink'];

  return (
    <foreignObject
      x={node.position.x}
      y={node.position.y}
      width={NODE_WIDTH}
      height={NODE_HEIGHT}
      style={{ overflow: 'visible' }}
    >
      <div
        style={{ width: NODE_WIDTH, height: NODE_HEIGHT, position: 'relative' }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onClick={handleClick}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        {/* Input port */}
        {isEditMode && (
          <div
            style={{
              position: 'absolute',
              left: -7,
              top: '50%',
              transform: 'translateY(-50%)',
              width: 14,
              height: 14,
              borderRadius: '50%',
              background: 'var(--color-primary-container)',
              border: '2px solid var(--color-accent)',
              cursor: 'crosshair',
              zIndex: 10,
            }}
            onPointerUp={handleInputPortPointerUp}
          />
        )}

        {/* Node card */}
        <div
          className={`
            w-full h-full rounded-xl border bg-primary-container px-3 py-2
            flex items-center gap-2 select-none transition-shadow
            ${meta.border}
            ${isSelected ? 'ring-2 ring-accent/60 shadow-lg shadow-accent/10' : ''}
            ${isEditMode ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer hover:brightness-110'}
          `}
        >
          <div className={`shrink-0 ${meta.iconColor}`}>
            <Icon className="w-4 h-4" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[11px] font-semibold text-text-bright truncate leading-tight">{node.label}</div>
            {node.subLabel && (
              <div className="text-[10px] text-surface-muted truncate leading-tight mt-0.5">{node.subLabel}</div>
            )}
          </div>
        </div>

        {/* Output port */}
        {isEditMode && (
          <div
            style={{
              position: 'absolute',
              right: -7,
              top: '50%',
              transform: 'translateY(-50%)',
              width: 14,
              height: 14,
              borderRadius: '50%',
              background: 'var(--color-accent)',
              border: '2px solid var(--color-primary)',
              cursor: 'crosshair',
              zIndex: 10,
            }}
            onPointerDown={handleOutputPortPointerDown}
          />
        )}

        {isEditMode && (isHovered || isQuickMenuOpen) && (
          <div
            data-dag-quick-add="true"
            style={{ position: 'absolute', right: -18, top: -8, zIndex: 20 }}
            onMouseEnter={() => setHovered(true)}
          >
            <button
              type="button"
              onPointerDown={e => e.stopPropagation()}
              onClick={e => {
                e.stopPropagation();
                setQuickMenuOpen(open => !open);
              }}
              className="flex h-7 w-7 items-center justify-center rounded-full border border-accent/40 bg-primary-container text-accent shadow-md hover:bg-primary"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
            {isQuickMenuOpen && (
              <div
                data-dag-quick-add="true"
                className="absolute right-0 top-9 min-w-32 rounded-lg border border-white/10 bg-primary-container p-1 shadow-xl"
              >
                {quickAddTypes.map(type => (
                  <button
                    key={type}
                    type="button"
                    onPointerDown={e => e.stopPropagation()}
                    onClick={e => {
                      e.stopPropagation();
                      onQuickAddNode(node.id, type);
                      setQuickMenuOpen(false);
                    }}
                    className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-[11px] text-text-dim hover:bg-white/5 hover:text-text-bright"
                  >
                    <span>{NODE_META[type].label}</span>
                    <Plus className="h-3 w-3 opacity-60" />
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </foreignObject>
  );
};
