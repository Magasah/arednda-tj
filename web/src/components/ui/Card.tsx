import { cn } from "@/lib/utils";

interface CardProps {
  children: React.ReactNode;
  className?: string;
}

export function Card({ children, className }: CardProps) {
  return (
    <div className={cn("rounded-card bg-surface p-6 shadow-card", className)}>
      {children}
    </div>
  );
}
