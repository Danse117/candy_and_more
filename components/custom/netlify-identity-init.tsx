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
  if (!widget) {
    console.log("[nf-identity] widget missing at onReady");
    return;
  }

  const hash = window.location.hash;
  const search = window.location.search;
  console.log("[nf-identity] onReady. hash:", hash, "search:", search);

  widget.on("init", (user) => {
    console.log("[nf-identity] init event. user:", user);
  });
  widget.on("open", (tab) => {
    console.log("[nf-identity] open event. tab:", tab);
  });
  widget.on("close", () => {
    console.log("[nf-identity] close event");
  });
  widget.on("error", (err) => {
    console.log("[nf-identity] error event:", err);
  });

  // Global login handler — fires after invite signup, password recovery,
  // and normal login. Store token and send user to /admin.
  widget.on("login", (user) => {
    console.log("[nf-identity] login event");
    const u = user as { token?: { access_token?: string } } | undefined;
    const token = u?.token?.access_token;
    if (token) {
      sessionStorage.setItem("nf_token", token);
      window.location.href = "/admin";
    }
  });

  widget.init();
  console.log("[nf-identity] init() called");

  // Defensive fallback: if init didn't pick up a recovery_token from the hash
  // (race conditions or non-standard link formats), manually trigger the flow.
  const recoveryToken = extractRecoveryToken();
  if (recoveryToken) {
    console.log("[nf-identity] found recovery_token in URL, waiting briefly for widget auto-open");
    setTimeout(() => {
      const openEl = document.querySelector(".netlify-identity-modal");
      if (openEl) {
        console.log("[nf-identity] widget modal already open, no fallback needed");
        return;
      }
      console.log("[nf-identity] widget did not auto-open, calling gotrue.recover manually");
      const gotrue = widget.gotrue;
      if (gotrue && typeof gotrue.recover === "function") {
        gotrue
          .recover(recoveryToken, true)
          .then((result) => {
            console.log("[nf-identity] gotrue.recover resolved:", result);
          })
          .catch((err: unknown) => {
            console.log("[nf-identity] gotrue.recover error:", err);
            widget.open("login");
          });
      } else {
        console.log("[nf-identity] gotrue.recover unavailable, opening login modal as fallback");
        widget.open("login");
      }
    }, 400);
  }
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
