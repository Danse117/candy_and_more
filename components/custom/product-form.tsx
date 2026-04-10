"use client";

import { useState } from "react";
import ImageUploader from "./image-uploader";

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
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    await onSave(form);
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

      {form.id && (
        <ImageUploader
          productId={form.id}
          currentUrl={form.photoUrl}
          onUploaded={(url) => setForm({ ...form, photoUrl: url })}
        />
      )}

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
