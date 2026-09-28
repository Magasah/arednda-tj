"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { Container } from "@/components/ui/Container";
import { Logo } from "@/components/ui/Logo";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";

import { MobileNav } from "./MobileNav";
import { NavAuth } from "./NavAuth";
import { navLinks } from "./navLinks";
import { PostListingButton } from "./PostListingButton";

export function isActiveLink(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function Navbar() {
  const pathname = usePathname() ?? "/";
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);

    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });

    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={cn(
        "sticky top-0 z-40",
        "border-b bg-surface transition-colors",
        scrolled ? "border-border" : "border-transparent",
      )}
    >
      <Container className="flex h-16 items-center justify-between gap-6 lg:h-[72px]">
        <Logo />

        <nav aria-label={t("nav.label")} className="hidden md:block">
          <ul className="flex items-center gap-6 lg:gap-8">
            {navLinks.map((link) => {
              const active = isActiveLink(pathname, link.href);
              return (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "inline-flex min-h-11 items-center text-[15px] font-medium transition-colors hover:text-primary",
                      active ? "text-primary" : "text-ink",
                    )}
                  >
                    {link.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="flex items-center gap-2">
          <PostListingButton className="hidden md:inline-flex" />
          <NavAuth className="hidden md:flex" />
          <MobileNav pathname={pathname} />
        </div>
      </Container>
    </header>
  );
}
