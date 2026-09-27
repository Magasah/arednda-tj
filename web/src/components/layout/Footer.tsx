import { Container } from "@/components/ui/Container";
import { Logo } from "@/components/ui/Logo";

import { FooterColumn } from "./FooterColumn";
import type { NavLink } from "./navLinks";

const columns: { title: string; links: NavLink[] }[] = [
  {
    title: "Платформа",
    links: [
      { href: "#how-it-works", label: "Как это работает" },
      { href: "#categories", label: "Категории" },
      { href: "#safety", label: "Безопасность" },
      { href: "#download", label: "Скачать приложение" },
    ],
  },
  {
    title: "Помощь",
    links: [
      { href: "/help", label: "Центр поддержки" },
      { href: "/help/disputes", label: "Споры и возвраты" },
      { href: "/help/rules", label: "Правила аренды" },
      { href: "/help/contacts", label: "Связаться с нами" },
    ],
  },
  {
    title: "Компания",
    links: [
      { href: "/about", label: "О нас" },
      { href: "/terms", label: "Пользовательское соглашение" },
      { href: "/privacy", label: "Политика конфиденциальности" },
    ],
  },
];

export function Footer() {
  return (
    <footer
      id="help"
      className="border-t border-border bg-background"
    >
      <Container className="py-12 lg:py-16">
        <div className="grid gap-10 md:grid-cols-[1.3fr_repeat(3,1fr)]">
          <div>
            <Logo />
            <p className="mt-3 text-[13px] text-muted">Арендуй. Доверяй. Зарабатывай.</p>
          </div>

          {columns.map((column) => (
            <FooterColumn key={column.title} {...column} />
          ))}
        </div>

        <p className="mt-12 border-t border-border pt-6 text-[13px] text-muted">
          © 2026 KIROYA. Душанбе, Таджикистан
        </p>
      </Container>
    </footer>
  );
}
