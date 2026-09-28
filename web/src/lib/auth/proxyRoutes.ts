// Белый список BFF-прокси (/api/proxy/*): какие изменяющие запросы браузер может отправить в backend.
// Всё, чего здесь нет, — 404: через прокси нельзя дотянуться до служебных эндпоинтов (бот, админка)

type ProxyMethod = "POST" | "PATCH" | "DELETE";

export interface ProxyRule {
  method: ProxyMethod;
  pattern: RegExp;
  body: "json" | "multipart" | "none";
}

const ID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";

/** 8 фото по 10 МБ + поля формы */
export const PROXY_MAX_BYTES = 8 * 10 * 1024 * 1024 + 256 * 1024;

export const PROXY_ROUTES: ProxyRule[] = [
  { method: "POST", pattern: /^listings$/, body: "multipart" },
  { method: "PATCH", pattern: new RegExp(`^listings/${ID}$`), body: "json" },
  { method: "DELETE", pattern: new RegExp(`^listings/${ID}$`), body: "none" },
  { method: "POST", pattern: new RegExp(`^listings/${ID}/photos$`), body: "multipart" },
  { method: "DELETE", pattern: new RegExp(`^listings/${ID}/photos/[0-7]$`), body: "none" },
  { method: "POST", pattern: /^bookings$/, body: "json" },
  { method: "POST", pattern: new RegExp(`^bookings/${ID}/cancel$`), body: "none" },
  { method: "POST", pattern: new RegExp(`^bookings/${ID}/confirm-payment$`), body: "json" },
  { method: "POST", pattern: new RegExp(`^bookings/${ID}/(handover|return)$`), body: "multipart" },
  { method: "POST", pattern: new RegExp(`^bookings/${ID}/confirm-return$`), body: "json" },
  { method: "POST", pattern: /^reviews$/, body: "json" },
  { method: "POST", pattern: /^users\/me\/verify$/, body: "multipart" },
];

export function matchProxyRoute(method: string, path: string): ProxyRule | null {
  return PROXY_ROUTES.find((rule) => rule.method === method && rule.pattern.test(path)) ?? null;
}
