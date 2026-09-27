"use client";

import { useCallback, useEffect, useState } from "react";

/** Обратный отсчёт в секундах: start(60) → 60, 59, … 0 */
export function useCountdown() {
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    if (seconds <= 0) return;
    const timer = window.setTimeout(() => setSeconds((value) => value - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [seconds]);

  const start = useCallback((value: number) => setSeconds(Math.max(0, Math.ceil(value))), []);

  return { seconds, start, active: seconds > 0 };
}
