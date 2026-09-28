"use client";

import "react-day-picker/style.css";

import { addDays } from "date-fns";
import { DayPicker, type DateRange } from "react-day-picker";
import { ru } from "react-day-picker/locale";

import { tomorrow } from "@/lib/dates";

import { MAX_RENTAL_DAYS } from "./logic";

interface DateRangePickerProps {
  value: DateRange | undefined;
  onChange(range: DateRange | undefined): void;
  busy: { from: Date; to: Date }[];
  /** Два месяца рядом на широком экране */
  months?: number;
}

/**
 * Календарь дней аренды (включительно). Отдельный чанк: react-day-picker + стили грузятся
 * только при открытии окна бронирования.
 */
export default function DateRangePicker({ value, onChange, busy, months = 1 }: DateRangePickerProps) {
  const first = tomorrow();

  return (
    <DayPicker
      mode="range"
      locale={ru}
      numberOfMonths={months}
      selected={value}
      onSelect={onChange}
      startMonth={first}
      endMonth={addDays(first, 180)}
      // Прошлое, сегодня и занятые дни выбрать нельзя; через занятые диапазон не «перепрыгивает»
      disabled={[{ before: first }, ...busy]}
      excludeDisabled
      max={MAX_RENTAL_DAYS - 1}
      modifiers={{ busy }}
      modifiersClassNames={{ busy: "rdp-busy" }}
      className="kiroya-rdp"
    />
  );
}
