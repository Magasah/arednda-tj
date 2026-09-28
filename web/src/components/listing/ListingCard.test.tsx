import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import "@/test/mocks";

import type { ListingCard as ListingCardData } from "@/lib/api/types";

import { ListingCard } from "./ListingCard";

const listing: ListingCardData = {
  id: "0199bbbb-0000-7000-8000-000000000042",
  title: "Canon EOS R6",
  price_per_day: "150.00",
  deposit_amount: "2000.00",
  photos: ["/uploads/listings/camera.jpg"],
  rating_avg: 4.9,
  rating_count: 24,
  city: "Душанбе",
  category_slug: "photo",
  is_verified_owner: true,
  owner_id: "0199cccc-0000-7000-8000-000000000001",
  created_at: "2026-09-20T10:00:00Z",
};

describe("ListingCard", () => {
  it("показывает название, цену за день, депозит и рейтинг", () => {
    render(<ListingCard listing={listing} />);
    expect(screen.getByRole("heading", { name: "Canon EOS R6" })).toBeInTheDocument();
    expect(screen.getByText("150 сом/день")).toBeInTheDocument();
    expect(screen.getByText("Депозит: 2 000 сом")).toBeInTheDocument();
    expect(screen.getByText("Рейтинг 4.9, отзывов: 24")).toBeInTheDocument();
  });

  it("ссылка ведёт на карточку, фото с alt = названию", () => {
    render(<ListingCard listing={listing} />);
    expect(screen.getByRole("link", { name: "Canon EOS R6" })).toHaveAttribute("href", `/listing/${listing.id}`);
    expect(screen.getByRole("img", { name: "Canon EOS R6" })).toHaveAttribute("src", "/uploads/listings/camera.jpg");
  });

  it("зелёная галочка только у проверенного владельца", () => {
    const { rerender } = render(<ListingCard listing={listing} />);
    expect(screen.getByText("Проверенный владелец")).toBeInTheDocument();
    rerender(<ListingCard listing={{ ...listing, is_verified_owner: false }} />);
    expect(screen.queryByText("Проверенный владелец")).not.toBeInTheDocument();
  });

  it("без фото, отзывов и депозита — заглушки, а не пустота", () => {
    render(
      <ListingCard
        listing={{ ...listing, photos: [], rating_avg: null, rating_count: 0, deposit_amount: "0.00" }}
      />,
    );
    expect(screen.getByText("Фото пока нет")).toBeInTheDocument();
    expect(screen.getByText("Пока без отзывов")).toBeInTheDocument();
    expect(screen.getByText("Без депозита")).toBeInTheDocument();
  });

  it("сердечко — отдельная кнопка с подписью", () => {
    render(<ListingCard listing={listing} />);
    expect(screen.getByRole("button", { name: "Добавить в избранное" })).toBeInTheDocument();
  });
});
