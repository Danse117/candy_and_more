// lib/product-helpers.ts — synchronous helpers safe for client components
// These operate on a pre-fetched products array (no DB imports)

import type { Product } from "./types";

export function searchProductsSync(
  products: Product[],
  query: string,
  category?: string
): Product[] {
  let filtered = products;

  if (category && category !== "All") {
    filtered = filtered.filter((p) => p.category === category);
  }

  if (query) {
    const q = query.toLowerCase();
    filtered = filtered.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q) ||
        p.upc.includes(q)
    );
  }

  return filtered;
}

export function findProductById(
  products: Product[],
  id: string
): Product | undefined {
  return products.find((p) => p.id === id);
}
