import { CheckCircle2 } from "lucide-react";
import type { Metadata } from "next";

import { ContentSections, LegalPageLayout } from "@/components/content/LegalPageLayout";
import { content, t } from "@/lib/i18n";
import { pageMetadata } from "@/lib/metadata";

export const metadata: Metadata = pageMetadata({
  title: t("meta.safetyTitle"),
  description: t("meta.safetyDescription"),
  path: "/safety",
});

export default function SafetyPage() {
  const page = content().safety;
  return (
    <LegalPageLayout title={page.title} path="/safety" intro={page.intro}>
      <ContentSections sections={page.sections} />
      <section aria-labelledby="tips" className="mt-10 rounded-card bg-surface p-6 shadow-card">
        <h2 id="tips" className="text-xl font-bold text-ink">
          {page.tipsTitle}
        </h2>
        <ul className="mt-4 flex flex-col gap-3">
          {page.tips.map((tip) => (
            <li key={tip} className="flex gap-3 text-base leading-relaxed text-ink">
              <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-success" aria-hidden />
              {tip}
            </li>
          ))}
        </ul>
      </section>
    </LegalPageLayout>
  );
}
