import { CSRF_HEADER, CSRF_VALUE } from "@/lib/api/client";

/**
 * CSRF-защита API routes (в дополнение к SameSite=Strict у cookie):
 * 1. заголовок X-Requested-With: kiroya — чужой сайт не выставит его без разрешения CORS;
 * 2. Origin (если браузер его прислал) совпадает с нашим хостом;
 * 3. Sec-Fetch-Site, если есть, — same-origin.
 */
export function isSameOriginRequest(request: Request): boolean {
  if (request.headers.get(CSRF_HEADER) !== CSRF_VALUE) return false;

  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite && fetchSite !== "same-origin" && fetchSite !== "none") return false;

  const origin = request.headers.get("origin");
  if (!origin) return request.method === "GET" || request.method === "HEAD";

  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}
