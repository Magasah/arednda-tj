import type { UserStats } from "@/lib/api/types";
import { t } from "@/lib/i18n";

/** Три статы профиля: сделки / споры / возвраты (DESIGN_SYSTEM → «Статистика профиля») */
export function StatsRow({ stats }: { stats: UserStats }) {
  const items = [
    { value: String(stats.total_deals), label: t("profile.deals") },
    { value: String(stats.disputes), label: t("profile.disputes") },
    {
      value: stats.return_rate_percent == null ? "—" : `${Math.round(stats.return_rate_percent)}%`,
      label: t("profile.returns"),
    },
  ];

  return (
    <dl aria-label={t("profile.stats")} className="grid grid-cols-3 divide-x divide-border rounded-card bg-surface py-4 shadow-card">
      {items.map((item) => (
        <div key={item.label} className="flex flex-col-reverse items-center gap-0.5 px-2 text-center">
          <dt className="text-xs text-muted">{item.label}</dt>
          <dd className="text-[22px] font-bold text-primary">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}
