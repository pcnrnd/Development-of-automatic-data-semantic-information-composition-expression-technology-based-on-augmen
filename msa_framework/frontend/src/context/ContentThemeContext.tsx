"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type ContentThemeMode = "dark" | "light";

const STORAGE_KEY = "msa-main-content-theme";

type ContentThemeContextValue = {
  mode: ContentThemeMode;
  /** 라이트 모드 여부 (메인 영역만; 사이드바는 항상 다크 유지) */
  isLight: boolean;
  setMode: (mode: ContentThemeMode) => void;
  toggleMode: () => void;
};

const ContentThemeContext = createContext<ContentThemeContextValue | null>(null);

function readStoredMode(): ContentThemeMode {
  if (typeof window === "undefined") return "dark";
  try {
    const v = window.localStorage.getItem(STORAGE_KEY);
    return v === "light" ? "light" : "dark";
  } catch {
    return "dark";
  }
}

/**
 * 메인 콘텐츠 영역(헤더·본문)의 다크/라이트 테마를 제공합니다.
 * 사이드바는 이 컨텍스트와 무관하게 항상 다크 스타일을 유지합니다.
 */
export function ContentThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<ContentThemeMode>("dark");
  const [hydrated, setHydrated] = useState(false);

  // SSR은 항상 dark로 맞추고, 클라이언트 마운트 후에만 localStorage 값을 반영합니다.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- hydration 후 저장된 테마 복원
    setModeState(readStoredMode());
    setHydrated(true);
  }, []);

  const setMode = useCallback((next: ContentThemeMode) => {
    setModeState(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* ignore */
    }
  }, []);

  const toggleMode = useCallback(() => {
    setModeState((prev) => {
      const next: ContentThemeMode = prev === "dark" ? "light" : "dark";
      try {
        window.localStorage.setItem(STORAGE_KEY, next);
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  const value = useMemo<ContentThemeContextValue>(
    () => ({
      mode: hydrated ? mode : "dark",
      isLight: hydrated && mode === "light",
      setMode,
      toggleMode,
    }),
    [hydrated, mode, setMode, toggleMode]
  );

  return (
    <ContentThemeContext.Provider value={value}>{children}</ContentThemeContext.Provider>
  );
}

export function useContentTheme(): ContentThemeContextValue {
  const ctx = useContext(ContentThemeContext);
  if (!ctx) {
    throw new Error("useContentTheme must be used within ContentThemeProvider");
  }
  return ctx;
}
