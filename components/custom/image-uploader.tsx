"use client";

import { useState, useRef } from "react";
import { Upload } from "lucide-react";

interface ImageUploaderProps {
  productId: string;
  currentUrl: string;
  onUploaded: (url: string) => void;
}

export default function ImageUploader({ productId, currentUrl, onUploaded }: ImageUploaderProps) {
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    setUploading(true);
    const formData = new FormData();
    formData.append("file", file);
    formData.append("productId", productId);

    const token = sessionStorage.getItem("nf_token");
    const res = await fetch("/api/admin/upload", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    });

    if (res.ok) {
      const data = await res.json();
      onUploaded(data.url);
    }
    setUploading(false);
  }

  return (
    <div
      onClick={() => inputRef.current?.click()}
      className="border-2 border-dashed border-[var(--candy-border)] rounded-xl p-4 text-center cursor-pointer hover:border-[var(--candy-accent)] transition-colors"
    >
      {currentUrl && currentUrl !== "MISSING" ? (
        <img src={currentUrl} alt="Product" className="max-h-[120px] mx-auto mb-2 object-contain" />
      ) : (
        <Upload className="size-8 mx-auto mb-2 text-[var(--candy-muted)]" />
      )}
      <p className="text-xs text-[var(--candy-muted)]">
        {uploading ? "Uploading..." : "Click to upload image"}
      </p>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
        }}
      />
    </div>
  );
}
