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
  const text = await file.text();
  const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines.length < 2) return { ok: false, error: '파일이 비어 있거나 헤더 외 데이터 행이 없습니다.' };

  const delimiter = lines[0].includes(';') ? ';' : ',';
  const headers = lines[0].split(delimiter).map((h) => h.trim());
  if (headers.length < 2) return { ok: false, error: '헤더(컬럼)가 2개 이상이어야 합니다. 마지막 컬럼은 타깃(레이블)으로 사용됩니다.' };

  const featureNames = headers.slice(0, -1);
  const rows: number[][] = [];
  let missingCount = 0;

  for (let i = 1; i < lines.length && rows.length < MAX_ROWS; i++) {
    const cells = lines[i].split(delimiter).map((c) => c.trim());
    if (cells.length !== headers.length) continue;

    const row: number[] = [];
    let valid = true;
    for (let c = 0; c < cells.length; c++) {
      const num = Number(cells[c]);
      if (Number.isNaN(num)) {
        missingCount++;
        valid = false;
        break;
      }
      row.push(num);
    }
    if (valid && row.length) rows.push(row);
  }

  if (rows.length < 2) return { ok: false, error: '숫자만 있는 유효한 데이터 행이 2행 미만입니다. 모든 셀이 숫자인지, 구분자는 쉼표(,) 또는 세미콜론(;)인지 확인해 주세요.' };

  const features = rows.map((row) => row.slice(0, -1));
  const target = rows.map((row) => row[row.length - 1]);

  const profile: DataProfile = {
    features: featureNames,
    recordsCount: rows.length,
    noiseLevel: 0.15,
    seasonality: true,
    missingValues: Math.min(100, missingCount),
    dataTypes: Object.fromEntries(featureNames.map((f) => [f, 'Continuous'])),
  };

  return { ok: true, data: { features, target, profile } };
}
