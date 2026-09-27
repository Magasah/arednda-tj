import { Icon } from "@/components/ui/Icon";
import type { KiroyaIconName } from "@/lib/kiroyaIcons";

interface SafetyFeatureProps {
  icon: KiroyaIconName;
  title: string;
  description: string;
}

export function SafetyFeature({ icon, title, description }: SafetyFeatureProps) {
  return (
    <div className="h-full rounded-card border border-surface/15 bg-surface/5 p-6">
      <span className="flex size-12 items-center justify-center rounded-full bg-primary ring-1 ring-surface/25">
        <Icon name={icon} className="text-surface" />
      </span>
      <h3 className="mt-5 text-xl font-bold text-surface">{title}</h3>
      <p className="mt-2 text-[15px] leading-relaxed text-surface/75">{description}</p>
    </div>
  );
}
