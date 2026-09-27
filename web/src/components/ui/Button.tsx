import Link from "next/link";

import { cn } from "@/lib/utils";

type ButtonVariant = "accent" | "primary" | "outline" | "inverse";
type ButtonSize = "sm" | "lg";

interface ButtonProps {
  href: string;
  children: React.ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
  ariaLabel?: string;
}

const base = cn(
  "inline-flex items-center justify-center gap-2",
  "whitespace-nowrap font-semibold",
  "transition-[background-color,border-color,color,transform] active:scale-[0.98]",
);

const variants: Record<ButtonVariant, string> = {
  accent: "bg-accent text-surface hover:bg-accent/90",
  primary: "bg-primary text-surface hover:bg-primary/90",
  outline: "border-2 border-primary text-primary hover:bg-primary/5",
  inverse: "bg-surface text-primary hover:bg-surface/90",
};

const sizes: Record<ButtonSize, string> = {
  sm: "h-10 rounded-[8px] px-4 text-[15px]",
  lg: "h-[52px] rounded-[12px] px-6 text-base",
};

export function Button({
  href,
  children,
  variant = "accent",
  size = "lg",
  className,
  ariaLabel,
}: ButtonProps) {
  return (
    <Link
      href={href}
      aria-label={ariaLabel}
      className={cn(base, variants[variant], sizes[size], className)}
    >
      {children}
    </Link>
  );
}
