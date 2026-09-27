import { t } from "@/lib/i18n";

export interface NavLink {
  href: string;
  label: string;
}

export const navLinks: NavLink[] = [
  { href: "/catalog", label: t("nav.catalog") },
  { href: "/how-it-works", label: t("nav.howItWorks") },
  { href: "/safety", label: t("nav.safety") },
  { href: "/help", label: t("nav.help") },
];
