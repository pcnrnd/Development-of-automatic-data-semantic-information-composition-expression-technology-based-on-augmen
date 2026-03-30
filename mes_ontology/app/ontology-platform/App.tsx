import React, { useState, useMemo } from 'react';
import {
  ResponsiveContainer,
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
} from 'recharts';
import {
  Upload,
  Search,
  BrainCircuit,
  Workflow,
  CheckCircle2,
  PlayCircle,
  FileText,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Layers,
  RefreshCcw,
  Zap,
  BarChart3,
} from 'lucide-react';
import DashboardHeader from './components/DashboardHeader';
import AppSidebar, { type NavId } from './components/AppSidebar';
import OntologyVisualizer from './components/OntologyVisualizer';
import { IndustryType, DataProfile, MatchingResult } from './types';

/** 산업별 데모용 프로파일 (업로드 없을 때 추천 결과가 산업에 따라 달라지도록) */
function getMockProfileForIndustry(industry: IndustryType): DataProfile {
  const base = {
    noiseLevel: 0.15,
    seasonality: true,
    missingValues: 24,
    dataTypes: { Sensor: 'Continuous', State: 'Categorical' },
  };
  switch (industry) {
    case IndustryType.ELECTRONICS:
      return {
        ...base,
        features: ['Temperature', 'Pressure', 'Vibration', 'Spindle_Speed', 'Torque'],
        recordsCount: 8500,
      };
    case IndustryType.AUTOMOTIVE:
      return {
        ...base,
        features: ['State', 'Torque', 'Spindle_Speed', 'Sensor'],
        recordsCount: 12000,
      };
    case IndustryType.PHARMACEUTICAL:
      return {
        ...base,
        features: ['State', 'Sensor', 'Temperature', 'Pressure'],
        recordsCount: 5200,
      };
    case IndustryType.FOOD_BEVERAGE:
      return {
        ...base,
        features: ['Temperature', 'Pressure', 'Sensor', 'State'],
        recordsCount: 6800,
      };
    case IndustryType.SEMICONDUCTOR:
    default:
      return {
        ...base,
        features: ['Temperature', 'Pressure', 'Vibration', 'Spindle_Speed', 'Torque'],
        recordsCount: 12500,
      };
  }
}
import { analysisService } from './services/analysisService';
import { automlFit, type AutoMLFitResult } from './services/backendApi';
import { parseCsvForAutoml } from './utils/csvParser';
import {
  MES_ONTOLOGY,
  REFERENCE_TEMPLATES,
  PIPELINE_STEPS,
  PIPELINE_STEPS_KO,
  PRIORITY_RECOMMENDATION_DESCRIPTION_KO,
  INSIGHTS_SECTION_DESCRIPTION_KO,
} from './constants';

const TOTAL_STEPS = 4;
const stepLabelKo = ['데이터 프로파일링', 'AutoML 모델링', '온톨로지 매칭', '전략 제안'];

/** 업로드·분석에 사용된 프로파일로 데이터 활용 현황 문구 생성 (사용자 생성 템플릿용) */
function buildDataUsageSummary(profile: DataProfile | null, industry: IndustryType): string | undefined {
  if (!profile) return undefined;
  const featList =
    profile.features.length <= 5
      ? profile.features.join(', ')
      : `${profile.features.slice(0, 5).join(', ')} 외 ${profile.features.length - 5}개`;
  return `업로드·분석 데이터 ${profile.recordsCount.toLocaleString()}건, ${profile.features.length}개 피처(${featList}) 기준. ${industry} 도메인 반영, 학습/검증 분할 및 전처리 적용.`;
}

const SIDEBAR_COLLAPSED_KEY = 'mes-optimizer-sidebar-collapsed';

/** API 응답에 없을 때 사용할 전처리·시각화 기본값 (UI 블록 항상 표시) */
const DEFAULT_PREPROCESSING_METHODS = ['StandardScaler', '결측치 중앙값 대체', '이상치 IQR 클리핑'];
const DEFAULT_VISUALIZATION_METHODS = ['산점도', '상관관계 행렬', '히트맵'];

const App: React.FC = () => {
  const [currentNav, setCurrentNav] = useState<NavId>('data');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    try {
      return localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === 'true';
    } catch {
      return false;
    }
  });
  const [helpOpen, setHelpOpen] = useState(false);
  /** 데이터 준비: 업로드된 공정 데이터 파일 */
  const [uploadedProcessFile, setUploadedProcessFile] = useState<File | null>(null);
  /** 업로드 파일 파싱 실패 시 사유 (분석 실행 시 설정, 파일 제거/재선택 시 초기화) */
  const [uploadParseError, setUploadParseError] = useState<string | null>(null);
  const processFileInputRef = React.useRef<HTMLInputElement>(null);

  const handleCollapsedChange = (collapsed: boolean) => {
    setSidebarCollapsed(collapsed);
    try {
      localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(collapsed));
    } catch {}
  };

  const [industry, setIndustry] = useState<IndustryType>(IndustryType.SEMICONDUCTOR);
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [dataProfile, setDataProfile] = useState<DataProfile | null>(null);
  const [analysisResult, setAnalysisResult] = useState<{
    matches: MatchingResult[];
    summary: string;
    augmentationSuggestions: string[];
  } | null>(null);
  const [automlResult, setAutomlResult] = useState<AutoMLFitResult | null>(null);
  /** AutoML 백엔드 호출 실패 시 사용자 안내 메시지 (빈 문자열이면 미설정/시뮬레이션) */
  const [automlFallbackReason, setAutomlFallbackReason] = useState<string | null>(null);
  const [showTopMatchesOnly, setShowTopMatchesOnly] = useState(true);
  /** 결과 탭 내 Standard MES Ontology 그래프 펼침 여부 (접기/펼치기용) */
  const [resultOntologyGraphOpen, setResultOntologyGraphOpen] = useState(true);

  const mockAutomlResult: AutoMLFitResult = useMemo(
    () => ({
      best_model: 'RandomForest',
      best_score: 0.92,
      task: 'classification',
      scoring: 'accuracy',
      all_results: [
        { model: 'RandomForest', mean_score: 0.92 },
        { model: 'XGBoost', mean_score: 0.89 },
        { model: 'LightGBM', mean_score: 0.87 },
        { model: 'LogisticRegression', mean_score: 0.82 },
        { model: 'SVM', mean_score: 0.79 },
      ],
      preprocessing_methods: DEFAULT_PREPROCESSING_METHODS,
      visualization_methods: DEFAULT_VISUALIZATION_METHODS,
    }),
    []
  );

  const runAnalysis = async () => {
    setIsProcessing(true);
    setAnalysisResult(null);
    setAutomlResult(null);
    setAutomlFallbackReason(null);
    setCurrentStep(0);

    let profile = getMockProfileForIndustry(industry);
    let features: number[][] = [
      [1, 2, 3, 4, 5], [2, 3, 4, 5, 6], [1, 1, 2, 2, 3], [3, 4, 5, 6, 7],
      [2, 2, 3, 4, 4], [4, 5, 6, 7, 8], [1, 3, 3, 5, 5], [5, 6, 7, 8, 9],
      [2, 4, 4, 6, 6], [6, 7, 8, 9, 10],
    ];
    let target: number[] = [0, 1, 0, 1, 0, 1, 0, 1, 0, 1];

    if (uploadedProcessFile) {
      const parseResult = await parseCsvForAutoml(uploadedProcessFile);
      if (parseResult.ok) {
        setUploadParseError(null);
        profile = parseResult.data.profile;
        features = parseResult.data.features;
        target = parseResult.data.target;
      } else {
        setUploadParseError(parseResult.ok === false ? parseResult.error : '');
      }
    } else {
      setUploadParseError(null);
    }

    await new Promise((r) => setTimeout(r, 1000));
    setDataProfile(profile);
    setCurrentStep(1);

    const automlRes = await automlFit(features, target, 'classification');
    if (automlRes.ok) {
      const data = automlRes.data;
      if (data.best_model != null && Number.isFinite(data.best_score)) {
        setAutomlResult({
          ...data,
          preprocessing_methods: data.preprocessing_methods?.length ? data.preprocessing_methods : DEFAULT_PREPROCESSING_METHODS,
          visualization_methods: data.visualization_methods?.length ? data.visualization_methods : DEFAULT_VISUALIZATION_METHODS,
        });
      } else {
        setAutomlResult(mockAutomlResult);
        setAutomlFallbackReason('모델 도출 결과가 없어 시뮬레이션 결과를 표시합니다.');
      }
    } else {
      await new Promise((r) => setTimeout(r, 1200));
      setAutomlResult(mockAutomlResult);
      if ('error' in automlRes && automlRes.error) setAutomlFallbackReason(automlRes.error);
    }
    setCurrentStep(2);

    const result = await analysisService.analyzeDataAndMatch(industry, profile, MES_ONTOLOGY);
    if (result) {
      setAnalysisResult(result);
      setCurrentStep(TOTAL_STEPS);
      setCurrentNav('result');
    }
    setIsProcessing(false);
  };

  const radarData = useMemo(() => {
    if (!analysisResult) return [];
    return analysisResult.matches.map((m) => {
      const fn = MES_ONTOLOGY.find((o) => o.id === m.functionId);
      return {
        subject: fn?.name.split(' ')[0] || m.functionId,
        A: m.score * 100,
        fullMark: 100,
      };
    });
  }, [analysisResult]);

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <AppSidebar
        currentNav={currentNav}
        onNavChange={setCurrentNav}
        onHelpOpen={() => setHelpOpen(true)}
        collapsed={sidebarCollapsed}
        onCollapsedChange={handleCollapsedChange}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />
      <DashboardHeader
        onMenuClick={() => setSidebarOpen(true)}
        helpOpen={helpOpen}
        onHelpOpen={setHelpOpen}
        sidebarCollapsed={sidebarCollapsed}
      />

      {currentNav === 'run' && isProcessing && (
        <div className="sticky top-[57px] sm:top-[53px] z-10 bg-indigo-600 text-white px-4 py-2 shadow-md">
          <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
            <span className="text-xs font-bold whitespace-nowrap">
              {currentStep + 1}/{TOTAL_STEPS} {stepLabelKo[currentStep]}
            </span>
            <div className="flex-1 h-1.5 bg-white/30 rounded-full overflow-hidden max-w-xs">
              <div
                className="h-full bg-white rounded-full transition-all duration-300"
                style={{ width: `${((currentStep + 1) / TOTAL_STEPS) * 100}%` }}
              />
            </div>
          </div>
        </div>
      )}

      <main className={`flex-1 transition-[padding] duration-200 ${sidebarCollapsed ? 'lg:pl-16' : 'lg:pl-56 xl:pl-60'}`}>
        {currentNav === 'ontology' && (
          <div key="ontology" className="p-4 sm:p-6 lg:p-8">
            <OntologyVisualizer
              highlightedFunctionIds={analysisResult?.matches.map((m) => m.functionId)}
              templates={[
                ...REFERENCE_TEMPLATES,
                ...(analysisResult
                  ? [
                      {
                        id: 'result-current',
                        name: '기본 결과 템플릿',
                        recommendedFunctionIds: [...analysisResult.matches]
                          .sort((a, b) => b.score - a.score)
                          .slice(0, 1)
                          .map((m) => m.functionId),
                        summary: analysisResult.summary,
                        modelName: automlResult?.best_model,
                        modelPerformance:
                          automlResult?.best_model != null && Number.isFinite(automlResult?.best_score)
                            ? {
                                accuracy: automlResult.best_score,
                                f1Score: automlResult.best_score,
                                trainingTime: undefined,
                              }
                            : undefined,
                        preprocessingMethods: automlResult?.preprocessing_methods,
                        visualizationMethods: automlResult?.visualization_methods,
                        dataUsageSummary: buildDataUsageSummary(dataProfile, industry),
                      },
                    ]
                  : []),
              ]}
              resultSummary={
                analysisResult
                  ? (() => {
                      const top = [...analysisResult.matches].sort((a, b) => b.score - a.score)[0];
                      const topFn = top ? MES_ONTOLOGY.find((o) => o.id === top.functionId) : null;
                      return {
                        summary: analysisResult.summary,
                        topMatchName: topFn?.name,
                      };
                    })()
                  : undefined
              }
            />
          </div>
        )}

        {/* 1. 데이터 준비 */}
        {currentNav === 'data' && (
          <div key="data" className="p-4 sm:p-6 lg:p-8 max-w-2xl">
            <section className="bg-white p-5 sm:p-6 rounded-xl border border-slate-200 shadow-sm">
              <h2 className="text-lg font-bold mb-1 flex items-center gap-2 text-slate-800">
                <Upload className="w-5 h-5 text-indigo-600" />
                데이터 준비
              </h2>
              <p className="text-xs text-slate-500 mb-4 leading-relaxed">
                분석에 사용할 산업과 공정 데이터를 설정합니다. 다음 단계에서 분석 실행 메뉴로 이동해 실행하세요.
              </p>
              <div className="space-y-4">
                <div>
                  <label htmlFor="industry-select" className="block text-xs font-semibold text-slate-600 mb-1">산업</label>
                  <select
                    id="industry-select"
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500/20"
                    value={industry}
                    onChange={(e) => setIndustry(e.target.value as IndustryType)}
                    aria-label="산업 선택"
                  >
                    {Object.values(IndustryType).map((type) => (
                      <option key={type} value={type}>{type}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <span className="block text-xs font-semibold text-slate-600 mb-2">공정 데이터</span>
                  <input
                    ref={processFileInputRef}
                    id="process-data-upload"
                    type="file"
                    accept=".csv,.xlsx,.xls,.json"
                    className="sr-only"
                    aria-label="공정 데이터 파일 선택"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) {
                        setUploadedProcessFile(f);
                        setUploadParseError(null);
                      }
                      e.target.value = '';
                    }}
                  />
                  <label
                    htmlFor="process-data-upload"
                    className={`block border-2 border-dashed rounded-xl p-6 sm:p-8 text-center transition-all cursor-pointer group ${
                      uploadedProcessFile
                        ? 'border-emerald-200 bg-emerald-50/50 hover:bg-emerald-50'
                        : 'border-slate-200 bg-slate-50 hover:bg-slate-100'
                    }`}
                  >
                    {uploadedProcessFile ? (
                      <>
                        <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-3 border border-emerald-200">
                          <CheckCircle2 className="w-6 h-6 text-emerald-600" />
                        </div>
                        <p className="text-sm font-semibold text-slate-800 truncate max-w-full px-2">{uploadedProcessFile.name}</p>
                        <p className="text-[10px] text-slate-500 mt-1">{(uploadedProcessFile.size / 1024).toFixed(1)} KB · 클릭하여 다른 파일 선택</p>
                        <button
                          type="button"
                          onClick={(ev) => { ev.preventDefault(); ev.stopPropagation(); setUploadedProcessFile(null); setUploadParseError(null); }}
                          className="mt-3 text-xs font-semibold text-rose-600 hover:text-rose-700"
                        >
                          파일 제거
                        </button>
                      </>
                    ) : (
                      <>
                        <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center mx-auto mb-3 shadow-sm border border-slate-100 group-hover:scale-110 transition-transform">
                          <Upload className="w-6 h-6 text-indigo-600" />
                        </div>
                        <p className="text-sm font-semibold text-slate-700">Upload Process Data</p>
                        <p className="text-[10px] text-slate-400 mt-1">클릭하여 파일 선택 · 데모: 분석 실행에서 샘플로 실행 가능</p>
                      </>
                    )}
                  </label>
                  {uploadParseError && (
                    <p className="mt-3 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2" role="alert">
                      {uploadParseError}
                    </p>
                  )}
                </div>
                <p className="text-[10px] text-slate-400 pt-2">다음: 사이드바에서 <strong>분석 실행</strong>으로 이동 후 실행하세요.</p>
              </div>
            </section>
          </div>
        )}

        {/* 2. 분석 실행 */}
        {currentNav === 'run' && (
          <div key="run-view" className="p-4 sm:p-6 lg:p-8 max-w-2xl" data-view="run">
            <h1 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">
              <PlayCircle className="w-6 h-6 text-indigo-600" />
              분석 실행
            </h1>
            <section className="bg-white p-5 sm:p-6 rounded-xl border border-slate-200 shadow-sm mb-6">
              <h2 className="text-base font-bold mb-1 flex items-center gap-2 text-slate-700">
                <PlayCircle className="w-4 h-4 text-indigo-600" />
                파이프라인 실행
              </h2>
              <p className="text-xs text-slate-500 mb-4 leading-relaxed">
                데이터 준비에서 설정한 산업·데이터로 파이프라인을 실행합니다. 완료 후 결과 메뉴로 자동 이동합니다.
              </p>
              <div className="mb-4 p-3 bg-slate-50 rounded-lg border border-slate-100">
                <p className="text-[10px] text-slate-500 uppercase font-semibold mb-1">현재 산업</p>
                <p className="text-sm font-semibold text-slate-800">{industry}</p>
              </div>
              <button
                type="button"
                onClick={runAnalysis}
                disabled={isProcessing}
                aria-label={isProcessing ? '분석 중' : '분석 실행'}
                className={`w-full py-3 rounded-lg font-bold text-sm flex items-center justify-center gap-2 transition-all ${
                  isProcessing
                    ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                    : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-200 active:scale-[0.98] focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2'
                }`}
              >
                {isProcessing ? <RefreshCcw className="w-4 h-4 animate-spin" /> : <BrainCircuit className="w-4 h-4" />}
                {isProcessing ? '분석 중…' : '분석 실행'}
              </button>
            </section>
            <section className="bg-white p-5 sm:p-6 rounded-xl border border-slate-200 shadow-sm">
              <h2 className="text-base font-bold mb-3 flex items-center gap-2 text-slate-800">
                <Workflow className="w-4 h-4 text-emerald-600" />
                Pipeline
              </h2>
              <div className="space-y-3">
                {PIPELINE_STEPS.map((step, idx) => (
                  <div key={step} className="flex items-center gap-3">
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-colors shrink-0 ${
                        currentStep > idx ? 'bg-emerald-100 text-emerald-600' :
                        currentStep === idx ? 'bg-indigo-600 text-white animate-pulse' :
                        'bg-slate-100 text-slate-400'
                      }`}
                    >
                      {currentStep > idx ? <CheckCircle2 className="w-5 h-5" /> : idx + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-semibold ${currentStep === idx ? 'text-indigo-600' : 'text-slate-700'}`}>
                        {step}
                        {currentStep === idx && <span className="text-xs font-normal text-slate-500 ml-1">진행 중</span>}
                      </p>
                      <p className="text-[10px] text-slate-400 mt-0.5">{PIPELINE_STEPS_KO[idx]}</p>
                      {idx === 2 && automlResult && automlResult.best_model != null && Number.isFinite(automlResult.best_score) && (
                        <p className="text-[10px] text-emerald-600 mt-1">
                          도출된 모델: {automlResult.best_model} ({(automlResult.best_score * 100).toFixed(1)}%)
                        </p>
                      )}
                      {currentStep === idx && (
                        <div className="h-1 bg-slate-100 w-full mt-2 rounded-full overflow-hidden">
                          <div className="h-full bg-indigo-500 animate-[progress_2s_infinite]" />
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>
        )}

        {/* 3. 결과 */}
        {currentNav === 'result' && (
          <div key="result" className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
            {!analysisResult && !isProcessing && (
              <div className="bg-white border border-slate-200 rounded-xl p-12 sm:p-24 flex flex-col items-center text-center">
                <div className="w-16 h-16 sm:w-20 sm:h-20 bg-slate-100 rounded-full flex items-center justify-center mb-4 sm:mb-6">
                  <BarChart3 className="w-8 h-8 sm:w-10 sm:h-10 text-slate-400" />
                </div>
                <h3 className="text-xl sm:text-2xl font-bold text-slate-800 tracking-tight">결과 없음</h3>
                <p className="text-sm text-slate-500 mt-2 max-w-sm">
                  <strong>분석 실행</strong> 메뉴에서 분석을 실행하면 여기에 결과가 표시됩니다.
                </p>
              </div>
            )}

            {(isProcessing || analysisResult) && (
                <div className="space-y-6">
                  {uploadParseError && (
                    <div className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3" role="alert">
                      <p className="font-semibold">업로드한 파일을 사용할 수 없어 기본 데이터로 분석했습니다.</p>
                      <p className="mt-1 text-amber-700">{uploadParseError}</p>
                    </div>
                  )}
                  {!uploadedProcessFile && analysisResult && (
                    <p className="text-xs text-slate-600 bg-slate-100 border border-slate-200 rounded-lg px-4 py-2.5">
                      데모용 기본 데이터로 추천 중입니다. 다른 결과를 보려면 <strong>데이터 준비</strong>에서 CSV를 업로드한 뒤 다시 분석 실행해 보세요.
                    </p>
                  )}
                  {/* AutoML 추천 리스트: 1~5등 순위, 시각화, 전처리 방법 */}
                  {(automlResult || analysisResult) && (
                    <div className="bg-white p-5 sm:p-6 rounded-xl border border-slate-200 shadow-sm">
                      <h3 className="text-base font-bold text-slate-800 mb-4 flex items-center gap-2">
                        <BrainCircuit className="w-4 h-4 text-indigo-600" />
                        AutoML 추천 리스트
                      </h3>

                      {automlResult && (
                        <>
                          {/* 1~5등 모델 순위 */}
                          <div className="mb-5">
                            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">모델 순위</p>
                            <div className="flex flex-wrap gap-3">
                              {(() => {
                                const list = (automlResult.all_results ?? [{ model: automlResult.best_model, mean_score: automlResult.best_score }])
                                  .slice()
                                  .sort((a, b) => b.mean_score - a.mean_score)
                                  .slice(0, 5);
                                const rankStyle = [
                                  'bg-amber-100 text-amber-800 border-amber-200',
                                  'bg-slate-100 text-slate-700 border-slate-200',
                                  'bg-orange-100 text-orange-700 border-orange-200',
                                  'bg-slate-50 text-slate-600 border-slate-200',
                                  'bg-slate-50 text-slate-600 border-slate-200',
                                ];
                                return list.map((r, i) => (
                                  <div
                                    key={r.model}
                                    className={`flex items-center gap-2 px-4 py-2.5 rounded-lg border ${rankStyle[i]}`}
                                  >
                                    <span className="text-sm font-bold">{(i + 1)}등</span>
                                    <span className="font-semibold text-sm">{r.model}</span>
                                    <span className="text-xs opacity-90">{(r.mean_score * 100).toFixed(1)}%</span>
                                  </div>
                                ));
                              })()}
                            </div>
                          </div>

                          {/* 모델 점수 시각화 */}
                          <div className="mb-5">
                            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">모델별 점수</p>
                            <div className="h-48 w-full">
                              <ResponsiveContainer width="100%" height="100%">
                                <BarChart
                                  data={(automlResult.all_results ?? [{ model: automlResult.best_model, mean_score: automlResult.best_score }])
                                    .slice()
                                    .sort((a, b) => b.mean_score - a.mean_score)
                                    .map((r) => ({ name: r.model, score: (r.mean_score * 100).toFixed(1), fullScore: r.mean_score * 100 }))}
                                  layout="vertical"
                                  margin={{ top: 4, right: 8, left: 8, bottom: 4 }}
                                >
                                  <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 10 }} />
                                  <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 11 }} />
                                  <Tooltip formatter={(v: number) => [`${v.toFixed(1)}%`, '점수']} />
                                  <Bar dataKey="fullScore" fill="#6366f1" radius={[0, 4, 4, 0]} name="점수">
                                    {((automlResult.all_results ?? [{ model: automlResult.best_model, mean_score: automlResult.best_score }])
                                      .slice()
                                      .sort((a, b) => b.mean_score - a.mean_score))
                                      .map((_, i) => (
                                        <Cell key={i} fill={['#4f46e5', '#6366f1', '#818cf8', '#a5b4fc', '#c7d2fe'][i] ?? '#94a3b8'} />
                                      ))}
                                  </Bar>
                                </BarChart>
                              </ResponsiveContainer>
                            </div>
                          </div>

                          {/* 전처리 방법 · 시각화 방법 (나란히) */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {(automlResult.preprocessing_methods?.length ?? 0) > 0 && (
                              <div>
                                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">전처리 방법</p>
                                <ul className="flex flex-wrap gap-2">
                                  {automlResult.preprocessing_methods!.map((method, i) => (
                                    <li
                                      key={i}
                                      className="px-3 py-1.5 bg-slate-100 text-slate-700 text-xs font-medium rounded-lg border border-slate-200"
                                    >
                                      {method}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}
                            {((automlResult.visualization_methods ?? []).length > 0) && (
                              <div>
                                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">시각화 방법</p>
                                <ul className="flex flex-wrap gap-2">
                                  {(automlResult.visualization_methods ?? []).map((method, i) => (
                                    <li
                                      key={i}
                                      className="px-3 py-1.5 bg-slate-100 text-slate-700 text-xs font-medium rounded-lg border border-slate-200"
                                    >
                                      {method}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </div>
                        </>
                      )}

                      {automlFallbackReason && (
                        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-4">
                          {automlFallbackReason} 시뮬레이션 결과를 표시합니다.
                        </p>
                      )}
                      {!automlResult && analysisResult && !automlFallbackReason && (
                        <p className="text-sm text-slate-600">
                          데모 모드로 실행되었습니다. 백엔드 미연결 시 샘플 데이터로 분석되며, 분류 작업에는 <strong className="text-slate-800">RandomForest</strong>·<strong className="text-slate-800">XGBoost</strong> 등을 추천합니다.
                        </p>
                      )}
                    </div>
                  )}

                  {analysisResult && (
                    <div className="bg-white p-5 sm:p-8 rounded-xl border border-slate-200 shadow-sm">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
                        <div>
                          <h2 className="text-xl sm:text-2xl font-bold text-slate-800">Priority Recommendation</h2>
                          <p className="text-xs text-slate-500 mt-1">{PRIORITY_RECOMMENDATION_DESCRIPTION_KO}</p>
                        </div>
                        <button
                          type="button"
                          className="flex items-center justify-center gap-2 bg-slate-900 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-slate-800 focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 shrink-0"
                          aria-label="결과 내보내기"
                        >
                          <FileText className="w-4 h-4" />
                          내보내기
                        </button>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8 mb-8">
                        <div className="space-y-4">
                          {analysisResult.matches.length > 3 && (
                            <button
                              type="button"
                              onClick={() => setShowTopMatchesOnly(!showTopMatchesOnly)}
                              className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 flex items-center gap-1"
                            >
                              {showTopMatchesOnly ? '전체 보기' : '상위 3개만 보기'}
                              {showTopMatchesOnly ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />}
                            </button>
                          )}
                          {(showTopMatchesOnly
                            ? analysisResult.matches.sort((a, b) => a.priority - b.priority).slice(0, 3)
                            : analysisResult.matches.sort((a, b) => a.priority - b.priority)
                          ).map((match) => {
                            const fn = MES_ONTOLOGY.find((o) => o.id === match.functionId);
                            return (
                              <div
                                key={match.functionId}
                                className="flex gap-4 p-4 rounded-lg bg-slate-50 border border-slate-100 hover:border-indigo-200 transition-colors"
                              >
                                <div className="flex flex-col items-center gap-1 shrink-0">
                                  <span
                                    className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                                      match.priority === 1 ? 'bg-rose-100 text-rose-600' :
                                      match.priority === 2 ? 'bg-amber-100 text-amber-600' :
                                      'bg-indigo-100 text-indigo-600'
                                    }`}
                                  >
                                    P{match.priority}
                                  </span>
                                  <div className="h-full w-0.5 bg-slate-200 rounded-full min-h-4" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center justify-between gap-2 mb-1">
                                    <h4 className="font-bold text-slate-800 text-sm sm:text-base truncate">{fn?.name}</h4>
                                    <span className="text-xs font-bold text-indigo-600 shrink-0">{(match.score * 100).toFixed(0)}%</span>
                                  </div>
                                  <p className="text-xs text-slate-600 leading-relaxed mb-3">{match.rationale}</p>
                                  <div className="flex-1 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                                    <div
                                      className="h-full bg-indigo-500 rounded-full"
                                      style={{ width: `${match.score * 100}%` }}
                                    />
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        <div className="bg-slate-50 rounded-xl p-4 sm:p-6 flex flex-col items-center justify-center border border-slate-100">
                          <div className="w-full h-56 sm:h-64">
                            <ResponsiveContainer width="100%" height="100%">
                              <RadarChart cx="50%" cy="50%" outerRadius="80%" data={radarData}>
                                <PolarGrid stroke="#e2e8f0" />
                                <PolarAngleAxis dataKey="subject" tick={{ fontSize: 10, fill: '#64748b' }} />
                                <PolarRadiusAxis angle={30} domain={[0, 100]} />
                                <Radar name="Match Score" dataKey="A" stroke="#4f46e5" fill="#4f46e5" fillOpacity={0.6} />
                              </RadarChart>
                            </ResponsiveContainer>
                          </div>
                          <div className="mt-4 p-4 bg-white rounded-lg border border-slate-200 w-full">
                            <p className="text-xs text-slate-500 italic leading-relaxed">{analysisResult.summary}</p>
                          </div>
                        </div>
                      </div>

                      {/* 결과가 Standard MES Ontology에 반영된 내용 표시 */}
                      <div className="pt-6 border-t border-slate-100">
                        <h4 className="text-sm font-bold text-slate-800 mb-1 flex items-center gap-2">
                          <Layers className="w-4 h-4 text-indigo-500" />
                          Standard MES Ontology 반영
                        </h4>
                        <p className="text-[10px] text-slate-500 mb-3">
                          아래 추천 기능은 표준 MES 온톨로지의 기능(ID)과 매칭된 결과입니다. 그래프에서 해당 항목이 강조되어 표시됩니다.
                        </p>
                        <div className="flex flex-wrap gap-2 mb-4">
                          {analysisResult.matches
                            .sort((a, b) => a.priority - b.priority)
                            .slice(0, 9)
                            .map((m) => {
                              const fn = MES_ONTOLOGY.find((o) => o.id === m.functionId);
                              return (
                                <span
                                  key={m.functionId}
                                  className="px-2.5 py-1 bg-indigo-50 border border-indigo-100 text-indigo-700 text-xs font-medium rounded-md"
                                  title={fn?.name}
                                >
                                  {m.functionId} {fn?.name?.split(' ')[0]}
                                </span>
                              );
                            })}
                        </div>
                        {/* 결과 화면에 매칭 강조 그래프 표시 (embedded, 접기/펼치기) */}
                        <div className="mb-4 rounded-xl border border-slate-200 bg-white overflow-hidden">
                          <button
                            type="button"
                            onClick={() => setResultOntologyGraphOpen((v) => !v)}
                            className="w-full flex items-center justify-between gap-2 px-4 py-2.5 text-left text-sm font-medium text-slate-700 hover:bg-slate-50 border-b border-slate-100 transition-colors"
                            aria-expanded={resultOntologyGraphOpen}
                          >
                            <span>매칭 결과 그래프</span>
                            {resultOntologyGraphOpen ? (
                              <ChevronUp className="w-4 h-4 text-slate-400 shrink-0" />
                            ) : (
                              <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
                            )}
                          </button>
                          {resultOntologyGraphOpen && (
                            <OntologyVisualizer
                              embedded
                              highlightedFunctionIds={analysisResult.matches.map((m) => m.functionId)}
                              templates={[
                                ...REFERENCE_TEMPLATES,
                                {
                                  id: 'result-current',
                                  name: '기본 결과 템플릿',
                                  recommendedFunctionIds: [...analysisResult.matches]
                                    .sort((a, b) => b.score - a.score)
                                    .slice(0, 1)
                                    .map((m) => m.functionId),
                                  summary: analysisResult.summary,
                                  modelName: automlResult?.best_model,
                                  modelPerformance:
                                    automlResult?.best_model != null && Number.isFinite(automlResult?.best_score)
                                      ? {
                                          accuracy: automlResult.best_score,
                                          f1Score: automlResult.best_score,
                                          trainingTime: undefined,
                                        }
                                      : undefined,
                                  preprocessingMethods: automlResult?.preprocessing_methods,
                                  visualizationMethods: automlResult?.visualization_methods,
                                  dataUsageSummary: buildDataUsageSummary(dataProfile, industry),
                                },
                              ]}
                              resultSummary={{
                                summary: analysisResult.summary,
                                topMatchName: (() => {
                                  const top = [...analysisResult.matches].sort((a, b) => b.score - a.score)[0];
                                  return top ? MES_ONTOLOGY.find((o) => o.id === top.functionId)?.name : undefined;
                                })(),
                              }}
                            />
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => setCurrentNav('ontology')}
                          className="flex items-center gap-2 text-sm font-semibold text-indigo-600 hover:text-indigo-700"
                        >
                          <Layers className="w-4 h-4" />
                          Standard MES Ontology에서 보기
                        </button>
                      </div>

                      <div className="pt-6 border-t border-slate-100">
                        <h4 className="text-sm font-bold text-slate-800 mb-1 flex items-center gap-2">
                          <Zap className="w-4 h-4 text-amber-500" />
                          Insights
                        </h4>
                        <p className="text-[10px] text-slate-500 mb-4">{INSIGHTS_SECTION_DESCRIPTION_KO}</p>
                        <div className="flex flex-wrap gap-2">
                          {analysisResult.augmentationSuggestions?.map((s, i) => (
                            <div
                              key={i}
                              className="px-3 py-1.5 bg-amber-50 border border-amber-100 text-amber-700 text-[10px] font-bold rounded-lg flex items-center gap-2"
                            >
                              <ChevronRight className="w-3 h-3 shrink-0" />
                              {s}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
          </div>
        )}
      </main>

      <footer className={`bg-white border-t border-slate-200 py-5 px-4 sm:px-6 text-center lg:text-left transition-[padding] duration-200 ${sidebarCollapsed ? 'lg:pl-20' : 'lg:pl-[14rem] xl:pl-[15rem]'}`}>
        <p className="text-xs text-slate-400 font-medium tracking-tight">Smart MES Selection Platform</p>
      </footer>

      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes progress {
          0% { width: 0%; transform: translateX(-100%); }
          50% { width: 50%; transform: translateX(0%); }
          100% { width: 100%; transform: translateX(100%); }
        }
      `}} />
    </div>
  );
};

export default App;
