"use client";

import Link from "next/link";
import { useActionState } from "react";
import { requestPasswordReset } from "./actions";

export default function AdminForgotPasswordPage() {
  const [state, formAction, isPending] = useActionState(requestPasswordReset, null);

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <form
        action={formAction}
        className="bg-white border border-[var(--candy-border)] rounded-[20px] shadow-[var(--candy-shadow)] p-8 max-w-sm w-full"
      >
        <h1 className="text-2xl font-black mb-2 text-center">
          Candy <span className="text-[var(--candy-accent)]">&amp;</span> More
        </h1>
        <p className="text-[var(--candy-muted)] text-sm mb-6 text-center">
          Reset your password
        </p>

        {state?.error && (
          <div className="mb-4 p-3 rounded-xl bg-[rgba(239,68,68,0.08)] border border-[rgba(239,68,68,0.2)] text-[#EF4444] text-sm">
            {state.error}
          </div>
        )}

        {state?.sent ? (
          <div className="space-y-4">
            <div className="p-3 rounded-xl bg-[var(--candy-green-bg)] border border-[var(--candy-green-border)] text-[#065F46] text-sm">
              If an account exists for that email, a reset link has been sent. Check your inbox.
            </div>
            <Link
              href="/admin/login"
              className="block w-full text-center rounded-2xl py-3 px-4 bg-[var(--candy-accent-bg)] border border-[var(--candy-accent-border)] text-[#0B3B66] font-black transition-colors hover:bg-[rgba(96,165,250,0.28)]"
            >
              Back to sign in
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-bold mb-1" htmlFor="email">Email</label>
              <input
                id="email"
                name="email"
                type="email"
                required
                autoFocus
                className="w-full border border-[var(--candy-border)] rounded-[14px] py-2.5 px-3 bg-white text-sm"
              />
            </div>
            <button
              type="submit"
              disabled={isPending}
              className="w-full rounded-2xl py-3 px-4 bg-[var(--candy-accent-bg)] border border-[var(--candy-accent-border)] text-[#0B3B66] font-black transition-colors hover:bg-[rgba(96,165,250,0.28)] disabled:opacity-50"
            >
              {isPending ? "Sending..." : "Send reset link"}
            </button>
            <Link
              href="/admin/login"
              className="block text-center text-xs font-bold text-[var(--candy-muted)] hover:text-[var(--candy-text)] transition-colors"
            >
              Back to sign in
            </Link>
          </div>
        )}
      </form>
    </div>
  );
}
