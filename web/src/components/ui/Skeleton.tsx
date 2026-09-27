import { cn } from "@/lib/utils";

interface SkeletonProps {
  className?: string;
}

/** Плашка-заглушка на время загрузки. Пульсация отключается при prefers-reduced-motion */
export function Skeleton({ className }: SkeletonProps) {
  return (
    <span
      aria-hidden
      className={cn("block animate-pulse rounded-[8px] bg-border motion-reduce:animate-none", className)}
    />
  );
}
