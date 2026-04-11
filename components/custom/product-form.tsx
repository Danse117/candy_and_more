"use client";

import { useRef, useState } from "react";
import { Upload } from "lucide-react";

interface ProductFormData {
  id?: string;
  upc: string;
  name: string;
  description: string;
  price: string;
  category: string;
  photoUrl: string;
}

interface ProductFormProps {
  initial?: ProductFormData;
  onSave: (data: ProductFormData) => Promise<void>;
  onCancel: () => void;
}

const CATEGORIES = [
  "Gummies & Chewy Candy",
  "Cookies & Wafers",
  "Chips & Snacks",
  "Chocolate Bars",
  "Gum & Mints",
  "Protein & Energy Bars",
  "Noodles & Soups",
  "Rolling Papers",
  "Fragrances & Candles",
];

export default function ProductForm({ initial, onSave, onCancel }: ProductFormProps) {
  const [form, setForm] = useState<ProductFormData>(
    initial || {
      upc: "",
      name: "",
      description: "",
      price: "",
      category: CATEGORIES[0],
      photoUrl: "MISSING",
    }
  );
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(
    initial?.photoUrl && initial.photoUrl !== "MISSING" ? initial.photoUrl : null
  );
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);

    // 1. Create or update the product row first.
    await onSave(form);

    // 2. If the user picked a file, upload it using the known id.
    //    For new products the admin POST handler generates id = `upc_${upc}`.
    if (file) {
      const productId = form.id || `upc_${form.upc}`;
      const fd = new FormData();
      fd.append("file", file);
      fd.append("productId", productId);
      const token = sessionStorage.getItem("nf_token");
      await fetch("/api/admin/upload", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });
    }

    setSaving(false);
  }

  const inputClass =
    "border border-[var(--candy-border)] rounded-[14px] py-2.5 px-3 bg-white text-sm w-full";

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <input
          required
          placeholder="UPC"
          value={form.upc}
          onChange={(e) => setForm({ ...form, upc: e.target.value })}
          className={inputClass}
        />
        <input
          required
          placeholder="Product name"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          className={inputClass}
        />
      </div>
      <input
        placeholder="Description"
        value={form.description}
        onChange={(e) => setForm({ ...form, description: e.target.value })}
        className={inputClass}
      />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <input
          required
          type="number"
          step="0.01"
          placeholder="Price"
          value={form.price}
          onChange={(e) => setForm({ ...form, price: e.target.value })}
          className={inputClass}
        />
        <select
          value={form.category}
          onChange={(e) => setForm({ ...form, category: e.target.value })}
          className={inputClass}
        >
          {CATEGORIES.map((cat) => (
            <option key={cat} value={cat}>
              {cat}
            </option>
          ))}
        </select>
      </div>

      {/* Image picker — always visible, image is optional */}
      <div
        onClick={() => inputRef.current?.click()}
        className="border-2 border-dashed border-[var(--candy-border)] rounded-xl p-4 text-center cursor-pointer hover:border-[var(--candy-accent)] transition-colors"
      >
        {preview ? (
          <img
            src={preview}
            alt="Product preview"
            className="max-h-[120px] mx-auto mb-2 object-contain"
          />
        ) : (
          <Upload className="size-8 mx-auto mb-2 text-[var(--candy-muted)]" />
        )}
        <p className="text-xs text-[var(--candy-muted)]">
          {file ? file.name : "Click to upload image (optional)"}
        </p>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) {
              setFile(f);
              setPreview(URL.createObjectURL(f));
            }
          }}
        />
      </div>

      <div className="flex gap-2.5 pt-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-2xl py-2.5 px-4 border border-[var(--candy-border)] bg-white text-sm font-bold text-[var(--candy-muted)] hover:bg-[#F1F5F9] transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={saving}
          className="rounded-2xl py-2.5 px-6 bg-[var(--candy-accent-bg)] border border-[var(--candy-accent-border)] text-[#0B3B66] font-black text-sm transition-colors hover:bg-[rgba(96,165,250,0.28)] disabled:opacity-50"
        >
          {saving ? "Saving..." : initial?.id ? "Update" : "Create"}
        </button>
      </div>
    </form>
  );
}
