"use client";

import { useEffect, useState } from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";
import ProductForm from "@/components/custom/product-form";

interface Product {
  id: string;
  upc: string;
  name: string;
  description: string;
  price: string;
  category: string;
  photo_url: string;
}

export default function AdminProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [editing, setEditing] = useState<Product | null>(null);
  const [creating, setCreating] = useState(false);
  const [search, setSearch] = useState("");

  const token = typeof window !== "undefined" ? sessionStorage.getItem("nf_token") : null;
  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

  async function loadProducts() {
    const res = await fetch("/api/admin/products", { headers: { Authorization: `Bearer ${token}` } });
    if (res.ok) setProducts(await res.json());
  }

  useEffect(() => {
    loadProducts(); // eslint-disable-line react-hooks/set-state-in-effect
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleCreate(
    data: { upc: string; name: string; description: string; price: string; category: string; photoUrl: string },
    file: File | null,
  ) {
    const res = await fetch("/api/admin/products", {
      method: "POST",
      headers,
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      alert("Failed to save product.");
      return;
    }
    if (file) {
      const productId = `upc_${data.upc}`;
      const fd = new FormData();
      fd.append("file", file);
      fd.append("productId", productId);
      const uploadRes = await fetch("/api/admin/upload", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });
      if (!uploadRes.ok) {
        alert(`Image upload failed (${uploadRes.status}). Product saved without image.`);
      }
    }
    await loadProducts();
    setCreating(false);
  }

  async function handleUpdate(
    data: { id?: string; upc: string; name: string; description: string; price: string; category: string; photoUrl: string },
    file: File | null,
  ) {
    if (!data.id) return;
    const res = await fetch(`/api/admin/products/${data.id}`, {
      method: "PUT",
      headers,
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      alert("Failed to save product.");
      return;
    }
    if (file) {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("productId", data.id);
      const uploadRes = await fetch("/api/admin/upload", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });
      if (!uploadRes.ok) {
        alert(`Image upload failed (${uploadRes.status}). Product saved without image.`);
      }
    }
    await loadProducts();
    setEditing(null);
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this product?")) return;
    await fetch(`/api/admin/products/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    loadProducts();
  }

  const filtered = products.filter(
    (p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.upc.includes(search)
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-black">Products</h1>
        <button
          onClick={() => { setCreating(true); setEditing(null); }}
          className="flex items-center gap-1.5 rounded-2xl py-2.5 px-4 bg-[var(--candy-green-bg)] border border-[var(--candy-green-border)] text-[#065F46] font-black text-sm transition-colors hover:bg-[rgba(52,211,153,0.28)]"
        >
          <Plus className="size-4" /> New Product
        </button>
      </div>

      {(creating || editing) && (
        <div className="bg-white border border-[var(--candy-border)] rounded-[18px] p-4 shadow-sm mb-6">
          <h3 className="text-sm font-black mb-3">
            {creating ? "Create Product" : "Edit Product"}
          </h3>
          <ProductForm
            key={editing?.id ?? "new"}
            initial={
              editing
                ? {
                    id: editing.id,
                    upc: editing.upc,
                    name: editing.name,
                    description: editing.description,
                    price: editing.price,
                    category: editing.category,
                    photoUrl: editing.photo_url,
                  }
                : undefined
            }
            onSave={editing ? handleUpdate : handleCreate}
            onCancel={() => { setCreating(false); setEditing(null); }}
          />
        </div>
      )}

      <input
        placeholder="Search products..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="mb-4 border border-[var(--candy-border)] rounded-[14px] py-2.5 px-3 bg-white text-sm w-full max-w-sm"
      />

      {/* Desktop table */}
      <div className="hidden md:block bg-white border border-[var(--candy-border)] rounded-[18px] shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-[#F1F5F9] text-left">
              <th className="px-4 py-3 font-bold text-[var(--candy-muted)]">Name</th>
              <th className="px-4 py-3 font-bold text-[var(--candy-muted)]">UPC</th>
              <th className="px-4 py-3 font-bold text-[var(--candy-muted)]">Category</th>
              <th className="px-4 py-3 font-bold text-[var(--candy-muted)] text-right">Price</th>
              <th className="px-4 py-3 font-bold text-[var(--candy-muted)] text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((p) => (
              <tr key={p.id} className="border-t border-[var(--candy-border)]">
                <td className="px-4 py-3 font-bold">{p.name}</td>
                <td className="px-4 py-3 font-mono text-xs text-[var(--candy-muted)]">{p.upc}</td>
                <td className="px-4 py-3">{p.category}</td>
                <td className="px-4 py-3 text-right text-[#16A34A] font-bold">${Number(p.price).toFixed(2)}</td>
                <td className="px-4 py-3 text-right">
                  <div className="flex gap-1 justify-end">
                    <button
                      onClick={() => { setEditing(p); setCreating(false); }}
                      className="p-1.5 rounded-lg hover:bg-[#F1F5F9] transition-colors"
                    >
                      <Pencil className="size-4 text-[var(--candy-muted)]" />
                    </button>
                    <button
                      onClick={() => handleDelete(p.id)}
                      className="p-1.5 rounded-lg hover:bg-[rgba(239,68,68,0.08)] transition-colors"
                    >
                      <Trash2 className="size-4 text-[#EF4444]" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="p-6 text-center text-[var(--candy-muted)]">No products found.</div>
        )}
      </div>

      {/* Mobile cards */}
      <div className="md:hidden space-y-3">
        {filtered.map((p) => (
          <div
            key={p.id}
            className="bg-white border border-[var(--candy-border)] rounded-[18px] p-4 shadow-sm"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="font-bold text-sm truncate">{p.name}</div>
                <div className="font-mono text-xs text-[var(--candy-muted)] mt-0.5">{p.upc}</div>
              </div>
              <div className="text-right shrink-0">
                <div className="text-[#16A34A] font-bold text-sm">${Number(p.price).toFixed(2)}</div>
              </div>
            </div>
            <div className="text-xs text-[var(--candy-muted)] mt-1.5">{p.category}</div>
            <div className="flex gap-2 mt-3 pt-3 border-t border-[var(--candy-border)]">
              <button
                onClick={() => { setEditing(p); setCreating(false); }}
                className="flex items-center gap-1 text-xs font-bold text-[var(--candy-muted)] hover:text-[var(--candy-text)] transition-colors"
              >
                <Pencil className="size-3.5" /> Edit
              </button>
              <button
                onClick={() => handleDelete(p.id)}
                className="flex items-center gap-1 text-xs font-bold text-[#EF4444] hover:text-[#DC2626] transition-colors"
              >
                <Trash2 className="size-3.5" /> Delete
              </button>
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="bg-white border border-[var(--candy-border)] rounded-[18px] p-6 text-center text-[var(--candy-muted)] shadow-sm">
            No products found.
          </div>
        )}
      </div>
    </div>
  );
}
