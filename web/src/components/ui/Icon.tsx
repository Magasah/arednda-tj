import { readFileSync } from "node:fs";
import path from "node:path";

import { KIROYA_ICONS_PATH, kiroyaIconNames, type KiroyaIconName } from "@/lib/kiroyaIcons";
import { cn } from "@/lib/utils";

interface IconProps {
  name: KiroyaIconName;
  size?: number;
  className?: string;
  label?: string;
}

const cache = new Map<KiroyaIconName, string>();

function readIconBody(name: KiroyaIconName) {
  const cached = cache.get(name);
  if (cached) return cached;

  if (!kiroyaIconNames.includes(name)) {
    throw new Error(`Unknown KIROYA icon: ${name}`);
  }

  const file = path.join(process.cwd(), "public", KIROYA_ICONS_PATH, `${name}.svg`);
  const source = readFileSync(file, "utf8");
  const body = source.slice(source.indexOf(">") + 1, source.lastIndexOf("</svg>")).trim();

  cache.set(name, body);
  return body;
}

export function Icon({ name, size = 24, className, label }: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      className={cn("shrink-0", className)}
      dangerouslySetInnerHTML={{ __html: readIconBody(name) }}
    />
  );
}
