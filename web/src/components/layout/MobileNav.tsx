"use client";

import { Menu, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";

import { NavAuth } from "./NavAuth";
import { navLinks } from "./navLinks";

interface MobileNavProps {
  pathname: string;
}

export function MobileNav({ pathname }: MobileNavProps) {
  const [open, setOpen] = useState(false);

  // Переход на другую страницу закрывает меню
  useEffect(() => setOpen(false), [pathname]);

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  const close = () => setOpen(false);

  return (
    <div className="md:hidden">
      <button
        type="button"
        aria-label={open ? t("nav.closeMenu") : t("nav.openMenu")}
        aria-expanded={open}
        aria-controls="mobile-menu"
        onClick={() => setOpen((value) => !value)}
        className={cn(
          "flex size-11 items-center justify-center",
          "rounded-[12px] text-primary transition-colors hover:bg-primary/5",
        )}
      >
        {open ? <X className="size-6" aria-hidden /> : <Menu className="size-6" aria-hidden />}
      </button>

      {open && (
        <nav
          id="mobile-menu"
          aria-label={t("nav.mobileLabel")}
          className={cn(
            "absolute inset-x-0 top-full animate-[menu-in_200ms_ease-out]",
            "border-b border-border bg-surface px-4 pb-6 pt-2 shadow-card",
          )}
        >
          <ul className="flex flex-col">
            {navLinks.map((link) => {
              const active = pathname === link.href || pathname.startsWith(`${link.href}/`);
              return (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    onClick={close}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex min-h-12 items-center text-base font-medium",
                      active ? "text-primary" : "text-ink",
                    )}
                  >
                    {link.label}
                  </Link>
                </li>
              );
            })}
          </ul>
          <NavAuth block onNavigate={close} className="mt-4" />
        </nav>
      )}
    </div>
  );
}
