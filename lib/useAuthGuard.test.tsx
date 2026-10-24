import { describe, expect, it } from "vitest";
import { renderHook } from "@testing-library/react";
import { useAuthGuard } from "./useAuthGuard";
import { router } from "@/test/navigation";
import { signIn, signInExpired } from "@/test/auth";

describe("useAuthGuard", () => {
  it("sends signed-out and expired visitors to log in", () => {
    expect(renderHook(() => useAuthGuard("user")).result.current).toBe(false);
    signInExpired();
    renderHook(() => useAuthGuard("admin"));
    expect(router.push).toHaveBeenNthCalledWith(1, "/login");
    expect(router.push).toHaveBeenNthCalledWith(2, "/login");
  });

  it("lets the right account type in", () => {
    signIn();
    expect(renderHook(() => useAuthGuard("user")).result.current).toBe(true);
    signIn({ role: "admin" });
    expect(renderHook(() => useAuthGuard("admin")).result.current).toBe(true);
    expect(router.replace).not.toHaveBeenCalled();
  });

  it("sends each account type to its own home instead of the other's pages", () => {
    signIn({ role: "admin" });
    expect(renderHook(() => useAuthGuard("user")).result.current).toBe(false);
    expect(router.replace).toHaveBeenLastCalledWith("/admin");

    signIn();
    expect(renderHook(() => useAuthGuard("admin")).result.current).toBe(false);
    expect(router.replace).toHaveBeenLastCalledWith("/app");
  });
});
