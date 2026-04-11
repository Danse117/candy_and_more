// app/api/images/[productId]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { productImagesTable } from "@/lib/db/schema";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ productId: string }> }
) {
  const { productId } = await params;

  const db = getDb();
  const [row] = await db
    .select()
    .from(productImagesTable)
    .where(eq(productImagesTable.productId, productId))
    .limit(1);

  if (!row) {
    return new NextResponse("Not Found", { status: 404 });
  }

  return new NextResponse(new Uint8Array(row.data), {
    status: 200,
    headers: {
      "Content-Type": row.contentType,
      "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
    },
  });
}
