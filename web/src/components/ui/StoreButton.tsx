import Link from "next/link";

import { cn } from "@/lib/utils";

type Store = "app-store" | "google-play";

interface StoreButtonProps {
  store: Store;
  href: string;
  className?: string;
}

const stores: Record<Store, { caption: string; name: string; path: string }> = {
  "app-store": {
    caption: "Загрузите в",
    name: "App Store",
    path: "M16.37 12.6c-.02-2.3 1.88-3.4 1.96-3.46-1.07-1.56-2.73-1.77-3.32-1.8-1.41-.14-2.76.83-3.47.83-.72 0-1.82-.81-3-.79-1.54.02-2.96.9-3.76 2.27-1.6 2.78-.41 6.9 1.15 9.16.76 1.1 1.67 2.34 2.86 2.3 1.15-.05 1.58-.74 2.97-.74 1.38 0 1.78.74 2.99.72 1.24-.02 2.02-1.12 2.77-2.23.87-1.28 1.23-2.52 1.25-2.58-.03-.01-2.39-.92-2.4-3.68ZM14.1 5.84c.63-.77 1.06-1.83.94-2.89-.91.04-2.02.61-2.67 1.37-.58.67-1.1 1.76-.96 2.8 1.02.08 2.06-.52 2.69-1.28Z",
  },
  "google-play": {
    caption: "Доступно в",
    name: "Google Play",
    path: "M3.6 1.8 13.8 12 3.6 22.2c-.4-.2-.6-.7-.6-1.2V3c0-.5.2-1 .6-1.2Zm11.3 11.3 2.4 2.4-11.2 6.4 8.8-8.8Zm3.4-3.4 3 1.7c.9.5.9 1.8 0 2.3l-3 1.7-2.7-2.7 2.7-2.7ZM6.1 2.1l11.2 6.4-2.4 2.4-8.8-8.8Z",
  },
};

export function StoreButton({ store, href, className }: StoreButtonProps) {
  const { caption, name, path } = stores[store];

  return (
    <Link
      href={href}
      aria-label={`${caption} ${name}`}
      className={cn(
        "inline-flex h-14 items-center justify-center gap-3",
        "rounded-[12px] px-5",
        "bg-ink text-surface transition-[background-color,transform]",
        "hover:bg-ink/90 active:scale-[0.98]",
        className,
      )}
    >
      <svg
        viewBox="0 0 24 24"
        aria-hidden
        className="size-7 fill-current"
      >
        <path d={path} />
      </svg>
      <span className="flex flex-col items-start leading-tight">
        <span className="text-[11px] text-surface/75">{caption}</span>
        <span className="text-lg font-semibold">{name}</span>
      </span>
    </Link>
  );
}
