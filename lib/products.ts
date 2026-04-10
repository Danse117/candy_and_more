// lib/products.ts — server-only async DB queries
// Do NOT import this file from client components (it uses @netlify/neon)

import type { Product } from "./types";
import { getDb } from "./db";
import { productsTable } from "./db/schema";
import { asc } from "drizzle-orm";

function rowToProduct(row: typeof productsTable.$inferSelect): Product {
  return {
    id: row.id,
    upc: row.upc,
    name: row.name,
    description: row.description,
    price: Number(row.price),
    category: row.category,
    photoUrl: row.photoUrl,
  };
}

export async function getProducts(): Promise<Product[]> {
  const db = getDb();
  const rows = await db.select().from(productsTable).orderBy(asc(productsTable.upc));
  return rows.map(rowToProduct);
}

export async function getCategories(): Promise<string[]> {
  const products = await getProducts();
  const cats = new Map<string, number>();
  for (const p of products) {
    cats.set(p.category, (cats.get(p.category) || 0) + 1);
  }
  return Array.from(cats.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([cat]) => cat);
}

export async function getCategoryCounts(): Promise<Record<string, number>> {
  const products = await getProducts();
  const counts: Record<string, number> = {};
  for (const p of products) {
    counts[p.category] = (counts[p.category] || 0) + 1;
  }
  return counts;
}
