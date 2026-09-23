import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { LOGO_HAWK_PATH, logoSvg } from "./brand";

const root = join(__dirname, "..");

describe("logoSvg", () => {
  it("renders a rounded, gradient-filled tile with the hawk as an even-odd path", () => {
    const svg = logoSvg();
    expect(svg).toContain('rx="15"');
    expect(svg).toContain('fill="url(#tallyhawk-gradient)"');
    expect(svg).toContain(`d="${LOGO_HAWK_PATH}"`);
    expect(svg).toContain('fill-rule="evenodd"');
    expect(svg).toContain("<title>Tallyhawk</title>");
  });

  it("supports full-bleed and safe-zone variants for platform icons", () => {
    expect(logoSvg({ shape: "square" })).toContain('rx="0"');
    expect(logoSvg({ shape: "square", hawkScale: 0.8 })).toContain(
      'transform="translate(6.399999999999999 6.399999999999999) scale(0.8)"'
    );
  });

  it("draws the head, eye and two ledger rows as four subpaths", () => {
    expect(LOGO_HAWK_PATH.match(/M/g)).toHaveLength(4);
  });
});

describe("generated brand assets", () => {
  it("are in sync with lib/brand.ts (run `npm run brand:assets` after changing the mark)", () => {
    expect(readFileSync(join(root, "app/icon.svg"), "utf8")).toBe(logoSvg());
    expect(readFileSync(join(root, "public/logo.svg"), "utf8")).toBe(logoSvg());
  });

  it.each([
    "app/favicon.ico",
    "app/apple-icon.png",
    "public/logo.png",
    "public/icons/icon-192.png",
    "public/icons/icon-512.png",
    "public/icons/icon-maskable-512.png",
  ])("%s exists", (file) => {
    expect(existsSync(join(root, file))).toBe(true);
  });

  it("does not leave a public favicon that would conflict with app/favicon.ico", () => {
    expect(existsSync(join(root, "public/favicon.ico"))).toBe(false);
  });
});
