// app/api/send-order/route.ts
import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import type { OrderPayload } from "@/lib/types";
import { buildOrderConfirmationHtml } from "@/lib/email-template";
import { getDb } from "@/lib/db";
import { ordersTable } from "@/lib/db/schema";

export async function POST(request: NextRequest) {
  let body: OrderPayload;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  // Validate required fields
  if (!body.customerFirstName || !body.customerLastName || !body.customerEmail) {
    return NextResponse.json(
      { error: "Missing required customer information" },
      { status: 400 }
    );
  }

  if (!body.items || body.items.length === 0) {
    return NextResponse.json({ error: "Cart is empty" }, { status: 400 });
  }

  // 1. Persist order — critical path. Failure returns 500.
  try {
    const db = getDb();
    await db.insert(ordersTable).values({
      customerFirstName: body.customerFirstName,
      customerLastName: body.customerLastName,
      customerEmail: body.customerEmail,
      note: body.note || null,
      items: JSON.stringify(body.items),
      totalPrice: body.totalPrice.toString(),
      submittedAt: new Date(body.submittedAt),
    });
  } catch (err) {
    console.error("[send-order] DB insert failed:", err);
    return NextResponse.json({ error: "Failed to save order" }, { status: 500 });
  }

  // 2. Send confirmation email — nice-to-have. Failure is logged, not returned.
  try {
    const resend = new Resend(process.env.RESEND_API_KEY);
    const html = buildOrderConfirmationHtml(body);
    const { error } = await resend.emails.send({
      from: "Candy & More <orders@candyandmoredistrocorp.com>",
      to: body.customerEmail,
      subject: `Order Confirmation — Candy & More`,
      html,
    });
    if (error) {
      console.error("[send-order] Resend returned error:", error);
    }
  } catch (err) {
    console.error("[send-order] Resend threw:", err);
  }

  return NextResponse.json({ ok: true });
}
