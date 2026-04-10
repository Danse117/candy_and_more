// lib/email-template.ts
import type { OrderPayload } from "./types";

export function buildOrderConfirmationHtml(order: OrderPayload): string {
  const itemRows = order.items
    .map(
      (item) => `
      <tr>
        <td style="padding:8px 12px; border-bottom:1px solid #E2E8F0; font-size:14px;">${item.name}</td>
        <td style="padding:8px 12px; border-bottom:1px solid #E2E8F0; font-size:14px; font-family:monospace;">${item.upc}</td>
        <td style="padding:8px 12px; border-bottom:1px solid #E2E8F0; font-size:14px; text-align:center;">${item.quantity}</td>
        <td style="padding:8px 12px; border-bottom:1px solid #E2E8F0; font-size:14px; text-align:right;">$${(item.price * item.quantity).toFixed(2)}</td>
      </tr>`
    )
    .join("");

  return `
    <div style="font-family:'DM Sans',system-ui,sans-serif; max-width:600px; margin:0 auto; background:#F8FAFC; padding:24px;">
      <div style="background:#FFFFFF; border:1px solid #E2E8F0; border-radius:16px; overflow:hidden;">
        <div style="padding:24px; border-bottom:1px solid #E2E8F0;">
          <h1 style="margin:0; font-size:20px; font-weight:900;">
            Candy <span style="color:#60A5FA;">&amp;</span> More
          </h1>
          <p style="margin:8px 0 0; color:#64748B; font-size:14px;">Order Confirmation</p>
        </div>
        <div style="padding:24px;">
          <p style="margin:0 0 16px; font-size:14px;">
            Hi <strong>${order.customerFirstName}</strong>, thank you for your order!
          </p>
          ${order.note ? `<p style="margin:0 0 16px; font-size:14px; color:#64748B;"><em>Note: ${order.note}</em></p>` : ""}
          <table style="width:100%; border-collapse:collapse; margin:16px 0;">
            <thead>
              <tr style="background:#F1F5F9;">
                <th style="padding:8px 12px; text-align:left; font-size:12px; font-weight:700; color:#64748B;">Product</th>
                <th style="padding:8px 12px; text-align:left; font-size:12px; font-weight:700; color:#64748B;">UPC</th>
                <th style="padding:8px 12px; text-align:center; font-size:12px; font-weight:700; color:#64748B;">Qty</th>
                <th style="padding:8px 12px; text-align:right; font-size:12px; font-weight:700; color:#64748B;">Subtotal</th>
              </tr>
            </thead>
            <tbody>${itemRows}</tbody>
          </table>
          <div style="text-align:right; font-size:16px; font-weight:900; padding:12px; background:#F0FDF4; border-radius:12px; border:1px solid rgba(52,211,153,0.4);">
            Total: $${order.totalPrice.toFixed(2)}
          </div>
        </div>
        <div style="padding:16px 24px; background:#F8FAFC; border-top:1px solid #E2E8F0; font-size:12px; color:#64748B; text-align:center;">
          We'll be in touch soon to confirm availability and arrange delivery.
        </div>
      </div>
    </div>
  `;
}
