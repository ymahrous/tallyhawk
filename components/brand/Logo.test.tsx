import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Logo, LogoMark } from "./Logo";
import JsonLd from "@/components/seo/JsonLd";
import { LOGO_HAWK_PATH } from "@/lib/brand";

describe("LogoMark", () => {
  it("is decorative by default", () => {
    const { container } = render(<LogoMark />);
    const svg = container.querySelector("svg")!;
    expect(svg).toHaveAttribute("aria-hidden", "true");
    expect(svg.querySelector("path")).toHaveAttribute("d", LOGO_HAWK_PATH);
  });

  it("becomes a labelled image when given a title", () => {
    render(<LogoMark title="Tallyhawk" />);
    expect(screen.getByRole("img", { name: "Tallyhawk" })).toBeInTheDocument();
  });

  it("gives each instance its own gradient id", () => {
    const { container } = render(
      <>
        <LogoMark />
        <LogoMark />
      </>
    );
    const ids = [...container.querySelectorAll("linearGradient")].map((g) => g.id);
    expect(new Set(ids).size).toBe(2);
    container.querySelectorAll("svg").forEach((svg, index) => {
      expect(svg.querySelector("rect")).toHaveAttribute("fill", `url(#${ids[index]})`);
    });
  });
});

describe("Logo", () => {
  it("pairs the mark with the wordmark", () => {
    render(<Logo />);
    expect(screen.getByText("Tallyhawk")).toBeInTheDocument();
  });
});

describe("JsonLd", () => {
  it("renders escaped, parseable structured data", () => {
    const { container } = render(<JsonLd data={{ "@type": "Thing", name: "</script>" }} />);
    const script = container.querySelector('script[type="application/ld+json"]')!;
    expect(script.innerHTML).not.toContain("</script>");
    expect(JSON.parse(script.textContent!)).toEqual({ "@type": "Thing", name: "</script>" });
  });
});
