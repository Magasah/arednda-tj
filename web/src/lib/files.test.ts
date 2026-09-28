import { describe, expect, it } from "vitest";

import { checkImageFile, detectImageKind, MAX_IMAGE_BYTES } from "./files";

const JPEG = [0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0];
const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0];
// "RIFF" + размер + "WEBP"
const WEBP = [0x52, 0x49, 0x46, 0x46, 1, 2, 3, 4, 0x57, 0x45, 0x42, 0x50];

const file = (bytes: number[], type: string, name = "photo.jpg") => new File([new Uint8Array(bytes)], name, { type });

describe("magic bytes: сигнатура файла, а не расширение", () => {
  it("узнаёт JPEG, PNG и WebP", () => {
    expect(detectImageKind(new Uint8Array(JPEG))).toBe("jpeg");
    expect(detectImageKind(new Uint8Array(PNG))).toBe("png");
    expect(detectImageKind(new Uint8Array(WEBP))).toBe("webp");
  });

  it("RIFF без WEBP (например, WAV) и текст — не картинка", () => {
    const wav = [0x52, 0x49, 0x46, 0x46, 1, 2, 3, 4, 0x57, 0x41, 0x56, 0x45];
    expect(detectImageKind(new Uint8Array(wav))).toBeNull();
    expect(detectImageKind(new TextEncoder().encode("<script>alert(1)</script>"))).toBeNull();
  });

  it("checkImageFile: подделка с MIME image/jpeg не проходит", async () => {
    const fake = new File(["not an image at all"], "fake.jpg", { type: "image/jpeg" });
    expect(await checkImageFile(fake)).toBe("signature");
    expect(await checkImageFile(file(JPEG, "image/jpeg"))).toBeNull();
  });

  it("checkImageFile: чужой тип и слишком большой файл", async () => {
    expect(await checkImageFile(file(JPEG, "image/gif", "a.gif"))).toBe("type");
    const big = file(JPEG, "image/jpeg");
    Object.defineProperty(big, "size", { value: MAX_IMAGE_BYTES + 1 });
    expect(await checkImageFile(big)).toBe("size");
  });
});
