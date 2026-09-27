import { cn } from "@/lib/utils";

interface TajikPatternProps {
  id: string;
  className?: string;
}

export function TajikPattern({ id, className }: TajikPatternProps) {
  return (
    <svg
      aria-hidden
      className={cn("pointer-events-none absolute inset-0 size-full", className)}
    >
      <defs>
        <pattern
          id={id}
          width="64"
          height="64"
          patternUnits="userSpaceOnUse"
        >
          <g
            fill="none"
            stroke="currentColor"
            strokeWidth="1.2"
          >
            <path d="M20 20h24v24H20z" />
            <path d="M32 15 49 32 32 49 15 32z" />
            <circle cx="32" cy="32" r="5" />
            <path d="M32 0v15M32 49v15M0 32h15M49 32h15" />
            <path d="M0 8 8 0M56 0l8 8M64 56l-8 8M8 64 0 56" />
          </g>
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${id})`} />
    </svg>
  );
}
