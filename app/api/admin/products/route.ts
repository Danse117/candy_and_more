import { NextRequest, NextResponse } from "next/server";
import { validateAdminToken } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { productsTable } from "@/lib/db/schema";
import { asc } from "drizzle-orm";

export async function GET(request: NextRequest) {
  const user = await validateAdminToken(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = getDb();
  const products = await db.select().from(productsTable).orderBy(asc(productsTable.name));
  return NextResponse.json(products);
}

export async function POST(request: NextRequest) {
  const user = await validateAdminToken(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const db = getDb();

  const id = `upc_${body.upc}`;
  await db.insert(productsTable).values({
    id,
    upc: body.upc,
    name: body.name,
    description: body.description || "",
    price: Number(body.price).toFixed(2),
    category: body.category,
    photoUrl: body.photoUrl || "MISSING",
  });

  return NextResponse.json({ ok: true, id }, { status: 201 });
}
