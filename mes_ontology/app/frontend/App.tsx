import React, { useState, useMemo, useEffect } from 'react';
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
  SlidersHorizontal,
  Shuffle,
  AlertTriangle,
} from 'lucide-react';
import DashboardHeader from './components/DashboardHeader';
import AppSidebar, { type NavId } from './components/AppSidebar';
import OntologyVisualizer from './components/OntologyVisualizer';
import OntologyGraph from './components/OntologyGraph';
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
import { analysisService, getTemplateRecommendationsByColumns, getEnhancedTemplateRecommendations } from './services/analysisService';
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

// ─── 전처리 & 증강 설정 ───────────────────────────────────────────────────────
interface PreprocConfig {
  missingStrategy: 'mean' | 'median' | 'drop' | 'zero';
  outlierMethod: 'iqr' | 'zscore' | 'none';
  scalingMethod: 'standard' | 'minmax' | 'robust' | 'none';
  featureEngineering: ('polynomial' | 'log' | 'timediff')[];
  smoteEnabled: boolean;
  smoteK: number;
  smoteStrategy: 'auto' | 'minority' | 'not_majority';
}

const DEFAULT_PREPROC_CONFIG: PreprocConfig = {
  missingStrategy: 'median',
  outlierMethod: 'iqr',
  scalingMethod: 'standard',
  featureEngineering: [],
  smoteEnabled: false,
  smoteK: 5,
  smoteStrategy: 'auto',
};

const PREPROC_STEP_LABELS = ['결측치 / 타입 처리', '스케일링 / 피처 엔지니어링', 'SMOTE 증강'];

function preprocMethodsFromConfig(config: PreprocConfig): string[] {
  const methods: string[] = [];
  const missingLabels: Record<PreprocConfig['missingStrategy'], string> = {
    mean: '평균값 대체', median: '중앙값 대체', drop: '결측 행 제거', zero: '0 대체',
  };
  methods.push(missingLabels[config.missingStrategy]);
  if (config.outlierMethod === 'iqr') methods.push('이상치 IQR 클리핑');
  else if (config.outlierMethod === 'zscore') methods.push('이상치 Z-Score 제거');
  const scalingLabels: Record<PreprocConfig['scalingMethod'], string | null> = {
    standard: 'StandardScaler', minmax: 'MinMaxScaler', robust: 'RobustScaler', none: null,
  };
  if (scalingLabels[config.scalingMethod]) methods.push(scalingLabels[config.scalingMethod]!);
  if (config.featureEngineering.includes('polynomial')) methods.push('다항식 특성');
  if (config.featureEngineering.includes('log')) methods.push('로그 변환');
  if (config.featureEngineering.includes('timediff')) methods.push('시간 차분');
  if (config.smoteEnabled) methods.push(`SMOTE 증강 (k=${config.smoteK})`);
  return methods;
}

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

  // 파일 업로드 시 샘플 미리보기 파싱
  useEffect(() => {
    if (!uploadedProcessFile) { setDataPreview(null); return; }
    let cancelled = false;
    (async () => {
      const raw = await uploadedProcessFile.text();
      if (cancelled) return;
      const text = raw.replace(/^\uFEFF/, '');
      const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
      if (lines.length < 2) { setDataPreview(null); return; }
      const delim = lines[0].includes(';') ? ';' : ',';
      const strip = (s: string) => s.replace(/^"|"$/g, '').trim();
      const headers = lines[0].split(delim).map(strip);
      const rows = lines.slice(1, 6).map((l) => l.split(delim).map(strip));
      setDataPreview({ headers, rows });
    })();
    return () => { cancelled = true; };
  }, [uploadedProcessFile]);

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

  // 전처리 & 증강
  const [preprocConfig, setPreprocConfig] = useState<PreprocConfig>(DEFAULT_PREPROC_CONFIG);
  const [preprocCompleted, setPreprocCompleted] = useState(false);
  const [dataPreview, setDataPreview] = useState<{ headers: string[]; rows: string[][] } | null>(null);
  const [preprocSettingsExpanded, setPreprocSettingsExpanded] = useState(false);

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
    const configuredMethods = preprocCompleted ? preprocMethodsFromConfig(preprocConfig) : DEFAULT_PREPROCESSING_METHODS;
    if (automlRes.ok) {
      const data = automlRes.data;
      if (data.best_model != null && Number.isFinite(data.best_score)) {
        setAutomlResult({
          ...data,
          preprocessing_methods: data.preprocessing_methods?.length ? data.preprocessing_methods : configuredMethods,
          visualization_methods: data.visualization_methods?.length ? data.visualization_methods : DEFAULT_VISUALIZATION_METHODS,
        });
      } else {
        setAutomlResult({ ...mockAutomlResult, preprocessing_methods: configuredMethods });
        setAutomlFallbackReason('모델 도출 결과가 없어 시뮬레이션 결과를 표시합니다.');
      }
    } else {
      await new Promise((r) => setTimeout(r, 1200));
      setAutomlResult({ ...mockAutomlResult, preprocessing_methods: configuredMethods });
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

  const preprocChartData = useMemo(() => {
    const baseCount = dataProfile?.recordsCount ?? 8500;
    const missingBefore = dataProfile?.missingValues ?? 24;
    const outlierBefore = Math.round((dataProfile?.noiseLevel ?? 0.15) * 100);
    const outlierAfter = preprocConfig.outlierMethod !== 'none' ? 0 : outlierBefore;
    const afterCount = preprocConfig.smoteEnabled
      ? Math.round(baseCount * (preprocConfig.smoteStrategy === 'minority' ? 1.35 : 1.6))
      : baseCount;
    const classAfterB = preprocConfig.smoteEnabled
      ? preprocConfig.smoteStrategy === 'minority' ? 48 : 70
      : 30;
    return {
      baseCount,
      afterCount,
      classDistData: [
        { name: 'Class A', before: 70, after: 70 },
        { name: 'Class B', before: 30, after: classAfterB },
      ],
      qualityData: [
        { name: '결측치', before: missingBefore, after: 0 },
        { name: '이상치(%)', before: outlierBefore, after: outlierAfter },
      ],
    };
  }, [dataProfile, preprocConfig]);

  const preprocAfterSample = useMemo(() => {
    if (!dataPreview) return null;
    const lastIdx = dataPreview.headers.length - 1;
    const labelMap: Record<string, number> = {};
    let nextId = 0;
    dataPreview.rows.forEach((row) => {
      const v = row[lastIdx];
      if (v !== '' && Number.isNaN(Number(v)) && !(v in labelMap)) labelMap[v] = nextId++;
    });
    const missingPlaceholder: Record<PreprocConfig['missingStrategy'], string> = {
      mean: '~avg', median: '~med', drop: '(제거)', zero: '0',
    };
    const afterRows = dataPreview.rows.map((row) =>
      row.map((cell, ci) => {
        if (ci === lastIdx) {
          if (cell !== '' && Number.isNaN(Number(cell))) return String(labelMap[cell] ?? 0);
          return cell;
        }
        if (cell === '') return missingPlaceholder[preprocConfig.missingStrategy];
        return cell;
      })
    );
    return { headers: dataPreview.headers, rows: afterRows, labelMap };
  }, [dataPreview, preprocConfig.missingStrategy]);

  /** 향상된 온톨로지 템플릿 추천: 산업 컨텍스트 + 데이터 타입 패턴 + ISA-95 경고 + 커버리지 포함 */
  const { recommendations: uploadTemplateRecommendations, isa95Warning: uploadIsa95Warning } = useMemo(() => {
    if (!dataPreview) return { recommendations: [], isa95Warning: null };
    return getEnhancedTemplateRecommendations(dataPreview.headers, dataPreview.rows, REFERENCE_TEMPLATES, industry, 3);
  }, [dataPreview, industry]);

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
          <div key="data" className="p-4 sm:p-6 lg:p-8">
            <h1 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">
              <Upload className="w-5 h-5 text-indigo-600" />
              데이터 준비
            </h1>

            {/* 상단: 데이터 준비 컨트롤 */}
            <section className="mb-4 bg-white rounded-xl border border-slate-200 shadow-sm p-5 sm:p-6">
              <p className="text-xs text-slate-500 mb-4 leading-relaxed">
                분석에 사용할 산업과 공정 데이터를 설정합니다. 다음 단계에서 분석 실행 메뉴로 이동해 실행하세요.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 items-stretch">
                {/* 산업 선택 */}
                <div className="flex flex-col">
                  <label htmlFor="industry-select" className="text-xs font-semibold text-slate-600 mb-1">산업</label>
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
                  <div className="flex-1" />
                  <p className="text-[10px] text-slate-400 mt-3">다음: 사이드바에서 <strong>전처리 &amp; 증강</strong>으로 이동해 전처리 설정 후 분석을 실행하세요.</p>
                </div>

                {/* 파일 업로드 */}
                <div className="flex flex-col">
                  <span className="text-xs font-semibold text-slate-600 mb-1">공정 데이터</span>
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
                    className={`flex-1 flex items-center gap-4 border-2 border-dashed rounded-xl px-5 py-4 transition-all cursor-pointer group ${
                      uploadedProcessFile
                        ? 'border-emerald-200 bg-emerald-50/50 hover:bg-emerald-50'
                        : 'border-slate-200 bg-slate-50 hover:bg-slate-100'
                    }`}
                  >
                    {uploadedProcessFile ? (
                      <>
                        <div className="shrink-0 w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center border border-emerald-200">
                          <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-slate-800 truncate">{uploadedProcessFile.name}</p>
                          <p className="text-[10px] text-slate-500 mt-0.5">{(uploadedProcessFile.size / 1024).toFixed(1)} KB · 클릭하여 다른 파일 선택</p>
                        </div>
                        <button
                          type="button"
                          onClick={(ev) => { ev.preventDefault(); ev.stopPropagation(); setUploadedProcessFile(null); setUploadParseError(null); }}
                          className="shrink-0 text-xs font-semibold text-rose-600 hover:text-rose-700"
                        >
                          제거
                        </button>
                      </>
                    ) : (
                      <>
                        <div className="shrink-0 w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-sm border border-slate-100 group-hover:scale-110 transition-transform">
                          <Upload className="w-5 h-5 text-indigo-600" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-slate-700">공정 데이터 업로드</p>
                          <p className="text-[10px] text-slate-400 mt-0.5">클릭하여 파일 선택 · 데모: 분석 실행에서 샘플로 실행 가능</p>
                        </div>
                      </>
                    )}
                  </label>
                  {uploadParseError && (
                    <p className="mt-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2" role="alert">
                      {uploadParseError}
                    </p>
                  )}
                </div>
              </div>
            </section>

            {/* 하단: MES 분석 템플릿 추천 */}
            {uploadTemplateRecommendations.length > 0 && (
              <section className="bg-white rounded-xl border border-indigo-100 shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-100">
                  <div className="flex items-center gap-2 mb-3">
                    <Layers className="w-4 h-4 text-indigo-600 shrink-0" />
                    <div>
                      <h3 className="text-sm font-bold text-slate-800">MES 분석 템플릿 추천</h3>
                      <p className="text-[11px] text-slate-500 mt-0.5">업로드된 데이터 구조와 선택한 산업 특성을 분석하여 가장 적합한 분석 템플릿을 추천합니다. 전체 분석 실행 후 더 정확한 결과를 확인할 수 있습니다.</p>
                    </div>
                  </div>
                  {/* 추천 방식 단계 */}
                  <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                    <span className="font-semibold text-slate-500">추천 방식</span>
                    <ChevronRight className="w-3 h-3 text-slate-300" />
                    <span className="inline-flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-full px-2.5 py-1 text-slate-600">
                      <span className="w-4 h-4 rounded-full bg-indigo-600 text-white text-[9px] font-bold flex items-center justify-center shrink-0">1</span>
                      데이터 항목 분석
                    </span>
                    <ChevronRight className="w-3 h-3 text-slate-300" />
                    <span className="inline-flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-full px-2.5 py-1 text-slate-600">
                      <span className="w-4 h-4 rounded-full bg-indigo-600 text-white text-[9px] font-bold flex items-center justify-center shrink-0">2</span>
                      산업 특성 반영
                    </span>
                    <ChevronRight className="w-3 h-3 text-slate-300" />
                    <span className="inline-flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-full px-2.5 py-1 text-slate-600">
                      <span className="w-4 h-4 rounded-full bg-indigo-600 text-white text-[9px] font-bold flex items-center justify-center shrink-0">3</span>
                      데이터 구조 파악
                    </span>
                    <ChevronRight className="w-3 h-3 text-slate-300" />
                    <span className="inline-flex items-center gap-1 bg-indigo-50 border border-indigo-200 rounded-full px-2.5 py-1 text-indigo-700 font-semibold">
                      <span className="w-4 h-4 rounded-full bg-indigo-600 text-white text-[9px] font-bold flex items-center justify-center shrink-0">4</span>
                      최적 템플릿 선별
                    </span>
                    <span className="ml-1 text-slate-400">· 산업 선택 변경 시 자동 재계산</span>
                  </div>
                </div>

                {/* 데이터 수준 안내 */}
                {uploadIsa95Warning && (
                  <div className="px-5 py-3 border-b border-amber-100 bg-amber-50/70 flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs font-semibold text-amber-700">데이터 수준 안내</p>
                      <p className="text-[11px] text-amber-600 mt-0.5 leading-relaxed">{uploadIsa95Warning}</p>
                    </div>
                  </div>
                )}

                {(() => {
                  const maxScore = Math.max(...uploadTemplateRecommendations.map((r) => r.score), 0.001);
                  const FN_SHORT_KO: Record<string, string> = {
                    F001: 'WIP 추적', F002: '공정 품질관리', F003: '예지 보전',
                    F004: '동적 일정 관리', F005: '이력 추적', F006: '불량 관리',
                    F007: '생산 오더 관리', F008: '보전 계획', F009: '자재 추적',
                  };
                  return (
                    <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-slate-100">
                      {uploadTemplateRecommendations.map(({ template, score, matchedFunctionIds, coverageScore, coverageDetail }, idx) => {
                        const relatedFns = template.recommendedFunctionIds
                          .map((fid) => MES_ONTOLOGY.find((f) => f.id === fid))
                          .filter(Boolean);
                        const normalizedScore = Math.min(score / maxScore, 1);
                        const suitabilityPct = Math.round((normalizedScore * 0.6 + coverageScore * 0.4) * 100);
                        const suitabilityDots = suitabilityPct >= 65 ? 3 : suitabilityPct >= 40 ? 2 : 1;
                        const suitabilityLabel = suitabilityPct >= 65 ? '적합' : suitabilityPct >= 40 ? '보통' : '참고';
                        const suitabilityTextCls = suitabilityPct >= 65 ? 'text-indigo-600' : suitabilityPct >= 40 ? 'text-amber-600' : 'text-slate-500';
                        const suitabilitySegCls = suitabilityPct >= 65 ? 'bg-indigo-500' : suitabilityPct >= 40 ? 'bg-amber-400' : 'bg-slate-400';
                        const coveragePct = Math.round(coverageScore * 100);
                        const coverageBarCls = coveragePct >= 75 ? 'bg-emerald-400' : coveragePct >= 50 ? 'bg-amber-400' : 'bg-rose-400';
                        const coverageTextCls = coveragePct >= 75 ? 'text-emerald-600' : coveragePct >= 50 ? 'text-amber-600' : 'text-rose-600';
                        return (
                          <div key={template.id} className="px-5 py-5 flex flex-col gap-3 hover:bg-slate-50 transition-colors">
                            {/* 순위 + 적합도 게이지 */}
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2 min-w-0">
                                <div className={`shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                                  idx === 0 ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500'
                                }`}>
                                  {idx + 1}
                                </div>
                                <span className="text-sm font-semibold text-slate-800 leading-snug truncate">{template.name}</span>
                              </div>
                              <div className="flex items-center gap-1.5 shrink-0 ml-2">
                                <div className="flex gap-0.5">
                                  {[0, 1, 2].map((i) => (
                                    <div key={i} className={`w-3 h-2 rounded-sm ${i < suitabilityDots ? suitabilitySegCls : 'bg-slate-100'}`} />
                                  ))}
                                </div>
                                <span className={`text-[10px] font-semibold ${suitabilityTextCls}`}>{suitabilityLabel}</span>
                              </div>
                            </div>

                            {/* 관련 MES 기능 뱃지 */}
                            <div className="flex flex-wrap gap-1">
                              {relatedFns.map((fn) => fn && (
                                <span
                                  key={fn.id}
                                  className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${
                                    matchedFunctionIds.includes(fn.id)
                                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                      : 'bg-slate-50 text-slate-500 border-slate-200'
                                  }`}
                                >
                                  {FN_SHORT_KO[fn.id] ?? fn.id}
                                  {matchedFunctionIds.includes(fn.id) && ' ✓'}
                                </span>
                              ))}
                            </div>

                            {template.summary && (
                              <p className="text-xs text-slate-500 leading-relaxed">{template.summary}</p>
                            )}

                            {/* 데이터 유사도 */}
                            {coverageDetail.total > 0 && (
                              <div>
                                <div className="flex items-center justify-between mb-1">
                                  <span className="flex items-center gap-1">
                                    <span className="text-[10px] text-slate-500">데이터 유사도</span>
                                    <span className="relative group inline-flex">
                                      <span className="w-3.5 h-3.5 rounded-full bg-slate-200 text-slate-500 text-[9px] font-bold flex items-center justify-center cursor-help leading-none select-none">?</span>
                                      <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-60 text-[10px] text-slate-600 bg-white border border-slate-200 rounded-md shadow-lg px-2.5 py-2 leading-relaxed z-20 hidden group-hover:block pointer-events-none whitespace-normal">
                                        <span className="font-semibold text-slate-700 block mb-1">유사도 산출 기준</span>
                                        <span className="block">① 컬럼명 키워드 매칭 — 센서·품질·이력 등 MES 관련 키워드 일치 수</span>
                                        <span className="block">② 산업 컨텍스트 — 선택 산업의 주요 기능에 가중치 부여</span>
                                        <span className="block">③ 데이터 타입 패턴 — 수치형·범주형·타임스탬프 비율 반영</span>
                                        <span className="block">④ 핵심 항목 커버리지 — 기능별 필수 컬럼 보유 비율</span>
                                      </span>
                                    </span>
                                  </span>
                                  <span className={`text-[10px] font-semibold ${coverageTextCls}`}>{coveragePct}%</span>
                                </div>
                                <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                  <div
                                    className={`h-full rounded-full ${coverageBarCls} transition-all`}
                                    style={{ width: `${coveragePct}%` }}
                                  />
                                </div>
                                {coverageDetail.missing.length > 0 && (
                                  <p className="text-[10px] text-slate-400 mt-1 leading-relaxed">
                                    보강하면 좋을 항목: {coverageDetail.missing.join(' · ')}
                                  </p>
                                )}
                              </div>
                            )}

                            <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-500">
                              {template.modelName && template.modelName !== '-' && (
                                <span><span className="font-medium text-slate-700">모델</span> {template.modelName}</span>
                              )}
                              {template.modelPerformance?.accuracy != null && (
                                <span><span className="font-medium text-slate-700">정확도</span> {(template.modelPerformance.accuracy * 100).toFixed(1)}%</span>
                              )}
                              {template.modelPerformance?.rmse != null && (
                                <span><span className="font-medium text-slate-700">RMSE</span> {template.modelPerformance.rmse}</span>
                              )}
                            </div>
                            {template.preprocessingMethods && template.preprocessingMethods.length > 0 && (
                              <div>
                                <p className="text-[10px] font-semibold text-slate-500 mb-1">전처리</p>
                                <div className="flex flex-wrap gap-1">
                                  {template.preprocessingMethods.slice(0, 4).map((m) => (
                                    <span key={m} className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">
                                      {m}
                                    </span>
                                  ))}
                                  {template.preprocessingMethods.length > 4 && (
                                    <span className="text-[10px] text-slate-400">+{template.preprocessingMethods.length - 4}</span>
                                  )}
                                </div>
                              </div>
                            )}
                            {template.visualizationMethods && template.visualizationMethods.length > 0 && (
                              <div>
                                <p className="text-[10px] font-semibold text-slate-500 mb-1">시각화</p>
                                <div className="flex flex-wrap gap-1">
                                  {template.visualizationMethods.slice(0, 4).map((v) => (
                                    <span key={v} className="text-[10px] bg-indigo-50 text-indigo-600 border border-indigo-100 px-1.5 py-0.5 rounded">
                                      {v}
                                    </span>
                                  ))}
                                  {template.visualizationMethods.length > 4 && (
                                    <span className="text-[10px] text-slate-400">+{template.visualizationMethods.length - 4}</span>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}

                <div className="px-5 py-3 bg-slate-50 border-t border-slate-100">
                  <p className="text-[10px] text-slate-400">
                    전체 분석 템플릿 목록은 <button type="button" onClick={() => setCurrentNav('ontology')} className="text-indigo-600 font-semibold hover:underline">Standard MES Ontology</button> 탭에서 확인하세요.
                  </p>
                </div>

                {/* 분석 구조 맵 */}
                <div className="border-t border-slate-100">
                  <div className="px-5 py-3 flex items-center gap-2">
                    <Workflow className="w-4 h-4 text-indigo-500 shrink-0" />
                    <div>
                      <span className="text-sm font-bold text-slate-800">분석 구조 맵</span>
                      <span className="ml-2 text-[11px] text-slate-500">데이터와 연결된 분석 기능(파란 테두리)과 추천 템플릿(보라 테두리)을 그래프로 확인합니다.</span>
                    </div>
                  </div>
                  <div className="px-5 pb-5">
                    <OntologyGraph
                      height={480}
                      highlightedIds={
                        Array.from(new Set(uploadTemplateRecommendations.flatMap((r) => r.matchedFunctionIds)))
                      }
                      templates={uploadTemplateRecommendations.map((r) => r.template)}
                    />
                  </div>
                </div>
              </section>
            )}

            {/* 파일 미업로드 시 안내 */}
            {!uploadedProcessFile && (
              <section className="bg-slate-50 rounded-xl border border-dashed border-slate-200 px-5 py-10 text-center">
                <Layers className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="text-xs font-semibold text-slate-500">파일을 업로드하면</p>
                <p className="text-[11px] text-slate-400 mt-1">데이터 컬럼을 온톨로지와 자동 매칭하여 참조 템플릿을 추천해 드립니다.</p>
              </section>
            )}
          </div>
        )}

        {/* 1.5 전처리 & 증강 */}
        {currentNav === 'preprocess' && (
          <div key="preprocess" className="p-4 sm:p-6 lg:p-8">
            <h1 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">
              <SlidersHorizontal className="w-5 h-5 text-indigo-600" />
              전처리 &amp; 증강
            </h1>

            {/* ── 1. 전처리 설정 컨트롤 바 ── */}
            <section className="mb-4 bg-white rounded-xl border border-slate-200 shadow-sm">
              {/* compact bar - 항상 표시 */}
              <div className="px-4 py-3 flex items-center gap-2 flex-wrap">
                <span className="text-xs font-bold text-slate-600 flex items-center gap-1.5 mr-1 shrink-0">
                  <SlidersHorizontal className="w-3.5 h-3.5 text-indigo-500" />설정
                </span>
                <select
                  value={preprocConfig.missingStrategy}
                  onChange={(e) => setPreprocConfig((c) => ({ ...c, missingStrategy: e.target.value as PreprocConfig['missingStrategy'] }))}
                  className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-slate-50 text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-400 cursor-pointer"
                >
                  <option value="mean">결측치: 평균값</option>
                  <option value="median">결측치: 중앙값</option>
                  <option value="drop">결측치: 행 제거</option>
                  <option value="zero">결측치: 0 대체</option>
                </select>
                <select
                  value={preprocConfig.outlierMethod}
                  onChange={(e) => setPreprocConfig((c) => ({ ...c, outlierMethod: e.target.value as PreprocConfig['outlierMethod'] }))}
                  className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-slate-50 text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-400 cursor-pointer"
                >
                  <option value="iqr">이상치: IQR</option>
                  <option value="zscore">이상치: Z-Score</option>
                  <option value="none">이상치: 처리 안 함</option>
                </select>
                <select
                  value={preprocConfig.scalingMethod}
                  onChange={(e) => setPreprocConfig((c) => ({ ...c, scalingMethod: e.target.value as PreprocConfig['scalingMethod'] }))}
                  className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-slate-50 text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-400 cursor-pointer"
                >
                  <option value="standard">스케일: Standard</option>
                  <option value="minmax">스케일: MinMax</option>
                  <option value="robust">스케일: Robust</option>
                  <option value="none">스케일: 없음</option>
                </select>
                <div className="w-px h-4 bg-slate-200 mx-0.5 shrink-0" />
                <label className="flex items-center gap-1.5 cursor-pointer shrink-0">
                  <button
                    type="button"
                    role="switch"
                    aria-checked={preprocConfig.smoteEnabled}
                    onClick={() => setPreprocConfig((c) => ({ ...c, smoteEnabled: !c.smoteEnabled }))}
                    className={`relative w-8 h-4 rounded-full transition-colors shrink-0 ${preprocConfig.smoteEnabled ? 'bg-indigo-600' : 'bg-slate-300'}`}
                  >
                    <span className={`absolute top-0.5 left-0.5 w-3 h-3 bg-white rounded-full shadow transition-transform ${preprocConfig.smoteEnabled ? 'translate-x-4' : 'translate-x-0'}`} />
                  </button>
                  <span className="text-xs text-slate-600 font-medium">SMOTE</span>
                </label>
                <div className="ml-auto flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => { setPreprocCompleted(true); setCurrentNav('run'); }}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-emerald-600 text-white hover:bg-emerald-700"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    전처리 완료 → 분석 실행
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreprocSettingsExpanded((v) => !v)}
                    className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50"
                  >
                    {preprocSettingsExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                    고급 설정
                  </button>
                </div>
              </div>

              {/* 고급 설정 - 펼쳐질 때만 */}
              {preprocSettingsExpanded && (
                <div className="border-t border-slate-100 px-4 py-4 grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
                  <div>
                    <p className="text-xs font-semibold text-slate-600 mb-2">피처 엔지니어링 (다중 선택)</p>
                    <div className="space-y-1.5">
                      {([
                        { value: 'polynomial', label: '다항식 특성', desc: '2차 교호 항 추가' },
                        { value: 'log', label: '로그 변환', desc: '양수 특성에 log(x+1) 적용' },
                        { value: 'timediff', label: '시간 차분', desc: '시계열 데이터의 변화량 추가' },
                      ] as { value: 'polynomial' | 'log' | 'timediff'; label: string; desc: string }[]).map((opt) => (
                        <label
                          key={opt.value}
                          className={`flex items-center gap-2.5 p-2 rounded-lg border cursor-pointer transition-colors ${
                            preprocConfig.featureEngineering.includes(opt.value)
                              ? 'border-indigo-400 bg-indigo-50'
                              : 'border-slate-200 bg-slate-50 hover:bg-slate-100'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={preprocConfig.featureEngineering.includes(opt.value)}
                            onChange={(e) =>
                              setPreprocConfig((c) => ({
                                ...c,
                                featureEngineering: e.target.checked
                                  ? [...c.featureEngineering, opt.value]
                                  : c.featureEngineering.filter((x) => x !== opt.value),
                              }))
                            }
                            className="w-3.5 h-3.5 rounded accent-indigo-600 shrink-0"
                          />
                          <div className="min-w-0">
                            <span className="text-xs font-semibold text-slate-700">{opt.label}</span>
                            <span className="text-[10px] text-slate-400 ml-1.5">{opt.desc}</span>
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-slate-600 mb-2 flex items-center gap-1">
                      <Shuffle className="w-3.5 h-3.5 text-indigo-500" />SMOTE 상세 설정
                    </p>
                    {preprocConfig.smoteEnabled ? (
                      <div className="space-y-3">
                        <div>
                          <p className="text-[10px] text-slate-500 mb-1">K 이웃 수: <span className="font-bold text-indigo-600">{preprocConfig.smoteK}</span></p>
                          <input
                            type="range"
                            min={1}
                            max={10}
                            value={preprocConfig.smoteK}
                            onChange={(e) => setPreprocConfig((c) => ({ ...c, smoteK: Number(e.target.value) }))}
                            className="w-full accent-indigo-600 h-1.5"
                          />
                          <div className="flex justify-between text-[9px] text-slate-400 mt-0.5">
                            <span>1 (빠름)</span><span>10 (정밀)</span>
                          </div>
                        </div>
                        <div className="space-y-1">
                          {([
                            { value: 'auto', label: 'auto', desc: '소수 클래스 → 다수 클래스 수만큼' },
                            { value: 'minority', label: 'minority', desc: '가장 소수인 클래스만' },
                            { value: 'not_majority', label: 'not majority', desc: '다수 제외 모든 클래스' },
                          ] as { value: PreprocConfig['smoteStrategy']; label: string; desc: string }[]).map((opt) => (
                            <label
                              key={opt.value}
                              className={`flex items-center gap-2 p-1.5 rounded-lg border cursor-pointer transition-colors ${
                                preprocConfig.smoteStrategy === opt.value
                                  ? 'border-indigo-400 bg-indigo-50'
                                  : 'border-slate-200 bg-slate-50 hover:bg-slate-100'
                              }`}
                            >
                              <input
                                type="radio"
                                name="smoteStrategy"
                                value={opt.value}
                                checked={preprocConfig.smoteStrategy === opt.value}
                                onChange={() => setPreprocConfig((c) => ({ ...c, smoteStrategy: opt.value }))}
                                className="w-3.5 h-3.5 accent-indigo-600 shrink-0"
                              />
                              <span className="text-[10px] font-mono font-semibold text-slate-700">{opt.label}</span>
                              <span className="text-[9px] text-slate-400 truncate">{opt.desc}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-center">
                        <p className="text-[10px] text-slate-400">SMOTE를 활성화하면 상세 설정이 표시됩니다</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </section>

            {/* ── 2. Before / After 차트 ── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-3">
              <section className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                <p className="text-xs font-bold text-slate-700 mb-1 flex items-center gap-1.5">
                  <BarChart3 className="w-3.5 h-3.5 text-indigo-500" />클래스 분포
                </p>
                <p className="text-[10px] text-slate-400 mb-3">설정 변경 시 즉시 반영 · 시뮬레이션 기반</p>
                <ResponsiveContainer width="100%" height={150}>
                  <BarChart data={preprocChartData.classDistData} barCategoryGap="35%" barGap={3}>
                    <XAxis dataKey="name" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} width={28} />
                    <Tooltip
                      contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #e2e8f0' }}
                      formatter={(v: number, name: string) => [`${v}건`, name === 'before' ? '전처리 전' : '전처리 후']}
                    />
                    <Bar dataKey="before" name="before" fill="#cbd5e1" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="after" name="after" fill="#6366f1" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
                <div className="flex items-center gap-3 mt-1 justify-center">
                  <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-slate-300 inline-block" /><span className="text-[10px] text-slate-500">전처리 전</span></span>
                  <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-indigo-500 inline-block" /><span className="text-[10px] text-slate-500">전처리 후</span></span>
                </div>
              </section>
              <section className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                <p className="text-xs font-bold text-slate-700 mb-1 flex items-center gap-1.5">
                  <BarChart3 className="w-3.5 h-3.5 text-emerald-500" />데이터 품질 지표
                </p>
                <p className="text-[10px] text-slate-400 mb-3">결측치·이상치 처리 효과</p>
                <ResponsiveContainer width="100%" height={150}>
                  <BarChart data={preprocChartData.qualityData} barCategoryGap="35%" barGap={3}>
                    <XAxis dataKey="name" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} width={28} />
                    <Tooltip
                      contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #e2e8f0' }}
                      formatter={(v: number, name: string) => [v, name === 'before' ? '전처리 전' : '전처리 후']}
                    />
                    <Bar dataKey="before" name="before" fill="#fca5a5" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="after" name="after" fill="#86efac" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
                <div className="flex items-center gap-3 mt-1 justify-center">
                  <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-red-300 inline-block" /><span className="text-[10px] text-slate-500">전처리 전</span></span>
                  <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-green-300 inline-block" /><span className="text-[10px] text-slate-500">전처리 후</span></span>
                </div>
              </section>
            </div>

            {/* 레코드 수 요약 */}
            <div className="flex items-center gap-3 mb-4 bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
              <div className="flex-1 p-2 rounded-lg bg-slate-50 border border-slate-200 text-center">
                <p className="text-[10px] text-slate-500 mb-0.5">원본 데이터</p>
                <p className="text-sm font-bold text-slate-800">{preprocChartData.baseCount.toLocaleString()}건</p>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-300 shrink-0" />
              <div className={`flex-1 p-2 rounded-lg border text-center ${preprocChartData.afterCount > preprocChartData.baseCount ? 'bg-indigo-50 border-indigo-200' : 'bg-slate-50 border-slate-200'}`}>
                <p className="text-[10px] text-slate-500 mb-0.5">전처리 후</p>
                <p className={`text-sm font-bold ${preprocChartData.afterCount > preprocChartData.baseCount ? 'text-indigo-700' : 'text-slate-800'}`}>
                  {preprocChartData.afterCount.toLocaleString()}건
                </p>
                {preprocChartData.afterCount > preprocChartData.baseCount && (
                  <p className="text-[9px] text-indigo-500 mt-0.5">
                    +{(preprocChartData.afterCount - preprocChartData.baseCount).toLocaleString()} (SMOTE)
                  </p>
                )}
              </div>
            </div>

            {/* ── 3. Before / After 데이터 샘플 ── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
              {/* Before: 원본 데이터 */}
              <section className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
                  <h2 className="text-xs font-bold text-slate-700 flex items-center gap-2">
                    <FileText className="w-3.5 h-3.5 text-slate-400" />
                    원본 데이터 샘플
                  </h2>
                  {dataPreview && (
                    <span className="text-[10px] text-slate-400 bg-slate-50 px-2 py-0.5 rounded-full border border-slate-200">
                      첫 5행 · {dataPreview.headers.length}개 컬럼
                    </span>
                  )}
                </div>
                {dataPreview ? (
                  <>
                    <div className="overflow-x-auto">
                      <table className="min-w-full text-xs">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-100">
                            <th className="px-3 py-2 text-slate-300 font-semibold text-center w-8 shrink-0">#</th>
                            {dataPreview.headers.map((h, i) => (
                              <th
                                key={i}
                                className={`px-3 py-2 text-left font-semibold whitespace-nowrap ${
                                  i === dataPreview.headers.length - 1
                                    ? 'text-indigo-600 bg-indigo-50/60'
                                    : 'text-slate-600'
                                }`}
                              >
                                {h}
                                {i === dataPreview.headers.length - 1 && (
                                  <span className="ml-1 text-[9px] font-normal text-indigo-400">target</span>
                                )}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {dataPreview.rows.map((row, ri) => (
                            <tr key={ri} className={`border-b border-slate-50 ${ri % 2 === 0 ? 'bg-white' : 'bg-slate-50/40'}`}>
                              <td className="px-3 py-1.5 text-slate-300 font-mono text-center">{ri + 1}</td>
                              {row.map((cell, ci) => {
                                const isTarget = ci === row.length - 1;
                                const isNonNumeric = cell !== '' && Number.isNaN(Number(cell));
                                return (
                                  <td
                                    key={ci}
                                    className={`px-3 py-1.5 whitespace-nowrap font-mono ${
                                      isTarget
                                        ? 'font-semibold text-indigo-600 bg-indigo-50/30'
                                        : isNonNumeric
                                        ? 'text-amber-600'
                                        : 'text-slate-700'
                                    }`}
                                  >
                                    {cell}
                                  </td>
                                );
                              })}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div className="px-4 py-2 bg-slate-50 border-t border-slate-100 flex items-center gap-4 flex-wrap">
                      <span className="flex items-center gap-1.5 text-[10px] text-slate-400">
                        <span className="w-2 h-2 rounded-sm bg-indigo-200 inline-block" />마지막 컬럼 = 타깃
                      </span>
                      <span className="flex items-center gap-1.5 text-[10px] text-slate-400">
                        <span className="w-2 h-2 rounded-sm bg-amber-200 inline-block" />문자열 → 자동 인코딩
                      </span>
                    </div>
                  </>
                ) : (
                  <div className="py-8 text-center">
                    <Upload className="w-8 h-8 mx-auto mb-2 text-slate-200" />
                    <p className="text-xs text-slate-400 mb-1">데이터 준비 탭에서 파일을 업로드하면 샘플 데이터가 표시됩니다</p>
                    <button
                      type="button"
                      onClick={() => setCurrentNav('data')}
                      className="mt-1 text-xs font-semibold text-indigo-600 hover:text-indigo-700"
                    >
                      데이터 준비 탭으로 이동 →
                    </button>
                  </div>
                )}
              </section>

              {/* After: 전처리 후 시뮬레이션 */}
              <section className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
                  <h2 className="text-xs font-bold text-slate-700 flex items-center gap-2">
                    <Zap className="w-3.5 h-3.5 text-indigo-500" />
                    전처리 후 (시뮬레이션)
                  </h2>
                  <span className="text-[10px] text-indigo-500 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-200">
                    설정 연동
                  </span>
                </div>
                {preprocAfterSample ? (
                  <>
                    <div className="overflow-x-auto">
                      <table className="min-w-full text-xs">
                        <thead>
                          <tr className="bg-indigo-50/50 border-b border-slate-100">
                            <th className="px-3 py-2 text-slate-300 font-semibold text-center w-8 shrink-0">#</th>
                            {preprocAfterSample.headers.map((h, i) => (
                              <th
                                key={i}
                                className={`px-3 py-2 text-left font-semibold whitespace-nowrap ${
                                  i === preprocAfterSample.headers.length - 1
                                    ? 'text-indigo-600 bg-indigo-50/60'
                                    : 'text-slate-600'
                                }`}
                              >
                                {h}
                                {i === preprocAfterSample.headers.length - 1 && (
                                  <span className="ml-1 text-[9px] font-normal text-indigo-400">encoded</span>
                                )}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {preprocAfterSample.rows.map((row, ri) => (
                            <tr key={ri} className={`border-b border-slate-50 ${ri % 2 === 0 ? 'bg-white' : 'bg-indigo-50/20'}`}>
                              <td className="px-3 py-1.5 text-slate-300 font-mono text-center">{ri + 1}</td>
                              {row.map((cell, ci) => {
                                const origCell = dataPreview!.rows[ri]?.[ci] ?? '';
                                const isTarget = ci === row.length - 1;
                                const wasEncoded = isTarget && origCell !== '' && Number.isNaN(Number(origCell)) && cell !== origCell;
                                const wasFilled = !isTarget && origCell === '' && cell !== '';
                                return (
                                  <td
                                    key={ci}
                                    className={`px-3 py-1.5 whitespace-nowrap font-mono ${
                                      isTarget
                                        ? 'font-semibold text-indigo-600 bg-indigo-50/30'
                                        : wasEncoded || wasFilled
                                        ? 'text-emerald-600 font-semibold'
                                        : 'text-slate-700'
                                    }`}
                                  >
                                    {cell}
                                    {wasEncoded && <span className="ml-1 text-[8px] text-indigo-400 font-sans">[enc]</span>}
                                    {wasFilled && <span className="ml-1 text-[8px] text-emerald-400 font-sans">[fill]</span>}
                                  </td>
                                );
                              })}
                            </tr>
                          ))}
                          {preprocConfig.smoteEnabled && (
                            <tr className="bg-indigo-50/40 border-t border-indigo-100">
                              <td colSpan={preprocAfterSample.headers.length + 1} className="px-3 py-2 text-[10px] text-indigo-500 font-semibold text-center">
                                + {(preprocChartData.afterCount - preprocChartData.baseCount).toLocaleString()}행 합성 (SMOTE 시뮬레이션)
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                    <div className="px-4 py-2 bg-indigo-50/30 border-t border-slate-100 flex items-center gap-4 flex-wrap">
                      <span className="flex items-center gap-1.5 text-[10px] text-slate-400">
                        <span className="w-2 h-2 rounded-sm bg-emerald-200 inline-block" />변환된 값
                      </span>
                      <span className="flex items-center gap-1.5 text-[10px] text-slate-400">
                        <span className="w-2 h-2 rounded-sm bg-indigo-200 inline-block" />타깃 인코딩
                      </span>
                      <span className="ml-auto text-[9px] text-slate-400">시뮬레이션 기반 · 실제 결과와 다를 수 있음</span>
                    </div>
                  </>
                ) : (
                  <div className="py-8 text-center">
                    <Zap className="w-8 h-8 mx-auto mb-2 text-slate-200" />
                    <p className="text-xs text-slate-400">원본 데이터를 업로드하면 전처리 후 예상 결과가 표시됩니다</p>
                  </div>
                )}
              </section>
            </div>

            {/* 전처리 설정 완료 요약 */}
            {preprocCompleted && (
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-start gap-3">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <div className="space-y-1 text-[10px] text-emerald-700 min-w-0">
                  <p className="text-xs font-bold text-emerald-700 mb-1">전처리 설정 완료</p>
                  <p>
                    결측치: {{ mean: '평균값 대체', median: '중앙값 대체', drop: '행 제거', zero: '0 대체' }[preprocConfig.missingStrategy]}
                    {' · '}이상치: {{ iqr: 'IQR 클리핑', zscore: 'Z-Score 제거', none: '처리 안 함' }[preprocConfig.outlierMethod]}
                  </p>
                  <p>
                    스케일링: {{ standard: 'StandardScaler', minmax: 'MinMaxScaler', robust: 'RobustScaler', none: '없음' }[preprocConfig.scalingMethod]}
                    {preprocConfig.featureEngineering.length > 0 && ` · 피처 엔지니어링: ${preprocConfig.featureEngineering.join(', ')}`}
                  </p>
                  <p>SMOTE: {preprocConfig.smoteEnabled ? `활성화 (k=${preprocConfig.smoteK}, ${preprocConfig.smoteStrategy})` : '비활성화'}</p>
                </div>
              </div>
            )}
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
                전처리 &amp; 증강에서 설정한 파이프라인을 실행합니다. 완료 후 결과 메뉴로 자동 이동합니다.
              </p>
              {preprocCompleted && (
                <div className="mb-4 p-2.5 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span className="text-[10px] text-emerald-700 font-medium">전처리 설정 적용됨 (SMOTE: {preprocConfig.smoteEnabled ? '활성화' : '비활성화'})</span>
                </div>
              )}
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
