import { useEffect, useRef, useState, useCallback } from "react";

/**
 * Polling 옵션
 */
export type PollingOptions<T> = {
  /** 폴링 간격 (밀리초, 기본값: 5000) */
  interval?: number;
  /** 폴링 활성화 여부 (기본값: true) */
  enabled?: boolean;
  /** 데이터 비교 함수 (같으면 true 반환, 변경 감지용) */
  compareFn?: (prev: T | null, next: T) => boolean;
  /** 에러 발생 시 재시도 여부 (기본값: true) */
  retryOnError?: boolean;
  /** 최대 재시도 횟수 (기본값: 3) */
  maxRetries?: number;
  /** 탭이 비활성화될 때 폴링 일시정지 여부 (기본값: true) */
  pauseOnHidden?: boolean;
  /** 적응형 폴링 간격 사용 여부 (기본값: false) */
  adaptiveInterval?: boolean;
  /** 적응형 폴링 최소 간격 (밀리초, 기본값: 5000) */
  minInterval?: number;
  /** 적응형 폴링 최대 간격 (밀리초, 기본값: 30000) */
  maxInterval?: number;
};

/**
 * Polling 결과
 */
export type PollingResult<T> = {
  /** 현재 데이터 */
  data: T | null;
  /** 로딩 상태 */
  isLoading: boolean;
  /** 에러 상태 */
  error: Error | null;
  /** 수동으로 새로고침 */
  refetch: () => void;
  /** 폴링 일시정지 */
  pause: () => void;
  /** 폴링 재개 */
  resume: () => void;
  /** 폴링 활성화 여부 */
  isPaused: boolean;
};

/**
 * Polling 기반 데이터 페칭 커스텀 훅
 *
 * fetchFn/compareFn 참조는 ref로 유지하여, 부모가 매 렌더마다 새 함수를 넘겨도
 * 폴링 interval useEffect가 불필요하게 재시작되지 않도록 합니다.
 *
 * @param fetchFn 데이터를 가져오는 비동기 함수
 * @param options Polling 옵션
 * @returns Polling 결과
 */
export function usePolling<T>(
  fetchFn: () => Promise<T>,
  options: PollingOptions<T> = {}
): PollingResult<T> {
  const {
    interval = 5000,
    enabled = true,
    compareFn,
    retryOnError = true,
    maxRetries = 3,
    pauseOnHidden = true,
    adaptiveInterval = false,
    minInterval = 5000,
    maxInterval = 30000,
  } = options;

  const [data, setData] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [isPaused, setIsPaused] = useState(!enabled);

  const fetchFnRef = useRef(fetchFn);
  const compareFnRef = useRef(compareFn);
  fetchFnRef.current = fetchFn;
  compareFnRef.current = compareFn;

  const isPausedRef = useRef(isPaused);
  isPausedRef.current = isPaused;

  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const isMountedRef = useRef(true);
  const lastDataRef = useRef<T | null>(null);
  const currentIntervalRef = useRef<number>(interval);
  const noChangeCountRef = useRef<number>(0);
  const retryCountRef = useRef(0);

  const fetchData = useCallback(async () => {
    if (!isMountedRef.current || isPausedRef.current) return;

    try {
      setIsLoading(true);
      setError(null);

      const result = await fetchFnRef.current();

      if (!isMountedRef.current) return;

      let dataChanged = true;
      const cmp = compareFnRef.current;
      if (cmp && lastDataRef.current !== null) {
        const isSame = cmp(lastDataRef.current, result);
        if (isSame) {
          dataChanged = false;
          setIsLoading(false);
          if (adaptiveInterval) {
            noChangeCountRef.current += 1;
            const newInterval = Math.min(currentIntervalRef.current * 1.5, maxInterval);
            currentIntervalRef.current = Math.max(newInterval, minInterval);
            if (intervalRef.current) {
              clearInterval(intervalRef.current);
              intervalRef.current = setInterval(() => {
                if (isMountedRef.current && !isPausedRef.current) {
                  void fetchData();
                }
              }, currentIntervalRef.current);
            }
          }
          return;
        }
      }

      if (dataChanged) {
        if (adaptiveInterval) {
          currentIntervalRef.current = minInterval;
          noChangeCountRef.current = 0;
          if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = setInterval(() => {
              if (isMountedRef.current && !isPausedRef.current) {
                void fetchData();
              }
            }, currentIntervalRef.current);
          }
        }
      }

      setData(result);
      lastDataRef.current = result;
      retryCountRef.current = 0;
      setIsLoading(false);
    } catch (err) {
      if (!isMountedRef.current) return;

      const caught = err instanceof Error ? err : new Error(String(err));
      setError(caught);
      setIsLoading(false);

      if (retryOnError && retryCountRef.current < maxRetries) {
        const attempt = retryCountRef.current;
        retryCountRef.current += 1;
        const delay = Math.min(1000 * Math.pow(2, attempt), 10000);
        setTimeout(() => {
          if (isMountedRef.current && !isPausedRef.current) {
            void fetchData();
          }
        }, delay);
      } else {
        retryCountRef.current = 0;
      }
    }
  }, [retryOnError, maxRetries, adaptiveInterval, minInterval, maxInterval]);

  const refetch = useCallback(() => {
    retryCountRef.current = 0;
    void fetchData();
  }, [fetchData]);

  const pause = useCallback(() => {
    setIsPaused(true);
    isPausedRef.current = true;
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const resume = useCallback(() => {
    setIsPaused(false);
    isPausedRef.current = false;
    void fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (!pauseOnHidden || typeof document === "undefined") return;

    const handleVisibilityChange = () => {
      if (document.hidden) {
        if (!isPausedRef.current) {
          setIsPaused(true);
          isPausedRef.current = true;
          if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
          }
        }
      } else {
        if (isPausedRef.current && enabled) {
          setIsPaused(false);
          isPausedRef.current = false;
          void fetchData();
          const currentInterval = adaptiveInterval ? currentIntervalRef.current : interval;
          if (currentInterval > 0) {
            intervalRef.current = setInterval(() => {
              if (isMountedRef.current && !isPausedRef.current) {
                void fetchData();
              }
            }, currentInterval);
          }
        }
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [pauseOnHidden, enabled, fetchData, adaptiveInterval, interval]);

  useEffect(() => {
    isMountedRef.current = true;
    isPausedRef.current = isPaused;
    currentIntervalRef.current = interval;

    if (enabled && !isPausedRef.current) {
      void fetchData();
    }

    if (enabled && !isPausedRef.current && interval > 0) {
      const currentInterval = adaptiveInterval ? currentIntervalRef.current : interval;
      intervalRef.current = setInterval(() => {
        if (isMountedRef.current && !isPausedRef.current) {
          void fetchData();
        }
      }, currentInterval);
    }

    return () => {
      isMountedRef.current = false;
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [enabled, interval, isPaused, fetchData, adaptiveInterval]);

  return {
    data,
    isLoading,
    error,
    refetch,
    pause,
    resume,
    isPaused,
  };
}
