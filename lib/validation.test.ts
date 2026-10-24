import { describe, it, expect } from "vitest";
import { getPasswordStrength, validateEmail, validatePassword } from "./validation";

describe("validateEmail", () => {
  it("requires a value", () => {
    expect(validateEmail("")).toBe("Email is required.");
  });

  it.each(["ada", "ada@", "ada@example", "a da@example.com", "@example.com"])(
    "rejects %s",
    (email) => {
      expect(validateEmail(email)).toBe("Please enter a valid email address.");
    }
  );

  it.each(["ada@example.com", "ada.lovelace+books@sub.example.co.uk"])("accepts %s", (email) => {
    expect(validateEmail(email)).toBe("");
  });
});

describe("validatePassword", () => {
  it("enforces length, then uppercase, then a digit", () => {
    expect(validatePassword("Ab1")).toBe("Password must be at least 8 characters.");
    expect(validatePassword("lowercase1")).toBe(
      "Password must contain at least one uppercase letter."
    );
    expect(validatePassword("NoDigitsHere")).toBe("Password must contain at least one number.");
  });

  it("accepts a password that meets the policy", () => {
    expect(validatePassword("Secret123")).toBe("");
  });
});

describe("getPasswordStrength", () => {
  it("is empty for an empty password", () => {
    expect(getPasswordStrength("")).toEqual({ score: 0, label: "", color: "" });
  });

  it.each([
    ["abc", 0, "Very weak"],
    ["abcdefgh", 1, "Very weak"],
    ["abcdefgH", 2, "Weak"],
    ["abcdefgH1", 3, "Fair"],
    ["abcdefgH1!", 4, "Strong"],
    ["abcdefghijK1!", 5, "Very strong"],
  ])("scores %s as %i (%s)", (password, score, label) => {
    expect(getPasswordStrength(password)).toMatchObject({ score, label });
  });

  it("returns a Tailwind background class for the meter", () => {
    expect(getPasswordStrength("abcdefghijK1!").color).toBe("bg-emerald-500");
    expect(getPasswordStrength("abc").color).toBe("bg-red-500");
  });
});

describe("length limits", () => {
  it("rejects emails longer than RFC 5321 allows", () => {
    expect(validateEmail(`${"a".repeat(250)}@b.co`)).toBe("Email address is too long.");
  });

  it("rejects passwords bcrypt would silently truncate (over 72 bytes)", () => {
    expect(validatePassword(`A1${"x".repeat(70)}`)).toBe("");
    expect(validatePassword(`A1${"x".repeat(71)}`)).toBe("Password must be at most 72 characters.");
    // Bytes, not characters: 25 three-byte characters are 75 bytes.
    expect(validatePassword(`A1${"€".repeat(25)}`)).toBe("Password must be at most 72 characters.");
  });
});
