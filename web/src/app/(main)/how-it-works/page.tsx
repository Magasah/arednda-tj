import type { Metadata } from "next";

import { LegalPageLayout } from "@/components/content/LegalPageLayout";
import { Button } from "@/components/ui/Button";
import { content, t } from "@/lib/i18n";
import type { StepItem } from "@/lib/i18n/ru.content";
import { pageMetadata } from "@/lib/metadata";

export const metadata: Metadata = pageMetadata({
  title: t("meta.howTitle"),
  description: t("meta.howDescription"),
  path: "/how-it-works",
});

function Steps({ id, title, steps }: { id: string; title: string; steps: readonly StepItem[] }) {
  return (
    <section aria-labelledby={id}>
      <h2 id={id} className="text-xl font-bold text-ink sm:text-2xl">
        {title}
      </h2>
      <ol className="mt-4 flex flex-col gap-3">
        {steps.map((step, index) => (
          <li key={step.title} className="flex gap-4 rounded-card bg-surface p-5 shadow-card">
            <span
              aria-hidden
              className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary text-base font-bold text-surface"
            >
              {index + 1}
            </span>
            <div>
              <h3 className="text-base font-semibold text-ink">{step.title}</h3>
              <p className="mt-1 text-[15px] leading-relaxed text-muted">{step.text}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

export default function HowItWorksPage() {
  const page = content().how;
  return (
    <LegalPageLayout title={page.title} path="/how-it-works" intro={page.intro}>
      <div className="flex flex-col gap-10">
        <Steps id="renter" title={page.renterTitle} steps={page.renterSteps} />
        <Steps id="owner" title={page.ownerTitle} steps={page.ownerSteps} />
        <section aria-labelledby="money" className="rounded-card bg-primary p-6 text-surface">
          <h2 id="money" className="text-xl font-bold">
            {page.moneyTitle}
          </h2>
          <p className="mt-2 text-base leading-relaxed text-surface/90">{page.moneyText}</p>
        </section>
        <section aria-labelledby="how-cta" className="text-center">
          <h2 id="how-cta" className="text-2xl font-bold text-primary">
            {page.ctaTitle}
          </h2>
          <p className="mt-2 text-muted-bg">{page.ctaText}</p>
          <Button href="/catalog" className="mt-5">
            {t("home.heroCatalog")}
          </Button>
        </section>
      </div>
    </LegalPageLayout>
  );
}
