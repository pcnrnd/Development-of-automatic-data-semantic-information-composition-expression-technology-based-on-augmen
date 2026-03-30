import type { DataProfile } from '../types';

/** CSV 파싱 결과: AutoML용 features/target + 매칭용 DataProfile */
export interface ParsedCsvResult {
  features: number[][];
  target: number[];
  profile: DataProfile;
}

/** 파싱 성공/실패 + 실패 시 사유 (UI 안내용) */
export type ParseCsvForAutomlResult =
  | { ok: true; data: ParsedCsvResult }
  | { ok: false; error: string };

const MAX_ROWS = 5000;

/**
 * CSV 파일을 읽어 AutoML용 features(2D), target(1D)과 DataProfile을 반환합니다.
 * 첫 줄은 헤더, 마지막 컬럼은 target, 나머지는 feature 컬럼으로 간주합니다.
 * 숫자로 변환 불가 행은 건너뛰며, 최대 MAX_ROWS행만 사용합니다.
 * 실패 시 { ok: false, error }로 사유를 반환해 UI에서 안내할 수 있게 합니다.
 */
export async function parseCsvForAutoml(file: File): Promise<ParseCsvForAutomlResult> {
  const raw = await file.text();
  // BOM 제거
  const text = raw.replace(/^\uFEFF/, '');
  const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines.length < 2) return { ok: false, error: '파일이 비어 있거나 헤더 외 데이터 행이 없습니다.' };

  const delimiter = lines[0].includes(';') ? ';' : ',';
  const stripQuotes = (s: string) => s.replace(/^"|"$/g, '');
  const headers = lines[0].split(delimiter).map((h) => stripQuotes(h.trim()));
  if (headers.length < 2) return { ok: false, error: '헤더(컬럼)가 2개 이상이어야 합니다. 마지막 컬럼은 타깃(레이블)으로 사용됩니다.' };

  // 1단계: 전체 행을 문자열로 파싱
  const rawRows: string[][] = [];
  for (let i = 1; i < lines.length && rawRows.length < MAX_ROWS; i++) {
    const cells = lines[i].split(delimiter).map((c) => stripQuotes(c.trim()));
    if (cells.length === headers.length) rawRows.push(cells);
  }
  if (rawRows.length < 2) return { ok: false, error: '유효한 데이터 행이 2행 미만입니다. 컬럼 수가 헤더와 일치하는지 확인해 주세요.' };

  // 2단계: 숫자 변환 가능한 feature 컬럼만 추출 (날짜·문자열 컬럼 자동 제외)
  const targetColIdx = headers.length - 1;
  const featureColIdxs: number[] = [];
  for (let c = 0; c < targetColIdx; c++) {
    const hasNumeric = rawRows.some((row) => row[c] !== '' && !Number.isNaN(Number(row[c])));
    if (hasNumeric) featureColIdxs.push(c);
  }
  if (featureColIdxs.length === 0) {
    return { ok: false, error: '숫자형 피처 컬럼이 없습니다. 날짜·문자열 전용 컬럼은 자동으로 제외됩니다.' };
  }

  // 3단계: target 컬럼 인코딩 — 문자열이면 레이블 인코딩, 숫자면 그대로 사용
  const targetRaw = rawRows.map((row) => row[targetColIdx]);
  const allNumericTarget = targetRaw.every((v) => v !== '' && !Number.isNaN(Number(v)));
  let targetEncoded: number[];
  if (allNumericTarget) {
    targetEncoded = targetRaw.map(Number);
  } else {
    const labelMap: Record<string, number> = {};
    let nextId = 0;
    targetEncoded = targetRaw.map((v) => {
      if (!(v in labelMap)) labelMap[v] = nextId++;
      return labelMap[v];
    });
  }

  // 4단계: feature 행렬 구성 (비숫자 셀이 있는 행만 제외)
  const features: number[][] = [];
  const target: number[] = [];
  let missingCount = 0;

  for (let r = 0; r < rawRows.length; r++) {
    const row = rawRows[r];
    const featureRow: number[] = [];
    let rowValid = true;
    for (const c of featureColIdxs) {
      const n = Number(row[c]);
      if (row[c] === '' || Number.isNaN(n)) {
        missingCount++;
        rowValid = false;
        break;
      }
      featureRow.push(n);
    }
    if (rowValid) {
      features.push(featureRow);
      target.push(targetEncoded[r]);
    }
  }

  if (features.length < 2) return { ok: false, error: '숫자형 유효 행이 2행 미만입니다. 데이터를 확인해 주세요.' };

  const featureNames = featureColIdxs.map((c) => headers[c]);
  const profile: DataProfile = {
    features: featureNames,
    recordsCount: features.length,
    noiseLevel: 0.15,
    seasonality: true,
    missingValues: Math.min(100, missingCount),
    dataTypes: Object.fromEntries(featureNames.map((f) => [f, 'Continuous'])),
  };

  return { ok: true, data: { features, target, profile } };
}
