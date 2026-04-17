import React from 'react';
import { Database, Filter, Zap, Download } from 'lucide-react';
import type { DagNodeType } from '../../types/dag';

const PALETTE_ITEMS: { type: DagNodeType; label: string; icon: React.ElementType; colorClass: string }[] = [
  { type: 'source',    label: 'Source',    icon: Database, colorClass: 'text-blue-400 border-blue-400/30' },
  { type: 'filter',    label: 'Filter',    icon: Filter,   colorClass: 'text-yellow-400 border-yellow-400/30' },
  { type: 'transform', label: 'Transform', icon: Zap,      colorClass: 'text-accent border-accent/30' },
  { type: 'sink',      label: 'Sink',      icon: Download, colorClass: 'text-orange-400 border-orange-400/30' },
];

interface DagNodePaletteProps {
  onAddNode: (type: DagNodeType) => void;
}

export const DagNodePalette: React.FC<DagNodePaletteProps> = ({ onAddNode }) => {
  const handleDragStart = (e: React.DragEvent, type: DagNodeType) => {
    e.dataTransfer.setData('dag-node-type', type);
    e.dataTransfer.effectAllowed = 'copy';
  };

  return (
    <div className="mt-4">
      <div className="text-[10px] font-semibold text-surface-muted uppercase tracking-widest mb-2 px-1">
        노드 추가
      </div>
      <div className="space-y-1.5">
        {PALETTE_ITEMS.map(item => {
          const Icon = item.icon;
          return (
            <button
              key={item.type}
              type="button"
              draggable
              onDragStart={e => handleDragStart(e, item.type)}
              onClick={() => onAddNode(item.type)}
              className={`
                w-full flex items-center gap-2 px-3 py-2 rounded-lg border bg-primary-container text-left
                cursor-grab active:cursor-grabbing select-none transition-opacity hover:opacity-80
                ${item.colorClass}
              `}
            >
              <Icon className="w-3.5 h-3.5 shrink-0" />
              <span className="text-xs font-medium text-text-dim">{item.label}</span>
            </button>
          );
        })}
      </div>
      <p className="text-[10px] text-surface-muted mt-3 leading-relaxed">
        클릭하거나 캔버스로 드래그하여 노드를 추가합니다.
      </p>
    </div>
  );
};
