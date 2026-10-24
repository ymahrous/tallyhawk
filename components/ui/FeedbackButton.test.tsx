import { describe, it, expect } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import FeedbackButton from "./FeedbackButton";
import { renderWithProviders } from "@/test/render";
import { mockApi } from "@/test/api-mock";
import { signIn } from "@/test/auth";
import { setPathname } from "@/test/navigation";

describe("FeedbackButton", () => {
  it("has an accessible trigger and keeps the closed panel out of the tab order", () => {
    renderWithProviders(<FeedbackButton />);
    const trigger = screen.getByRole("button", { name: "Send feedback" });
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(document.getElementById("feedback-panel")).toHaveAttribute("inert");
  });

  it("sends the selected type and the message as written, with the page it came from", async () => {
    setPathname("/analytics");
    const server = mockApi({ "POST /feedback": { json: {} } });
    renderWithProviders(<FeedbackButton />);

    await userEvent.click(screen.getByRole("button", { name: "Send feedback" }));
    await userEvent.click(screen.getByRole("button", { name: "Bug" }));
    expect(screen.getByRole("button", { name: "Bug" })).toHaveAttribute("aria-pressed", "true");
    await userEvent.type(
      screen.getByRole("textbox", { name: "Feedback message" }),
      "  <b>Upload</b> broke  "
    );
    await userEvent.click(screen.getByRole("button", { name: "Send" }));

    await waitFor(() => expect(screen.getByRole("button", { name: "Sent!" })).toBeInTheDocument());
    // Regression: the widget HTML-escaped messages, so admins read "&lt;b&gt;". React escapes on display.
    expect(server.callsTo("POST /feedback")[0].body).toEqual({
      type: "Bug",
      message: "<b>Upload</b> broke",
      page: "/analytics",
    });
    // Signed out: nothing links the feedback to an account.
    expect(server.callsTo("POST /feedback")[0].headers.get("authorization")).toBeNull();
  });

  it("links a signed-in customer's feedback to their account", async () => {
    const token = signIn();
    const server = mockApi({ "POST /feedback": { json: {} } });
    renderWithProviders(<FeedbackButton />);
    await userEvent.click(screen.getByRole("button", { name: "Send feedback" }));
    await userEvent.type(screen.getByRole("textbox", { name: "Feedback message" }), "Love it");
    await userEvent.click(screen.getByRole("button", { name: "Send" }));
    await waitFor(() => expect(server.callsTo("POST /feedback")).toHaveLength(1));
    expect(server.callsTo("POST /feedback")[0].headers.get("authorization")).toBe(`Bearer ${token}`);
  });

  it("isn't offered to admins or on admin pages", () => {
    signIn({ role: "admin" });
    const { container } = renderWithProviders(<FeedbackButton />);
    expect(container.querySelector("#feedback-panel")).toBeNull();
    localStorage.clear();
    setPathname("/admin/users");
    renderWithProviders(<FeedbackButton />);
    expect(screen.queryByRole("button", { name: "Send feedback" })).toBeNull();
  });

  it("does not claim success when the backend rejects the feedback", async () => {
    mockApi({ "POST /feedback": { status: 429, json: { detail: "Too many requests. Please try again later." } } });
    renderWithProviders(<FeedbackButton />);

    await userEvent.click(screen.getByRole("button", { name: "Send feedback" }));
    await userEvent.type(screen.getByRole("textbox", { name: "Feedback message" }), "Hello");
    await userEvent.click(screen.getByRole("button", { name: "Send" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Too many requests. Please try again later.");
    expect(screen.queryByRole("button", { name: "Sent!" })).toBeNull();
  });

  it("keeps Send disabled for whitespace-only input and closes on Cancel", async () => {
    renderWithProviders(<FeedbackButton />);
    await userEvent.click(screen.getByRole("button", { name: "Send feedback" }));
    await userEvent.type(screen.getByRole("textbox", { name: "Feedback message" }), "   ");
    expect(screen.getByRole("button", { name: "Send" })).toBeDisabled();

    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.getByRole("button", { name: "Send feedback", hidden: true })).toHaveAttribute(
      "aria-expanded",
      "false"
    );
  });
});
