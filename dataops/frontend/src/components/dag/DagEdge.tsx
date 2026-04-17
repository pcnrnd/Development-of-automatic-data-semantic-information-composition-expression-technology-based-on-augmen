import React from 'react';
import type { DagEdge as DagEdgeType, DagNode } from '../../types/dag';

const NODE_WIDTH = 160;
const NODE_HEIGHT = 72;

function getHandles(node: DagNode) {
  return {
    out: { x: node.position.x + NODE_WIDTH, y: node.position.y + NODE_HEIGHT / 2 },
    in: { x: node.position.x, y: node.position.y + NODE_HEIGHT / 2 },
  };
}

interface DagEdgeProps {
  edge: DagEdgeType;
  sourceNode: DagNode;
  targetNode: DagNode;
  isRunning?: boolean;
  isEditMode?: boolean;
  onDelete?: (edgeId: string) => void;
}

export const DagEdge: React.FC<DagEdgeProps> = ({
  edge,
  sourceNode,
  targetNode,
  isRunning = false,
  isEditMode = false,
  onDelete,
}) => {
  const src = getHandles(sourceNode).out;
  const tgt = getHandles(targetNode).in;

  const dx = Math.max(50, Math.abs(tgt.x - src.x) * 0.5);
  const d = `M ${src.x} ${src.y} C ${src.x + dx} ${src.y}, ${tgt.x - dx} ${tgt.y}, ${tgt.x} ${tgt.y}`;

  const midX = (src.x + tgt.x) / 2;
  const midY = (src.y + tgt.y) / 2;

  return (
    <g>
      {/* Visible path */}
      <path
        d={d}
        fill="none"
        stroke="var(--color-accent)"
        strokeOpacity={0.5}
        strokeWidth={1.5}
        markerEnd="url(#dag-arrow)"
        className={isRunning ? 'dag-edge-animated' : ''}
      />
      {/* Invisible hit area for delete */}
      {isEditMode && (
        <path
          d={d}
          fill="none"
          stroke="transparent"
          strokeWidth={12}
          style={{ cursor: 'pointer' }}
          onClick={() => onDelete?.(edge.id)}
        />
      )}
      {/* Edge label */}
      {edge.label && (
        <text
          x={midX}
          y={midY - 6}
          textAnchor="middle"
          fontSize={10}
          fill="var(--color-surface-muted)"
          className="select-none"
        >
          {edge.label}
        </text>
      )}
    </g>
  );
};

// Temporary drawing edge while creating a new connection
interface DrawingEdgeProps {
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
}

export const DrawingEdge: React.FC<DrawingEdgeProps> = ({ startX, startY, currentX, currentY }) => {
  const dx = Math.max(50, Math.abs(currentX - startX) * 0.5);
  const d = `M ${startX} ${startY} C ${startX + dx} ${startY}, ${currentX - dx} ${currentY}, ${currentX} ${currentY}`;
  return (
    <path
      d={d}
      fill="none"
      stroke="var(--color-accent)"
      strokeOpacity={0.7}
      strokeWidth={1.5}
      strokeDasharray="6 3"
      markerEnd="url(#dag-arrow)"
      style={{ pointerEvents: 'none' }}
    />
  );
};
