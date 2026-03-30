import React, { useState, useMemo } from 'react';
import { MES_ONTOLOGY, ONTOLOGY_SECTION_DESCRIPTION_KO } from '../constants';
import { MESFunction, ResultTemplate, OntologySelectedNode } from '../types';
import OntologyGraph from './OntologyGraph';
import {
  Network,
  Database,
  ShieldCheck,
  Settings,
  Package,
  Activity,
  X,
  Info,
  CheckCircle,
  ChevronDown,
  ChevronRight,
  GitBranch,
  List,
  LayoutTemplate,
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

function groupByCategory(ontology: MESFunction[]): Map<string, MESFunction[]> {
  const map = new Map<string, MESFunction[]>();
  for (const fn of ontology) {
    const list = map.get(fn.category) ?? [];
    list.push(fn);
    map.set(fn.category, list);
  }
  return map;
}

/** L3 패널용 결과 탭 요약 (선택). analysisResult.summary 등 */
export interface ResultSummaryForPanel {
  summary: string;
  topMatchName?: string;
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
    <div className={embedded ? 'p-5 sm:p-6' : 'bg-white p-6 rounded-xl border border-slate-200 shadow-sm'}>
      {!embedded && (
        <>
          <div className="flex items-center gap-2 mb-2">
            <Database className="w-6 h-6 text-indigo-600" />
            <h2 className="text-xl font-bold text-slate-800">Standard MES Ontology</h2>
          </div>
          <p className="text-sm text-slate-500 mb-4 leading-relaxed">
            {ONTOLOGY_SECTION_DESCRIPTION_KO}
          </p>
          <div className="flex gap-1 p-1 rounded-lg bg-slate-100 w-fit mb-4">
            <button
              type="button"
              onClick={() => setViewMode('graph')}
              className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                viewMode === 'graph' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-600 hover:text-slate-800'
              }`}
            >
              <GitBranch className="w-4 h-4" />
              그래프
            </button>
            <button
              type="button"
              onClick={() => setViewMode('list')}
              className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                viewMode === 'list' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-600 hover:text-slate-800'
              }`}
            >
              <List className="w-4 h-4" />
              목록
            </button>
          </div>
        </>
      )}
      {embedded && (
        <p className="text-sm text-slate-500 mb-4 leading-relaxed">{ONTOLOGY_SECTION_DESCRIPTION_KO}</p>
      )}

      {viewMode === 'graph' && (
        <OntologyGraph
          onSelectNode={setSelectedNode}
          onSelectFunction={(fn) => setSelectedNode({ type: 'function', data: { fn } })}
          height={embedded ? 320 : 420}
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
                  <span className="font-bold text-slate-800 uppercase tracking-wide text-sm">{category}</span>
                  <span className="text-xs px-2 py-0.5 bg-slate-200 text-slate-600 rounded-full font-medium">
                    {functions.length} function{functions.length !== 1 ? 's' : ''}
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
                            <span className="font-semibold text-slate-800 group-hover:text-indigo-600 text-sm">{fn.name}</span>
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
      {selectedNode && (
        <>
          <div
            className="fixed inset-0 z-[90] bg-slate-900/40 transition-opacity"
            aria-hidden
            onClick={() => setSelectedNode(null)}
          />
          <div
            className="fixed right-0 top-0 bottom-0 z-[91] w-full max-w-[100vw] sm:w-[360px] bg-white border-l border-slate-200 shadow-xl flex flex-col transition-transform duration-200 ease-out"
            role="dialog"
            aria-label="노드 메타정보"
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 bg-slate-50 shrink-0">
              <span className="text-sm font-semibold text-slate-800">
                {selectedNode.type === 'root' && 'L0 Root'}
                {selectedNode.type === 'domain' && 'L1 Domain'}
                {selectedNode.type === 'function' && 'L2 Function'}
                {selectedNode.type === 'template' && 'L3 Template'}
              </span>
              <button
                type="button"
                onClick={() => setSelectedNode(null)}
                className="p-2 rounded-lg hover:bg-slate-200 transition-colors"
                aria-label="닫기"
              >
                <X className="w-5 h-5 text-slate-600" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {selectedNode.type === 'root' && (
                <>
                  <div className="flex items-center gap-2">
                    <Database className="w-6 h-6 text-indigo-600" />
                    <h3 className="text-lg font-bold text-slate-800">{selectedNode.data.label}</h3>
                  </div>
                  <p className="text-sm text-slate-600 leading-relaxed">
                    제조 실행 시스템(MES) 표준 온톨로지 루트. ISA-95, ISO 9001, GS1 등 국제 표준을 참고한 계층 구조입니다.
                  </p>
                </>
              )}
              {selectedNode.type === 'domain' && (
                <>
                  <div className="flex items-center gap-2">
                    <CategoryIcon category={selectedNode.data.category} className="w-6 h-6" />
                    <h3 className="text-lg font-bold text-slate-800 uppercase tracking-wide">{selectedNode.data.label}</h3>
                  </div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">소속 기능 (L2)</p>
                  <ul className="space-y-2">
                    {selectedNode.data.functionIds.map((fid) => {
                      const fn = MES_ONTOLOGY.find((o) => o.id === fid);
                      return fn ? (
                        <li key={fid} className="text-sm text-slate-700 flex items-center gap-2">
                          <span className="font-mono text-xs text-slate-400">{fn.id}</span>
                          <span>{fn.name}</span>
                        </li>
                      ) : null;
                    })}
                  </ul>
                </>
              )}
              {selectedNode.type === 'function' && (
                <>
                  <div className="flex items-center gap-2">
                    <CategoryIcon category={selectedNode.data.fn.category} className="w-6 h-6" />
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">{selectedNode.data.fn.category} Module</span>
                  </div>
                  <h3 className="text-lg font-bold text-slate-800">{selectedNode.data.fn.name}</h3>
                  <div className="flex flex-wrap gap-2">
                    <span className="px-3 py-1 bg-indigo-100 text-indigo-700 rounded-md text-xs font-medium">ID: {selectedNode.data.fn.id}</span>
                    <span className="px-3 py-1 bg-slate-100 text-slate-600 rounded-md text-xs font-medium">Standard: {selectedNode.data.fn.standard}</span>
                  </div>
                  <section>
                    <h4 className="text-xs font-semibold uppercase tracking-wider mb-2 flex items-center gap-2 border-b border-slate-200 border-l-4 border-l-indigo-500 pl-2 pb-1.5 text-indigo-700">
                      <Info className="w-3.5 h-3.5 text-indigo-500" /> Description
                    </h4>
                    <p className="text-slate-600 text-sm leading-relaxed">{selectedNode.data.fn.descriptionKo ?? selectedNode.data.fn.description}</p>
                  </section>
                  <section>
                    <h4 className="text-xs font-semibold uppercase tracking-wider mb-2 flex items-center gap-2 border-b border-slate-200 border-l-4 border-l-emerald-500 pl-2 pb-1.5 text-emerald-700">
                      <CheckCircle className="w-3.5 h-3.5 text-emerald-500" /> Implementation Benefits
                    </h4>
                    <ul className="space-y-2 text-sm text-slate-700">
                      <li className="flex items-start gap-3"><span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />가시성 향상 및 공정 병목 감소.</li>
                      <li className="flex items-start gap-3"><span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />국제 규격 {selectedNode.data.fn.standard} 준수.</li>
                      <li className="flex items-start gap-3"><span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />ERP·자동화 계층과 연동 용이.</li>
                    </ul>
                  </section>
                  <p className="text-xs text-slate-400 pt-2 border-t border-slate-100">지식 베이스 기준 최종 반영: 2024년 10월</p>
                </>
              )}
              {selectedNode.type === 'template' && (
                <>
                  <div className="flex items-center gap-2 mb-4">
                    <LayoutTemplate className="w-6 h-6 text-violet-500 shrink-0" />
                    <h3 className="text-lg font-bold text-slate-800">{selectedNode.data.template.name}</h3>
                  </div>
                  {(selectedNode.data.template.summary ?? resultSummary?.summary) && (
                    <section className="mb-4">
                      <h4 className="text-xs font-semibold uppercase tracking-wider pb-1.5 mb-2 border-b border-slate-200 border-l-4 border-l-violet-500 pl-2 text-violet-700">결과 탭 요약</h4>
                      <div className="pt-1">
                        <p className="text-slate-600 text-sm leading-relaxed">
                          {selectedNode.data.template.summary ?? resultSummary?.summary}
                        </p>
                      </div>
                    </section>
                  )}
                  {selectedNode.data.template.dataUsageSummary && (
                    <section className="mb-4">
                      <h4 className="text-xs font-semibold uppercase tracking-wider pb-1.5 mb-2 border-b border-slate-200 border-l-4 border-l-sky-500 pl-2 text-sky-700">데이터 활용 현황</h4>
                      <div className="pt-1 bg-slate-50/70 rounded-md px-3 py-2">
                        <p className="text-slate-600 text-sm leading-relaxed">
                          {selectedNode.data.template.dataUsageSummary}
                        </p>
                      </div>
                    </section>
                  )}
                  <section className="mb-4">
                    <h4 className="text-xs font-semibold uppercase tracking-wider pb-1.5 mb-2 border-b border-slate-200 border-l-4 border-l-slate-500 pl-2 text-slate-700">모델</h4>
                    <div className="pt-1">
                      <p className="text-slate-600 text-sm">{selectedNode.data.template.modelName ?? '-'}</p>
                    </div>
                  </section>
                  {selectedNode.data.template.modelPerformance && (
                    <section className="mb-4">
                      <h4 className="text-xs font-semibold uppercase tracking-wider pb-1.5 mb-2 border-b border-slate-200 border-l-4 border-l-emerald-500 pl-2 text-emerald-700">모델 성능</h4>
                      <div className="pt-1">
                        <dl className="space-y-1.5 text-sm text-slate-600">
                          {selectedNode.data.template.modelPerformance.accuracy != null && (
                            <div className="flex justify-between gap-2"><dt className="text-slate-500">정확도</dt><dd>{(selectedNode.data.template.modelPerformance.accuracy * 100).toFixed(1)}%</dd></div>
                          )}
                          {selectedNode.data.template.modelPerformance.f1Score != null && (
                            <div className="flex justify-between gap-2"><dt className="text-slate-500">F1 스코어</dt><dd>{(selectedNode.data.template.modelPerformance.f1Score * 100).toFixed(1)}%</dd></div>
                          )}
                          {selectedNode.data.template.modelPerformance.precision != null && (
                            <div className="flex justify-between gap-2"><dt className="text-slate-500">정밀도</dt><dd>{(selectedNode.data.template.modelPerformance.precision * 100).toFixed(1)}%</dd></div>
                          )}
                          {selectedNode.data.template.modelPerformance.recall != null && (
                            <div className="flex justify-between gap-2"><dt className="text-slate-500">재현율</dt><dd>{(selectedNode.data.template.modelPerformance.recall * 100).toFixed(1)}%</dd></div>
                          )}
                          {selectedNode.data.template.modelPerformance.rmse != null && (
                            <div className="flex justify-between gap-2"><dt className="text-slate-500">RMSE</dt><dd>{selectedNode.data.template.modelPerformance.rmse}</dd></div>
                          )}
                          {selectedNode.data.template.modelPerformance.trainingTime && (
                            <div className="flex justify-between gap-2"><dt className="text-slate-500">학습 소요 시간</dt><dd>{selectedNode.data.template.modelPerformance.trainingTime}</dd></div>
                          )}
                        </dl>
                      </div>
                    </section>
                  )}
                  {(selectedNode.data.template.preprocessingMethods?.length ?? 0) > 0 && (
                    <section className="mb-4">
                      <h4 className="text-xs font-semibold uppercase tracking-wider pb-1.5 mb-2 border-b border-slate-200 border-l-4 border-l-amber-500 pl-2 text-amber-700">전처리 방법</h4>
                      <div className="pt-1">
                        <ul className="space-y-1">
                          {selectedNode.data.template.preprocessingMethods!.map((method, i) => (
                            <li key={i} className="text-sm text-slate-600">{method}</li>
                          ))}
                        </ul>
                      </div>
                    </section>
                  )}
                  {(selectedNode.data.template.visualizationMethods?.length ?? 0) > 0 && (
                    <section className="mb-4">
                      <h4 className="text-xs font-semibold uppercase tracking-wider pb-1.5 mb-2 border-b border-slate-200 border-l-4 border-l-indigo-500 pl-2 text-indigo-700">시각화 방법</h4>
                      <div className="pt-1">
                        <ul className="space-y-1">
                          {selectedNode.data.template.visualizationMethods!.map((method, i) => (
                            <li key={i} className="text-sm text-slate-600">{method}</li>
                          ))}
                        </ul>
                      </div>
                    </section>
                  )}
                  {resultSummary?.topMatchName && (
                    <section className="mb-4">
                      <h4 className="text-xs font-semibold uppercase tracking-wider pb-1.5 mb-2 border-b border-slate-200 border-l-4 border-l-rose-500 pl-2 text-rose-700">상위 추천 기능</h4>
                      <div className="pt-1">
                        <p className="text-slate-600 text-sm">{resultSummary.topMatchName}</p>
                      </div>
                    </section>
                  )}
                  {selectedNode.data.template.recommendedFunctionIds.length > 0 && (
                    <section className="mb-4">
                      <h4 className="text-xs font-semibold uppercase tracking-wider pb-1.5 mb-2 border-b border-slate-200 border-l-4 border-l-slate-600 pl-2 text-slate-700">연결된 L2 기능</h4>
                      <div className="pt-1">
                        <ul className="space-y-1">
                          {selectedNode.data.template.recommendedFunctionIds.map((fid) => {
                            const fn = MES_ONTOLOGY.find((o) => o.id === fid);
                            return fn ? (
                              <li key={fid} className="text-sm text-slate-700 flex items-center gap-2">
                                <span className="font-mono text-xs text-slate-400">{fn.id}</span>
                                <span>{fn.name}</span>
                              </li>
                            ) : null;
                          })}
                        </ul>
                      </div>
                    </section>
                  )}
                </>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default OntologyVisualizer;
