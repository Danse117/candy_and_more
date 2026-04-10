import { NextRequest, NextResponse } from "next/server";
import { validateAdminToken } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { productsTable } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await validateAdminToken(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await request.json();
  const db = getDb();

  await db
    .update(productsTable)
    .set({
      name: body.name,
      upc: body.upc,
      description: body.description || "",
      price: Number(body.price).toFixed(2),
      category: body.category,
      photoUrl: body.photoUrl || "MISSING",
      updatedAt: new Date(),
    })
    .where(eq(productsTable.id, id));

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await validateAdminToken(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const db = getDb();
  await db.delete(productsTable).where(eq(productsTable.id, id));

  return NextResponse.json({ ok: true });
}
