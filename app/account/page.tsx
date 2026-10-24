"use client";

import { useState, useEffect } from "react";
import { changePassword, exportTaxSummary, logoutEverywhere, openBillingPortal } from "@/lib/api";
import { usePlan } from "../providers/PlanContext";
import { useTheme } from "@/app/providers/ThemeContext";
import { useSettings } from "@/app/providers/SettingsContext";
import { useRouter, useSearchParams } from "next/navigation";
import { getQuickBooksConnectUrl, getQuickBooksStatus } from "@/lib/api";
import { logout, decodeToken, disconnectQuickBooks } from "@/lib/api";
import { useAuthGuard } from "@/lib/useAuthGuard";
import { SUPPORTED_CURRENCIES, CurrencyCode } from "@/lib/currency";
import { PRODUCT_FACTS } from "@/lib/site";
import DeleteAccountSection from "@/components/account/DeleteAccountSection";
import InstallAppButton from "@/components/pwa/InstallAppButton";
import { useInstallApp } from "@/lib/useInstallApp";
import { validatePassword } from "@/lib/validation";

// ─── Sub-components ────────────────────────────────────────────────────────────
function SectionCard({
  title,
  description,
  children,
  isDark,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
  isDark: boolean;
}) {
  return (
    <div className={`rounded-2xl border p-8 ${
      isDark ? "bg-white/5 border-white/10" : "bg-white border-gray-200"
    }`}>
      <div className="mb-6">
        <h2 className={`text-base font-semibold ${isDark ? "text-white" : "text-gray-900"}`}>
          {title}
        </h2>
        <p className={`text-sm mt-1 ${isDark ? "text-gray-400" : "text-gray-500"}`}>
          {description}
        </p>
      </div>
      {children}
    </div>
  );
}

function InputField({
  label,
  type = "text",
  value,
  onChange,
  placeholder,
  disabled = false,
  error,
  isDark,
}: {
  label: string;
  type?: string;
  value: string;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
  disabled?: boolean;
  error?: string;
  isDark: boolean;
}) {
  const [showPassword, setShowPassword] = useState(false);
  const isPassword = type === "password";
  const inputType = isPassword && showPassword ? "text" : type;
  const inputId = `field-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")}`;
  const errorId = `${inputId}-error`;

  return (
    <div className="space-y-1.5">
      <label htmlFor={inputId} className={`text-xs font-medium uppercase tracking-wider ${
        isDark ? "text-gray-400" : "text-gray-500"
      }`}>
        {label}
      </label>

      <div className="relative flex items-center">
        <input
          id={inputId}
          type={inputType}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          disabled={disabled}
          aria-invalid={!!error}
          aria-describedby={error ? errorId : undefined}
          className={`w-full text-sm px-4 py-3 rounded-xl border outline-none transition-colors ${
            isPassword ? "pr-12" : ""
          } ${
            disabled
              ? isDark
                ? "bg-white/5 border-white/5 text-gray-500 cursor-not-allowed"
                : "bg-gray-50 border-gray-200 text-gray-400 cursor-not-allowed"
              : isDark
              ? "bg-white/5 border-white/10 text-white focus:border-indigo-500"
              : "bg-white border-gray-200 text-gray-900 focus:border-indigo-500"
          }`}
        />

        {isPassword && !disabled && (
          <button
            type="button"
            onClick={() => setShowPassword((prev) => !prev)}
            className={`absolute right-3 p-1 rounded-md transition-colors ${
              isDark
                ? "text-gray-500 hover:text-white"
                : "text-gray-400 hover:text-gray-900"
            }`}
            aria-label={showPassword ? "Hide password" : "Show password"}
          >
            {showPassword ? (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            )}
          </button>
        )}
      </div>

      {error && <p id={errorId} role="alert" className="text-xs text-red-500">{error}</p>}
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function AccountPage() {
  const router = useRouter();
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const searchParams = useSearchParams();
  const { plan: currentPlan, lastRenewalDate, currentPeriodEnd, subscriptionStatus, cancelAtPeriodEnd, canManageBilling } = usePlan();

  // ── Auth guard (customers only; admins have their own account page) ──
  const isAuthenticated = useAuthGuard("user");
  const [accountEmail, setAccountEmail] = useState("");
  const [sessionExpiry, setSessionExpiry] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [passwordSuccess, setPasswordSuccess] = useState("");
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [qbConnected, setQbConnected] = useState(false);
  const [isConnectingQb, setIsConnectingQb] = useState(false);
  const [qbStatusMessage, setQbStatusMessage] = useState("");
  const [isDisconnectingQb, setIsDisconnectingQb] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportYear, setExportYear] = useState(new Date().getFullYear());
  const [currencyError, setCurrencyError] = useState("");
  const [currencySuccess, setCurrencySuccess] = useState("");
  const [isUpdatingCurrency, setIsUpdatingCurrency] = useState(false);

  const { baseCurrency, createdAt, updateBaseCurrency } = useSettings();
  const installState = useInstallApp();
  // From the account itself (GET /auth/settings), not the session token: a token's issue time is
  // when you last signed in, not when you joined.
  const memberSince = createdAt
    ? new Date(createdAt).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })
    : "";

  const primaryBtnClass = isDark
    ? "bg-white text-black hover:bg-white/80"
    : "bg-black text-white hover:bg-black/80";

  const handleExport = async () => {
    setIsExporting(true);
    try {
      await exportTaxSummary(exportYear);
    } catch {
      alert("Failed to export tax summary.");
    }
    setIsExporting(false);
  };

  // ── Password change ──
  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError("");
    setPasswordSuccess("");

    const validationError = validatePassword(newPassword);
    if (validationError) {
      setPasswordError(validationError);
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setPasswordError("Passwords do not match.");
      return;
    }

    setIsChangingPassword(true);
    try {
      await changePassword(currentPassword, newPassword);
      setPasswordSuccess("Password updated successfully.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmNewPassword("");
    } catch (err: unknown) {
      setPasswordError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handleCurrencyChange = async (currency: CurrencyCode) => {
    setIsUpdatingCurrency(true);
    setCurrencyError("");
    setCurrencySuccess("");
    try {
      await updateBaseCurrency(currency);
      setCurrencySuccess("Currency updated! We're updating your existing documents to match — this may take a few seconds.");
    } catch (err: unknown) {
      setCurrencyError(err instanceof Error ? err.message : "Failed to update currency");
    } finally {
      setIsUpdatingCurrency(false);
    }
  };

  // Session details and QuickBooks status, once the guard has let us in
  useEffect(() => {
    if (!isAuthenticated) return;
    const payload = decodeToken();
    if (!payload) return;

    setAccountEmail(payload.sub);
    setSessionExpiry(new Date(payload.exp * 1000).toLocaleString());

    // Fetch QuickBooks Status
    const fetchQbStatus = async () => {
      try {
        const status = await getQuickBooksStatus();
        setQbConnected(status.connected);
      } catch {}
    };
    fetchQbStatus();

    // --- CHECK FOR QB CALLBACK MESSAGES ---
    if (searchParams.get("qb_success") === "true") {
      setQbStatusMessage("QuickBooks connected successfully!");
      setQbConnected(true); // Optimistically update UI
      // Clean URL without reloading
      router.replace("/account"); 
    } else if (searchParams.get("qb_error")) {
      setQbStatusMessage("Failed to connect QuickBooks. Please try again.");
      router.replace("/account");
    }
  }, [isAuthenticated, router, searchParams]);

  // ── Billing (Stripe Customer Portal: card, invoices, cancellation) ──
  const [isOpeningPortal, setIsOpeningPortal] = useState(false);
  const [billingError, setBillingError] = useState("");
  const handleManageBilling = async () => {
    setIsOpeningPortal(true);
    setBillingError("");
    try {
      const { url } = await openBillingPortal();
      window.location.href = url;
    } catch (err: unknown) {
      setBillingError(err instanceof Error ? err.message : "Couldn't open the billing portal.");
      setIsOpeningPortal(false);
    }
  };

  const [signOutAllError, setSignOutAllError] = useState("");
  const handleSignOutEverywhere = async () => {
    if (!confirm("Sign out of Tallyhawk on every device, including this one?")) return;
    try {
      await logoutEverywhere();
      router.push("/login");
    } catch (err: unknown) {
      setSignOutAllError(err instanceof Error ? err.message : "Something went wrong.");
    }
  };

  const formatDate = (iso: string) => new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

  const handleQuickBooksConnect = async () => {
    setIsConnectingQb(true);
    try {
      const { url } = await getQuickBooksConnectUrl();
      window.location.href = url; 
    } catch {
      alert("Unable to initiate QuickBooks connection.");
    } finally {
      setIsConnectingQb(false);
    }
  };

  const handleQuickBooksDisconnect = async () => {
    if (!confirm("Are you sure you want to disconnect QuickBooks? You will need to re-authorize to sync documents.")) return;
    
    setIsDisconnectingQb(true);
    try {
      await disconnectQuickBooks();
      setQbConnected(false);
      setQbStatusMessage("QuickBooks disconnected successfully.");
    } catch {
      setQbStatusMessage("Failed to disconnect QuickBooks.");
    } finally {
      setIsDisconnectingQb(false);
    }
  };

  if (!isAuthenticated) return null;

  return (
    <div className={`min-h-screen pb-24 ${isDark ? "bg-black" : "bg-gray-50"}`}>
      <div className="max-w-2xl mx-auto px-6 pt-32 space-y-6">

        {/* Page Header */}
        <div className="mb-10">
          <h1 className={`text-3xl font-bold tracking-tight ${isDark ? "text-white" : "text-gray-900"}`}>
            Account
          </h1>
          <p className={`text-sm mt-2 ${isDark ? "text-gray-400" : "text-gray-500"}`}>
            Manage your account settings.
          </p>
        </div>

        {/* Account Info */}
        <SectionCard
          title="Account Information"
          description="Your account details. Email cannot be changed."
          isDark={isDark}
        >
          <div className="space-y-4">
            <InputField
              label="Email Address"
              value={accountEmail}
              disabled
              isDark={isDark}
            />
            {memberSince && (
              <InputField
                label="Member Since"
                value={memberSince}
                disabled
                isDark={isDark}
              />
            )}
          </div>
        </SectionCard>

        {/* Subscription & Plan */}
        <SectionCard
          title="Subscription & Plan"
          description="Your current pricing tier and billing cycle."
          isDark={isDark}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${
                currentPlan === "pro" 
                  ? "bg-emerald-500/20" 
                  : isDark ? "bg-white/10" : "bg-gray-100"
              }`}>
                <svg className={`w-5 h-5 ${currentPlan === "pro" ? "text-emerald-400" : isDark ? "text-gray-400" : "text-gray-500"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z" />
                </svg>
              </div>
              <div>
                <p className={`text-sm font-semibold ${isDark ? "text-white" : "text-gray-900"}`}>
                  {currentPlan === "pro" ? "Tallyhawk Pro" : "Free Tier"}
                </p>
                <p className={`text-xs ${isDark ? "text-gray-400" : "text-gray-500"}`}>
                  {currentPlan === "pro" ? "Unlimited documents & integrations" : `${PRODUCT_FACTS.freeDocumentsPerMonth} documents / month`}
                </p>
              </div>
            </div>

            {currentPlan !== "pro" ? (
              <button
                onClick={() => router.push("/pricing")}
                className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium px-4 py-2 rounded-lg transition-colors"
              >
                Upgrade
              </button>
            ) : subscriptionStatus === "past_due" ? (
              <span className={`text-xs font-medium px-3 py-1 rounded-full border ${isDark ? "bg-amber-500/10 text-amber-300 border-amber-500/20" : "bg-amber-50 text-amber-800 border-amber-200"}`}>
                Payment issue
              </span>
            ) : cancelAtPeriodEnd ? (
              <span className={`text-xs font-medium px-3 py-1 rounded-full border ${isDark ? "bg-white/10 text-gray-300 border-white/10" : "bg-gray-100 text-gray-700 border-gray-200"}`}>
                Cancels soon
              </span>
            ) : (
              <span className={`text-xs font-medium px-3 py-1 rounded-full border ${isDark ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : "bg-emerald-50 text-emerald-700 border-emerald-200"}`}>
                Active
              </span>
            )}
          </div>

          {/* Billing Dates Section */}
          {currentPlan === "pro" && (
            <div className={`mt-6 pt-6 border-t space-y-3 ${
              isDark ? "border-white/10" : "border-gray-200"
            }`}>
              {subscriptionStatus === "past_due" && (
                <p role="alert" className={`text-sm px-4 py-2 rounded-lg ${isDark ? "text-amber-300 bg-amber-500/10" : "text-amber-800 bg-amber-50"}`}>
                  Your last payment didn't go through. Update your card in the billing portal to keep Pro.
                </p>
              )}
              <InputField
                label="Last Renewal"
                value={lastRenewalDate ? formatDate(lastRenewalDate) : "N/A"}
                disabled
                isDark={isDark}
              />
              {currentPeriodEnd && (
                <InputField
                  label={cancelAtPeriodEnd ? "Pro Ends On" : "Next Renewal"}
                  value={formatDate(currentPeriodEnd)}
                  disabled
                  isDark={isDark}
                />
              )}
            </div>
          )}

          {canManageBilling && (
            <div className="mt-6 flex flex-col gap-2">
              <button
                onClick={handleManageBilling}
                disabled={isOpeningPortal}
                className={`${primaryBtnClass} self-start text-xs font-medium px-4 py-2 rounded-lg transition-colors disabled:opacity-50`}
              >
                {isOpeningPortal ? "Opening…" : "Manage billing"}
              </button>
              <p className={`text-xs ${isDark ? "text-gray-400" : "text-gray-500"}`}>
                Update your card, download invoices or cancel your subscription on Stripe.
              </p>
              {billingError && <p role="alert" className="text-sm text-red-500">{billingError}</p>}
            </div>
          )}
        </SectionCard>

        {/* Tax Export - PRO ONLY */}
        {currentPlan === "pro" && (
          <SectionCard
            title="Tax Export"
            description="Download a CSV summary of your categorized spend for your accountant."
            isDark={isDark}
          >
            <div className="flex items-center gap-4">
              <select
                value={exportYear}
                onChange={(e) => setExportYear(Number(e.target.value))}
                aria-label="Tax summary export year"
                className={`text-sm px-3 py-2 rounded-lg border outline-none ${
                  isDark ? "bg-white/5 border-white/10 text-white" : "bg-white border-gray-200 text-gray-900"
                }`}
              >
                {/* DYNAMIC YEARS */}
                {[0, 1, 2, 3, 4, 5].map((i) => {
                  const y = new Date().getFullYear() - i;
                  return <option key={y} value={y}>{y}</option>;
                })}
              </select>
              <button
                onClick={handleExport}
                disabled={isExporting}
                className={`${primaryBtnClass} text-sm font-medium px-4 py-2 rounded-lg transition-colors`}
              >
                {isExporting ? "Exporting..." : "Export CSV"}
              </button>
            </div>
          </SectionCard>
        )}

        {/* Currency Settings */}
        <SectionCard
          title="Base Currency"
          description="Amounts are converted into this currency for totals, analytics and tax exports. Changing it saves immediately and re-converts your existing documents."
          isDark={isDark}
        >
          <div className="flex items-center gap-4">
            <select
              value={baseCurrency}
              onChange={(e) => handleCurrencyChange(e.target.value as CurrencyCode)}
              disabled={isUpdatingCurrency}
              aria-label="Base currency"
              className={`text-sm px-3 py-2 rounded-lg border outline-none flex-1 max-w-xs ${
                isDark ? "bg-white/5 border-white/10 text-white" : "bg-white border-gray-200 text-gray-900"
              }`}
            >
              {SUPPORTED_CURRENCIES.map(({ code, symbol, name, region }) => (
                <option key={code} value={code}>
                  {code} {symbol} — {name} ({region})
                </option>
              ))}
            </select>
            {isUpdatingCurrency && (
              <span className={`text-sm ${isDark ? "text-gray-400" : "text-gray-500"}`}>Saving…</span>
            )}
            {currencySuccess && (
              <span role="status" className="text-sm text-emerald-500">{currencySuccess}</span>
            )}
            {currencyError && (
              <span role="alert" className="text-sm text-red-500">{currencyError}</span>
            )}
          </div>
        </SectionCard>

        {/* Integrations */}
        <SectionCard
          title="Integrations"
          description="Connect third-party services to automate your workflow."
          isDark={isDark}
        >
          {qbStatusMessage && (
            <div className={`mb-4 text-sm px-4 py-2 rounded-lg ${
              qbStatusMessage.includes("successfully") 
                ? "text-emerald-500 bg-emerald-500/10" 
                : "text-red-500 bg-red-500/10"
            }`}>
              {qbStatusMessage}
            </div>
          )}

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${
                qbConnected ? "bg-emerald-500/20" : isDark ? "bg-white/10" : "bg-gray-100"
              }`}>
                <svg className={`w-5 h-5 ${qbConnected ? "text-emerald-400" : isDark ? "text-gray-400" : "text-gray-500"}`} viewBox="0 0 24 24" fill="currentColor">
                   <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67V7z"/>
                </svg>
              </div>
              <div>
                <p className={`text-sm font-semibold ${isDark ? "text-white" : "text-gray-900"}`}>
                  QuickBooks Online
                </p>
                <p className={`text-xs ${isDark ? "text-gray-400" : "text-gray-500"}`}>
                  {qbConnected ? "Connected" : "Not connected"}
                </p>
              </div>
            </div>

            {currentPlan === "pro" ? (
              qbConnected ? (
                <button
                  onClick={handleQuickBooksDisconnect}
                  disabled={isDisconnectingQb}
                  className={`text-xs font-medium px-4 py-2 rounded-lg transition-colors border ${
                    isDark 
                      ? "border-red-500/20 text-red-400 hover:bg-red-500/10" 
                      : "border-red-200 text-red-600 hover:bg-red-50"
                  }`}
                >
                  {isDisconnectingQb ? "Disconnecting..." : "Disconnect"}
                </button>
              ) : (
                <button
                  onClick={handleQuickBooksConnect}
                  disabled={isConnectingQb}
                  className={`text-xs font-medium px-4 py-2 rounded-lg transition-colors ${
                    isDark ? "bg-white/10 text-white hover:bg-white/20" : "bg-gray-200 text-gray-900 hover:bg-gray-300"
                  }`}
                >
                  {isConnectingQb ? "Redirecting..." : "Connect"}
                </button>
              )
            ) : (
              <button
                onClick={() => router.push("/pricing")}
                className={`${primaryBtnClass} text-xs font-medium px-4 py-2 rounded-lg transition-colors flex items-center gap-1`}
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                Pro
              </button>
            )}
          </div>
        </SectionCard>

        {/* Install as an app (optional) */}
        <SectionCard
          title="Tallyhawk App"
          description="Optionally install Tallyhawk on your phone or computer to open it from your home screen and snap receipts with your camera."
          isDark={isDark}
        >
          {installState === "installed" ? (
            <p role="status" className="text-sm text-emerald-500">You're using the installed app.</p>
          ) : installState === "unavailable" ? (
            <p className={`text-sm ${isDark ? "text-gray-400" : "text-gray-500"}`}>
              This browser can't install web apps. Open Tallyhawk in Chrome or Edge, or in Safari on iPhone, iPad or Mac, to install it.
            </p>
          ) : (
            <InstallAppButton
              label="Install Tallyhawk"
              className={`${primaryBtnClass} text-sm font-medium px-4 py-2 rounded-lg transition-colors`}
            />
          )}
        </SectionCard>

        {/* Session Info */}
        <SectionCard
          title="Current Session"
          description="Details about your active session token."
          isDark={isDark}
        >
          <div className="space-y-4">
            <InputField
                label="Session Expires"
                value={sessionExpiry}
                disabled
                isDark={isDark}
            />
            <div className="flex flex-col items-start gap-3">
              <button
                onClick={() => { logout(); router.push("/login"); }}
                className={`text-sm font-medium transition-colors ${
                  isDark
                    ? "text-gray-400 hover:text-white"
                    : "text-gray-500 hover:text-gray-900"
                }`}
              >
                Sign out of this session →
              </button>
              <button
                onClick={handleSignOutEverywhere}
                className={`text-sm font-medium transition-colors ${
                  isDark ? "text-red-400 hover:text-red-300" : "text-red-600 hover:text-red-700"
                }`}
              >
                Sign out of all devices →
              </button>
              {signOutAllError && <p role="alert" className="text-sm text-red-500">{signOutAllError}</p>}
            </div>
          </div>
        </SectionCard>

        {/* Change Password */}
        <SectionCard
          title="Change Password"
          description="Use a strong password you don't use elsewhere."
          isDark={isDark}
        >
          <form onSubmit={handlePasswordChange} className="space-y-4">
            <InputField
              label="Current Password"
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="Enter current password"
              isDark={isDark}
            />
            <InputField
              label="New Password"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Enter new password"
              isDark={isDark}
            />
            <InputField
              label="Confirm New Password"
              type="password"
              value={confirmNewPassword}
              onChange={(e) => setConfirmNewPassword(e.target.value)}
              placeholder="Confirm new password"
              isDark={isDark}
            />

            {passwordError && (
              <p role="alert" className="text-sm text-red-500 bg-red-500/10 px-4 py-2 rounded-lg">
                {passwordError}
              </p>
            )}
            {passwordSuccess && (
              <p role="status" className="text-sm text-emerald-500 bg-emerald-500/10 px-4 py-2 rounded-lg">
                {passwordSuccess}
              </p>
            )}

            <button
              type="submit"
              disabled={isChangingPassword || !currentPassword || !newPassword || !confirmNewPassword || newPassword !== confirmNewPassword}
              className={`${primaryBtnClass} w-full ${isDark ? "disabled:bg-white/50" : "disabled:bg-black/50"} disabled:cursor-not-allowed text-white py-3 rounded-xl text-sm font-semibold transition-all`}
            >
              {isChangingPassword ? "Updating..." : "Update Password"}
            </button>
          </form>
        </SectionCard>

        <DeleteAccountSection isDark={isDark} />

      </div>
    </div>
  );
}