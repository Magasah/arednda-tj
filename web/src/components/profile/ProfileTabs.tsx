"use client";

import { useId, useRef, useState } from "react";

import { cn } from "@/lib/utils";

export interface TabItem {
  id: string;
  label: string;
  content: React.ReactNode;
}

interface ProfileTabsProps {
  label: string;
  tabs: TabItem[];
}

/** Доступные табы (WAI-ARIA Tabs): стрелки влево/вправо, Home/End, панели связаны с вкладками */
export function ProfileTabs({ label, tabs }: ProfileTabsProps) {
  const baseId = useId();
  const [active, setActive] = useState(tabs[0]?.id);
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  const select = (index: number) => {
    const tab = tabs[(index + tabs.length) % tabs.length];
    setActive(tab.id);
    refs.current[(index + tabs.length) % tabs.length]?.focus();
  };

  return (
    <div>
      <div role="tablist" aria-label={label} className="scrollbar-none flex gap-1 overflow-x-auto border-b border-border">
        {tabs.map((tab, index) => {
          const selected = tab.id === active;
          return (
            <button
              key={tab.id}
              ref={(node) => {
                refs.current[index] = node;
              }}
              id={`${baseId}-tab-${tab.id}`}
              role="tab"
              type="button"
              aria-selected={selected}
              aria-controls={`${baseId}-panel-${tab.id}`}
              tabIndex={selected ? 0 : -1}
              onClick={() => setActive(tab.id)}
              onKeyDown={(event) => {
                if (event.key === "ArrowRight") select(index + 1);
                if (event.key === "ArrowLeft") select(index - 1);
                if (event.key === "Home") select(0);
                if (event.key === "End") select(tabs.length - 1);
              }}
              className={cn(
                "-mb-px min-h-12 flex-1 shrink-0 whitespace-nowrap border-b-2 px-2 text-sm transition-colors sm:flex-none sm:px-4 sm:text-[15px]",
                selected
                  ? "border-primary font-semibold text-primary"
                  : "border-transparent font-medium text-muted-bg hover:text-ink",
              )}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
      {tabs.map((tab) => (
        <div
          key={tab.id}
          id={`${baseId}-panel-${tab.id}`}
          role="tabpanel"
          aria-labelledby={`${baseId}-tab-${tab.id}`}
          hidden={tab.id !== active}
          tabIndex={0}
          className="pt-6 focus-visible:outline-none"
        >
          {tab.id === active && tab.content}
        </div>
      ))}
    </div>
  );
}
