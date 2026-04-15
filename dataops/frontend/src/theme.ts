export type Theme = 'dark' | 'light';

export const THEME_STORAGE_KEY = 'dataops-theme';

/**
 * localStorage에 저장된 테마를 읽습니다. 없거나 잘못된 값이면 dark.
 */
export function getStoredTheme(): Theme {
  if (typeof window === 'undefined') return 'dark';
  try {
    const v = localStorage.getItem(THEME_STORAGE_KEY);
    if (v === 'light' || v === 'dark') return v;
  } catch {
    /* ignore */
  }
  return 'dark';
}

