import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import DocumentCard from "./DocumentCard";
import type { Document, Extraction } from "@/lib/api";

// These children talk to the backend on mount; the card's own rendering is what's under test.
vi.mock("@/components/ui/SyncButton", () => ({ default: () => <div data-testid="sync-button" /> }));
vi.mock("@/components/ui/CategoryPage", () => ({ default: () => <div data-testid="category" /> }));

const doc: Document = {
  id: "doc-1",
  filename: "invoice.pdf",
  s3_url: "https://example.test/invoice.pdf",
  status: "COMPLETED",
  created_at: "2026-01-15T10:00:00Z",
  quickbooks_synced: false,
};

function baseExtraction(overrides: Partial<Extraction> = {}): Extraction {
  return {
    document_id: "doc-1",
    extracted_data: { vendor: "AMZN", total_amount: "37.70", date: "2026-01-14" },
    confidence_score: 0.98,
    ...overrides,
  };
}

const noop = () => {};

function renderCard(ext: Extraction | undefined) {
  return render(
    <DocumentCard
      doc={doc}
      ext={ext}
      qbConnected={false}
      isDeleting={false}
      onCategoryUpdate={noop}
      onDelete={noop}
    />
  );
}

describe("DocumentCard vendor name", () => {
  it("prefers the normalized vendor over the raw extracted string", () => {
    renderCard(
      baseExtraction({
        vendor: { id: "v1", canonical_name: "Amazon", aliases: ["AMZN"] },
      })
    );
    expect(screen.getByText("Amazon")).toBeInTheDocument();
    expect(screen.queryByText("AMZN")).not.toBeInTheDocument();
  });

  it("falls back to the raw extracted vendor when there is no normalized record", () => {
    renderCard(baseExtraction());
    expect(screen.getByText("AMZN")).toBeInTheDocument();
  });

  it("shows Unknown when there is no vendor at all", () => {
    renderCard(
      baseExtraction({
        extracted_data: { vendor: "", total_amount: "0", date: "2026-01-14" },
      })
    );
    expect(screen.getByText("Unknown")).toBeInTheDocument();
  });
});

describe("DocumentCard amount display", () => {
  it("shows both amounts and the rate when a conversion happened", () => {
    renderCard(
      baseExtraction({
        original_currency: "EUR",
        original_amount: 37.7,
        converted_amount: 40.9,
        converted_currency: "USD",
        exchange_rate: 1.0849,
      })
    );

    expect(screen.getByText(/37\.70/)).toBeInTheDocument();
    expect(screen.getByText(/40\.90/)).toBeInTheDocument();
    expect(screen.getByText(/Rate: 1 EUR = 1\.0849 USD/)).toBeInTheDocument();
  });

  it("labels the amount as pending when the backend could not convert it", () => {
    renderCard(
      baseExtraction({
        original_currency: "EUR",
        original_amount: 37.7,
        converted_amount: null,
        converted_currency: null,
        exchange_rate: null,
      })
    );

    expect(screen.getByText("Conversion pending")).toBeInTheDocument();
    expect(screen.getByText(/37\.70/)).toBeInTheDocument();
    expect(screen.queryByText(/Rate:/)).not.toBeInTheDocument();
  });

  it("renders a single figure when the document is already in the converted currency", () => {
    renderCard(
      baseExtraction({
        original_currency: "USD",
        original_amount: 37.7,
        converted_amount: 37.7,
        converted_currency: "USD",
        exchange_rate: 1,
      })
    );

    expect(screen.queryByText(/→/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Rate:/)).not.toBeInTheDocument();
    expect(screen.getByText(/37\.70/)).toBeInTheDocument();
  });

  it("trusts converted_currency rather than assuming the account's base currency", () => {
    renderCard(
      baseExtraction({
        original_currency: "EUR",
        original_amount: 100,
        converted_amount: 86.5,
        converted_currency: "GBP",
        exchange_rate: 0.865,
      })
    );

    expect(screen.getByText(/Rate: 1 EUR = 0\.8650 GBP/)).toBeInTheDocument();
  });

  it("falls back to the raw extracted total when currency fields are absent", () => {
    renderCard(baseExtraction());
    expect(screen.getByText("37.70")).toBeInTheDocument();
  });
});

describe("DocumentCard flags", () => {
  it("renders a badge for each flag the backend reports", () => {
    render(
      <DocumentCard
        doc={{ ...doc, flags: "possible_duplicate,price_anomaly" }}
        ext={baseExtraction()}
        qbConnected={false}
        isDeleting={false}
        onCategoryUpdate={noop}
        onDelete={noop}
      />
    );

    expect(screen.getByText("Duplicate")).toBeInTheDocument();
    expect(screen.getByText("Anomaly")).toBeInTheDocument();
  });
});

describe("DocumentCard dates, previews and actions", () => {
  it("labels today's and yesterday's documents relatively", () => {
    const today = new Date();
    const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
    render(
      <DocumentCard
        doc={{ ...doc, created_at: today.toISOString() }}
        ext={baseExtraction({ extracted_data: { vendor: "AMZN", total_amount: "1", date: yesterday.toISOString() } })}
        qbConnected={false}
        isDeleting={false}
        onCategoryUpdate={noop}
        onDelete={noop}
      />
    );
    expect(screen.getByText("Today")).toBeInTheDocument();
    expect(screen.getByText("Yesterday")).toBeInTheDocument();
  });

  it("formats older dates and guards against missing or invalid ones", () => {
    render(
      <DocumentCard
        doc={{ ...doc, created_at: "not-a-date" }}
        ext={baseExtraction({ extracted_data: { vendor: "AMZN", total_amount: "1", date: "" } })}
        qbConnected={false}
        isDeleting={false}
        onCategoryUpdate={noop}
        onDelete={noop}
      />
    );
    expect(screen.getByText("Invalid Date")).toBeInTheDocument();
    expect(screen.getByText("N/A")).toBeInTheDocument();

    render(<DocumentCard doc={{ ...doc, created_at: "2025-03-04T12:00:00Z" }} ext={undefined} qbConnected={false} isDeleting={false} onCategoryUpdate={noop} onDelete={noop} />);
    expect(screen.getByText("March 4, 2025")).toBeInTheDocument();
  });

  it("previews image documents and falls back to an icon for PDFs", () => {
    const { container } = render(
      <DocumentCard doc={{ ...doc, filename: "receipt.jpg", s3_url: "https://bucket.test/receipt.jpg" }} ext={undefined} qbConnected={false} isDeleting={false} onCategoryUpdate={noop} onDelete={noop} />
    );
    expect(screen.getByRole("img", { name: "receipt.jpg" })).toHaveAttribute("src", "https://bucket.test/receipt.jpg");
    expect(container.querySelector("[data-testid='category']")).toBeNull();
  });

  it("deletes the document and disables the button while deleting", async () => {
    const onDelete = vi.fn();
    const { rerender } = render(<DocumentCard doc={doc} ext={baseExtraction()} qbConnected={false} isDeleting={false} onCategoryUpdate={noop} onDelete={onDelete} />);

    screen.getByRole("button", { name: "Delete" }).click();
    expect(onDelete).toHaveBeenCalledWith("doc-1");

    rerender(<DocumentCard doc={doc} ext={baseExtraction()} qbConnected={false} isDeleting onCategoryUpdate={noop} onDelete={onDelete} />);
    expect(screen.getByRole("button", { name: "Delete" })).toBeDisabled();
  });
});
