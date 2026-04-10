// app/admin/login/page.tsx
"use client";

import { useEffect, useRef, useState } from "react";

export default function AdminLoginPage() {
  const [ready, setReady] = useState(false);
  const initRef = useRef(false);

  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;

    // Wait for the global netlify identity widget (loaded via script tag in root layout)
    function waitForWidget() {
      if (window.netlifyIdentity) {
        window.netlifyIdentity.on("login", (user: unknown) => {
          const u = user as { token?: { access_token?: string } } | undefined;
          const token = u?.token?.access_token;
          if (token) {
            sessionStorage.setItem("nf_token", token);
            window.location.href = "/admin";
          }
        });
        setReady(true);
      } else {
        setTimeout(waitForWidget, 50);
      }
    }
    waitForWidget();
  }, []);

  function handleLogin() {
    window.netlifyIdentity?.open("login");
  }

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="bg-white border border-[var(--candy-border)] rounded-[20px] shadow-[var(--candy-shadow)] p-8 max-w-sm w-full text-center">
        <h1 className="text-2xl font-black mb-2">
          Candy <span className="text-[var(--candy-accent)]">&amp;</span> More
        </h1>
        <p className="text-[var(--candy-muted)] text-sm mb-6">Admin Dashboard</p>
        <button
          onClick={handleLogin}
          disabled={!ready}
          className="w-full rounded-2xl py-3 px-4 bg-[var(--candy-accent-bg)] border border-[var(--candy-accent-border)] text-[#0B3B66] font-black transition-colors hover:bg-[rgba(96,165,250,0.28)] disabled:opacity-50"
        >
          {ready ? "Sign In" : "Loading..."}
        </button>
      </div>
    </div>
  );
}
