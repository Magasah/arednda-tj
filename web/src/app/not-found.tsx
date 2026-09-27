import { Compass } from "lucide-react";
import type { Metadata } from "next";

import { PageLayout } from "@/components/layout/PageLayout";
import { Button } from "@/components/ui/Button";
import { Container } from "@/components/ui/Container";
import { EmptyState } from "@/components/ui/EmptyState";
import { t } from "@/lib/i18n";

export const metadata: Metadata = {
  title: t("errors.notFoundTitle"),
  robots: { index: false },
};

export default function NotFound() {
  return (
    <PageLayout>
      <Container className="py-16">
        <EmptyState
          icon={<Compass className="size-7" />}
          title={t("errors.notFoundTitle")}
          text={t("errors.notFoundText")}
          action={
            <div className="flex flex-col gap-3 sm:flex-row">
              <Button href="/" variant="primary" size="md">
                {t("errors.toHome")}
              </Button>
              <Button href="/catalog" variant="outline" size="md">
                {t("errors.toCatalog")}
              </Button>
            </div>
          }
        />
      </Container>
    </PageLayout>
  );
}
