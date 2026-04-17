export type DagNodeType = 'source' | 'filter' | 'transform' | 'validate' | 'branch' | 'sink';

export interface DagNode {
  id: string;
  type: DagNodeType;
  label: string;
  subLabel?: string;
  position: { x: number; y: number };
  config?: Record<string, string>;
}

export interface DagEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
}

export interface PipelineDag {
  pipelineId: string;
  nodes: DagNode[];
  edges: DagEdge[];
  updatedAt: string;
}
