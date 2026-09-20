import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import PasswordToggle from "./PasswordToggle";

describe("PasswordToggle", () => {
  it("offers to show the password while it is hidden", () => {
    render(<PasswordToggle show={false} onToggle={() => {}} isDark={false} />);
    expect(screen.getByRole("button", { name: "Show password" })).toBeInTheDocument();
  });

  it("offers to hide the password while it is visible", () => {
    render(<PasswordToggle show onToggle={() => {}} isDark={false} />);
    expect(screen.getByRole("button", { name: "Hide password" })).toBeInTheDocument();
  });

  it("calls onToggle when clicked", async () => {
    const onToggle = vi.fn();
    render(<PasswordToggle show={false} onToggle={onToggle} isDark={false} />);

    await userEvent.click(screen.getByRole("button", { name: "Show password" }));

    expect(onToggle).toHaveBeenCalledOnce();
  });

  it("stays type=button so it never submits the surrounding form", () => {
    render(<PasswordToggle show={false} onToggle={() => {}} isDark={false} />);
    expect(screen.getByRole("button")).toHaveAttribute("type", "button");
  });
});
