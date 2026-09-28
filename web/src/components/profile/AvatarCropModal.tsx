"use client";

import { useCallback, useId, useState } from "react";
import Cropper, { type Area } from "react-easy-crop";

import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { t } from "@/lib/i18n";

// Кадрирование аватара. Отдельный чанк (react-easy-crop) — грузится после выбора файла

const OUTPUT = 512;

/** Вырезать область из картинки → квадрат 512×512 JPEG */
async function cropToFile(src: string, area: Area): Promise<File> {
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new window.Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
  const canvas = document.createElement("canvas");
  canvas.width = OUTPUT;
  canvas.height = OUTPUT;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("canvas");
  context.drawImage(image, area.x, area.y, area.width, area.height, 0, 0, OUTPUT, OUTPUT);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.9));
  if (!blob) throw new Error("toBlob");
  return new File([blob], "avatar.jpg", { type: "image/jpeg" });
}

interface AvatarCropModalProps {
  src: string;
  onCancel(): void;
  onApply(file: File): void;
}

export default function AvatarCropModal({ src, onCancel, onApply }: AvatarCropModalProps) {
  const zoomId = useId();
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [area, setArea] = useState<Area | null>(null);
  const [busy, setBusy] = useState(false);

  const onComplete = useCallback((_: Area, pixels: Area) => setArea(pixels), []);

  async function apply() {
    if (!area) return;
    setBusy(true);
    try {
      onApply(await cropToFile(src, area));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open
      onOpenChange={(open) => !open && onCancel()}
      title={t("account.avatarCropTitle")}
      footer={
        <>
          <Button variant="outline" size="md" onClick={onCancel}>
            {t("common.cancel")}
          </Button>
          <Button variant="accent" size="md" loading={busy} disabled={!area} onClick={() => void apply()}>
            {t("account.avatarApply")}
          </Button>
        </>
      }
    >
      <div className="relative h-72 overflow-hidden rounded-[12px] bg-ink">
        <Cropper
          image={src}
          crop={crop}
          zoom={zoom}
          aspect={1}
          cropShape="round"
          showGrid={false}
          onCropChange={setCrop}
          onZoomChange={setZoom}
          onCropComplete={onComplete}
        />
      </div>
      <label htmlFor={zoomId} className="mt-4 block text-sm font-semibold text-ink">
        {t("account.avatarZoom")}
      </label>
      <input
        id={zoomId}
        type="range"
        min={1}
        max={3}
        step={0.05}
        value={zoom}
        onChange={(event) => setZoom(Number(event.target.value))}
        className="mt-2 w-full accent-[#1A5276]"
      />
    </Modal>
  );
}
