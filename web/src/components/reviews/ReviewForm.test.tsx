import "@/test/mocks";

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { toast } from "sonner";
import { describe, expect, it, vi } from "vitest";

import { ReviewForm } from "./ReviewForm";
import { StarRating } from "./StarRating";

const createReview = vi.fn();
vi.mock("@/lib/api/reviews", () => ({ createReview: (...args: unknown[]) => createReview(...args) }));

describe("StarRating", () => {
  it("клик и стрелки меняют оценку, звёзды — radiogroup", async () => {
    const onChange = vi.fn();
    const { rerender } = render(<StarRating value={0} onChange={onChange} />);
    await userEvent.click(screen.getByRole("radio", { name: "4 из 5" }));
    expect(onChange).toHaveBeenLastCalledWith(4);

    rerender(<StarRating value={4} onChange={onChange} />);
    expect(screen.getByRole("radio", { name: "4 из 5" })).toHaveAttribute("aria-checked", "true");
    screen.getByRole("radio", { name: "4 из 5" }).focus();
    await userEvent.keyboard("{ArrowRight}");
    expect(onChange).toHaveBeenLastCalledWith(5);
  });
});

describe("ReviewForm", () => {
  it("без оценки — ошибка, запрос не уходит", async () => {
    render(<ReviewForm bookingId="b1" aboutName="Фаридун" onDone={vi.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: "Отправить отзыв" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Поставьте оценку");
    expect(screen.getByRole("radiogroup")).toHaveAttribute("aria-invalid", "true");
    expect(createReview).not.toHaveBeenCalled();
  });

  it("отправляет оценку и текст; второй раз форму не показывает", async () => {
    createReview.mockResolvedValueOnce({ id: "r1", is_hidden: false });
    const onDone = vi.fn();
    const { unmount } = render(<ReviewForm bookingId="b1" aboutName="Фаридун" onDone={onDone} />);
    await userEvent.click(screen.getByRole("radio", { name: "5 из 5" }));
    await userEvent.type(screen.getByRole("textbox", { name: "Отзыв" }), "Всё отлично");
    await userEvent.click(screen.getByRole("button", { name: "Отправить отзыв" }));
    expect(createReview).toHaveBeenCalledWith("b1", 5, "Всё отлично");
    expect(onDone).toHaveBeenCalled();
    expect(toast.success).toHaveBeenCalledWith("Спасибо за отзыв!");
    unmount();

    render(<ReviewForm bookingId="b1" aboutName="Фаридун" onDone={onDone} />);
    expect(screen.getByText("Вы уже оставили отзыв по этой сделке")).toBeInTheDocument();
  });

  it("отзыв скрыт антифродом — говорим про модерацию, а не «опубликован»", async () => {
    createReview.mockResolvedValueOnce({ id: "r2", is_hidden: true });
    render(<ReviewForm bookingId="b2" aboutName="Фаридун" onDone={vi.fn()} />);
    await userEvent.click(screen.getByRole("radio", { name: "3 из 5" }));
    await userEvent.click(screen.getByRole("button", { name: "Отправить отзыв" }));
    expect(toast).toHaveBeenCalledWith("Отзыв отправлен на проверку", expect.anything());
  });
});
