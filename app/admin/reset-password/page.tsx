"use client";

import Link from "next/link";
import { Suspense, useActionState } from "react";
import { useSearchParams } from "next/navigation";
import { resetPassword } from "./actions";

function ResetForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const [state, formAction, isPending] = useActionState(resetPassword, null);

  if (!token) {
    return (
      <Shell>
        <h1 className="text-xl font-black mb-2 text-center">
          Candy <span className="text-[var(--candy-accent)]">&amp;</span> More
        </h1>
        <div className="mb-4 p-3 rounded-xl bg-[rgba(239,68,68,0.08)] border border-[rgba(239,68,68,0.2)] text-[#EF4444] text-sm">
          Reset token missing. Request a new reset link.
        </div>
        <Link
          href="/admin/forgot-password"
          className="block w-full text-center rounded-2xl py-3 px-4 bg-[var(--candy-accent-bg)] border border-[var(--candy-accent-border)] text-[#0B3B66] font-black transition-colors hover:bg-[rgba(96,165,250,0.28)]"
        >
          Request reset link
        </Link>
      </Shell>
    );
  }

  return (
    <Shell>
      <form action={formAction}>
        <h1 className="text-2xl font-black mb-2 text-center">
          Candy <span className="text-[var(--candy-accent)]">&amp;</span> More
        </h1>
        <p className="text-[var(--candy-muted)] text-sm mb-6 text-center">
          Set a new password
        </p>

        {state?.error && (
          <div className="mb-4 p-3 rounded-xl bg-[rgba(239,68,68,0.08)] border border-[rgba(239,68,68,0.2)] text-[#EF4444] text-sm">
            {state.error}
          </div>
        )}

        <input type="hidden" name="token" value={token} />

        <div className="space-y-3">
          <div>
            <label className="block text-xs font-bold mb-1" htmlFor="password">New password</label>
            <input
              id="password"
              name="password"
              type="password"
              required
              autoFocus
              minLength={8}
              className="w-full border border-[var(--candy-border)] rounded-[14px] py-2.5 px-3 bg-white text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-bold mb-1" htmlFor="confirmPassword">Confirm password</label>
            <input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              required
              minLength={8}
              className="w-full border border-[var(--candy-border)] rounded-[14px] py-2.5 px-3 bg-white text-sm"
            />
          </div>
          <button
            type="submit"
            disabled={isPending}
            className="w-full rounded-2xl py-3 px-4 bg-[var(--candy-accent-bg)] border border-[var(--candy-accent-border)] text-[#0B3B66] font-black transition-colors hover:bg-[rgba(96,165,250,0.28)] disabled:opacity-50"
          >
            {isPending ? "Setting password..." : "Set password"}
          </button>
        </div>
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

export default function AdminResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <Shell>
          <div className="text-[var(--candy-muted)] text-sm text-center">Loading…</div>
        </Shell>
      }
    >
      <ResetForm />
    </Suspense>
  );
}
