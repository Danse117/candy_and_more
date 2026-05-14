import { NextRequest, NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/auth/admin-guard";
import { getDb } from "@/lib/db";
import { ordersTable } from "@/lib/db/schema";
import { desc } from "drizzle-orm";

export async function GET(request: NextRequest) {
  const { response } = await requireAdminSession();
  if (response) return response;

  const db = getDb();
  const orders = await db
    .select()
    .from(ordersTable)
    .orderBy(desc(ordersTable.createdAt));

  return NextResponse.json(orders);
}
