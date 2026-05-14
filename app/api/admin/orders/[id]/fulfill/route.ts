import { NextRequest, NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/auth/admin-guard";
import { getDb } from "@/lib/db";
import { ordersTable } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { response } = await requireAdminSession();
  if (response) return response;

  const { id } = await params;
  const orderId = Number(id);
  if (!Number.isFinite(orderId)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  let body: { fulfilled?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (typeof body.fulfilled !== "boolean") {
    return NextResponse.json(
      { error: "Body must include { fulfilled: boolean }" },
      { status: 400 }
    );
  }

  const db = getDb();
  const updated = await db
    .update(ordersTable)
    .set({ fulfilledAt: body.fulfilled ? new Date() : null })
    .where(eq(ordersTable.id, orderId))
    .returning();

  if (updated.length === 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(updated[0]);
}
