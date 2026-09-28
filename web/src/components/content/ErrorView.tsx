"use client";

import { ServerCrash } from "lucide-react";
import { useEffect } from "react";

import { Button } from "@/components/ui/Button";
import { Container } from "@/components/ui/Container";
import { EmptyState } from "@/components/ui/EmptyState";
import { t } from "@/lib/i18n";

interface ErrorViewProps {
  error: Error & { digest?: string };
  reset(): void;
}

export function ErrorView({ error, reset }: ErrorViewProps) {
  useEffect(() => {
    // Детали — только в консоль разработчика; пользователю — понятный текст без стека
    console.error(error);
  }, [error]);

  return (
    <Container className="py-16">
      <EmptyState
        tone="error"
        icon={<ServerCrash className="size-7" />}
        title={t("errors.pageTitle")}
        text={t("errors.pageText")}
        action={
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button variant="primary" size="md" onClick={reset}>
              {t("common.retry")}
            </Button>
            <Button href="/" variant="outline" size="md">
              {t("errors.toHome")}
            </Button>
          </div>
        }
      />
    </Container>
  );
}
