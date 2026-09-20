import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import WarningBadge from "./WarningBadge";

describe("WarningBadge", () => {
  it("renders nothing when there are no flags", () => {
    const { container } = render(<WarningBadge flags={null} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders nothing for an empty flag string", () => {
    const { container } = render(<WarningBadge flags="" />);
    expect(container).toBeEmptyDOMElement();
  });

  it("labels a duplicate flag", () => {
    render(<WarningBadge flags="possible_duplicate" />);
    expect(screen.getByText("Duplicate")).toBeInTheDocument();
  });

  it("labels any non-duplicate flag as an anomaly", () => {
    render(<WarningBadge flags="price_anomaly" />);
    expect(screen.getByText("Anomaly")).toBeInTheDocument();
  });

  it("renders one badge per comma-joined flag", () => {
    render(<WarningBadge flags="possible_duplicate,price_anomaly" />);
    expect(screen.getByText("Duplicate")).toBeInTheDocument();
    expect(screen.getByText("Anomaly")).toBeInTheDocument();
  });
});
