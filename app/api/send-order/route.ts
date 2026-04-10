// app/api/send-order/route.ts
import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import type { OrderPayload } from "@/lib/types";
import { buildOrderConfirmationHtml } from "@/lib/email-template";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(request: NextRequest) {
  try {
    const body: OrderPayload = await request.json();

    // Validate required fields
    if (!body.customerFirstName || !body.customerLastName || !body.customerEmail) {
      return NextResponse.json(
        { error: "Missing required customer information" },
        { status: 400 }
      );
    }

    if (!body.items || body.items.length === 0) {
      return NextResponse.json(
        { error: "Cart is empty" },
        { status: 400 }
      );
    }

    const html = buildOrderConfirmationHtml(body);

    const { error } = await resend.emails.send({
      from: "Candy & More <orders@yourdomain.com>",
      to: body.customerEmail,
      subject: `Order Confirmation — Candy & More`,
      html,
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: "Failed to send order email" },
      { status: 500 }
    );
  }
}
