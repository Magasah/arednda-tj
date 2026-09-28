import "@/test/mocks";

import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import { useAuthStore } from "@/lib/store/auth";

import { PostListingButton } from "./PostListingButton";

describe("«+ Разместить»", () => {
  beforeEach(() => useAuthStore.setState({ isAuthenticated: false, user: null, status: "anonymous" }));

  it("гость → вход с возвратом в мастер", () => {
    render(<PostListingButton />);
    expect(screen.getByRole("link", { name: "Разместить" })).toHaveAttribute(
      "href",
      "/login?next=%2Flisting%2Fnew",
    );
  });

  it("вошедший → сразу в мастер", () => {
    useAuthStore.setState({ isAuthenticated: true, status: "authenticated" });
    render(<PostListingButton />);
    expect(screen.getByRole("link", { name: "Разместить" })).toHaveAttribute("href", "/listing/new");
  });
});
