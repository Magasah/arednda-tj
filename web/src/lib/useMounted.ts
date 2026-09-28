"use client";

import { useEffect, useState } from "react";

/**
 * false при серверном рендере и гидрации, true — после. Для текста, зависящего от «сейчас»
 * («через 3 дня»): сервер и браузер считают его в разные моменты, и React ругается на расхождение
 */
export function useMounted(): boolean {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted;
}
