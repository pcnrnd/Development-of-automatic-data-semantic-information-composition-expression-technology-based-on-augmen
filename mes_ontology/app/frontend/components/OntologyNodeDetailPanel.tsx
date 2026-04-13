import React from 'react';
import { MES_ONTOLOGY } from '../constants';
import { stripLatinAcronymParentheses } from '../utils/displayLabels';
import { OntologySelectedNode } from '../types';
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
  LayoutTemplate,
} from 'lucide-react';

/** L3 패널용 결과 탭 요약 (선택). analysisResult.summary 등 */
export interface ResultSummaryForPanel {
  summary: string;
  topMatchName?: string;
  /** 매칭 분석에 쓰인 피처(컬럼)명 — 요약 문구의 "N개 피처"와 대응 */
  profileFeatureNames?: string[];
}

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

const CATEGORY_LABEL_KO: Record<string, string> = {
  Tracking: '추적',
  Quality: '품질',
  Maintenance: '보전',
  Inventory: '재고',
  Production: '생산',
};

interface OntologyNodeDetailPanelProps {
  selectedNode: OntologySelectedNode | null;
  onClose: () => void;
  resultSummary?: ResultSummaryForPanel;
}

/**
 * 온톨로지 그래프/목록에서 노드를 선택했을 때 우측에 슬라이드로 표시되는 메타정보 패널.
 * 표준 MES 온톨로지 탭과 데이터 준비 탭의 분석 구조 맵 등 여러 위치에서 공용으로 사용합니다.
 */
const OntologyNodeDetailPanel: React.FC<OntologyNodeDetailPanelProps> = ({
  selectedNode,
  onClose,
  resultSummary,
}) => {
  if (!selectedNode) return null;
  return (
    <>
      <div
        className="fixed inset-0 z-[90] bg-slate-900/40 transition-opacity"
        aria-hidden
        onClick={onClose}
      />
      <div
        className="fixed right-0 top-0 bottom-0 z-[91] w-full max-w-[100vw] sm:w-[360px] bg-white border-l border-slate-200 shadow-xl flex flex-col transition-transform duration-200 ease-out"
        role="dialog"
        aria-label="노드 메타정보"
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 bg-slate-50 shrink-0">
          <span className="text-sm font-semibold text-slate-800">
            {selectedNode.type === 'root' && 'L0 루트'}
            {selectedNode.type === 'domain' && 'L1 도메인'}
            {selectedNode.type === 'function' && 'L2 기능'}
            {selectedNode.type === 'template' && 'L3 템플릿'}
          </span>
          <button
            type="button"
            onClick={onClose}
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
                <h3 className="text-lg font-bold text-slate-800 tracking-wide">{selectedNode.data.label}</h3>
              </div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">소속 기능 (L2)</p>
              <ul className="space-y-2">
                {selectedNode.data.functionIds.map((fid) => {
                  const fn = MES_ONTOLOGY.find((o) => o.id === fid);
                  return fn ? (
                    <li key={fid} className="text-sm text-slate-700 flex items-center gap-2">
                      <span className="font-mono text-xs text-slate-400">{fn.id}</span>
                      <span>{stripLatinAcronymParentheses(fn.nameKo ?? fn.name)}</span>
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
                <span className="text-xs font-bold text-slate-400 tracking-wider">
                  {CATEGORY_LABEL_KO[selectedNode.data.fn.category] ?? selectedNode.data.fn.category} 모듈
                </span>
              </div>
              <h3 className="text-lg font-bold text-slate-800">
                {stripLatinAcronymParentheses(selectedNode.data.fn.nameKo ?? selectedNode.data.fn.name)}
              </h3>
              <div className="flex flex-wrap gap-2">
                <span className="px-3 py-1 bg-indigo-100 text-indigo-700 rounded-md text-xs font-medium">ID: {selectedNode.data.fn.id}</span>
                <span className="px-3 py-1 bg-slate-100 text-slate-600 rounded-md text-xs font-medium">표준: {selectedNode.data.fn.standard}</span>
              </div>
              <section>
                <h4 className="text-xs font-semibold tracking-wider mb-2 flex items-center gap-2 border-b border-slate-200 border-l-4 border-l-indigo-500 pl-2 pb-1.5 text-indigo-700">
                  <Info className="w-3.5 h-3.5 text-indigo-500" /> 설명
                </h4>
                <p className="text-slate-600 text-sm leading-relaxed">{selectedNode.data.fn.descriptionKo ?? selectedNode.data.fn.description}</p>
              </section>
              <section>
                <h4 className="text-xs font-semibold tracking-wider mb-2 flex items-center gap-2 border-b border-slate-200 border-l-4 border-l-emerald-500 pl-2 pb-1.5 text-emerald-700">
                  <CheckCircle className="w-3.5 h-3.5 text-emerald-500" /> 도입 효과
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
              {selectedNode.data.template.id === 'result-current' &&
                resultSummary?.profileFeatureNames &&
                resultSummary.profileFeatureNames.length > 0 && (
                <section className="mb-4">
                  <h4 className="text-xs font-semibold tracking-wider pb-1.5 mb-2 border-b border-slate-200 border-l-4 border-l-violet-400 pl-2 text-violet-600">
                    매칭에 사용된 피처 ({resultSummary.profileFeatureNames.length}개)
                  </h4>
                  <div className="pt-1 max-h-36 overflow-y-auto rounded-md bg-slate-50/80 px-3 py-2 border border-slate-100">
                    <ul className="space-y-1">
                      {resultSummary.profileFeatureNames.map((name, i) => (
                        <li key={`${name}-${i}`} className="text-sm text-slate-600 leading-snug">
                          {name}
                        </li>
                      ))}
                    </ul>
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
                      {selectedNode.data.template.modelPerformance.r2 != null && (
                        <div className="flex justify-between gap-2"><dt className="text-slate-500">R²</dt><dd>{selectedNode.data.template.modelPerformance.r2.toFixed(3)}</dd></div>
                      )}
                      {selectedNode.data.template.modelPerformance.mae != null && (
                        <div className="flex justify-between gap-2"><dt className="text-slate-500">MAE</dt><dd>{selectedNode.data.template.modelPerformance.mae}</dd></div>
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
                            <span>{stripLatinAcronymParentheses(fn.nameKo ?? fn.name)}</span>
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
  );
};

export default OntologyNodeDetailPanel;
