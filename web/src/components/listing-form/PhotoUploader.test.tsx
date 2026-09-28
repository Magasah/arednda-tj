import "@/test/mocks";

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { PhotoUploader } from "./PhotoUploader";
import type { PhotoItem } from "./photos";
import { StepIndicator } from "./StepIndicator";

const jpeg = (name: string) =>
  new File([new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0])], name, { type: "image/jpeg" });

describe("PhotoUploader", () => {
  it("принимает JPEG и отклоняет подделку по magic bytes", async () => {
    globalThis.URL.createObjectURL = vi.fn(() => "blob:preview");
    const onChange = vi.fn();
    const { container } = render(<PhotoUploader items={[]} onChange={onChange} />);
    const input = container.querySelector("input[type=file]") as HTMLInputElement;
    const fake = new File(["hello"], "fake.jpg", { type: "image/jpeg" });
    fireEvent.change(input, { target: { files: [jpeg("ok.jpg"), fake] } });

    await waitFor(() => expect(onChange).toHaveBeenCalled());
    const added = onChange.mock.calls[0][0] as PhotoItem[];
    expect(added).toHaveLength(1);
    expect(screen.getByRole("alert")).toHaveTextContent("fake.jpg: файл не похож на изображение");
  });

  it("первое фото — обложка, кнопки порядка двигают фото", async () => {
    const items: PhotoItem[] = [
      { id: "a", kind: "existing", url: "/uploads/a.jpg" },
      { id: "b", kind: "existing", url: "/uploads/b.jpg" },
    ];
    const onChange = vi.fn();
    render(<PhotoUploader items={items} onChange={onChange} />);
    expect(screen.getByText("Обложка")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Сдвинуть фото 2 левее" }));
    expect((onChange.mock.calls[0][0] as PhotoItem[]).map((item) => item.id)).toEqual(["b", "a"]);
  });
});

describe("StepIndicator", () => {
  it("текущий шаг — aria-current, пройденные кликабельны, будущие — нет", async () => {
    const onSelect = vi.fn();
    render(<StepIndicator step={2} total={6} onSelect={onSelect} />);
    expect(screen.getByText("Шаг 3 из 6: Цена")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "3. Цена" })).toHaveAttribute("aria-current", "step");
    await userEvent.click(screen.getByRole("button", { name: "1. Категория" }));
    expect(onSelect).toHaveBeenCalledWith(0);
    expect(screen.getByRole("button", { name: "5. Фото" })).toBeDisabled();
  });
});
