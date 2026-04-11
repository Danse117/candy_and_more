"use client";

import Script from "next/script";

type IdentityWidget = {
  init: (options?: Record<string, unknown>) => void;
  open: (tab?: string) => void;
  close: () => void;
  on: (event: string, cb: (data?: unknown) => void) => void;
  off: (event: string, cb?: (data?: unknown) => void) => void;
  logout: () => void;
  currentUser: () => unknown;
  gotrue?: {
    recover: (token: string, remember?: boolean) => Promise<unknown>;
  };
};

declare global {
  interface Window {
    netlifyIdentity?: IdentityWidget;
  }
}

function extractRecoveryToken(): string | null {
  const hash = window.location.hash || "";
  const search = window.location.search || "";
  const hashMatch = hash.match(/[#&]recovery_token=([^&]+)/);
  if (hashMatch) return hashMatch[1];
  const searchMatch = search.match(/[?&]recovery_token=([^&]+)/);
  if (searchMatch) return searchMatch[1];
  return null;
}

function handleWidgetReady() {
  if (typeof window === "undefined") return;
  const widget = window.netlifyIdentity;
  if (!widget) return;

  // Intercept password recovery BEFORE calling widget.init(). The widget's
  // init() auto-processes any `#recovery_token=...` in the URL by calling
  // gotrue.recover(), which consumes the single-use token server-side even
  // when the modal fails to open. Redirecting here preserves the token so
  // /admin/recover can use it exactly once.
  const recoveryToken = extractRecoveryToken();
  if (recoveryToken && window.location.pathname !== "/admin/recover") {
    window.location.replace(
      `/admin/recover?token=${encodeURIComponent(recoveryToken)}`,
    );
    return;
  }

  // Normal flow: register the global login handler then initialize the widget.
  widget.on("login", (user) => {
    const u = user as { token?: { access_token?: string } } | undefined;
    const token = u?.token?.access_token;
    if (token) {
      sessionStorage.setItem("nf_token", token);
      window.location.href = "/admin";
    }
  });

  widget.init();
}

export default function NetlifyIdentityInit() {
  return (
    <Script
      src="https://identity.netlify.com/v1/netlify-identity-widget.js"
      strategy="afterInteractive"
      onReady={handleWidgetReady}
    />
  );
}
