import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import LoginPage from "./login/page";
import SignupPage from "./signup/page";
import ForgotPasswordPage from "./forgot-password/page";
import ResetPasswordPage from "./reset-password/page";
import { renderWithProviders } from "@/test/render";
import { accountRoutes, mockApi } from "@/test/api-mock";
import { router, setSearchParams } from "@/test/navigation";
import { makeToken, signIn } from "@/test/auth";

// jsdom doesn't implement navigation; after a successful login the pages call location.reload().
beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation((...args: unknown[]) => {
    if (String(args[0]).includes("Not implemented: navigation")) return;
    throw new Error(String(args[0]));
  });
});

const field = (name: RegExp | string) => screen.getByLabelText(name);

describe("login page", () => {
  it("redirects visitors who are already signed in", () => {
    signIn();
    mockApi(accountRoutes());
    renderWithProviders(<LoginPage />);
    expect(router.push).toHaveBeenCalledWith("/app");
  });

  it("signs in and stores the token", async () => {
    const token = makeToken();
    const server = mockApi({
      "POST /auth/login": { json: { access_token: token } },
      ...accountRoutes(),
    });
    renderWithProviders(<LoginPage />);

    await userEvent.type(field("Email address"), "  ada@example.com ");
    await userEvent.type(field("Password"), "Secret123");
    await userEvent.click(screen.getByRole("button", { name: "Continue" }));

    await waitFor(() => expect(localStorage.getItem("token")).toBe(token));
    expect(server.callsTo("POST /auth/login")[0].body).toEqual({
      username: "ada@example.com",
      password: "Secret123",
    });
  });

  it("validates the email inline and keeps the button disabled", async () => {
    renderWithProviders(<LoginPage />);
    await userEvent.type(field("Email address"), "ada@");
    await userEvent.type(field("Password"), "Secret123");

    expect(screen.getByRole("alert")).toHaveTextContent("Please enter a valid email address.");
    expect(field("Email address")).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByRole("button", { name: "Continue" })).toBeDisabled();
  });

  it("does not get stuck on 'Signing in...' when the email is invalid (regression)", async () => {
    const server = mockApi();
    renderWithProviders(<LoginPage />);
    // Whitespace passes the per-keystroke check but fails once trimmed at submit time.
    await userEvent.type(field("Email address"), "ada@example.com");
    fireEvent.change(field("Email address"), { target: { value: "   " } });
    await userEvent.type(field("Password"), "Secret123");
    fireEvent.submit(field("Password").closest("form")!);

    expect(await screen.findByText("Email is required.")).toBeInTheDocument();
    expect(screen.queryByText("Signing in...")).toBeNull();
    expect(server.requests).toHaveLength(0);
  });

  it("shows the backend error on bad credentials", async () => {
    mockApi({
      "POST /auth/login": { status: 401, json: { detail: "Incorrect email or password" } },
    });
    renderWithProviders(<LoginPage />);

    await userEvent.type(field("Email address"), "ada@example.com");
    await userEvent.type(field("Password"), "wrong");
    await userEvent.click(screen.getByRole("button", { name: "Continue" }));

    expect(await screen.findByText("Incorrect email or password")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Continue" })).toBeEnabled();
  });

  it("locks the form for 30 seconds after five failed attempts", async () => {
    mockApi({
      "POST /auth/login": { status: 401, json: { detail: "Incorrect email or password" } },
    });
    renderWithProviders(<LoginPage />);
    await userEvent.type(field("Email address"), "ada@example.com");
    await userEvent.type(field("Password"), "wrong");

    for (let attempt = 1; attempt <= 5; attempt++) {
      await userEvent.click(screen.getByRole("button", { name: /Continue|Locked/ }));
      await waitFor(() =>
        expect(screen.getByRole("button", { name: /Continue|Locked/ })).not.toHaveTextContent(
          "Signing in..."
        )
      );
    }

    expect(
      screen.getByText("Too many failed attempts. Please wait 30 seconds.")
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Locked \(\d+s\)/ })).toBeDisabled();
  });

  it("toggles password visibility and links to recovery and signup", async () => {
    renderWithProviders(<LoginPage />);
    expect(field("Password")).toHaveAttribute("type", "password");
    await userEvent.click(screen.getByRole("button", { name: "Show password" }));
    expect(field("Password")).toHaveAttribute("type", "text");
    expect(screen.getByRole("link", { name: "Forgot password?" })).toHaveAttribute(
      "href",
      "/forgot-password"
    );
    expect(screen.getByRole("link", { name: "Sign up" })).toHaveAttribute("href", "/signup");
  });
});

describe("signup page", () => {
  async function fillValidForm(password = "Secret123", confirm = password) {
    await userEvent.type(field("Email address"), "ada@example.com");
    await userEvent.type(field(/^Password$/), password);
    await userEvent.type(field("Confirm password"), confirm);
  }

  it("requires terms acceptance before enabling submit", async () => {
    renderWithProviders(<SignupPage />);
    await fillValidForm();
    const submit = screen.getByRole("button", { name: "Create account" });
    expect(submit).toBeDisabled();

    await userEvent.click(screen.getByRole("checkbox"));
    expect(submit).toBeEnabled();
  });

  it("creates the account and stores the token", async () => {
    const token = makeToken();
    const server = mockApi({
      "POST /auth/signup": { json: { access_token: token } },
      ...accountRoutes(),
    });
    renderWithProviders(<SignupPage />);
    await fillValidForm();
    await userEvent.click(screen.getByRole("checkbox"));
    await userEvent.click(screen.getByRole("button", { name: "Create account" }));

    await waitFor(() => expect(localStorage.getItem("token")).toBe(token));
    expect(server.callsTo("POST /auth/signup")).toHaveLength(1);
    expect(screen.getByRole("button", { name: "Creating account..." })).toBeDisabled();
  });

  it("shows password policy errors and a live strength meter", async () => {
    renderWithProviders(<SignupPage />);
    await userEvent.type(field(/^Password$/), "short");
    expect(screen.getByText("Password must be at least 8 characters.")).toBeInTheDocument();
    expect(screen.getByText("Very weak")).toBeInTheDocument();

    await userEvent.clear(field(/^Password$/));
    await userEvent.type(field(/^Password$/), "abcdefghijK1!");
    expect(screen.getByText("Very strong")).toBeInTheDocument();
    expect(screen.queryByText(/Password must/)).toBeNull();
  });

  it("keeps submit disabled while the passwords differ", async () => {
    renderWithProviders(<SignupPage />);
    await fillValidForm("Secret123", "Secret124");
    await userEvent.click(screen.getByRole("checkbox"));
    expect(screen.getByRole("button", { name: "Create account" })).toBeDisabled();
  });

  it("re-enables the form after a failed signup (regression: it stayed on 'Creating account...')", async () => {
    mockApi({ "POST /auth/signup": { status: 400, json: { detail: "Email already registered" } } });
    renderWithProviders(<SignupPage />);
    await fillValidForm();
    await userEvent.click(screen.getByRole("checkbox"));
    await userEvent.click(screen.getByRole("button", { name: "Create account" }));

    expect(await screen.findByText("Email already registered")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Create account" })).toBeEnabled();
  });

  it("locks signup for 30 seconds after five failures, then unlocks", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    mockApi({ "POST /auth/signup": { status: 400, json: { detail: "Email already registered" } } });
    renderWithProviders(<SignupPage />);
    await fillValidForm();
    await userEvent.click(screen.getByRole("checkbox"));

    for (let attempt = 1; attempt <= 5; attempt++) {
      await userEvent.click(screen.getByRole("button", { name: /Create account|Locked/ }));
      await waitFor(() =>
        expect(screen.getByRole("button", { name: /Create account|Locked/ })).not.toHaveTextContent(
          "Creating account..."
        )
      );
    }

    expect(
      screen.getByText("Too many failed attempts. Please wait 30 seconds.")
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Locked \(\d+s\)/ })).toBeDisabled();

    await act(() => vi.advanceTimersByTimeAsync(31_000));
    expect(screen.getByRole("button", { name: "Create account" })).toBeEnabled();
  });

  it("opens the legal pages in a new tab from the consent label", () => {
    renderWithProviders(<SignupPage />);
    expect(screen.getByRole("link", { name: "Terms of Service" })).toHaveAttribute(
      "target",
      "_blank"
    );
    expect(screen.getByRole("link", { name: "Privacy Policy" })).toHaveAttribute(
      "href",
      "/privacy"
    );
  });
});

describe("forgot password page", () => {
  it("confirms the request without revealing whether the account exists", async () => {
    const server = mockApi({ "POST /auth/forgot-password": { json: {} } });
    renderWithProviders(<ForgotPasswordPage />);

    await userEvent.type(field("Email address"), "ada@example.com");
    await userEvent.click(screen.getByRole("button", { name: "Send Reset Link" }));

    expect(await screen.findByRole("status")).toHaveTextContent(
      "If an account with that email exists"
    );
    expect(server.callsTo("POST /auth/forgot-password")[0].body).toEqual({
      email: "ada@example.com",
    });
  });

  it("shows a friendly error when the request fails", async () => {
    mockApi({ "POST /auth/forgot-password": { status: 500, json: {} } });
    renderWithProviders(<ForgotPasswordPage />);
    await userEvent.type(field("Email address"), "ada@example.com");
    await userEvent.click(screen.getByRole("button", { name: "Send Reset Link" }));
    expect(
      await screen.findByText("Unable to request reset. Please try again later.")
    ).toBeInTheDocument();
  });

  it("does not get stuck on 'Sending...' when the trimmed email is empty (regression)", async () => {
    const server = mockApi();
    renderWithProviders(<ForgotPasswordPage />);
    await userEvent.type(field("Email address"), "ada@example.com");
    fireEvent.change(field("Email address"), { target: { value: "  " } });
    fireEvent.submit(field("Email address").closest("form")!);

    expect(await screen.findByText("Email is required.")).toBeInTheDocument();
    expect(screen.queryByText("Sending...")).toBeNull();
    expect(server.requests).toHaveLength(0);
  });
});

describe("reset password page", () => {
  it("explains a missing token and disables the form", () => {
    renderWithProviders(<ResetPasswordPage />);
    expect(screen.getByRole("alert")).toHaveTextContent("Invalid or missing reset token.");
    expect(screen.getByRole("button", { name: "Reset Password" })).toBeDisabled();
  });

  it("resets the password and sends the user to login", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    setSearchParams({ token: "tok-123" });
    const server = mockApi({ "POST /auth/reset-password": { json: {} } });
    renderWithProviders(<ResetPasswordPage />);

    await userEvent.type(field("New password"), "NewSecret1");
    await userEvent.type(field("Confirm new password"), "NewSecret1");
    await userEvent.click(screen.getByRole("button", { name: "Reset Password" }));

    expect(
      await screen.findByText("Password updated! Redirecting to login...")
    ).toBeInTheDocument();
    expect(server.callsTo("POST /auth/reset-password")[0].body).toEqual({
      token: "tok-123",
      new_password: "NewSecret1",
    });

    await act(() => vi.advanceTimersByTimeAsync(2000));
    expect(router.push).toHaveBeenCalledWith("/login");
  });

  it("surfaces an expired-link error from the backend", async () => {
    setSearchParams({ token: "old" });
    mockApi({
      "POST /auth/reset-password": { status: 400, json: { detail: "Reset link expired" } },
    });
    renderWithProviders(<ResetPasswordPage />);

    await userEvent.type(field("New password"), "NewSecret1");
    await userEvent.type(field("Confirm new password"), "NewSecret1");
    await userEvent.click(screen.getByRole("button", { name: "Reset Password" }));

    expect(await screen.findByText("Reset link expired")).toBeInTheDocument();
  });

  it("enforces the password policy", async () => {
    setSearchParams({ token: "tok" });
    renderWithProviders(<ResetPasswordPage />);
    await userEvent.type(field("New password"), "alllowercase1");
    expect(
      screen.getByText("Password must contain at least one uppercase letter.")
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reset Password" })).toBeDisabled();
  });
});
