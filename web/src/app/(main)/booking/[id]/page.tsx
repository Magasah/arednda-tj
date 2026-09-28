import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { BookingSkeleton, BookingView } from "@/components/booking/BookingView";
import { Container } from "@/components/ui/Container";
import { t } from "@/lib/i18n";
import { pageMetadata } from "@/lib/metadata";

interface BookingPageProps {
  params: { id: string };
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const metadata: Metadata = pageMetadata({
  title: t("deal.metaTitle"),
  description: t("deal.metaTitle"),
  path: "/booking",
  noIndex: true,
});

// Личные данные сделки: без статики и кэша, данные грузятся с токеном участника
export const dynamic = "force-dynamic";

export default function BookingPage({ params }: BookingPageProps) {
  if (!UUID_RE.test(params.id)) notFound();
  return (
    <Container className="py-8 lg:py-12">
      <ProtectedRoute fallback={<BookingSkeleton />}>
        <BookingView id={params.id} />
      </ProtectedRoute>
    </Container>
  );
}
