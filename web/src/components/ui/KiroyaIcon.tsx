import { KIROYA_ICONS_PATH, type KiroyaIconName } from "@/lib/kiroyaIcons";
import { cn } from "@/lib/utils";

interface KiroyaIconProps {
  name: KiroyaIconName;
  size?: number;
  className?: string;
  label?: string;
}

export function KiroyaIcon({ name, size = 24, className, label }: KiroyaIconProps) {
  const url = `url(${KIROYA_ICONS_PATH}/${name}.svg)`;

  return (
    <span
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      className={cn("inline-block shrink-0 bg-current", className)}
      style={{
        width: size,
        height: size,
        maskImage: url,
        WebkitMaskImage: url,
        maskSize: "contain",
        WebkitMaskSize: "contain",
        maskRepeat: "no-repeat",
        WebkitMaskRepeat: "no-repeat",
      }}
    />
  );
}
