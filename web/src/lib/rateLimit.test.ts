import { describe, expect, it } from "vitest";

import { LISTING_LIMIT, limitWait, recordHit, REVIEW_WINDOW_MS, reviewKey } from "./rateLimit";

describe("клиентские лимиты", () => {
  it("объявления: 5 в час, шестое — подождать", () => {
    const { key, max, windowMs } = LISTING_LIMIT;
    const start = 1_000_000;
    for (let i = 0; i < 5; i += 1) {
      expect(limitWait(key, max, windowMs, start + i)).toBe(0);
      recordHit(key, windowMs, start + i);
    }
    expect(limitWait(key, max, windowMs, start + 10)).toBeGreaterThan(59 * 60 * 1000);
    // через час первая отметка устаревает
    expect(limitWait(key, max, windowMs, start + windowMs + 1)).toBe(0);
  });

  it("отзыв: один на сделку", () => {
    const key = reviewKey("booking-1");
    expect(limitWait(key, 1, REVIEW_WINDOW_MS)).toBe(0);
    recordHit(key, REVIEW_WINDOW_MS);
    expect(limitWait(key, 1, REVIEW_WINDOW_MS)).toBeGreaterThan(0);
    expect(limitWait(reviewKey("booking-2"), 1, REVIEW_WINDOW_MS)).toBe(0);
  });
});
