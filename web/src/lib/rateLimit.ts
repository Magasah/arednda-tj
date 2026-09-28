// Клиентские лимиты — вежливое предупреждение до запроса (настоящие лимиты считает backend).
// Храним отметки времени в localStorage; без него (приватный режим) лимит просто не действует

function read(key: string): number[] {
  try {
    const raw = window.localStorage.getItem(`kiroya:rl:${key}`);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((item): item is number => typeof item === "number") : [];
  } catch {
    return [];
  }
}

function write(key: string, hits: number[]) {
  try {
    window.localStorage.setItem(`kiroya:rl:${key}`, JSON.stringify(hits));
  } catch {
    // хранилище недоступно — пропускаем
  }
}

/** Сколько мс ждать до следующей попытки (0 — можно) */
export function limitWait(key: string, max: number, windowMs: number, now = Date.now()): number {
  const hits = read(key).filter((time) => now - time < windowMs);
  if (hits.length < max) return 0;
  return windowMs - (now - Math.min(...hits));
}

export function recordHit(key: string, windowMs: number, now = Date.now()) {
  write(key, [...read(key).filter((time) => now - time < windowMs), now]);
}

/** Не больше 5 объявлений в час */
export const LISTING_LIMIT = { key: "listing-create", max: 5, windowMs: 60 * 60 * 1000 } as const;

/** Один отзыв на сделку */
export function reviewKey(bookingId: string) {
  return `review:${bookingId}`;
}
export const REVIEW_WINDOW_MS = 14 * 24 * 60 * 60 * 1000;
