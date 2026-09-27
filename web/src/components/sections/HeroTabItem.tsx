import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

interface HeroTabItemProps {
  icon: LucideIcon;
  label: string;
  active: boolean;
}

export function HeroTabItem({ icon: Icon, label, active }: HeroTabItemProps) {
  return (
    <span
      className={cn(
        "flex flex-col items-center gap-0.5 text-[6px]",
        active ? "font-semibold text-primary" : "text-muted",
      )}
    >
      <Icon className="size-3.5" />
      {label}
    </span>
  );
}
