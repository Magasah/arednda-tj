import { Star } from "lucide-react";

import { formatRating } from "@/lib/format";
import { messagesOf, plural, t } from "@/lib/i18n";

interface RatingHistogramProps {
  avg: number | null;
  total: number;
  distribution: Record<string, number>;
}

/** Средняя оценка + горизонтальные полосы 5★ … 1★ */
export function RatingHistogram({ avg, total, distribution }: RatingHistogramProps) {
  const max = Math.max(1, ...[1, 2, 3, 4, 5].map((star) => distribution[String(star)] ?? 0));
  const words = messagesOf().reviews.words;

  return (
    <div className="flex flex-col gap-5 rounded-card bg-surface p-5 shadow-card sm:flex-row sm:items-center sm:gap-8 lg:flex-col lg:items-stretch lg:gap-5">
      <div className="flex shrink-0 flex-col items-center sm:w-36 lg:w-auto">
        <p className="text-5xl font-bold leading-none text-ink">{formatRating(avg)}</p>
        <p className="mt-2 flex gap-0.5" aria-label={t("reviews.avg", { value: formatRating(avg) })}>
          {[1, 2, 3, 4, 5].map((star) => (
            <Star
              key={star}
              aria-hidden
              className={
                avg != null && star <= Math.round(avg)
                  ? "size-4 fill-accent-btn text-accent-btn"
                  : "size-4 fill-transparent text-muted"
              }
            />
          ))}
        </p>
        <p className="mt-1 text-sm text-muted">{t("reviews.total", { count: total, word: plural(total, words) })}</p>
      </div>
      <table className="w-full text-sm">
        <caption className="sr-only">{t("reviews.distribution")}</caption>
        <tbody>
          {[5, 4, 3, 2, 1].map((star) => {
            const count = distribution[String(star)] ?? 0;
            return (
              <tr key={star}>
                <th scope="row" className="w-10 py-1 pr-2 text-left font-semibold text-ink">
                  <span aria-hidden>{star}★</span>
                  <span className="sr-only">{t("reviews.star", { count: star })}</span>
                </th>
                <td className="py-1">
                  <span className="block h-2.5 overflow-hidden rounded-full bg-border">
                    <span
                      className="block h-full rounded-full bg-accent-btn"
                      style={{ width: `${(count / max) * 100}%` }}
                    />
                  </span>
                </td>
                <td className="w-10 py-1 pl-3 text-right tabular-nums text-muted">{count}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
