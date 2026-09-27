"use client";

import { useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";

const STAGGER_MS = 80;

interface FadeInUpProps {
  children: React.ReactNode;
  index?: number;
  className?: string;
}

/**
 * Появление снизу вверх при прокрутке: 200ms ease-out (DESIGN_SYSTEM), сдвиг 24px.
 * CSS-переход + IntersectionObserver вместо framer-motion — меньше JS на главной.
 * Без JS (noscript в layout) и при prefers-reduced-motion контент виден сразу.
 */
export function FadeInUp({ children, index = 0, className }: FadeInUpProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (typeof IntersectionObserver === "undefined" || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setVisible(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: "0px 0px -80px 0px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      data-fade=""
      className={cn(
        "transition-[opacity,transform] duration-200 ease-out motion-reduce:transform-none motion-reduce:opacity-100",
        visible ? "translate-y-0 opacity-100" : "translate-y-6 opacity-0",
        className,
      )}
      style={{ transitionDelay: visible ? `${index * STAGGER_MS}ms` : undefined }}
    >
      {children}
    </div>
  );
}
