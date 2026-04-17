import type { DataProfile } from '../types';

/** CSV 파싱 결과: AutoML용 features/target + 매칭용 DataProfile */
export interface ParsedCsvResult {
  features: number[][];
  target: number[];
  profile: DataProfile;
  /** 원본 행 수가 MAX_ROWS를 초과해 잘렸는지 여부 (UI 안내용) */
  truncated: boolean;
  /** 실제 사용된 행 수 */
  usedRows: number;
}

/** 파싱 성공/실패 + 실패 시 사유 (UI 안내용) */
export type ParseCsvForAutomlResult =
  | { ok: true; data: ParsedCsvResult }
  | { ok: false; error: string };

const MAX_ROWS = 5000;
/** 업로드 파일 크기 상한 (50MB) — 브라우저 메모리 보호 */
const MAX_FILE_BYTES = 50 * 1024 * 1024;

/**
 * RFC 4180 스타일 CSV 한 줄 파서.
 * 따옴표 안의 구분자·줄바꿈·이스케이프된 따옴표("")를 처리합니다.
 * (PapaParse 의존성 없이 가벼운 자체 구현)
 */
function parseCsvText(text: string, delimiter: string): string[][] {
  const rows: string[][] = [];
  let field = '';
  let row: string[] = [];
  let inQuotes = false;
  let i = 0;
  const len = text.length;

  while (i < len) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i += 2; continue; }
        inQuotes = false; i++; continue;
      }
      field += ch; i++; continue;
    }
    if (ch === '"') { inQuotes = true; i++; continue; }
    if (ch === delimiter) { row.push(field); field = ''; i++; continue; }
    if (ch === '\r') { i++; continue; }
    if (ch === '\n') { row.push(field); rows.push(row); row = []; field = ''; i++; continue; }
    field += ch; i++;
  }
  // 마지막 필드/행 flush
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

/**
 * CSV 파일을 읽어 AutoML용 features(2D), target(1D)과 DataProfile을 반환합니다.
 * 첫 줄은 헤더이며, labelColumnName이 지정되면 해당 컬럼을 target으로 사용합니다.
 * labelColumnName이 없거나 찾지 못하면 마지막 컬럼을 target으로 사용합니다.
 * 숫자로 변환 불가 행은 건너뛰며, 최대 MAX_ROWS행만 사용합니다.
 * 실패 시 { ok: false, error }로 사유를 반환해 UI에서 안내할 수 있게 합니다.
 */
export async function parseCsvForAutoml(file: File, labelColumnName?: string): Promise<ParseCsvForAutomlResult> {
  if (file.size > MAX_FILE_BYTES) {
    return { ok: false, error: `파일이 너무 큽니다 (최대 ${Math.round(MAX_FILE_BYTES / 1024 / 1024)}MB).` };
  }
  const raw = await file.text();
  // BOM 제거
  const text = raw.replace(/^\uFEFF/, '');
  if (text.trim().length === 0) {
    return { ok: false, error: '파일이 비어 있습니다.' };
  }

  // 헤더 한 줄을 먼저 추출해서 구분자 추정 (`;`이 더 많으면 세미콜론, 그 외 콤마)
  const firstLineEnd = text.search(/\r?\n/);
  const headerLine = firstLineEnd >= 0 ? text.slice(0, firstLineEnd) : text;
  const semiCount = (headerLine.match(/;/g) || []).length;
  const commaCount = (headerLine.match(/,/g) || []).length;
  const delimiter = semiCount > commaCount ? ';' : ',';

  const allRows = parseCsvText(text, delimiter).filter((r) => r.some((c) => c.trim().length > 0));
  if (allRows.length < 2) {
    return { ok: false, error: '파일이 비어 있거나 헤더 외 데이터 행이 없습니다.' };
  }

  const headers = allRows[0].map((h) => h.trim());
  if (headers.length < 2) {
    return { ok: false, error: '헤더(컬럼)가 2개 이상이어야 합니다. 마지막 컬럼은 타깃(레이블)으로 사용됩니다.' };
  }

  const totalDataRows = allRows.length - 1;
  const truncated = totalDataRows > MAX_ROWS;
  const rawRows: string[][] = [];
  for (let i = 1; i < allRows.length && rawRows.length < MAX_ROWS; i++) {
    const cells = allRows[i].map((c) => c.trim());
    if (cells.length === headers.length) rawRows.push(cells);
  }
  if (rawRows.length < 2) return { ok: false, error: '유효한 데이터 행이 2행 미만입니다. 컬럼 수가 헤더와 일치하는지 확인해 주세요.' };

  // 2단계: 타깃 컬럼을 결정한 뒤 숫자 변환 가능한 feature 컬럼만 추출 (날짜·문자열 컬럼 자동 제외)
  const selectedTargetIdx = labelColumnName ? headers.indexOf(labelColumnName) : -1;
  const targetColIdx = selectedTargetIdx >= 0 ? selectedTargetIdx : headers.length - 1;
  const featureColIdxs: number[] = [];
  for (let c = 0; c < headers.length; c++) {
    if (c === targetColIdx) continue;
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

  return { ok: true, data: { features, target, profile, truncated, usedRows: features.length } };
}
