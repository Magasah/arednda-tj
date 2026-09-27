/** @type {import('next').NextConfig} */
const nextConfig = {
  compress: true,
  // Минимальная сборка для Docker: .next/standalone + server.js (см. web/Dockerfile)
  output: "standalone",
  images: {
    formats: ["image/avif", "image/webp"],
  },
};

export default nextConfig;
