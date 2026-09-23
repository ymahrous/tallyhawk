import { describe, it, expect, vi } from "vitest";
import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import DashboardPage from "./page";
import Loading from "./loading";
import ErrorBoundary from "./error";
import { renderWithProviders } from "@/test/render";
import { accountRoutes, mockApi, type Routes } from "@/test/api-mock";
import { router } from "@/test/navigation";
import { signIn, signInExpired } from "@/test/auth";
import type { Document } from "@/lib/api";

const doc = (id: string, status: Document["status"], filename = `${id}.pdf`): Document => ({
  id,
  filename,
  s3_url: `https://bucket.test/${filename}`,
  status,
  created_at: "2026-09-01T10:00:00Z",
  quickbooks_synced: false,
});

const extraction = (id: string, vendor: string) => ({
  json: {
    document_id: id,
    extracted_data: { vendor, total_amount: "12.50", date: "2026-08-30" },
    confidence_score: 0.97,
    category: "Software",
    original_currency: "USD",
    original_amount: 12.5,
    converted_amount: 12.5,
    converted_currency: "USD",
  },
});

function dashboardApi(documents: Document[], extra: Routes = {}) {
  signIn();
  return mockApi({
    ...accountRoutes({ used: documents.length }),
    "GET /documents/": { json: documents },
    "GET /stats/dashboard": {
      json: { processed: 12, synced: 5, month_spend: 432.1, base_currency: "USD" },
    },
    "GET /quickbooks/status": { json: { connected: false } },
    ...extra,
  });
}

describe("dashboard", () => {
  it("sends signed-out visitors to login", () => {
    signInExpired();
    mockApi();
    renderWithProviders(<DashboardPage />);
    expect(router.push).toHaveBeenCalledWith("/login");
  });

  it("groups documents by status and shows extracted data for completed ones", async () => {
    dashboardApi([doc("a", "COMPLETED"), doc("b", "PROCESSING"), doc("c", "FAILED")], {
      "GET /extraction/a": extraction("a", "Figma"),
    });
    renderWithProviders(<DashboardPage />);

    expect(await screen.findByRole("heading", { name: "Processing (1)" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Failed (1)" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Results (1)" })).toBeInTheDocument();
    expect(await screen.findByText("Figma")).toBeInTheDocument();
  });

  it("shows headline stats in the account's base currency", async () => {
    dashboardApi([]);
    renderWithProviders(<DashboardPage />);
    expect(await screen.findByText("12")).toBeInTheDocument();
    expect(screen.getByText("This Month (USD)")).toBeInTheDocument();
    expect(screen.getByText(/432\.10/)).toBeInTheDocument();
  });

  it("flags spend that is still waiting on currency conversion", async () => {
    dashboardApi([], {
      "GET /stats/dashboard": {
        json: { processed: 1, synced: 0, month_spend: 0, excluded_from_month_spend: 2 },
      },
    });
    renderWithProviders(<DashboardPage />);
    expect(await screen.findByText("2 pending conversion, not included")).toBeInTheDocument();
  });

  it("shows an empty state before the first upload", async () => {
    dashboardApi([]);
    renderWithProviders(<DashboardPage />);
    expect(await screen.findByText("No documents yet")).toBeInTheDocument();
  });

  it("uploads a file and refreshes the list", async () => {
    const server = dashboardApi([], { "POST /upload/": { json: doc("new", "PENDING") } });
    const { container } = renderWithProviders(<DashboardPage />);
    await screen.findByText("No documents yet");

    server.set({ "GET /documents/": { json: [doc("new", "PENDING", "receipt.pdf")] } });
    await userEvent.upload(
      container.querySelector<HTMLInputElement>("#file-upload")!,
      new File(["%PDF"], "receipt.pdf", { type: "application/pdf" })
    );

    expect(await screen.findByText("receipt.pdf", { selector: "span" })).toBeInTheDocument();
    expect(server.callsTo("POST /upload/")).toHaveLength(1);
  });

  it("prompts an upgrade when the free limit is reached", async () => {
    dashboardApi([], {
      "POST /upload/": { status: 403, json: { detail: { error: "limit_exceeded" } } },
    });
    const { container } = renderWithProviders(<DashboardPage />);
    await screen.findByText("No documents yet");

    await userEvent.upload(
      container.querySelector<HTMLInputElement>("#file-upload")!,
      new File(["%PDF"], "r.pdf", { type: "application/pdf" })
    );

    expect(
      await screen.findByRole("heading", { name: "Free Tier Limit Reached" })
    ).toBeInTheDocument();
  });

  it("reports generic upload and validation failures", async () => {
    dashboardApi([], { "POST /upload/": { status: 500, json: {} } });
    const { container } = renderWithProviders(<DashboardPage />);
    await screen.findByText("No documents yet");
    const input = container.querySelector<HTMLInputElement>("#file-upload")!;

    await userEvent.upload(input, new File(["%PDF"], "r.pdf", { type: "application/pdf" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Upload failed. Please try again.");

    await userEvent.click(screen.getByRole("button", { name: "Dismiss error" }));
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("deletes a failed document", async () => {
    const server = dashboardApi([doc("bad", "FAILED")], {
      "DELETE /documents/bad": { status: 204 },
    });
    renderWithProviders(<DashboardPage />);
    await screen.findByRole("heading", { name: "Failed (1)" });

    server.set({ "GET /documents/": { json: [] } });
    await userEvent.click(screen.getByRole("button", { name: "Delete document" }));

    await waitFor(() => expect(screen.queryByRole("heading", { name: "Failed (1)" })).toBeNull());
    expect(server.callsTo("DELETE /documents/bad")).toHaveLength(1);
  });

  it("explains when a delete fails", async () => {
    dashboardApi([doc("bad", "FAILED")], { "DELETE /documents/bad": { status: 500, json: {} } });
    renderWithProviders(<DashboardPage />);
    await userEvent.click(await screen.findByRole("button", { name: "Delete document" }));
    expect(
      await screen.findByText("Failed to delete document. Please try again.")
    ).toBeInTheDocument();
  });

  it("paginates completed documents ten at a time", async () => {
    const docs = Array.from({ length: 12 }, (_, i) => doc(`d${i}`, "COMPLETED", `doc-${i}.pdf`));
    const routes = Object.fromEntries(
      docs.map((d) => [`GET /extraction/${d.id}`, extraction(d.id, `Vendor ${d.id}`)])
    );
    dashboardApi(docs, routes);
    renderWithProviders(<DashboardPage />);

    expect(await screen.findByText("Page 1 of 2")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Previous" })).toBeDisabled();
    await userEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByText("Page 2 of 2")).toBeInTheDocument();
    expect(screen.getByText("doc-11.pdf")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Next" })).toBeDisabled();
  });

  it("polls quickly while documents are processing", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const server = dashboardApi([doc("p", "PROCESSING")]);
    renderWithProviders(<DashboardPage />);
    await screen.findByRole("heading", { name: "Processing (1)" });
    const before = server.callsTo("GET /documents/").length;

    await act(() => vi.advanceTimersByTimeAsync(3100));

    expect(server.callsTo("GET /documents/").length).toBeGreaterThan(before);
  });

  it("switches to fast polling right after an upload (regression: it waited out the 30s idle interval)", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const server = dashboardApi([], { "POST /upload/": { json: doc("new", "PENDING") } });
    const { container } = renderWithProviders(<DashboardPage />);
    await screen.findByText("No documents yet");

    server.set({ "GET /documents/": { json: [doc("new", "PROCESSING", "receipt.pdf")] } });
    await userEvent.upload(
      container.querySelector<HTMLInputElement>("#file-upload")!,
      new File(["%PDF"], "receipt.pdf", { type: "application/pdf" })
    );
    await screen.findByRole("heading", { name: "Processing (1)" });

    server.set({
      "GET /documents/": { json: [doc("new", "COMPLETED", "receipt.pdf")] },
      "GET /extraction/new": extraction("new", "Hetzner"),
    });
    await act(() => vi.advanceTimersByTimeAsync(3100));

    expect(await screen.findByText("Hetzner")).toBeInTheDocument();
  });

  it("links to mobile capture", async () => {
    dashboardApi([]);
    renderWithProviders(<DashboardPage />);
    expect(await screen.findByRole("link", { name: "Mobile Capture" })).toHaveAttribute(
      "href",
      "/capture"
    );
  });

  it("shows a reconversion notice after the base currency changes", async () => {
    dashboardApi([]);
    renderWithProviders(<DashboardPage />);
    await screen.findByText("No documents yet");

    act(() => {
      window.dispatchEvent(
        new CustomEvent("tallyhawk:currency-changed", { detail: { currency: "EUR" } })
      );
    });

    expect(
      screen.getByText(/updating your existing documents to the new currency/)
    ).toBeInTheDocument();
  });
});

describe("dashboard loading and error states", () => {
  it("renders a skeleton while loading", () => {
    const { container } = renderWithProviders(<Loading />);
    expect(container.querySelectorAll(".animate-pulse").length).toBeGreaterThan(3);
  });

  it("offers retry and a way home from the error boundary", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const reset = vi.fn();
    renderWithProviders(<ErrorBoundary error={new Error("Backend unavailable")} reset={reset} />);

    expect(screen.getByText("Backend unavailable")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(reset).toHaveBeenCalledOnce();
    await userEvent.click(screen.getByRole("button", { name: "← Home" }));
    expect(router.push).toHaveBeenCalledWith("/");
  });

  it("falls back to a generic message", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    renderWithProviders(<ErrorBoundary error={new Error("")} reset={vi.fn()} />);
    expect(
      within(document.body).getByText("An unexpected error occurred. Please try again.")
    ).toBeInTheDocument();
  });
});
