// Какие страницы требуют входа и куда можно возвращаться после входа

export const PROTECTED_PATHS = ["/profile", "/listing/new", "/booking"];

/** /listing/<id>/edit — редактирование своего объявления */
const PROTECTED_PATTERNS = [/^\/listing\/[^/]+\/edit\/?$/];

export function isProtectedPath(pathname: string): boolean {
  return (
    PROTECTED_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`)) ||
    PROTECTED_PATTERNS.some((pattern) => pattern.test(pathname))
  );
}

/**
 * Параметр ?next= после входа. Только внутренний путь: "/…", но не "//evil.com" и не "/\evil.com"
 * — иначе это открытый редирект на чужой сайт.
 */
export function safeNextPath(value: string | null | undefined, fallback = "/profile"): string {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) {
    return fallback;
  }
  if (value.startsWith("/login")) return fallback;
  return value;
}
