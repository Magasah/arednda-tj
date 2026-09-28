import { proxyImage } from "@/lib/mediaProxy";

// Фото из MinIO: /media/<bucket>/<object> → MEDIA_INTERNAL_URL (в docker — http://minio:9000)
export async function GET(_request: Request, { params }: { params: { path: string[] } }) {
  const base = process.env.MEDIA_INTERNAL_URL || process.env.NEXT_PUBLIC_MEDIA_URL || "http://localhost:9000";
  return proxyImage(base, params.path);
}
