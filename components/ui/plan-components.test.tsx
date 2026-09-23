import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import UsageMeter from "./UsageMeter";
import UpgradePrompt from "./UpgradePrompt";
import SyncButton from "./SyncButton";
import CategoryPage from "./CategoryPage";
import PasswordStrengthMeter from "./PasswordStrengthMeter";
import { renderWithProviders } from "@/test/render";
import { accountRoutes, mockApi } from "@/test/api-mock";
import { router } from "@/test/navigation";
import { signIn } from "@/test/auth";

function asPlan(plan: "free" | "pro", used = 3, extraRoutes = {}) {
  signIn({ plan });
  return mockApi({ ...accountRoutes({ plan, used }), ...extraRoutes });
}

describe("UsageMeter", () => {
  it("shows free-tier usage against the limit", async () => {
    asPlan("free", 4);
    renderWithProviders(<UsageMeter />);
    expect(await screen.findByText("4 / 10 documents")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Upgrade for Unlimited Uploads" })).toBeNull();
  });

  it("offers an upgrade once the limit is reached", async () => {
    asPlan("free", 10);
    renderWithProviders(<UsageMeter />);
    await userEvent.click(
      await screen.findByRole("button", { name: "Upgrade for Unlimited Uploads" })
    );
    expect(router.push).toHaveBeenCalledWith("/pricing");
  });

  it("shows the unlimited plan for Pro users", async () => {
    asPlan("pro");
    renderWithProviders(<UsageMeter />);
    expect(screen.getByText("Unlimited Plan")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Manage →" }));
    expect(router.push).toHaveBeenCalledWith("/account");
  });
});

describe("UpgradePrompt", () => {
  it("renders custom copy and links to pricing", async () => {
    renderWithProviders(<UpgradePrompt title="Limit reached" message="You used them all." />);
    expect(screen.getByRole("heading", { name: "Limit reached" })).toBeInTheDocument();
    expect(screen.getByText("You used them all.")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Upgrade to Pro" }));
    expect(router.push).toHaveBeenCalledWith("/pricing");
  });
});

describe("SyncButton", () => {
  it("is locked for free users", () => {
    asPlan("free");
    renderWithProviders(<SyncButton documentId="doc-1" qbConnected initialSyncedStatus={false} />);
    expect(screen.getByRole("button", { name: "Pro" })).toBeDisabled();
  });

  it("asks Pro users to connect QuickBooks first", () => {
    asPlan("pro");
    renderWithProviders(
      <SyncButton documentId="doc-1" qbConnected={false} initialSyncedStatus={false} />
    );
    expect(screen.getByText("Connect QB to sync")).toBeInTheDocument();
  });

  it("verifies status with QuickBooks and shows Synced when already pushed", async () => {
    asPlan("pro", 0, { "GET /quickbooks/sync-status/doc-1": { json: { synced: true } } });
    renderWithProviders(<SyncButton documentId="doc-1" qbConnected initialSyncedStatus={false} />);
    expect(await screen.findByText("Synced")).toBeInTheDocument();
  });

  it("syncs on click", async () => {
    const server = asPlan("pro", 0, {
      "GET /quickbooks/sync-status/doc-1": { json: { synced: false } },
      "POST /quickbooks/sync/doc-1": { json: {} },
    });
    renderWithProviders(<SyncButton documentId="doc-1" qbConnected initialSyncedStatus={false} />);

    await userEvent.click(await screen.findByRole("button", { name: "Sync to QB" }));

    expect(await screen.findByText("Synced")).toBeInTheDocument();
    expect(server.callsTo("POST /quickbooks/sync/doc-1")).toHaveLength(1);
  });

  it("shows the backend error when sync fails", async () => {
    asPlan("pro", 0, {
      "GET /quickbooks/sync-status/doc-1": { json: { synced: false } },
      "POST /quickbooks/sync/doc-1": { status: 400, json: { detail: "QuickBooks token expired" } },
    });
    renderWithProviders(<SyncButton documentId="doc-1" qbConnected initialSyncedStatus={false} />);

    await userEvent.click(await screen.findByRole("button", { name: "Sync to QB" }));

    expect(await screen.findByText("QuickBooks token expired")).toBeInTheDocument();
  });
});

describe("CategoryPage (category editor)", () => {
  it("is read-only for free users", () => {
    asPlan("free");
    renderWithProviders(
      <CategoryPage documentId="doc-1" currentCategory="Travel" onCategoryUpdate={vi.fn()} />
    );
    expect(screen.getByText("Travel")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Travel" })).toBeNull();
  });

  it("lets Pro users recategorize a document", async () => {
    const server = asPlan("pro", 0, { "PATCH /extraction/doc-1/category": { json: {} } });
    const onCategoryUpdate = vi.fn();
    renderWithProviders(
      <CategoryPage
        documentId="doc-1"
        currentCategory="Travel"
        onCategoryUpdate={onCategoryUpdate}
      />
    );

    await userEvent.click(screen.getByRole("button", { name: "Travel" }));
    await userEvent.click(screen.getByRole("button", { name: "Software" }));

    await waitFor(() => expect(onCategoryUpdate).toHaveBeenCalledWith("doc-1", "Software"));
    expect(server.callsTo("PATCH /extraction/doc-1/category")[0].body).toEqual({
      category: "Software",
    });
  });

  it("does nothing when the same category is picked, and defaults to Other", async () => {
    const server = asPlan("pro");
    const onCategoryUpdate = vi.fn();
    renderWithProviders(<CategoryPage documentId="doc-1" onCategoryUpdate={onCategoryUpdate} />);

    await userEvent.click(screen.getByRole("button", { name: "Other" }));
    await userEvent.click(screen.getAllByRole("button", { name: "Other" })[1]);

    expect(onCategoryUpdate).not.toHaveBeenCalled();
    expect(server.callsTo("PATCH /extraction/doc-1/category")).toHaveLength(0);
  });

  it("keeps the old category when the update fails", async () => {
    asPlan("pro", 0, { "PATCH /extraction/doc-1/category": { status: 500, json: {} } });
    vi.spyOn(console, "error").mockImplementation(() => {});
    const onCategoryUpdate = vi.fn();
    renderWithProviders(
      <CategoryPage
        documentId="doc-1"
        currentCategory="Meals"
        onCategoryUpdate={onCategoryUpdate}
      />
    );

    await userEvent.click(screen.getByRole("button", { name: "Meals" }));
    await userEvent.click(screen.getByRole("button", { name: "Rent" }));

    await waitFor(() => expect(console.error).toHaveBeenCalled());
    expect(onCategoryUpdate).not.toHaveBeenCalled();
  });
});

describe("PasswordStrengthMeter", () => {
  it("renders nothing for an empty password", () => {
    const { container } = render(<PasswordStrengthMeter password="" isDark={false} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("fills one segment per strength point and announces the label", () => {
    const { container } = render(<PasswordStrengthMeter password="abcdefgH1" isDark={false} />);
    expect(container.querySelectorAll('[data-filled="true"]')).toHaveLength(3);
    expect(screen.getByText("Fair")).toBeInTheDocument();
    expect(screen.getByText("Password strength:")).toHaveClass("sr-only");
  });
});
