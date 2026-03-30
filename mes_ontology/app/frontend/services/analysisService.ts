import { DataProfile, IndustryType, MESFunction, MatchingResult, ResultTemplate } from '../types';

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

/** 프로파일·매칭 결과에 따라 Insights 문구 2~3개 선택 */
function buildAugmentationSuggestions(
  profile: DataProfile,
  sortedMatches: MatchingResult[]
): string[] {
  const topIds = new Set(sortedMatches.slice(0, 3).map((m) => m.functionId));
  const pool: string[] = [];
  if (profile.seasonality) {
    pool.push('시계열 집계 추가로 계절성 반영 (증강분석 활용)');
  }
  if (topIds.has('F002')) {
    pool.push('주요 센서 채널 SPC 한계값 검토');
  }
  if (topIds.has('F003')) {
    pool.push('보전 이력 데이터 보강으로 PdM 정확도 향상');
  }
  if (profile.missingValues > 10) {
    pool.push('결측치 보강으로 매칭 품질 향상');
  }
  if (topIds.has('F005')) {
    pool.push('추적성 데이터 확보 시 이력 추적 기능 추천');
  }
  if (topIds.has('F004')) {
    pool.push('일정·설비 상태 데이터 보강으로 동적 스케줄링 추천');
  }
  pool.push('데이터 품질·채널 보강 시 매칭 정확도 향상');
  const seen = new Set<string>();
  return pool.filter((s) => {
    if (seen.has(s)) return false;
    seen.add(s);
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
  augmentationSuggestions: string[];
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
    score = Math.min(1, score * signalStrength * (0.9 + completeness * 0.1));

    const rationale =
      reasons.length > 0
        ? `Data profile (${reasons.slice(0, 3).join(', ')}) aligns with ${fn.name}.`
        : `General fit for ${industry} and current data scale (${profile.recordsCount} records).`;

    matches.push({
      functionId: fn.id,
      score: Math.round(score * 100) / 100,
      rationale,
      priority: score >= 0.7 ? 1 : score >= 0.5 ? 2 : 3,
    });
  }

  matches.sort((a, b) => b.score - a.score);
  const priorityOrder = [1, 2, 3];
  let p = 0;
  for (const m of matches) {
    m.priority = priorityOrder[Math.min(p++, priorityOrder.length - 1)];
  }

  const topNames = matches
    .slice(0, 2)
    .map((m) => ontology.find((o) => o.id === m.functionId)?.name?.split(' ')[0])
    .filter(Boolean)
    .join(', ');
  const summary = topNames
    ? `산업데이터 ${featureCount}개 피처, ${profile.recordsCount}건 기준으로 필요기능–표준기능 매칭을 수행했습니다. ${industry} 도메인에 맞는 상위 추천: ${topNames}. 데이터 품질과 결측 수준을 반영한 우선순위를 제안합니다.`
    : `산업데이터 ${featureCount}개 피처, ${profile.recordsCount}건 기준으로 필요기능–표준기능 매칭을 수행했습니다. 데이터 품질과 결측 수준을 반영하여 ${industry} 도메인에 맞는 MES 기능 우선순위를 제안합니다.`;

  const augmentationSuggestions = buildAugmentationSuggestions(profile, matches);

  return { matches, summary, augmentationSuggestions };
}

/** 산업별 우선 MES 기능 ID (순서 = 가중치 우선순위) */
const INDUSTRY_FUNCTION_BOOST: Partial<Record<IndustryType, string[]>> = {
  [IndustryType.AUTOMOTIVE]:     ['F001', 'F005', 'F002', 'F006'],
  [IndustryType.ELECTRONICS]:    ['F002', 'F003', 'F001', 'F004'],
  [IndustryType.SEMICONDUCTOR]:  ['F002', 'F003', 'F001', 'F009'],
  [IndustryType.ELECTRICAL]:     ['F003', 'F008', 'F002', 'F001'],
  [IndustryType.HEAVY_INDUSTRY]: ['F003', 'F007', 'F001', 'F008'],
};

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

/** ISA-95 계층 경고: L1/L2 원시 데이터 여부 감지 */
function detectISA95Warning(
  headers: string[],
  colTypes: ReturnType<typeof detectColumnTypes>,
): string | null {
  const hasIdentifier = headers.some((h) => {
    const n = h.trim().toLowerCase();
    return ['lot', 'order', 'serial', 'id', 'line', 'station', 'product', 'batch', 'wo'].some((kw) => n.includes(kw));
  });
  if (colTypes.numericRatio > 0.85 && !colTypes.hasCategorical && !colTypes.hasTimestamp && !hasIdentifier) {
    return '센서 측정 원본 데이터로 보입니다. 설비·Lot 식별 정보나 시간대별 집계 컬럼을 추가하면 더 정확한 분석 결과를 기대할 수 있습니다.';
  }
  return null;
}

export interface EnhancedTemplateResult {
  template: ResultTemplate;
  score: number;
  matchedFunctionIds: string[];
  coverageScore: number;
  coverageDetail: { matched: number; total: number; missing: string[] };
}

/**
 * 산업 컨텍스트·데이터 타입 패턴·인스턴스 커버리지를 반영한 향상된 템플릿 추천.
 * 기존 getTemplateRecommendationsByColumns 대비:
 *   1) 산업별 기능 가중치 적용
 *   2) 데이터 타입 패턴(numeric/categorical/timestamp 비율) 반영
 *   3) ISA-95 계층 경고 감지
 *   4) 인스턴스 커버리지 점수 계산
 */
export function getEnhancedTemplateRecommendations(
  headers: string[],
  rows: string[][],
  templates: ResultTemplate[],
  industry: IndustryType,
  topN = 3,
): { recommendations: EnhancedTemplateResult[]; isa95Warning: string | null } {
  // 1. 컬럼명 → 기능 힌트 점수
  const functionScores: Record<string, number> = {};
  for (const header of headers) {
    const hints = getHintsForFeature(header);
    if (hints) {
      for (const fnId of hints) {
        functionScores[fnId] = (functionScores[fnId] ?? 0) + 1;
      }
    }
  }

  // 2. 산업 컨텍스트 가중치
  const industryBoost = INDUSTRY_FUNCTION_BOOST[industry] ?? [];
  industryBoost.forEach((fnId, rank) => {
    const w = rank === 0 ? 1.5 : rank === 1 ? 1.0 : 0.5;
    functionScores[fnId] = (functionScores[fnId] ?? 0) + w;
  });

  // 3. 데이터 타입 패턴 가중치
  const colTypes = detectColumnTypes(headers, rows);
  for (const fnId of colTypes.extraBoostFids) {
    functionScores[fnId] = (functionScores[fnId] ?? 0) + 0.5;
  }

  // 4. 템플릿 점수 + 커버리지
  const scored: EnhancedTemplateResult[] = templates.map((template) => {
    const matchedFunctionIds = template.recommendedFunctionIds.filter(
      (fnId) => (functionScores[fnId] ?? 0) > 0,
    );
    const score = template.recommendedFunctionIds.reduce(
      (sum, fnId) => sum + (functionScores[fnId] ?? 0),
      0,
    );
    const primaryFid = template.recommendedFunctionIds[0] ?? '';
    const { matched, total, missing, score: coverageScore } = computeCoverage(headers, primaryFid);
    return { template, score, matchedFunctionIds, coverageScore, coverageDetail: { matched, total, missing } };
  });

  return {
    recommendations: scored.sort((a, b) => b.score - a.score).slice(0, topN),
    isa95Warning: detectISA95Warning(headers, colTypes),
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
