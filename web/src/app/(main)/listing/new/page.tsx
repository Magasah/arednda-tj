import type { Metadata } from "next";

import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { ListingWizard } from "@/components/listing-form/ListingWizard";
import { WizardSkeleton } from "@/components/listing-form/WizardSkeleton";
import { Container } from "@/components/ui/Container";
import { getCategories } from "@/lib/api/listings";
import { serverApi } from "@/lib/api/server";
import type { Category } from "@/lib/api/types";
import { t } from "@/lib/i18n";
import { pageMetadata } from "@/lib/metadata";

export const metadata: Metadata = pageMetadata({
  title: t("wizard.newTitle"),
  description: t("wizard.newTitle"),
  path: "/listing/new",
  noIndex: true,
});

// Личная страница: без статики и кэша (middleware уже проверил сессию)
export const dynamic = "force-dynamic";

export default async function NewListingPage() {
  const categories: Category[] = await getCategories(serverApi()).catch(() => []);

  return (
    <Container className="py-8 lg:py-12">
      <ProtectedRoute fallback={<WizardSkeleton />}>
        <ListingWizard mode="create" categories={categories} />
      </ProtectedRoute>
    </Container>
  );
}
