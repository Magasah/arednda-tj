import type { LucideIcon } from "lucide-react";
import { Check, Heart, Star } from "lucide-react";

interface HeroListingCardProps {
  icon: LucideIcon;
  title: string;
  price: number;
  deposit: number;
  rating: number;
  reviews: number;
}

export function HeroListingCard({
  icon: Icon,
  title,
  price,
  deposit,
  rating,
  reviews,
}: HeroListingCardProps) {
  return (
    <div className="overflow-hidden rounded-[10px] bg-surface shadow-card">
      <div className="relative flex aspect-[4/3] items-center justify-center bg-deposit-bg">
        <Icon className="size-7 text-accent" strokeWidth={1.6} />
        <Heart className="absolute right-1.5 top-1.5 size-3 text-muted" />
        <span className="absolute bottom-1.5 right-1.5 flex size-3.5 items-center justify-center rounded-full bg-success">
          <Check className="size-2.5 text-surface" strokeWidth={3} />
        </span>
      </div>
      <div className="space-y-1 p-2">
        <p className="truncate text-[9px] font-semibold text-ink">{title}</p>
        <p className="whitespace-nowrap text-[10px] font-bold text-accent-text">{price} сом/день</p>
        <p className="w-fit whitespace-nowrap rounded-[4px] bg-deposit-bg px-1 py-0.5 text-[7px] font-medium text-accent-text">
          Депозит: {deposit} сом
        </p>
        <p className="flex items-center gap-0.5 text-[8px] font-medium text-ink">
          <Star className="size-2 fill-accent text-accent" />
          {rating.toFixed(1)} ({reviews})
        </p>
      </div>
    </div>
  );
}
