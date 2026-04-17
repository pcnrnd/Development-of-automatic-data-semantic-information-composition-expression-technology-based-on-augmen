import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Trash2, Database, Filter, Zap, Shield, GitFork, Download } from 'lucide-react';
import { FormInput } from '../ui/FormInput';
import type { DagNode, DagNodeType } from '../../types/dag';

const TYPE_META: Record<DagNodeType, { label: string; icon: React.ElementType; colorClass: string }> = {
  source:    { label: 'Source',    icon: Database, colorClass: 'text-blue-400' },
  filter:    { label: 'Filter',    icon: Filter,   colorClass: 'text-yellow-400' },
  transform: { label: 'Transform', icon: Zap,      colorClass: 'text-accent' },
  validate:  { label: 'Validate',  icon: Shield,   colorClass: 'text-green-400' },
  branch:    { label: 'Branch',    icon: GitFork,  colorClass: 'text-purple-400' },
  sink:      { label: 'Sink',      icon: Download, colorClass: 'text-orange-400' },
};

const CONFIG_FIELDS: Partial<Record<DagNodeType, { key: string; label: string; placeholder: string }[]>> = {
  source: [
    { key: 'host', label: 'Host', placeholder: 'db-host.local' },
    { key: 'port', label: 'Port', placeholder: '5432' },
    { key: 'table', label: 'Table / Path', placeholder: 'schema.table_name' },
  ],
  filter: [
    { key: 'rule', label: '필터 조건', placeholder: 'VoltR > 220' },
    { key: 'action', label: '매칭 시 처리', placeholder: 'drop | forward' },
  ],
  transform: [
    { key: 'outputFormat', label: '출력 포맷', placeholder: 'parquet | json | csv' },
  ],
  validate: [
    { key: 'schemaRef', label: '스키마 파일', placeholder: 'schema_v2.json' },
    { key: 'failAction', label: '실패 시 처리', placeholder: 'discard | quarantine' },
    { key: 'deduplicateWindow', label: '중복 제거 윈도우', placeholder: '60s' },
  ],
  branch: [
    { key: 'criticalThreshold', label: 'Critical 임계값', placeholder: '100' },
    { key: 'normalThreshold', label: 'Normal 임계값', placeholder: '30' },
  ],
  sink: [
    { key: 'host', label: 'Host / Bucket', placeholder: 'db-host.local or s3://bucket' },
    { key: 'path', label: 'Path / Table', placeholder: '/data/output or schema.table' },
    { key: 'format', label: '저장 포맷', placeholder: 'parquet | json | csv' },
  ],
};

interface DagNodeConfigPanelProps {
  node: DagNode | null;
  isEditMode: boolean;
  onClose: () => void;
  onUpdateLabel: (id: string, label: string) => void;
  onUpdateSubLabel: (id: string, subLabel: string) => void;
  onUpdateConfig: (id: string, key: string, value: string) => void;
  onDeleteNode: (id: string) => void;
}

export const DagNodeConfigPanel: React.FC<DagNodeConfigPanelProps> = ({
  node,
  isEditMode,
  onClose,
  onUpdateLabel,
  onUpdateSubLabel,
  onUpdateConfig,
  onDeleteNode,
}) => {
  return (
    <AnimatePresence>
      {node && (
        <motion.div
          key={node.id}
          initial={{ x: 20, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: 20, opacity: 0 }}
          transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
          className="w-72 shrink-0 flex flex-col bg-primary-container border border-white/5 rounded-xl overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
            {(() => {
              const meta = TYPE_META[node.type];
              const Icon = meta.icon;
              return (
                <div className="flex items-center gap-2">
                  <Icon className={`w-4 h-4 ${meta.colorClass}`} />
                  <span className="text-xs font-semibold text-text-bright">{meta.label} 노드</span>
                </div>
              );
            })()}
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-surface-muted hover:text-text-bright hover:bg-white/5 transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Fields */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
            {/* Label */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-semibold text-surface-muted uppercase tracking-widest">이름</label>
              {isEditMode ? (
                <FormInput
                  value={node.label}
                  onChange={e => onUpdateLabel(node.id, e.target.value)}
                  className="w-full"
                />
              ) : (
                <p className="text-xs text-text-bright">{node.label}</p>
              )}
            </div>

            {/* SubLabel */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-semibold text-surface-muted uppercase tracking-widest">설명</label>
              {isEditMode ? (
                <FormInput
                  value={node.subLabel ?? ''}
                  onChange={e => onUpdateSubLabel(node.id, e.target.value)}
                  placeholder="간단한 설명..."
                  className="w-full"
                />
              ) : (
                <p className="text-xs text-text-dim">{node.subLabel ?? '—'}</p>
              )}
            </div>

            {/* Type-specific config */}
            {CONFIG_FIELDS[node.type]?.map(field => (
              <div key={field.key} className="space-y-1.5">
                <label className="text-[10px] font-semibold text-surface-muted uppercase tracking-widest">
                  {field.label}
                </label>
                {isEditMode ? (
                  <FormInput
                    value={node.config?.[field.key] ?? ''}
                    onChange={e => onUpdateConfig(node.id, field.key, e.target.value)}
                    placeholder={field.placeholder}
                    className="w-full"
                  />
                ) : (
                  <p className="text-xs text-text-dim font-mono">
                    {node.config?.[field.key] || <span className="text-surface-muted">—</span>}
                  </p>
                )}
              </div>
            ))}

          </div>

          {/* Delete */}
          {isEditMode && (
            <div className="p-4 border-t border-white/5">
              <button
                onClick={() => onDeleteNode(node.id)}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg
                  text-xs font-medium text-red-400 border border-red-400/20
                  hover:bg-red-400/10 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                노드 삭제
              </button>
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
};
