import { describe, expect, it } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { useSessionRole } from "./useSessionRole";
import { logout } from "./api";
import { signIn } from "@/test/auth";

describe("useSessionRole", () => {
  it("reports the signed-in account type and follows sign-in and sign-out", () => {
    const { result } = renderHook(() => useSessionRole());
    expect(result.current).toBeNull();

    act(() => {
      signIn({ role: "admin" });
      window.dispatchEvent(new Event("storage"));
    });
    expect(result.current).toBe("admin");

    act(() => logout());
    expect(result.current).toBeNull();

    act(() => {
      signIn();
      window.dispatchEvent(new Event("storage"));
    });
    expect(result.current).toBe("user");
  });

  it("renders signed-out on the server", () => {
    function Probe() {
      return <span>{useSessionRole() ?? "none"}</span>;
    }
    signIn({ role: "admin" });
    expect(renderToString(<Probe />)).toContain("none");
  });
});
