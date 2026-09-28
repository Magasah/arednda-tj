import { Icon } from "@/components/ui/Icon";
import { cn } from "@/lib/utils";

interface HeroEscrowCardProps {
  className?: string;
}

export function HeroEscrowCard({ className }: HeroEscrowCardProps) {
  return (
    <div
      className={cn(
        "flex items-center gap-3",
        "rounded-card bg-surface p-3 pr-5 shadow-card",
        className,
      )}
    >
      <span className="flex size-10 items-center justify-center rounded-full bg-success/10">
        <Icon name="kiroya-shield-check" size={20} className="text-success" />
      </span>
      <div>
        <p className="text-sm font-bold text-ink">Деньги заморожены</p>
        <p className="text-[13px] text-muted">
          Депозит: <span className="font-semibold text-accent-text">1500 сом</span>
        </p>
      </div>
    </div>
  );
}
