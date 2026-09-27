import { cn } from "@/lib/utils";

interface LogoMarkProps {
  inverse?: boolean;
  className?: string;
}

export function LogoMark({ inverse = false, className }: LogoMarkProps) {
  return (
    <svg
      viewBox="0 0 40 40"
      fill="none"
      aria-hidden
      className={cn("shrink-0", className)}
    >
      <circle
        cx="20"
        cy="20"
        r="12"
        className={inverse ? "fill-surface" : "fill-primary"}
      />
      <g
        strokeWidth="2.2"
        strokeLinecap="round"
        className={inverse ? "stroke-primary" : "stroke-surface"}
      >
        <circle cx="15.5" cy="20" r="3.5" />
        <path d="M19 20h8.5M24 20v3M26.8 20v2.4" />
      </g>
      <g
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="stroke-accent"
      >
        <path d="M3.26 17.05A17 17 0 0 1 33.02 9.07" />
        <path d="M28.47 8.32 33.02 9.07 33.07 4.46" />
        <path d="M36.74 22.95A17 17 0 0 1 6.98 30.93" />
        <path d="M11.53 31.68 6.98 30.93 6.93 35.54" />
      </g>
    </svg>
  );
}
