import { serverApiUrl } from "@/lib/env";
import { proxyImage } from "@/lib/mediaProxy";

// Фото из локального хранилища backend (dev без MinIO): /uploads/… → backend/uploads/…
export async function GET(_request: Request, { params }: { params: { path: string[] } }) {
  return proxyImage(`${serverApiUrl()}/uploads`, params.path);
}
