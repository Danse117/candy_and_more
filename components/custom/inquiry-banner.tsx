// components/custom/inquiry-banner.tsx
"use client";

import { useState } from "react";

export default function InquiryBanner() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [text, setText] = useState("");

  function handleSend() {
    const subject = encodeURIComponent("Product Inquiry");
    const body = encodeURIComponent(
      `Name: ${name}\nContact: ${email}\n\nInquiry: ${text}`
    );
    window.location.href = `mailto:candiesandmoredistrocorp@gmail.com?subject=${subject}&body=${body}`;
  }

  return (
    <div className="my-3.5 overflow-hidden">
      <div className="bg-[rgba(255,255,255,0.85)] border border-[var(--candy-border)] rounded-[20px] shadow-sm p-3.5 overflow-hidden">
        <div className="font-[950] text-sm">Can&apos;t find a product?</div>
        <div className="text-[var(--candy-muted)] text-xs leading-snug mt-1">
          Send us a quick inquiry and we&apos;ll tell you if we have it in stock or can get it for you.
        </div>
        <div className="mt-2.5 flex flex-col sm:flex-row gap-2 sm:gap-2.5">
          <input
            placeholder="Your name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="border border-[var(--candy-border)] rounded-[14px] py-2.5 px-3 bg-white text-[13px] w-full sm:w-auto sm:min-w-[170px]"
          />
          <input
            placeholder="Email or phone"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="border border-[var(--candy-border)] rounded-[14px] py-2.5 px-3 bg-white text-[13px] w-full sm:w-auto sm:min-w-[190px]"
          />
        </div>
        <div className="mt-2 sm:mt-2.5 flex flex-col sm:flex-row gap-2 sm:gap-2.5">
          <input
            placeholder="What product are you looking for?"
            value={text}
            onChange={(e) => setText(e.target.value)}
            className="flex-1 border border-[var(--candy-border)] rounded-[14px] py-2.5 px-3 bg-white text-[13px] w-full"
          />
          <button
            onClick={handleSend}
            className="w-full sm:w-auto shrink-0 border border-[var(--candy-border)] bg-white rounded-2xl py-3 px-3.5 cursor-pointer shadow-sm font-[950] text-sm transition-all hover:border-[var(--candy-accent)] hover:-translate-y-px"
          >
            Send inquiry ✉️
          </button>
        </div>
        <div className="text-[var(--candy-muted)] text-[11px] mt-2">
          This opens your email app with the inquiry pre‑filled.
        </div>
      </div>
    </div>
  );
}
