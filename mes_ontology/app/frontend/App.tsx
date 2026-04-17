import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  ResponsiveContainer,
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  BarChart,
  Bar,
  LineChart,
  Line,
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  Cell,
  AreaChart,
  Area,
  ComposedChart,
  CartesianGrid,
  ReferenceLine,
  PieChart,
  Pie,
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
  HelpCircle,
} from 'lucide-react';
import DashboardHeader from './components/DashboardHeader';
import AppSidebar, { type NavId } from './components/AppSidebar';
import OntologyVisualizer from './components/OntologyVisualizer';
import OntologyGraph from './components/OntologyGraph';
import OntologyNodeDetailPanel from './components/OntologyNodeDetailPanel';
import { OntologyGraphHelpTip } from './components/OntologyGraphHelpTip';
import {
  AugmentationSuggestionItem,
  IndustryType,
  DataProfile,
  MatchingResult,
  type OntologySelectedNode,
  type ResultTemplate,
} from './types';
import { buildColumnExplorationPreview } from './utils/preprocPreview';

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
    case IndustryType.ELECTRICAL:
      return {
        ...base,
        features: ['Vibration', 'Temperature', 'Pressure', 'Sensor', 'State'],
        recordsCount: 9400,
      };
    case IndustryType.HEAVY_INDUSTRY:
      return {
        ...base,
        features: ['Torque', 'Vibration', 'Sensor', 'State', 'Temperature'],
        recordsCount: 11200,
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
import { automlFit, AUTOML_FETCH_FAILED_MESSAGE, getMockAutomlResult, type AutoMLFitResult } from './services/backendApi';
import { parseCsvForAutoml } from './utils/csvParser';
import { stripLatinAcronymParentheses } from './utils/displayLabels';
import {
  MES_ONTOLOGY,
  MES_FUNCTION_SHORT_LABEL_KO,
  REFERENCE_TEMPLATES,
  PIPELINE_STEPS,
  PIPELINE_STEPS_KO,
  PRIORITY_RECOMMENDATION_TITLE_KO,
  PRIORITY_RECOMMENDATION_DESCRIPTION_KO,
} from './constants';

const TOTAL_STEPS = 4;
const stepLabelKo = ['데이터 프로파일링', 'AutoML 모델링', '온톨로지 매칭', '전략 제안'];

/** AutoML `aux_scoring` 필드 → 표시 라벨 */
function automlAuxScoringLabel(auxScoring?: string | null): string | null {
  if (!auxScoring) return null;
  if (auxScoring === 'f1_weighted') return 'F1 (weighted)';
  if (auxScoring === 'neg_mean_absolute_error') return 'MAE';
  return auxScoring;
}

/** AutoML 주 scoring 필드 → 표시 라벨 */
function automlPrimaryScoringLabel(scoring?: string | null): string {
  if (scoring === 'accuracy') return 'Accuracy';
  if (scoring === 'r2') return 'R²';
  return scoring && scoring.length > 0 ? scoring : 'Score';
}

/** 보조 지표가 음의 MAE(sklearn)인지 — 정렬·눈금 처리에 사용 */
function isAutomlAuxMae(auxScoring?: string | null): boolean {
  return auxScoring === 'neg_mean_absolute_error';
}

/** 모델 순위 표 `Std (CV)` 열 — 마우스 호버용 설명(CV는 변동계수가 아니라 교차검증) */
const AUTOML_STD_CV_HELP_KO =
  'Std는 표준편차(standard deviation)이고, 여기서 CV는 변동계수가 아니라 교차검증(cross-validation)을 뜻합니다. k개 폴드 각각에서 계산한 주 지표를 퍼센트로 맞춘 뒤, 그 k개 값의 표준편차에 100을 곱해 ±로 보여 줍니다. 숫자가 클수록 폴드마다 점수가 들쭉날쭉해 모델이 덜 안정적일 수 있습니다.';

/** 주 scoring에 대한 한글 도움말(테이블 헤더 title 등) */
function automlPrimaryMetricHelpKo(scoring?: string | null): string {
  if (scoring === 'r2')
    return '결정계수 R²입니다. 회귀에서 타깃 분산을 모델이 얼마나 설명하는지를 0~100%로 표시합니다. 값이 높을수록 적합이 나은 편이나, 과적합이나 편향된 표본에서는 과대평가될 수 있어 잔차·보조 지표와 함께 보는 것이 좋습니다.';
  if (scoring === 'accuracy')
    return '분류 정확도(Accuracy)입니다. 전체 예측 중 맞춘 비율을 0~100%로 나타냅니다. 클래스 비율이 치우치면 수치는 높아도 소수 클래스를 놓칠 수 있으므로 F1 등 다른 지표를 함께 확인하세요.';
  return '교차검증으로 계산한 주 평가 지표 평균입니다. 이 열 기준으로 모델 순위가 정렬됩니다.';
}

/** aux_scoring에 대한 한글 도움말 */
function automlAuxMetricHelpKo(auxScoring?: string | null): string {
  if (auxScoring === 'neg_mean_absolute_error')
    return '평균 절대 오차(MAE)입니다. 예측과 실제 차이의 절댓값 평균으로, 타깃과 같은 단위입니다. 학습기는 sklearn의 neg_mean_absolute_error(음수 MAE)로 최적화하며, 표에는 양수 MAE로 보여 줍니다. 값이 작을수록 좋습니다.';
  if (auxScoring === 'f1_weighted')
    return '가중 F1(F1 weighted)입니다. 클래스별 F1을 표본 비율로 가중한 값으로, 불균형 분류에서 정확도만으로는 보기 어려운 균형 잡힌 성능을 볼 때 유용합니다.';
  return '주 지표와 함께 참고하는 보조 평가 지표입니다.';
}

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
const SIDEBAR_WIDTH_KEY = 'mes-optimizer-sidebar-width';

/** 업로드 미리보기·컬럼 탐색 차트·증강 시뮬에 쓰는 데이터 행 수(헤더 제외). 통계 샘플(500행)과 비슷한 상한입니다. */
const DATA_PREVIEW_MAX_ROWS = 400;

/** 원본·전처리 후 샘플 테이블 본문에 한 번에 보이는 행 수(헤더 제외). 나머지는 세로 스크롤로 확인합니다. */
const SAMPLE_TABLE_VISIBLE_BODY_ROWS = 5;

/** 샘플 테이블 스크롤 영역 max-height: 헤더 행 + 본문 N행(대략 `text-xs`·`py-1.5` 기준) */
const sampleTableBodyScrollMaxHeight = `calc(2.5rem + ${SAMPLE_TABLE_VISIBLE_BODY_ROWS} * 2.25rem)`;

// ─── 전처리 & 증강 설정 ───────────────────────────────────────────────────────
interface PreprocConfig {
  missingStrategy: 'mean' | 'median' | 'drop' | 'zero';
  outlierMethod: 'iqr' | 'zscore' | 'none';
  scalingMethod: 'standard' | 'minmax' | 'robust' | 'none';
  featureEngineering: ('polynomial' | 'log' | 'timediff')[];
  smoteEnabled: boolean;
  smoteK: number;
  smoteStrategy: 'auto' | 'minority' | 'not_majority';
  timeseriesEnabled: boolean;
  timeseriesStrategy: 'window' | 'jitter';
  timeseriesPreset: 'light' | 'balanced' | 'strong';
  timeseriesApplyProb: number;
  jitterNoiseStdPct: number;
  windowRatio: number;
  strideRatio: number;
  overlapRatio: number;
  timeseriesSeedLock: boolean;
}

const DEFAULT_PREPROC_CONFIG: PreprocConfig = {
  missingStrategy: 'median',
  outlierMethod: 'iqr',
  scalingMethod: 'standard',
  featureEngineering: [],
  smoteEnabled: false,
  smoteK: 5,
  smoteStrategy: 'auto',
  timeseriesEnabled: false,
  timeseriesStrategy: 'window',
  timeseriesPreset: 'balanced',
  timeseriesApplyProb: 0.5,
  jitterNoiseStdPct: 1.0,
  windowRatio: 0.9,
  strideRatio: 0.1,
  overlapRatio: 0.5,
  timeseriesSeedLock: true,
};

/** 시계열 증강 프리셋: 실무에서 자주 쓰는 약/중/강 시작점 */
const TIMESERIES_PRESET_CONFIG: Record<
  PreprocConfig['timeseriesPreset'],
  Pick<
    PreprocConfig,
    'timeseriesApplyProb' | 'jitterNoiseStdPct' | 'windowRatio' | 'strideRatio' | 'overlapRatio'
  >
> = {
  light: { timeseriesApplyProb: 0.35, jitterNoiseStdPct: 0.7, windowRatio: 0.95, strideRatio: 0.18, overlapRatio: 0.35 },
  balanced: { timeseriesApplyProb: 0.5, jitterNoiseStdPct: 1.0, windowRatio: 0.9, strideRatio: 0.1, overlapRatio: 0.5 },
  strong: { timeseriesApplyProb: 0.7, jitterNoiseStdPct: 1.8, windowRatio: 0.82, strideRatio: 0.06, overlapRatio: 0.7 },
};

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

const PREPROC_STEP_LABELS = ['결측치 / 타입 처리', '스케일링 / 피처 엔지니어링', '증강 (SMOTE / 시계열)'];

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
  if (config.timeseriesEnabled) {
    methods.push(
      `시계열 증강 (${config.timeseriesStrategy === 'window' ? '윈도우 슬라이싱' : 'Jitter'}, ${config.timeseriesPreset})`
    );
  }
  return methods;
}

/**
 * 템플릿의 전처리 문자열 목록을 현재 프론트 `preprocConfig`로 근사 매핑합니다.
 * (모든 템플릿 항목을 1:1로 전부 반영하긴 어렵기 때문에, 지원 가능한 항목 위주로 적용)
 */
function applyTemplateToPreprocConfig(template: ResultTemplate, prev: PreprocConfig): PreprocConfig {
  const methods = template.preprocessingMethods ?? [];
  const has = (re: RegExp) => methods.some((m) => re.test(m));

  const next: PreprocConfig = { ...prev };

  // 결측치
  if (has(/결측.*(제거|행\s*제거)/i)) next.missingStrategy = 'drop';
  else if (has(/0\s*대체/i)) next.missingStrategy = 'zero';
  else if (has(/결측.*(보간|대체)/i)) next.missingStrategy = 'median';

  // 이상치
  if (has(/이상치.*(처리\s*안\s*함|미처리|none)/i)) next.outlierMethod = 'none';
  else if (has(/(z-?score|zscore)/i)) next.outlierMethod = 'zscore';
  else if (has(/iqr/i) || has(/이상치.*제거/i)) next.outlierMethod = 'iqr';

  // 스케일링
  if (has(/StandardScaler/)) next.scalingMethod = 'standard';
  else if (has(/MinMaxScaler/)) next.scalingMethod = 'minmax';
  else if (has(/RobustScaler/)) next.scalingMethod = 'robust';
  else if (has(/스케일.*없음|없음\s*$/i)) next.scalingMethod = 'none';

  // 피처 엔지니어링
  const fe: PreprocConfig['featureEngineering'] = [];
  if (has(/다항식/)) fe.push('polynomial');
  if (has(/로그/)) fe.push('log');
  if (has(/시간\s*차분|차분/i)) fe.push('timediff');
  if (fe.length > 0) next.featureEngineering = fe;

  // 증강(= SMOTE 근사): 클래스 균형/샘플링 검토가 있으면 활성화
  const wantsSmote = has(/클래스\s*균형|SMOTE|샘플링/i);
  if (wantsSmote) {
    next.smoteEnabled = true;
    // 텍스트에 구체 전략이 없으면 minority가 가장 자연스러운 기본값
    if (has(/소수|minority/i)) next.smoteStrategy = 'minority';
    else if (has(/not[_\s-]*majority|not[_\s-]*majority/i)) next.smoteStrategy = 'not_majority';
    else next.smoteStrategy = 'minority';
  } else {
    next.smoteEnabled = false;
  }

  // 시계열 증강: 시간 차분/윈도우/시계열 키워드가 있으면 활성화
  const wantsTimeseries = has(/시계열|윈도우|time\s*series|window|차분/i);
  next.timeseriesEnabled = wantsTimeseries;
  next.timeseriesStrategy = has(/jitter|노이즈/i) ? 'jitter' : 'window';
  next.timeseriesPreset = 'balanced';
  Object.assign(next, TIMESERIES_PRESET_CONFIG.balanced);
  next.timeseriesSeedLock = true;

  return next;
}

/** API 응답에 없을 때 사용할 전처리·시각화 기본값 (UI 블록 항상 표시) */
const DEFAULT_PREPROCESSING_METHODS = ['StandardScaler', '결측치 중앙값 대체', '이상치 IQR 클리핑'];
const DEFAULT_VISUALIZATION_METHODS = ['산점도', '상관관계 행렬', '히트맵'];

/**
 * 백엔드 AutoML이 반환하는 영문 detail 메시지를 사용자용 한국어 안내로 번역.
 * 알려진 패턴이 아니면 null을 돌려줘서 원문 노출(영문) 대신 일반 안내로 폴백한다.
 */
function translateAutomlError(raw: string): string | null {
  const msg = raw.trim();
  if (/each class needs at least \d+ samples/i.test(msg)) {
    return '각 클래스(타깃 라벨)별 샘플이 부족해 분류 모델을 학습할 수 없습니다. 클래스당 최소 2건 이상 필요합니다.';
  }
  if (/at least 2 distinct classes/i.test(msg)) {
    return '타깃 컬럼에 서로 다른 클래스가 2개 이상 있어야 분류 분석이 가능합니다.';
  }
  if (/contains nan|contains inf|nan or inf/i.test(msg)) {
    return '입력 데이터에 결측치(NaN) 또는 무한대 값이 포함되어 있어 모델 학습을 진행할 수 없습니다.';
  }
  if (/too many (samples|rows|features)|exceeds (maximum|limit)/i.test(msg)) {
    return '입력 데이터 크기가 허용 범위를 초과했습니다. 행/열 수를 줄여 다시 시도해 주세요.';
  }
  if (/features and target.*length|length mismatch/i.test(msg)) {
    return '피처와 타깃의 행 수가 일치하지 않습니다. 데이터를 확인해 주세요.';
  }
  if (/same length and at least 2 samples|features must be 2d array/i.test(msg)) {
    return '피처/타깃 형식이 올바르지 않거나 샘플 수가 부족합니다. 피처는 2차원, 타깃은 1차원이며 최소 2건 이상이어야 합니다.';
  }
  if (/must be numeric/i.test(msg)) {
    return '피처/타깃에 숫자가 아닌 값이 포함되어 있어 학습할 수 없습니다.';
  }
  if (/must not contain nan or inf|nan or inf/i.test(msg)) {
    return '피처/타깃에 결측치(NaN) 또는 무한대(Inf) 값이 포함되어 있습니다.';
  }
  // 알 수 없는 영문 메시지는 원문을 그대로 노출하지 않고 일반 안내로 대체
  if (/^[\x00-\x7F]+$/.test(msg)) return null;
  return msg;
}

/**
 * 업로드/미리보기 타깃 특성으로 AutoML task를 결정합니다.
 * - 문자열 라벨 또는 저카디널리티 정수 타깃: classification
 * - 그 외 연속형 수치 타깃: regression
 */
function decideAutomlTask(
  fileClassCounts: Record<string, number> | null,
  dataPreview: { headers: string[]; rows: string[][] } | null,
  selectedLabelColumn: string
): 'classification' | 'regression' {
  if (fileClassCounts !== null) return 'classification';
  if (!dataPreview || dataPreview.rows.length === 0) return 'regression';
  const selectedTargetIdx = dataPreview.headers.indexOf(selectedLabelColumn);
  const targetIdx = selectedTargetIdx >= 0 ? selectedTargetIdx : dataPreview.headers.length - 1;
  const targetValues = dataPreview.rows.map((r) => r[targetIdx]).filter((v) => v !== '');
  if (targetValues.length === 0) return 'regression';
  if (targetValues.some((v) => Number.isNaN(Number(v)))) return 'classification';
  const unique = [...new Set(targetValues)];
  return unique.length >= 2 && unique.length <= 20 && unique.every((v) => Number.isInteger(Number(v)))
    ? 'classification'
    : 'regression';
}

/** 전처리 탭에서 선택한 AutoML 학습 유형. auto는 타깃 패턴으로 분류/회귀를 자동 결정합니다. */
type AutomlTaskMode = 'auto' | 'classification' | 'regression';

/**
 * UI에서 선택한 모드와 데이터 힌트로 최종 AutoML task를 반환합니다.
 * auto일 때만 `decideAutomlTask`를 사용하고, 그 외에는 사용자 지정을 그대로 씁니다.
 */
function resolveAutomlTaskForAnalysis(
  mode: AutomlTaskMode,
  fileClassCounts: Record<string, number> | null,
  dataPreview: { headers: string[]; rows: string[][] } | null,
  selectedLabelColumn: string
): 'classification' | 'regression' {
  if (mode === 'auto') return decideAutomlTask(fileClassCounts, dataPreview, selectedLabelColumn);
  return mode;
}

/** 분류 task일 때 클래스 최소 조건(2개 클래스, 클래스당 2샘플)을 선검증합니다. */
function validateClassificationTarget(target: number[]): string | null {
  const counts = new Map<number, number>();
  for (const value of target) {
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  if (counts.size < 2) {
    return '타깃 컬럼에 서로 다른 클래스가 2개 이상 있어야 분류 분석이 가능합니다.';
  }
  const minCount = Math.min(...Array.from(counts.values()));
  if (minCount < 2) {
    return '각 클래스(타깃 라벨)별 샘플이 부족해 분류 모델을 학습할 수 없습니다. 클래스당 최소 2건 이상 필요합니다.';
  }
  return null;
}

const CHART_PALETTE = ['#6366f1', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6', '#06b6d4', '#f97316', '#84cc16'];

/** 컬럼이 시계열(시간축)인지 헤더명·값 패턴으로 판단 */
function isTimeSeriesColumn(header: string, sampleValues: string[]): boolean {
  if (/^(timestamp|time|date|datetime|ts|시간|날짜|일시|일자|측정일)/i.test(header.trim())) return true;
  const nonEmpty = sampleValues.filter((v) => v !== '');
  if (nonEmpty.length === 0) return false;
  const isoDate = /^\d{4}-\d{2}-\d{2}/;
  const korDate = /^\d{4}[./]\d{2}[./]\d{2}/;
  const unixTs = /^\d{10,13}$/;
  const matched = nonEmpty.filter((v) => isoDate.test(v) || korDate.test(v) || unixTs.test(v)).length;
  return matched / nonEmpty.length >= 0.5;
}

/**
 * 컬럼 탐색 「함께 보기」 기본값: 선택 가능한 수치형 피처 전부.
 * `columnAnalysisData.availableExtraCols` 산출 규칙과 맞춥니다.
 */
function getDefaultColumnExplorationExtraColumns(
  dataPreview: { headers: string[]; rows: string[][] },
  analysisColumn: string,
  xColumn: string,
): string[] {
  const targetIdx = dataPreview.headers.length - 1;
  const colIdx = dataPreview.headers.indexOf(analysisColumn);
  if (colIdx < 0 || targetIdx < 1) return [];

  const timeColIdx = dataPreview.headers.slice(0, targetIdx).findIndex((h, i) =>
    isTimeSeriesColumn(h, dataPreview.rows.map((r) => r[i]))
  );
  const selectedIsTimeSeries = isTimeSeriesColumn(
    analysisColumn,
    dataPreview.rows.map((r) => r[colIdx])
  );
  const hasExternalTimeAxis = timeColIdx >= 0 && timeColIdx !== colIdx;
  const customXColIdx = xColumn && xColumn !== analysisColumn
    ? dataPreview.headers.indexOf(xColumn) : -1;
  const effectiveXColIdx = customXColIdx >= 0 ? customXColIdx
    : hasExternalTimeAxis ? timeColIdx : -1;

  const yVals = dataPreview.rows.map((r) => r[colIdx]).filter((v) => v !== '');
  const isNumeric =
    !selectedIsTimeSeries && yVals.length > 0 && yVals.every((v) => !Number.isNaN(Number(v)));
  const useLineChart = (isNumeric || selectedIsTimeSeries) && (effectiveXColIdx >= 0 || selectedIsTimeSeries);
  if (!useLineChart || !isNumeric) return [];

  return dataPreview.headers.slice(0, targetIdx).filter((h) => {
    if (h === analysisColumn) return false;
    if (h === xColumn) return false;
    const hIdx = dataPreview.headers.indexOf(h);
    if (isTimeSeriesColumn(h, dataPreview.rows.map((r) => r[hIdx]))) return false;
    const vals = dataPreview.rows.map((r) => r[hIdx]).filter((v) => v !== '');
    return vals.length > 0 && vals.every((v) => !Number.isNaN(Number(v)));
  });
}

/**
 * 컬럼 탐색 초기 Y축: `time` 등이 첫 열이어도 비시간·수치 피처를 우선 선택해 라인/함께 보기가 바로 보이게 합니다.
 */
function getDefaultColumnExplorationYColumn(preview: { headers: string[]; rows: string[][] }): string {
  const targetIdx = preview.headers.length - 1;
  if (targetIdx < 1) return preview.headers[0] ?? '';

  const featureHeaders = preview.headers.slice(0, targetIdx);
  const colNumeric = (colIdx: number) => {
    const vals = preview.rows.map((r) => r[colIdx]).filter((v) => v !== '');
    return vals.length > 0 && vals.every((v) => !Number.isNaN(Number(v)));
  };

  const nonTime = featureHeaders.filter((h) => {
    const i = preview.headers.indexOf(h);
    return !isTimeSeriesColumn(h, preview.rows.map((r) => r[i]));
  });
  const pool = nonTime.length > 0 ? nonTime : featureHeaders;

  for (const h of pool) {
    const idx = preview.headers.indexOf(h);
    if (idx >= 0 && colNumeric(idx)) return h;
  }
  return pool[0] ?? preview.headers[0] ?? '';
}

/**
 * 데이터 증강 전/후 시계열 파형에 사용할 수 있는 피처 컬럼(타겟 제외, 비시간·수치만) 목록입니다.
 */
function getEligibleAugmentationWaveColumns(preview: { headers: string[]; rows: string[][] } | null): string[] {
  if (!preview || preview.headers.length < 2) return [];
  const targetIdx = preview.headers.length - 1;
  return preview.headers.slice(0, targetIdx).filter((h) => {
    const hIdx = preview.headers.indexOf(h);
    if (isTimeSeriesColumn(h, preview.rows.map((r) => r[hIdx]))) return false;
    const vals = preview.rows.map((r) => r[hIdx]).filter((v) => v !== '');
    return vals.length > 0 && vals.every((v) => !Number.isNaN(Number(v)));
  });
}

/**
 * 업로드 미리보기에 시계열(시간축) 컬럼이 하나라도 있는지 판별합니다.
 * 타겟(마지막 컬럼)을 제외한 피처 구간만 검사하며, 전처리에서 시간 차분(timediff)을 기본 포함할지 결정할 때 사용합니다.
 */
/**
 * 시계열 증강 미리보기: 레코드 인덱스(X) 축에서 원본 구간 뒤에 증강 구간이 이어지는 시뮬 파형.
 * 실제 시계열 값이 없을 때 참고 UI(원본·샘플 구간 연속 표시)용입니다.
 */
function buildTimeseriesWavePreview(baseCount: number, timeseriesAdded: number, smoteAdded = 0): {
  data: { x: number; 원본: number | null; SMOTE: number | null; 시계열: number | null }[];
  splitX: number;
  yDomain: [number, number];
} {
  const totalAug = Math.max(timeseriesAdded + smoteAdded, 0);
  const total = Math.max(baseCount + totalAug, 1);
  const pts = 220;
  const totalX = Math.max(Math.round(baseCount + totalAug), 1);
  const split =
    total > 0 ? Math.min(pts - 1, Math.max(1, Math.round((pts * baseCount) / total))) : pts;
  const data: { x: number; 원본: number | null; SMOTE: number | null; 시계열: number | null }[] = [];
  let yMin = Infinity;
  let yMax = -Infinity;
  const augPts = Math.max(1, pts - split);
  const smotePts =
    totalAug > 0 ? Math.min(augPts, Math.max(0, Math.round((augPts * smoteAdded) / totalAug))) : 0;
  const pushY = (y: number) => {
    yMin = Math.min(yMin, y);
    yMax = Math.max(yMax, y);
  };
  for (let i = 0; i < pts; i++) {
    const x = Math.round((i / (pts - 1)) * totalX);
    const y = 100 + 48 * Math.sin(i * 0.16) + 14 * Math.sin(i * 0.42);
    if (i < split) {
      data.push({ x, 원본: y, SMOTE: null, 시계열: null });
      pushY(y);
    } else {
      const j = i - split;
      if (j < smotePts && smoteAdded > 0) {
        const ySmote = y + 7 * Math.sin(j * 0.29 + 0.45);
        data.push({ x, 원본: null, SMOTE: ySmote, 시계열: null });
        pushY(ySmote);
      } else {
        const k = Math.max(0, j - smotePts);
        const yTs = y + 10 * Math.sin(k * 0.32 + 0.5);
        data.push({ x, 원본: null, SMOTE: null, 시계열: yTs });
        pushY(yTs);
      }
    }
  }
  const splitX = Math.round((split / (pts - 1)) * totalX);
  const pad = yMax > yMin ? (yMax - yMin) * 0.08 : 12;
  const yDomain: [number, number] = [
    Math.floor(yMin - pad),
    Math.ceil(yMax + pad),
  ];
  return { data, splitX, yDomain };
}

/**
 * 미리보기 샘플 값들 사이를 Catmull–Rom 스플라인으로 잇습니다(점이 2개뿐이면 선형).
 * t는 [0, nums.length - 1] 구간의 연속 인덱스입니다.
 */
function interpolateSamplesCatmullRom(t: number, nums: number[]): number {
  const n = nums.length;
  if (n < 2) return nums[0] ?? 0;
  if (t <= 0) return nums[0];
  if (t >= n - 1) return nums[n - 1];

  const k = Math.floor(t);
  const u = t - k;
  const p0 = nums[Math.max(0, k - 1)];
  const p1 = nums[k];
  const p2 = nums[Math.min(n - 1, k + 1)];
  const p3 = nums[Math.min(n - 1, k + 2)];

  return (
    0.5 *
    (2 * p1 +
      (-p0 + p2) * u +
      (2 * p0 - 5 * p1 + 4 * p2 - p3) * u * u +
      (-p0 + 3 * p1 - 3 * p2 + p3) * u * u * u)
  );
}

/**
 * 컬럼 탐색 라인 차트: 행이 적을 때 시간 문자열(name)·수치열을 선형 보간해 점을 늘립니다.
 * x가 ISO 시간으로 파싱되지 않으면 원본을 그대로 둡니다.
 */
function densifyLineChartPoints(
  data: Record<string, string | number | null>[],
  numericKeys: string[],
  minRowsBeforeSkip = 42,
  stepsBetween = 12,
): Record<string, string | number | null>[] {
  if (data.length < 2 || data.length >= minRowsBeforeSkip) return data;
  const out: Record<string, string | number | null>[] = [];
  for (let i = 0; i < data.length - 1; i++) {
    out.push({ ...data[i] });
    const a = data[i];
    const b = data[i + 1];
    const ta = Date.parse(String(a.name));
    const tb = Date.parse(String(b.name));
    const timeOk = Number.isFinite(ta) && Number.isFinite(tb) && tb > ta;
    if (!timeOk) continue;
    for (let s = 1; s < stepsBetween; s++) {
      const u = s / stepsBetween;
      const tMs = Math.round(ta + u * (tb - ta));
      const row: Record<string, string | number | null> = { ...a, name: new Date(tMs).toISOString() };
      for (const k of numericKeys) {
        const va = typeof a[k] === 'number' ? a[k] : null;
        const vb = typeof b[k] === 'number' ? b[k] : null;
        row[k] = va !== null && vb !== null ? va + u * (vb - va) : null;
      }
      out.push(row);
    }
  }
  out.push({ ...data[data.length - 1] });
  return out;
}

/**
 * 선택 컬럼의 미리보기 값으로 시계열 증강 파형을 구성합니다.
 * 수치형이면 샘플을 스플라인으로 잇은 뒤 전체 인덱스에 매핑하고, 원본·증강 구간에 시각용 리플·지터를 얹습니다.
 * 그 외에는 전역 시뮬 파형으로 폴백합니다.
 */
function buildColumnAugmentationWave(
  columnHeader: string,
  preview: { headers: string[]; rows: string[][] } | null,
  baseCount: number,
  timeseriesAdded: number,
  smoteAdded: number,
  strategy: PreprocConfig['timeseriesStrategy'],
  jitterNoiseStdPct: number,
  windowRatio: number,
  overlapRatio: number,
): {
  data: { x: number; 원본: number | null; SMOTE: number | null; 시계열: number | null }[];
  splitX: number;
  yDomain: [number, number];
  source: 'column_sample' | 'simulated';
} {
  const fallback = () => ({ ...buildTimeseriesWavePreview(baseCount, timeseriesAdded, smoteAdded), source: 'simulated' as const });
  if (!preview || !columnHeader) return fallback();
  const colIdx = preview.headers.indexOf(columnHeader);
  const targetIdx = preview.headers.length - 1;
  if (colIdx < 0 || colIdx >= targetIdx) return fallback();

  const cells = preview.rows.map((r) => r[colIdx] ?? '').filter((v) => v !== '');
  const nums = cells.map((v) => Number(v)).filter((n) => !Number.isNaN(n));
  const isNumericCol = cells.length > 0 && nums.length >= cells.length * 0.6;
  if (!isNumericCol || nums.length < 2) return fallback();

  const totalAug = Math.max(timeseriesAdded + smoteAdded, 0);
  const total = Math.max(baseCount + totalAug, 1);
  const totalX = Math.max(Math.round(baseCount + totalAug), 1);
  const pts = 220;
  const split = Math.min(pts - 1, Math.max(1, Math.round((pts * baseCount) / total)));

  const sampleY = (i: number, len: number) => {
    if (len <= 1) return nums[0];
    const t = (i / (len - 1)) * (nums.length - 1);
    if (nums.length === 2) {
      const lo = Math.floor(t);
      const hi = Math.min(lo + 1, nums.length - 1);
      const f = t - lo;
      return nums[lo] * (1 - f) + nums[hi] * f;
    }
    return interpolateSamplesCatmullRom(t, nums);
  };

  /** 전체 x 인덱스(0…pts-1)에 대해 한 번만 보간 → 원본 끝과 증강 시작이 같은 곡선 위에서 이어짐 */
  const yAlong: number[] = [];
  for (let i = 0; i < pts; i++) {
    yAlong.push(sampleY(i, pts));
  }
  const origSlice = yAlong.slice(0, split);
  let yMin = Math.min(...origSlice);
  let yMax = Math.max(...origSlice);
  const span = yMax > yMin ? yMax - yMin : Math.max(Math.abs(yMax), 1);

  const data: { x: number; 원본: number | null; SMOTE: number | null; 시계열: number | null }[] = [];
  const augPts = Math.max(1, pts - split);
  const smotePts =
    totalAug > 0 ? Math.min(augPts, Math.max(0, Math.round((augPts * smoteAdded) / totalAug))) : 0;
  /** 원본 구간도 시각적으로 곡선처럼 보이도록 미세 리플(증강 경계 몇 점 전에서 0으로 수렴) */
  const origRippleEdge = Math.max(3, Math.min(Math.floor(split * 0.12), 28));
  for (let i = 0; i < pts; i++) {
    const x = Math.round((i / (pts - 1)) * totalX);
    const yBase = yAlong[i];
    if (i < split) {
      const taper = i >= split - origRippleEdge ? (split - 1 - i) / origRippleEdge : 1;
      const ripple =
        taper *
        (span * 0.03 * Math.sin(i * 0.21 + 0.55) + span * 0.015 * Math.sin(i * 0.58 + 1.2));
      const y = yBase + ripple;
      yMin = Math.min(yMin, y);
      yMax = Math.max(yMax, y);
      data.push({ x, 원본: y, SMOTE: null, 시계열: null });
    } else {
      const j = i - split;
      if (j < smotePts && smoteAdded > 0) {
        const smoteAmp = clamp((jitterNoiseStdPct / 100) * 0.6 + 0.01, 0.008, 0.05);
        const ySmote = yBase + span * smoteAmp * Math.sin(j * 0.62 + 0.35);
        yMin = Math.min(yMin, ySmote);
        yMax = Math.max(yMax, ySmote);
        data.push({ x, 원본: null, SMOTE: ySmote, 시계열: null });
      } else {
        const k = Math.max(0, j - smotePts);
        const jitterAmp = clamp(jitterNoiseStdPct / 100, 0.002, 0.04);
        const windowAmp = clamp((1 - windowRatio) * 0.28 + overlapRatio * 0.06, 0.02, 0.14);
        const amp = strategy === 'jitter' ? jitterAmp : windowAmp;
        const yTs = yBase + span * amp * Math.sin(k * 0.85) + span * (amp * 0.45) * Math.sin(k * 0.27 + 1);
        yMin = Math.min(yMin, yTs);
        yMax = Math.max(yMax, yTs);
        data.push({ x, 원본: null, SMOTE: null, 시계열: yTs });
      }
    }
  }
  const splitX = Math.round((split / (pts - 1)) * totalX);
  const pad = yMax > yMin ? (yMax - yMin) * 0.08 : 12;
  const yDomain: [number, number] = [Math.floor(yMin - pad), Math.ceil(yMax + pad)];
  return { data, splitX, yDomain, source: 'column_sample' };
}

function dataPreviewHasTimeColumn(preview: { headers: string[]; rows: string[][] }): boolean {
  if (!preview.headers.length || preview.headers.length < 2) return false;
  const targetIdx = preview.headers.length - 1;
  return preview.headers.slice(0, targetIdx).some((h, i) =>
    isTimeSeriesColumn(h, preview.rows.map((r) => r[i]))
  );
}

/** 전처리 UI: 회색 물음표 + title 툴팁(호버·포커스) */
function PreprocHelpTip({ title: tip }: { title: string }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLSpanElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node | null;
      if (wrapRef.current && target && !wrapRef.current.contains(target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('touchstart', onPointerDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('touchstart', onPointerDown);
    };
  }, [open]);

  return (
    <span ref={wrapRef} className="relative inline-flex shrink-0">
      <button
        type="button"
        tabIndex={0}
        className="inline-flex items-center justify-center rounded-full p-0.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 focus:outline-none focus-visible:ring-1 focus-visible:ring-indigo-400 shrink-0"
        aria-label={`도움말: ${tip}`}
        aria-expanded={open}
        aria-haspopup="dialog"
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen((prev) => !prev);
        }}
      >
        <HelpCircle className="w-3 h-3" strokeWidth={2} aria-hidden />
      </button>
      {open && (
        <span
          role="tooltip"
          className="absolute z-40 left-1/2 -translate-x-1/2 top-[calc(100%+6px)] w-56 rounded-md border border-slate-200 bg-white px-2 py-1.5 text-[10px] text-slate-700 shadow-lg leading-snug"
        >
          {tip}
        </span>
      )}
    </span>
  );
}

type QualityEmptyIcon = React.ComponentType<{ className?: string; strokeWidth?: number; 'aria-hidden'?: boolean }>;

/**
 * 품질 지표 차트에 그릴 수치가 없을 때 Recharts 빈 축 대신 표시하는 안내 블록입니다.
 */
function QualityChartEmptyState({
  icon: Icon,
  title,
  description,
}: {
  icon: QualityEmptyIcon;
  title: string;
  description: string;
}) {
  return (
    <div
      className="min-h-[120px] h-[clamp(120px,20dvh,200px)] flex flex-col items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50/50 text-center px-4"
      role="status"
      aria-live="polite"
    >
      <Icon className="w-7 h-7 text-slate-300 mb-1.5" strokeWidth={1.5} aria-hidden />
      <p className="text-[11px] font-medium text-slate-600">{title}</p>
      <p className="text-[10px] text-slate-400 mt-0.5 max-w-md leading-relaxed">{description}</p>
    </div>
  );
}

/**
 * SMOTE·시계열 증강 토글을 한 덩어리로 묶어 「데이터 증강」 맥락이 드러나게 표시합니다.
 * 전처리 상단 바에만 사용합니다(증강 전/후 카드에서는 중복을 피해 생략).
 */
function AugmentationMethodToolbar({
  smoteEnabled,
  timeseriesEnabled,
  onSmoteToggle,
  onTimeseriesToggle,
}: {
  smoteEnabled: boolean;
  timeseriesEnabled: boolean;
  onSmoteToggle: () => void;
  onTimeseriesToggle: () => void;
}) {
  const smoteSwitch = (
    <button
      type="button"
      role="switch"
      aria-checked={smoteEnabled}
      aria-label="SMOTE로 소수 클래스 오버샘플링"
      onClick={onSmoteToggle}
      className={`relative w-8 h-4 rounded-full transition-colors shrink-0 ${smoteEnabled ? 'bg-indigo-600' : 'bg-slate-300'}`}
    >
      <span
        className={`absolute top-0.5 left-0.5 w-3 h-3 bg-white rounded-full shadow transition-transform ${smoteEnabled ? 'translate-x-4' : 'translate-x-0'}`}
      />
    </button>
  );
  const tsSwitch = (
    <button
      type="button"
      role="switch"
      aria-checked={timeseriesEnabled}
      aria-label="시계열 윈도·지터 증강"
      onClick={onTimeseriesToggle}
      className={`relative w-8 h-4 rounded-full transition-colors shrink-0 ${timeseriesEnabled ? 'bg-sky-600' : 'bg-slate-300'}`}
    >
      <span
        className={`absolute top-0.5 left-0.5 w-3 h-3 bg-white rounded-full shadow transition-transform ${timeseriesEnabled ? 'translate-x-4' : 'translate-x-0'}`}
      />
    </button>
  );

  return (
    <div
      role="toolbar"
      aria-label="데이터 증강 기법"
      className="inline-flex flex-wrap items-stretch rounded-lg border border-slate-200 bg-white shadow-sm overflow-hidden divide-x divide-slate-200"
    >
      <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-50/90 min-h-[36px]">
        <Shuffle className="w-3.5 h-3.5 text-indigo-500 shrink-0" aria-hidden />
        <div className="min-w-0">
          <p className="text-[10px] font-bold text-slate-700 leading-tight">데이터 증강</p>
          <p className="text-[9px] text-slate-400 leading-tight">합성·확장</p>
        </div>
        <PreprocHelpTip title="학습용으로 표본 수를 늘리는 옵션입니다. 실제 수집 데이터를 대체하지 않고, 모델이 볼 패턴을 풍부게 합니다." />
      </div>
      <div className="flex items-center gap-1 px-2.5 py-1.5 hover:bg-slate-50/80 min-h-[36px]">
        <label className="flex items-center gap-2 cursor-pointer flex-1 min-w-0">
          {smoteSwitch}
          <span className="flex flex-col min-w-0">
            <span className="text-[11px] font-semibold text-slate-700 leading-tight">SMOTE</span>
            <span className="text-[9px] text-slate-400 leading-tight">불균형 보정</span>
          </span>
        </label>
        <PreprocHelpTip title="분류에서 소수 클래스 주변에 합성 샘플을 만들어 클래스 비율을 맞춥니다. 다수 클래스는 그대로 두고 소수만 늘립니다." />
      </div>
      <div className="flex items-center gap-1 px-2.5 py-1.5 hover:bg-slate-50/80 min-h-[36px]">
        <label className="flex items-center gap-2 cursor-pointer flex-1 min-w-0">
          {tsSwitch}
          <span className="flex flex-col min-w-0">
            <span className="text-[11px] font-semibold text-slate-700 leading-tight">시계열 증강</span>
            <span className="text-[9px] text-slate-400 leading-tight">윈도·지터</span>
          </span>
        </label>
        <PreprocHelpTip title="시계열 구간을 잘라 겹치게 쌓거나(window), 값에 작은 노이즈를 더해(jitter) 패턴 다양성을 높입니다." />
      </div>
    </div>
  );
}

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
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    try {
      const raw = localStorage.getItem(SIDEBAR_WIDTH_KEY);
      const n = raw ? Number(raw) : NaN;
      if (!Number.isFinite(n)) return 240;
      return Math.max(200, Math.min(360, Math.round(n)));
    } catch {
      return 240;
    }
  });
  const [helpOpen, setHelpOpen] = useState(false);
  /** 데이터 준비: 업로드된 공정 데이터 파일 */
  const [uploadedProcessFile, setUploadedProcessFile] = useState<File | null>(null);
  /** 업로드 파일 파싱 실패 시 사유 (분석 실행 시 설정, 파일 제거/재선택 시 초기화) */
  const [uploadParseError, setUploadParseError] = useState<string | null>(null);
  /** 전처리 탭: AutoML target(label) 컬럼. 비어 있으면 마지막 컬럼을 기본 사용합니다. */
  const [selectedLabelColumn, setSelectedLabelColumn] = useState<string>('');
  const processFileInputRef = React.useRef<HTMLInputElement>(null);

  const handleCollapsedChange = (collapsed: boolean) => {
    setSidebarCollapsed(collapsed);
    try {
      localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(collapsed));
    } catch {}
  };

  const handleSidebarWidthChange = (w: number) => {
    const clamped = Math.max(200, Math.min(360, Math.round(w)));
    setSidebarWidth(clamped);
    try {
      localStorage.setItem(SIDEBAR_WIDTH_KEY, String(clamped));
    } catch {}
  };

  // 파일 업로드 시 샘플 미리보기 + 전체 통계 파싱
  useEffect(() => {
    if (!uploadedProcessFile) {
      setDataPreview(null);
      setDataProfile(null);
      setFileClassCounts(null);
      return;
    }
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
      const sampleRows = lines.slice(1, 1 + DATA_PREVIEW_MAX_ROWS).map((l) => l.split(delim).map(strip));
      setDataPreview({ headers, rows: sampleRows });

      // ── 전체 파일에서 실제 통계 계산 ──
      const recordsCount = lines.length - 1;
      const selectedTargetIdx = headers.indexOf(selectedLabelColumn);
      const targetIdx = selectedTargetIdx >= 0 ? selectedTargetIdx : headers.length - 1;

      // 결측치 집계 (최대 500행 샘플, 전체 비율로 추정)
      const statSample = lines.slice(1, 501).map((l) => l.split(delim).map(strip));
      let missingInSample = 0;
      statSample.forEach((row) => row.forEach((cell) => { if (cell === '') missingInSample++; }));
      const missingValues = Math.round(missingInSample * (recordsCount / statSample.length));

      // 수치형 컬럼 변동계수(CV) 평균으로 noiseLevel 추정
      const numericColVals: number[][] = [];
      headers.forEach((_, ci) => {
        if (ci === targetIdx) return;
        const vals = statSample.map((r) => r[ci]).filter((v) => v !== '' && !Number.isNaN(Number(v))).map(Number);
        if (vals.length >= statSample.length * 0.5) numericColVals.push(vals);
      });
      let noiseLevel = 0.05;
      if (numericColVals.length > 0) {
        const cvs = numericColVals.map((col) => {
          const mean = col.reduce((a, b) => a + b, 0) / col.length;
          if (Math.abs(mean) < 1e-10) return 0;
          const std = Math.sqrt(col.reduce((a, b) => a + (b - mean) ** 2, 0) / col.length);
          return std / Math.abs(mean);
        });
        noiseLevel = Math.min(cvs.reduce((a, b) => a + b, 0) / cvs.length * 0.3, 0.5);
      }

      setDataProfile({
        features: headers.filter((_, idx) => idx !== targetIdx),
        recordsCount,
        missingValues,
        noiseLevel,
        seasonality: false,
        dataTypes: Object.fromEntries(headers.map((h) => [h, 'Continuous'])),
      });

      // 타겟 컬럼 전수 집계 → 분류 여부 판단 후 클래스 분포 저장
      const allTargetValues = lines.slice(1).map((l) => {
        const cells = l.split(delim).map(strip);
        return cells[targetIdx] ?? '';
      }).filter((v) => v !== '');
      const uniqueTargetVals = [...new Set(allTargetValues)];
      // 문자열 레이블이거나, 숫자여도 정수·고유값 ≤ 20·비율 < 10% 이면 분류로 판단
      const hasStringLabel = allTargetValues.some((v) => Number.isNaN(Number(v)));
      const hasNumericClassLabel = !hasStringLabel &&
        uniqueTargetVals.length >= 2 &&
        uniqueTargetVals.length <= 20 &&
        uniqueTargetVals.every((v) => Number.isInteger(Number(v))) &&
        uniqueTargetVals.length / allTargetValues.length < 0.1;
      const isClassification = hasStringLabel || hasNumericClassLabel;
      if (isClassification) {
        const counts: Record<string, number> = {};
        allTargetValues.forEach((v) => { counts[v] = (counts[v] ?? 0) + 1; });
        setFileClassCounts(counts);
      } else {
        setFileClassCounts(null);
      }
    })();
    return () => { cancelled = true; };
  }, [uploadedProcessFile, selectedLabelColumn]);

  const [industry, setIndustry] = useState<IndustryType>(IndustryType.SEMICONDUCTOR);
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [dataProfile, setDataProfile] = useState<DataProfile | null>(null);
  const [analysisResult, setAnalysisResult] = useState<{
    matches: MatchingResult[];
    summary: string;
    augmentationSuggestions: AugmentationSuggestionItem[];
  } | null>(null);
  const [automlResult, setAutomlResult] = useState<AutoMLFitResult | null>(null);
  /** AutoML 백엔드 호출 실패 시 사용자 안내 메시지 (빈 문자열이면 미설정/시뮬레이션) */
  const [automlFallbackReason, setAutomlFallbackReason] = useState<string | null>(null);
  /** 결과 카드: 주 지표 vs 보조 지표(F1·MAE) 막대·순위 전환 */
  const [automlScoreMetric, setAutomlScoreMetric] = useState<'primary' | 'aux'>('primary');
  const [showTopMatchesOnly, setShowTopMatchesOnly] = useState(true);
  /** 결과 탭 내 Standard MES Ontology 그래프 펼침 여부 (접기/펼치기용) */
  const [resultOntologyGraphOpen, setResultOntologyGraphOpen] = useState(true);
  /** 데이터 준비 > 분석 구조 맵에서 클릭한 노드(설명 카드 표시용) */
  const [structureMapSelectedNode, setStructureMapSelectedNode] = useState<OntologySelectedNode | null>(null);
  /** 인사이트 아코디언: 펼친 항목 인덱스 (null이면 전부 접힘) */
  const [insightOpenIndex, setInsightOpenIndex] = useState<number | null>(null);

  // 전처리 & 증강
  const [preprocConfig, setPreprocConfig] = useState<PreprocConfig>(DEFAULT_PREPROC_CONFIG);
  const [preprocCompleted, setPreprocCompleted] = useState(false);
  const [dataPreview, setDataPreview] = useState<{ headers: string[]; rows: string[][] } | null>(null);
  const [preprocSettingsExpanded, setPreprocSettingsExpanded] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<ResultTemplate | null>(null);
  /** 전처리 탭: AutoML 분류/회귀 — 자동 또는 강제 지정 */
  const [automlTaskMode, setAutomlTaskMode] = useState<AutomlTaskMode>('auto');

  useEffect(() => {
    setInsightOpenIndex(null);
  }, [analysisResult]);
  useEffect(() => {
    setStructureMapSelectedNode(null);
  }, [uploadedProcessFile, selectedTemplate, analysisResult]);
  useEffect(() => {
    if (!dataPreview || dataPreview.headers.length === 0) {
      setSelectedLabelColumn('');
      return;
    }
    setSelectedLabelColumn((prev) => {
      if (prev && dataPreview.headers.includes(prev)) return prev;
      return dataPreview.headers[dataPreview.headers.length - 1] ?? '';
    });
  }, [dataPreview]);
  const [analysisColumn, setAnalysisColumn] = useState<string>('');
  const [analysisClassFilter, setAnalysisClassFilter] = useState<string[]>([]);
  const [extraColumns, setExtraColumns] = useState<string[]>([]);
  /** 컬럼 탐색 차트: 기본 Y축 시리즈 표시 여부(전체 해제 시 false) */
  const [showPrimarySeries, setShowPrimarySeries] = useState(true);
  const [chartTypeOverride, setChartTypeOverride] = useState<'line' | 'bar' | 'scatter' | null>(null);
  const [xColumn, setXColumn] = useState<string>(''); // '' = 자동 (시계열 컬럼 or 인덱스)
  /** 업로드된 파일 전체에서 집계한 클래스별 실제 레코드 수 (분류 문제일 때만 non-null) */
  const [fileClassCounts, setFileClassCounts] = useState<Record<string, number> | null>(null);
  const [augmentationChartType, setAugmentationChartType] = useState<'bar' | 'area' | 'ratio'>('bar');
  /** 시계열 증강 파형 차트 기준 컬럼(컬럼 탐색 Y와 별도로 전환 가능) */
  const [augWaveColumn, setAugWaveColumn] = useState<string>('');
  /** 데이터 품질 카드: 결측치 vs 이상치 차트 전환 */
  const [qualityMetricView, setQualityMetricView] = useState<'missing' | 'outliers'>('missing');

  // 업로드 데이터/산업이 바뀌면 템플릿·전처리를 초기화하고, 시계열 컬럼이 있으면 시간 차분을 기본 포함합니다.
  useEffect(() => {
    setSelectedTemplate(null);
    setPreprocCompleted(false);
    setAutomlTaskMode('auto');
    setPreprocConfig(() => {
      const next: PreprocConfig = { ...DEFAULT_PREPROC_CONFIG };
      if (dataPreview && dataPreview.headers.length >= 2 && dataPreviewHasTimeColumn(dataPreview)) {
        next.featureEngineering = [...next.featureEngineering, 'timediff'];
      }
      return next;
    });
  }, [industry, dataPreview]);

  // dataPreview가 바뀌면 컬럼 탐색 초기화
  useEffect(() => {
    if (dataPreview && dataPreview.headers.length > 1) {
      setAnalysisColumn(getDefaultColumnExplorationYColumn(dataPreview));
    } else {
      setAnalysisColumn('');
    }
    setAnalysisClassFilter([]);
    setChartTypeOverride(null);
    setXColumn('');
    setShowPrimarySeries(true);
  }, [dataPreview]);

  /** 함께 보기: 데이터·Y/X축이 바뀔 때마다 선택 가능한 수치 컬럼을 전부 선택 */
  useEffect(() => {
    if (!dataPreview || !analysisColumn || dataPreview.headers.indexOf(analysisColumn) < 0) {
      setExtraColumns([]);
      return;
    }
    setExtraColumns(getDefaultColumnExplorationExtraColumns(dataPreview, analysisColumn, xColumn));
    setShowPrimarySeries(true);
  }, [dataPreview, analysisColumn, xColumn]);

  /** 증강 전/후 파형: 후보 목록이 바뀌면 현재 선택을 보정(탐색 Y와 맞추되, 유효하면 유지) */
  useEffect(() => {
    const eligible = getEligibleAugmentationWaveColumns(dataPreview);
    if (eligible.length === 0) {
      setAugWaveColumn('');
      return;
    }
    setAugWaveColumn((prev) => {
      if (prev && eligible.includes(prev)) return prev;
      if (analysisColumn && eligible.includes(analysisColumn)) return analysisColumn;
      return eligible[0];
    });
  }, [dataPreview, analysisColumn]);

  const eligibleAugWaveColumns = useMemo(
    () => getEligibleAugmentationWaveColumns(dataPreview),
    [dataPreview],
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
      const parseResult = await parseCsvForAutoml(uploadedProcessFile, selectedLabelColumn || undefined);
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

    const templatePreprocMethods = selectedTemplate?.preprocessingMethods?.length
      ? selectedTemplate.preprocessingMethods
      : null;
    const templateVizMethods = selectedTemplate?.visualizationMethods?.length
      ? selectedTemplate.visualizationMethods
      : null;

    const automlTask = resolveAutomlTaskForAnalysis(automlTaskMode, fileClassCounts, dataPreview, selectedLabelColumn);
    const configuredMethods = preprocCompleted ? preprocMethodsFromConfig(preprocConfig) : DEFAULT_PREPROCESSING_METHODS;
    const automlFallbackBase = getMockAutomlResult(automlTask);
    if (automlTask === 'classification') {
      const classificationValidationError = validateClassificationTarget(target);
      if (classificationValidationError) {
        await new Promise((r) => setTimeout(r, 1200));
        setAutomlResult({
          ...automlFallbackBase,
          preprocessing_methods: templatePreprocMethods ?? configuredMethods,
          visualization_methods: templateVizMethods ?? automlFallbackBase.visualization_methods,
        });
        setAutomlFallbackReason(classificationValidationError);
        setCurrentStep(2);
        const result = await analysisService.analyzeDataAndMatch(industry, profile, MES_ONTOLOGY);
        if (result) {
          setAnalysisResult(result);
          setCurrentStep(TOTAL_STEPS);
          setCurrentNav('result');
        }
        setIsProcessing(false);
        return;
      }
    }

    const automlRes = await automlFit(features, target, automlTask);
    if (automlRes.ok) {
      const data = automlRes.data;
      if (data.best_model != null && Number.isFinite(data.best_score)) {
        setAutomlResult({
          ...data,
          preprocessing_methods: templatePreprocMethods ?? (data.preprocessing_methods?.length ? data.preprocessing_methods : configuredMethods),
          visualization_methods: templateVizMethods ?? (data.visualization_methods?.length ? data.visualization_methods : DEFAULT_VISUALIZATION_METHODS),
        });
      } else {
        setAutomlResult({
          ...automlFallbackBase,
          preprocessing_methods: templatePreprocMethods ?? configuredMethods,
          visualization_methods: templateVizMethods ?? automlFallbackBase.visualization_methods,
        });
        setAutomlFallbackReason('모델 도출 결과가 없습니다.');
      }
    } else {
      await new Promise((r) => setTimeout(r, 1200));
      setAutomlResult({
        ...automlFallbackBase,
        preprocessing_methods: templatePreprocMethods ?? configuredMethods,
        visualization_methods: templateVizMethods ?? automlFallbackBase.visualization_methods,
      });
      if (
        'error' in automlRes &&
        automlRes.error &&
        automlRes.error !== AUTOML_FETCH_FAILED_MESSAGE
      ) {
        const translated = translateAutomlError(automlRes.error);
        setAutomlFallbackReason(translated ?? '백엔드에서 모델 학습을 완료하지 못했습니다.');
      }
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

  const selectedLabelIndex = dataPreview
    ? (dataPreview.headers.indexOf(selectedLabelColumn) >= 0
      ? dataPreview.headers.indexOf(selectedLabelColumn)
      : dataPreview.headers.length - 1)
    : -1;

  const radarData = useMemo(() => {
    if (!analysisResult) return [];
    return analysisResult.matches.map((m) => {
      const fn = MES_ONTOLOGY.find((o) => o.id === m.functionId);
      return {
        subject: MES_FUNCTION_SHORT_LABEL_KO[m.functionId] ?? fn?.name.split(' ')[0] ?? m.functionId,
        A: m.score * 100,
        fullMark: 100,
      };
    });
  }, [analysisResult]);

  // 분류/회귀: 전처리 탭 AutoML 모드(자동/강제)와 동일 기준 — 컬럼 탐색·SMOTE 안내와 맞춤
  const isClassificationTask = useMemo(
    () => resolveAutomlTaskForAnalysis(automlTaskMode, fileClassCounts, dataPreview, selectedLabelColumn) === 'classification',
    [automlTaskMode, dataPreview, fileClassCounts, selectedLabelColumn]
  );

  useEffect(() => {
    setAutomlScoreMetric('primary');
  }, [automlResult]);

  type AutomlResultRow = NonNullable<AutoMLFitResult['all_results']>[number];

  /** AutoML 추천 카드: 선택한 지표 기준 정렬·막대 길이·라벨 */
  const automlScoreboard = useMemo(() => {
    if (!automlResult) return null;
    const rawList: AutomlResultRow[] =
      automlResult.all_results && automlResult.all_results.length > 0
        ? automlResult.all_results.slice()
        : [{ model: automlResult.best_model, mean_score: automlResult.best_score }];

    const primaryLabel = automlPrimaryScoringLabel(automlResult.scoring);
    const auxLabel = automlAuxScoringLabel(automlResult.aux_scoring);
    const isMae = isAutomlAuxMae(automlResult.aux_scoring);
    const hasAuxData =
      Boolean(auxLabel) &&
      rawList.some((r) => r.aux_score != null && Number.isFinite(Number(r.aux_score)));

    const useAux = automlScoreMetric === 'aux' && hasAuxData;

    const sorted = rawList.slice().sort((a, b) => {
      if (!useAux) return b.mean_score - a.mean_score;
      const av = a.aux_score;
      const bv = b.aux_score;
      if (av == null || !Number.isFinite(Number(av))) return 1;
      if (bv == null || !Number.isFinite(Number(bv))) return -1;
      if (isMae) return Math.abs(Number(av)) - Math.abs(Number(bv));
      return Number(bv) - Number(av);
    });

    const chartBarMax = useAux
      ? isMae
        ? Math.max(...sorted.map((r) => Math.abs(Number(r.aux_score ?? 0))), 1e-9) * 1.08
        : 100
      : 100;

    const chartData = sorted.map((r) => ({
      name: r.model,
      barValue: useAux
        ? isMae
          ? Math.abs(Number(r.aux_score ?? 0))
          : Math.abs(Number(r.aux_score ?? 0)) * 100
        : r.mean_score * 100,
    }));

    const xTickFormatter =
      useAux && isMae ? (v: number) => v.toFixed(3) : (v: number) => `${v.toFixed(0)}%`;

    return {
      sorted,
      chartData,
      primaryLabel,
      auxLabel,
      hasAuxData,
      isMae,
      useAux,
      activeLabel: useAux ? (auxLabel as string) : primaryLabel,
      chartBarMax,
      xTickFormatter,
      primaryMetricHelp: automlPrimaryMetricHelpKo(automlResult.scoring),
      auxMetricHelp: automlAuxMetricHelpKo(automlResult.aux_scoring),
      stdCvHelp: AUTOML_STD_CV_HELP_KO,
    };
  }, [automlResult, automlScoreMetric]);

  const preprocChartData = useMemo(() => {
    // dataProfile이 없으면(파일 미업로드 상태) 의미없는 수치를 보여주지 않음
    const baseCount = dataProfile?.recordsCount ?? 0;
    const missingBefore = dataProfile?.missingValues ?? 0;
    const outlierBefore = dataProfile ? Math.round(dataProfile.noiseLevel * 100) : 0;
    const outlierAfter = preprocConfig.outlierMethod !== 'none' ? 0 : outlierBefore;
    const sampleRows = dataPreview?.rows ?? [];
    const sampleHeaders = dataPreview?.headers ?? [];
    const nonTargetHeaders = sampleHeaders.slice(0, Math.max(0, sampleHeaders.length - 1));
    const timeColIdx = nonTargetHeaders.findIndex((h, idx) => isTimeSeriesColumn(h, sampleRows.map((r) => r[idx] ?? '')));
    const hasTimeSeriesColumn = timeColIdx >= 0;

    const smoteAdded = preprocConfig.smoteEnabled
      ? Math.max(0, Math.round(baseCount * (preprocConfig.smoteStrategy === 'minority' ? 0.35 : 0.6)))
      : 0;
    const safeProb = clamp(preprocConfig.timeseriesApplyProb, 0.1, 1);
    const safeNoiseStd = clamp(preprocConfig.jitterNoiseStdPct, 0.3, 3.0);
    const safeWindowRatio = clamp(preprocConfig.windowRatio, 0.7, 0.98);
    const safeStrideRatio = clamp(preprocConfig.strideRatio, 0.02, 0.3);
    const safeOverlapRatio = clamp(preprocConfig.overlapRatio, 0.1, 0.9);
    const timeseriesAddedRatio =
      preprocConfig.timeseriesStrategy === 'window'
        ? clamp(
            (0.12 + (((1 - safeWindowRatio) / safeStrideRatio) * (0.16 + safeOverlapRatio * 0.12))) * safeProb,
            0.08,
            1.9
          )
        : clamp((0.08 + (safeNoiseStd / 3) * 0.4) * safeProb, 0.05, 0.45);
    const timeseriesAdded = preprocConfig.timeseriesEnabled && hasTimeSeriesColumn
      ? Math.max(0, Math.round(baseCount * timeseriesAddedRatio))
      : 0;
    const afterCount = baseCount + smoteAdded + timeseriesAdded;

    // 클래스 분포: 전체 파일에서 집계한 fileClassCounts 사용 (미리보기 행 수에 비례한 스케일 업 제거)
    let classDistData: { name: string; before: number; after: number }[] | null = null;
    if (fileClassCounts && Object.keys(fileClassCounts).length > 0) {
      const counts = fileClassCounts as Record<string, number>;
      const entries = Object.entries(counts).map(([name, count]) => ({ name, count }));
      const allocByClass: Record<string, number> = {};
      entries.forEach((e) => { allocByClass[e.name] = 0; });

      /**
       * SMOTE 시뮬 총량(smoteAdded)을 클래스별로 분배해
       * Stacked Area의 "합성" 레이어가 토글 상태와 항상 일관되게 보이도록 맞춘다.
       */
      if (preprocConfig.smoteEnabled && smoteAdded > 0 && entries.length > 0) {
        const maxCount = Math.max(...entries.map((e) => e.count));
        const minCount = Math.min(...entries.map((e) => e.count));
        const minorityClasses = entries.filter((e) => e.count === minCount);
        const nonMajorityClasses = entries.filter((e) => e.count < maxCount);
        const targets =
          preprocConfig.smoteStrategy === 'not_majority'
            ? (nonMajorityClasses.length > 0 ? nonMajorityClasses : entries)
            : (minorityClasses.length > 0 ? minorityClasses : entries);

        let remaining = smoteAdded;
        const weights = targets.map((e) => Math.max(1, maxCount - e.count));
        const weightSum = weights.reduce((a, b) => a + b, 0);
        targets.forEach((target, idx) => {
          const raw = idx === targets.length - 1
            ? remaining
            : Math.max(0, Math.round((smoteAdded * (weights[idx] ?? 0)) / Math.max(weightSum, 1)));
          const allocated = Math.min(raw, remaining);
          allocByClass[target.name] = allocated;
          remaining -= allocated;
        });
        // 반올림 오차 보정: 아직 남은 건 첫 타깃에 추가
        if (remaining > 0 && targets[0]) allocByClass[targets[0].name] += remaining;
      }

      classDistData = entries.map(({ name, count }) => ({
        name,
        before: count,
        after: count + (allocByClass[name] ?? 0),
      }));
    }

    // 스택 바 차트용: 원본 + 합성(delta) 분리
    const stackedData = classDistData?.map((d) => ({
      name: d.name,
      원본: d.before,
      합성: Math.max(0, d.after - d.before),
    })) ?? null;

    // 불균형 비율 (IR = 최다 / 최소)
    let irBefore: number | null = null;
    let irAfter: number | null = null;
    if (classDistData && classDistData.length >= 2) {
      const befores = classDistData.map((d) => d.before);
      const afters = classDistData.map((d) => d.after);
      const bMin = Math.min(...befores); const bMax = Math.max(...befores);
      const aMin = Math.min(...afters);  const aMax = Math.max(...afters);
      irBefore = bMin > 0 ? Math.round((bMax / bMin) * 10) / 10 : null;
      irAfter  = aMin > 0 ? Math.round((aMax / aMin) * 10) / 10 : null;
    }

    /**
     * 시계열 Bar(증강 후 누적): 원본 + SMOTE + 시계열을 분리 스택으로 시각화.
     * 파형/도넛 등 시계열 전용 뷰는 timeseriesAdded(시계열만) 값을 그대로 사용한다.
     */
    const timeseriesSmoteAdded = preprocConfig.smoteEnabled ? smoteAdded : 0;
    const timeseriesStackedAdded = timeseriesSmoteAdded + timeseriesAdded;
    const timeseriesYMax = Math.max(baseCount + timeseriesStackedAdded, 1);
    const timeseriesOriginalOnly =
      preprocConfig.timeseriesEnabled && hasTimeSeriesColumn
        ? [{ name: '원본', 원본: baseCount }]
        : null;
    const timeseriesData =
      preprocConfig.timeseriesEnabled && hasTimeSeriesColumn
        ? [
            {
              name: '증강 후',
              원본: baseCount,
              SMOTE: timeseriesSmoteAdded,
              시계열: timeseriesAdded,
            },
          ]
        : null;
    const waveColumn =
      augWaveColumn && eligibleAugWaveColumns.includes(augWaveColumn)
        ? augWaveColumn
        : eligibleAugWaveColumns.includes(analysisColumn)
          ? analysisColumn
          : eligibleAugWaveColumns[0] ?? analysisColumn;
    const columnTimeseriesWave =
      preprocConfig.timeseriesEnabled && hasTimeSeriesColumn
        ? buildColumnAugmentationWave(
            waveColumn,
            dataPreview,
            baseCount,
            timeseriesAdded,
            preprocConfig.smoteEnabled ? smoteAdded : 0,
            preprocConfig.timeseriesStrategy,
            preprocConfig.jitterNoiseStdPct,
            preprocConfig.windowRatio,
            preprocConfig.overlapRatio
          )
        : null;
    const qualityMissing = { name: '결측치', before: missingBefore, after: 0 };
    const qualityOutlier = { name: '이상치(%)', before: outlierBefore, after: outlierAfter };

    return {
      baseCount,
      afterCount,
      /** Ratio·범례에서 SMOTE와 시계열 증강을 분리 표시할 때 사용 */
      smoteAdded,
      timeseriesAdded,
      timeseriesSmoteAdded,
      timeseriesStackedAdded,
      classDistData,
      stackedData,
      timeseriesData,
      columnTimeseriesWave,
      timeseriesOriginalOnly,
      timeseriesYMax,
      hasTimeSeriesColumn,
      irBefore,
      irAfter,
      qualityMissing,
      qualityOutlier,
      qualityData: [qualityMissing, qualityOutlier],
      /** 시계열 파형에 실제로 적용된 컬럼(선택 UI·툴팁용) */
      augWaveColumnEffective: waveColumn,
    };
  }, [dataProfile, preprocConfig, fileClassCounts, dataPreview, analysisColumn, augWaveColumn, eligibleAugWaveColumns]);

  const preprocAfterSample = useMemo(() => {
    if (!dataPreview) return null;
    const labelMap: Record<string, number> = {};
    let nextId = 0;
    dataPreview.rows.forEach((row) => {
      const v = row[selectedLabelIndex];
      if (v !== '' && Number.isNaN(Number(v)) && !(v in labelMap)) labelMap[v] = nextId++;
    });
    const missingPlaceholder: Record<PreprocConfig['missingStrategy'], string> = {
      mean: '~avg', median: '~med', drop: '(제거)', zero: '0',
    };
    const afterRows = dataPreview.rows.map((row) =>
      row.map((cell, ci) => {
        if (ci === selectedLabelIndex) {
          if (cell !== '' && Number.isNaN(Number(cell))) return String(labelMap[cell] ?? 0);
          return cell;
        }
        if (cell === '') return missingPlaceholder[preprocConfig.missingStrategy];
        return cell;
      })
    );
    return { headers: dataPreview.headers, rows: afterRows, labelMap };
  }, [dataPreview, preprocConfig.missingStrategy, selectedLabelIndex]);

  /** 원본 샘플 테이블: 시간 형식 열은 숫자가 아니어도 범주 문자열(amber)이 아닌 일반 본문색으로 표시 */
  const originalPreviewTimeColumnIndices = useMemo(() => {
    if (!dataPreview) return new Set<number>();
    const set = new Set<number>();
    dataPreview.headers.forEach((h, ci) => {
      if (isTimeSeriesColumn(h, dataPreview.rows.map((r) => r[ci] ?? ''))) set.add(ci);
    });
    return set;
  }, [dataPreview]);

  /** 컬럼 탐색: 선택된 컬럼의 값 분포를 계산 (시계열 감지·분류 여부 반영). 전처리 탭의 결측·이상치·스케일 설정을 차트 데이터에 반영합니다. */
  const columnAnalysisData = useMemo(() => {
    if (!dataPreview || !analysisColumn) return null;
    const colIdx = dataPreview.headers.indexOf(analysisColumn);
    const targetIdx = dataPreview.headers.length - 1;
    if (colIdx < 0) return null;

    // 시계열 컬럼 탐지: 타겟 제외 헤더 중 첫 번째 시계열 컬럼 인덱스 (원본 미리보기 기준 — 변환으로 날짜 패턴이 깨지지 않게)
    const timeColIdx = dataPreview.headers.slice(0, targetIdx).findIndex((h, i) =>
      isTimeSeriesColumn(h, dataPreview.rows.map((r) => r[i]))
    );
    const selectedIsTimeSeries = isTimeSeriesColumn(
      analysisColumn,
      dataPreview.rows.map((r) => r[colIdx])
    );
    const hasExternalTimeAxis = timeColIdx >= 0 && timeColIdx !== colIdx;
    const timeColName = hasExternalTimeAxis ? dataPreview.headers[timeColIdx] : null;

    // 사용자가 선택한 X축 컬럼 (없으면 자동: 시계열 컬럼 or 인덱스)
    const customXColIdx = xColumn && xColumn !== analysisColumn
      ? dataPreview.headers.indexOf(xColumn) : -1;
    const effectiveXColIdx = customXColIdx >= 0 ? customXColIdx
      : hasExternalTimeAxis ? timeColIdx : -1;
    const effectiveXColName = customXColIdx >= 0 ? xColumn : timeColName;

    // 분류 문제일 때만 클래스 그룹화
    const allClasses = isClassificationTask
      ? Array.from(new Set(dataPreview.rows.map((r) => r[targetIdx]).filter((v) => v !== '')))
      : [];
    const activeClasses = analysisClassFilter.length > 0 ? analysisClassFilter : allClasses;
    const filteredOriginalRows = isClassificationTask && activeClasses.length > 0
      ? dataPreview.rows.filter((r) => activeClasses.includes(r[targetIdx]) || r[targetIdx] === '')
      : dataPreview.rows;

    const explorationRows = buildColumnExplorationPreview(
      { headers: dataPreview.headers, rows: filteredOriginalRows },
      preprocConfig
    ).rows;

    const colValues = explorationRows.map((r) => r[colIdx]);
    const isNumeric = !selectedIsTimeSeries &&
      colValues.filter((v) => v !== '').every((v) => !Number.isNaN(Number(v)));

    // X축이 수치형인지 여부 (산점도에서 실제 수치값으로 사용 가능)
    const isXNumeric = customXColIdx >= 0
      ? explorationRows.map((r) => r[customXColIdx]).filter((v) => v !== '').every((v) => !Number.isNaN(Number(v)))
      : false;

    // x축에 시간값 or 사용자 지정 컬럼이 있으면 라인 차트
    const useLineChart = (isNumeric || selectedIsTimeSeries) && (effectiveXColIdx >= 0 || selectedIsTimeSeries);

    // x축 레이블 결정
    const xLabel = (row: string[], i: number) =>
      effectiveXColIdx >= 0 ? (row[effectiveXColIdx] || `#${i + 1}`) : `#${i + 1}`;

    // X축으로 선택 가능한 컬럼 목록 (타겟·Y축 제외)
    const availableXCols = dataPreview.headers.slice(0, targetIdx).filter((h) => h !== analysisColumn);

    // 다중 컬럼 오버레이: 라인 차트 + 수치형 컬럼일 때만 활성화 (시계열 판별은 원본, 수치 판별은 전처리 반영 행)
    const validExtraCols = useLineChart && isNumeric
      ? extraColumns.filter((c) => {
          if (c === analysisColumn) return false;
          if (c === xColumn) return false;  // X축 컬럼 제외
          const idx = dataPreview.headers.indexOf(c);
          if (idx < 0 || idx >= targetIdx) return false;
          if (isTimeSeriesColumn(c, dataPreview.rows.map((r) => r[idx]))) return false;
          const vals = explorationRows.map((r) => r[idx]).filter((v) => v !== '');
          return vals.length > 0 && vals.every((v) => !Number.isNaN(Number(v)));
        })
      : [];
    const isMultiCol = validExtraCols.length > 0;
    const allSelectedCols = isMultiCol ? [analysisColumn, ...validExtraCols] : [];

    // 추가 가능한 수치형 컬럼 목록 (UI 피커용)
    const availableExtraCols = useLineChart && isNumeric
      ? dataPreview.headers.slice(0, targetIdx).filter((h) => {
          if (h === analysisColumn) return false;
          if (h === xColumn) return false;  // X축 컬럼 제외
          const hIdx = dataPreview.headers.indexOf(h);
          if (isTimeSeriesColumn(h, dataPreview.rows.map((r) => r[hIdx]))) return false;
          const vals = explorationRows.map((r) => r[hIdx]).filter((v) => v !== '');
          return vals.length > 0 && vals.every((v) => !Number.isNaN(Number(v)));
        })
      : [];

    let chartData: Record<string, string | number | null>[];

    if (selectedIsTimeSeries) {
      // 시간 컬럼 자체를 선택한 경우: 안내용 표시
      chartData = [];
    } else if (isMultiCol) {
      // 다중 컬럼 라인 차트: 각 행 = x 포인트, 각 컬럼 = 별도 라인
      chartData = explorationRows.map((row, i) => {
        const entry: Record<string, string | number | null> = { name: xLabel(row, i) };
        allSelectedCols.forEach((col) => {
          const idx = dataPreview.headers.indexOf(col);
          entry[col] = idx >= 0 && row[idx] !== '' ? Number(row[idx]) : null;
        });
        return entry;
      });
    } else if (isNumeric) {
      if (isClassificationTask && allClasses.length > 0) {
        // 시계열+분류: 클래스별 라인 (x=시간, 각 라인=클래스)
        chartData = explorationRows.map((r, i) => {
          const entry: Record<string, string | number | null> = {
            name: xLabel(r, i),
            _xVal: isXNumeric ? (r[customXColIdx] === '' ? null : Number(r[customXColIdx])) : i,
          };
          const cls = r[targetIdx] || '(없음)';
          entry[cls] = r[colIdx] === '' ? null : Number(r[colIdx]);
          return entry;
        });
      } else {
        // 수치형 단일 라인 or 바
        chartData = explorationRows.map((r, i) => ({
          name: xLabel(r, i),
          value: r[colIdx] === '' ? null : Number(r[colIdx]),
          _xVal: isXNumeric ? (r[customXColIdx] === '' ? null : Number(r[customXColIdx])) : i,
        }));
      }
    } else {
      // 범주형: 고유값 빈도
      if (isClassificationTask && allClasses.length > 0) {
        const counts: Record<string, Record<string, number>> = {};
        explorationRows.forEach((r) => {
          const val = r[colIdx] || '(빈값)';
          const label = val.length > 10 ? val.slice(0, 10) + '…' : val;
          const cls = r[targetIdx] || '(없음)';
          if (!counts[label]) counts[label] = {};
          counts[label][cls] = (counts[label][cls] ?? 0) + 1;
        });
        chartData = Object.entries(counts).map(([val, cc]) => ({ name: val, ...cc }));
      } else {
        const counts: Record<string, number> = {};
        explorationRows.forEach((r) => {
          const val = r[colIdx] || '(빈값)';
          const label = val.length > 10 ? val.slice(0, 10) + '…' : val;
          counts[label] = (counts[label] ?? 0) + 1;
        });
        chartData = Object.entries(counts).map(([name, count]) => ({ name, count }));
      }
    }

    return {
      chartData,
      allClasses,
      activeClasses,
      isNumeric,
      useLineChart,
      selectedIsTimeSeries,
      timeColName,
      allSelectedCols,
      availableExtraCols,
      effectiveXColName,
      isXNumeric,
      availableXCols,
    };
  }, [dataPreview, preprocConfig, analysisColumn, analysisClassFilter, isClassificationTask, extraColumns, xColumn]);

  /** 라인 차트 전용: 미리보기 행이 적을 때 시간축 보간으로 점 밀도를 높입니다. */
  const columnExplorationLineData = useMemo(() => {
    if (!columnAnalysisData?.chartData?.length) return [];
    const base = columnAnalysisData.chartData;
    const multi = columnAnalysisData.allSelectedCols.length > 1;
    const singleWithClasses = columnAnalysisData.isNumeric && columnAnalysisData.allClasses.length > 0;
    const singleValue = columnAnalysisData.isNumeric && columnAnalysisData.allClasses.length === 0;
    /* 분류+라인: 행마다 한 클래스만 값이 있어 구간 보간이 부적절함 */
    if (singleWithClasses) return base;
    let keys: string[] = [];
    if (multi) {
      keys = [...columnAnalysisData.allSelectedCols];
    } else if (singleValue) {
      keys = ['value'];
    } else {
      return base;
    }
    return densifyLineChartPoints(base, keys);
  }, [columnAnalysisData]);

  /** 데이터 신호 우선 템플릿 추천: 헤더 hint + 필수 항목 매칭 (산업은 동률 깨기) + 진단 정보 */
  const { recommendations: uploadTemplateRecommendations, isa95Warning: uploadIsa95Warning, dataDiagnostics: uploadDataDiagnostics } = useMemo(() => {
    if (!dataPreview) return { recommendations: [], isa95Warning: null, dataDiagnostics: null };
    return getEnhancedTemplateRecommendations(dataPreview.headers, dataPreview.rows, REFERENCE_TEMPLATES, industry, 3);
  }, [dataPreview, industry]);
  const dataGraphTemplates = useMemo(() => REFERENCE_TEMPLATES, []);
  const dataGraphRecommendedTemplateIds = useMemo(
    () => new Set(uploadTemplateRecommendations.map((r) => r.template.id)),
    [uploadTemplateRecommendations]
  );
  const dataGraphHighlightedFunctionIds = useMemo(
    () => Array.from(new Set(uploadTemplateRecommendations.flatMap((r) => r.matchedFunctionIds))),
    [uploadTemplateRecommendations]
  );

  // 템플릿 선택 변경 시, 전처리 설정을 자동 반영합니다.
  useEffect(() => {
    if (!selectedTemplate) return;
    setPreprocConfig((prev) => applyTemplateToPreprocConfig(selectedTemplate, prev));
    setPreprocCompleted(false);
  }, [selectedTemplate]);

  // 선택 템플릿의 시각화 기법에 따라, 전처리 화면의 시뮬레이션 차트 표시를 제한합니다.
  const templateWantsClassDist = !selectedTemplate
    ? true
    : (selectedTemplate.visualizationMethods ?? []).some((v) => v.includes('클래스 분포') || v.includes('혼동 행렬'));

  const templateWantsQuality = !selectedTemplate
    ? true
    : (selectedTemplate.visualizationMethods ?? []).some((v) => v.includes('히트맵') || v.includes('상관관계') || v.includes('상관'));

  return (
    <div
      className="min-h-screen flex flex-col bg-slate-50"
      style={{ ['--sidebar-w' as never]: `${sidebarCollapsed ? 64 : sidebarWidth}px` }}
    >
      <AppSidebar
        currentNav={currentNav}
        onNavChange={setCurrentNav}
        onHelpOpen={() => setHelpOpen(true)}
        collapsed={sidebarCollapsed}
        onCollapsedChange={handleCollapsedChange}
        width={sidebarWidth}
        onWidthChange={handleSidebarWidthChange}
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

      <main className="flex-1 min-w-0 w-full transition-[padding] duration-200 lg:pl-[var(--sidebar-w)]">
        {currentNav === 'ontology' && (
          <div key="ontology" className="p-4 sm:p-6 lg:p-8 min-w-0">
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
                        topMatchName: stripLatinAcronymParentheses(topFn?.nameKo ?? topFn?.name),
                        profileFeatureNames: dataProfile?.features,
                      };
                    })()
                  : undefined
              }
            />
          </div>
        )}

        {/* 1. 데이터 준비 */}
        {currentNav === 'data' && (
          <div key="data" className="p-4 sm:p-6 lg:p-8 min-w-0">
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

            {/* 하단: MES 분석 템플릿 추천 — 매칭 0개일 때 빈 안내 표시 */}
            {dataPreview && uploadTemplateRecommendations.length === 0 && (
              <section className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 flex items-start gap-3">
                <Layers className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-xs font-semibold text-slate-600">매칭되는 추천 템플릿이 없습니다</p>
                  <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                    업로드한 데이터의 컬럼명에서 MES 표준 키워드(예: temperature, vibration, lot, machine, timestamp)를 찾지 못했습니다. 컬럼명을 도메인 표준으로 변경하거나, 식별자/타임스탬프 컬럼을 추가한 뒤 다시 시도해 주세요.
                  </p>
                  {uploadDataDiagnostics && (
                    <p className="text-[11px] text-slate-400 mt-2">{uploadDataDiagnostics.summary}</p>
                  )}
                </div>
              </section>
            )}
            <section className="bg-white rounded-xl border border-indigo-100 shadow-sm">
              {uploadTemplateRecommendations.length > 0 && (
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
              )}

              {/* 데이터 진단 (타입 패턴) — 추천 점수와 분리된 정보 */}
              {uploadTemplateRecommendations.length > 0 && uploadDataDiagnostics && (
                  <div className="px-5 py-2.5 border-b border-slate-100 bg-slate-50/60 flex items-center gap-2">
                    <Layers className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <p className="text-[11px] text-slate-500 leading-relaxed">{uploadDataDiagnostics.summary}</p>
                  </div>
              )}

              {/* ISA-95 데이터 수준 안내 */}
              {uploadTemplateRecommendations.length > 0 && uploadIsa95Warning && (
                  <div className="px-5 py-3 border-b border-amber-100 bg-amber-50/70 flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs font-semibold text-amber-700">데이터 수준 안내 (ISA-95)</p>
                      <p className="text-[11px] text-amber-600 mt-0.5 leading-relaxed">{uploadIsa95Warning}</p>
                    </div>
                  </div>
              )}

              {uploadTemplateRecommendations.length > 0 && (() => {
                  return (
                    <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-slate-100">
                      {uploadTemplateRecommendations.map(({ template, matchedFunctionIds, coverageDetail }, idx) => {
                        const relatedFns = template.recommendedFunctionIds
                          .map((fid) => MES_ONTOLOGY.find((f) => f.id === fid))
                          .filter(Boolean);
                        // 유사도 = 데이터 항목과 템플릿 핵심 항목의 일치 비율
                        const { matched, total } = coverageDetail;
                        const ratio = total > 0 ? matched / total : 0;
                        const suitabilityDots = ratio >= 0.75 ? 3 : ratio >= 0.5 ? 2 : 1;
                        const suitabilityLabel = ratio >= 0.75 ? '높음' : ratio >= 0.5 ? '보통' : '낮음';
                        const suitabilityTextCls = ratio >= 0.75 ? 'text-indigo-600' : ratio >= 0.5 ? 'text-amber-600' : 'text-slate-500';
                        const suitabilitySegCls = ratio >= 0.75 ? 'bg-indigo-500' : ratio >= 0.5 ? 'bg-amber-400' : 'bg-slate-400';
                        const coverageBarCls = ratio >= 0.75 ? 'bg-emerald-400' : ratio >= 0.5 ? 'bg-amber-400' : 'bg-rose-400';
                        const coverageTextCls = ratio >= 0.75 ? 'text-emerald-600' : ratio >= 0.5 ? 'text-amber-600' : 'text-rose-600';
                        const isSelected = selectedTemplate?.id === template.id;
                        return (
                          <div
                            key={template.id}
                            role="button"
                            tabIndex={0}
                            onClick={() => setSelectedTemplate(template)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                setSelectedTemplate(template);
                              }
                            }}
                            aria-pressed={isSelected}
                            className={`group px-5 py-5 flex flex-col gap-3 cursor-pointer rounded-lg border transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300 focus-visible:ring-offset-1 ${
                              isSelected
                                ? 'bg-indigo-50 border-indigo-200 shadow-sm'
                                : 'bg-white border-transparent hover:bg-slate-50 hover:border-indigo-200 hover:shadow-sm'
                            }`}
                            aria-label={`${template.name} 템플릿 선택`}
                          >
                            {/* 순위 + 템플릿명 */}
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2 min-w-0">
                                <div className={`shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                                  idx === 0 ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500'
                                }`}>
                                  {idx + 1}
                                </div>
                                <div className="min-w-0">
                                  <span className="text-sm font-semibold text-slate-800 leading-snug truncate block">{template.name}</span>
                                </div>
                              </div>
                              <div className="flex items-center gap-1.5 shrink-0 ml-2">
                                <div className="flex gap-0.5">
                                  {[0, 1, 2].map((i) => (
                                    <div key={i} className={`w-3 h-2 rounded-sm ${i < suitabilityDots ? suitabilitySegCls : 'bg-slate-100'}`} />
                                  ))}
                                </div>
                                <span className={`text-[10px] font-semibold ${suitabilityTextCls}`}>유사도 {suitabilityLabel}</span>
                                <ChevronRight
                                  className={`w-3.5 h-3.5 transition-colors ${
                                    isSelected ? 'text-indigo-500' : 'text-slate-400 group-hover:text-indigo-500'
                                  }`}
                                  aria-hidden
                                />
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
                                  {MES_FUNCTION_SHORT_LABEL_KO[fn.id] ?? fn.id}
                                  {matchedFunctionIds.includes(fn.id) && ' ✓'}
                                </span>
                              ))}
                            </div>

                            {template.summary && (
                              <p className="text-xs text-slate-500 leading-relaxed">{template.summary}</p>
                            )}

                            {/* 유사도(커버리지) */}
                            {total > 0 && (
                              <div>
                                <div className="flex items-center justify-between mb-1">
                                  <span className="flex items-center gap-1">
                                    <span className="text-[10px] text-slate-500">유사도</span>
                                    <span className="relative group/coverage-tip z-10 inline-flex">
                                      <span className="w-3.5 h-3.5 rounded-full bg-slate-200 text-slate-500 text-[9px] font-bold flex items-center justify-center cursor-help leading-none select-none">?</span>
                                      {/* 아래·좌측 정렬: 상위 section overflow와 위쪽 배치 시 잘림 방지 */}
                                      <span className="absolute top-full left-0 mt-1.5 w-60 max-w-[min(15rem,calc(100vw-2rem))] text-[10px] text-slate-600 bg-white border border-slate-200 rounded-md shadow-lg px-2.5 py-2 leading-relaxed z-50 hidden group-hover/coverage-tip:block pointer-events-none whitespace-normal">
                                        <span className="font-semibold text-slate-700 block mb-1">유사도 산정 기준</span>
                                        <span className="block">이 템플릿이 요구하는 핵심 항목(예: 설비 ID, 타임스탬프, 측정값) 중 업로드한 데이터 컬럼과 일치하는 항목 수로 유사도를 계산합니다.</span>
                                        <span className="block mt-1">일치 항목이 많을수록 데이터 구조가 이 템플릿과 유사합니다. 우측 값은 일치 비율(%)입니다.</span>
                                      </span>
                                    </span>
                                  </span>
                                  <span className={`text-[10px] font-semibold ${coverageTextCls}`}>
                                    {(ratio * 100).toFixed(0)}%
                                  </span>
                                </div>
                                <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                  <div
                                    className={`h-full rounded-full ${coverageBarCls} transition-all`}
                                    style={{ width: `${(matched / total) * 100}%` }}
                                  />
                                </div>
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
                              {template.modelPerformance?.r2 != null && (
                                <span><span className="font-medium text-slate-700">R²</span> {template.modelPerformance.r2.toFixed(3)}</span>
                              )}
                              {template.modelPerformance?.mae != null && (
                                <span><span className="font-medium text-slate-700">MAE</span> {template.modelPerformance.mae}</span>
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

              {uploadTemplateRecommendations.length > 0 && selectedTemplate && (
                  <div className="px-5 py-3 bg-indigo-50/30 border-t border-indigo-100 flex items-center justify-between gap-3">
                    <p className="text-[11px] text-indigo-700 font-semibold">
                      선택 템플릿: {selectedTemplate.name} (전처리 &amp; 증강 화면에 즉시 반영됨)
                    </p>
                    <button
                      type="button"
                      onClick={() => setCurrentNav('preprocess')}
                      className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 shrink-0 shadow-sm"
                    >
                      <SlidersHorizontal className="w-3.5 h-3.5" />
                      전처리 &amp; 증강으로 이동 →
                    </button>
                  </div>
              )}

                <div className="px-5 py-3 bg-slate-50 border-t border-slate-100">
                  <p className="text-[10px] text-slate-400">
                    전체 템플릿은 기본 표시되며, 업로드 데이터와 매칭된 추천 템플릿은 강조됩니다. 전체 카탈로그는{' '}
                    <button type="button" onClick={() => setCurrentNav('ontology')} className="text-indigo-600 font-semibold hover:underline">표준 MES 온톨로지</button> 탭에서도 확인할 수 있습니다.
                  </p>
                </div>

                {/* 분석 구조 맵 */}
                <div className="border-t border-slate-100">
                  <div className="px-5 py-3 flex items-center gap-2">
                    <Workflow className="w-4 h-4 text-indigo-500 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <span className="text-sm font-bold text-slate-800 align-middle">분석 구조 맵</span>
                      <OntologyGraphHelpTip className="ml-1 align-middle" />
                      <span className="ml-2 text-[11px] text-slate-500">
                        전체 템플릿을 기본으로 보여주고, 데이터와 연결된 분석 기능과 추천 템플릿을 강조해 보여줍니다.
                      </span>
                    </div>
                  </div>
                  <div className="px-3 sm:px-5 pb-4 sm:pb-5 min-w-0">
                    <OntologyGraph
                      onSelectNode={setStructureMapSelectedNode}
                      highlightedIds={dataGraphHighlightedFunctionIds}
                      templates={dataGraphTemplates}
                      recommendedTemplateIds={dataGraphRecommendedTemplateIds}
                    />
                    <p className="mt-2 text-[11px] text-slate-500">
                      그래프에서 노드를 클릭하면 오른쪽에 상세 정보 패널이 열립니다.
                    </p>
                  </div>
                </div>
            </section>

            {/* 분석 구조 맵 노드 클릭 시 표시되는 우측 상세 패널 */}
            <OntologyNodeDetailPanel
              selectedNode={structureMapSelectedNode}
              onClose={() => setStructureMapSelectedNode(null)}
            />

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
          <div key="preprocess" className="p-4 sm:p-6 lg:p-8 min-w-0">
            <h1 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">
              <SlidersHorizontal className="w-5 h-5 text-indigo-600" />
              전처리 &amp; 증강
            </h1>

            {selectedTemplate ? (
              <section className="mb-4 bg-white rounded-xl border border-indigo-100 shadow-sm p-4">
                <div className="flex items-center justify-between gap-3 mb-3">
                  <div>
                    <p className="text-xs font-bold text-indigo-700">선택 템플릿 기반 전처리/시각화</p>
                    <p className="text-[11px] text-slate-500 mt-1">{selectedTemplate.name}</p>
                  </div>
                  <span className="text-[10px] text-indigo-600 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-full font-semibold">
                    적용됨
                  </span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <p className="text-[10px] font-semibold text-slate-500 mb-2">전처리 기법</p>
                    <div className="flex flex-wrap gap-1.5">
                      {(selectedTemplate.preprocessingMethods ?? []).slice(0, 8).map((m) => (
                        <span key={m} className="text-[10px] bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded border border-slate-200">
                          {m}
                        </span>
                      ))}
                      {(selectedTemplate.preprocessingMethods?.length ?? 0) > 8 && (
                        <span className="text-[10px] text-slate-400">
                          +{selectedTemplate.preprocessingMethods!.length - 8}
                        </span>
                      )}
                    </div>
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold text-slate-500 mb-2">시각화 기법</p>
                    <div className="flex flex-wrap gap-1.5">
                      {(selectedTemplate.visualizationMethods ?? []).slice(0, 8).map((v) => (
                        <span key={v} className="text-[10px] bg-indigo-50 text-indigo-600 border border-indigo-100 px-1.5 py-0.5 rounded">
                          {v}
                        </span>
                      ))}
                      {(selectedTemplate.visualizationMethods?.length ?? 0) > 8 && (
                        <span className="text-[10px] text-slate-400">
                          +{selectedTemplate.visualizationMethods!.length - 8}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </section>
            ) : (
              <section className="mb-4 bg-white rounded-xl border border-slate-200 shadow-sm p-4">
                <p className="text-xs font-bold text-slate-700 mb-1">선택된 템플릿이 없습니다</p>
                <p className="text-[11px] text-slate-500">
                  `데이터 준비` 탭에서 MES 분석 템플릿을 선택하면, 여기의 전처리 설정/기법 표시가 자동으로 갱신됩니다.
                </p>
              </section>
            )}

            {/* ── 1. 전처리 설정 컨트롤 바 ── */}
            <section className="mb-4 bg-white rounded-xl border border-slate-200 shadow-sm">
              {/* compact bar - 항상 표시 */}
              <div className="px-4 py-3 flex items-center gap-2 flex-wrap">
                <span className="text-xs font-bold text-slate-600 flex items-center gap-1 mr-1 shrink-0">
                  <SlidersHorizontal className="w-3.5 h-3.5 text-indigo-500" />
                  설정
                  <PreprocHelpTip title="결측·이상치·스케일은 원본 분포를 정리하는 전처리입니다. 증강과는 별개로, 모델에 넣기 좋은 형태로 맞춥니다." />
                </span>
                <div className="flex items-center gap-0.5 shrink-0">
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
                  <PreprocHelpTip title="비어 있는 셀을 평균·중앙값 등으로 채우거나, 결측이 많은 행을 제거합니다. 타깃·수치형에 맞게 선택하세요." />
                </div>
                <div className="flex items-center gap-0.5 shrink-0">
                  <select
                    value={preprocConfig.outlierMethod}
                    onChange={(e) => setPreprocConfig((c) => ({ ...c, outlierMethod: e.target.value as PreprocConfig['outlierMethod'] }))}
                    className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-slate-50 text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-400 cursor-pointer"
                  >
                    <option value="iqr">이상치: IQR</option>
                    <option value="zscore">이상치: Z-Score</option>
                    <option value="none">이상치: 처리 안 함</option>
                  </select>
                  <PreprocHelpTip title="IQR은 사분위 범위 밖 값을, Z-Score는 표준편차 기준으로 먼 값을 완화합니다. 공정 이상과 측정 오류를 구분해 적용하는 것이 좋습니다." />
                </div>
                <div className="flex items-center gap-0.5 shrink-0">
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
                  <PreprocHelpTip title="특성 단위를 맞춥니다. Standard는 평균0·분산1, MinMax는 구간 정규화, Robust는 중앙값·IQR 기반으로 이상치에 덜 민감합니다." />
                </div>
                <div className="flex items-center gap-0.5 shrink-0">
                  <select
                    value={automlTaskMode}
                    onChange={(e) => setAutomlTaskMode(e.target.value as AutomlTaskMode)}
                    className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-slate-50 text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-400 cursor-pointer max-w-[11rem]"
                    aria-label="AutoML 학습 유형"
                  >
                    <option value="auto">AutoML: 자동</option>
                    <option value="classification">AutoML: 분류</option>
                    <option value="regression">AutoML: 회귀</option>
                  </select>
                  <PreprocHelpTip title="자동은 마지막 컬럼(타깃) 패턴으로 분류·회귀를 고릅니다. 시계열 연속값은 보통 회귀, 문자열·저카디널리티 정수 라벨은 분류입니다. 필요 시 여기서 강제 지정하세요." />
                </div>
                {isClassificationTask && dataPreview && dataPreview.headers.length > 1 && (
                  <div className="flex items-center gap-0.5 shrink-0">
                    <select
                      value={selectedLabelColumn}
                      onChange={(e) => setSelectedLabelColumn(e.target.value)}
                      className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-slate-50 text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-400 cursor-pointer max-w-[12rem]"
                      aria-label="AutoML 라벨 컬럼"
                    >
                      {dataPreview.headers.map((h) => (
                        <option key={h} value={h}>Label: {h}</option>
                      ))}
                    </select>
                    <PreprocHelpTip title="분류·회귀 공통으로 AutoML의 타깃(정답) 컬럼을 지정합니다. 기본은 마지막 컬럼이며, 컬럼 순서가 다르면 여기서 변경하세요." />
                  </div>
                )}
                <div className="w-px h-4 bg-slate-200 mx-0.5 shrink-0" />
                <AugmentationMethodToolbar
                  smoteEnabled={preprocConfig.smoteEnabled}
                  timeseriesEnabled={preprocConfig.timeseriesEnabled}
                  onSmoteToggle={() => setPreprocConfig((c) => ({ ...c, smoteEnabled: !c.smoteEnabled }))}
                  onTimeseriesToggle={() => setPreprocConfig((c) => ({ ...c, timeseriesEnabled: !c.timeseriesEnabled }))}
                />
                <div className="ml-auto flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setPreprocSettingsExpanded((v) => !v)}
                    className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50"
                  >
                    {preprocSettingsExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                    고급 설정
                  </button>
                  <PreprocHelpTip title="피처 엔지니어링(다항식·로그·시간 차분)과 SMOTE·시계열 증강의 세부 파라미터를 펼쳐서 조정합니다." />
                </div>
              </div>

              {/* 고급 설정 - 피처 / 증강 상세를 카드로 구분 */}
              {preprocSettingsExpanded && (
                <div className="border-t border-slate-100 px-4 py-4 space-y-4 max-w-5xl">
                  <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4">
                    <div className="flex items-start gap-1 mb-0.5">
                      <p className="text-xs font-bold text-slate-800">피처 엔지니어링</p>
                      <PreprocHelpTip title="원본 열에서 새 피처를 만듭니다. 증강(표본 늘리기)과 달리 ‘열을 추가·변환’하는 단계입니다." />
                    </div>
                    <p className="text-[10px] text-slate-500 mb-3">열 변환·파생 피처. 여러 항목을 동시에 적용할 수 있습니다.</p>
                    <div className="flex flex-col sm:flex-row sm:flex-wrap gap-2">
                      {([
                        {
                          value: 'polynomial',
                          label: '다항식 특성',
                          desc: '2차 교호 항',
                          help: '서로 다른 특성의 곱 등 비선형 조합 항을 추가해 상호작용을 표현합니다. 특성 수가 늘어나 과적합에 유의하세요.',
                        },
                        {
                          value: 'log',
                          label: '로그 변환',
                          desc: 'log(x+1)',
                          help: '왜도가 큰 양수 특성에 log(x+1)을 적용해 스케일을 완만하게 합니다. 0·음수 값이 있으면 적용 범위를 확인하세요.',
                        },
                        {
                          value: 'timediff',
                          label: '시간 차분',
                          desc: '변화량 피처',
                          help: '시간 열을 기준으로 인접 시점 차이(변화량) 피처를 만듭니다. 추세·변동을 모델에 넣기 쉬워집니다.',
                        },
                      ] as { value: 'polynomial' | 'log' | 'timediff'; label: string; desc: string; help: string }[]).map((opt) => (
                        <label
                          key={opt.value}
                          className={`flex w-full sm:flex-1 sm:min-w-[140px] items-center gap-2.5 px-3 py-2 rounded-lg border cursor-pointer transition-colors ${
                            preprocConfig.featureEngineering.includes(opt.value)
                              ? 'border-indigo-300 bg-white shadow-sm'
                              : 'border-slate-200 bg-white/60 hover:bg-white hover:border-slate-300'
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
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1 flex-wrap">
                              <span className="text-xs font-semibold text-slate-800">{opt.label}</span>
                              <PreprocHelpTip title={opt.help} />
                            </div>
                            <span className="text-[10px] text-slate-400 block">{opt.desc}</span>
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                    <div className="flex items-center gap-2">
                      <Shuffle className="w-4 h-4 text-indigo-500 shrink-0" aria-hidden />
                      <p className="text-xs font-bold text-slate-800">데이터 증강 상세</p>
                      <PreprocHelpTip title="상단에서 켠 SMOTE·시계열 증강의 세부값입니다. 미리보기 차트의 ‘가짜 증강’ 시뮬과 연동됩니다." />
                    </div>
                    <p className="text-[10px] text-slate-500 mt-1 mb-4">
                      상단 툴바에서 켠 증강 방식별 옵션입니다. SMOTE와 시계열은 서로 독립적으로 동작합니다.
                    </p>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                      <div
                        className={`rounded-lg border p-3 transition-colors ${
                          preprocConfig.smoteEnabled
                            ? 'border-indigo-200 bg-indigo-50/40'
                            : 'border-slate-100 bg-slate-50/80 opacity-80'
                        }`}
                      >
                        <div className="flex items-center gap-1 mb-0.5">
                          <p className="text-[11px] font-bold text-indigo-900">SMOTE</p>
                          <PreprocHelpTip title="Synthetic Minority Over-sampling: 소수 클래스 표본 사이를 보간해 합성합니다. 분류·불균형 데이터에 쓰입니다." />
                        </div>
                        <p className="text-[9px] text-indigo-700/70 mb-3">분류 · 소수 클래스 오버샘플링</p>
                        {preprocConfig.smoteEnabled ? (
                          <div className="space-y-3">
                            <div>
                              <div className="flex items-center gap-1 mb-1">
                                <p className="text-[10px] text-slate-600">
                                  K 이웃: <span className="font-bold text-indigo-700">{preprocConfig.smoteK}</span>
                                </p>
                                <PreprocHelpTip title="합성점을 만들 때 참고하는 이웃 개수입니다. 작으면 단순·빠르고, 크면 부드럽지만 계산량이 늘 수 있습니다." />
                              </div>
                              <input
                                type="range"
                                min={1}
                                max={10}
                                value={preprocConfig.smoteK}
                                onChange={(e) => setPreprocConfig((c) => ({ ...c, smoteK: Number(e.target.value) }))}
                                className="w-full accent-indigo-600 h-1.5"
                              />
                              <div className="flex justify-between text-[9px] text-slate-400 mt-0.5">
                                <span>1 · 빠름</span>
                                <span>10 · 정밀</span>
                              </div>
                            </div>
                            <div className="space-y-1.5">
                              {([
                                {
                                  value: 'auto',
                                  label: 'auto',
                                  desc: '소수 → 다수 클래스 수준',
                                  help: '모든 소수 클래스를 다수 클래스 수준까지 맞추려 합니다. 기본적으로 균형에 가깝게 맞출 때 사용합니다.',
                                },
                                {
                                  value: 'minority',
                                  label: 'minority',
                                  desc: '가장 소수 클래스만',
                                  help: '가장 적은 클래스 하나만 오버샘플링합니다. 한 클래스만 극단적으로 적을 때 유용합니다.',
                                },
                                {
                                  value: 'not_majority',
                                  label: 'not majority',
                                  desc: '다수 제외 전 클래스',
                                  help: '가장 큰 클래스를 제외한 나머지를 늘립니다. 다수는 유지하고 중간·소수만 보강할 때 씁니다.',
                                },
                              ] as { value: PreprocConfig['smoteStrategy']; label: string; desc: string; help: string }[]).map((opt) => (
                                <label
                                  key={opt.value}
                                  className={`flex flex-col gap-0.5 px-2.5 py-2 rounded-md border cursor-pointer transition-colors ${
                                    preprocConfig.smoteStrategy === opt.value
                                      ? 'border-indigo-400 bg-white shadow-sm'
                                      : 'border-transparent bg-white/50 hover:bg-white'
                                  }`}
                                >
                                  <div className="flex items-center gap-2">
                                    <input
                                      type="radio"
                                      name="smoteStrategy"
                                      value={opt.value}
                                      checked={preprocConfig.smoteStrategy === opt.value}
                                      onChange={() => setPreprocConfig((c) => ({ ...c, smoteStrategy: opt.value }))}
                                      className="w-3.5 h-3.5 accent-indigo-600 shrink-0"
                                    />
                                    <span className="text-[10px] font-mono font-semibold text-slate-800">{opt.label}</span>
                                    <PreprocHelpTip title={opt.help} />
                                  </div>
                                  <span className="text-[9px] text-slate-500 pl-6">{opt.desc}</span>
                                </label>
                              ))}
                            </div>
                          </div>
                        ) : (
                          <p className="text-[10px] text-slate-400 py-2">상단에서 SMOTE를 켜면 설정할 수 있습니다.</p>
                        )}
                      </div>

                      <div
                        className={`rounded-lg border p-3 transition-colors ${
                          preprocConfig.timeseriesEnabled
                            ? 'border-sky-200 bg-sky-50/40'
                            : 'border-slate-100 bg-slate-50/80 opacity-80'
                        }`}
                      >
                        <div className="flex items-center gap-1 mb-0.5">
                          <p className="text-[11px] font-bold text-sky-900">시계열 증강</p>
                          <PreprocHelpTip title="시간 순서가 있는 데이터에서 구간을 잘라 늘리거나 노이즈를 더해 학습 샘플을 키웁니다. 센서·공정 시계열에 흔히 씁니다." />
                        </div>
                        <p className="text-[9px] text-sky-800/70 mb-3">연속 구간 확장 전략</p>
                        {preprocConfig.timeseriesEnabled ? (
                          <div className="space-y-3">
                            <div className="rounded-md border border-slate-200 bg-white/80 p-2">
                              <p className="text-[10px] text-slate-600 mb-1">강도 프리셋</p>
                              <div className="grid grid-cols-3 gap-1.5">
                                {([
                                  { value: 'light', label: '약', desc: '보수적' },
                                  { value: 'balanced', label: '중', desc: '권장' },
                                  { value: 'strong', label: '강', desc: '탐색' },
                                ] as { value: PreprocConfig['timeseriesPreset']; label: string; desc: string }[]).map((preset) => (
                                  <button
                                    key={preset.value}
                                    type="button"
                                    onClick={() =>
                                      setPreprocConfig((c) => ({
                                        ...c,
                                        timeseriesPreset: preset.value,
                                        ...TIMESERIES_PRESET_CONFIG[preset.value],
                                      }))
                                    }
                                    className={`rounded-md border px-2 py-1.5 text-left transition-colors ${
                                      preprocConfig.timeseriesPreset === preset.value
                                        ? 'border-sky-300 bg-sky-50 text-sky-800'
                                        : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                                    }`}
                                  >
                                    <p className="text-[10px] font-semibold">{preset.label}</p>
                                    <p className="text-[9px] opacity-80">{preset.desc}</p>
                                  </button>
                                ))}
                              </div>
                            </div>
                            {([
                              {
                                value: 'window',
                                label: 'window slicing',
                                desc: '겹치는 고정 길이 윈도',
                                help: '고정 길이 구간을 약간씩 밀며 잘라 여러 조각을 만듭니다. 패턴 길이를 맞추고 데이터량을 늘릴 때 적합합니다.',
                              },
                              {
                                value: 'jitter',
                                label: 'jitter',
                                desc: '미세 노이즈로 변동 보강',
                                help: '측정값에 아주 작은 난수를 더해 미세한 변동을 시뮬합니다. 과적합 완화에 도움이 될 수 있습니다.',
                              },
                            ] as { value: PreprocConfig['timeseriesStrategy']; label: string; desc: string; help: string }[]).map((opt) => (
                              <label
                                key={opt.value}
                                className={`flex flex-col gap-0.5 px-2.5 py-2 rounded-md border cursor-pointer transition-colors ${
                                  preprocConfig.timeseriesStrategy === opt.value
                                    ? 'border-sky-400 bg-white shadow-sm'
                                    : 'border-transparent bg-white/50 hover:bg-white'
                                }`}
                              >
                                <div className="flex items-center gap-2">
                                  <input
                                    type="radio"
                                    name="timeseriesStrategy"
                                    value={opt.value}
                                    checked={preprocConfig.timeseriesStrategy === opt.value}
                                    onChange={() => setPreprocConfig((c) => ({ ...c, timeseriesStrategy: opt.value }))}
                                    className="w-3.5 h-3.5 accent-sky-600 shrink-0"
                                  />
                                  <span className="text-[10px] font-mono font-semibold text-slate-800">{opt.label}</span>
                                  <PreprocHelpTip title={opt.help} />
                                </div>
                                <span className="text-[9px] text-slate-500 pl-6">{opt.desc}</span>
                              </label>
                            ))}
                            <div className="rounded-md border border-slate-200 bg-white/80 p-2.5 space-y-2.5">
                              <div>
                                <div className="flex items-center gap-1 mb-1">
                                  <p className="text-[10px] text-slate-600">
                                    적용 확률: <span className="font-semibold text-sky-700">{Math.round(preprocConfig.timeseriesApplyProb * 100)}%</span>
                                  </p>
                                  <PreprocHelpTip title="각 윈도/구간에 증강을 적용할 확률입니다. 과도한 증강을 피하려면 30~60%에서 시작하는 것이 안전합니다." />
                                </div>
                                <input
                                  type="range"
                                  min={0.1}
                                  max={1}
                                  step={0.05}
                                  value={preprocConfig.timeseriesApplyProb}
                                  onChange={(e) =>
                                    setPreprocConfig((c) => ({
                                      ...c,
                                      timeseriesApplyProb: Number(e.target.value),
                                      timeseriesPreset: 'balanced',
                                    }))
                                  }
                                  className="w-full accent-sky-600 h-1.5"
                                />
                              </div>

                              {preprocConfig.timeseriesStrategy === 'jitter' ? (
                                <div>
                                  <div className="flex items-center gap-1 mb-1">
                                    <p className="text-[10px] text-slate-600">
                                      노이즈 표준편차: <span className="font-semibold text-sky-700">{preprocConfig.jitterNoiseStdPct.toFixed(1)}%</span>
                                    </p>
                                    <PreprocHelpTip title="입력 시계열 표준편차 대비 노이즈 크기입니다. 일반적으로 0.5~2.0% 범위에서 검증 성능을 비교합니다." />
                                  </div>
                                  <input
                                    type="range"
                                    min={0.3}
                                    max={3}
                                    step={0.1}
                                    value={preprocConfig.jitterNoiseStdPct}
                                    onChange={(e) =>
                                      setPreprocConfig((c) => ({
                                        ...c,
                                        jitterNoiseStdPct: Number(e.target.value),
                                        timeseriesPreset: 'balanced',
                                      }))
                                    }
                                    className="w-full accent-sky-600 h-1.5"
                                  />
                                </div>
                              ) : (
                                <>
                                  <div>
                                    <div className="flex items-center gap-1 mb-1">
                                      <p className="text-[10px] text-slate-600">
                                        window ratio: <span className="font-semibold text-sky-700">{preprocConfig.windowRatio.toFixed(2)}</span>
                                      </p>
                                      <PreprocHelpTip title="원 시계열 길이 대비 윈도 길이 비율입니다. 0.8~0.95가 실무에서 가장 자주 쓰입니다." />
                                    </div>
                                    <input
                                      type="range"
                                      min={0.7}
                                      max={0.98}
                                      step={0.01}
                                      value={preprocConfig.windowRatio}
                                      onChange={(e) =>
                                        setPreprocConfig((c) => ({
                                          ...c,
                                          windowRatio: Number(e.target.value),
                                          timeseriesPreset: 'balanced',
                                        }))
                                      }
                                      className="w-full accent-sky-600 h-1.5"
                                    />
                                  </div>
                                  <div>
                                    <div className="flex items-center gap-1 mb-1">
                                      <p className="text-[10px] text-slate-600">
                                        stride ratio: <span className="font-semibold text-sky-700">{preprocConfig.strideRatio.toFixed(2)}</span>
                                      </p>
                                      <PreprocHelpTip title="윈도 이동 간격 비율입니다. 작을수록 샘플 수는 늘지만 유사 샘플이 많아질 수 있습니다." />
                                    </div>
                                    <input
                                      type="range"
                                      min={0.02}
                                      max={0.3}
                                      step={0.01}
                                      value={preprocConfig.strideRatio}
                                      onChange={(e) =>
                                        setPreprocConfig((c) => ({
                                          ...c,
                                          strideRatio: Number(e.target.value),
                                          timeseriesPreset: 'balanced',
                                        }))
                                      }
                                      className="w-full accent-sky-600 h-1.5"
                                    />
                                  </div>
                                  <div>
                                    <div className="flex items-center gap-1 mb-1">
                                      <p className="text-[10px] text-slate-600">
                                        overlap ratio: <span className="font-semibold text-sky-700">{preprocConfig.overlapRatio.toFixed(2)}</span>
                                      </p>
                                      <PreprocHelpTip title="윈도 겹침 비율입니다. 0.3~0.7 구간에서 시작해 성능과 학습 시간의 균형을 맞춥니다." />
                                    </div>
                                    <input
                                      type="range"
                                      min={0.1}
                                      max={0.9}
                                      step={0.05}
                                      value={preprocConfig.overlapRatio}
                                      onChange={(e) =>
                                        setPreprocConfig((c) => ({
                                          ...c,
                                          overlapRatio: Number(e.target.value),
                                          timeseriesPreset: 'balanced',
                                        }))
                                      }
                                      className="w-full accent-sky-600 h-1.5"
                                    />
                                  </div>
                                </>
                              )}

                              <label className="flex items-center gap-2 cursor-pointer pt-0.5">
                                <input
                                  type="checkbox"
                                  checked={preprocConfig.timeseriesSeedLock}
                                  onChange={(e) => setPreprocConfig((c) => ({ ...c, timeseriesSeedLock: e.target.checked }))}
                                  className="w-3.5 h-3.5 rounded accent-sky-600"
                                />
                                <span className="text-[10px] text-slate-600">
                                  seed 고정 <span className="text-slate-400">(재현성 우선)</span>
                                </span>
                              </label>
                            </div>
                          </div>
                        ) : (
                          <p className="text-[10px] text-slate-400 py-2">상단에서 시계열 증강을 켜면 설정할 수 있습니다.</p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </section>

            {/* ── 2. Before / After 차트 ── */}
            {!uploadedProcessFile ? (
              <div className="mb-4 p-6 bg-slate-50 rounded-xl border border-dashed border-slate-200 text-center">
                <BarChart3 className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="text-xs font-semibold text-slate-500">데이터를 업로드하면 시각화 지표가 표시됩니다</p>
                <p className="text-[11px] text-slate-400 mt-1">클래스 분포, 데이터 품질, 피처 통계 등을 확인할 수 있습니다.</p>
                <button
                  type="button"
                  onClick={() => setCurrentNav('data')}
                  className="mt-3 text-xs font-semibold text-indigo-600 hover:text-indigo-700"
                >
                  데이터 준비 탭으로 이동 →
                </button>
              </div>
            ) : (
              <>
                {/* ── 인터랙티브 컬럼 탐색 ── */}
                <section className="bg-white rounded-xl border border-slate-200 shadow-sm mb-4 overflow-hidden">
                  <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-1.5">
                      <Search className="w-3.5 h-3.5 text-indigo-500" />
                      <span className="text-xs font-bold text-slate-700">컬럼 탐색</span>
                      <span className="text-[10px] text-slate-400 hidden sm:inline">
                        · 컬럼별 값 분포를 클래스 기준으로 확인 · 상단 전처리 설정(결측·이상치·스케일) 반영
                      </span>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap justify-end">
                      {/* 시계열 컬럼 배지 */}
                      {columnAnalysisData?.selectedIsTimeSeries && (
                        <span className="px-2 py-0.5 text-[10px] font-semibold rounded-full bg-sky-50 text-sky-600 border border-sky-200">
                          시계열
                        </span>
                      )}
                      {columnAnalysisData?.isNumeric && !columnAnalysisData.selectedIsTimeSeries && (() => {
                        const effectiveType = chartTypeOverride ?? (columnAnalysisData.useLineChart ? 'line' : 'bar');
                        return (
                          <div className="flex items-center gap-0.5 bg-slate-100 rounded-lg p-0.5">
                            {([['line', '선'], ['bar', '막대'], ['scatter', '산점도']] as const).map(([key, label]) => (
                              <button
                                key={key}
                                type="button"
                                onClick={() => setChartTypeOverride(key)}
                                className={`px-2 py-0.5 text-[10px] font-semibold rounded-md transition-colors ${effectiveType === key ? 'bg-white text-slate-700 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                              >
                                {label}
                              </button>
                            ))}
                          </div>
                        );
                      })()}
                    </div>
                  </div>

                  {/* X / Y 축 선택 */}
                  {dataPreview.headers.length > 2 && (
                    <div className="px-4 py-2 border-b border-slate-100 flex items-center gap-4 flex-wrap">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] text-slate-500 font-semibold shrink-0">Y축:</span>
                        <select
                          value={analysisColumn}
                          onChange={(e) => { setAnalysisColumn(e.target.value); setAnalysisClassFilter([]); setChartTypeOverride(null); setXColumn(''); }}
                          className="text-xs border border-slate-200 rounded-lg px-2 py-1 bg-slate-50 text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-400 cursor-pointer"
                        >
                          {dataPreview.headers.filter((_, idx) => idx !== selectedLabelIndex).map((h) => (
                            <option key={h} value={h}>{h}</option>
                          ))}
                        </select>
                      </div>
                      {columnAnalysisData?.isNumeric && !columnAnalysisData.selectedIsTimeSeries && (
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] text-slate-500 font-semibold shrink-0">X축:</span>
                          <select
                            value={xColumn}
                            onChange={(e) => { setXColumn(e.target.value); }}
                            className="text-xs border border-slate-200 rounded-lg px-2 py-1 bg-slate-50 text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-400 cursor-pointer"
                          >
                            <option value="">자동{columnAnalysisData.effectiveXColName ? ` (${columnAnalysisData.effectiveXColName})` : ' (인덱스)'}</option>
                            {columnAnalysisData.availableXCols.map((h) => (
                              <option key={h} value={h}>{h}</option>
                            ))}
                          </select>
                        </div>
                      )}
                    </div>
                  )}

                  {/* 다중 컬럼 선택 (라인 차트 모드일 때만 표시) */}
                  {columnAnalysisData?.useLineChart && !columnAnalysisData.selectedIsTimeSeries &&
                   columnAnalysisData.availableExtraCols.length > 0 && (() => {
                    const allSelected = showPrimarySeries && columnAnalysisData.availableExtraCols.every((c) => extraColumns.includes(c));
                    return (
                      <div className="px-4 py-2 border-b border-slate-100 flex items-center gap-2 flex-wrap">
                        <span className="text-[10px] text-slate-500 font-semibold shrink-0">함께 보기:</span>
                        {/* 전체 켜기/끄기 토글 */}
                        <button
                          type="button"
                          onClick={() => {
                            if (allSelected) {
                              setExtraColumns([]);
                              setShowPrimarySeries(false);
                              return;
                            }
                            setShowPrimarySeries(true);
                            setExtraColumns([...columnAnalysisData.availableExtraCols]);
                          }}
                          className={`px-2.5 py-0.5 text-[10px] rounded-full border font-semibold transition-colors ${allSelected ? 'bg-slate-700 text-white border-slate-700' : 'bg-white text-slate-500 border-slate-300 hover:border-slate-400'}`}
                        >
                          {allSelected ? '전체 해제' : '전체 선택'}
                        </button>
                        <span className="text-slate-200 text-xs select-none">|</span>
                        {columnAnalysisData.availableExtraCols.map((col) => {
                          const active = extraColumns.includes(col);
                          const paletteOrder = [...(showPrimarySeries ? [analysisColumn] : []), ...extraColumns];
                          const colorIdx = active ? paletteOrder.indexOf(col) : -1;
                          const color = active ? CHART_PALETTE[colorIdx % CHART_PALETTE.length] : undefined;
                          return (
                            <button
                              key={col}
                              type="button"
                              onClick={() => setExtraColumns((prev) =>
                                prev.includes(col) ? prev.filter((c) => c !== col) : [...prev, col]
                              )}
                              style={active ? { backgroundColor: color + '18', color, borderColor: color + '70' } : {}}
                              className={`px-2.5 py-0.5 text-[10px] rounded-full border font-semibold transition-colors ${!active ? 'bg-white text-slate-400 border-slate-200 hover:border-slate-300' : ''}`}
                            >
                              {col}
                            </button>
                          );
                        })}
                      </div>
                    );
                  })()}

                  {/* 시계열 컬럼 안내 */}
                  {columnAnalysisData?.selectedIsTimeSeries && (
                    <div className="mx-4 mb-3 px-3 py-2 bg-sky-50 border border-sky-200 rounded-lg text-[11px] text-sky-700">
                      시간 컬럼입니다. 다른 수치형 컬럼을 선택하면 이 컬럼을 x축으로 사용한 라인 차트로 분석합니다.
                      {!preprocConfig.featureEngineering.includes('timediff') ? (
                        <button
                          type="button"
                          onClick={() => setPreprocConfig((c) => ({ ...c, featureEngineering: [...c.featureEngineering, 'timediff'] }))}
                          className="ml-2 font-semibold underline hover:text-sky-900"
                        >
                          시간 차분 피처 추가 →
                        </button>
                      ) : (
                        <span className="ml-2 text-[10px] text-slate-500">전처리에 시간 차분이 포함되어 있습니다.</span>
                      )}
                    </div>
                  )}

                  {/* timediff 자동 제안 (시계열 x축이 감지됐을 때) */}
                  {columnAnalysisData?.timeColName && !columnAnalysisData.selectedIsTimeSeries && (
                    <div className="mx-4 mb-2 px-3 py-1.5 bg-sky-50 border border-sky-200 rounded-lg flex items-center justify-between gap-2">
                      <span className="text-[10px] text-sky-700">
                        시계열 컬럼 <strong>{columnAnalysisData.timeColName}</strong> 감지됨 · x축으로 사용 중
                      </span>
                      {!preprocConfig.featureEngineering.includes('timediff') ? (
                        <button
                          type="button"
                          onClick={() => setPreprocConfig((c) => ({ ...c, featureEngineering: [...c.featureEngineering, 'timediff'] }))}
                          className="text-[10px] font-semibold text-sky-600 hover:text-sky-800 shrink-0 ml-2"
                        >
                          시간 차분 추가
                        </button>
                      ) : (
                        <span className="text-[10px] text-slate-500 shrink-0">전처리에 시간 차분이 포함되어 있습니다.</span>
                      )}
                    </div>
                  )}

                  {/* 클래스 필터 chips (다중 컬럼 모드에서는 숨김) */}
                  {columnAnalysisData && columnAnalysisData.allClasses.length > 0 && columnAnalysisData.allSelectedCols.length <= 1 && (
                    <div className="px-4 pt-2 pb-2 border-b border-slate-50 flex items-center gap-2 flex-wrap">
                      <span className="text-[10px] text-slate-500 font-semibold shrink-0">클래스:</span>
                      <button
                        type="button"
                        onClick={() => setAnalysisClassFilter([])}
                        className={`px-2.5 py-0.5 text-[10px] rounded-full border font-semibold transition-colors ${analysisClassFilter.length === 0 ? 'bg-slate-700 text-white border-slate-700' : 'bg-white text-slate-500 border-slate-300 hover:border-slate-400'}`}
                      >
                        전체
                      </button>
                      {columnAnalysisData.allClasses.map((cls, i) => {
                        const color = CHART_PALETTE[i % CHART_PALETTE.length];
                        const active = analysisClassFilter.includes(cls);
                        return (
                          <button
                            key={cls}
                            type="button"
                            onClick={() => setAnalysisClassFilter((prev) =>
                              prev.includes(cls) ? prev.filter((c) => c !== cls) : [...prev, cls]
                            )}
                            style={active ? { backgroundColor: color + '18', color, borderColor: color + '70' } : {}}
                            className={`px-2.5 py-0.5 text-[10px] rounded-full border font-semibold transition-colors ${!active ? 'bg-white text-slate-400 border-slate-200 hover:border-slate-300' : ''}`}
                          >
                            {cls}
                          </button>
                        );
                      })}
                    </div>
                  )}

                  <div className="px-4 pt-3 pb-2 min-w-0">
                    {columnAnalysisData && !columnAnalysisData.selectedIsTimeSeries ? (
                      <>
                        <div
                          className={
                            columnAnalysisData.allSelectedCols.length > 1
                              ? 'w-full min-h-[180px] h-[clamp(180px,34dvh,280px)]'
                              : 'w-full min-h-[160px] h-[clamp(160px,30dvh,240px)]'
                          }
                        >
                        <ResponsiveContainer width="100%" height="100%">
                          {(() => {
                            const hideAllSeries = columnAnalysisData.useLineChart && !showPrimarySeries && extraColumns.length === 0;
                            if (hideAllSeries) {
                              return (
                                <div className="h-full flex items-center justify-center text-[11px] text-slate-400 border border-dashed border-slate-200 rounded-lg bg-slate-50/50">
                                  표시할 시리즈가 없습니다. 위에서 “전체 선택” 또는 컬럼을 선택하세요.
                                </div>
                              );
                            }
                            const effectiveType = chartTypeOverride ?? (
                              columnAnalysisData.allSelectedCols.length > 1 || columnAnalysisData.useLineChart ? 'line' : 'bar'
                            );

                            if (columnAnalysisData.allSelectedCols.length > 1) {
                              /* 다중 컬럼 모드 */
                              if (effectiveType === 'scatter') {
                                const xAxisName = columnAnalysisData.effectiveXColName ?? '인덱스';
                                const multiScatterAllData = columnAnalysisData.allSelectedCols.flatMap((col) =>
                                  columnAnalysisData.chartData.map((d, idx) => ({ x: idx, label: String(d.name), col }))
                                );
                                const showTimeTick = !!columnAnalysisData.effectiveXColName;
                                return (
                                  <ScatterChart margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
                                    <XAxis type="number" dataKey="x" tick={{ fontSize: 9 }} axisLine={false} tickLine={false} name={xAxisName}
                                      tickFormatter={showTimeTick
                                        ? (val: number) => { const pt = multiScatterAllData.find((p) => p.x === Math.round(val)); return pt?.label ?? `#${Math.round(val) + 1}`; }
                                        : undefined}
                                    />
                                    <YAxis type="number" dataKey="y" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} width={40} />
                                    <Tooltip
                                      cursor={{ strokeDasharray: '3 3' }}
                                      content={({ payload }) => {
                                        if (!payload?.length) return null;
                                        const p = payload[0].payload as { x: number; y: number; label: string; col: string };
                                        return (
                                          <div style={{ fontSize: 11, padding: '6px 10px', background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8 }}>
                                            <p style={{ color: '#64748b', marginBottom: 2 }}>{xAxisName}: {columnAnalysisData.effectiveXColName ? p.label : `#${p.x + 1}`}</p>
                                            <p><strong>{p.col}</strong>: {p.y}</p>
                                          </div>
                                        );
                                      }}
                                    />
                                    <Legend wrapperStyle={{ fontSize: 10 }} />
                                    {columnAnalysisData.allSelectedCols.map((col, i) => (
                                      <Scatter key={col} name={col}
                                        data={columnAnalysisData.chartData.map((d, idx) => ({ x: idx, y: typeof d[col] === 'number' ? d[col] : null, label: String(d.name), col })).filter((p) => p.y !== null) as { x: number; y: number; label: string; col: string }[]}
                                        fill={CHART_PALETTE[i % CHART_PALETTE.length]} />
                                    ))}
                                  </ScatterChart>
                                );
                              } else if (effectiveType === 'bar') {
                                return (
                                  <BarChart data={columnAnalysisData.chartData} barCategoryGap="30%" barGap={2}>
                                    <XAxis dataKey="name" tick={{ fontSize: 9 }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                                    <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} width={40} />
                                    <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #e2e8f0' }} formatter={(v: number | null, name: string) => [v ?? '(결측)', name]} />
                                    <Legend wrapperStyle={{ fontSize: 10 }} />
                                    {columnAnalysisData.allSelectedCols.map((col, i) => (
                                      <Bar key={col} dataKey={col} fill={CHART_PALETTE[i % CHART_PALETTE.length]} radius={[3, 3, 0, 0]} />
                                    ))}
                                  </BarChart>
                                );
                              } else {
                                /* 다중 컬럼 라인 차트 (default) */
                                const showCols = [...(showPrimarySeries ? [analysisColumn] : []), ...extraColumns];
                                return (
                                  <LineChart data={columnExplorationLineData}>
                                    <XAxis dataKey="name" tick={{ fontSize: 9 }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                                    <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} width={40} />
                                    <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #e2e8f0' }} formatter={(v: number | null, name: string) => [v ?? '(결측)', name]} />
                                    <Legend wrapperStyle={{ fontSize: 10 }} />
                                    {showCols.map((col, i) => (
                                      <Line key={col} type="natural" dataKey={col}
                                        stroke={CHART_PALETTE[i % CHART_PALETTE.length]}
                                        strokeWidth={2} dot={false} connectNulls activeDot={{ r: 5 }} />
                                    ))}
                                  </LineChart>
                                );
                              }
                            } else if (columnAnalysisData.isNumeric) {
                              /* 단일 수치형 컬럼 */
                              if (effectiveType === 'scatter') {
                                const scatterData = columnAnalysisData.chartData
                                  .map((d, i) => ({
                                    x: columnAnalysisData.isXNumeric
                                      ? (typeof d._xVal === 'number' ? d._xVal : null)
                                      : i,
                                    y: typeof d.value === 'number' ? d.value : null,
                                    label: String(d.name),
                                  }))
                                  .filter((p): p is { x: number; y: number; label: string } => p.x !== null && p.y !== null);
                                const xAxisName = columnAnalysisData.effectiveXColName ?? '인덱스';
                                const showTimeTick = !!columnAnalysisData.effectiveXColName && !columnAnalysisData.isXNumeric;
                                return (
                                  <ScatterChart margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
                                    <XAxis
                                      type="number" dataKey="x" tick={{ fontSize: 9 }} axisLine={false} tickLine={false} name={xAxisName}
                                      tickFormatter={showTimeTick
                                        ? (val: number) => { const pt = scatterData.find((p) => p.x === Math.round(val)); return pt?.label ?? `#${Math.round(val) + 1}`; }
                                        : undefined}
                                    />
                                    <YAxis type="number" dataKey="y" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} width={36} />
                                    <Tooltip
                                      cursor={{ strokeDasharray: '3 3' }}
                                      content={({ payload }) => {
                                        if (!payload?.length) return null;
                                        const p = payload[0].payload as { x: number; y: number; label: string };
                                        const xDisplay = columnAnalysisData.isXNumeric ? p.x : (columnAnalysisData.effectiveXColName ? p.label : `#${p.x + 1}`);
                                        return (
                                          <div style={{ fontSize: 11, padding: '6px 10px', background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8 }}>
                                            <p style={{ color: '#64748b', marginBottom: 2 }}>{xAxisName}: {xDisplay}</p>
                                            <p><strong>{analysisColumn}</strong>: {p.y}</p>
                                          </div>
                                        );
                                      }}
                                    />
                                    <Scatter data={scatterData} fill={CHART_PALETTE[0]} />
                                  </ScatterChart>
                                );
                              } else if (effectiveType === 'line') {
                                if (!showPrimarySeries) {
                                  return (
                                    <div className="h-full flex items-center justify-center text-[11px] text-slate-400 border border-dashed border-slate-200 rounded-lg bg-slate-50/50">
                                      표시할 시리즈가 없습니다. 위에서 “전체 선택” 또는 컬럼을 선택하세요.
                                    </div>
                                  );
                                }
                                return (
                                  <LineChart data={columnExplorationLineData}>
                                    <XAxis dataKey="name" tick={{ fontSize: 9 }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                                    <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} width={36} />
                                    <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #e2e8f0' }} formatter={(v: number | null, name: string) => [v ?? '(결측)', name === 'value' ? analysisColumn : name]} />
                                    {columnAnalysisData.allClasses.length > 0 ? (
                                      <>
                                        <Legend wrapperStyle={{ fontSize: 10 }} />
                                        {columnAnalysisData.allClasses
                                          .filter((c) => analysisClassFilter.length === 0 || analysisClassFilter.includes(c))
                                          .map((cls, i) => (
                                            <Line key={cls} type="natural" dataKey={cls} stroke={CHART_PALETTE[i % CHART_PALETTE.length]}
                                              strokeWidth={2} dot={{ r: 4, strokeWidth: 2, fill: '#fff', stroke: CHART_PALETTE[i % CHART_PALETTE.length] }}
                                              connectNulls activeDot={{ r: 6 }} />
                                          ))}
                                      </>
                                    ) : (
                                      <Line type="natural" dataKey="value" stroke={CHART_PALETTE[0]} strokeWidth={2}
                                        dot={{ r: 4, strokeWidth: 2, fill: '#fff', stroke: CHART_PALETTE[0] }} connectNulls activeDot={{ r: 6 }} />
                                    )}
                                  </LineChart>
                                );
                              } else {
                                /* 막대 차트 */
                                return (
                                  <BarChart data={columnAnalysisData.chartData} barCategoryGap="30%">
                                    <XAxis dataKey="name" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                                    <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} width={36} />
                                    <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #e2e8f0' }} formatter={(v: number) => [v, analysisColumn]} />
                                    <Bar dataKey="value" fill={CHART_PALETTE[0]} radius={[3, 3, 0, 0]} />
                                  </BarChart>
                                );
                              }
                            } else if (columnAnalysisData.allClasses.length > 0) {
                              /* 범주형 + 분류: grouped bar */
                              return (
                                <BarChart data={columnAnalysisData.chartData} barCategoryGap="30%" barGap={2}>
                                  <XAxis dataKey="name" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                                  <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} width={24} />
                                  <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #e2e8f0' }} formatter={(v: number, name: string) => [`${v}건`, name]} />
                                  <Legend wrapperStyle={{ fontSize: 10 }} />
                                  {columnAnalysisData.allClasses
                                    .filter((c) => analysisClassFilter.length === 0 || analysisClassFilter.includes(c))
                                    .map((cls, i) => (
                                      <Bar key={cls} dataKey={cls} fill={CHART_PALETTE[i % CHART_PALETTE.length]} radius={[3, 3, 0, 0]} />
                                    ))}
                                </BarChart>
                              );
                            } else {
                              /* 범주형 + 회귀: 단일 bar */
                              return (
                                <BarChart data={columnAnalysisData.chartData} barCategoryGap="35%">
                                  <XAxis dataKey="name" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                                  <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} width={24} />
                                  <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #e2e8f0' }} formatter={(v: number) => [`${v}건`, '빈도']} />
                                  <Bar dataKey="count" fill={CHART_PALETTE[0]} radius={[3, 3, 0, 0]} />
                                </BarChart>
                              );
                            }
                          })()}
                        </ResponsiveContainer>
                        </div>
                        <p className="text-[10px] text-slate-500 mt-2 text-center border-t border-slate-100 pt-2">
                          차트는 미리보기 <strong className="text-slate-600">{dataPreview.rows.length}행</strong>(최대 {DATA_PREVIEW_MAX_ROWS}행) 기준입니다. 라인 차트는 행이 적고 X가 시간일 때 구간 보간으로 곡선을 보강합니다. 전체 파일과 다를 수 있습니다.
                        </p>
                      </>
                    ) : (
                      <div className="flex flex-col gap-2">
                        <div className="min-h-[140px] h-[clamp(140px,24dvh,220px)] flex items-center justify-center text-[11px] text-slate-400 border border-dashed border-slate-200 rounded-lg bg-slate-50/50">
                          {columnAnalysisData?.selectedIsTimeSeries
                            ? '다른 수치형 컬럼을 선택하세요'
                            : '컬럼을 선택하세요'}
                        </div>
                        <p className="text-[10px] text-slate-500 text-center">
                          미리보기 <strong className="text-slate-600">{dataPreview.rows.length}행</strong> · 최대 {DATA_PREVIEW_MAX_ROWS}행까지 로드
                        </p>
                      </div>
                    )}
                  </div>
                </section>

                {/* ── 데이터 증강 전/후 (컬럼 탐색 Y축 컬럼 기준) ── */}
                <section className="bg-white p-4 sm:p-5 rounded-xl border border-slate-200 shadow-sm mb-4 overflow-hidden">
                  <div className="flex flex-wrap items-start justify-between gap-2 mb-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                        <Shuffle className="w-3.5 h-3.5 text-indigo-500" />
                        데이터 증강 전/후
                      </p>
                      {preprocChartData.timeseriesData && eligibleAugWaveColumns.length > 0 ? (
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="text-[10px] text-slate-500 shrink-0">파형 기준</span>
                          {eligibleAugWaveColumns.length === 1 ? (
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-100">
                              {eligibleAugWaveColumns[0]}
                            </span>
                          ) : (
                            <select
                              value={augWaveColumn}
                              onChange={(e) => setAugWaveColumn(e.target.value)}
                              className="text-[10px] font-semibold rounded-md border border-indigo-200 bg-white text-indigo-800 px-2 py-0.5 max-w-[200px] sm:max-w-[260px] truncate cursor-pointer focus:outline-none focus-visible:ring-1 focus-visible:ring-indigo-400"
                              aria-label="시계열 증강 파형 기준 컬럼"
                              title={augWaveColumn || undefined}
                            >
                              {eligibleAugWaveColumns.map((h) => (
                                <option key={h} value={h}>{h}</option>
                              ))}
                            </select>
                          )}
                          {analysisColumn && analysisColumn !== augWaveColumn && (
                            <span className="text-[9px] text-slate-400 max-sm:hidden" title="컬럼 탐색에서 선택한 Y축">
                              탐색 Y: {analysisColumn}
                            </span>
                          )}
                        </div>
                      ) : analysisColumn ? (
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-100">
                          컬럼: {analysisColumn}
                        </span>
                      ) : null}
                    </div>
                    <div className="flex items-center gap-3 text-[10px]">
                      {preprocChartData.irBefore !== null && (
                        <div className="flex items-center gap-1">
                          <span className="text-slate-400">불균형 비율</span>
                          <span className="font-semibold text-red-500">{preprocChartData.irBefore}x</span>
                          {preprocConfig.smoteEnabled && preprocChartData.irAfter !== null && (
                            <>
                              <span className="text-slate-300">→</span>
                              <span className={`font-semibold ${preprocChartData.irAfter <= 1.2 ? 'text-emerald-600' : 'text-amber-500'}`}>
                                {preprocChartData.irAfter}x
                              </span>
                            </>
                          )}
                        </div>
                      )}
                      {(preprocChartData.stackedData && preprocChartData.stackedData.length > 0) || preprocChartData.timeseriesData ? (
                        <div className="flex items-center gap-0.5 bg-slate-100 rounded-lg p-0.5">
                          {([
                            ['bar', 'Bar'],
                            ['area', 'Stacked Area'],
                            ...(preprocChartData.timeseriesData ? ([['ratio', 'Ratio']] as const) : []),
                          ] as const).map(([mode, label]) => (
                            <button
                              key={mode}
                              type="button"
                              onClick={() => setAugmentationChartType(mode as 'bar' | 'area' | 'ratio')}
                              className={`px-2 py-0.5 rounded-md text-[10px] font-semibold transition-colors ${
                                augmentationChartType === mode
                                  ? 'bg-white text-slate-700 shadow-sm'
                                  : 'text-slate-400 hover:text-slate-600'
                              }`}
                            >
                              {label}
                            </button>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  </div>
                  {preprocChartData.stackedData && preprocChartData.stackedData.length > 0 ? (
                    <>
                      <p className="text-[10px] text-slate-400 mb-2">
                        {preprocConfig.smoteEnabled
                          ? '막대 아래(진한색)는 클래스별 원본, 위쪽 보라 층은 시뮬레이션 기반 SMOTE 합성 건수입니다.'
                          : '현재 클래스 분포 · SMOTE 활성화 시 합성 레이어가 추가됩니다'}
                      </p>
                      <div className="w-full min-h-[140px] h-[clamp(140px,22dvh,220px)]">
                      <ResponsiveContainer width="100%" height="100%">
                        {augmentationChartType === 'bar' ? (
                          <BarChart data={preprocChartData.stackedData} barCategoryGap="32%">
                            <XAxis dataKey="name" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                            <YAxis
                              tick={{ fontSize: 10 }}
                              axisLine={false}
                              tickLine={false}
                              width={42}
                              tickFormatter={(v: number) => (v >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(v))}
                            />
                            <Tooltip
                              contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #e2e8f0' }}
                              formatter={(v: number, name: string) => [
                                `${v.toLocaleString()}건`,
                                name === '원본' ? '원본 데이터' : 'SMOTE 합성(시뮬)',
                              ]}
                            />
                            <Legend
                              wrapperStyle={{ fontSize: 10 }}
                              formatter={(v: string) => (v === '원본' ? '원본 데이터' : 'SMOTE 합성(시뮬)')}
                            />
                            <Bar
                              dataKey="원본"
                              stackId="s"
                              radius={preprocConfig.smoteEnabled ? [0, 0, 3, 3] : [3, 3, 3, 3]}
                            >
                              {preprocChartData.stackedData.map((d, i) => (
                                <Cell
                                  key={d.name}
                                  fill={
                                    preprocConfig.smoteEnabled
                                      ? CHART_PALETTE[i % CHART_PALETTE.length]
                                      : '#94a3b8'
                                  }
                                />
                              ))}
                            </Bar>
                            {preprocConfig.smoteEnabled && (
                              <Bar
                                dataKey="합성"
                                stackId="s"
                                radius={[3, 3, 0, 0]}
                                fill="#818cf8"
                                fillOpacity={0.9}
                              />
                            )}
                          </BarChart>
                        ) : (
                          <AreaChart data={preprocChartData.stackedData} stackOffset="none">
                            <XAxis dataKey="name" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                            <YAxis
                              tick={{ fontSize: 10 }}
                              axisLine={false}
                              tickLine={false}
                              width={42}
                              tickFormatter={(v: number) => (v >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(v))}
                            />
                            <Tooltip
                              contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #e2e8f0' }}
                              formatter={(v: number, name: string) => [
                                `${v.toLocaleString()}건`,
                                name === '원본' ? '원본 데이터' : 'SMOTE 합성(시뮬)',
                              ]}
                            />
                            <Legend
                              wrapperStyle={{ fontSize: 10 }}
                              formatter={(v: string) => (v === '원본' ? '원본 데이터' : 'SMOTE 합성(시뮬)')}
                            />
                            <Area
                              type="monotone"
                              dataKey="원본"
                              stackId="s"
                              stroke="#64748b"
                              fill={preprocConfig.smoteEnabled ? '#6366f199' : '#94a3b8'}
                              fillOpacity={0.8}
                            />
                            {preprocConfig.smoteEnabled && (
                              <Area
                                type="monotone"
                                dataKey="합성"
                                stackId="s"
                                stroke="#818cf8"
                                fill="#818cf855"
                                fillOpacity={0.7}
                              />
                            )}
                          </AreaChart>
                        )}
                      </ResponsiveContainer>
                      </div>
                    </>
                  ) : preprocChartData.timeseriesData ? (
                    <>
                      <p className="text-[10px] text-slate-400 mb-2">
                        시계열·SMOTE 증강 전/후 누적 (분리 스택) · <span className="font-semibold text-slate-600">{preprocChartData.augWaveColumnEffective}</span> 기준 (
                        {preprocConfig.timeseriesStrategy === 'window' ? 'window slicing' : 'jitter'})
                      </p>
                      {augmentationChartType === 'bar' ? (
                        <div className="w-full min-h-[160px] h-[clamp(160px,26dvh,220px)] flex flex-col sm:flex-row gap-4">
                          <div className="flex-1 min-w-0 flex flex-col min-h-0">
                            <p className="text-[9px] text-slate-500 text-center shrink-0">원본만</p>
                            <div className="flex-1 min-h-0 w-full">
                              <ResponsiveContainer width="100%" height="100%">
                                <BarChart
                                  data={preprocChartData.timeseriesOriginalOnly ?? []}
                                  margin={{ top: 2, right: 2, left: 2, bottom: 0 }}
                                  barCategoryGap="35%"
                                >
                                  <XAxis dataKey="name" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                                  <YAxis
                                    domain={[0, preprocChartData.timeseriesYMax]}
                                    tick={{ fontSize: 10 }}
                                    axisLine={false}
                                    tickLine={false}
                                    width={36}
                                    tickFormatter={(v: number) => (v >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(v))}
                                  />
                                  <Tooltip
                                    contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #e2e8f0' }}
                                    formatter={(v: number) => [`${v.toLocaleString()}건`, '원본']}
                                  />
                                  <Bar dataKey="원본" fill="#94a3b8" radius={[3, 3, 0, 0]} />
                                </BarChart>
                              </ResponsiveContainer>
                            </div>
                          </div>
                          <div className="flex-1 min-w-0 flex flex-col min-h-0">
                            <p className="text-[9px] text-slate-500 text-center shrink-0">증강 후 누적</p>
                            <div className="flex-1 min-h-0 w-full">
                              <ResponsiveContainer width="100%" height="100%">
                                <BarChart
                                  data={preprocChartData.timeseriesData ?? []}
                                  margin={{ top: 2, right: 2, left: 2, bottom: 0 }}
                                  barCategoryGap="35%"
                                >
                                  <XAxis dataKey="name" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                                  <YAxis
                                    domain={[0, preprocChartData.timeseriesYMax]}
                                    tick={{ fontSize: 10 }}
                                    axisLine={false}
                                    tickLine={false}
                                    width={36}
                                    tickFormatter={(v: number) => (v >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(v))}
                                  />
                                  <Tooltip
                                    contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #e2e8f0' }}
                                    formatter={(v: number, name: string) => [
                                      `${v.toLocaleString()}건`,
                                      name === '원본'
                                        ? '원본 데이터'
                                        : (name === 'SMOTE' ? 'SMOTE 합성(시뮬)' : '시계열 증강(시뮬)'),
                                    ]}
                                  />
                                  <Legend
                                    wrapperStyle={{ fontSize: 10 }}
                                    formatter={(v: string) => (
                                      v === '원본'
                                        ? '원본'
                                        : v === 'SMOTE'
                                          ? 'SMOTE 합성'
                                          : '시계열 증강'
                                    )}
                                  />
                                  <Bar dataKey="원본" stackId="ts" fill="#94a3b8" radius={[0, 0, 3, 3]} />
                                  {preprocConfig.smoteEnabled && (
                                    <Bar dataKey="SMOTE" stackId="ts" fill="#818cf8aa" />
                                  )}
                                  <Bar dataKey="시계열" stackId="ts" fill="#0ea5e955" radius={[3, 3, 0, 0]} />
                                </BarChart>
                              </ResponsiveContainer>
                            </div>
                          </div>
                        </div>
                      ) : augmentationChartType === 'ratio' ? (
                        <div className="w-full min-h-0 grid grid-cols-1 md:grid-cols-2 gap-3 auto-rows-fr">
                          {(() => {
                            const timeseriesAdded = preprocChartData.timeseriesAdded;
                            const smoteAdded = preprocChartData.smoteAdded;
                            const totalAdded = Math.max(0, preprocChartData.afterCount - preprocChartData.baseCount);
                            const totalTimeseries = Math.max(preprocChartData.baseCount + timeseriesAdded, 1);
                            const totalOverall = Math.max(preprocChartData.afterCount, 1);
                            const timeseriesRatioData = [
                              { name: '원본', value: preprocChartData.baseCount, color: '#94a3b8' },
                              { name: '시계열 증강', value: timeseriesAdded, color: '#7dd3fc' },
                            ];
                            /** 오른쪽 도넛: SMOTE·시계열을 합치지 않고 나누어 SMOTE만의 비중을 바로 읽을 수 있게 함 */
                            const overallRatioData =
                              smoteAdded > 0 && timeseriesAdded > 0
                                ? [
                                    { name: '원본', value: preprocChartData.baseCount, color: '#94a3b8' },
                                    { name: 'SMOTE 합성', value: smoteAdded, color: '#818cf8' },
                                    { name: '시계열 증강', value: timeseriesAdded, color: '#7dd3fc' },
                                  ]
                                : smoteAdded > 0
                                  ? [
                                      { name: '원본', value: preprocChartData.baseCount, color: '#94a3b8' },
                                      { name: 'SMOTE 합성', value: smoteAdded, color: '#818cf8' },
                                    ]
                                  : timeseriesAdded > 0
                                    ? [
                                        { name: '원본', value: preprocChartData.baseCount, color: '#94a3b8' },
                                        { name: '시계열 증강', value: timeseriesAdded, color: '#7dd3fc' },
                                      ]
                                    : [
                                        { name: '원본', value: preprocChartData.baseCount, color: '#94a3b8' },
                                        { name: '증강', value: totalAdded, color: '#cbd5e1' },
                                      ];
                            const overallCaption = overallRatioData
                              .filter((d) => d.value > 0)
                              .map((d) => `${d.name} ${((d.value / totalOverall) * 100).toFixed(1)}%`)
                              .join(' · ');
                            return (
                              <>
                                <div className="rounded-lg border border-slate-200 bg-slate-50/30 p-2 min-w-0">
                                  <p className="text-[10px] font-semibold text-slate-600 text-center">시계열 증강 비율</p>
                                  <div className="w-full min-h-[100px] h-[clamp(100px,18dvh,150px)] sm:h-[132px]">
                                    <ResponsiveContainer width="100%" height="100%">
                                      <PieChart>
                                        <Pie data={timeseriesRatioData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius="56%" outerRadius="82%" paddingAngle={1} strokeWidth={0}>
                                          {timeseriesRatioData.map((d) => <Cell key={d.name} fill={d.color} />)}
                                        </Pie>
                                        <Tooltip
                                          contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #e2e8f0' }}
                                          formatter={(v: number, name: string) => [
                                            `${v.toLocaleString()}건 (${((v / totalTimeseries) * 100).toFixed(1)}%)`,
                                            name,
                                          ]}
                                        />
                                      </PieChart>
                                    </ResponsiveContainer>
                                  </div>
                                  <p className="text-[9px] text-slate-500 text-center -mt-1">
                                    원본 {((preprocChartData.baseCount / totalTimeseries) * 100).toFixed(1)}% · 시계열 {((timeseriesAdded / totalTimeseries) * 100).toFixed(1)}%
                                  </p>
                                </div>
                                <div className="rounded-lg border border-slate-200 bg-slate-50/30 p-2 min-w-0">
                                  <p className="text-[10px] font-semibold text-slate-600 text-center">전체 데이터 증강 비율</p>
                                  <div className="w-full min-h-[100px] h-[clamp(100px,18dvh,150px)] sm:h-[132px]">
                                    <ResponsiveContainer width="100%" height="100%">
                                      <PieChart>
                                        <Pie data={overallRatioData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius="56%" outerRadius="82%" paddingAngle={1} strokeWidth={0}>
                                          {overallRatioData.map((d) => <Cell key={d.name} fill={d.color} />)}
                                        </Pie>
                                        <Tooltip
                                          contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #e2e8f0' }}
                                          formatter={(v: number, name: string) => [
                                            `${v.toLocaleString()}건 (${((v / totalOverall) * 100).toFixed(1)}%)`,
                                            name,
                                          ]}
                                        />
                                      </PieChart>
                                    </ResponsiveContainer>
                                  </div>
                                  <p className="text-[9px] text-slate-500 text-center -mt-1">
                                    {overallCaption || `원본 ${((preprocChartData.baseCount / totalOverall) * 100).toFixed(1)}%`}
                                  </p>
                                </div>
                              </>
                            );
                          })()}
                        </div>
                      ) : (
                        <div className="w-full flex flex-col gap-1.5 min-w-0">
                          <div className="w-full min-h-[180px] h-[clamp(180px,30dvh,260px)]">
                          <ResponsiveContainer width="100%" height="100%">
                            <ComposedChart
                              data={preprocChartData.columnTimeseriesWave?.data ?? []}
                              margin={{ top: 8, right: 12, left: 0, bottom: 4 }}
                            >
                              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                              <XAxis
                                type="number"
                                dataKey="x"
                                domain={['dataMin', 'dataMax']}
                                tick={{ fontSize: 10 }}
                                axisLine={false}
                                tickLine={false}
                                tickFormatter={(v: number) => (v >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(v))}
                                label={{
                                  value:
                                    preprocChartData.columnTimeseriesWave?.source === 'column_sample'
                                      ? `레코드 인덱스 · ${preprocChartData.augWaveColumnEffective} (샘플·스플라인)`
                                      : '레코드 인덱스 (시뮬)',
                                  position: 'insideBottom',
                                  offset: -2,
                                  fontSize: 9,
                                  fill: '#94a3b8',
                                }}
                              />
                              <YAxis
                                domain={preprocChartData.columnTimeseriesWave?.yDomain ?? [0, 200]}
                                tick={{ fontSize: 10 }}
                                axisLine={false}
                                tickLine={false}
                                width={44}
                              />
                              <Tooltip
                                contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #e2e8f0' }}
                                formatter={(v: number, name: string) => [
                                  typeof v === 'number' ? v.toFixed(1) : String(v),
                                  name === '원본'
                                    ? `원본 · ${preprocChartData.augWaveColumnEffective}`
                                    : name === 'SMOTE'
                                      ? `SMOTE 합성 · ${preprocChartData.augWaveColumnEffective}`
                                      : `시계열 증강 · ${preprocChartData.augWaveColumnEffective}`,
                                ]}
                                labelFormatter={(label) => `인덱스 ≈ ${label}`}
                              />
                              {preprocChartData.columnTimeseriesWave &&
                                preprocChartData.baseCount > 0 &&
                                preprocChartData.timeseriesAdded > 0 && (
                                <ReferenceLine
                                  x={preprocChartData.columnTimeseriesWave.splitX}
                                  stroke="#94a3b8"
                                  strokeDasharray="4 4"
                                  strokeOpacity={0.7}
                                />
                              )}
                              <Legend
                                wrapperStyle={{ fontSize: 10 }}
                                verticalAlign="bottom"
                                formatter={(v: string) => (
                                  v === '원본' ? '원본' : v === 'SMOTE' ? 'SMOTE 합성' : '시계열 증강'
                                )}
                              />
                              <Area
                                type="monotone"
                                dataKey="원본"
                                connectNulls={false}
                                stroke="#0d9488"
                                strokeWidth={1}
                                fill="#2dd4bf"
                                fillOpacity={0.45}
                                name="원본"
                                isAnimationActive={false}
                              />
                              {preprocConfig.smoteEnabled && preprocChartData.smoteAdded > 0 && (
                                <Area
                                  type="monotone"
                                  dataKey="SMOTE"
                                  connectNulls={false}
                                  stroke="#6366f1"
                                  strokeWidth={1}
                                  fill="#818cf8"
                                  fillOpacity={0.42}
                                  name="SMOTE"
                                  isAnimationActive={false}
                                />
                              )}
                              <Area
                                type="monotone"
                                dataKey="시계열"
                                connectNulls={false}
                                stroke="#0284c7"
                                strokeWidth={1}
                                fill="#7dd3fc"
                                fillOpacity={0.5}
                                name="시계열"
                                isAnimationActive={false}
                              />
                            </ComposedChart>
                          </ResponsiveContainer>
                          </div>
                          <p className="text-[9px] text-slate-400 text-center">
                            {preprocChartData.columnTimeseriesWave?.source === 'column_sample'
                              ? `Y축은 「${preprocChartData.augWaveColumnEffective}」 미리보기(최대 ${DATA_PREVIEW_MAX_ROWS}행) 기반 스플라인 추정이며, 증강 구간은 SMOTE·시계열을 분리해 시각용 미세 변동(리플·지터)으로 표시한 시뮬입니다.`
                              : '원본 구간 뒤 증강 구간이 이어지며, SMOTE·시계열 레이어를 분리해 보여줍니다. 비수치·샘플 부족 시 전역 시뮬 파형을 사용합니다.'}
                          </p>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="flex flex-col items-center justify-center min-h-[140px] h-[clamp(140px,22dvh,200px)] text-center gap-1.5">
                      <Shuffle className="w-7 h-7 text-slate-200" />
                      <p className="text-[11px] font-semibold text-slate-400 mt-1">증강 비교 대상이 없습니다</p>
                      <p className="text-[10px] text-slate-400">분류 클래스 또는 시계열 컬럼이 감지되면 증강 전/후 비교가 표시됩니다.</p>
                    </div>
                  )}
                </section>

                {/* ── 데이터 품질 지표 ── */}
                <div className="mb-4">
                  {/* 데이터 품질 지표 */}
                  <section className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                    <div className="flex flex-wrap items-start justify-between gap-2 mb-1">
                      <p className="text-xs font-bold text-slate-700 flex items-center gap-1.5 flex-wrap">
                        <BarChart3 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                        데이터 품질 지표
                        {selectedTemplate && (
                          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${templateWantsQuality ? 'text-emerald-700 bg-emerald-50 border-emerald-100' : 'text-slate-500 bg-slate-50 border-slate-200'}`}>
                            {templateWantsQuality ? '템플릿 포함' : '템플릿 미포함'}
                          </span>
                        )}
                      </p>
                      <div className="flex items-center gap-0.5 bg-slate-100 rounded-lg p-0.5 shrink-0" role="tablist" aria-label="품질 지표 종류">
                        {([
                          ['missing', '결측치'],
                          ['outliers', '이상치'],
                        ] as const).map(([key, label]) => (
                          <button
                            key={key}
                            type="button"
                            role="tab"
                            aria-selected={qualityMetricView === key}
                            onClick={() => setQualityMetricView(key)}
                            className={`px-2 py-0.5 rounded-md text-[10px] font-semibold transition-colors ${
                              qualityMetricView === key
                                ? 'bg-white text-slate-700 shadow-sm'
                                : 'text-slate-400 hover:text-slate-600'
                            }`}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    </div>
                    <p className="text-[10px] text-slate-400 mb-3">
                      {qualityMetricView === 'missing'
                        ? '결측치 처리 효과 (전처리 전 → 후)'
                        : '전처리 전·후를 나란히 비교합니다. 각 그래프에서 빨간색은 이상치, 회색은 그 외(정상) 비율입니다.'}
                    </p>
                    {qualityMetricView === 'missing' ? (
                      !dataProfile ? (
                        <QualityChartEmptyState
                          icon={Upload}
                          title="데이터 프로파일이 없습니다"
                          description="데이터 준비 탭에서 파일을 업로드·분석을 진행하면 결측치 건수가 막대 그래프로 표시됩니다."
                        />
                      ) : preprocChartData.qualityMissing.before <= 0 ? (
                        <QualityChartEmptyState
                          icon={CheckCircle2}
                          title="표시할 결측치가 없습니다"
                          description="현재 프로파일 기준 결측 건수가 0입니다. 전처리 적용 후 결측은 0건으로 가정한 비교이므로 막대가 생기지 않습니다."
                        />
                      ) : (
                      <>
                        <div className="w-full min-h-[120px] h-[clamp(120px,20dvh,200px)]">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={[preprocChartData.qualityMissing]} barCategoryGap="35%" barGap={3}>
                            <XAxis dataKey="name" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                            <YAxis
                              tick={{ fontSize: 10 }}
                              axisLine={false}
                              tickLine={false}
                              width={28}
                              domain={[0, (dataMax: number) => Math.max(Number(dataMax) || 0, 1) * 1.05]}
                            />
                            <Tooltip
                              contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #e2e8f0' }}
                              formatter={(v: number, name: string) => {
                                const seriesLabel = name === 'before' ? '전처리 전' : '전처리 후';
                                return [String(v), seriesLabel];
                              }}
                            />
                            <Bar dataKey="before" name="before" fill="#fca5a5" radius={[3, 3, 0, 0]} />
                            <Bar dataKey="after" name="after" fill="#86efac" radius={[3, 3, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                        </div>
                        <div className="flex items-center gap-3 mt-1 justify-center">
                          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-red-300 inline-block" /><span className="text-[10px] text-slate-500">전처리 전</span></span>
                          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-green-300 inline-block" /><span className="text-[10px] text-slate-500">전처리 후</span></span>
                        </div>
                      </>
                      )
                    ) : (
                      <>
                        {!dataProfile ? (
                          <QualityChartEmptyState
                            icon={AlertTriangle}
                            title="데이터 프로파일이 없습니다"
                            description="업로드 후 프로파일이 생성되면 전처리 전·후 이상치 비율을 나란히 비교할 수 있습니다."
                          />
                        ) : (
                        (() => {
                          const clampPct = (n: number) => Math.min(100, Math.max(0, n));
                          const b = clampPct(preprocChartData.qualityOutlier.before);
                          const a = clampPct(preprocChartData.qualityOutlier.after);
                          const pieFromOutlierPct = (pct: number) => [
                            { name: '이상치', value: pct },
                            { name: '정상', value: Math.max(0, 100 - pct) },
                          ];
                          const beforePie = pieFromOutlierPct(b);
                          const afterPie = pieFromOutlierPct(a);
                          const pieColors = ['#fca5a5', '#cbd5e1'];
                          return (
                            <div className="flex flex-col sm:flex-row w-full min-h-[140px] h-[clamp(140px,26dvh,200px)] sm:h-[160px] items-stretch gap-2">
                              {([
                                { label: '전처리 전', data: beforePie },
                                { label: '전처리 후', data: afterPie },
                              ] as const).map(({ label, data }) => (
                                <div key={label} className="flex-1 flex flex-col items-center min-w-0 min-h-0">
                                  <div className="flex-1 min-h-0 w-full">
                                    <ResponsiveContainer width="100%" height="100%">
                                      <PieChart>
                                        <Pie
                                          data={data}
                                          dataKey="value"
                                          nameKey="name"
                                          cx="50%"
                                          cy="50%"
                                          innerRadius="52%"
                                          outerRadius="78%"
                                          paddingAngle={1}
                                          strokeWidth={0}
                                        >
                                          {data.map((_, i) => (
                                            <Cell key={i} fill={pieColors[i]} />
                                          ))}
                                        </Pie>
                                        <Tooltip
                                          contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #e2e8f0' }}
                                          formatter={(v: number, n: string) => [`${v}%`, n]}
                                        />
                                      </PieChart>
                                    </ResponsiveContainer>
                                  </div>
                                  <span className="text-[9px] text-slate-500 shrink-0 pt-0.5">{label}</span>
                                </div>
                              ))}
                            </div>
                          );
                        })()
                        )}
                        <div className="flex items-center gap-3 mt-1 justify-center flex-wrap">
                          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-red-300 inline-block" /><span className="text-[10px] text-slate-500">이상치</span></span>
                          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-slate-300 inline-block" /><span className="text-[10px] text-slate-500">정상</span></span>
                        </div>
                      </>
                    )}
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
                        +{(preprocChartData.afterCount - preprocChartData.baseCount).toLocaleString()} (증강)
                      </p>
                    )}
                  </div>
                </div>
              </>
            )}

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
                    <span
                      className="text-[10px] font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-full border border-slate-200 tabular-nums"
                      title={`전처리 탭 차트·컬럼 탐색과 동일한 미리보기 ${dataPreview.rows.length}행입니다. 표는 약 ${SAMPLE_TABLE_VISIBLE_BODY_ROWS}행 높이로 보이며 세로 스크롤로 나머지를 볼 수 있습니다.`}
                    >
                      미리보기 {dataPreview.rows.length}행 · {dataPreview.headers.length}열
                    </span>
                  )}
                </div>
                {dataPreview ? (
                  <>
                    <div
                      className="overflow-x-auto overflow-y-auto overscroll-y-contain border-b border-slate-100"
                      style={{ maxHeight: sampleTableBodyScrollMaxHeight }}
                    >
                      <table className="min-w-full text-xs">
                        <thead>
                          <tr className="border-b border-slate-100">
                            <th className="sticky top-0 z-[1] px-3 py-2 text-slate-300 font-semibold text-center w-8 shrink-0 bg-slate-50 shadow-[0_1px_0_0_rgb(226_232_240)]">
                              #
                            </th>
                            {dataPreview.headers.map((h, i) => (
                              <th
                                key={i}
                                className={`sticky top-0 z-[1] px-3 py-2 text-left font-semibold whitespace-nowrap shadow-[0_1px_0_0_rgb(226_232_240)] ${
                                  i === selectedLabelIndex
                                    ? 'text-indigo-600 bg-indigo-50'
                                    : 'text-slate-600 bg-slate-50'
                                }`}
                              >
                                {h}
                                {i === selectedLabelIndex && (
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
                                const useStringHighlight =
                                  isNonNumeric && !originalPreviewTimeColumnIndices.has(ci);
                                return (
                                  <td
                                    key={ci}
                                    className={`px-3 py-1.5 whitespace-nowrap font-mono ${
                                      isTarget
                                        ? 'font-semibold text-indigo-600 bg-indigo-50/30'
                                        : useStringHighlight
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
                      {dataPreview.rows.length > SAMPLE_TABLE_VISIBLE_BODY_ROWS && (
                        <span className="text-[9px] text-slate-400 ml-auto">세로 스크롤로 나머지 행 확인</span>
                      )}
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
                  <span
                    className="text-[10px] text-indigo-500 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-200"
                    title={`원본과 동일 ${preprocAfterSample?.rows.length ?? 0}행 미리보기. 표는 약 ${SAMPLE_TABLE_VISIBLE_BODY_ROWS}행 높이로 보이며 스크롤로 전체를 볼 수 있습니다.`}
                  >
                    설정 연동
                  </span>
                </div>
                {preprocAfterSample ? (
                  <>
                    <div
                      className="overflow-x-auto overflow-y-auto overscroll-y-contain border-b border-slate-100"
                      style={{ maxHeight: sampleTableBodyScrollMaxHeight }}
                    >
                      <table className="min-w-full text-xs">
                        <thead>
                          <tr className="border-b border-slate-100">
                            <th className="sticky top-0 z-[1] px-3 py-2 text-slate-300 font-semibold text-center w-8 shrink-0 bg-indigo-50 shadow-[0_1px_0_0_rgb(226_232_240)]">
                              #
                            </th>
                            {preprocAfterSample.headers.map((h, i) => (
                              <th
                                key={i}
                                className={`sticky top-0 z-[1] px-3 py-2 text-left font-semibold whitespace-nowrap shadow-[0_1px_0_0_rgb(226_232_240)] ${
                                  i === selectedLabelIndex
                                    ? 'text-indigo-600 bg-indigo-50'
                                    : 'text-slate-600 bg-indigo-50'
                                }`}
                              >
                                {h}
                                {i === selectedLabelIndex && (
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
                      {preprocAfterSample.rows.length > SAMPLE_TABLE_VISIBLE_BODY_ROWS && (
                        <span className="text-[9px] text-slate-400">세로 스크롤로 나머지 행 확인</span>
                      )}
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
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-start gap-3 mb-4">
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
                  <p>시계열 증강: {preprocConfig.timeseriesEnabled ? `활성화 (${preprocConfig.timeseriesStrategy})` : '비활성화'}</p>
                </div>
              </div>
            )}

            {/* ── 전처리 완료 → 분석 실행 CTA ── */}
            <div className="mt-2 mb-2">
              <button
                type="button"
                onClick={() => { setPreprocCompleted(true); setCurrentNav('run'); }}
                className="w-full flex items-center justify-center gap-2 px-6 py-3.5 text-sm font-bold rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 shadow-md hover:shadow-lg transition-all"
              >
                <CheckCircle2 className="w-4 h-4" />
                전처리 완료 → 분석 실행
              </button>
              <p className="text-center text-[10px] text-slate-400 mt-1.5">설정을 확인한 후 분석 실행 탭으로 이동합니다</p>
            </div>
          </div>
        )}

        {/* 2. 분석 실행 */}
        {currentNav === 'run' && (
          <div key="run-view" className="p-4 sm:p-6 lg:p-8 w-full max-w-2xl mx-auto min-w-0" data-view="run">
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
                  <span className="text-[10px] text-emerald-700 font-medium">전처리 설정 적용됨 (SMOTE: {preprocConfig.smoteEnabled ? '활성화' : '비활성화'} · 시계열: {preprocConfig.timeseriesEnabled ? '활성화' : '비활성화'})</span>
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
          <div key="result" className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6 min-w-0 w-full">
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
                  {/* AutoML 추천 리스트: 전체 모델 순위, 시각화, 전처리 방법 */}
                  {(automlResult || analysisResult) && (
                    <div className="bg-white p-5 sm:p-6 rounded-xl border border-slate-200 shadow-sm">
                      <h3 className="text-base font-bold text-slate-800 mb-4 flex items-center gap-2">
                        <BrainCircuit className="w-4 h-4 text-indigo-600" />
                        AutoML 추천 리스트
                      </h3>

                      {automlResult && automlScoreboard && (
                        <>
                          {/* 모델 점수 시각화 — 툴바로 주/보조 지표 전환, 차트·순위와 동기화 */}
                          <div className="mb-5">
                            {(() => {
                              const sb = automlScoreboard;
                              const primaryLabel = sb.primaryLabel;
                              const auxLabel = sb.auxLabel;
                              const isMae = sb.isMae;
                              const resultsMap = new Map((automlResult.all_results ?? []).map((r) => [r.model, r]));
                              const fmtAuxTooltip = (r: AutomlResultRow) =>
                                r.aux_score != null && Number.isFinite(Number(r.aux_score))
                                  ? isMae
                                    ? Math.abs(Number(r.aux_score)).toFixed(4)
                                    : `${(Math.abs(Number(r.aux_score)) * 100).toFixed(2)}%`
                                  : null;
                              return (
                                <>
                                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between gap-y-2 mb-3">
                                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                                      모델별 점수 — {sb.activeLabel}
                                    </p>
                                    {sb.hasAuxData && (
                                      <div
                                        className="flex flex-wrap items-center gap-1.5 shrink-0"
                                        role="toolbar"
                                        aria-label="모델 점수 지표 전환"
                                      >
                                        <span className="text-[10px] text-slate-400 hidden sm:inline">지표</span>
                                        <div className="inline-flex rounded-lg border border-slate-200/90 bg-slate-100/70 p-0.5 gap-0.5">
                                          <button
                                            type="button"
                                            onClick={() => setAutomlScoreMetric('primary')}
                                            title={sb.primaryMetricHelp}
                                            className={`px-2.5 py-1 text-[11px] font-medium rounded-md transition-colors ${
                                              !sb.useAux
                                                ? 'bg-white text-slate-800 shadow-sm'
                                                : 'text-slate-500 hover:text-slate-700'
                                            }`}
                                          >
                                            {primaryLabel}
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => setAutomlScoreMetric('aux')}
                                            title={sb.auxMetricHelp}
                                            className={`px-2.5 py-1 text-[11px] font-medium rounded-md transition-colors ${
                                              sb.useAux
                                                ? 'bg-white text-slate-800 shadow-sm'
                                                : 'text-slate-500 hover:text-slate-700'
                                            }`}
                                          >
                                            {auxLabel}
                                          </button>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                  <div className="w-full min-h-[10rem]" style={{ height: `clamp(10rem, ${Math.max(10, (automlResult.all_results?.length ?? 5) * 2.2)}rem, 28rem)` }}>
                                    <ResponsiveContainer width="100%" height="100%">
                                      <BarChart data={sb.chartData} layout="vertical" margin={{ top: 4, right: 8, left: 8, bottom: 4 }}>
                                        <XAxis
                                          type="number"
                                          domain={[0, sb.chartBarMax]}
                                          tick={{ fontSize: 10 }}
                                          tickFormatter={sb.xTickFormatter}
                                        />
                                        <YAxis type="category" dataKey="name" width={130} tick={{ fontSize: 11 }} />
                                        <Tooltip
                                          content={({ active, payload }) => {
                                            if (!active || !payload?.length) return null;
                                            const modelName = payload[0]?.payload?.name as string;
                                            const r = resultsMap.get(modelName);
                                            if (!r) return null;
                                            const auxVal = fmtAuxTooltip(r);
                                            return (
                                              <div className="bg-slate-800 text-white text-xs rounded-lg px-3 py-2 shadow-lg flex flex-col gap-1">
                                                <span className="font-semibold text-slate-300">{modelName}</span>
                                                <span>{primaryLabel}: <strong>{(r.mean_score * 100).toFixed(2)}%</strong></span>
                                                {r.std_score != null && <span>Std (CV): <strong>±{(r.std_score * 100).toFixed(2)}%</strong></span>}
                                                {auxLabel && auxVal && <span>{auxLabel}: <strong>{auxVal}</strong></span>}
                                              </div>
                                            );
                                          }}
                                        />
                                        <Bar dataKey="barValue" radius={[0, 4, 4, 0]} name={sb.activeLabel}>
                                          {sb.chartData.map((_, i) => (
                                            <Cell key={i} fill={['#4f46e5', '#6366f1', '#818cf8', '#a5b4fc', '#c7d2fe', '#e0e7ff', '#f1f5f9', '#94a3b8', '#cbd5e1', '#e2e8f0'][i] ?? '#94a3b8'} />
                                          ))}
                                        </Bar>
                                      </BarChart>
                                    </ResponsiveContainer>
                                  </div>
                                </>
                              );
                            })()}
                          </div>

                          {/* 모델 순위 표 + 모델별 전처리·시각화 테이블을 한 카드로 묶음 */}
                          <div className="mb-5 rounded-xl border border-slate-200 bg-slate-50/40 p-4 sm:p-5 space-y-5">
                            <div>
                              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">모델 순위</p>
                              {(() => {
                              const sb = automlScoreboard;
                              const list = sb.sorted;
                              const primaryLabel = sb.primaryLabel;
                              const auxLabel = sb.auxLabel;
                              const isMae = sb.isMae;
                              const showStdCol = list.some((r) => r.std_score != null);
                              const showSecondCol = sb.hasAuxData;
                              const secondColLabel = sb.useAux ? primaryLabel : (auxLabel ?? '');
                              const rowClass = (i: number) =>
                                [
                                  'bg-amber-50/90 text-amber-900 border-l-2 border-amber-300',
                                  'bg-slate-50 text-slate-800 border-l-2 border-slate-300',
                                  'bg-orange-50/90 text-orange-900 border-l-2 border-orange-300',
                                  'bg-white text-slate-700',
                                  'bg-white text-slate-700',
                                ][i] ?? 'bg-white text-slate-600';
                              const cellActive = (r: AutomlResultRow) =>
                                sb.useAux
                                  ? r.aux_score != null && Number.isFinite(Number(r.aux_score))
                                    ? isMae
                                      ? Math.abs(Number(r.aux_score)).toFixed(4)
                                      : `${(Math.abs(Number(r.aux_score)) * 100).toFixed(1)}%`
                                    : '—'
                                  : `${(r.mean_score * 100).toFixed(1)}%`;
                              const cellSecondary = (r: AutomlResultRow) =>
                                sb.useAux
                                  ? `${(r.mean_score * 100).toFixed(1)}%`
                                  : r.aux_score != null && Number.isFinite(Number(r.aux_score))
                                    ? isMae
                                      ? Math.abs(Number(r.aux_score)).toFixed(4)
                                      : `${(Math.abs(Number(r.aux_score)) * 100).toFixed(1)}%`
                                    : null;
                              return (
                                <div className="overflow-x-auto rounded-lg border border-slate-200 shadow-sm">
                                  <table className="w-full text-sm border-collapse min-w-[20rem]">
                                    <thead>
                                      <tr className="bg-slate-50/95 text-left border-b border-slate-200">
                                        <th scope="col" className="px-3 py-2.5 text-xs font-semibold text-slate-500 w-14">순위</th>
                                        <th scope="col" className="px-3 py-2.5 text-xs font-semibold text-slate-500">모델</th>
                                        <th
                                          scope="col"
                                          title={sb.useAux ? sb.auxMetricHelp : sb.primaryMetricHelp}
                                          className="px-3 py-2.5 text-xs font-semibold text-slate-500 text-right whitespace-nowrap cursor-help"
                                        >
                                          <span className="inline-flex items-center justify-end gap-1 w-full min-w-0">
                                            <span>{sb.activeLabel}</span>
                                            <HelpCircle className="w-3.5 h-3.5 text-slate-400/75 shrink-0" aria-hidden />
                                          </span>
                                        </th>
                                        {showStdCol && (
                                          <th
                                            scope="col"
                                            title={sb.stdCvHelp}
                                            className="px-3 py-2.5 text-xs font-semibold text-slate-500 text-right whitespace-nowrap cursor-help"
                                          >
                                            <span className="inline-flex items-center justify-end gap-1 w-full min-w-0">
                                              <span>Std (CV)</span>
                                              <HelpCircle className="w-3.5 h-3.5 text-slate-400/75 shrink-0" aria-hidden />
                                            </span>
                                          </th>
                                        )}
                                        {showSecondCol && secondColLabel && (
                                          <th
                                            scope="col"
                                            title={sb.useAux ? sb.primaryMetricHelp : sb.auxMetricHelp}
                                            className="px-3 py-2.5 text-xs font-semibold text-slate-500 text-right whitespace-nowrap cursor-help"
                                          >
                                            <span className="inline-flex items-center justify-end gap-1 w-full min-w-0">
                                              <span>{secondColLabel}</span>
                                              <HelpCircle className="w-3.5 h-3.5 text-slate-400/75 shrink-0" aria-hidden />
                                            </span>
                                          </th>
                                        )}
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {list.map((r, i) => {
                                        const secondaryDisplay = cellSecondary(r);
                                        const auxHover =
                                          r.aux_score != null && Number.isFinite(Number(r.aux_score))
                                            ? isMae
                                              ? Math.abs(Number(r.aux_score)).toFixed(4)
                                              : `${(Math.abs(Number(r.aux_score)) * 100).toFixed(2)}%`
                                            : null;
                                        return (
                                          <tr
                                            key={r.model}
                                            className={`group relative border-b border-slate-100 last:border-b-0 transition-colors hover:bg-slate-50/80 ${rowClass(i)}`}
                                          >
                                            <td className="px-3 py-2.5 align-middle font-bold tabular-nums">{i + 1}위</td>
                                            <td className="px-3 py-2.5 align-middle font-semibold relative overflow-visible z-0 group-hover:z-10">
                                              <span className="inline-block">{r.model}</span>
                                              {/* 행 호버 시 지표 상세 */}
                                              <div className="pointer-events-none absolute left-0 top-full mt-1 hidden group-hover:flex flex-col gap-0.5 bg-slate-800 text-white text-xs rounded-lg px-3 py-2 whitespace-nowrap shadow-lg z-20">
                                                <span className="font-semibold text-slate-300 mb-0.5">{r.model}</span>
                                                <span>{primaryLabel}: <strong>{(r.mean_score * 100).toFixed(2)}%</strong></span>
                                                {r.std_score != null && <span>Std (CV): <strong>±{(r.std_score * 100).toFixed(2)}%</strong></span>}
                                                {auxLabel && auxHover && <span>{auxLabel}: <strong>{auxHover}</strong></span>}
                                                <div className="absolute bottom-full left-3 border-4 border-transparent border-b-slate-800" />
                                              </div>
                                            </td>
                                            <td className="px-3 py-2.5 align-middle text-right tabular-nums">{cellActive(r)}</td>
                                            {showStdCol && (
                                              <td className="px-3 py-2.5 align-middle text-right tabular-nums text-slate-600">
                                                {r.std_score != null ? `±${(r.std_score * 100).toFixed(1)}` : '—'}
                                              </td>
                                            )}
                                            {showSecondCol && secondColLabel && (
                                              <td className="px-3 py-2.5 align-middle text-right tabular-nums text-slate-600">
                                                {secondaryDisplay ?? '—'}
                                              </td>
                                            )}
                                          </tr>
                                        );
                                      })}
                                    </tbody>
                                  </table>
                                </div>
                              );
                            })()}
                            </div>

                            {/* 모델 순위별 전처리·시각화 추천 테이블 */}
                            {(automlResult.all_results ?? []).some(
                              (r) => (r.preprocessing_methods?.length ?? 0) > 0 || (r.visualization_methods?.length ?? 0) > 0
                            ) && (() => {
                              const ranked = automlScoreboard.sorted;
                              return (
                                <div className="pt-4 border-t border-slate-200/80">
                                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">모델별 추천</p>
                                  <div className="overflow-x-auto rounded-lg border border-slate-200 shadow-sm">
                                    <table className="w-full text-xs border-collapse min-w-[36rem]">
                                      <colgroup>
                                        <col style={{ width: '6%' }} />
                                        <col style={{ width: '18%' }} />
                                        <col style={{ width: '38%' }} />
                                        <col style={{ width: '38%' }} />
                                      </colgroup>
                                      <thead>
                                        <tr className="text-left border-b border-slate-200">
                                          <th scope="col" className="px-2 py-2.5 font-semibold text-slate-400 text-center bg-slate-50">순위</th>
                                          <th scope="col" className="px-3 py-2.5 font-semibold text-slate-500 bg-slate-50">모델</th>
                                          <th scope="col" className="px-3 py-2.5 font-semibold text-slate-600 bg-slate-50/90">전처리 방법</th>
                                          <th scope="col" className="px-3 py-2.5 font-semibold text-slate-600 bg-slate-50/90 border-l border-slate-200/80">시각화 방법</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {ranked.map((r, i) => (
                                          <tr key={r.model} className="border-b border-slate-100 last:border-b-0 align-top">
                                            <td className="px-2 py-3 text-center font-bold tabular-nums text-slate-400 bg-slate-50/60">{i + 1}</td>
                                            <td className="px-3 py-3 font-semibold text-slate-700 bg-slate-50/30">
                                              {i === 0
                                                ? <span className="inline-flex items-center gap-1"><span className="text-amber-400 text-[9px]">▶</span>{r.model}</span>
                                                : r.model}
                                            </td>
                                            <td className="px-3 py-3 bg-slate-50/25">
                                              {(r.preprocessing_methods?.length ?? 0) > 0 ? (
                                                <ul className="flex flex-col gap-1.5">
                                                  {r.preprocessing_methods!.map((m, mi) => (
                                                    <li key={mi} className="flex items-start gap-1.5 text-slate-600 leading-snug font-normal">
                                                      <span className="mt-[5px] w-1.5 h-1.5 rounded-full bg-slate-300/90 flex-shrink-0" />
                                                      {m}
                                                    </li>
                                                  ))}
                                                </ul>
                                              ) : <span className="text-slate-300">—</span>}
                                            </td>
                                            <td className="px-3 py-3 bg-slate-50/25 border-l border-slate-100">
                                              {(r.visualization_methods?.length ?? 0) > 0 ? (
                                                <ul className="flex flex-col gap-1.5">
                                                  {r.visualization_methods!.map((v, vi) => (
                                                    <li key={vi} className="flex items-start gap-1.5 text-slate-600 leading-snug font-normal">
                                                      <span className="mt-[5px] w-1.5 h-1.5 rounded-full bg-slate-300/90 flex-shrink-0" />
                                                      {v}
                                                    </li>
                                                  ))}
                                                </ul>
                                              ) : <span className="text-slate-300">—</span>}
                                            </td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                </div>
                              );
                            })()}
                          </div>
                        </>
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
                      <div className="mb-6">
                        <h2 className="text-xl sm:text-2xl font-bold text-slate-800">{PRIORITY_RECOMMENDATION_TITLE_KO}</h2>
                        <p className="text-xs text-slate-500 mt-1">{PRIORITY_RECOMMENDATION_DESCRIPTION_KO}</p>
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
                                    <h4 className="font-bold text-slate-800 text-sm sm:text-base truncate">
                                      {stripLatinAcronymParentheses(fn?.nameKo ?? fn?.name)}
                                    </h4>
                                    <span className="text-xs font-bold text-indigo-600 shrink-0">{(match.score * 100).toFixed(0)}%</span>
                                  </div>
                                  {fn?.descriptionKo && (
                                    <p className="text-xs text-slate-500 leading-relaxed mb-1.5">{fn.descriptionKo}</p>
                                  )}
                                  <p className="text-xs text-slate-600 leading-relaxed mb-3">
                                    {match.rationaleKo ?? match.rationale}
                                  </p>
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

                        <div className="bg-slate-50 rounded-xl p-4 sm:p-6 flex flex-col items-center justify-center border border-slate-100 min-w-0">
                          <div className="w-full min-h-[12rem] h-[clamp(12rem,32dvh,16rem)] sm:min-h-[14rem] sm:h-[clamp(14rem,34dvh,18rem)]">
                            <ResponsiveContainer width="100%" height="100%">
                              <RadarChart cx="50%" cy="50%" outerRadius="80%" data={radarData}>
                                <PolarGrid stroke="#e2e8f0" />
                                <PolarAngleAxis dataKey="subject" tick={{ fontSize: 10, fill: '#64748b' }} />
                                <PolarRadiusAxis angle={30} domain={[0, 100]} />
                                <Radar name="매칭 점수" dataKey="A" stroke="#4f46e5" fill="#4f46e5" fillOpacity={0.6} />
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
                          표준 MES 온톨로지 반영
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
                        <div className="mb-4 rounded-xl border border-slate-200 bg-white">
                          <div className="flex items-stretch border-b border-slate-100 rounded-t-xl overflow-visible">
                            <button
                              type="button"
                              onClick={() => setResultOntologyGraphOpen((v) => !v)}
                              className="flex-1 min-w-0 flex items-center justify-between gap-2 px-4 py-2.5 text-left text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
                              aria-expanded={resultOntologyGraphOpen}
                            >
                              <span>매칭 결과 그래프</span>
                              {resultOntologyGraphOpen ? (
                                <ChevronUp className="w-4 h-4 text-slate-400 shrink-0" />
                              ) : (
                                <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
                              )}
                            </button>
                            <div className="flex items-center pr-3 border-l border-slate-100 bg-slate-50/50">
                              <OntologyGraphHelpTip />
                            </div>
                          </div>
                          {resultOntologyGraphOpen && (
                            <div className="overflow-hidden rounded-b-xl">
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
                                  const tf = top ? MES_ONTOLOGY.find((o) => o.id === top.functionId) : null;
                                  return stripLatinAcronymParentheses(tf?.nameKo ?? tf?.name);
                                })(),
                                profileFeatureNames: dataProfile?.features,
                              }}
                            />
                            </div>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => setCurrentNav('ontology')}
                          className="flex items-center gap-2 text-sm font-semibold text-indigo-600 hover:text-indigo-700"
                        >
                          <Layers className="w-4 h-4" />
                          표준 MES 온톨로지에서 보기
                        </button>
                      </div>

                      <div className="pt-6 border-t border-slate-100">
                        <h4 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2">
                          <Zap className="w-4 h-4 text-amber-500" />
                          인사이트
                        </h4>
                        <div className="flex flex-col gap-2 max-w-3xl">
                          {analysisResult.augmentationSuggestions?.map((item, i) => {
                            const open = insightOpenIndex === i;
                            return (
                              <div
                                key={`${item.title}-${i}`}
                                className="rounded-lg border border-amber-100 bg-amber-50/80 overflow-hidden"
                              >
                                <button
                                  type="button"
                                  onClick={() => setInsightOpenIndex(open ? null : i)}
                                  aria-expanded={open}
                                  className="w-full px-3 py-2 flex items-start gap-2 text-left text-amber-900 text-xs font-medium leading-relaxed hover:bg-amber-50 transition-colors"
                                >
                                  <ChevronRight
                                    className={`w-3.5 h-3.5 shrink-0 mt-0.5 text-amber-600 transition-transform ${open ? 'rotate-90' : ''}`}
                                    aria-hidden
                                  />
                                  <span>{item.title}</span>
                                </button>
                                {open && (
                                  <p className="px-3 pb-3 pt-0 pl-[2.125rem] text-slate-600 text-xs leading-relaxed border-t border-amber-100/80 bg-white/40">
                                    {item.detail}
                                  </p>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
          </div>
        )}
      </main>

      <footer className="bg-white border-t border-slate-200 py-5 px-4 sm:px-6 text-center lg:text-left transition-[padding] duration-200 lg:pl-[calc(var(--sidebar-w)+1rem)]">
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
