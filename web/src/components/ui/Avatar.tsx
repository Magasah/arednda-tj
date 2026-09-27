import Image from "next/image";

import { mediaUrl } from "@/lib/media";
import { cn } from "@/lib/utils";

interface AvatarProps {
  src?: string | null;
  name?: string | null;
  size?: number;
  className?: string;
  /** Декоративный аватар рядом с именем — alt пустой, чтобы не читать имя дважды */
  decorative?: boolean;
}

function initials(name?: string | null): string {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "K";
  return parts
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join("");
}

export function Avatar({ src, name, size = 40, className, decorative = true }: AvatarProps) {
  const url = mediaUrl(src);
  const style = { width: size, height: size };

  if (url) {
    return (
      <Image
        src={url}
        alt={decorative ? "" : (name ?? "")}
        width={size}
        height={size}
        sizes={`${size}px`}
        className={cn("shrink-0 rounded-full bg-border object-cover", className)}
        style={style}
      />
    );
  }

  return (
    <span
      role={decorative ? undefined : "img"}
      aria-label={decorative ? undefined : (name ?? undefined)}
      aria-hidden={decorative || undefined}
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full bg-primary font-bold text-surface",
        className,
      )}
      style={{ ...style, fontSize: Math.max(12, Math.round(size * 0.38)) }}
    >
      {initials(name)}
    </span>
  );
}
