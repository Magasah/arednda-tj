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
