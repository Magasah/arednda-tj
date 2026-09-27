import { SITE_URL } from "@/lib/env";

type JsonLdData = Record<string, unknown>;

/**
 * Разметка Schema.org. JSON сериализуем сами и экранируем "<", чтобы строка из данных
 * (название объявления и т. п.) не могла закрыть </script> — это не HTML, DOMPurify не нужен
 */
export function JsonLd({ data }: { data: JsonLdData | JsonLdData[] }) {
  const json = JSON.stringify(data).replace(/</g, "\\u003c");
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: json }} />;
}

export interface BreadcrumbItem {
  name: string;
  href: string;
}

export function breadcrumbJsonLd(items: BreadcrumbItem[]): JsonLdData {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: `${SITE_URL}${item.href}`,
    })),
  };
}

export function organizationJsonLd(): JsonLdData {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "KIROYA",
    alternateName: "Кироя",
    url: SITE_URL,
    logo: `${SITE_URL}/icon.svg`,
    description: "Первая P2P-платформа аренды вещей в Таджикистане",
    areaServed: { "@type": "Country", name: "Таджикистан" },
    address: { "@type": "PostalAddress", addressLocality: "Душанбе", addressCountry: "TJ" },
    email: "support@kiroya.tj",
    sameAs: ["https://t.me/kiroyoa_bot"],
  };
}
