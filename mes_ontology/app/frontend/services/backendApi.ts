/**
 * 백엔드 API 연동 (선택).
 * VITE_API_URL이 설정된 경우 Manufacturing Ontology API 호출.
 * 개발 시 CORS 회피: vite.config.ts의 /api 프록시와 함께 VITE_API_URL=/api 사용.
 */

const getEnv = (): { VITE_API_URL?: string; VITE_AUTOML_MOCK?: string } => {
  try {
    return (import.meta as unknown as { env?: { VITE_API_URL?: string; VITE_AUTOML_MOCK?: string } }).env ?? {};
  } catch {
    return {};
  }
};

const getBaseUrl = (): string => getEnv().VITE_API_URL ?? '';

/** VITE_AUTOML_MOCK=true 시 백엔드 호출 없이 mock 데이터 반환 */
const isMockMode = (): boolean => getEnv().VITE_AUTOML_MOCK === 'true';

/** 백엔드 URL 설정 여부 (연동 실패 메시지 표시용) */
export function isBackendConfigured(): boolean {
  return getBaseUrl().length > 0;
}

const MOCK_AUTOML_RESULT: AutoMLFitResult = {
  best_model: 'HistGradientBoosting',
  best_score: 0.934,
  task: 'classification',
  scoring: 'accuracy',
  aux_scoring: 'f1_weighted',
  all_results: [
    { model: 'HistGradientBoosting', mean_score: 0.934, std_score: 0.011, aux_score: 0.931,
      preprocessing_methods: ['범주형 인코딩(OrdinalEncoder 권장)', 'max_iter·learning_rate 탐색', '피처 중요도 기반 불필요 피처 제거'],
      visualization_methods: ['피처 중요도(상위 10)', '학습 곡선(반복별 손실)', '혼동 행렬(학습 후)', '시계열/피처별 추세'] },
    { model: 'RandomForest',         mean_score: 0.921, std_score: 0.015, aux_score: 0.918,
      preprocessing_methods: ['이상치 IQR 클리핑(선택)', '범주형 인코딩(Label/Ordinal)', 'n_estimators·max_depth 탐색'],
      visualization_methods: ['피처 중요도(상위 10)', '혼동 행렬(학습 후)', '클래스별 정밀도·재현율', '시계열/피처별 추세'] },
    { model: 'ExtraTrees',           mean_score: 0.915, std_score: 0.014, aux_score: 0.912,
      preprocessing_methods: ['이상치 허용(분할 기반)', '범주형 인코딩(Label/Ordinal)', 'max_features 비율 탐색'],
      visualization_methods: ['피처 중요도(상위 10)', '혼동 행렬(학습 후)', '클래스별 정밀도·재현율', '시계열/피처별 추세'] },
    { model: 'GradientBoosting',     mean_score: 0.903, std_score: 0.017, aux_score: 0.899,
      preprocessing_methods: ['이상치 IQR 클리핑(선택)', '범주형 인코딩(Label/Ordinal)', 'learning_rate·n_estimators 조합 탐색'],
      visualization_methods: ['피처 중요도(상위 10)', '학습 곡선(반복별 손실)', '혼동 행렬(학습 후)', '시계열/피처별 추세'] },
    { model: 'AdaBoost',             mean_score: 0.874, std_score: 0.021, aux_score: 0.870,
      preprocessing_methods: ['이상치 IQR 클리핑 — 부스팅 가중치 왜곡 방지', '범주형 인코딩(Label)', '약한 학습기 max_depth=1~3 조정'],
      visualization_methods: ['약한 학습기 오류율 추이', '피처 중요도', '혼동 행렬(학습 후)'] },
    { model: 'LogisticRegression',   mean_score: 0.841, std_score: 0.025, aux_score: 0.837,
      preprocessing_methods: ['StandardScaler', '이상치 IQR 클리핑', '다중공선성 확인(VIF)', '범주형 인코딩(One-Hot)'],
      visualization_methods: ['혼동 행렬(학습 후)', '클래스 분포', '상관관계 히트맵', '계수(coef) 크기 막대'] },
    { model: 'SVC',                  mean_score: 0.823, std_score: 0.028, aux_score: 0.819,
      preprocessing_methods: ['StandardScaler', '이상치 IQR 클리핑', 'RBF 커널 γ·C 그리드 탐색'],
      visualization_methods: ['혼동 행렬(학습 후)', '클래스 분포', '서포트 벡터 수 확인'] },
    { model: 'KNN',                  mean_score: 0.797, std_score: 0.032, aux_score: 0.793,
      preprocessing_methods: ['StandardScaler', '이상치 IQR 클리핑', '차원 축소(PCA) — 고차원 거리 왜곡 방지', 'k=5 이웃 수 교차검증으로 재확인'],
      visualization_methods: ['혼동 행렬(학습 후)', '클래스 분포', 'k별 정확도 곡선'] },
    { model: 'DecisionTree',         mean_score: 0.754, std_score: 0.041, aux_score: 0.749,
      preprocessing_methods: ['이상치 허용(분할 기반)', '범주형 인코딩(Label/Ordinal)', 'max_depth 제한으로 과적합 방지', 'min_samples_leaf 조정'],
      visualization_methods: ['트리 구조 시각화(depth≤3)', '피처 중요도', '혼동 행렬(학습 후)'] },
  ],
  preprocessing_methods: ['StandardScaler', '이상치 IQR 클리핑', '결측치 대체(중앙값/평균)'],
  visualization_methods: ['산점도', '상관관계 히트맵', '클래스 분포', '혼동 행렬(학습 후)'],
};

export interface AutoMLFitResult {
  best_model: string;
  best_score: number;
  task: string;
  scoring: string;
  /** 보조 scoring 이름 (분류: f1_weighted, 회귀: neg_mean_absolute_error) */
  aux_scoring?: string;
  /** 모델별 점수 (순위·시각화용). 1등~N등 추천 리스트에 사용 */
  all_results?: {
    model: string;
    mean_score: number;
    std_score?: number;
    aux_score?: number | null;
    /** 모델별 전처리 추천 (휴리스틱, 참고용) */
    preprocessing_methods?: string[];
    /** 모델별 시각화 추천 (휴리스틱, 참고용) */
    visualization_methods?: string[];
  }[];
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
  if (isMockMode()) {
    return { ok: true, data: { ...MOCK_AUTOML_RESULT, task, scoring: task === 'regression' ? 'r2' : 'accuracy', aux_scoring: task === 'regression' ? 'neg_mean_absolute_error' : 'f1_weighted' } };
  }
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
      body: JSON.stringify({ features, target, task, cv: 5 }),
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
