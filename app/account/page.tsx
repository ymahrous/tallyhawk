"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { usePlan } from "../providers/PlanContext";
import { useTheme } from "@/app/providers/ThemeContext";
import { logout, decodeToken, isTokenExpired } from "@/lib/api";

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
        <p className={`text-sm mt-1 ${isDark ? "text-gray-500" : "text-gray-400"}`}>
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

  return (
    <div className="space-y-1.5">
      <label className={`text-xs font-medium uppercase tracking-wider ${
        isDark ? "text-gray-400" : "text-gray-500"
      }`}>
        {label}
      </label>

      <div className="relative flex items-center">
        <input
          type={inputType}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          disabled={disabled}
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

      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function AccountPage() {
  const router = useRouter();
  const { theme } = useTheme();
  const isDark = theme === "dark";
  
  // ADDED currentPeriodEnd and lastRenewalDate
  const { plan: currentPlan, currentPeriodEnd, lastRenewalDate } = usePlan();

  // ── Auth guard ──
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [accountEmail, setAccountEmail] = useState("");
  const [memberSince, setMemberSince] = useState("");
  const [sessionExpiry, setSessionExpiry] = useState("");

  useEffect(() => {
    if (isTokenExpired()) {
      router.push("/login");
      return;
    }

    const payload = decodeToken();
    if (!payload) {
      router.push("/login");
      return;
    }

    setIsAuthenticated(true);
    setAccountEmail(payload.sub);

    // Format session expiry
    const iat = (payload as { sub: string; exp: number; iat?: number }).iat;

    if (iat) {
    setMemberSince(new Date(iat * 1000).toLocaleDateString("en-US", {
        year: "numeric", month: "long", day: "numeric",
    }));
    }

    const expDate = new Date(payload.exp * 1000);
    setSessionExpiry(expDate.toLocaleString());

  }, [router]);

  // ── Password change ──
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [passwordSuccess, setPasswordSuccess] = useState("");
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError("");
    setPasswordSuccess("");

    if (newPassword.length < 8) {
      setPasswordError("New password must be at least 8 characters.");
      return;
    }
    if (!/[A-Z]/.test(newPassword)) {
      setPasswordError("New password must contain at least one uppercase letter.");
      return;
    }
    if (!/[0-9]/.test(newPassword)) {
      setPasswordError("New password must contain at least one number.");
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setPasswordError("Passwords do not match.");
      return;
    }

    setIsChangingPassword(true);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/change-password`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify({
          current_password: currentPassword,
          new_password: newPassword,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || "Failed to change password.");
      }

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

  // ── Danger zone ──
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const DELETE_PHRASE = "delete my account";

  const handleDeleteAccount = async () => {
    if (deleteConfirm !== DELETE_PHRASE) return;
    setIsDeletingAccount(true);
    setDeleteError("");
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/delete`, {
        method: "DELETE",
        headers: { "Authorization": `Bearer ${token}` },
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || "Failed to delete account.");
      }

      logout();
      router.push("/");
    } catch (err: unknown) {
      setDeleteError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setIsDeletingAccount(false);
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
          <p className={`text-sm mt-2 ${isDark ? "text-gray-500" : "text-gray-400"}`}>
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
                <svg className={`w-5 h-5 ${currentPlan === "pro" ? "text-emerald-400" : isDark ? "text-gray-500" : "text-gray-400"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z" />
                </svg>
              </div>
              <div>
                <p className={`text-sm font-semibold ${isDark ? "text-white" : "text-gray-900"}`}>
                  {currentPlan === "pro" ? "edocAI Pro" : "Free Tier"}
                </p>
                <p className={`text-xs ${isDark ? "text-gray-500" : "text-gray-400"}`}>
                  {currentPlan === "pro" ? "Unlimited documents & integrations" : "10 documents / month"}
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
            ) : (
              <span className="text-xs font-medium px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                Active
              </span>
            )}
          </div>

          {/* Billing Dates Section */}
          {currentPlan === "pro" && (
            <div className={`mt-6 pt-6 border-t space-y-3 ${
              isDark ? "border-white/10" : "border-gray-200"
            }`}>
              <InputField
                label="Last Renewal"
                value={lastRenewalDate ? new Date(lastRenewalDate).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }) : "N/A"}
                disabled
                isDark={isDark}
              />
              {/* <InputField
                label="Next Renewal"
                value={currentPeriodEnd ? new Date(currentPeriodEnd).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }) : "N/A"}
                disabled
                isDark={isDark}
              /> */}
            </div>
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
                label="Session Started"
                value={sessionExpiry}
                disabled
                isDark={isDark}
            />
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
              <p className="text-sm text-red-500 bg-red-500/10 px-4 py-2 rounded-lg">
                {passwordError}
              </p>
            )}
            {passwordSuccess && (
              <p className="text-sm text-emerald-500 bg-emerald-500/10 px-4 py-2 rounded-lg">
                {passwordSuccess}
              </p>
            )}

            <button
              type="submit"
              disabled={isChangingPassword || !currentPassword || !newPassword || !confirmNewPassword}
              className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-400 disabled:cursor-not-allowed text-white py-3 rounded-xl text-sm font-semibold transition-all"
            >
              {isChangingPassword ? "Updating..." : "Update Password"}
            </button>
          </form>
        </SectionCard>

        {/* Danger Zone */}
        <div className="rounded-2xl border border-red-500/30 p-8">
          <div className="mb-6">
            <h2 className="text-base font-semibold text-red-500">Danger Zone</h2>
            <p className={`text-sm mt-1 ${isDark ? "text-gray-500" : "text-gray-400"}`}>
              Permanently delete your account and all associated documents. This cannot be undone.
            </p>
          </div>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className={`text-xs font-medium uppercase tracking-wider ${
                isDark ? "text-gray-400" : "text-gray-500"
              }`}>
                Type <span className="text-red-400 font-mono normal-case tracking-normal">
                  {DELETE_PHRASE}
                </span> to confirm
              </label>
              <input
                type="text"
                value={deleteConfirm}
                onChange={(e) => setDeleteConfirm(e.target.value)}
                placeholder={DELETE_PHRASE}
                className={`w-full text-sm px-4 py-3 rounded-xl border outline-none transition-colors ${
                  isDark
                    ? "bg-white/5 border-red-500/20 text-white focus:border-red-500 placeholder-gray-600"
                    : "bg-white border-red-200 text-gray-900 focus:border-red-500 placeholder-gray-400"
                }`}
              />
            </div>

            {deleteError && (
              <p className="text-sm text-red-500 bg-red-500/10 px-4 py-2 rounded-lg">
                {deleteError}
              </p>
            )}

            <button
              onClick={handleDeleteAccount}
              disabled={deleteConfirm !== DELETE_PHRASE || isDeletingAccount}
              className="w-full bg-red-600 hover:bg-red-500 disabled:bg-red-900 disabled:text-red-700 disabled:cursor-not-allowed text-white py-3 rounded-xl text-sm font-semibold transition-all"
            >
              {isDeletingAccount ? "Deleting..." : "Permanently Delete Account"}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}