import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";

import { AuthProvider } from "@/components/providers/AuthProvider";
import { Toaster } from "@/components/ui/Toast";
import { SITE_URL } from "@/lib/env";
import { t } from "@/lib/i18n";

import "./globals.css";

const inter = Inter({
  subsets: ["latin", "cyrillic"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
  variable: "--font-inter",
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: t("meta.homeTitle"),
    template: "%s — KIROYA",
  },
  description: t("meta.homeDescription"),
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
  openGraph: {
    title: "KIROYA — Арендуй всё рядом с тобой",
    description: "Безопасная аренда вещей в Таджикистане",
    url: SITE_URL,
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
  themeColor: "#1A5276",
};

interface RootLayoutProps {
  children: React.ReactNode;
}

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="ru" className={inter.variable}>
      <body className="flex min-h-screen flex-col">
        <noscript>
          <style>{"[data-fade]{opacity:1!important;transform:none!important}"}</style>
        </noscript>
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-[8px] focus:bg-surface focus:px-4 focus:py-3 focus:text-primary focus:shadow-card"
        >
          {t("common.skipToContent")}
        </a>
        <AuthProvider>{children}</AuthProvider>
        <Toaster />
      </body>
    </html>
  );
}
