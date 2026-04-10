import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { productsTable } from "./schema";
import * as fs from "fs";
import * as path from "path";

interface RawProduct {
  id: string;
  upc: string;
  name: string;
  description: string;
  price: number;
  category: string;
  photoUrl: string;
}

const IMAGE_EXTENSIONS = ["jpg", "jpeg", "png", "webp", "avif", "svg"];

/**
 * Find a product image in public/product-images/ by UPC.
 * Returns the public URL path (e.g., "/product-images/038000014697.jpg")
 * or null if no image exists.
 */
function findProductImageUrl(upc: string, imagesDir: string): string | null {
  for (const ext of IMAGE_EXTENSIONS) {
    const filePath = path.join(imagesDir, `${upc}.${ext}`);
    if (fs.existsSync(filePath)) {
      return `/product-images/${upc}.${ext}`;
    }
  }
  return null;
}

async function seed() {
  if (!process.env.NETLIFY_DATABASE_URL) {
    console.error("NETLIFY_DATABASE_URL is not set. Run via: npm run db:seed");
    process.exit(1);
  }

  const sql = neon(process.env.NETLIFY_DATABASE_URL!);
  const db = drizzle(sql);

  // Import products — CJS module at project root
  const projectRoot = path.resolve(__dirname, "../..");
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const rawProducts: RawProduct[] = require(path.join(projectRoot, "products"));
  const imagesDir = path.join(projectRoot, "public", "product-images");

  // Clear existing data
  await db.delete(productsTable);
  console.log("Cleared existing products.");

  console.log(`Seeding ${rawProducts.length} products...`);

  let imagesFound = 0;
  const BATCH_SIZE = 50;

  for (let i = 0; i < rawProducts.length; i += BATCH_SIZE) {
    const batch = rawProducts.slice(i, i + BATCH_SIZE);
    await db.insert(productsTable).values(
      batch.map((p) => {
        // Check for local image by UPC, even if photoUrl is "MISSING"
        const localImageUrl = findProductImageUrl(p.upc, imagesDir);
        const photoUrl = localImageUrl || (p.photoUrl !== "MISSING" ? p.photoUrl : "MISSING");
        if (localImageUrl) imagesFound++;

        return {
          id: p.id,
          upc: p.upc,
          name: p.name,
          description: p.description || "",
          price: p.price.toFixed(2),
          category: p.category,
          photoUrl,
        };
      })
    );
    console.log(`  Inserted ${Math.min(i + BATCH_SIZE, rawProducts.length)} / ${rawProducts.length}`);
  }

  console.log(`\nSeeding complete!`);
  console.log(`  ${rawProducts.length} products inserted`);
  console.log(`  ${imagesFound} products have local images`);
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
