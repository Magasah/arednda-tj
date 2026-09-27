import { cn } from "@/lib/utils";

interface EmptyStateProps {
  title: string;
  text?: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
  /** role="alert" для ошибок — скринридер озвучит сразу */
  tone?: "empty" | "error";
}

export function EmptyState({ title, text, icon, action, className, tone = "empty" }: EmptyStateProps) {
  return (
    <div
      role={tone === "error" ? "alert" : undefined}
      className={cn(
        "mx-auto flex max-w-md flex-col items-center rounded-card bg-surface px-6 py-10 text-center shadow-card",
        className,
      )}
    >
      {icon && (
        <span
          aria-hidden
          className={cn(
            "mb-4 flex size-14 items-center justify-center rounded-full",
            tone === "error" ? "bg-danger/10 text-danger" : "bg-deposit-bg text-accent",
          )}
        >
          {icon}
        </span>
      )}
      <h2 className="text-xl font-bold text-ink">{title}</h2>
      {text && <p className="mt-2 text-[15px] leading-relaxed text-muted">{text}</p>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}
