import Link from "next/link";

import type { NavLink } from "./navLinks";

interface FooterColumnProps {
  title: string;
  links: NavLink[];
}

export function FooterColumn({ title, links }: FooterColumnProps) {
  return (
    <div>
      <h2 className="text-sm font-semibold text-ink">{title}</h2>
      <ul className="mt-2 space-y-1">
        {links.map((link) => (
          <li key={link.label}>
            <Link
              href={link.href}
              className="inline-flex min-h-11 min-w-11 items-center text-[15px] md:min-h-9 text-muted-bg transition-colors hover:text-primary"
            >
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
