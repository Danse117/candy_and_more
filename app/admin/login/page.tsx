"use client";

import { useActionState } from "react";
import { signInWithEmail } from "./actions";

export default function AdminLoginPage() {
  const [state, formAction, isPending] = useActionState(signInWithEmail, null);

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
          Admin Dashboard
        </p>

        {state?.error && (
          <div className="mb-4 p-3 rounded-xl bg-[rgba(239,68,68,0.08)] border border-[rgba(239,68,68,0.2)] text-[#EF4444] text-sm">
            {state.error}
          </div>
        )}

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
          <div>
            <label className="block text-xs font-bold mb-1" htmlFor="password">Password</label>
            <input
              id="password"
              name="password"
              type="password"
              required
              className="w-full border border-[var(--candy-border)] rounded-[14px] py-2.5 px-3 bg-white text-sm"
            />
          </div>
          <button
            type="submit"
            disabled={isPending}
            className="w-full rounded-2xl py-3 px-4 bg-[var(--candy-accent-bg)] border border-[var(--candy-accent-border)] text-[#0B3B66] font-black transition-colors hover:bg-[rgba(96,165,250,0.28)] disabled:opacity-50"
          >
            {isPending ? "Signing in..." : "Sign In"}
          </button>
        </div>
      </form>
    </div>
  );
}
