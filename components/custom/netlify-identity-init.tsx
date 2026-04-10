"use client";

import { useEffect, useRef } from "react";

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
  const initRef = useRef(false);

  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;

    if (window.netlifyIdentity) {
      window.netlifyIdentity.init();
      return;
    }

    const script = document.createElement("script");
    script.src = "https://identity.netlify.com/v1/netlify-identity-widget.js";
    script.async = true;
    script.onload = () => {
      window.netlifyIdentity?.init();
    };
    document.head.appendChild(script);
  }, []);

  return null;
}
