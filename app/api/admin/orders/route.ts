import { NextRequest, NextResponse } from "next/server";
import { validateAdminToken } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { ordersTable } from "@/lib/db/schema";
import { desc } from "drizzle-orm";

export async function GET(request: NextRequest) {
  const user = await validateAdminToken(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = getDb();
  const orders = await db
    .select()
    .from(ordersTable)
    .orderBy(desc(ordersTable.createdAt));

  return NextResponse.json(orders);
}
