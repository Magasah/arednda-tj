import type { Metadata } from "next";

import { ContentSections, LegalPageLayout } from "@/components/content/LegalPageLayout";
import { content, t } from "@/lib/i18n";
import { pageMetadata } from "@/lib/metadata";

export const metadata: Metadata = pageMetadata({
  title: t("meta.privacyTitle"),
  description: t("meta.privacyDescription"),
  path: "/privacy",
});

export default function PrivacyPage() {
  const page = content().privacy;
  return (
    <LegalPageLayout title={page.title} path="/privacy" intro={page.intro} updatedAt={content().updatedAt}>
      <ContentSections sections={page.sections} withToc />
    </LegalPageLayout>
  );
}
