"use client";

import { MoreHorizontal } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";

import { cn } from "@/lib/utils";

export interface ActionMenuItem {
  label: string;
  icon?: React.ReactNode;
  onSelect(): void;
  tone?: "default" | "danger";
  disabled?: boolean;
}

interface ActionMenuProps {
  label: string;
  items: ActionMenuItem[];
  className?: string;
}

/**
 * Меню «…» (WAI-ARIA menu button): Enter/Space/↓ открывают, ↑/↓ ходят по пунктам,
 * Escape и клик снаружи закрывают, фокус возвращается на кнопку
 */
export function ActionMenu({ label, items, className }: ActionMenuProps) {
  const menuId = useId();
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    itemRefs.current.find((item) => item && !item.disabled)?.focus();
    const onPointer = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointer);
    return () => document.removeEventListener("pointerdown", onPointer);
  }, [open]);

  const close = (focusButton = true) => {
    setOpen(false);
    if (focusButton) buttonRef.current?.focus();
  };

  const moveFocus = (step: number) => {
    const enabled = itemRefs.current.filter((item): item is HTMLButtonElement => Boolean(item && !item.disabled));
    const index = enabled.indexOf(document.activeElement as HTMLButtonElement);
    enabled[(index + step + enabled.length) % enabled.length]?.focus();
  };

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <button
        ref={buttonRef}
        type="button"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => setOpen((value) => !value)}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown") {
            event.preventDefault();
            setOpen(true);
          }
        }}
        className="flex size-11 items-center justify-center rounded-full bg-surface/95 text-ink shadow-card transition-colors hover:bg-background"
      >
        <MoreHorizontal className="size-5" aria-hidden />
      </button>
      {open && (
        <div
          id={menuId}
          role="menu"
          aria-label={label}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.preventDefault();
              close();
            } else if (event.key === "ArrowDown") {
              event.preventDefault();
              moveFocus(1);
            } else if (event.key === "ArrowUp") {
              event.preventDefault();
              moveFocus(-1);
            } else if (event.key === "Tab") {
              close(false);
            }
          }}
          className="absolute right-0 top-12 z-20 min-w-52 overflow-hidden rounded-[12px] border border-border bg-surface py-1 shadow-card"
        >
          {items.map((item, index) => (
            <button
              key={item.label}
              ref={(node) => {
                itemRefs.current[index] = node;
              }}
              type="button"
              role="menuitem"
              tabIndex={-1}
              disabled={item.disabled}
              onClick={() => {
                close();
                item.onSelect();
              }}
              className={cn(
                "flex min-h-11 w-full items-center gap-3 px-4 text-left text-[15px] transition-colors hover:bg-background focus-visible:bg-background disabled:opacity-50",
                item.tone === "danger" ? "text-danger" : "text-ink",
              )}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
