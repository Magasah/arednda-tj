import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { Container } from "@/components/ui/Container";
import type { ContentSection } from "@/lib/i18n/ru.content";
import { content } from "@/lib/i18n";

interface LegalPageLayoutProps {
  title: string;
  path: string;
  intro?: string;
  /** Дата редакции — для соглашений */
  updatedAt?: string;
  children: React.ReactNode;
}

/** Обёртка текстовых страниц: хлебные крошки → заголовок → контент (ширина строки для чтения) */
export function LegalPageLayout({ title, path, intro, updatedAt, children }: LegalPageLayoutProps) {
  return (
    <Container className="py-6 lg:py-10">
      <Breadcrumbs items={[{ name: title, href: path }]} />
      <article className="mx-auto mt-4 max-w-3xl">
        <header>
          <h1 className="hyphens-auto break-words text-[28px] font-bold leading-tight tracking-tight text-primary sm:text-4xl">
            {title}
          </h1>
          {updatedAt && <p className="mt-2 text-[13px] text-muted-bg">{updatedAt}</p>}
          {intro && <p className="mt-4 text-lg leading-relaxed text-ink">{intro}</p>}
        </header>
        <div className="mt-8">{children}</div>
      </article>
    </Container>
  );
}

/** Разделы с оглавлением: для соглашений и страницы «О нас» */
export function ContentSections({ sections, withToc = false }: { sections: readonly ContentSection[]; withToc?: boolean }) {
  return (
    <>
      {withToc && (
        <nav aria-label={content().contents} className="mb-8 rounded-card bg-surface p-5 shadow-card">
          <h2 className="text-base font-semibold text-ink">{content().contents}</h2>
          <ol className="mt-2 grid gap-x-6 sm:grid-cols-2">
            {sections.map((section) => (
              <li key={section.id}>
                <a
                  href={`#${section.id}`}
                  className="inline-flex min-h-11 items-center text-[15px] text-primary hover:underline"
                >
                  {section.title}
                </a>
              </li>
            ))}
          </ol>
        </nav>
      )}
      <div className="flex flex-col gap-8">
        {sections.map((section) => (
          <section key={section.id} id={section.id} aria-labelledby={`${section.id}-title`} className="scroll-mt-24">
            <h2 id={`${section.id}-title`} className="text-xl font-bold text-ink sm:text-2xl">
              {section.title}
            </h2>
            {section.paragraphs.map((paragraph) => (
              <p key={paragraph} className="mt-3 text-base leading-relaxed text-ink">
                {paragraph}
              </p>
            ))}
            {section.list && (
              <ul className="mt-3 list-disc space-y-2 pl-6 text-base leading-relaxed text-ink marker:text-accent">
                {section.list.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            )}
          </section>
        ))}
      </div>
    </>
  );
}
