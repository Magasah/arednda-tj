// Сжатие фото в браузере перед загрузкой: 10-мегапиксельный снимок с телефона → ~1 МБ.
// Библиотека грузится только когда нужна (dynamic import) — не попадает в общий бандл

const OPTIONS = { maxSizeMB: 1.5, maxWidthOrHeight: 2048, useWebWorker: true, initialQuality: 0.85 };

export async function compressImage(file: File): Promise<File> {
  if (file.size < 600 * 1024) return file;
  try {
    const { default: imageCompression } = await import("browser-image-compression");
    const blob = await imageCompression(file, OPTIONS);
    if (blob.size >= file.size) return file;
    return new File([blob], file.name, { type: blob.type || file.type, lastModified: Date.now() });
  } catch {
    // Не смогли сжать (старый браузер, битый файл) — отправим как есть, backend проверит
    return file;
  }
}
