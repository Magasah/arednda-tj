import "@/test/mocks";

import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";

import { OTPInput } from "./OTPInput";

function Harness({ onComplete }: { onComplete?: (code: string) => void }) {
  const [value, setValue] = useState("");
  return <OTPInput value={value} onChange={setValue} onComplete={onComplete} />;
}

const boxes = () => screen.getAllByRole("textbox") as HTMLInputElement[];

describe("OTPInput", () => {
  it("рисует 6 полей с подписями для скринридера", () => {
    render(<Harness />);
    expect(boxes()).toHaveLength(6);
    expect(screen.getByLabelText("Цифра 1 из 6")).toHaveAttribute("autocomplete", "one-time-code");
  });

  it("после цифры фокус переходит на следующее поле", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(boxes()[0]);
    await user.keyboard("4");
    expect(boxes()[0]).toHaveValue("4");
    expect(boxes()[1]).toHaveFocus();
  });

  it("буквы игнорируются", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(boxes()[0]);
    await user.keyboard("a");
    expect(boxes()[0]).toHaveValue("");
    expect(boxes()[0]).toHaveFocus();
  });

  it("вставка из буфера заполняет все поля и вызывает onComplete", () => {
    const onComplete = vi.fn();
    render(<Harness onComplete={onComplete} />);
    fireEvent.paste(boxes()[0], { clipboardData: { getData: () => "Код: 123-456" } });
    expect(boxes().map((box) => box.value).join("")).toBe("123456");
    expect(onComplete).toHaveBeenCalledWith("123456");
  });

  it("Backspace в пустом поле возвращает на предыдущее и стирает его", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(boxes()[0]);
    await user.keyboard("12");
    expect(boxes()[2]).toHaveFocus();
    await user.keyboard("{Backspace}");
    expect(boxes()[1]).toHaveFocus();
    expect(boxes()[1]).toHaveValue("");
  });

  it("onComplete вызывается после ввода 6-й цифры", async () => {
    const user = userEvent.setup();
    const onComplete = vi.fn();
    render(<Harness onComplete={onComplete} />);
    await user.click(boxes()[0]);
    await user.keyboard("98765");
    expect(onComplete).not.toHaveBeenCalled();
    await user.keyboard("4");
    expect(onComplete).toHaveBeenCalledWith("987654");
  });
});
