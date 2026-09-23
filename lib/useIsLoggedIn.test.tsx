import { describe, it, expect } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { useIsLoggedIn } from "./useIsLoggedIn";
import { logout } from "./api";
import { signIn } from "@/test/auth";

function Probe() {
  return <span>{useIsLoggedIn() ? "in" : "out"}</span>;
}

describe("useIsLoggedIn", () => {
  it("reflects whether a token is stored", () => {
    signIn();
    const { result } = renderHook(() => useIsLoggedIn());
    expect(result.current).toBe(true);
  });

  it("updates on logout in the same tab", () => {
    signIn();
    const { result } = renderHook(() => useIsLoggedIn());
    act(() => logout());
    expect(result.current).toBe(false);
  });

  it("always renders signed-out on the server so crawlers see signup CTAs", () => {
    signIn();
    expect(renderToString(<Probe />)).toContain("out");
  });

  it("treats inaccessible storage as signed out", () => {
    const original = Storage.prototype.getItem;
    Storage.prototype.getItem = () => {
      throw new Error("SecurityError");
    };
    try {
      const { result } = renderHook(() => useIsLoggedIn());
      expect(result.current).toBe(false);
    } finally {
      Storage.prototype.getItem = original;
    }
  });
});
