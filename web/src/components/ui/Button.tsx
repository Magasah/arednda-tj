import Link from "next/link";
import { forwardRef } from "react";

import { cn } from "@/lib/utils";

type ButtonVariant = "accent" | "primary" | "outline" | "inverse" | "ghost" | "danger";
type ButtonSize = "sm" | "md" | "lg";

interface CommonProps {
  children: React.ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
  ariaLabel?: string;
}

interface LinkButtonProps extends CommonProps {
  href: string;
  prefetch?: boolean;
}

type NativeButtonProps = CommonProps &
  Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "className" | "children"> & {
    href?: undefined;
    loading?: boolean;
  };

export type ButtonProps = LinkButtonProps | NativeButtonProps;

const base = cn(
  "inline-flex items-center justify-center gap-2",
  "whitespace-nowrap font-semibold",
  "transition-[background-color,border-color,color,transform] active:scale-[0.98]",
  "disabled:cursor-not-allowed disabled:opacity-50 disabled:active:scale-100",
);

const variants: Record<ButtonVariant, string> = {
  accent: "bg-accent-btn text-surface hover:bg-accent-btn-hover",
  primary: "bg-primary text-surface hover:bg-primary/90",
  outline: "border-2 border-primary text-primary hover:bg-primary/5",
  inverse: "bg-surface text-primary hover:bg-surface/90",
  ghost: "text-primary hover:bg-primary/5",
  danger: "bg-danger text-surface hover:bg-danger/90",
};

// sm — навбар; md — формы (DS: primary 14px радиус, 16px 600); lg — hero и CTA
const sizes: Record<ButtonSize, string> = {
  sm: "h-11 rounded-[8px] px-4 text-[15px]",
  md: "h-12 rounded-[14px] px-5 text-base",
  lg: "h-[52px] rounded-[12px] px-6 text-base",
};

export function buttonClasses(variant: ButtonVariant = "accent", size: ButtonSize = "lg", className?: string) {
  return cn(base, variants[variant], sizes[size], className);
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(props, ref) {
  if (props.href !== undefined) {
    const { href, prefetch, children, variant = "accent", size = "lg", className, ariaLabel } = props;
    return (
      <Link
        href={href}
        prefetch={prefetch}
        aria-label={ariaLabel}
        className={buttonClasses(variant, size, className)}
      >
        {children}
      </Link>
    );
  }

  const {
    children,
    variant = "accent",
    size = "lg",
    className,
    ariaLabel,
    loading = false,
    type = "button",
    disabled,
    ...rest
  } = props;

  return (
    <button
      ref={ref}
      type={type}
      aria-label={ariaLabel}
      aria-busy={loading || undefined}
      disabled={disabled || loading}
      className={buttonClasses(variant, size, className)}
      {...rest}
    >
      {loading && (
        <span
          aria-hidden
          className="size-4 animate-spin rounded-full border-2 border-current border-r-transparent"
        />
      )}
      {children}
    </button>
  );
});
