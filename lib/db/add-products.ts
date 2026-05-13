import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { productsTable } from "./schema";
import { inArray } from "drizzle-orm";

interface NewProduct {
  brand: string;
  product: string;
  size: string;
  upc: string;
  category: string;
}

const NEW_PRODUCTS: NewProduct[] = [
  { brand: "Aleve", product: "Naproxen Sodium Tablets Display Pack", size: "48 packets x 1 caplet", upc: "325866530882", category: "Pharmacy" },
  { brand: "Blunteffects", product: "100% Concentrated Air Freshener", size: "1 oz bottle / 50 count display", upc: "700786110008", category: "Fragrances & Candles" },
  { brand: "Blunteffects", product: "Perfume Wands", size: "72 count display", upc: "087860098934", category: "Fragrances & Candles" },
  { brand: "Blink", product: "Torch Lighter Variety Pack", size: "12 count display / 820 series", upc: "288166677230", category: "Smoking Supplies" },
  { brand: "ZIQ", product: "Pregnancy Test", size: "1 test / 12 boxes display", upc: "610466990001", category: "Pharmacy" },
  { brand: "Blink", product: "Big Torch", size: "Large torch lighter", upc: "288166677231", category: "Smoking Supplies" },
  { brand: "Blink", product: "Medium Torch", size: "Medium torch lighter", upc: "288166677232", category: "Smoking Supplies" },
  { brand: "Blink", product: "Small Torch", size: "Small torch lighter", upc: "288166677233", category: "Smoking Supplies" },
  { brand: "MK", product: "Lighters", size: "Assorted display", upc: "400000000101", category: "Smoking Supplies" },
  { brand: "BIC", product: "Lighters", size: "Assorted display", upc: "400000000102", category: "Smoking Supplies" },
  { brand: "Generic", product: "Glass Ashtray", size: "Standard glass ashtray", upc: "400000000103", category: "Smoking Supplies" },
  { brand: "Generic", product: "Herb Grinder - Small", size: "Small grinder", upc: "400000000104", category: "Smoking Supplies" },
  { brand: "Generic", product: "Herb Grinder - Large", size: "Large grinder", upc: "400000000105", category: "Smoking Supplies" },
  { brand: "Generic", product: "Digital Scale - Small", size: "Small digital scale", upc: "400000000106", category: "Smoking Supplies" },
  { brand: "Generic", product: "Digital Scale - Large", size: "Large digital scale", upc: "400000000107", category: "Smoking Supplies" },
  { brand: "Generic", product: "Glass Pipes", size: "Assorted glass pipes", upc: "400000000108", category: "Smoking Supplies" },
];

async function addProducts() {
  if (!process.env.NETLIFY_DATABASE_URL) {
    console.error("NETLIFY_DATABASE_URL is not set. Run via: netlify dev:exec npx tsx lib/db/add-products.ts");
    process.exit(1);
  }

  const sql = neon(process.env.NETLIFY_DATABASE_URL!);
  const db = drizzle(sql);

  const rows = NEW_PRODUCTS.map((p) => ({
    id: `upc_${p.upc}`,
    upc: p.upc,
    name: `${p.brand} ${p.product}`.toUpperCase(),
    description: p.size,
    price: "0.00",
    category: p.category,
    photoUrl: "MISSING",
  }));

  const ids = rows.map((r) => r.id);
  const existing = await db
    .select({ id: productsTable.id })
    .from(productsTable)
    .where(inArray(productsTable.id, ids));
  const existingIds = new Set(existing.map((e) => e.id));

  const toInsert = rows.filter((r) => !existingIds.has(r.id));
  const skipped = rows.filter((r) => existingIds.has(r.id));

  if (skipped.length) {
    console.log(`Skipping ${skipped.length} already-present products:`);
    for (const r of skipped) console.log(`  - ${r.id} (${r.name})`);
  }

  if (!toInsert.length) {
    console.log("Nothing new to insert.");
    return;
  }

  console.log(`Inserting ${toInsert.length} new products...`);
  await db.insert(productsTable).values(toInsert);
  console.log("Done.");

  const byCat = toInsert.reduce<Record<string, number>>((acc, r) => {
    acc[r.category] = (acc[r.category] || 0) + 1;
    return acc;
  }, {});
  console.log("\nInserted by category:");
  for (const [cat, n] of Object.entries(byCat)) console.log(`  ${cat}: ${n}`);
}

addProducts().catch((err) => {
  console.error("Insert failed:", err);
  process.exit(1);
});
