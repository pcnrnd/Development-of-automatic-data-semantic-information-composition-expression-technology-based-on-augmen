import { MES_FUNCTION_SHORT_LABEL_KO } from '../constants';
import {
  AugmentationSuggestionItem,
  DataProfile,
  IndustryType,
  MESFunction,
  MatchingResult,
  ResultTemplate,
} from '../types';

/**
 * 프로파일 키워드(표준명)와 MES 함수 ID 매핑 (규칙 기반 매칭용)
 */
const FEATURE_TO_FUNCTION_HINTS: Record<string, string[]> = {
  Temperature: ['F003', 'F002'],
  Pressure: ['F003', 'F002'],
  Vibration: ['F003', 'F002'],
  Spindle_Speed: ['F004', 'F001'],
  Torque: ['F003', 'F004'],
  Sensor: ['F003', 'F001', 'F002'],
  State: ['F001', 'F004', 'F006'],
};

/**
 * 컬럼명 동의어/패턴 → 표준 피처명. CSV 헤더가 다를 때도 힌트 매칭되도록 함.
 */
const FEATURE_CANONICAL: Record<string, string> = {
  temperature: 'Temperature',
  temp: 'Temperature',
  pressure: 'Pressure',
  vibration: 'Vibration',
  vib: 'Vibration',
  spindle_speed: 'Spindle_Speed',
  spindle: 'Spindle_Speed',
  speed: 'Spindle_Speed',
  torque: 'Torque',
  sensor: 'Sensor',
  state: 'State',
  wip: 'State',
  quality: 'State',
};

function getHintsForFeature(feat: string): string[] | undefined {
  const normalized = feat.trim().toLowerCase().replace(/\s+/g, '_');
  const canonical = FEATURE_CANONICAL[normalized] ?? feat;
  return FEATURE_TO_FUNCTION_HINTS[canonical];
}

/** 산업 타입 표시명 (매칭 근거 한글용) */
const INDUSTRY_LABEL_KO: Record<IndustryType, string> = {
  [IndustryType.AUTOMOTIVE]: '자동차',
  [IndustryType.ELECTRONICS]: '전자',
  [IndustryType.SEMICONDUCTOR]: '반도체',
  [IndustryType.ELECTRICAL]: '전기·전력',
  [IndustryType.HEAVY_INDUSTRY]: '중공업',
};

/** 매칭 rationale에 들어가는 영문 토큰 → 한글 (없으면 원문 유지) */
const REASON_LABEL_KO: Record<string, string> = {
  'Continuous sensor data': '연속형 센서 데이터',
  Temperature: '온도',
  Pressure: '압력',
  Vibration: '진동',
  Spindle_Speed: '스핀들 속도',
  Torque: '토크',
  Sensor: '센서',
  State: '상태',
};

/** 산업별 우선 MES 기능 ID (순서 = 가중치). 템플릿 추천과 동일 정책. */
const INDUSTRY_FUNCTION_BOOST: Partial<Record<IndustryType, string[]>> = {
  [IndustryType.AUTOMOTIVE]: ['F001', 'F005', 'F002', 'F006'],
  [IndustryType.ELECTRONICS]: ['F002', 'F003', 'F001', 'F004'],
  [IndustryType.SEMICONDUCTOR]: ['F002', 'F003', 'F001', 'F009'],
  [IndustryType.ELECTRICAL]: ['F003', 'F008', 'F002', 'F001'],
  [IndustryType.HEAVY_INDUSTRY]: ['F003', 'F007', 'F001', 'F008'],
};

/** 매칭 점수에 더하는 산업별 가산값 (순위 1위~5위). 힌트 부재 시에도 기능별로 %가 갈리도록 함 */
const INDUSTRY_MATCH_BOOST_DELTA = [0.11, 0.075, 0.048, 0.028, 0.014];

/**
 * 선택 산업에서 해당 기능 ID의 우선순위에 따른 점수 가산.
 * 목록에 없으면 0 (다른 로직으로만 점수 형성).
 */
function industryMatchScoreDelta(fnId: string, industry: IndustryType): number {
  const order = INDUSTRY_FUNCTION_BOOST[industry];
  if (!order?.length) return 0;
  const idx = order.indexOf(fnId);
  if (idx < 0) return 0;
  return INDUSTRY_MATCH_BOOST_DELTA[Math.min(idx, INDUSTRY_MATCH_BOOST_DELTA.length - 1)] ?? 0;
}

/** 프로파일·매칭 결과에 따라 Insights 2~3개 (제목 + 펼침용 설명) */
function buildAugmentationSuggestions(
  profile: DataProfile,
  sortedMatches: MatchingResult[]
): AugmentationSuggestionItem[] {
  const topIds = new Set(sortedMatches.slice(0, 3).map((m) => m.functionId));
  const pool: AugmentationSuggestionItem[] = [];
  if (profile.seasonality) {
    pool.push({
      title: '시계열 집계로 계절·주기 반영',
      detail:
        '데이터에 계절성이 있다고 보이면, 일·주·월 단위로 평균·합계 등 집계 컬럼을 추가해 보세요. 추세와 주기가 드러나면 AutoML·온톨로지 매칭에도 같은 정보가 반영되기 쉽습니다.',
    });
  }
  if (topIds.has('F002')) {
    pool.push({
      title: '공정 품질(SPC)용 센서 한계선 검토',
      detail:
        '상위 추천에 품질(SPC) 기능이 포함되어 있습니다. 온도·압력 등 주요 센서마다 규격 상한·하한(관리도 한계)을 정의하면 이상 징후를 일관되게 잡을 수 있습니다.',
    });
  }
  if (topIds.has('F003')) {
    pool.push({
      title: '예지 보전을 위한 보전·고장 이력 보강',
      detail:
        '예지 보전(PdM)이 상위에 있으면, 정비 일시·부품 교체·알람·다운타임 같은 이력을 설비 ID와 묶어 쌓는 것이 좋습니다. 라벨이 있으면 고장 예측 모델 품질이 크게 좋아질 수 있습니다.',
    });
  }
  if (profile.missingValues > 10) {
    pool.push({
      title: '결측치 보강으로 매칭 안정화',
      detail:
        '결측 비율이 높으면 규칙 기반 매칭 점수도 흔들릴 수 있습니다. 단순 대체·보간·구간 평균 등으로 채운 뒤 다시 분석해 보는 것을 권합니다.',
    });
  }
  if (topIds.has('F005')) {
    pool.push({
      title: 'Lot·공정 이력으로 추적성 강화',
      detail:
        '이력 추적 기능이 상위입니다. Lot/배치·시리얼·공정 단계·시각 정보가 한 줄에 이어지도록 데이터를 정리하면 추적·리콜 대응 분석에 유리합니다.',
    });
  }
  if (topIds.has('F004')) {
    pool.push({
      title: '일정·설비 데이터로 스케줄링 보완',
      detail:
        '동적 생산 일정이 상위 추천입니다. 작업 오더·납기·설비 가동/비가동을 같은 시간축에 두면 일정 최적화·병목 분석에 활용하기 좋습니다.',
    });
  }
  pool.push({
    title: '데이터 정의·채널 확대',
    detail:
      '컬럼명을 현장 표준(설비코드, 공정명 등)에 맞추고, 센서·이력 채널을 늘리면 다음 실행에서 매칭과 모델이 더 안정적으로 나오는 경우가 많습니다.',
  });
  const seen = new Set<string>();
  return pool.filter((item) => {
    if (seen.has(item.title)) return false;
    seen.add(item.title);
    return true;
  }).slice(0, 3);
}

/**
 * 데이터 프로파일과 MES 온톨로지를 규칙 기반으로 분석하여
 * 매칭 결과(matches), 요약(summary), 증강 제안(augmentationSuggestions)을 반환합니다.
 * (구글 API 제거 후 로컬 전용 서비스)
 */
export async function analyzeDataAndMatch(
  industry: IndustryType,
  profile: DataProfile,
  ontology: MESFunction[]
): Promise<{
  matches: MatchingResult[];
  summary: string;
  augmentationSuggestions: AugmentationSuggestionItem[];
} | null> {
  const matches: MatchingResult[] = [];
  const featureCount = profile.features.length;
  const signalStrength = 1 - profile.noiseLevel;
  const completeness = Math.max(0, 100 - profile.missingValues) / 100;

  for (const fn of ontology) {
    let score = 0.5;
    const reasons: string[] = [];

    for (const feat of profile.features) {
      const hinted = getHintsForFeature(feat);
      if (hinted?.includes(fn.id)) {
        score += 0.12;
        reasons.push(feat);
      }
    }
    if (profile.dataTypes['Sensor'] === 'Continuous' && ['F001', 'F002', 'F003'].includes(fn.id)) {
      score += 0.08;
      reasons.push('Continuous sensor data');
    }
    score += industryMatchScoreDelta(fn.id, industry);
    score = Math.min(1, score);
    score = Math.min(1, score * signalStrength * (0.9 + completeness * 0.1));

    const fnNameKo = fn.nameKo ?? fn.name;
    const industryKo = INDUSTRY_LABEL_KO[industry] ?? String(industry);
    const rationaleKo =
      reasons.length > 0
        ? `데이터 프로파일 특성(${reasons
            .slice(0, 3)
            .map((r) => REASON_LABEL_KO[r] ?? r)
            .join(', ')})이 「${fnNameKo}」 기능과 잘 맞습니다.`
        : `${industryKo} 도메인을 고려한 일반적인 적합도입니다.`;

    matches.push({
      functionId: fn.id,
      score: Math.round(score * 100) / 100,
      rationale: rationaleKo,
      rationaleKo,
      priority: score >= 0.7 ? 1 : score >= 0.5 ? 2 : 3,
    });
  }

  matches.sort((a, b) => b.score - a.score);
  // 우선순위는 점수 기반으로 일관 유지: 상위 3개=1, 다음 3개=2, 그 외=3
  // (직전 score 기반 priority가 인덱스로 덮어써져 항상 1,2,3,3,3...이 되던 버그 수정)
  matches.forEach((m, idx) => {
    if (idx < 3) m.priority = 1;
    else if (idx < 6) m.priority = 2;
    else m.priority = 3;
  });

  const industryKoForSummary = INDUSTRY_LABEL_KO[industry] ?? String(industry);
  const topNamesKo = matches
    .slice(0, 2)
    .map(
      (m) =>
        MES_FUNCTION_SHORT_LABEL_KO[m.functionId] ??
        ontology.find((o) => o.id === m.functionId)?.nameKo,
    )
    .filter(Boolean)
    .join(', ');
  const summary = topNamesKo
    ? `산업데이터 ${featureCount}개 피처를 바탕으로 필요기능–표준기능 매칭을 수행했습니다. ${industryKoForSummary} 도메인에 맞는 상위 추천: ${topNamesKo}. 데이터 품질과 결측 수준을 반영한 우선순위를 제안합니다.`
    : `산업데이터 ${featureCount}개 피처를 바탕으로 필요기능–표준기능 매칭을 수행했습니다. 데이터 품질과 결측 수준을 반영하여 ${industryKoForSummary} 도메인에 맞는 MES 기능 우선순위를 제안합니다.`;

  const augmentationSuggestions = buildAugmentationSuggestions(profile, matches);

  return { matches, summary, augmentationSuggestions };
}

/** 기능별 인스턴스 커버리지 판단 기준 속성 */
const FUNCTION_COVERAGE_ATTRS: Record<string, { label: string; keywords: string[] }[]> = {
  F001: [
    { label: 'Lot/WO ID',   keywords: ['lot', 'wo', 'order', 'job', 'batch'] },
    { label: '수량',         keywords: ['qty', 'quantity', 'count', 'amount'] },
    { label: '타임스탬프',   keywords: ['time', 'date', 'timestamp', 'datetime'] },
    { label: '작업장',       keywords: ['station', 'line', 'cell', 'machine', 'area'] },
  ],
  F002: [
    { label: '측정값',             keywords: ['measurement', 'value', 'dimension', 'thickness', 'diameter', 'weight', 'hardness'] },
    { label: '규격 한계(USL/LSL)', keywords: ['usl', 'lsl', 'spec', 'limit', 'upper', 'lower', 'tolerance'] },
    { label: '공정/제품 ID',       keywords: ['process', 'product', 'part', 'lot', 'item'] },
    { label: '불량 여부',          keywords: ['defect', 'pass', 'fail', 'result', 'quality', 'status'] },
  ],
  F003: [
    { label: '센서값',     keywords: ['sensor', 'temperature', 'temp', 'vibration', 'vib', 'pressure', 'current', 'speed', 'torque'] },
    { label: '타임스탬프', keywords: ['time', 'date', 'timestamp', 'datetime'] },
    { label: '설비 ID',    keywords: ['machine', 'equipment', 'asset', 'device', 'tool', 'unit'] },
    { label: '고장/라벨',  keywords: ['fault', 'failure', 'alarm', 'error', 'label', 'status', 'health'] },
  ],
  F004: [
    { label: '오더/작업 ID', keywords: ['order', 'job', 'wo', 'task', 'schedule'] },
    { label: '계획 일정',    keywords: ['plan', 'start', 'end', 'due', 'deadline', 'date'] },
    { label: '설비/자원',    keywords: ['machine', 'equipment', 'resource', 'line'] },
    { label: '우선순위',     keywords: ['priority', 'urgent', 'critical', 'rank'] },
  ],
  F005: [
    { label: 'Lot/시리얼',  keywords: ['lot', 'serial', 'sn', 'batch'] },
    { label: '이력/추적',   keywords: ['trace', 'history', 'track', 'record', 'log'] },
    { label: '타임스탬프',  keywords: ['time', 'date', 'timestamp'] },
    { label: '공정 단계',   keywords: ['step', 'stage', 'process', 'operation', 'station'] },
  ],
  F006: [
    { label: '불량 유형', keywords: ['defect', 'reject', 'failure', 'ncr', 'type', 'code'] },
    { label: '원인 코드', keywords: ['cause', 'reason', 'root', 'category'] },
    { label: '공정/Lot',  keywords: ['process', 'lot', 'batch', 'product', 'line'] },
    { label: '날짜',      keywords: ['date', 'time', 'timestamp'] },
  ],
  F007: [
    { label: '생산 오더', keywords: ['order', 'wo', 'production', 'mo'] },
    { label: '수량',      keywords: ['qty', 'quantity', 'actual', 'planned', 'target'] },
    { label: '일정',      keywords: ['start', 'end', 'plan', 'actual', 'schedule', 'due'] },
    { label: '품목',      keywords: ['item', 'product', 'part', 'sku', 'material'] },
  ],
  F008: [
    { label: '설비 ID',   keywords: ['machine', 'equipment', 'asset', 'tool'] },
    { label: '보전 유형', keywords: ['maintenance', 'inspection', 'repair', 'service', 'pm'] },
    { label: '날짜/주기', keywords: ['date', 'time', 'interval', 'frequency', 'cycle'] },
    { label: '상태/결과', keywords: ['status', 'result', 'complete', 'downtime'] },
  ],
  F009: [
    { label: '자재 코드', keywords: ['material', 'mat', 'item', 'part', 'component'] },
    { label: '소비량',    keywords: ['consumption', 'qty', 'quantity', 'amount', 'used'] },
    { label: 'Lot/배치', keywords: ['lot', 'batch', 'supplier', 'po'] },
    { label: '날짜',      keywords: ['date', 'time', 'timestamp'] },
  ],
};

/** 헤더 목록 × 기능 ID → 인스턴스 커버리지 점수 */
function computeCoverage(
  headers: string[],
  primaryFunctionId: string,
): { matched: number; total: number; missing: string[]; score: number } {
  const attrs = FUNCTION_COVERAGE_ATTRS[primaryFunctionId];
  if (!attrs || attrs.length === 0) return { matched: 0, total: 0, missing: [], score: 1 };
  const normalizedHeaders = headers.map((h) => h.trim().toLowerCase().replace(/[\s\-]/g, '_'));
  const missing: string[] = [];
  let matched = 0;
  for (const attr of attrs) {
    const found = attr.keywords.some((kw) => normalizedHeaders.some((h) => h.includes(kw)));
    if (found) matched++; else missing.push(attr.label);
  }
  return { matched, total: attrs.length, missing, score: matched / attrs.length };
}

/** 컬럼 타입 패턴 분석 (샘플 50행 기반) */
function detectColumnTypes(
  headers: string[],
  rows: string[][],
): { numericRatio: number; hasTimestamp: boolean; hasCategorical: boolean; extraBoostFids: string[] } {
  if (rows.length === 0 || headers.length === 0) {
    return { numericRatio: 0, hasTimestamp: false, hasCategorical: false, extraBoostFids: [] };
  }
  const SAMPLE = Math.min(rows.length, 50);
  const sampleRows = rows.slice(0, SAMPLE);
  const TIMESTAMP_RE = /^\d{4}[-/]\d{2}[-/]\d{2}|^\d{2}[./-]\d{2}[./-]\d{2,4}/;
  let numericCount = 0;
  let timestampCount = 0;
  let categoricalCount = 0;

  for (let c = 0; c < headers.length; c++) {
    const vals = sampleRows.map((r) => r[c] ?? '').filter((v) => v !== '');
    if (vals.length === 0) continue;
    const numericVals = vals.filter((v) => !Number.isNaN(Number(v)));
    const tsVals = vals.filter((v) => TIMESTAMP_RE.test(v));
    if (tsVals.length / vals.length > 0.6) {
      timestampCount++;
    } else if (numericVals.length / vals.length > 0.8) {
      numericCount++;
    } else {
      const uniqueRatio = new Set(vals).size / vals.length;
      if (uniqueRatio < 0.4) categoricalCount++;
    }
  }

  const numericRatio = numericCount / headers.length;
  const extraBoostFids: string[] = [];
  if (numericRatio > 0.7)   extraBoostFids.push('F002', 'F003');
  if (categoricalCount > 0) extraBoostFids.push('F001', 'F006');
  if (timestampCount > 0)   extraBoostFids.push('F003', 'F004', 'F008');

  return {
    numericRatio,
    hasTimestamp: timestampCount > 0,
    hasCategorical: categoricalCount > 0,
    extraBoostFids: [...new Set(extraBoostFids)],
  };
}

/** ISA-95 계층 경고: L1/L2 원시 데이터 여부 감지.
 *  영문/한글 식별자 키워드 모두 검사하고, 조건을 OR로 완화해 더 자주 도움이 되도록 함. */
function detectISA95Warning(
  headers: string[],
  colTypes: ReturnType<typeof detectColumnTypes>,
): string | null {
  const ID_KEYWORDS_EN = [
    'lot', 'order', 'serial', 'id', 'line', 'station',
    'product', 'batch', 'wo', 'machine', 'equipment', 'asset',
  ];
  const ID_KEYWORDS_KO = [
    '설비', '로트', '호기', '라인', '제품', '배치',
    '오더', '품번', '시리얼', '작업', '공정', '장비', '자산',
  ];
  const hasIdentifier = headers.some((h) => {
    const lower = h.trim().toLowerCase();
    if (ID_KEYWORDS_EN.some((kw) => lower.includes(kw))) return true;
    return ID_KEYWORDS_KO.some((kw) => h.includes(kw));
  });
  // 임계 완화: 수치형이 우세하고(>0.7), 식별자나 타임스탬프 둘 다 없으면 안내
  if (colTypes.numericRatio > 0.7 && !hasIdentifier && !colTypes.hasTimestamp) {
    return '센서 측정 원본 데이터로 보입니다. 설비·Lot 식별 컬럼이나 시간(타임스탬프) 컬럼을 추가하면 추적·예지 분석의 정확도가 크게 올라갑니다.';
  }
  return null;
}

/** 데이터 진단 요약 — 추천 점수와 분리해서 표시할 사용자 안내용 정보 */
export interface DataDiagnostics {
  numericRatio: number;
  hasTimestamp: boolean;
  hasCategorical: boolean;
  /** 사용자에게 보여줄 짧은 한 줄 요약 */
  summary: string;
}

function buildDataDiagnostics(colTypes: ReturnType<typeof detectColumnTypes>): DataDiagnostics {
  const parts: string[] = [];
  if (colTypes.numericRatio >= 0.7) parts.push('수치형 우세');
  else if (colTypes.numericRatio >= 0.4) parts.push('수치/범주 혼합');
  if (colTypes.hasTimestamp) parts.push('타임스탬프 포함');
  if (colTypes.hasCategorical) parts.push('범주형 포함');
  const summary = parts.length > 0
    ? `데이터 특성: ${parts.join(' · ')}`
    : '데이터 특성을 자동 판정할 수 없습니다 (헤더 외 행이 부족).';
  return {
    numericRatio: colTypes.numericRatio,
    hasTimestamp: colTypes.hasTimestamp,
    hasCategorical: colTypes.hasCategorical,
    summary,
  };
}

export interface EnhancedTemplateResult {
  template: ResultTemplate;
  score: number;
  matchedFunctionIds: string[];
  coverageScore: number;
  coverageDetail: { matched: number; total: number; missing: string[] };
}

/**
 * 데이터 신호를 우선하는 템플릿 추천 (이전 버전의 단순·예측가능성 철학 계승).
 *
 * 점수 = 헤더 키워드 hint 개수 + 필수 항목 매칭 개수
 *      + (산업 컨텍스트는 동률 깨기용 미세 가산만, 데이터 신호를 덮지 않음)
 *
 * 정렬·표시는 같은 점수를 기준으로 합니다 (이전 버전의 모순 제거).
 * 점수 0인 템플릿은 추천에서 제외합니다 — top-N을 의미 없는 추천으로 채우지 않음.
 * 같은 primary 함수 ID를 가진 템플릿이 top을 독차지하지 않도록 다양성을 적용합니다.
 *
 * ISA-95 경고와 데이터 진단은 점수에 영향을 주지 않고 별도 정보로 반환합니다.
 */
export function getEnhancedTemplateRecommendations(
  headers: string[],
  rows: string[][],
  templates: ResultTemplate[],
  industry: IndustryType,
  topN = 3,
): {
  recommendations: EnhancedTemplateResult[];
  isa95Warning: string | null;
  dataDiagnostics: DataDiagnostics;
} {
  // 1. 헤더 키워드 → 함수 hint 카운트 (1차 신호)
  const functionScores: Record<string, number> = {};
  for (const header of headers) {
    const hints = getHintsForFeature(header);
    if (hints) {
      for (const fnId of hints) {
        functionScores[fnId] = (functionScores[fnId] ?? 0) + 1;
      }
    }
  }

  // 2. 데이터 타입 패턴 분석 (점수에 직접 반영하지 않음 — 진단용)
  const colTypes = detectColumnTypes(headers, rows);

  // 3. 산업 컨텍스트는 동률 깨기용 미세 가산만 (0.001 단위)
  //    데이터 신호(헤더 hint·커버리지 매칭)를 절대 덮지 못하게 강도 약화.
  const industryTiebreak: Record<string, number> = {};
  const industryBoost = INDUSTRY_FUNCTION_BOOST[industry] ?? [];
  industryBoost.forEach((fnId, rank) => {
    industryTiebreak[fnId] = (industryBoost.length - rank) * 0.001;
  });

  // 4. 템플릿별 점수: header hint + 필수 항목 매칭 수 + 산업 미세 가산
  const scored: EnhancedTemplateResult[] = templates.map((template) => {
    const primaryFid = template.recommendedFunctionIds[0] ?? '';
    const headerHintScore = template.recommendedFunctionIds.reduce(
      (sum, fnId) => sum + (functionScores[fnId] ?? 0),
      0,
    );
    const tiebreak = template.recommendedFunctionIds.reduce(
      (sum, fnId) => sum + (industryTiebreak[fnId] ?? 0),
      0,
    );
    const matchedFunctionIds = template.recommendedFunctionIds.filter(
      (fnId) => (functionScores[fnId] ?? 0) > 0,
    );
    const { matched, total, missing, score: coverageScore } = computeCoverage(headers, primaryFid);
    // 사용자에게 보여줄 정렬 점수 = 데이터에서 직접 나온 신호 + 산업 미세조정
    const score = headerHintScore + matched + tiebreak;
    return { template, score, matchedFunctionIds, coverageScore, coverageDetail: { matched, total, missing } };
  });

  // 5. 점수 0인 템플릿은 제외 — 무의미한 추천으로 슬롯을 채우지 않음
  const nonZero = scored.filter((s) => s.score > 0);
  nonZero.sort((a, b) => b.score - a.score);

  // 6. 다양성: 같은 primary 함수 ID가 top-N을 독차지하지 않게 한 번씩만 채택
  const seenPrimary = new Set<string>();
  const diversified: EnhancedTemplateResult[] = [];
  for (const s of nonZero) {
    const primary = s.template.recommendedFunctionIds[0] ?? '';
    if (seenPrimary.has(primary)) continue;
    seenPrimary.add(primary);
    diversified.push(s);
    if (diversified.length >= topN) break;
  }
  // 그래도 부족하면 (드묾) 같은 primary라도 점수 순으로 채움
  if (diversified.length < topN) {
    for (const s of nonZero) {
      if (diversified.includes(s)) continue;
      diversified.push(s);
      if (diversified.length >= topN) break;
    }
  }

  return {
    recommendations: diversified,
    isa95Warning: detectISA95Warning(headers, colTypes),
    dataDiagnostics: buildDataDiagnostics(colTypes),
  };
}

/**
 * CSV 헤더(컬럼명) 목록을 바탕으로 온톨로지 함수 ID별 매칭 점수를 계산하여
 * 가장 관련성 높은 참조 템플릿 top-N개를 반환합니다.
 * 데이터 업로드 직후 전체 분석 없이 빠른 미리보기 추천에 사용합니다.
 */
export function getTemplateRecommendationsByColumns(
  headers: string[],
  templates: ResultTemplate[],
  topN = 3,
): { template: ResultTemplate; score: number; matchedFunctionIds: string[] }[] {
  const functionScores: Record<string, number> = {};
  for (const header of headers) {
    const hints = getHintsForFeature(header);
    if (hints) {
      for (const fnId of hints) {
        functionScores[fnId] = (functionScores[fnId] ?? 0) + 1;
      }
    }
  }

  const scored = templates.map((template) => {
    const matchedFunctionIds = template.recommendedFunctionIds.filter(
      (fnId) => (functionScores[fnId] ?? 0) > 0,
    );
    const score = template.recommendedFunctionIds.reduce(
      (sum, fnId) => sum + (functionScores[fnId] ?? 0),
      0,
    );
    return { template, score, matchedFunctionIds };
  });

  return scored.sort((a, b) => b.score - a.score).slice(0, topN);
}

export const analysisService = {
  analyzeDataAndMatch,
};
