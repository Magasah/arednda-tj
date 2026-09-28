// Проверка изображений до отправки: тип, размер и «магические байты» — первые байты файла.
// Расширение и MIME задаёт пользователь, их легко подделать; сигнатуру — нет.
// Окончательная проверка всё равно на backend — это защита от ошибок и мусора ещё в браузере

export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
export const IMAGE_ACCEPT = "image/jpeg,image/png,image/webp";
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export type ImageKind = "jpeg" | "png" | "webp";

/** JPEG FF D8 FF · PNG 89 50 4E 47 · WebP "RIFF"....“WEBP” */
export function detectImageKind(bytes: Uint8Array): ImageKind | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "jpeg";
  if (
    bytes.length >= 4 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  ) {
    return "png";
  }
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return "webp";
  }
  return null;
}

async function headBytes(file: Blob, count = 12): Promise<Uint8Array> {
  const slice = file.slice(0, count);
  // jsdom и старые браузеры: у Blob может не быть arrayBuffer()
  if (typeof slice.arrayBuffer === "function") return new Uint8Array(await slice.arrayBuffer());
  return new Uint8Array(
    await new Promise<ArrayBuffer>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as ArrayBuffer);
      reader.onerror = () => reject(reader.error);
      reader.readAsArrayBuffer(slice);
    }),
  );
}

export type ImageProblem = "type" | "size" | "signature";

/** null — файл подходит; иначе причина отказа */
export async function checkImageFile(file: File, maxBytes = MAX_IMAGE_BYTES): Promise<ImageProblem | null> {
  if (!ALLOWED_TYPES.has(file.type)) return "type";
  if (file.size > maxBytes || file.size === 0) return "size";
  const kind = detectImageKind(await headBytes(file));
  if (!kind) return "signature";
  return null;
}
