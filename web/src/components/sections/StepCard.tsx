import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import type { KiroyaIconName } from "@/lib/kiroyaIcons";

interface StepCardProps {
  step: number;
  icon: KiroyaIconName;
  title: string;
  description: string;
}

export function StepCard({ step, icon, title, description }: StepCardProps) {
  return (
    <Card className="h-full">
      <div className="flex items-center justify-between">
        <span className="flex size-12 items-center justify-center rounded-full bg-primary">
          <Icon name={icon} className="text-surface" />
        </span>
        <span className="text-sm font-semibold text-muted">Шаг {step}</span>
      </div>
      <h3 className="mt-5 text-xl font-bold text-ink">{title}</h3>
      <p className="mt-2 text-[15px] leading-relaxed text-muted">{description}</p>
    </Card>
  );
}
