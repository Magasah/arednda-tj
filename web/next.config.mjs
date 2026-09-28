// Адреса берутся при сборке (NEXT_PUBLIC_* — build args в web/Dockerfile)
const apiUrl = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000").replace(/\/+$/, "");
const isDev = process.env.NODE_ENV !== "production";

function origin(url) {
  try {
    return new URL(url).origin;
  } catch {
    return "";
  }
}

// connect-src: сам сайт (BFF /api/*) + backend для публичных GET из браузера
const connectSrc = ["'self'", origin(apiUrl), "https://api.kiroya.tj"].filter(Boolean);

const csp = [
  "default-src 'self'",
  // 'unsafe-inline' — инлайн-скрипты гидрации Next.js; 'unsafe-eval' — только dev (fast refresh)
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  // blob: — превью выбранных фото до загрузки (URL.createObjectURL)
  "img-src 'self' data: blob: https:",
  `connect-src ${connectSrc.join(" ")}${isDev ? " ws:" : ""}`,
  "font-src 'self' data:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'self'",
].join("; ");

const securityHeaders = [
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(self)" },
  { key: "Content-Security-Policy", value: csp },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  compress: true,
  poweredByHeader: false,
  // Минимальная сборка для Docker: .next/standalone + server.js (см. web/Dockerfile)
  output: "standalone",
  images: {
    formats: ["image/avif", "image/webp"],
    // Фото в dev идут через свои /media и /uploads (route handlers); в проде — CDN на kiroya.tj
    remotePatterns: [
      { protocol: "https", hostname: "kiroya.tj" },
      { protocol: "https", hostname: "**.kiroya.tj" },
    ],
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

// npm run analyze → отчёт о бандлах в .next/analyze (плагин грузится только в этом режиме)
const withBundleAnalyzer =
  process.env.ANALYZE === "true"
    ? (await import("@next/bundle-analyzer")).default({ enabled: true, openAnalyzer: false })
    : (config) => config;

export default withBundleAnalyzer(nextConfig);
