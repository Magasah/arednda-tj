import Link from "next/link";

import { cn } from "@/lib/utils";

import { LogoMark } from "./LogoMark";

interface LogoProps {
  inverse?: boolean;
  className?: string;
}

export function Logo({ inverse = false, className }: LogoProps) {
  return (
    <Link
      href="/"
      aria-label="KIROYA — на главную"
      className={cn("inline-flex items-center gap-2", className)}
    >
      <LogoMark inverse={inverse} className="size-9 sm:size-10" />
      <span
        className={cn(
          "text-2xl font-extrabold leading-none tracking-tight sm:text-[28px]",
          inverse ? "text-surface" : "text-primary",
        )}
      >
        KIRO
        <span className="relative">
          Y
          <span className="absolute -bottom-1 left-1/2 size-[5px] -translate-x-1/2 rounded-full bg-accent" />
        </span>
        A
      </span>
    </Link>
  );
}
