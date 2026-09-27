import { cn } from "@/lib/utils";

interface PhoneFrameProps {
  children: React.ReactNode;
  label: string;
  className?: string;
}

export function PhoneFrame({ children, label, className }: PhoneFrameProps) {
  return (
    <div
      role="img"
      aria-label={label}
      className={cn(
        "relative aspect-[9/19.5] w-full",
        "rounded-[46px] bg-ink p-[10px]",
        "shadow-[0_24px_60px_rgba(0,0,0,0.18)] ring-1 ring-ink/10",
        className,
      )}
    >
      <span
        aria-hidden
        className="absolute -left-[3px] top-[22%] h-10 w-[3px] rounded-l bg-ink"
      />
      <span
        aria-hidden
        className="absolute -right-[3px] top-[28%] h-16 w-[3px] rounded-r bg-ink"
      />
      <div
        aria-hidden
        className="relative size-full overflow-hidden rounded-[36px] bg-background"
      >
        <span className="absolute left-1/2 top-2 z-10 h-[22px] w-[30%] -translate-x-1/2 rounded-full bg-ink" />
        {children}
      </div>
    </div>
  );
}
