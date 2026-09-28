import { PackageX } from "lucide-react";

import { Button } from "@/components/ui/Button";
import { Container } from "@/components/ui/Container";
import { EmptyState } from "@/components/ui/EmptyState";
import { t } from "@/lib/i18n";

export default function ListingNotFound() {
  return (
    <Container className="py-16">
      <EmptyState
        icon={<PackageX className="size-7" />}
        title={t("listing.notFoundTitle")}
        text={t("listing.notFoundText")}
        action={
          <Button href="/catalog" variant="primary" size="md">
            {t("errors.toCatalog")}
          </Button>
        }
      />
    </Container>
  );
}
