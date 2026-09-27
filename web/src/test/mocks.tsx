import { vi } from "vitest";

// next/image → обычный <img>: в тестах проверяем разметку, а не оптимизатор
vi.mock("next/image", () => ({
  default: (props: Record<string, unknown>) => {
    const { src, alt, className } = props;
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={String(src)} alt={String(alt ?? "")} className={className as string | undefined} />;
  },
}));

export const router = { push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), back: vi.fn(), prefetch: vi.fn() };

vi.mock("next/navigation", () => ({
  useRouter: () => router,
  usePathname: () => "/listing/1",
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }),
  Toaster: () => null,
}));
