/**
 * 백엔드 API 연동 (선택).
 * VITE_API_URL이 설정된 경우 Manufacturing Ontology API 호출.
 * 개발 시 CORS 회피: vite.config.ts의 /api 프록시와 함께 VITE_API_URL=/api 사용.
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

/**
 * AutoML 호출 결과 — discriminated union.
 * - ok: 성공 (data 포함)
 * - no-config: VITE_API_URL 미설정 (호출 자체를 건너뜀, UI에서 경고 숨김)
 * - http-error: 서버가 4xx/5xx 반환
 * - network-error: fetch 자체 실패 (CORS, 미기동 등)
 * - timeout: 요청이 제한 시간을 초과
 */
export type AutomlFitResponse =
  | { ok: true; data: AutoMLFitResult }
  | { ok: false; kind: 'no-config' }
  | { ok: false; kind: 'http-error'; status: number; error: string }
  | { ok: false; kind: 'network-error'; error: string }
  | { ok: false; kind: 'timeout'; error: string };

/** `fetch` 예외 시 표시 메시지. UI에서 동일 문자열로 분기 가능 */
export const AUTOML_FETCH_FAILED_MESSAGE = '네트워크 오류 또는 서버에 연결할 수 없습니다.';
export const AUTOML_TIMEOUT_MESSAGE = 'AutoML 서버 응답이 너무 오래 걸려 요청을 취소했습니다.';

/** 기본 타임아웃: 60초 (AutoML CV가 무거울 수 있어 일반 API보다 길게 설정) */
const DEFAULT_TIMEOUT_MS = 60_000;

/**
 * 백엔드 AutoML /automl/fit 호출.
 * features: 2차원 배열, target: 1차원 배열.
 * VITE_API_URL 미설정 시 kind='no-config'를 반환합니다.
 */
export async function automlFit(
  features: number[][],
  target: number[],
  task: 'classification' | 'regression' = 'classification',
  options?: { timeoutMs?: number; signal?: AbortSignal }
): Promise<AutomlFitResponse> {
  const baseUrl = getBaseUrl();
  if (!baseUrl) {
    return { ok: false, kind: 'no-config' };
  }
  const timeoutMs = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  // 외부 signal과 합성
  if (options?.signal) {
    if (options.signal.aborted) controller.abort();
    else options.signal.addEventListener('abort', () => controller.abort(), { once: true });
  }

  try {
    const res = await fetch(`${baseUrl.replace(/\/$/, '')}/automl/fit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ features, target, task, cv: 3 }),
      signal: controller.signal,
    });
    if (!res.ok) {
      let detail = 'AutoML 서버 오류';
      try {
        const body = await res.json();
        if (body?.detail) detail = typeof body.detail === 'string' ? body.detail : String(body.detail);
      } catch {
        // ignore
      }
      return { ok: false, kind: 'http-error', status: res.status, error: detail };
    }
    const data = (await res.json()) as AutoMLFitResult;
    return { ok: true, data };
  } catch (e) {
    if ((e as Error)?.name === 'AbortError') {
      console.warn('[automlFit] aborted (timeout):', e);
      return { ok: false, kind: 'timeout', error: AUTOML_TIMEOUT_MESSAGE };
    }
    console.warn('[automlFit] fetch failed:', e);
    return { ok: false, kind: 'network-error', error: AUTOML_FETCH_FAILED_MESSAGE };
  } finally {
    clearTimeout(timer);
  }
}
