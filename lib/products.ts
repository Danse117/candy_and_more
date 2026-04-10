import type { Product } from "./types";

// Import the raw JS product array (untyped — allowJs resolves it)
import rawProducts from "../products";

export const products: Product[] = rawProducts as Product[];

export function getCategories(): string[] {
  const cats = new Map<string, number>();
  for (const p of products) {
    cats.set(p.category, (cats.get(p.category) || 0) + 1);
  }
  // Sort by count descending
  return Array.from(cats.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([cat]) => cat);
}

export function getCategoryCounts(): Map<string, number> {
  const counts = new Map<string, number>();
  for (const p of products) {
    counts.set(p.category, (counts.get(p.category) || 0) + 1);
  }
  return counts;
}

export function getProductById(id: string): Product | undefined {
  return products.find((p) => p.id === id);
}

export function searchProducts(
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

  return [...filtered].sort((a, b) => a.price - b.price);
}
