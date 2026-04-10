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

const MIME_TYPES: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  avif: "image/avif",
  svg: "image/svg+xml",
};

function findProductImage(upc: string, imagesDir: string): string | null {
  for (const ext of IMAGE_EXTENSIONS) {
    const filePath = path.join(imagesDir, `${upc}.${ext}`);
    if (fs.existsSync(filePath)) {
      const buffer = fs.readFileSync(filePath);
      const base64 = buffer.toString("base64");
      const mime = MIME_TYPES[ext];
      return `data:${mime};base64,${base64}`;
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
  const rawProducts: RawProduct[] = require(path.join(projectRoot, "products"));
  const imagesDir = path.join(projectRoot, "images");

  console.log(`Seeding ${rawProducts.length} products...`);

  let imagesFound = 0;
  const BATCH_SIZE = 50;

  for (let i = 0; i < rawProducts.length; i += BATCH_SIZE) {
    const batch = rawProducts.slice(i, i + BATCH_SIZE);
    const values = batch.map((p) => {
      const imageData = findProductImage(p.upc, imagesDir);
      if (imageData) imagesFound++;
      return {
        id: p.id,
        upc: p.upc,
        name: p.name,
        description: p.description || "",
        price: p.price.toFixed(2),
        category: p.category,
        photoUrl: p.photoUrl || "MISSING",
        imageData,
      };
    });

    await db.insert(productsTable).values(values);
    console.log(
      `  Inserted ${Math.min(i + BATCH_SIZE, rawProducts.length)} / ${rawProducts.length}`
    );
  }

  console.log(`\nSeeding complete! ${imagesFound} products have images.`);
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
