import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { EditGuard } from "@/components/listing-form/EditGuard";
import { ListingWizard } from "@/components/listing-form/ListingWizard";
import { WizardSkeleton } from "@/components/listing-form/WizardSkeleton";
import { Container } from "@/components/ui/Container";
import { isApiError } from "@/lib/api/errors";
import { getCategories } from "@/lib/api/listings";
import { serverApi } from "@/lib/api/server";
import type { Category, ListingDetail } from "@/lib/api/types";
import { t } from "@/lib/i18n";
import { pageMetadata } from "@/lib/metadata";

interface EditPageProps {
  params: { id: string };
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const metadata: Metadata = pageMetadata({
  title: t("wizard.editTitle"),
  description: t("wizard.editTitle"),
  path: "/listing",
  noIndex: true,
});

export const dynamic = "force-dynamic";

export default async function EditListingPage({ params }: EditPageProps) {
  if (!UUID_RE.test(params.id)) notFound();
  const api = serverApi();
  let listing: ListingDetail;
  try {
    // Свежие данные без кэша: редактируем то, что сейчас в базе
    listing = await api.request<ListingDetail>(`/listings/${params.id}`, { cache: "no-store" });
  } catch (error) {
    if (isApiError(error) && error.code === "not_found") notFound();
    throw error;
  }
  const categories: Category[] = await getCategories(api).catch(() => []);

  return (
    <Container className="py-8 lg:py-12">
      <ProtectedRoute fallback={<WizardSkeleton />}>
        {/* Кнопки видны только владельцу; backend всё равно проверит права на каждом запросе */}
        <EditGuard ownerId={listing.owner_id}>
          <ListingWizard mode="edit" categories={categories} listing={listing} />
        </EditGuard>
      </ProtectedRoute>
    </Container>
  );
}
