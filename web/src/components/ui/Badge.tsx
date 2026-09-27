import type { KiroyaIconName } from "@/lib/kiroyaIcons";
import { cn } from "@/lib/utils";

import { Icon } from "./Icon";

interface BadgeProps {
  icon: KiroyaIconName;
  label: string;
  className?: string;
}

export function Badge({ icon, label, className }: BadgeProps) {
  return (
    <div
      className={cn(
        "flex items-center gap-3",
        "rounded-[12px] px-4 py-3",
        "bg-surface shadow-card",
        className,
      )}
    >
      <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10">
        <Icon name={icon} size={20} className="text-primary" />
      </span>
      <span className="text-[15px] font-semibold text-ink">{label}</span>
    </div>
  );
}
