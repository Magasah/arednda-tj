import { NextResponse, type NextRequest } from "next/server";

import { ACCESS_COOKIE, SESSION_FLAG_COOKIE } from "@/lib/auth/constants";
import { isProtectedPath } from "@/lib/auth/routes";

// Защищённые страницы: без сессии → /login?next=<куда шли>.
// Подпись токена здесь не проверяется — это делает backend при каждом запросе;
// middleware только не пускает на страницу тех, у кого сессии заведомо нет

export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  if (!isProtectedPath(pathname)) return NextResponse.next();

  const hasSession =
    request.cookies.has(ACCESS_COOKIE) || request.cookies.get(SESSION_FLAG_COOKIE)?.value === "1";
  if (hasSession) return NextResponse.next();

  const loginUrl = request.nextUrl.clone();
  loginUrl.pathname = "/login";
  loginUrl.search = "";
  loginUrl.searchParams.set("next", `${pathname}${search}`);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/profile/:path*"],
};
