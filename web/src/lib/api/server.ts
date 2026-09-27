import "server-only";

import { API_PREFIX, serverApiUrl } from "@/lib/env";

import { createApiClient } from "./client";

/** Сервер сайта → backend (SSR, sitemap, API routes). В docker — по внутренней сети */
export function serverApi() {
  return createApiClient({ baseUrl: `${serverApiUrl()}${API_PREFIX}` });
}
