import type { Metadata } from "next";

import { ContentSections, LegalPageLayout } from "@/components/content/LegalPageLayout";
import { content, t } from "@/lib/i18n";
import { pageMetadata } from "@/lib/metadata";

export const metadata: Metadata = pageMetadata({
  title: t("meta.termsTitle"),
  description: t("meta.termsDescription"),
  path: "/terms",
});

export default function TermsPage() {
  const page = content().terms;
  return (
    <LegalPageLayout title={page.title} path="/terms" intro={page.intro} updatedAt={content().updatedAt}>
      <ContentSections sections={page.sections} withToc />
    </LegalPageLayout>
  );
}
