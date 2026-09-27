"use client";

import { ErrorView } from "@/components/content/ErrorView";

// Ошибка страницы: навбар и футер остаются, падает только содержимое
export default function PageError({ error, reset }: { error: Error & { digest?: string }; reset(): void }) {
  return <ErrorView error={error} reset={reset} />;
}
