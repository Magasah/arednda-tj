import Link from "next/link";

import { Icon } from "@/components/ui/Icon";
import type { KiroyaIconName } from "@/lib/kiroyaIcons";
import { cn } from "@/lib/utils";

interface CategoryCardProps {
  icon: KiroyaIconName;
  label: string;
  hint: string;
  href: string;
}

export function CategoryCard({ icon, label, hint, href }: CategoryCardProps) {
  return (
    <Link
      href={href}
      className={cn(
        "flex h-full flex-col items-center gap-3",
        "rounded-card border border-transparent px-4 py-6 text-center",
        "bg-surface shadow-card",
        "transition-[border-color,transform] hover:scale-[1.02] hover:border-primary",
      )}
    >
      <span className="flex size-14 items-center justify-center rounded-full bg-deposit-bg">
        <Icon name={icon} size={28} className="text-accent" />
      </span>
      <span className="text-[15px] font-semibold text-ink">{label}</span>
      <span className="text-[13px] text-muted">{hint}</span>
    </Link>
  );
}
