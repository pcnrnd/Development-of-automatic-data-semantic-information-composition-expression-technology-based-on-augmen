/**
 * UI에 노출되는 문자열에서 `(SPC)`, `(PdM)`, `(RUL)`처럼
 * 괄호 안이 라틴 문자로만 이어진 약어 덩어리를 제거합니다.
 * `(불량)`처럼 괄호 안에 한글이 있으면 제거하지 않습니다.
 */
export function stripLatinAcronymParentheses(text: string | null | undefined): string {
  if (text == null || text === '') return '';
  return text
    .replace(/\s*\([A-Za-z][A-Za-z0-9]*(?:\/[A-Za-z][A-Za-z0-9]*)*\)/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}
