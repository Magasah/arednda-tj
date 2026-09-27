"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";

import { KiroyaIcon } from "@/components/ui/KiroyaIcon";
import { t } from "@/lib/i18n";
import { mediaUrl } from "@/lib/media";
import { cn } from "@/lib/utils";

import { categoryIcon } from "./categoryIcon";

interface ListingGalleryProps {
  photos: string[];
  title: string;
  categorySlug: string;
}

/**
 * Галерея: на мобиле — свайп (CSS scroll-snap, нативная инерция), на десктопе — стрелки,
 * снизу — точки. Первое фото с priority: это LCP страницы объявления.
 */
export function ListingGallery({ photos, title, categorySlug }: ListingGalleryProps) {
  const urls = photos.map((photo) => mediaUrl(photo)).filter((url): url is string => Boolean(url));
  const track = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  const total = urls.length;

  const goTo = useCallback((next: number) => {
    const node = track.current;
    if (!node) return;
    const clamped = Math.max(0, Math.min(next, node.children.length - 1));
    node.scrollTo({ left: clamped * node.clientWidth, behavior: "smooth" });
  }, []);

  useEffect(() => {
    const node = track.current;
    if (!node) return;
    const onScroll = () => setIndex(Math.round(node.scrollLeft / Math.max(node.clientWidth, 1)));
    node.addEventListener("scroll", onScroll, { passive: true });
    return () => node.removeEventListener("scroll", onScroll);
  }, []);

  if (total === 0) {
    return (
      <div className="flex aspect-[4/3] w-full items-center justify-center rounded-card bg-deposit-bg text-accent">
        <KiroyaIcon name={categoryIcon(categorySlug)} size={64} />
        <span className="sr-only">{t("listing.noPhoto")}</span>
      </div>
    );
  }

  return (
    <section
      aria-roledescription="carousel"
      aria-label={t("listing.gallery")}
      className="relative"
      onKeyDown={(event) => {
        if (event.key === "ArrowLeft") goTo(index - 1);
        if (event.key === "ArrowRight") goTo(index + 1);
      }}
    >
      <div
        ref={track}
        className="scrollbar-none flex aspect-[4/3] w-full snap-x snap-mandatory overflow-x-auto overscroll-x-contain rounded-card bg-deposit-bg"
      >
        {urls.map((url, photoIndex) => (
          <div
            key={url}
            role="group"
            aria-roledescription="slide"
            aria-label={t("listing.photoOf", { index: photoIndex + 1, total, title })}
            className="relative h-full w-full shrink-0 snap-center"
          >
            <Image
              src={url}
              alt={photoIndex === 0 ? title : t("listing.photoOf", { index: photoIndex + 1, total, title })}
              fill
              priority={photoIndex === 0}
              sizes="(min-width: 1024px) 720px, 100vw"
              className="object-cover"
            />
          </div>
        ))}
      </div>

      {total > 1 && (
        <>
          <button
            type="button"
            aria-label={t("listing.prevPhoto")}
            onClick={() => goTo(index - 1)}
            disabled={index === 0}
            className={arrowClasses("left-3")}
          >
            <ChevronLeft className="size-5" aria-hidden />
          </button>
          <button
            type="button"
            aria-label={t("listing.nextPhoto")}
            onClick={() => goTo(index + 1)}
            disabled={index === total - 1}
            className={arrowClasses("right-3")}
          >
            <ChevronRight className="size-5" aria-hidden />
          </button>

          <div className="mt-2 flex justify-center">
            {urls.map((url, dotIndex) => (
              <button
                key={url}
                type="button"
                aria-label={t("listing.goToPhoto", { index: dotIndex + 1 })}
                aria-current={dotIndex === index ? "true" : undefined}
                onClick={() => goTo(dotIndex)}
                className="flex size-11 items-center justify-center"
              >
                <span
                  className={cn(
                    "block h-2 rounded-full transition-[width,background-color]",
                    dotIndex === index ? "w-5 bg-primary" : "w-2 bg-border",
                  )}
                />
              </button>
            ))}
          </div>
        </>
      )}
    </section>
  );
}

function arrowClasses(position: string) {
  return cn(
    "absolute top-[calc(50%-1rem)] hidden size-11 -translate-y-1/2 items-center justify-center md:flex",
    "rounded-full bg-surface text-primary shadow-card transition-opacity",
    "disabled:pointer-events-none disabled:opacity-0",
    position,
  );
}
