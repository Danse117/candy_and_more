"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";

type RecoveredUser = {
  token?: { access_token?: string };
  update: (fields: { password: string }) => Promise<RecoveredUser>;
};

function RecoverForm() {
  const searchParams = useSearchParams();
  const token =
    searchParams.get("token") || searchParams.get("recovery_token") || "";

  const [widgetReady, setWidgetReady] = useState(false);
  const [recoveredUser, setRecoveredUser] = useState<RecoveredUser | null>(null);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const recoverTriedRef = useRef(false);

  // Wait for the globally-loaded Netlify Identity widget to be available.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.netlifyIdentity) {
      setWidgetReady(true); // eslint-disable-line react-hooks/set-state-in-effect
      return;
    }
    const interval = setInterval(() => {
      if (window.netlifyIdentity) {
        setWidgetReady(true);
        clearInterval(interval);
      }
    }, 50);
    return () => clearInterval(interval);
  }, []);

  // Validate the recovery token by calling gotrue.recover. On success we get
  // a user object whose .update() method will set the new password.
  useEffect(() => {
    if (!widgetReady || !token || recoverTriedRef.current) return;
    recoverTriedRef.current = true;

    const gotrue = window.netlifyIdentity?.gotrue as
      | { recover: (token: string, remember?: boolean) => Promise<RecoveredUser> }
      | undefined;

    if (!gotrue || typeof gotrue.recover !== "function") {
      setError("Authentication is unavailable. Please try again later."); // eslint-disable-line react-hooks/set-state-in-effect
      return;
    }

    gotrue.recover(token, true).then(
      (user) => {
        setRecoveredUser(user);
      },
      (err: unknown) => {
        console.log("[recover] gotrue.recover error:", err);
        const message =
          err instanceof Error
            ? err.message
            : "Invalid or expired recovery link. Please request a new one.";
        setError(message);
      },
    );
  }, [widgetReady, token]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!recoveredUser) {
      setError("Recovery session not ready. Refresh the page and try again.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setSubmitting(true);
    try {
      const updated = await recoveredUser.update({ password });
      const accessToken = updated?.token?.access_token;
      if (accessToken) {
        sessionStorage.setItem("nf_token", accessToken);
        window.location.href = "/admin";
      } else {
        // Password updated but no session returned; send them to sign in.
        window.location.href = "/admin/login";
      }
    } catch (err: unknown) {
      console.log("[recover] update error:", err);
      setSubmitting(false);
      const message =
        err instanceof Error ? err.message : "Failed to update password.";
      setError(message);
    }
  }

  if (!token) {
    return (
      <Shell>
        <h1 className="text-xl font-black mb-2">Password Recovery</h1>
        <p className="text-sm text-[var(--candy-muted)]">
          No recovery token provided. Please use the link from your email, or
          append <code className="font-mono">?token=YOUR_TOKEN</code> to the URL.
        </p>
      </Shell>
    );
  }

  if (!widgetReady || (!recoveredUser && !error)) {
    return (
      <Shell>
        <div className="text-[var(--candy-muted)] text-sm text-center">
          Validating recovery link...
        </div>
      </Shell>
    );
  }

  if (error && !recoveredUser) {
    return (
      <Shell>
        <h1 className="text-xl font-black mb-2 text-center">
          Candy <span className="text-[var(--candy-accent)]">&amp;</span> More
        </h1>
        <div className="mb-4 p-3 rounded-xl bg-[rgba(239,68,68,0.08)] border border-[rgba(239,68,68,0.2)] text-[#EF4444] text-sm text-center">
          {error}
        </div>
        <a
          href="/admin/login"
          className="block w-full text-center rounded-2xl py-3 px-4 bg-[var(--candy-accent-bg)] border border-[var(--candy-accent-border)] text-[#0B3B66] font-black transition-colors hover:bg-[rgba(96,165,250,0.28)]"
        >
          Back to sign in
        </a>
      </Shell>
    );
  }

  return (
    <Shell>
      <h1 className="text-2xl font-black mb-2 text-center">
        Candy <span className="text-[var(--candy-accent)]">&amp;</span> More
      </h1>
      <p className="text-[var(--candy-muted)] text-sm mb-6 text-center">
        Set a new password
      </p>

      {error && (
        <div className="mb-4 p-3 rounded-xl bg-[rgba(239,68,68,0.08)] border border-[rgba(239,68,68,0.2)] text-[#EF4444] text-sm">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label className="block text-xs font-bold mb-1">New password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full border border-[var(--candy-border)] rounded-[14px] py-2.5 px-3 bg-white text-sm"
            autoFocus
            required
          />
        </div>
        <div>
          <label className="block text-xs font-bold mb-1">Confirm password</label>
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="w-full border border-[var(--candy-border)] rounded-[14px] py-2.5 px-3 bg-white text-sm"
            required
          />
        </div>
        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-2xl py-3 px-4 bg-[var(--candy-accent-bg)] border border-[var(--candy-accent-border)] text-[#0B3B66] font-black transition-colors hover:bg-[rgba(96,165,250,0.28)] disabled:opacity-50"
        >
          {submitting ? "Updating..." : "Set password"}
        </button>
      </form>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="bg-white border border-[var(--candy-border)] rounded-[20px] shadow-[var(--candy-shadow)] p-8 max-w-sm w-full">
        {children}
      </div>
    </div>
  );
}

export default function AdminRecoverPage() {
  return (
    <Suspense
      fallback={
        <Shell>
          <div className="text-[var(--candy-muted)] text-sm text-center">
            Loading...
          </div>
        </Shell>
      }
    >
      <RecoverForm />
    </Suspense>
  );
}
