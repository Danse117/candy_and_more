// components/custom/cart-item-row.tsx
"use client";

import { useCart } from "@/lib/cart-context";
import type { Product } from "@/lib/types";

interface CartItemRowProps {
  product: Product;
  quantity: number;
}

export default function CartItemRow({ product, quantity }: CartItemRowProps) {
  const { addItem, removeItem } = useCart();

  return (
    <div className="grid grid-cols-[1fr_auto] gap-2.5 p-2.5 rounded-[14px] border-b border-[rgba(226,232,240,0.9)] last:border-b-0">
      <div>
        <strong className="text-[13px]">{product.name}</strong>
        <small className="block text-[var(--candy-muted)] mt-0.5">
          UPC: {product.upc} &bull; ${product.price.toFixed(2)} each
        </small>
      </div>
      <div className="flex items-center gap-1.5">
        <button
          onClick={() => removeItem(product.id)}
          className="w-[34px] h-[34px] rounded-xl border border-[var(--candy-border)] bg-[#F8FAFC] text-[var(--candy-text)] cursor-pointer font-black transition-colors hover:border-[var(--candy-accent)]"
        >
          −
        </button>
        <div className="min-w-[26px] text-center font-black">{quantity}</div>
        <button
          onClick={() => addItem(product.id)}
          className="w-[34px] h-[34px] rounded-xl border border-[var(--candy-border)] bg-[#F8FAFC] text-[var(--candy-text)] cursor-pointer font-black transition-colors hover:border-[var(--candy-accent)]"
        >
          +
        </button>
      </div>
    </div>
  );
}
