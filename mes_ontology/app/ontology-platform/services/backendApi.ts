/**
 * 백엔드 API 연동 (선택).
 * VITE_API_URL이 설정된 경우 Manufacturing Ontology API 호출.
 */

const getBaseUrl = (): string => {
  try {
    return (import.meta as unknown as { env?: { VITE_API_URL?: string } }).env?.VITE_API_URL ?? '';
  } catch {
    return '';
  }
};

/** 백엔드 URL 설정 여부 (연동 실패 메시지 표시용) */
export function isBackendConfigured(): boolean {
  return getBaseUrl().length > 0;
}

export interface AutoMLFitResult {
  best_model: string;
  best_score: number;
  task: string;
  scoring: string;
  /** 모델별 점수 (순위·시각화용). 1등~3등 추천 리스트에 사용 */
  all_results?: { model: string; mean_score: number }[];
  /** 적용/추천 전처리 방법 목록 */
  preprocessing_methods?: string[];
  /** 추천 시각화 방법 목록 */
  visualization_methods?: string[];
}

export type AutomlFitResponse =
  | { ok: true; data: AutoMLFitResult }
  | { ok: false; error: string };

/**
 * 백엔드 AutoML /automl/fit 호출.
 * features: 2차원 배열, target: 1차원 배열.
 * baseUrl 미설정 시 ok: false, error 비어 있음. 실패 시 error 메시지 반환.
 */
export async function automlFit(
  features: number[][],
  target: number[],
  task: 'classification' | 'regression' = 'classification'
): Promise<AutomlFitResponse> {
  const baseUrl = getBaseUrl();
  if (!baseUrl) {
    return { ok: false, error: '' };
  }
  try {
    const res = await fetch(`${baseUrl.replace(/\/$/, '')}/automl/fit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ features, target, task, cv: 3 }),
    });
    if (!res.ok) {
      let detail = 'AutoML 서버 오류';
      try {
        const body = await res.json();
        if (body?.detail) detail = typeof body.detail === 'string' ? body.detail : String(body.detail);
      } catch {
        // ignore
      }
      return { ok: false, error: detail };
    }
    const data = (await res.json()) as AutoMLFitResult;
    return { ok: true, data };
  } catch (_e) {
    return { ok: false, error: '네트워크 오류 또는 서버에 연결할 수 없습니다.' };
  }
}
