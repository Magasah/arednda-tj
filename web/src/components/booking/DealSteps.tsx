import { Check } from "lucide-react";

import type { BookingStatus } from "@/lib/api/types";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";

import { dealSteps } from "./logic";

/** ✓ Оплата — ● Передача — ○ Возврат */
export function DealSteps({ status }: { status: BookingStatus }) {
  const states = dealSteps(status);
  const labels = [t("deal.stepPayment"), t("deal.stepHandover"), t("deal.stepReturn")];
  const stateText = { done: t("deal.stepDone"), current: t("deal.stepCurrent"), todo: t("deal.stepTodo") };

  return (
    <ol aria-label={t("deal.steps")} className="flex items-start">
      {labels.map((label, index) => {
        const state = states[index];
        return (
          <li
            key={label}
            aria-current={state === "current" ? "step" : undefined}
            className={cn("flex flex-1 flex-col items-center gap-2 text-center", index < 2 && "relative")}
          >
            {index < 2 && (
              <span
                aria-hidden
                className={cn(
                  "absolute left-[calc(50%+22px)] right-[calc(-50%+22px)] top-[17px] h-0.5 rounded-full",
                  states[index + 1] !== "todo" ? "bg-primary" : "bg-border",
                )}
              />
            )}
            <span
              aria-hidden
              className={cn(
                "flex size-9 items-center justify-center rounded-full text-sm font-bold",
                state === "done" && "bg-primary text-surface",
                state === "current" && "bg-accent-btn text-surface ring-4 ring-accent/25",
                state === "todo" && "border-2 border-border bg-surface text-muted",
              )}
            >
              {state === "done" ? (
                <Check className="size-4" strokeWidth={3} />
              ) : state === "current" ? (
                <span className="size-2.5 rounded-full bg-surface" />
              ) : (
                <span className="size-2.5 rounded-full border-2 border-muted" />
              )}
            </span>
            <span className={cn("text-sm font-semibold", state === "todo" ? "text-muted" : "text-ink")}>
              {label}
              <span className="sr-only">: {stateText[state]}</span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}
