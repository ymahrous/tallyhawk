import { describe, it, expect } from "vitest";
import { cn } from "./utils";

describe("cn", () => {
  it("joins multiple class strings", () => {
    expect(cn("px-4", "py-2")).toBe("px-4 py-2");
  });

  it("drops falsy values from conditional expressions", () => {
    expect(cn("px-4", false && "hidden", undefined, null, "py-2")).toBe("px-4 py-2");
  });

  it("lets a later Tailwind class win over an earlier conflicting one", () => {
    expect(cn("px-2", "px-4")).toBe("px-4");
    expect(cn("text-gray-400", "text-white")).toBe("text-white");
  });

  it("keeps non-conflicting utilities from the same element", () => {
    expect(cn("px-4", "text-white")).toBe("px-4 text-white");
  });
});
