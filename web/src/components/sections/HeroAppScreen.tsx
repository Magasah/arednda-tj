import {
  Bell,
  Bike,
  Camera,
  ChevronDown,
  Drill,
  House,
  MapPin,
  MessageCircle,
  Plus,
  Projector,
  Search,
  SlidersHorizontal,
  User,
} from "lucide-react";

import { cn } from "@/lib/utils";

import { HeroListingCard } from "./HeroListingCard";
import { HeroTabItem } from "./HeroTabItem";

const chips = ["Все", "Техника", "Инструменты", "Транспорт"];

const listings = [
  { icon: Camera, title: "Canon EOS R6", price: 150, deposit: 2000, rating: 4.9, reviews: 24 },
  { icon: Drill, title: "Перфоратор Bosch", price: 80, deposit: 800, rating: 4.8, reviews: 31 },
  { icon: Bike, title: "Велосипед Trek", price: 60, deposit: 1000, rating: 4.7, reviews: 12 },
  { icon: Projector, title: "Проектор Epson", price: 120, deposit: 1500, rating: 5.0, reviews: 9 },
];

const tabs = [
  { icon: House, label: "Главная", active: true },
  { icon: Search, label: "Поиск", active: false },
  { icon: MessageCircle, label: "Сообщения", active: false },
  { icon: User, label: "Профиль", active: false },
];

export function HeroAppScreen() {
  return (
    <div className="flex size-full flex-col">
      <div className="flex items-center justify-between px-5 pt-3 text-[9px] font-semibold text-ink">
        <span>9:41</span>
        <span className="h-2 w-4 rounded-[2px] border border-ink" />
      </div>

      <div className="flex items-center justify-between bg-surface px-3 pb-2 pt-5">
        <span className="flex items-center gap-0.5 text-[9px] font-medium text-ink">
          <MapPin className="size-3 text-primary" />
          Душанбе
          <ChevronDown className="size-2.5 text-muted" />
        </span>
        <span className="text-[13px] font-extrabold text-primary">KIROYA</span>
        <span className="relative">
          <Bell className="size-3.5 text-ink" />
          <span className="absolute -right-0.5 -top-0.5 size-1.5 rounded-full bg-accent" />
        </span>
      </div>

      <div className="flex-1 space-y-2.5 overflow-hidden px-3 pt-2.5">
        <div className="flex h-7 items-center gap-1.5 rounded-[8px] border border-border bg-surface px-2">
          <Search className="size-3 text-muted" />
          <span className="flex-1 text-[8px] text-muted">Что хотите арендовать?</span>
          <SlidersHorizontal className="size-3 text-primary" />
        </div>

        <div className="flex gap-1">
          {chips.map((chip, index) => (
            <span
              key={chip}
              className={cn(
                "shrink-0 rounded-chip px-2 py-1 text-[7px]",
                index === 0
                  ? "bg-primary font-semibold text-surface"
                  : "border border-border bg-surface font-medium text-ink",
              )}
            >
              {chip}
            </span>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-2">
          {listings.map((listing) => (
            <HeroListingCard key={listing.title} {...listing} />
          ))}
        </div>
      </div>

      <div className="relative grid grid-cols-5 items-end border-t border-border bg-surface px-2 pb-4 pt-1.5">
        {tabs.slice(0, 2).map((tab) => (
          <HeroTabItem key={tab.label} {...tab} />
        ))}
        <span className="flex justify-center">
          <span className="-mt-5 flex size-9 items-center justify-center rounded-full bg-accent shadow-fab">
            <Plus className="size-4 text-surface" strokeWidth={2.5} />
          </span>
        </span>
        {tabs.slice(2).map((tab) => (
          <HeroTabItem key={tab.label} {...tab} />
        ))}
      </div>
    </div>
  );
}
