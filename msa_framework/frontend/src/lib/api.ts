export type ApiError = {
  code: string;
  message: string;
};

export type ApiResponse<T> = {
  data: T | null;
  error: ApiError | null;
  meta: Record<string, unknown> | null;
};

/**
 * API 에러 타입
 */
export enum ApiErrorType {
  NETWORK_ERROR = "NETWORK_ERROR",
  TIMEOUT = "TIMEOUT",
  SERVER_ERROR = "SERVER_ERROR",
  CLIENT_ERROR = "CLIENT_ERROR",
  CORS_ERROR = "CORS_ERROR",
  UNKNOWN = "UNKNOWN",
}

/**
 * 확장된 API 에러 클래스
 */
export class ApiException extends Error {
  constructor(
    public readonly type: ApiErrorType,
    message: string,
    public readonly statusCode?: number,
    public readonly originalError?: Error
  ) {
    super(message);
    this.name = "ApiException";
  }
}

/**
 * 연결 상태 타입
 */
export type ConnectionStatus = "connected" | "disconnected" | "checking" | "error";

/**
 * 헬스체크 응답 타입
 */
export type HealthCheckResponse = {
  status: string;
};

/**
 * 재시도 옵션
 */
export type RetryOptions = {
  maxRetries?: number;
  initialDelay?: number;
  maxDelay?: number;
  backoffMultiplier?: number;
};

const DEFAULT_RETRY_OPTIONS: Required<RetryOptions> = {
  maxRetries: 0,
  initialDelay: 1000,
  maxDelay: 10000,
  backoffMultiplier: 2,
};

const ACCESS_TOKEN_STORAGE_KEY = "idg_access_token";

/** 브라우저에 저장된 JWT 액세스 토큰 (없으면 null) */
export function getStoredAccessToken(): string | null {
  if (typeof window === "undefined") return null;
  return sessionStorage.getItem(ACCESS_TOKEN_STORAGE_KEY);
}

/** 액세스 토큰을 sessionStorage에 저장합니다. */
export function setStoredAccessToken(token: string): void {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(ACCESS_TOKEN_STORAGE_KEY, token);
}

export function clearStoredAccessToken(): void {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(ACCESS_TOKEN_STORAGE_KEY);
}

export type AuthTokenRequest =
  | { grant_type: "api_key"; api_key: string }
  | { grant_type: "password"; username: string; password: string };

export type TokenResponseData = {
  access_token: string;
  token_type: string;
  expires_in: number;
};

export type AuthMeResponseData = {
  sub: string;
  typ: string;
  exp: number;
  iat: number;
};

type RequestOptions = RequestInit & {
  timeout?: number;
  retry?: RetryOptions;
  /** true이면 Authorization 헤더를 붙이지 않습니다(토큰 발급 등). */
  skipAuthHeader?: boolean;
};

function shouldAttachAuthHeader(path: string, method: string, skipAuthHeader?: boolean): boolean {
  if (skipAuthHeader) return false;
  if (method.toUpperCase() === "POST" && path.includes("/v1/auth/token")) return false;
  return true;
}

/**
 * HTTP 상태 코드를 기반으로 에러 타입 분류
 */
function classifyError(error: Error | null, response: Response | null): ApiErrorType {
  if (error) {
    if (error.message.includes("CORS") || error.message.includes("cors")) {
      return ApiErrorType.CORS_ERROR;
    }
    if (error.message.includes("timeout") || error.message.includes("Timeout")) {
      return ApiErrorType.TIMEOUT;
    }
    if (error.message.includes("network") || error.message.includes("Network")) {
      return ApiErrorType.NETWORK_ERROR;
    }
  }

  if (response) {
    if (response.status >= 500) {
      return ApiErrorType.SERVER_ERROR;
    }
    if (response.status >= 400) {
      return ApiErrorType.CLIENT_ERROR;
    }
  }

  return ApiErrorType.UNKNOWN;
}

/**
 * FastAPI 서버 연결 상태 확인
 * 
 * @param timeout 타임아웃 시간 (밀리초, 기본 5초)
 * @returns 연결 상태
 */
export async function checkConnection(timeout: number = 5000): Promise<ConnectionStatus> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    const res = await fetch("/api/healthz", {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!res.ok) {
      return "error";
    }

    const data = (await res.json()) as HealthCheckResponse;
    return data.status === "ok" ? "connected" : "error";
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      return "error"; // 타임아웃
    }
    return "disconnected";
  }
}

/**
 * 타임아웃이 적용된 fetch 래퍼
 */
async function fetchWithTimeout(
  url: string,
  options: RequestInit & { timeout?: number } = {}
): Promise<Response> {
  const { timeout = 10000, ...fetchOptions } = options;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      ...fetchOptions,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === "AbortError") {
      throw new ApiException(
        ApiErrorType.TIMEOUT,
        `요청이 타임아웃되었습니다 (${timeout}ms)`,
        undefined,
        error
      );
    }
    throw error;
  }
}

/**
 * API 요청 실행 (재시도 로직 포함)
 */
async function executeRequest<T>(path: string, init: RequestOptions = {}): Promise<T> {
  const { retry, timeout = 10000, skipAuthHeader, ...fetchOptions } = init;
  const retryOptions = { ...DEFAULT_RETRY_OPTIONS, ...retry };
  let lastError: unknown;
  const method = (fetchOptions.method ?? "GET").toString().toUpperCase();

  for (let attempt = 0; attempt <= retryOptions.maxRetries; attempt++) {
    try {
      const baseHeaders: Record<string, string> = {
        Accept: "application/json",
        "Content-Type": "application/json",
      };
      const incoming = fetchOptions.headers as Record<string, string> | undefined;
      if (incoming) {
        for (const [k, v] of Object.entries(incoming)) {
          baseHeaders[k] = v;
        }
      }
      const token = getStoredAccessToken();
      if (token && shouldAttachAuthHeader(path, method, skipAuthHeader)) {
        baseHeaders.Authorization = `Bearer ${token}`;
      }

      const res = await fetchWithTimeout(path, {
        ...fetchOptions,
        method,
        timeout,
        headers: baseHeaders,
      });

      // CORS 에러 체크
      if (res.status === 0) {
        throw new ApiException(
          ApiErrorType.CORS_ERROR,
          "CORS 오류: 서버에 연결할 수 없습니다. 서버 설정을 확인하세요.",
          res.status
        );
      }

      let json: ApiResponse<T>;
      try {
        json = (await res.json()) as ApiResponse<T>;
      } catch (parseError) {
        throw new ApiException(
          ApiErrorType.SERVER_ERROR,
          "서버 응답을 파싱할 수 없습니다.",
          res.status,
          parseError instanceof Error ? parseError : new Error(String(parseError))
        );
      }

      if (!res.ok) {
        const code = json?.error?.code ?? "HTTP_ERROR";
        const message = json?.error?.message ?? `Request failed (${res.status})`;
        const errorType = classifyError(null, res);
        throw new ApiException(errorType, `${code}: ${message}`, res.status);
      }

      if (json.error) {
        const errorType = classifyError(null, res);
        throw new ApiException(
          errorType,
          `${json.error.code}: ${json.error.message}`,
          res.status
        );
      }

      if (json.data === null || json.data === undefined) {
        throw new ApiException(
          ApiErrorType.SERVER_ERROR,
          "서버 응답에 데이터가 없습니다.",
          res.status
        );
      }

      return json.data as T;
    } catch (error) {
      lastError = error;

      // 재시도 가능한 에러인지 확인
      if (error instanceof ApiException) {
        const isRetryable =
          error.type === ApiErrorType.NETWORK_ERROR ||
          error.type === ApiErrorType.TIMEOUT ||
          error.type === ApiErrorType.SERVER_ERROR ||
          (error.statusCode && error.statusCode >= 500);

        if (!isRetryable || attempt >= retryOptions.maxRetries) {
          throw error;
        }
      } else if (attempt >= retryOptions.maxRetries) {
        const errorType = classifyError(
          error instanceof Error ? error : new Error(String(error)),
          null
        );
        throw new ApiException(
          errorType,
          error instanceof Error ? error.message : String(error),
          undefined,
          error instanceof Error ? error : new Error(String(error))
        );
      }

      // 지수 백오프로 대기
      const delay = Math.min(
        retryOptions.initialDelay * Math.pow(retryOptions.backoffMultiplier, attempt),
        retryOptions.maxDelay
      );
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  // 이론적으로 도달할 수 없지만 타입 안전성을 위해
  const errorType = classifyError(
    lastError instanceof Error ? lastError : new Error(String(lastError)),
    null
  );
  throw new ApiException(
    errorType,
    lastError instanceof Error ? lastError.message : String(lastError),
    undefined,
    lastError instanceof Error ? lastError : new Error(String(lastError))
  );
}

/**
 * Next 프론트에서 same-origin(`/api/*`)로 호출하면 next.config rewrites가 FastAPI로 프록시합니다.
 * 
 * @param path API 경로
 * @param init fetch 옵션 (timeout, retry 옵션 포함)
 * @returns API 응답 데이터
 * @throws ApiException API 에러 발생 시
 */
export async function apiGet<T>(path: string, init?: RequestOptions): Promise<T> {
  return executeRequest<T>(path, { ...init, method: "GET" });
}

/**
 * POST 요청
 * 
 * @param path API 경로
 * @param body 요청 본문
 * @param init fetch 옵션 (timeout, retry 옵션 포함)
 * @returns API 응답 데이터
 * @throws ApiException API 에러 발생 시
 */
export async function apiPost<T>(path: string, body?: unknown, init?: RequestOptions): Promise<T> {
  return executeRequest<T>(path, {
    ...init,
    method: "POST",
    body: body ? JSON.stringify(body) : undefined,
  });
}

/**
 * PUT 요청
 * 
 * @param path API 경로
 * @param body 요청 본문
 * @param init fetch 옵션 (timeout, retry 옵션 포함)
 * @returns API 응답 데이터
 * @throws ApiException API 에러 발생 시
 */
export async function apiPut<T>(path: string, body?: unknown, init?: RequestOptions): Promise<T> {
  return executeRequest<T>(path, {
    ...init,
    method: "PUT",
    body: body ? JSON.stringify(body) : undefined,
  });
}

/**
 * DELETE 요청
 * 
 * @param path API 경로
 * @param init fetch 옵션 (timeout, retry 옵션 포함)
 * @returns API 응답 데이터
 * @throws ApiException API 에러 발생 시
 */
export async function apiDelete<T>(path: string, init?: RequestOptions): Promise<T> {
  return executeRequest<T>(path, { ...init, method: "DELETE" });
}

/**
 * JWT 액세스 토큰 발급 (Authorization 헤더 미부착).
 */
export async function issueAccessToken(body: AuthTokenRequest): Promise<TokenResponseData> {
  return apiPost<TokenResponseData>("/api/v1/auth/token", body, { skipAuthHeader: true });
}

/**
 * Bearer 토큰 검증 데모: 현재 저장된 토큰으로 클레임 요약 조회.
 */
export async function fetchAuthMe(): Promise<AuthMeResponseData> {
  return apiGet<AuthMeResponseData>("/api/v1/auth/me");
}

/**
 * 마이크로서비스 관련 타입
 */
export interface CreateMicroserviceRequest {
  name: string;
  category: string;
  description: string;
  status?: "healthy" | "degraded" | "down";
  metrics?: {
    latency: number;
    throughput: number;
    errorRate: number;
  };
  // 네트워크 정보: 게이트웨이 라우팅에 필수
  host: string;
  port: number;
  protocol?: string;
}

export interface UpdateMicroserviceRequest {
  name?: string;
  category?: string;
  description?: string;
  status?: "healthy" | "degraded" | "down";
  metrics?: {
    latency: number;
    throughput: number;
    errorRate: number;
  };
  // 네트워크 정보
  host?: string;
  port?: number;
  protocol?: string;
}

/**
 * 마이크로서비스 상세 조회
 */
export async function getMicroservice(id: string) {
  return apiGet<import("../types").Microservice>(`/api/v1/microservices/${id}`);
}

/**
 * 마이크로서비스 등록
 */
export async function createMicroservice(data: CreateMicroserviceRequest) {
  return apiPost<import("../types").Microservice>("/api/v1/microservices", data);
}

/**
 * 마이크로서비스 수정
 */
export async function updateMicroservice(id: string, data: UpdateMicroserviceRequest) {
  return apiPut<import("../types").Microservice>(`/api/v1/microservices/${id}`, data);
}

/**
 * 마이크로서비스 삭제
 */
export async function deleteMicroservice(id: string) {
  return apiDelete<{ id: string; deleted: boolean }>(`/api/v1/microservices/${id}`);
}
