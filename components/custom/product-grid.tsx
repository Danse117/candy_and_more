"use client";

import type { Product } from "@/lib/types";
import ProductCard from "./product-card";
import FadeUp from "@/components/animations/fade-up";

interface ProductGridProps {
  products: Product[];
}

export default function ProductGrid({ products }: ProductGridProps) {
  if (products.length === 0) {
    return (
      <div className="py-6 px-4 text-[var(--candy-muted)] text-center border border-dashed border-[rgba(100,116,139,0.35)] rounded-[20px] bg-[rgba(255,255,255,0.75)] shadow-sm">
        No products match your search.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3.5 py-4 pb-8">
      {products.map((product, i) => (
        <FadeUp key={product.id} delay={Math.min(i * 0.015, 0.4)}>
          <ProductCard product={product} />
        </FadeUp>
      ))}
    </div>
  );
}
