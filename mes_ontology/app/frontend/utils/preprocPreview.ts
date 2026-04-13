/**
 * 전처리 탭 설정(결측·이상치·스케일)을 컬럼 탐색 차트용 미리보기 행렬에 반영합니다.
 * SMOTE·시계열 증강·피처 엔지니어링은 행/열 구조가 바뀌어 제외합니다.
 * 타깃(마지막 열)·시계열 후보 열·비수치 열은 변환하지 않습니다.
 */

export type ColumnExplorationPreprocConfig = {
  missingStrategy: 'mean' | 'median' | 'drop' | 'zero';
  outlierMethod: 'iqr' | 'zscore' | 'none';
  scalingMethod: 'standard' | 'minmax' | 'robust' | 'none';
};

function isLikelyTimeSeriesColumn(header: string, sampleValues: string[]): boolean {
  if (/^(timestamp|time|date|datetime|ts|시간|날짜|일시|일자|측정일)/i.test(header.trim())) return true;
  const nonEmpty = sampleValues.filter((v) => v !== '');
  if (nonEmpty.length === 0) return false;
  const isoDate = /^\d{4}-\d{2}-\d{2}/;
  const korDate = /^\d{4}[./]\d{2}[./]\d{2}/;
  const unixTs = /^\d{10,13}$/;
  const matched = nonEmpty.filter((v) => isoDate.test(v) || korDate.test(v) || unixTs.test(v)).length;
  return matched / nonEmpty.length >= 0.5;
}

function columnIsNumeric(rows: string[][], colIdx: number): boolean {
  let hasAny = false;
  for (const r of rows) {
    const v = r[colIdx];
    if (v === '') continue;
    const n = Number(v);
    if (Number.isNaN(n) || !Number.isFinite(n)) return false;
    hasAny = true;
  }
  return hasAny;
}

function medianSorted(sorted: number[]): number {
  if (sorted.length === 0) return 0;
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

function quantileSorted(sorted: number[], q: number): number {
  if (sorted.length === 0) return 0;
  const pos = (sorted.length - 1) * q;
  const base = Math.floor(pos);
  const rest = pos - base;
  if (sorted[base + 1] !== undefined) {
    return sorted[base]! + rest * (sorted[base + 1]! - sorted[base]!);
  }
  return sorted[base]!;
}

function fmtCell(n: number): string {
  if (!Number.isFinite(n)) return '';
  const rounded = Number(n.toPrecision(12));
  return String(rounded);
}

/**
 * 미리보기 테이블에 결측·이상치·스케일을 적용한 복사본을 반환합니다.
 */
export function buildColumnExplorationPreview(
  dataPreview: { headers: string[]; rows: string[][] },
  config: ColumnExplorationPreprocConfig
): { headers: string[]; rows: string[][] } {
  const { headers, rows } = dataPreview;
  if (headers.length < 2 || rows.length === 0) {
    return { headers: [...headers], rows: rows.map((r) => [...r]) };
  }

  const targetIdx = headers.length - 1;
  const numericCols: number[] = [];
  for (let j = 0; j < targetIdx; j++) {
    const samples = rows.map((r) => r[j] ?? '');
    if (isLikelyTimeSeriesColumn(headers[j] ?? '', samples)) continue;
    if (columnIsNumeric(rows, j)) numericCols.push(j);
  }

  if (numericCols.length === 0) {
    return { headers: [...headers], rows: rows.map((r) => [...r]) };
  }

  let working = rows.map((r) => [...r]);

  if (config.missingStrategy === 'drop') {
    working = working.filter((row) =>
      numericCols.every((j) => {
        const v = row[j];
        return v !== '' && !Number.isNaN(Number(v)) && Number.isFinite(Number(v));
      })
    );
    if (working.length === 0) {
      return { headers: [...headers], rows: rows.map((r) => [...r]) };
    }
  }

  const parseCell = (row: string[], j: number): number | null => {
    const v = row[j];
    if (v === '') return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };

  for (const j of numericCols) {
    const present: number[] = [];
    for (let i = 0; i < working.length; i++) {
      const n = parseCell(working[i]!, j);
      if (n !== null) present.push(n);
    }

    let fill = 0;
    if (config.missingStrategy === 'mean') {
      fill = present.length ? present.reduce((a, b) => a + b, 0) / present.length : 0;
    } else if (config.missingStrategy === 'median') {
      fill = medianSorted([...present].sort((a, b) => a - b));
    } else {
      fill = 0;
    }

    for (let i = 0; i < working.length; i++) {
      if (parseCell(working[i]!, j) === null) {
        if (config.missingStrategy !== 'drop') {
          working[i]![j] = fmtCell(fill);
        }
      }
    }
  }

  const colValues = (j: number): number[] => {
    const out: number[] = [];
    for (let i = 0; i < working.length; i++) {
      const n = parseCell(working[i]!, j);
      if (n !== null) out.push(n);
    }
    return out;
  };

  if (config.outlierMethod === 'iqr') {
    for (const j of numericCols) {
      const vals = colValues(j).sort((a, b) => a - b);
      if (vals.length < 2) continue;
      const q1 = quantileSorted(vals, 0.25);
      const q3 = quantileSorted(vals, 0.75);
      const iqr = q3 - q1;
      const low = q1 - 1.5 * iqr;
      const high = q3 + 1.5 * iqr;
      for (let i = 0; i < working.length; i++) {
        const n = parseCell(working[i]!, j);
        if (n === null) continue;
        const c = Math.min(high, Math.max(low, n));
        working[i]![j] = fmtCell(c);
      }
    }
  } else if (config.outlierMethod === 'zscore') {
    for (const j of numericCols) {
      const vals = colValues(j);
      if (vals.length < 2) continue;
      const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
      const variance = vals.reduce((s, x) => s + (x - mean) ** 2, 0) / vals.length;
      const std = Math.sqrt(variance);
      if (std === 0) continue;
      const zlim = 3;
      for (let i = 0; i < working.length; i++) {
        const n = parseCell(working[i]!, j);
        if (n === null) continue;
        const z = (n - mean) / std;
        const c = mean + Math.min(zlim, Math.max(-zlim, z)) * std;
        working[i]![j] = fmtCell(c);
      }
    }
  }

  if (config.scalingMethod !== 'none') {
    for (const j of numericCols) {
      const vals = colValues(j);
      if (vals.length === 0) continue;

      if (config.scalingMethod === 'standard') {
        const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
        const variance = vals.reduce((s, x) => s + (x - mean) ** 2, 0) / Math.max(vals.length, 1);
        const std = Math.sqrt(variance);
        if (std === 0) continue;
        for (let i = 0; i < working.length; i++) {
          const n = parseCell(working[i]!, j);
          if (n === null) continue;
          working[i]![j] = fmtCell((n - mean) / std);
        }
      } else if (config.scalingMethod === 'minmax') {
        const min = Math.min(...vals);
        const max = Math.max(...vals);
        const span = max - min;
        if (span === 0) continue;
        for (let i = 0; i < working.length; i++) {
          const n = parseCell(working[i]!, j);
          if (n === null) continue;
          working[i]![j] = fmtCell((n - min) / span);
        }
      } else if (config.scalingMethod === 'robust') {
        const sorted = [...vals].sort((a, b) => a - b);
        const med = medianSorted(sorted);
        const q1 = quantileSorted(sorted, 0.25);
        const q3 = quantileSorted(sorted, 0.75);
        const iqr = q3 - q1;
        if (iqr === 0) continue;
        for (let i = 0; i < working.length; i++) {
          const n = parseCell(working[i]!, j);
          if (n === null) continue;
          working[i]![j] = fmtCell((n - med) / iqr);
        }
      }
    }
  }

  return { headers: [...headers], rows: working };
}
