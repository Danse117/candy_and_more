// app/api/admin/upload/route.ts
import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { validateAdminToken } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { productImagesTable, productsTable } from "@/lib/db/schema";

export async function POST(request: NextRequest) {
  const user = await validateAdminToken(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  const productId = formData.get("productId") as string | null;

  if (!file || !productId) {
    return NextResponse.json(
      { error: "Missing file or productId" },
      { status: 400 }
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const contentType = file.type || "image/jpeg";
  const now = new Date();

  const db = getDb();

  await db
    .insert(productImagesTable)
    .values({
      productId,
      data: buffer,
      contentType,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: productImagesTable.productId,
      set: {
        data: buffer,
        contentType,
        updatedAt: now,
      },
    });

  // Point the catalog at the serving route so public pages render the new image.
  const url = `/api/images/${productId}`;
  await db
    .update(productsTable)
    .set({ photoUrl: url, updatedAt: now })
    .where(eq(productsTable.id, productId));

  return NextResponse.json({ ok: true, url });
}
