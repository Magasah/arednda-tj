import type { Metadata } from "next";

import { ContentSections, LegalPageLayout } from "@/components/content/LegalPageLayout";
import { Button } from "@/components/ui/Button";
import { JsonLd, organizationJsonLd } from "@/components/seo/JsonLd";
import { content, t } from "@/lib/i18n";
import { pageMetadata } from "@/lib/metadata";

export const metadata: Metadata = pageMetadata({
  title: t("meta.aboutTitle"),
  description: t("meta.aboutDescription"),
  path: "/about",
});

export default function AboutPage() {
  const page = content().about;
  return (
    <LegalPageLayout title={page.title} path="/about" intro={page.intro}>
      <JsonLd data={organizationJsonLd()} />
      <ContentSections sections={page.sections} />
      <div className="mt-10 flex flex-col gap-3 sm:flex-row">
        <Button href="/catalog" size="md">
          {t("home.heroCatalog")}
        </Button>
        <Button href="/help#contacts" variant="outline" size="md">
          {t("footer.contacts")}
        </Button>
      </div>
    </LegalPageLayout>
  );
}
