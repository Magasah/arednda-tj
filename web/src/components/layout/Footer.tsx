import { Container } from "@/components/ui/Container";
import { Logo } from "@/components/ui/Logo";
import { t } from "@/lib/i18n";

import { FooterColumn } from "./FooterColumn";
import type { NavLink } from "./navLinks";

const columns: { title: string; links: NavLink[] }[] = [
  {
    title: t("footer.platform"),
    links: [
      { href: "/catalog", label: t("nav.catalog") },
      { href: "/how-it-works", label: t("nav.howItWorks") },
      { href: "/safety", label: t("nav.safety") },
      { href: "/#download", label: t("nav.download") },
    ],
  },
  {
    title: t("footer.helpTitle"),
    links: [
      { href: "/help", label: t("footer.helpCenter") },
      { href: "/help#disputes", label: t("footer.disputes") },
      { href: "/help#rules", label: t("footer.rules") },
      { href: "/help#contacts", label: t("footer.contacts") },
    ],
  },
  {
    title: t("footer.company"),
    links: [
      { href: "/about", label: t("footer.about") },
      { href: "/terms", label: t("footer.terms") },
      { href: "/privacy", label: t("footer.privacy") },
    ],
  },
];

export function Footer() {
  return (
    <footer className="border-t border-border bg-background">
      <Container className="py-12 lg:py-16">
        <div className="grid gap-10 md:grid-cols-[1.3fr_repeat(3,1fr)]">
          <div>
            <Logo />
            <p className="mt-3 text-[13px] text-muted-bg">{t("common.tagline")}</p>
          </div>

          {columns.map((column) => (
            <FooterColumn key={column.title} {...column} />
          ))}
        </div>

        <p className="mt-12 border-t border-border pt-6 text-[13px] text-muted-bg">
          {t("footer.copyright", { year: new Date().getFullYear() })}
        </p>
      </Container>
    </footer>
  );
}
