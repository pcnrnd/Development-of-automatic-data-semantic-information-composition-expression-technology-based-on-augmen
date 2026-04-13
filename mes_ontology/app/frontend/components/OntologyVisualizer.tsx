import React, { useState, useMemo } from 'react';
import { MES_ONTOLOGY, ONTOLOGY_SECTION_DESCRIPTION_KO } from '../constants';
import { stripLatinAcronymParentheses } from '../utils/displayLabels';
import { MESFunction, ResultTemplate, OntologySelectedNode } from '../types';
import OntologyGraph from './OntologyGraph';
import { OntologyGraphHelpTip } from './OntologyGraphHelpTip';
import OntologyNodeDetailPanel, { ResultSummaryForPanel } from './OntologyNodeDetailPanel';
export type { ResultSummaryForPanel };
import {
  Network,
  Database,
  ShieldCheck,
  Settings,
  Package,
  Activity,
  Info,
  ChevronDown,
  ChevronRight,
  GitBranch,
  List,
} from 'lucide-react';

/** 카테고리별 아이콘 */
const CategoryIcon = ({ category, className }: { category: string; className?: string }) => {
  switch (category) {
    case 'Tracking': return <Network className={className || 'w-5 h-5 text-blue-500'} />;
    case 'Quality': return <ShieldCheck className={className || 'w-5 h-5 text-emerald-500'} />;
    case 'Maintenance': return <Settings className={className || 'w-5 h-5 text-amber-500'} />;
    case 'Inventory': return <Package className={className || 'w-5 h-5 text-indigo-500'} />;
    case 'Production': return <Activity className={className || 'w-5 h-5 text-rose-500'} />;
    default: return <Database className={className || 'w-5 h-5 text-slate-500'} />;
  }
};

const CATEGORY_ORDER = ['Tracking', 'Quality', 'Maintenance', 'Inventory', 'Production'] as const;

/** 리스트·패널용 카테고리 한글명 (내부 키는 영문 유지) */
const CATEGORY_LABEL_KO: Record<string, string> = {
  Tracking: '추적',
  Quality: '품질',
  Maintenance: '보전',
  Inventory: '재고',
  Production: '생산',
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

interface OntologyVisualizerProps {
  embedded?: boolean;
  /** 분석 결과로 매칭된 기능 ID 목록. 리스트/그래프에서 해당 항목을 강조 표시합니다. */
  highlightedFunctionIds?: string[];
  /** L3 결과 템플릿 목록. 그래프 뷰에서 템플릿 노드 및 Template→L2 엣지를 표시합니다. */
  templates?: ResultTemplate[];
  /** L3 템플릿 클릭 시 패널에 표시할 결과 요약 (선택) */
  resultSummary?: ResultSummaryForPanel;
}

const OntologyVisualizer: React.FC<OntologyVisualizerProps> = ({ embedded = false, highlightedFunctionIds, templates, resultSummary }) => {
  const [selectedNode, setSelectedNode] = useState<OntologySelectedNode | null>(null);
  const [viewMode, setViewMode] = useState<'graph' | 'list'>('graph');
  const [expanded, setExpanded] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    CATEGORY_ORDER.forEach((c) => { init[c] = true; });
    return init;
  });

  const ontologyByCategory = useMemo(() => groupByCategory(MES_ONTOLOGY), []);
  const toggleCategory = (category: string) => setExpanded((prev) => ({ ...prev, [category]: !prev[category] }));

  return (
    <div className={embedded ? 'p-4 sm:p-5 md:p-6' : 'bg-white p-4 sm:p-6 rounded-xl border border-slate-200 shadow-sm min-w-0'}>
      {!embedded && (
        <>
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <Database className="w-6 h-6 text-indigo-600 shrink-0" />
            <h2 className="text-lg sm:text-xl font-bold text-slate-800">표준 MES 온톨로지</h2>
            <OntologyGraphHelpTip />
          </div>
          <p className="text-sm text-slate-500 mb-4 leading-relaxed">
            {ONTOLOGY_SECTION_DESCRIPTION_KO}
          </p>
          <div className="flex gap-1 p-1 rounded-lg bg-slate-100 w-full sm:w-fit max-w-full mb-4">
            <button
              type="button"
              onClick={() => setViewMode('graph')}
              className={`flex flex-1 sm:flex-initial justify-center items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors min-h-[44px] sm:min-h-0 ${
                viewMode === 'graph' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-600 hover:text-slate-800'
              }`}
            >
              <GitBranch className="w-4 h-4 shrink-0" />
              그래프
            </button>
            <button
              type="button"
              onClick={() => setViewMode('list')}
              className={`flex flex-1 sm:flex-initial justify-center items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors min-h-[44px] sm:min-h-0 ${
                viewMode === 'list' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-600 hover:text-slate-800'
              }`}
            >
              <List className="w-4 h-4 shrink-0" />
              목록
            </button>
          </div>
        </>
      )}
      {embedded && (
        <div className="flex items-start gap-2 mb-4">
          <p className="text-sm text-slate-500 leading-relaxed flex-1 min-w-0">{ONTOLOGY_SECTION_DESCRIPTION_KO}</p>
          <OntologyGraphHelpTip className="mt-0.5" />
        </div>
      )}

      {viewMode === 'graph' && (
        <OntologyGraph
          onSelectNode={setSelectedNode}
          onSelectFunction={(fn) => setSelectedNode({ type: 'function', data: { fn } })}
          compact={embedded}
          highlightedIds={highlightedFunctionIds}
          templates={templates}
        />
      )}

      {viewMode === 'list' && (
        <div className="space-y-1">
          {CATEGORY_ORDER.map((category) => {
            const functions = ontologyByCategory.get(category) ?? [];
            if (functions.length === 0) return null;
            const isOpen = expanded[category] ?? true;
            return (
              <div key={category} className="rounded-lg border border-slate-200 overflow-hidden">
                <button
                  type="button"
                  onClick={() => toggleCategory(category)}
                  className="w-full flex items-center gap-3 px-4 py-3 bg-slate-50 hover:bg-slate-100 border-b border-slate-100 text-left transition-colors"
                  aria-expanded={isOpen}
                >
                  <span className="text-slate-400">{isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}</span>
                  <CategoryIcon category={category} className="w-5 h-5 shrink-0" />
                  <span className="font-bold text-slate-800 tracking-wide text-sm">{CATEGORY_LABEL_KO[category] ?? category}</span>
                  <span className="text-xs px-2 py-0.5 bg-slate-200 text-slate-600 rounded-full font-medium">
                    기능 {functions.length}개
                  </span>
                </button>
                {isOpen && (
                  <div className="bg-white">
                    {functions.map((fn) => (
                      <div key={fn.id} className="relative flex border-t border-slate-50 first:border-t-0">
                        <div className="absolute left-4 top-0 bottom-0 w-px bg-slate-200" style={{ marginLeft: '0.625rem' }} aria-hidden />
                        <div className="absolute left-4 top-[1.125rem] w-3 h-px bg-slate-200" style={{ marginLeft: '0.625rem' }} aria-hidden />
                        <button
                          type="button"
                          onClick={() => setSelectedNode({ type: 'function', data: { fn } })}
                          className={`flex-1 text-left pl-10 pr-4 py-3 hover:bg-slate-50/80 transition-colors group min-w-0 ${
                            highlightedFunctionIds?.includes(fn.id) ? 'bg-indigo-50/80 border-l-2 border-l-indigo-400' : ''
                          }`}
                        >
                          <div className="flex items-center gap-2 flex-wrap">
                            {highlightedFunctionIds?.includes(fn.id) && (
                              <span className="text-[10px] font-bold text-indigo-600 bg-indigo-100 px-1.5 py-0.5 rounded">매칭</span>
                            )}
                            <span className="font-mono text-xs text-slate-400 group-hover:text-indigo-600">{fn.id}</span>
                            <span className="font-semibold text-slate-800 group-hover:text-indigo-600 text-sm">
                              {stripLatinAcronymParentheses(fn.nameKo ?? fn.name)}
                            </span>
                            <span className="text-xs px-2 py-0.5 bg-slate-100 rounded font-medium text-slate-500">{fn.standard}</span>
                          </div>
                          <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">{fn.descriptionKo ?? fn.description}</p>
                          <span className="inline-flex items-center gap-1 mt-1 text-xs text-indigo-500 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Info className="w-3 h-3" /> 상세 보기
                          </span>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* 오른쪽 메타정보 패널 (계층별) */}
      <OntologyNodeDetailPanel
        selectedNode={selectedNode}
        onClose={() => setSelectedNode(null)}
        resultSummary={resultSummary}
      />
    </div>
  );
};

export default OntologyVisualizer;
