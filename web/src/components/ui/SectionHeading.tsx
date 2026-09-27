import { cn } from "@/lib/utils";

interface SectionHeadingProps {
  id: string;
  title: string;
  description?: string;
  inverse?: boolean;
  className?: string;
}

export function SectionHeading({
  id,
  title,
  description,
  inverse = false,
  className,
}: SectionHeadingProps) {
  return (
    <div className={cn("mx-auto max-w-2xl text-center", className)}>
      <h2
        id={id}
        className={cn(
          "text-[28px] font-bold leading-tight tracking-tight sm:text-4xl",
          inverse ? "text-surface" : "text-primary",
        )}
      >
        {title}
      </h2>
      {description && (
        <p
          className={cn(
            "mt-3 text-base leading-relaxed sm:text-lg",
            inverse ? "text-surface/75" : "text-muted-bg",
          )}
        >
          {description}
        </p>
      )}
    </div>
  );
}
