import { ChevronDown, Mail, Send } from "lucide-react";
import type { Metadata } from "next";

import { LegalPageLayout } from "@/components/content/LegalPageLayout";
import { JsonLd } from "@/components/seo/JsonLd";
import { content, t } from "@/lib/i18n";
import { pageMetadata } from "@/lib/metadata";

export const metadata: Metadata = pageMetadata({
  title: t("meta.helpTitle"),
  description: t("meta.helpDescription"),
  path: "/help",
});

export default function HelpPage() {
  const page = content().help;
  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: page.groups.flatMap((group) =>
      group.items.map((item) => ({
        "@type": "Question",
        name: item.q,
        acceptedAnswer: { "@type": "Answer", text: item.a },
      })),
    ),
  };

  return (
    <LegalPageLayout title={page.title} path="/help" intro={page.intro}>
      <JsonLd data={faqJsonLd} />
      <nav aria-label={content().contents} className="mb-8 flex flex-wrap gap-2">
        {page.groups.map((group) => (
          <a
            key={group.id}
            href={`#${group.id}`}
            className="inline-flex min-h-11 items-center rounded-chip border border-border bg-surface px-4 text-sm font-medium text-ink hover:border-primary"
          >
            {group.title}
          </a>
        ))}
      </nav>

      <div className="flex flex-col gap-10">
        {page.groups.map((group) => (
          <section key={group.id} id={group.id} aria-labelledby={`${group.id}-title`} className="scroll-mt-24">
            <h2 id={`${group.id}-title`} className="text-xl font-bold text-ink sm:text-2xl">
              {group.title}
            </h2>
            <div className="mt-4 flex flex-col gap-3">
              {group.items.map((item) => (
                // <details> — нативный аккордеон: клавиатура и скринридеры без JS
                <details key={item.q} className="group rounded-card bg-surface shadow-card">
                  <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-4 p-4 text-base font-semibold text-ink [&::-webkit-details-marker]:hidden">
                    {item.q}
                    <ChevronDown
                      className="size-5 shrink-0 text-primary transition-transform group-open:rotate-180"
                      aria-hidden
                    />
                  </summary>
                  <p className="px-4 pb-4 text-[15px] leading-relaxed text-muted">{item.a}</p>
                </details>
              ))}
            </div>
          </section>
        ))}

        <section
          id={page.contactsId}
          aria-labelledby="contacts-title"
          className="scroll-mt-24 rounded-card bg-primary p-6 text-surface"
        >
          <h2 id="contacts-title" className="text-xl font-bold">
            {page.contactsTitle}
          </h2>
          <p className="mt-2 text-surface/90">{page.contactsText}</p>
          <ul className="mt-4 flex flex-col gap-2 sm:flex-row sm:gap-6">
            <li>
              <a href={`mailto:${page.email}`} className="inline-flex min-h-11 items-center gap-2 font-semibold underline-offset-4 hover:underline">
                <Mail className="size-5" aria-hidden />
                <span className="sr-only">{page.emailLabel}: </span>
                {page.email}
              </a>
            </li>
            <li>
              <a
                href={page.telegramUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-11 items-center gap-2 font-semibold underline-offset-4 hover:underline"
              >
                <Send className="size-5" aria-hidden />
                <span className="sr-only">{page.telegramLabel}: </span>
                {page.telegram}
              </a>
            </li>
          </ul>
        </section>
      </div>
    </LegalPageLayout>
  );
}
