// Имена cookie сессии. Используются в middleware (edge) и в API routes (node)

/** Access JWT (~15 мин). httpOnly: скрипты страницы его не видят */
export const ACCESS_COOKIE = "kiroya_at";
/** Refresh JWT (30 дней). httpOnly и только для /api/* (BFF) — на страницы не уходит */
export const REFRESH_COOKIE = "kiroya_rt";
/** Метка «есть сессия» для middleware: refresh-cookie на других путях не видна */
export const SESSION_FLAG_COOKIE = "kiroya_session";

export const REFRESH_COOKIE_PATH = "/api";
export const REFRESH_MAX_AGE = 30 * 24 * 60 * 60;
export const ACCESS_FALLBACK_MAX_AGE = 15 * 60;

/**
 * CSRF double-submit токен. Ставят API routes (GET /api/auth/session и /api/auth/csrf).
 * Не httpOnly: JS страницы читает его и повторяет в заголовке X-CSRF-Token.
 * Чужой сайт не может ни прочитать cookie, ни выставить заголовок — запрос отклоняется
 */
export const CSRF_COOKIE = "kiroya_csrf";
export const CSRF_TOKEN_HEADER = "x-csrf-token";
