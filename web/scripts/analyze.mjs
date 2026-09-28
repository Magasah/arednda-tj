// npm run analyze — сборка с отчётом о размере бандлов (.next/analyze/*.html).
// Отдельный скрипт, а не «ANALYZE=true next build»: так работает и в PowerShell на Windows
import { spawnSync } from "node:child_process";

const result = spawnSync("npx", ["next", "build"], {
  stdio: "inherit",
  shell: process.platform === "win32",
  env: { ...process.env, ANALYZE: "true" },
});
process.exit(result.status ?? 1);
