import type { Metadata } from "next";

interface PageMetaInput {
  title: string;
  description: string;
  path: string;
  /** Абсолютный или корневой путь к картинке; по умолчанию — общая OG-картинка */
  image?: string | null;
  /** title без шаблона «— KIROYA» (когда бренд уже в названии) */
  absoluteTitle?: boolean;
  noIndex?: boolean;
}

const DEFAULT_OG = { url: "/images/og-image.png", width: 1200, height: 630, alt: "KIROYA" };

/** Единые метаданные страницы: title, description, canonical, Open Graph и Twitter */
export function pageMetadata({
  title,
  description,
  path,
  image,
  absoluteTitle = false,
  noIndex = false,
}: PageMetaInput): Metadata {
  const images = image ? [{ url: image, alt: title }] : [DEFAULT_OG];
  return {
    title: absoluteTitle ? { absolute: title } : title,
    description,
    alternates: { canonical: path },
    openGraph: {
      title,
      description,
      url: path,
      siteName: "KIROYA",
      locale: "ru_TJ",
      type: "website",
      images,
    },
    twitter: { card: "summary_large_image", title, description, images: images.map((item) => item.url) },
    robots: noIndex ? { index: false, follow: false } : undefined,
  };
}
