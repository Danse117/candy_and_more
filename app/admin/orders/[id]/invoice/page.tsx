"use client";

import { useEffect, useState, use } from "react";
import { useSearchParams } from "next/navigation";
import { BUSINESS_NAME, INVOICE_FOOTER } from "@/lib/invoice-config";
import "./invoice.css";

interface Order {
  id: number;
  customerFirstName: string;
  customerLastName: string;
  customerEmail: string | null;
  customerPhone: string | null;
  storeAddress: string | null;
  note: string | null;
  items: string;
  totalPrice: string;
  submittedAt: string;
  createdAt: string;
}

interface OrderItem {
  productId: string;
  name: string;
  upc: string;
  quantity: number;
  price: number;
}

export default function InvoicePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [order, setOrder] = useState<Order | null>(null);
  const [error, setError] = useState<string | null>(null);
  const searchParams = useSearchParams();

  useEffect(() => {
    fetch(`/api/admin/orders/${id}`)
      .then(async (r) => {
        if (r.ok) {
          setOrder(await r.json());
        } else if (r.status === 404) {
          setError("Order not found.");
        } else {
          setError("Failed to load order.");
        }
      })
      .catch(() => setError("Failed to load order."));
  }, [id]);

  useEffect(() => {
    if (!order) return;

    const wantPrint = searchParams.get("print") === "1";
    const wantDownload = searchParams.get("download") === "1";

    if (wantPrint) {
      // Slight delay so the browser has painted the invoice before the dialog opens
      const timer = setTimeout(() => window.print(), 300);
      return () => clearTimeout(timer);
    }

    if (wantDownload) {
      const root = document.getElementById("invoice-root");
      if (!root) return;
      let cancelled = false;
      (async () => {
        try {
          // html2pdf.js v0.10 has no shipped types; default export is a chainable factory.
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const html2pdf = (await import("html2pdf.js")).default as any;
          if (cancelled) return;
          await html2pdf()
            .from(root)
            .set({
              filename: `invoice-${order.id}.pdf`,
              jsPDF: { unit: "in", format: "letter", orientation: "portrait" },
              html2canvas: { scale: 2, useCORS: true },
              margin: 0.5,
            })
            .save();
        } catch {
          if (!cancelled) {
            alert(
              "PDF generation failed. Use the Print button and choose 'Save as PDF' from the print dialog."
            );
          }
        }
      })();
      return () => {
        cancelled = true;
      };
    }
  }, [order, searchParams]);

  if (error) {
    return <p style={{ padding: "2rem", textAlign: "center" }}>{error}</p>;
  }
  if (!order) {
    return <p style={{ padding: "2rem", textAlign: "center" }}>Loading…</p>;
  }

  let items: OrderItem[] = [];
  try {
    items = JSON.parse(order.items);
  } catch {
    items = [];
  }

  const orderNumber = `#${String(order.id).padStart(5, "0")}`;
  const submittedDate = new Date(order.submittedAt).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const grandTotal = Number(order.totalPrice).toFixed(2);

  return (
    <div id="invoice-screen-wrap">
      <div id="invoice-root">
        {/* Header */}
        <header className="invoice-header">
          <h1 className="invoice-business">{BUSINESS_NAME}</h1>
          <div className="invoice-meta">
            <div className="invoice-title">INVOICE</div>
            <div className="invoice-number">{orderNumber}</div>
            <div className="invoice-date">{submittedDate}</div>
          </div>
        </header>

        {/* Bill To */}
        <section className="invoice-billto">
          <h2>Bill To:</h2>
          <div className="invoice-customer-name">
            {order.customerFirstName} {order.customerLastName}
          </div>
          {order.customerEmail && <div>{order.customerEmail}</div>}
          {order.customerPhone && <div>{order.customerPhone}</div>}
          {order.storeAddress && <div>{order.storeAddress}</div>}
        </section>

        {/* Items table */}
        <table className="invoice-items">
          <thead>
            <tr>
              <th className="col-product">Product</th>
              <th className="col-upc">UPC</th>
              <th className="col-qty">Qty</th>
              <th className="col-unit">Unit</th>
              <th className="col-subtotal">Subtotal</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, i) => (
              <tr key={i}>
                <td className="col-product">{item.name}</td>
                <td className="col-upc">{item.upc}</td>
                <td className="col-qty">{item.quantity}</td>
                <td className="col-unit">${Number(item.price).toFixed(2)}</td>
                <td className="col-subtotal">
                  ${(Number(item.price) * item.quantity).toFixed(2)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Total */}
        <div className="invoice-total">
          <span className="invoice-total-label">TOTAL</span>
          <span className="invoice-total-amount">${grandTotal}</span>
        </div>

        {/* Notes — only when present */}
        {order.note && (
          <section className="invoice-notes">
            <h2>Notes:</h2>
            <p>{order.note}</p>
          </section>
        )}

        {/* Footer */}
        <footer className="invoice-footer">{INVOICE_FOOTER}</footer>
      </div>
    </div>
  );
}
