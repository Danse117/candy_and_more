// components/custom/product-card.tsx
"use client";

import { useCart } from "@/lib/cart-context";
import type { Product } from "@/lib/types";

const CATEGORY_ICONS: Record<string, string> = {
  "Gummies & Chewy Candy": "🍬",
  "Cookies & Wafers": "🍪",
  "Chips & Snacks": "🍟",
  "Chocolate Bars": "🍫",
  "Gum & Mints": "🍃",
  "Protein & Energy Bars": "💪",
  "Noodles & Soups": "🍜",
  "Rolling Papers": "📜",
  "Fragrances & Candles": "🕯️",
};

interface ProductCardProps {
  product: Product;
}

export default function ProductCard({ product }: ProductCardProps) {
  const { addItem } = useCart();
  const hasImage = product.photoUrl && product.photoUrl !== "MISSING";

  return (
    <div className="bg-[var(--candy-card)] border border-[var(--candy-border)] rounded-[20px] overflow-hidden shadow-[var(--candy-shadow)] flex flex-row sm:flex-col transition-all duration-150 hover:-translate-y-[3px] hover:shadow-[0_16px_40px_rgba(2,6,23,0.12)] max-w-full">
      {/* Thumbnail */}
      <div className="w-[100px] shrink-0 sm:w-auto sm:h-[170px] bg-[#F1F5F9] flex items-center justify-center relative overflow-hidden">
        {hasImage ? (
          <img
            src={product.photoUrl}
            alt={product.name}
            className="h-full w-full object-contain p-2 sm:p-3 transition-transform duration-200 hover:scale-105"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center flex-col gap-1 sm:gap-2 bg-gradient-to-br from-[#E0F2FE] to-[#F0FDF4] p-2 sm:p-4">
            <span className="text-2xl sm:text-4xl opacity-50">
              {CATEGORY_ICONS[product.category] || "📦"}
            </span>
            <span className="hidden sm:block text-[11px] font-bold text-center text-[var(--candy-muted)] leading-tight max-w-[90%] line-clamp-2">
              {product.name}
            </span>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-2.5 sm:p-3 flex flex-col gap-1.5 sm:gap-2 flex-1 min-w-0 overflow-hidden">
        <span className="text-[10px] px-2 py-0.5 bg-[rgba(96,165,250,0.1)] rounded-md text-[#3B82F6] font-bold self-start truncate max-w-full">
          {product.category}
        </span>
        <div className="font-black text-sm leading-tight truncate">{product.name}</div>
        <div className="text-[var(--candy-muted)] text-xs line-clamp-1 sm:line-clamp-2">
          {product.description}
        </div>
        <div className="flex justify-between items-center gap-2 text-[var(--candy-muted)] text-xs">
          <span className="text-[10px] px-1.5 py-0.5 bg-[rgba(100,116,139,0.08)] rounded-md font-mono truncate">
            {product.upc}
          </span>
          <span className="text-[#16A34A] font-black shrink-0">
            ${product.price.toFixed(2)}
          </span>
        </div>
        <button
          onClick={() => addItem(product.id)}
          className="mt-auto w-full border border-[var(--candy-green-border)] rounded-2xl py-2 sm:py-2.5 px-3 cursor-pointer bg-[var(--candy-green-bg)] text-[#065F46] font-black text-sm transition-all hover:bg-[rgba(52,211,153,0.28)] hover:-translate-y-px active:translate-y-0"
        >
          Add to cart
        </button>
      </div>
    </div>
  );
}
