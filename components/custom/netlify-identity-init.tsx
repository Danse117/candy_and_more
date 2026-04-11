"use client";

import Script from "next/script";

declare global {
  interface Window {
    netlifyIdentity?: {
      init: () => void;
      open: (tab?: string) => void;
      on: (event: string, cb: (user?: unknown) => void) => void;
      logout: () => void;
    };
  }
}

export default function NetlifyIdentityInit() {
  return (
    <Script
      src="https://identity.netlify.com/v1/netlify-identity-widget.js"
      strategy="afterInteractive"
      onReady={() => {
        if (!window.netlifyIdentity) return;
        window.netlifyIdentity.init();
        window.netlifyIdentity.on("login", (user?: unknown) => {
          const u = user as { token?: { access_token?: string } } | undefined;
          const token = u?.token?.access_token;
          if (token) {
            sessionStorage.setItem("nf_token", token);
            window.location.href = "/admin";
          }
        });
      }}
    />
  );
}
