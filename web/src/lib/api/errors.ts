import { t } from "@/lib/i18n";

export type ApiErrorCode =
  | "network"
  | "unauthorized"
  | "forbidden"
  | "not_found"
  | "validation"
  | "rate_limited"
  | "conflict"
  | "server"
  | "unknown";

/** Единый формат ошибки для UI: { message, code, fields } */
export class ApiError extends Error {
  readonly code: ApiErrorCode;
  readonly status: number;
  readonly fields: Record<string, string>;

  constructor(message: string, code: ApiErrorCode, status = 0, fields: Record<string, string> = {}) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.status = status;
    this.fields = fields;
  }
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

function codeFromStatus(status: number): ApiErrorCode {
  if (status === 401) return "unauthorized";
  if (status === 403) return "forbidden";
  if (status === 404) return "not_found";
  if (status === 409) return "conflict";
  if (status === 422 || status === 400) return "validation";
  if (status === 429) return "rate_limited";
  if (status >= 500) return "server";
  return "unknown";
}

const defaultMessages: Record<ApiErrorCode, string> = {
  network: t("errors.network"),
  unauthorized: t("errors.unauthorized"),
  forbidden: t("errors.forbidden"),
  not_found: t("errors.notFound"),
  validation: t("errors.validation"),
  rate_limited: t("errors.rateLimited"),
  conflict: t("errors.generic"),
  server: t("errors.server"),
  unknown: t("errors.generic"),
};

interface ValidationItem {
  loc?: (string | number)[];
  msg?: string;
}

/**
 * Ответ backend → ApiError. Форматы FastAPI:
 * { detail: "текст" } | { detail: [{ loc, msg }] } (422) | { error: "…" } (slowapi, 429)
 */
export function errorFromBody(status: number, body: unknown): ApiError {
  const code = codeFromStatus(status);
  const fields: Record<string, string> = {};
  let message: string | undefined;

  if (body && typeof body === "object") {
    const { detail, error, message: bffMessage } = body as {
      detail?: unknown;
      error?: unknown;
      message?: unknown;
    };
    if (typeof detail === "string") message = detail;
    if (Array.isArray(detail)) {
      for (const item of detail as ValidationItem[]) {
        const field = item.loc?.filter((part) => part !== "body" && part !== "query").join(".");
        if (field && item.msg && !(field in fields)) fields[field] = item.msg;
      }
      message = (detail as ValidationItem[])[0]?.msg;
    }
    if (!message && typeof bffMessage === "string") message = bffMessage;
    if (!message && typeof error === "string" && code !== "rate_limited") message = error;
  }

  // 429 и 5xx — всегда понятный текст, а не внутренняя формулировка сервера
  if (code === "rate_limited" || code === "server" || !message) message = defaultMessages[code];
  return new ApiError(message, code, status, fields);
}

export async function errorFromResponse(response: Response): Promise<ApiError> {
  let body: unknown = null;
  try {
    body = await response.json();
  } catch {
    body = null;
  }
  return errorFromBody(response.status, body);
}

export function networkError(): ApiError {
  return new ApiError(defaultMessages.network, "network");
}

/** Любая ошибка → текст для пользователя */
export function errorMessage(error: unknown): string {
  return isApiError(error) ? error.message : t("errors.generic");
}
