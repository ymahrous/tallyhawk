import { describe, it, expect, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import FeedbackButton from "./FeedbackButton";
import { renderWithProviders } from "@/test/render";
import { mockApi } from "@/test/api-mock";

describe("FeedbackButton", () => {
  it("has an accessible trigger and keeps the closed panel out of the tab order", () => {
    renderWithProviders(<FeedbackButton />);
    const trigger = screen.getByRole("button", { name: "Send feedback" });
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(document.getElementById("feedback-panel")).toHaveAttribute("inert");
  });

  it("sends the selected type with a sanitized message", async () => {
    const server = mockApi({ "POST /feedback/": { json: {} } });
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
    expect(server.callsTo("POST /feedback/")[0].body).toEqual({
      type: "Bug",
      message: "&lt;b&gt;Upload&lt;/b&gt; broke",
    });
  });

  it("does not claim success when the backend rejects the feedback", async () => {
    mockApi({ "POST /feedback/": { status: 500, json: {} } });
    const alert = vi.spyOn(window, "alert").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
    renderWithProviders(<FeedbackButton />);

    await userEvent.click(screen.getByRole("button", { name: "Send feedback" }));
    await userEvent.type(screen.getByRole("textbox", { name: "Feedback message" }), "Hello");
    await userEvent.click(screen.getByRole("button", { name: "Send" }));

    await waitFor(() =>
      expect(alert).toHaveBeenCalledWith("Failed to send feedback. Please try again.")
    );
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
