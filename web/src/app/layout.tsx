import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";

import "./globals.css";

const inter = Inter({
  subsets: ["latin", "cyrillic"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
  variable: "--font-inter",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://kiroya.tj"),
  title: "KIROYA — Аренда вещей в Душанбе | Безопасно и удобно",
  description:
    "Арендуй ноутбук, камеру, инструменты рядом с тобой. Первая P2P платформа аренды вещей в Таджикистане. Защита денег через эскроу, фото-акт, рейтинг мастеров.",
  keywords: [
    "кироя",
    "аренда",
    "душанбе",
    "таджикистан",
    "kiroya",
    "прокат",
    "ноутбук аренда",
    "камера аренда",
  ],
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "KIROYA — Арендуй всё рядом с тобой",
    description: "Безопасная аренда вещей в Таджикистане",
    url: "https://kiroya.tj",
    siteName: "KIROYA",
    locale: "ru_TJ",
    type: "website",
    images: [
      {
        url: "/images/og-image.png",
        width: 1200,
        height: 630,
        alt: "KIROYA — Арендуй всё рядом с тобой",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    images: ["/images/og-image.png"],
  },
  robots: {
    index: true,
    follow: true,
  },
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/favicon.ico", sizes: "any" },
    ],
    apple: "/apple-icon.png",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

interface RootLayoutProps {
  children: React.ReactNode;
}

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="ru" className={inter.variable}>
      <body>
        <noscript>
          <style>{"[data-fade]{opacity:1!important;transform:none!important}"}</style>
        </noscript>
        {children}
      </body>
    </html>
  );
}
