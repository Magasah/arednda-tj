// Клиентское ограничение неверных кодов: 5 ошибок → блокировка на 5 минут.
// Настоящая защита — на backend (попытки на номер в Redis); это — быстрый отклик и меньше запросов

export const MAX_CODE_ATTEMPTS = 5;
export const LOCK_MS = 5 * 60 * 1000;
export const RESEND_SECONDS = 60;

const STORAGE_KEY = "kiroya_login_lock";

interface LockState {
  failures: number;
  lockedUntil: number | null;
}

function read(): LockState {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { failures: 0, lockedUntil: null };
    const parsed = JSON.parse(raw) as Partial<LockState>;
    return {
      failures: typeof parsed.failures === "number" ? parsed.failures : 0,
      lockedUntil: typeof parsed.lockedUntil === "number" ? parsed.lockedUntil : null,
    };
  } catch {
    return { failures: 0, lockedUntil: null };
  }
}

function write(state: LockState) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // приватный режим — блокировка живёт до перезагрузки вкладки (в state компонента)
  }
}

/** Сколько мс ещё действует блокировка (0 — не заблокировано) */
export function lockRemaining(now = Date.now()): number {
  const { lockedUntil } = read();
  if (!lockedUntil) return 0;
  if (lockedUntil <= now) {
    write({ failures: 0, lockedUntil: null });
    return 0;
  }
  return lockedUntil - now;
}

/** Засчитать неверный код. Возвращает, сколько попыток осталось (0 — блокировка включена) */
export function registerFailure(now = Date.now()): number {
  const state = read();
  const failures = state.failures + 1;
  if (failures >= MAX_CODE_ATTEMPTS) {
    write({ failures, lockedUntil: now + LOCK_MS });
    return 0;
  }
  write({ failures, lockedUntil: null });
  return MAX_CODE_ATTEMPTS - failures;
}

export function resetFailures() {
  write({ failures: 0, lockedUntil: null });
}
