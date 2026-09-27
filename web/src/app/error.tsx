"use client";

import { ErrorView } from "@/components/content/ErrorView";

// Ошибка вне страниц (main) — например, в самом layout группы
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset(): void }) {
  return (
    <main id="main" className="flex-1">
      <ErrorView error={error} reset={reset} />
    </main>
  );
}
