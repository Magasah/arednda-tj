import type { BookingStatus } from "@/lib/api/types";
import { messagesOf } from "@/lib/i18n";
import { cn } from "@/lib/utils";

const tone: Record<BookingStatus, string> = {
  pending: "bg-deposit-bg text-accent-text",
  payment_frozen: "bg-primary/10 text-primary",
  // Зелёный текст на светло-зелёном — 4.1:1 (< AA), поэтому сплошной зелёный с белым: 4.95:1
  active: "bg-success text-surface",
  return_pending: "bg-primary/10 text-primary",
  completed: "bg-success text-surface",
  cancelled: "bg-background text-muted-bg",
  disputed: "bg-danger/10 text-danger",
  resolved: "bg-background text-ink",
};

export function StatusBadge({ status, className }: { status: BookingStatus; className?: string }) {
  return (
    <span className={cn("inline-flex h-fit shrink-0 rounded-[8px] px-2.5 py-1 text-xs font-semibold", tone[status], className)}>
      {messagesOf().profile.bookingStatus[status]}
    </span>
  );
}
