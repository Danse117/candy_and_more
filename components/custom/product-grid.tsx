"use client";

import type { Product } from "@/lib/types";
import ProductCard from "./product-card";
import FadeUp from "@/components/animations/fade-up";

interface ProductGridProps {
  products: Product[];
  visibleCount: number;
  onLoadMore: () => void;
}

export default function ProductGrid({ products, visibleCount, onLoadMore }: ProductGridProps) {
  if (products.length === 0) {
    return (
      <div className="py-6 px-4 text-[var(--candy-muted)] text-center border border-dashed border-[rgba(100,116,139,0.35)] rounded-[20px] bg-[rgba(255,255,255,0.75)] shadow-sm">
        No products match your search.
      </div>
    );
  }

  const visible = products.slice(0, visibleCount);
  const hasMore = visibleCount < products.length;

  return (
    <div>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3.5 py-4 pb-4">
        {visible.map((product, i) => (
          <FadeUp key={product.id} delay={Math.min(i * 0.015, 0.4)}>
            <ProductCard product={product} />
          </FadeUp>
        ))}
      </div>
      {hasMore && (
        <div className="flex flex-col items-center gap-1.5 pb-8 pt-2">
          <span className="text-xs text-[var(--candy-muted)]">
            Showing {visible.length} of {products.length} products
          </span>
          <button
            onClick={onLoadMore}
            className="rounded-2xl py-3 px-8 cursor-pointer bg-[var(--candy-accent-bg)] border border-[var(--candy-accent-border)] text-[#0B3B66] font-black text-sm transition-all hover:bg-[rgba(96,165,250,0.28)] hover:-translate-y-px active:translate-y-0"
          >
            Load more
          </button>
        </div>
      )}
    </div>
  );
}
