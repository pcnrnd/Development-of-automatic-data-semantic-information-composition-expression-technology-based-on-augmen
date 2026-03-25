import { DataProfile, IndustryType, MESFunction, MatchingResult } from '../types';

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

export const analysisService = {
  analyzeDataAndMatch,
};
